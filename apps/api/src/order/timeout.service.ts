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
        this.timer = setInterval(() => this.scanAndCancelExpired().catch(()=>{}), Math.max(intervalMs, 10_000));
        this.logger.log(`Order timeout scanner started (interval=${Math.max(intervalMs, 10_000)}ms)`);
    }

    onModuleDestroy() {
        if (this.timer) { try { clearInterval(this.timer); } catch {} this.timer = null; }
    }

    private async scanAndCancelExpired() {
        // 超时时间：15分钟
        const now = Date.now();
        const threshold = new Date(now - 15 * 60 * 1000);
        const candidates = await this.prisma.order.findMany({
            where: { payStatus: 'UNPAID' as any, deletedAt: null as any, createdAt: { lt: threshold } },
            take: 50, // 分批处理
            orderBy: { id: 'asc' }
        });
        for (const ord of candidates) {
            try {
                // 尝试关闭微信订单（幂等）
                try { await this.wxpay.closeJsapi(ord.no); } catch {}
                // 执行统一取消逻辑（库存回滚仅针对已占用情况，这里为未支付大多不占用）
                await this.prisma.order.update({ where: { id: ord.id }, data: { status: 'CANCELLED' as any, payStatus: 'CANCELLED' as any, remark: '系统超时取消（15分钟未支付）' } });
                // 时间线
                try { await (this.prisma as any).orderTimeline.create({ data: { orderId: ord.id, event: 'ORDER_STATUS', value: 'CANCELLED', remark: 'TIMEOUT_15MIN', operatorUserId: null } }); } catch {}
                try { await (this.prisma as any).orderTimeline.create({ data: { orderId: ord.id, event: 'PAY_STATUS', value: 'CANCELLED', remark: 'TIMEOUT_15MIN', operatorUserId: null } }); } catch {}
                // 统一封装：恢复优惠券（补充分发 memberCouponId 到快照）
                try{ await this.coupons.restoreUsedCouponsForOrder({ orderId: ord.id, operatorUserId: null, reasonRemark: '系统超时取消恢复优惠券' }); }catch{}
            } catch (e) {
                this.logger.warn(`Auto-cancel failed for order ${ord.id}/${ord.no}: ${(e as any)?.message || e}`);
            }
        }
    }
}


