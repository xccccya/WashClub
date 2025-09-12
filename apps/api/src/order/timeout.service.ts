import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { WxpayService } from './wxpay.service.js';
import { CouponService } from '../coupon/coupon.service.js';

@Injectable()
export class OrderTimeoutService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('OrderTimeoutService');
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly prisma: PrismaService, private readonly wxpay: WxpayService, private readonly coupons: CouponService) {}

    onModuleInit() {
        const enabled = String(process.env.ORDER_TIMEOUT_ENABLED || 'true').toLowerCase() !== 'false';
        const intervalMs = Number(process.env.ORDER_TIMEOUT_SCAN_MS || 60_000);
        if (!enabled) { this.logger.log('Order timeout scanner disabled by env'); return; }
        this.timer = setInterval(() => Promise.all([
            this.scanAndCancelExpired().catch(()=>{}),
            this.scanAndMarkOverdueAfterService().catch(()=>{})
        ]).then(()=>{}), Math.max(intervalMs, 10_000));
        this.logger.log(`Order timeout scanner started (interval=${Math.max(intervalMs, 10_000)}ms)`);
    }

    onModuleDestroy() {
        if (this.timer) { try { clearInterval(this.timer); } catch {} this.timer = null; }
    }

    // 服务完成后24小时仍未支付：写时间线 OVERDUE（不自动取消，仅提示运营）
    private async scanAndMarkOverdueAfterService(){
        const now = Date.now();
        const threshold = 24 * 60 * 60 * 1000; // 24h
        const candidates = await this.prisma.order.findMany({
            where: {
                type: 'SERVICE' as any,
                payAfterService: true as any,
                payStatus: 'UNPAID' as any,
                fulfillmentStatus: 'DONE' as any,
                deletedAt: null as any,
            },
            select: { id: true },
            orderBy: { id: 'asc' },
            take: 100
        });
        for (const ord of candidates){
            try{
                // 取关联队列完成时间
                const qi = await (this.prisma as any).serviceQueueItem.findFirst({ where: { orderId: ord.id }, select: { finishedAt: true } });
                const fin = qi?.finishedAt ? new Date(qi.finishedAt).getTime() : null;
                if (!fin) continue;
                if (now - fin >= threshold) {
                    // 查重：若已有 OVERDUE 记录则跳过
                    const existed = await (this.prisma as any).orderTimeline.findFirst({ where: { orderId: ord.id, event: 'NOTE', value: 'OVERDUE' } });
                    if (existed) continue;
                    await (this.prisma as any).orderTimeline.create({ data: { orderId: ord.id, event: 'NOTE', value: 'OVERDUE', remark: '服务完成超24小时未支付', operatorUserId: null } });
                }
            }catch{}
        }
    }

    private async scanAndCancelExpired() {
        // 超时时间：15分钟
        const now = new Date();
        const candidates = await this.prisma.order.findMany({
            where: {
                payStatus: 'UNPAID' as any,
                deletedAt: null as any,
                // 跳过：服务订单且先服务后付
                NOT: { AND: [ { type: 'SERVICE' as any }, { payAfterService: true as any } ] } as any,
                OR: [
                    { paymentExpireAt: { lte: now } as any },
                    // 兜底：兼容旧数据（未写入 paymentExpireAt），沿用 createdAt +15min
                    { AND: [ { paymentExpireAt: null as any }, { createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } as any } ] as any },
                ] as any,
            },
            take: 50, // 分批处理
            orderBy: { id: 'asc' }
        });
        for (const ord of candidates) {
            try {
                // 尝试关闭微信订单（幂等）
                try { await this.wxpay.closeJsapi(ord.no); } catch {}
                // 执行统一取消逻辑（需要回滚预占库存与恢复优惠券）
                await this.cancelUnpaidOrderAndRelease(ord.id);
            } catch (e) {
                this.logger.warn(`Auto-cancel failed for order ${ord.id}/${ord.no}: ${(e as any)?.message || e}`);
            }
        }
    }

    private async cancelUnpaidOrderAndRelease(orderId: number){
        // 在事务内回滚库存、更新状态并恢复优惠券
        await this.prisma.$transaction(async (tx)=>{
            const order = await tx.order.findUnique({ where: { id: orderId } });
            if (!order || (order as any).payStatus !== 'UNPAID') return;
            const items = await tx.orderItem.findMany({ where: { orderId } });
            for (const it of items){
                if (!it.productId) continue;
                const product = await tx.product.findUnique({ where: { id: it.productId }, select: { id:true, type:true, specType:true } });
                if (!product) continue;
                if (product.type !== 'PHYSICAL' && product.type !== 'VIRTUAL_CARD') continue;
                const qty = Math.max(1, Number(it.quantity||0));
                if (product.specType === 'MULTI'){
                    if (!it.skuId) continue;
                    const beforeRow = await tx.productSku.findUnique({ where: { id: it.skuId }, select: { stockQuantity: true } });
                    const before = Number(beforeRow?.stockQuantity || 0);
                    await tx.productSku.update({ where: { id: it.skuId }, data: { stockQuantity: { increment: qty } } });
                    const after = before + qty;
                    await tx.inventoryLog.create({ data: { productId: product.id, skuId: it.skuId, change: qty, beforeStock: before, afterStock: after, reason: 'ORDER_ROLLBACK' as any, remark: '超时取消回滚库存', operatorUserId: null } });
                } else {
                    const beforeRow = await tx.product.findUnique({ where: { id: product.id }, select: { stockQuantity: true } });
                    const before = Number(beforeRow?.stockQuantity || 0);
                    await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { increment: qty } } });
                    const after = before + qty;
                    await tx.inventoryLog.create({ data: { productId: product.id, skuId: null, change: qty, beforeStock: before, afterStock: after, reason: 'ORDER_ROLLBACK' as any, remark: '超时取消回滚库存', operatorUserId: null } });
                }
            }
            await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' as any, payStatus: 'CANCELLED' as any, remark: '系统超时取消（15分钟未支付）' } });
            try { await (tx as any).orderTimeline.create({ data: { orderId, event: 'ORDER_STATUS', value: 'CANCELLED', remark: 'TIMEOUT_15MIN', operatorUserId: null } }); } catch {}
            try { await (tx as any).orderTimeline.create({ data: { orderId, event: 'PAY_STATUS', value: 'CANCELLED', remark: 'TIMEOUT_15MIN', operatorUserId: null } }); } catch {}
        });
        // 事务外恢复优惠券（幂等）
        try{ await this.coupons.restoreUsedCouponsForOrder({ orderId, operatorUserId: null, reasonRemark: '系统超时取消恢复优惠券' }); }catch{}
    }
}


