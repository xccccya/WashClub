import { Injectable } from '@nestjs/common';
import { Prisma, OrderType, OrderStatus, PayMethod, PayStatus, FulfillmentStatus, AfterSalesStatus, AfterSalesType, RefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { CouponService } from '../coupon/coupon.service.js';

import { WechatShippingService } from './wechat-shipping.service.js';
import { AssetService } from '../file/asset.service.js';
import { WxpayService } from './wxpay.service.js';

@Injectable()
export class OrderService {
    private syncBindings!: (tableName: string, rowId: string, fieldName: string, urls: string[]) => Promise<void>;
    constructor(private readonly prisma: PrismaService, private readonly coupons: CouponService, private readonly wxpay: WxpayService, private readonly wxship?: WechatShippingService, private readonly assets?: AssetService) {}

    private async writeTimeline(params: { tx?: any; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }){
        try{
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        }catch{/* ignore timeline errors */}
    }

    // 成长值扣减：按每元成长值比例，对退款金额进行等比例扣减，确保累计扣减与累计入账一致
    private async deductGrowthForRefund(orderId: number, refundAmountYuan: number, operatorUserId?: number | null, opts?: { finalizeAll?: boolean }){
        if (!refundAmountYuan || refundAmountYuan <= 0) return;
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;
        const paidYuan = Number(order.payAmount || 0);
        if (paidYuan <= 0) return;
        // 读取“该订单实际入账成长值上限”：优先取 PAY 日志累积（避免配置漂移），否则回退为 floor(payAmount * current growthPerYuan)
        let totalGrowthForOrder = 0;
        try {
            const payLogs:any[] = await (this.prisma as any).memberGrowthLog.findMany({ where: { orderId: order.id, source: 'PAY' }, select: { change: true } });
            const sumPay = (payLogs||[]).reduce((s,r)=> s + Math.max(0, Number(r.change||0)), 0);
            totalGrowthForOrder = Math.max(0, Math.floor(sumPay));
        } catch { totalGrowthForOrder = 0; }
        if (totalGrowthForOrder <= 0){
            const ss: any = await this.prisma.siteSetting.findFirst().catch(()=>null);
            const growthPerYuan = Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1)));
            totalGrowthForOrder = Math.max(0, Math.floor(paidYuan * growthPerYuan));
        }

        // 已扣累计
        const refundedLogs: any[] = await (this.prisma as any).memberGrowthLog.findMany({ where: { orderId: order.id, source: 'REFUND' }, select: { change: true } });
        const alreadyDeducted = (refundedLogs || []).reduce((s, r) => s + Math.abs(Number(r.change || 0)), 0);
        const remaining = Math.max(0, totalGrowthForOrder - alreadyDeducted);
        if (remaining <= 0) return;

        // 本次应扣：普通部分退款按 floor(refund*yuan2growth)；若 finalizeAll=true，直接按 remaining 一次扣完
        let willDeduct = 0;
        if (opts?.finalizeAll){
            willDeduct = remaining;
        } else {
            const ss: any = await this.prisma.siteSetting.findFirst().catch(()=>null);
            const growthPerYuan = Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1)));
            const thisDeduct = Math.max(0, Math.floor(Number(refundAmountYuan) * growthPerYuan));
            willDeduct = Math.min(remaining, thisDeduct);
        }
        if (willDeduct <= 0) return;

        // 幂等与负值保护：事务内检查当前成长值，若不足则按当前值扣
        await this.prisma.$transaction(async (tx)=>{
            const m0:any = await tx.member.findUnique({ where: { id: order.memberId }, select: { id: true, /* @ts-ignore */ growthPoints: true } as any });
            const currentGrowth = Math.max(0, Number(m0?.growthPoints||0));
            const safeDeduct = Math.min(willDeduct, currentGrowth);
            if (safeDeduct <= 0) return;
            // 幂等保护：短时间内相同 orderId 与相同扣减量是否已记账（简单去重）；如需更强可引入唯一键（orderId, source, change, createdAt分钟粒度）
            const recent:any[] = await (tx as any).memberGrowthLog.findMany({ where: { orderId: order.id, source: 'REFUND', change: -safeDeduct }, orderBy: { id: 'desc' }, take: 1 });
            if (recent && recent.length){ return; }
            await tx.member.update({ where: { id: order.memberId }, data: { growthPoints: { decrement: safeDeduct } } });
            await (tx as any).memberGrowthLog.create({ data: { memberId: order.memberId, change: -safeDeduct, source: 'REFUND', desc: `订单退款扣减 ${order.no}`, orderId: order.id, operatorUserId: operatorUserId ?? null } });
            // 等级仅在阈值变更时重算：先查当前等级阈值与下一等级阈值，判断是否跨阈
            try{
                const m: any = await tx.member.findUnique({ where: { id: order.memberId }, select: { id: true, /* @ts-ignore */ growthPoints: true, levelId: true } as any });
                const gp = Number(m?.growthPoints||0);
                const levels: any[] = await tx.memberLevel.findMany({ orderBy: { /* @ts-ignore */ level: 'desc' } as any });
                const target = levels.find(l => gp >= Number((l as any)?.requiredGrowth ?? 0));
                const nextLevelId = target ? target.id : null;
                if ((m?.levelId || null) !== nextLevelId){ await tx.member.update({ where: { id: order.memberId }, data: { levelId: nextLevelId } }); }
            }catch{}
        });
    }

    // 积分扣减：按订单累计退款比例，对支付入账积分进行等比例扣减（累计口径，避免取整误差）
    private async deductPointsForRefund(orderId: number, operatorUserId?: number | null, opts?: { finalizeAll?: boolean }){
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;
        const paidYuan = Number(order.payAmount || 0);
        if (paidYuan <= 0) return;
        // 该订单实际入账积分上限：累加 PAY 日志，避免配置/倍数漂移
        let totalPointsForOrder = 0;
        try{
            const payLogs:any[] = await (this.prisma as any).memberPointsLog.findMany({ where: { orderId: order.id, source: 'PAY' }, select: { change: true } });
            totalPointsForOrder = Math.max(0, (payLogs||[]).reduce((s,r)=> s + Math.max(0, Number(r.change||0)), 0));
        }catch{ totalPointsForOrder = 0; }
        if (totalPointsForOrder <= 0) return;
        // 已扣累计：只累计负数（扣减）记录；正向（返还下单使用积分）不计入已扣统计
        const refundPointLogs: any[] = await (this.prisma as any).memberPointsLog.findMany({ where: { orderId: order.id, source: 'REFUND' }, select: { change: true } });
        const alreadyDeducted = (refundPointLogs || [])
            .filter(r => Number(r?.change || 0) < 0)
            .reduce((s, r) => s + Math.abs(Number(r.change || 0)), 0);
        const remaining = Math.max(0, totalPointsForOrder - alreadyDeducted);
        if (remaining <= 0) return;
        // 本次应扣：finalizeAll=true 直接按 remaining；否则按累计退款占比计算应扣总量与已扣差值
        let willDeduct = 0;
        if (opts?.finalizeAll){
            willDeduct = remaining;
        } else {
            const fresh = await this.prisma.order.findUnique({ where: { id: orderId } });
            const refundedSoFar = Math.max(0, Number(fresh?.refundedAmount || 0));
            const ratio = Math.max(0, Math.min(1, paidYuan > 0 ? (refundedSoFar / paidYuan) : 0));
            const targetTotal = Math.max(0, Math.floor(totalPointsForOrder * ratio));
            willDeduct = Math.max(0, Math.min(remaining, targetTotal - alreadyDeducted));
        }
        if (willDeduct <= 0) return;
        await this.prisma.$transaction(async (tx)=>{
            const m0 = await tx.member.findUnique({ where: { id: order.memberId }, select: { id: true, points: true } });
            const currentPoints = Math.max(0, Number(m0?.points || 0));
            const safeDeduct = Math.min(willDeduct, currentPoints);
            if (safeDeduct <= 0) return;
            // 幂等：1分钟内相同扣减去重（简单防抖）
            const recent:any[] = await (tx as any).memberPointsLog.findMany({ where: { orderId: order.id, source: 'REFUND', change: -safeDeduct }, orderBy: { id: 'desc' }, take: 1 });
            if (recent && recent.length) return;
            await tx.member.update({ where: { id: order.memberId }, data: { points: { decrement: safeDeduct } } });
            await (tx as any).memberPointsLog.create({ data: { memberId: order.memberId, change: -safeDeduct, source: 'REFUND', desc: `订单退款扣减 ${order.no}`, orderId: order.id, operatorUserId: operatorUserId ?? null } });
        });
    }

    private async verifyWashCardRefundable(orderId: number){
        // 若该订单购买过洗车卡，则校验可回收次数是否充足
        const addLogs = await this.prisma.washCardLog.findMany({ where: { purchaseOrderId: orderId, reason: 'PURCHASE_ADD' as any } });
        if (!addLogs.length) return { ok: true } as const;
        // 聚合到卡
        const byCard = new Map<number, number>();
        for (const log of addLogs){ byCard.set(log.cardId, (byCard.get(log.cardId)||0) + Math.abs(log.change)); }
        for (const [cardId, addCount] of byCard){
            const card = await this.prisma.washCard.findUnique({ where: { id: cardId } });
            if (!card) continue;
            if ((card.remainingTimes||0) < addCount){ return { ok:false as const, cardId, need: addCount, remain: card.remainingTimes } as const; }
        }
        return { ok: true } as const;
    }

    private async rollbackWashCardForRefund(orderId: number, operatorUserId?: number | null, ctx?: { outRefundNo?: string | null; wechatRefundId?: string | null }){
        const addLogs = await this.prisma.washCardLog.findMany({ where: { purchaseOrderId: orderId, reason: 'PURCHASE_ADD' as any } });
        if (!addLogs.length) return;
        // 获取订单号用于日志备注展示
        let orderNo: string | undefined;
        try { const ord = await this.prisma.order.findUnique({ where: { id: orderId }, select: { no: true } }); orderNo = ord?.no; } catch {}
        for (const log of addLogs){
            const card = await this.prisma.washCard.findUnique({ where: { id: log.cardId } });
            if (!card) continue;
            const canDeduct = Math.min(card.remainingTimes, Math.abs(log.change));
            const before = card.remainingTimes;
            const afterRemain = before - canDeduct;
            await this.prisma.washCard.update({ where: { id: card.id }, data: { totalTimes: Math.max(0, card.totalTimes - canDeduct), remainingTimes: afterRemain } });
            const mark = ctx?.outRefundNo ? `退款单号：${ctx.outRefundNo}` : (ctx?.wechatRefundId ? `微信退款ID：${ctx.wechatRefundId}` : `订单号：${orderNo || orderId}`);
            await this.prisma.washCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'REFUND_DEDUCT' as any, change: -canDeduct, beforeRemaining: before, afterRemaining: afterRemain, remark: `退款回收（${mark}）`, operatorUserId: operatorUserId ?? null, purchaseOrderId: orderId } as any });
        }
        await this.writeTimeline({ orderId, event: 'BENEFITS', value: 'WASHCARD_ROLLBACK', remark: '退款回收计次', operatorUserId: operatorUserId ?? null });
    }

    private async rollbackPointsForRefund(orderId: number, operatorUserId?: number | null){
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;
        const points = order.usedPoints || 0;
        if (points > 0){
            await this.prisma.member.update({ where: { id: order.memberId }, data: { points: { increment: points } } });
            await this.writeTimeline({ orderId, event: 'BENEFITS', value: 'POINTS_ROLLBACK', remark: `返还积分 ${points}`, operatorUserId: operatorUserId ?? null });
            try{ await (this.prisma as any).memberPointsLog.create({ data: { memberId: order.memberId, change: points, source: 'REFUND', desc: `退款返还积分（订单${order.no}）`, orderId: order.id, operatorUserId: operatorUserId ?? null } }); }catch{}
        }
        // 恢复所有与该订单绑定且已使用的优惠券
        try{
            const usedMcs: any[] = await (this.prisma as any).memberCoupon.findMany({ where: { orderId: order.id, usedAt: { not: null } }, include: { coupon: true } });
            if (usedMcs && usedMcs.length){
                for (const mc of usedMcs){ await (this.prisma as any).memberCoupon.update({ where: { id: mc.id }, data: { usedAt: null, orderId: null } }); try{ await (this.prisma as any).couponFlowLog.create({ data: { action: 'RESTORE', memberId: order.memberId, orderId: order.id, couponId: mc.couponId ?? null, memberCouponId: mc.id, count: 1, remark: '全额退款恢复优惠券', snapshot: order.couponInfo as any } }); }catch{} }
                await this.writeTimeline({ orderId, event: 'BENEFITS', value: 'COUPON_RESTORE', remark: `恢复${usedMcs.length}张`, operatorUserId: operatorUserId ?? null });
            }
        }catch{ await this.writeTimeline({ orderId, event: 'BENEFITS', value: 'COUPON_NOTE', remark: '优惠券恢复失败', operatorUserId: operatorUserId ?? null }); }
    }

    async verifyRefundAllowed(orderId: number, amountYuan?: number | null){
        // 若涉及洗车卡购买，且卡已部分使用，不允许全额退款；部分退款允许金额小于等于订单实付但不回收卡
        if (!amountYuan || amountYuan <= 0) return true;
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        const isFull = Math.abs(Number(order.payAmount)) - Math.abs(Number(amountYuan)) < 0.000001;
        if (!isFull) return true;
        const ok = await this.verifyWashCardRefundable(orderId);
        return !!(ok as any).ok;
    }

    async applyRefundSuccess(params: { orderId: number; amountYuan: number; method?: PayMethod | null; operatorUserId?: number | null; outRefundNo?: string | null; wechatRefundId?: string | null }){
        const { orderId, amountYuan, operatorUserId } = params;
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        const payAmountYuan = Number(order.payAmount);
        const currentRefundedYuan = Number(order.refundedAmount || 0);
        const nextRefundedYuan = Math.min(payAmountYuan, currentRefundedYuan + Number(amountYuan || 0));
        const isAllRefunded = Math.abs(payAmountYuan - nextRefundedYuan) < 0.000001;

        if (isAllRefunded){
            // 全额退款达成（可能由多次部分退款累计触达）：回滚库存、更新订单状态、回退权益
            const updated = await this.refundOrder(orderId, '渠道退款成功', operatorUserId ?? null);
            await this.rollbackWashCardForRefund(orderId, operatorUserId ?? null, { outRefundNo: params.outRefundNo ?? null, wechatRefundId: params.wechatRefundId ?? null });
            await this.rollbackPointsForRefund(orderId, operatorUserId ?? null);
            try { await this.deductPointsForRefund(orderId, operatorUserId ?? null, { finalizeAll: true }); } catch {}
            // 先将累计退款额置为全额，再进行成长值累计扣减计算
            await this.prisma.order.update({ where: { id: orderId }, data: { refundedAmount: order.payAmount } });
            // 成长值扣减（累计口径，避免多次部分退款的取整误差）：finalizeAll=true 按剩余一次扣完
            try { await this.deductGrowthForRefund(orderId, Number(amountYuan || 0), operatorUserId ?? null, { finalizeAll: true }); } catch {}
            return updated;
        }
        // 非全额：部分退款累计并记录时间线
        await this.prisma.order.update({ where: { id: orderId }, data: { refundedAmount: new Prisma.Decimal(nextRefundedYuan as any) } });
        await this.writeTimeline({ orderId, event: 'PAY_STATUS', value: 'PARTIAL_REFUND', remark: `¥${amountYuan.toFixed(2)}`, operatorUserId: operatorUserId ?? null });
        // 成长值扣减（部分退款）
        try { await this.deductGrowthForRefund(orderId, Number(amountYuan || 0), operatorUserId ?? null); } catch {}
        try { await this.deductPointsForRefund(orderId, operatorUserId ?? null); } catch {}
        return order;
    }

    // 内部退款（非渠道）统一收尾：执行退款、回收权益（洗车卡、积分）
    async finalizeInternalRefund(orderId: number, reason?: string, operatorUserId?: number | null){
        const updated = await this.refundOrder(orderId, reason, operatorUserId ?? null);
        try { await this.rollbackWashCardForRefund(orderId, operatorUserId ?? null); } catch {}
        try { await this.rollbackPointsForRefund(orderId, operatorUserId ?? null); } catch {}
        // 扣减因支付发放的积分：内部退款同样需要按该订单入账的 PAY 积分进行等额/等比扣减
        try { await this.deductPointsForRefund(orderId, operatorUserId ?? null, { finalizeAll: true }); } catch {}
        // 成长值扣减：内部全额退款
        try { await this.deductGrowthForRefund(orderId, Number((updated as any)?.payAmount || 0), operatorUserId ?? null); } catch {}
        return updated;
    }

    private generateOrderNo(type: 'SERVICE' | 'SP' | 'FK') {
        const now = new Date();
        const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
        const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
        return `${type}_${ts}_${rand}`;
    }

    async createOrder(params: { type: OrderType; memberId: number; vehicleId?: number | null; shippingAddressId?: number | null; items: Array<{ productId?: number | null; skuId?: number | null; name: string; imageUrl?: string | null; specsText?: string | null; barcode?: string | null; price: Prisma.Decimal | number; discount?: Prisma.Decimal | number; quantity: number }>; userRemark?: string | null; remark?: string | null; shippingFee?: Prisma.Decimal | number; usedPoints?: number; pointsAmount?: Prisma.Decimal | number; couponInfo?: Prisma.InputJsonValue | null; memberCouponId?: number | null; memberCouponIds?: number[] | null; disableMemberDiscount?: boolean | null; }): Promise<{ id: number; no: string }>{
        const { type, memberId, vehicleId, shippingAddressId, items, userRemark, remark, shippingFee = 0, usedPoints = 0, pointsAmount = 0, couponInfo, memberCouponId, memberCouponIds, disableMemberDiscount } = params;
        if (!items || items.length === 0) throw new Error('订单项不能为空');

        return this.prisma.$transaction(async (tx) => {
            // 若为商品订单，检查是否包含实体商品，实体商品必须提供收货地址
            let requiresAddress = false;
            const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
            if (type === 'SP' && productIds.length > 0) {
                const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, type: true } });
                const map = new Map(products.map(p => [p.id, p.type] as const));
                requiresAddress = items.some(it => (it.productId ? map.get(it.productId) === 'PHYSICAL' : false));
            }
            let addressSnapshot: Prisma.InputJsonValue | undefined = undefined;
            let addressIdToSave: number | null = null;
            if (requiresAddress) {
                if (!shippingAddressId) throw new Error('实体商品订单必须选择收货地址');
                const addr = await tx.memberAddress.findUnique({ where: { id: shippingAddressId } });
                if (!addr || addr.memberId !== memberId) throw new Error('收货地址无效');
                addressIdToSave = addr.id;
                addressSnapshot = {
                    id: addr.id,
                    province: addr.province,
                    city: addr.city,
                    district: addr.district,
                    street: addr.street,
                    detail: addr.detail,
                    phone: addr.phone,
                    label: addr.label ?? null,
                } as any;
            } else if (shippingAddressId) {
                // 非必填但传入时亦进行记录
                const addr = await tx.memberAddress.findUnique({ where: { id: shippingAddressId } });
                if (addr && addr.memberId === memberId) {
                    addressIdToSave = addr.id;
                    addressSnapshot = {
                        id: addr.id,
                        province: addr.province,
                        city: addr.city,
                        district: addr.district,
                        street: addr.street,
                        detail: addr.detail,
                        phone: addr.phone,
                        label: addr.label ?? null,
                    } as any;
                }
            }
            // 计算金额（含优惠券折扣）
            let total = new Prisma.Decimal(0);
            let discountTotal = new Prisma.Decimal(0);
            for (const it of items) {
                const price = new Prisma.Decimal(it.price as any);
                const discount = new Prisma.Decimal((it.discount ?? 0) as any);
                total = total.plus(price.mul(it.quantity));
                discountTotal = discountTotal.plus(discount);
            }
            // 优惠券校验与折扣（兼容旧单券 memberCouponId；新增多券 memberCouponIds）
            let memberCoupon: any = null;
            // 记录单券折扣金额，便于写入订单与日志
            let singleCouponDiscountApplied: Prisma.Decimal = new Prisma.Decimal(0);
            // 记录多券下每张券的折扣金额
            const couponDiscountByMemberCouponId: Record<number, Prisma.Decimal> = {};
            const ids = Array.isArray(memberCouponIds) && memberCouponIds.length > 0 ? memberCouponIds : (memberCouponId ? [memberCouponId] : []);
            if (ids.length === 1) {
                const memberCouponId = ids[0];
                memberCoupon = await (tx as any).memberCoupon.findUnique({ where: { id: memberCouponId }, include: { coupon: true } });
                if (!memberCoupon || memberCoupon.memberId !== memberId) throw new Error('优惠券无效');
                if (memberCoupon.usedAt) throw new Error('优惠券已使用');
                const now = new Date();
                if (memberCoupon.endAt && new Date(memberCoupon.endAt) < now) throw new Error('优惠券已过期');
                if (memberCoupon.startAt && new Date(memberCoupon.startAt) > now) throw new Error('优惠券未到生效时间');
                if (!memberCoupon.coupon?.enabled) throw new Error('优惠券已停用');
                if (memberCoupon.coupon?.type !== 'COUPON') throw new Error('优惠券类型不支持');
                // 叠加策略：与积分/会员折扣
                if (!memberCoupon.coupon?.allowStackWithPoints && (Number(usedPoints||0) > 0 || Number(pointsAmount||0) > 0)) throw new Error('该券不可与积分同用');
                if (!memberCoupon.coupon?.allowStackWithMemberDiscount && !disableMemberDiscount) {
                    // 这里以商品的 memberDiscount 作为判别（如有任一商品启用会员折扣则不允许叠加）
                    const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
                    if (productIds.length) {
                        const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id:true, memberDiscount:true } });
                        if (products.some(p => p.memberDiscount)) throw new Error('该券不可与会员折扣同用');
                    }
                }
                // 适用范围与门槛口径
                let discountBase = total; // 缺省按整单
                let applicableSubtotal = total;
                if (memberCoupon.coupon?.applyScope === 'SPECIFIED') {
                    const applicable = await this.prisma.couponApplicableProduct.findMany({ where: { couponId: memberCoupon.couponId }, select: { productId: true } });
                    const allowed = new Set(applicable.map(a => a.productId));
                    const applicableItems = items.filter(it => (it.productId ? allowed.has(it.productId) : false));
                    if (applicableItems.length === 0) throw new Error('订单中无可用商品');
                    applicableSubtotal = applicableItems.reduce((s, it) => s.plus(new Prisma.Decimal(it.price as any).mul(it.quantity)), new Prisma.Decimal(0));
                    discountBase = applicableSubtotal; // 优惠口径按适用品项小计
                }
                // 最低订单额校验（按口径）
                if (memberCoupon.coupon?.minOrderAmount != null) {
                    const minAmt = new Prisma.Decimal(memberCoupon.coupon.minOrderAmount as any);
                    if (discountBase.lessThan(minAmt)) throw new Error('未达到使用门槛');
                }
                // 规则JSON折扣计算（优先），否则回退到面值直减
                const rule: any = (memberCoupon.coupon as any)?.ruleJson || null;
                let couponDiscount = new Prisma.Decimal(0);
                try {
                    if (rule && typeof rule === 'object') {
                        // applyBase: 'order'|'applicableItems'，默认按当前口径（discountBase）
                        const base = (rule.applyBase === 'order') ? total : discountBase;
                        let calc = new Prisma.Decimal(0);
                        if (rule.kind === 'percent') {
                            const pct = new Prisma.Decimal(Number(rule.percent || rule.amount || 0)).div(100);
                            if (pct.greaterThan(0)) calc = new Prisma.Decimal(base as any).mul(pct);
                        } else if (rule.kind === 'direct') {
                            calc = new Prisma.Decimal(Number(rule.amount || 0));
                        }
                        // 封顶
                        if (rule.cap != null) {
                            const cap = new Prisma.Decimal(Number(rule.cap || 0));
                            if (cap.greaterThan(0) && calc.greaterThan(cap)) calc = cap;
                        }
                        // 最低小计
                        if (rule.minSubtotal != null) {
                            const minS = new Prisma.Decimal(Number(rule.minSubtotal || 0));
                            if (base.lessThan(minS)) calc = new Prisma.Decimal(0);
                        }
                        // 折扣不得超过口径金额
                        if (calc.greaterThan(base)) calc = base as any;
                        couponDiscount = calc;
                    }
                } catch { /* ignore rule errors */ }
                if (couponDiscount.greaterThan(0)) {
                    discountTotal = discountTotal.plus(couponDiscount);
                    singleCouponDiscountApplied = couponDiscount;
                } else {
                    // 回退面值直减，且不超过口径金额
                    const face = new Prisma.Decimal(memberCoupon.coupon?.faceValue || 0);
                    const applied = face.greaterThan(discountBase) ? (discountBase as any) : face;
                    if (face.greaterThan(0)) discountTotal = discountTotal.plus(applied);
                    singleCouponDiscountApplied = applied as any;
                }
            } else if (ids.length > 1) {
                const now = new Date();
                const records: any[] = await (tx as any).memberCoupon.findMany({ where: { id: { in: ids } }, include: { coupon: true } });
                if (records.length !== ids.length) throw new Error('部分优惠券无效');
                for (const mc of records) {
                    if (mc.memberId !== memberId) throw new Error('优惠券归属无效');
                    if (mc.usedAt) throw new Error('存在已使用的优惠券');
                    if (mc.endAt && new Date(mc.endAt) < now) throw new Error('存在已过期优惠券');
                    if (mc.startAt && new Date(mc.startAt) > now) throw new Error('存在未到生效时间的优惠券');
                    if (!mc.coupon?.enabled) throw new Error('存在已停用优惠券');
                    if (mc.coupon?.type !== 'COUPON') throw new Error('存在不支持的优惠券类型');
                }
                if (records.some((mc:any)=>!mc?.coupon?.allowCombine)) throw new Error('部分优惠券不支持叠加');
                if (records.some((mc:any)=> mc?.coupon && mc.coupon.allowStackWithPoints === false)) {
                    if (Number(usedPoints||0) > 0 || Number(pointsAmount||0) > 0) throw new Error('所选优惠券不可与积分同用');
                }
                if (records.some((mc:any)=> mc?.coupon && mc.coupon.allowStackWithMemberDiscount === false) && !disableMemberDiscount) {
                    const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
                    if (productIds.length) {
                        const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id:true, memberDiscount:true } });
                        if (products.some(p => p.memberDiscount)) throw new Error('所选优惠券不可与会员折扣同用');
                    }
                }
                for (const mc of records) {
                    let discountBase = total;
                    if (mc.coupon?.applyScope === 'SPECIFIED') {
                        const applicable = await this.prisma.couponApplicableProduct.findMany({ where: { couponId: mc.couponId }, select: { productId: true } });
                        const allowed = new Set(applicable.map(a => a.productId));
                        const applicableItems = items.filter(it => (it.productId ? allowed.has(it.productId) : false));
                        if (applicableItems.length === 0) throw new Error('订单中无可用商品');
                        const subtotal = applicableItems.reduce((s, it) => s.plus(new Prisma.Decimal(it.price as any).mul(it.quantity)), new Prisma.Decimal(0));
                        discountBase = subtotal;
                    }
                    if (mc.coupon?.minOrderAmount != null) {
                        const minAmt = new Prisma.Decimal(mc.coupon.minOrderAmount as any);
                        if (discountBase.lessThan(minAmt)) throw new Error('未达到使用门槛');
                    }
                    const rule:any = (mc.coupon as any)?.ruleJson || null;
                    let calc = new Prisma.Decimal(0);
                    try{
                        if (rule && typeof rule === 'object'){
                            const base = (rule.applyBase === 'order') ? total : discountBase;
                            if (rule.kind === 'percent') {
                                const pct = new Prisma.Decimal(Number(rule.percent || rule.amount || 0)).div(100);
                                if (pct.greaterThan(0)) calc = new Prisma.Decimal(base as any).mul(pct);
                            } else if (rule.kind === 'direct') {
                                calc = new Prisma.Decimal(Number(rule.amount || 0));
                            }
                            if (rule.cap != null) {
                                const cap = new Prisma.Decimal(Number(rule.cap || 0));
                                if (cap.greaterThan(0) && calc.greaterThan(cap)) calc = cap;
                            }
                            if (rule.minSubtotal != null) {
                                const minS = new Prisma.Decimal(Number(rule.minSubtotal || 0));
                                const baseUse = (rule.applyBase === 'order') ? total : discountBase;
                                if (baseUse.lessThan(minS)) calc = new Prisma.Decimal(0);
                            }
                            if (calc.greaterThan((rule.applyBase === 'order') ? total : discountBase)) calc = (rule.applyBase === 'order') ? (total as any) : (discountBase as any);
                        }
                    } catch { /* ignore */ }
                    if (calc.lte(0)) {
                        const face = new Prisma.Decimal(mc.coupon?.faceValue || 0);
                        calc = face.greaterThan(discountBase) ? (discountBase as any) : face;
                    }
                    // 记录该券实际折扣
                    couponDiscountByMemberCouponId[mc.id] = calc as any;
                    discountTotal = discountTotal.plus(calc);
                }
                if (discountTotal.greaterThan(total)) discountTotal = total;
                // 记录：多券不写入 couponInfo 结构（前端可从订单金额与日志侧查明细）
            }
            // 会员折扣（按会员等级的 payDiscountPercent，作用于商品维度开启了 memberDiscount 的小计）
            let memberDiscountAmount = new Prisma.Decimal(0);
            try{
                if (disableMemberDiscount) { throw new Error('DISABLED_BY_REQUEST'); }
                const productIdsAll = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
                const productFlags = productIdsAll.length ? await tx.product.findMany({ where: { id: { in: productIdsAll } }, select: { id:true, memberDiscount:true, pointsDeductible:true } }) : [];
                const flagMap = new Map<number, { id:number; memberDiscount:boolean; pointsDeductible:boolean }>(productFlags.map(p => [p.id, { id:p.id, memberDiscount: !!(p as any).memberDiscount, pointsDeductible: !!(p as any).pointsDeductible }]));
                // 会员折扣资格与比例
                let payDiscountPercent = 0;
                try{
                    const m:any = await tx.member.findUnique({ where: { id: memberId }, select: { level: { select: { payDiscountPercent:true } } } });
                    payDiscountPercent = Math.max(0, Math.min(100, Math.floor(Number(m?.level?.payDiscountPercent || 0))));
                }catch{ payDiscountPercent = 0; }
                if (payDiscountPercent > 0) {
                    let eligible = new Prisma.Decimal(0);
                    for (const it of items) {
                        const pid = it.productId as any as number | undefined;
                        const f = (pid && flagMap.get(pid)) || undefined;
                        if (f && f.memberDiscount) {
                            const price = new Prisma.Decimal(it.price as any);
                            eligible = eligible.plus(price.mul(it.quantity));
                        }
                    }
                    if (eligible.greaterThan(0)) {
                        const pct = new Prisma.Decimal(payDiscountPercent as any).div(100);
                        memberDiscountAmount = eligible.mul(pct);
                        // 折扣不应超过当前可折扣基数
                        const maxAllow = total.minus(discountTotal);
                        if (memberDiscountAmount.greaterThan(maxAllow)) memberDiscountAmount = maxAllow as any;
                        discountTotal = discountTotal.plus(memberDiscountAmount);
                    }
                }
                // 将积分抵扣基数限定于支持 pointsDeductible 的商品比例
                // 下面积分计算会使用该比例
                (this as any)._pointsEligibleRatio = (() => {
                    try{
                        let eligible = new Prisma.Decimal(0);
                        for (const it of items) {
                            const pid = it.productId as any as number | undefined;
                            const f = (pid && flagMap.get(pid)) || undefined;
                            if (f && f.pointsDeductible) {
                                const price = new Prisma.Decimal(it.price as any);
                                eligible = eligible.plus(price.mul(it.quantity));
                            }
                        }
                        if (total.lte(0)) return 0;
                        const ratio = Number(eligible.div(total));
                        if (!Number.isFinite(ratio) || ratio <= 0) return 0;
                        return Math.min(1, Math.max(0, ratio));
                    }catch{ return 0; }
                })();
            }catch{
                // 忽略会员折扣/可抵扣比例异常
            }
            // 按配置与会员积分余额，核算积分可抵扣金额与实际可用积分
            let usedPointsCalc = Math.max(0, Math.floor(Number(usedPoints || 0)));
            let pointsAmountCalcFen = 0; // 单位：分
            try{
                const ss:any = await tx.siteSetting.findFirst().catch(()=>null);
                const fenPerPoint = Math.max(0, Math.floor(Number(ss?.pointsFenPerPoint || 0)));
                const maxFenPerOrder = Math.max(0, Math.floor(Number(ss?.pointsMaxDeductFenPerOrder || 0)));
                if (fenPerPoint > 0 && usedPointsCalc > 0){
                    const m = await tx.member.findUnique({ where: { id: memberId }, select: { points: true } });
                    const balancePts = Math.max(0, Number(m?.points || 0));
                    // 可用积分上限（受余额与单单封顶约束）
                    const grossFen = Number(total.minus(discountTotal).plus(new Prisma.Decimal(shippingFee as any)).mul(100).toFixed(0));
                    const ratio = Number((this as any)._pointsEligibleRatio || 0);
                    const payBeforePointsFen = Math.max(0, Math.floor(grossFen * (Number.isFinite(ratio) ? ratio : 1)));
                    let capFen = balancePts * fenPerPoint;
                    if (maxFenPerOrder > 0) capFen = Math.min(capFen, maxFenPerOrder);
                    // 至少保留 1 分以避免 0 元订单（后续仍有 0.01 的兜底）
                    capFen = Math.max(0, Math.min(capFen, Math.max(0, payBeforePointsFen - 1)));
                    const reqFen = usedPointsCalc * fenPerPoint;
                    pointsAmountCalcFen = Math.min(reqFen, capFen);
                    usedPointsCalc = Math.floor(pointsAmountCalcFen / fenPerPoint);
                }
            }catch{}
            const shipping = new Prisma.Decimal(shippingFee as any);
            const payAmount = total.minus(discountTotal).plus(shipping).minus(new Prisma.Decimal((pointsAmountCalcFen/100) as any));
            // 最低应付策略：若小于 0.01，按 0.01 计入订单（允许券减溢出）
            const minPay = new Prisma.Decimal(0.01 as any);
            const payAmountAdjusted = payAmount.lessThan(minPay) ? minPay : payAmount;

            // 预生成订单号，便于库存预占日志记录
            const orderNo = this.generateOrderNo(type as any);

            // 下单即预占库存（仅实体商品 PHYSICAL 与 虚拟卡券 VIRTUAL_CARD）
            for (const it of items) {
                if (!it.productId) continue;
                const product = await tx.product.findUnique({ where: { id: it.productId }, select: { id: true, type: true, specType: true } });
                if (!product) continue;
                if (product.type !== 'PHYSICAL' && product.type !== 'VIRTUAL_CARD') continue;
                const qty = Math.max(1, Number(it.quantity || 0));
                if (product.specType === 'MULTI') {
                    if (!it.skuId) throw new Error('订单包含多规格商品但缺少 skuId');
                    // 条件扣减：避免并发超卖
                    const res = await tx.productSku.updateMany({ where: { id: it.skuId, stockQuantity: { gte: qty } }, data: { stockQuantity: { decrement: qty } } });
                    if ((res as any).count !== undefined) {
                        if (Number((res as any).count || 0) !== 1) throw new Error('库存不足，无法下单');
                    } else {
                        if (Number(res || 0) !== 1) throw new Error('库存不足，无法下单');
                    }
                    const afterRow = await tx.productSku.findUnique({ where: { id: it.skuId }, select: { stockQuantity: true } });
                    const after = Number(afterRow?.stockQuantity || 0);
                    const before = after + qty;
                    await tx.inventoryLog.create({ data: { productId: product.id, skuId: it.skuId, change: -qty, beforeStock: before, afterStock: after, reason: 'ORDER_DEDUCT' as any, remark: `订单预占（订单号：${orderNo}）`, operatorUserId: null } });
                } else {
                    const res = await tx.product.updateMany({ where: { id: product.id, stockQuantity: { gte: qty } }, data: { stockQuantity: { decrement: qty } } });
                    if ((res as any).count !== undefined) {
                        if (Number((res as any).count || 0) !== 1) throw new Error('库存不足，无法下单');
                    } else {
                        if (Number(res || 0) !== 1) throw new Error('库存不足，无法下单');
                    }
                    const afterRow = await tx.product.findUnique({ where: { id: product.id }, select: { stockQuantity: true } });
                    const after = Number(afterRow?.stockQuantity || 0);
                    const before = after + qty;
                    await tx.inventoryLog.create({ data: { productId: product.id, skuId: null, change: -qty, beforeStock: before, afterStock: after, reason: 'ORDER_DEDUCT' as any, remark: `订单预占（订单号：${orderNo}）`, operatorUserId: null } });
                }
            }

            const order = await tx.order.create({
                data: {
                    no: orderNo,
                    type,
                    status: 'CREATED' as OrderStatus,
                    fulfillmentStatus: (type === 'FK' ? 'NONE' : 'PENDING') as FulfillmentStatus,
                    totalAmount: total,
                    discountAmount: discountTotal,
                    memberDiscountAmount: memberDiscountAmount,
                    payAmount: payAmountAdjusted,
                    shippingFee: shipping,
                    payStatus: 'UNPAID',
                    memberId,
                    vehicleId: vehicleId ?? null,
                    paymentExpireAt: new Date(Date.now() + 15 * 60 * 1000),
                    // 用户备注写入 userRemark；系统备注 remark 留作系统流程使用
                    userRemark: (userRemark ?? remark) ?? null,
                    usedPoints: usedPointsCalc,
                    pointsAmount: new Prisma.Decimal((pointsAmountCalcFen/100) as any),
                    couponInfo: memberCoupon ? ({ id: memberCoupon.id, couponId: memberCoupon.couponId, faceValue: memberCoupon.coupon?.faceValue ?? null, name: memberCoupon.name ?? memberCoupon.coupon?.name ?? null, discountApplied: Number(singleCouponDiscountApplied || 0) } as any) : (couponInfo ?? undefined),
                    shippingAddressId: addressIdToSave,
                    shippingAddressSnapshot: addressSnapshot,
                } as any,
            });
            await this.writeTimeline({ tx, orderId: order.id, event: 'ORDER_STATUS', value: 'CREATED' });
            await this.writeTimeline({ tx, orderId: order.id, event: 'PAY_STATUS', value: 'UNPAID' });
            await this.writeTimeline({ tx, orderId: order.id, event: 'FULFILLMENT', value: String(order.fulfillmentStatus) });
            for (const it of items) {
                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: it.productId ?? null,
                        skuId: it.skuId ?? null,
                        name: it.name,
                        imageUrl: it.imageUrl ?? null,
                        specsText: it.specsText ?? null,
                        barcode: it.barcode ?? null,
                        price: new Prisma.Decimal(it.price as any),
                        discount: new Prisma.Decimal((it.discount ?? 0) as any),
                        quantity: it.quantity,
                    },
                });
            }
            // 扣减积分余额并记账
            if (usedPointsCalc > 0){
                await tx.member.update({ where: { id: memberId }, data: { points: { decrement: usedPointsCalc } } });
                await (tx as any).memberPointsLog.create({ data: { memberId, change: -usedPointsCalc, source: 'USE', desc: `订单抵扣 ${order.no}`, orderId: order.id } });
            }
            // 标记用券
            if (memberCoupon) {
                await (tx as any).memberCoupon.update({ where: { id: memberCoupon.id }, data: { usedAt: new Date(), orderId: order.id } });
                try{ const mc = await (tx as any).memberCoupon.findUnique({ where: { id: memberCoupon.id }, include: { coupon: true } }); await (tx as any).couponFlowLog.create({ data: { action: 'USE', memberId, orderId: order.id, couponId: mc?.couponId ?? null, memberCouponId: memberCoupon?.id ?? null, count: 1, remark: '订单使用', snapshot: { couponId: mc?.couponId ?? null, couponName: mc?.coupon?.name ?? null, memberCouponId: memberCoupon?.id ?? null, memberCouponName: mc?.name ?? null, discountApplied: Number(singleCouponDiscountApplied || 0) } } }); }catch{}
            } else if (Array.isArray(memberCouponIds) && memberCouponIds.length > 1) {
                for (const cid of memberCouponIds) {
                    await (tx as any).memberCoupon.update({ where: { id: cid }, data: { usedAt: new Date(), orderId: order.id } });
                    try{ const mc = await (tx as any).memberCoupon.findUnique({ where: { id: cid }, include: { coupon: true } }); const applied = couponDiscountByMemberCouponId[cid]; await (tx as any).couponFlowLog.create({ data: { action: 'USE', memberId, orderId: order.id, couponId: mc?.couponId ?? null, memberCouponId: cid, count: 1, remark: '订单使用', snapshot: { couponId: mc?.couponId ?? null, couponName: mc?.coupon?.name ?? null, memberCouponId: cid ?? null, memberCouponName: mc?.name ?? null, discountApplied: Number(applied || 0) } } }); }catch{}
                }
            }
            // 计算支付超时时间（15分钟）并返回给前端用于倒计时
            try{
                const createdAt: any = (order as any)?.createdAt || new Date();
                const base = new Date(createdAt).getTime();
                const expireAt = new Date(base + 15 * 60 * 1000);
                const expireRemainSeconds = Math.max(0, Math.floor((expireAt.getTime() - Date.now()) / 1000));
                return { id: order.id, no: order.no, expireAt, expireRemainSeconds } as any;
            }catch{
                return { id: order.id, no: order.no } as any;
            }
        }).then(async (res: any) => {
            try {
                const itemsSaved: Array<{ id: number; imageUrl: string|null }> = await this.prisma.orderItem.findMany({ where: { orderId: res.id }, select: { id: true, imageUrl: true } });
                for (const it of itemsSaved){
                    if (it.imageUrl) {
                        try { await this.syncBindings('OrderItem', String(it.id), 'imageUrl', [it.imageUrl]); } catch {}
                    }
                }
            } catch {}
            return res;
        });
    }

    private async enrichOrderWithProductTypes(order: any){
        try{
            if (!order) return order;
            const items = Array.isArray(order.items) ? order.items : [];
            const rawIds: number[] = items
                .map((it: any) => Number(it?.productId))
                .filter((v: number) => Number.isFinite(v));
            const productIds: number[] = Array.from(new Set(rawIds));
            if (!productIds.length) return order;
            const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, type: true } });
            const map = new Map(products.map(p=> [p.id, p.type] as const));
            order.items = items.map((it:any)=> ({ ...it, productType: it?.productId ? (map.get(it.productId) || null) : null }));
        }catch{}
        return order;
    }

    async getOrder(id: number) {
        const o = await this.prisma.order.findUnique({ where: { id }, include: { items: true, member: true, vehicle: true, afterSalesRequests: true, timelines: { orderBy: { createdAt: 'asc' } }, refundRecords: { orderBy: { id: 'desc' } }, couponRestoreLogs: { orderBy: { id: 'desc' } }, couponFlows: { orderBy: { id: 'desc' }, include: { coupon: true, memberCoupon: true } } } });
        return await this.enrichOrderWithProductTypes(o);
    }

    async getOrderByNo(no: string) {
        const o = await this.prisma.order.findUnique({ where: { no }, include: { items: true, member: true, vehicle: true, afterSalesRequests: true, timelines: { orderBy: { createdAt: 'asc' } }, refundRecords: { orderBy: { id: 'desc' } }, couponRestoreLogs: { orderBy: { id: 'desc' } }, couponFlows: { orderBy: { id: 'desc' }, include: { coupon: true, memberCoupon: true } } } });
        return await this.enrichOrderWithProductTypes(o);
    }

    async getMemberOpenId(memberId: number): Promise<string | null> {
        const m = await this.prisma.member.findUnique({ where: { id: memberId }, select: { weixinOpenId: true } });
        return m?.weixinOpenId ?? null;
    }

    listOrders(query: { type?: OrderType | undefined; status?: OrderStatus | undefined; payStatus?: PayStatus | undefined; memberId?: number | undefined; keyword?: string | undefined; start?: string | undefined; end?: string | undefined; scene?: string | undefined; includeDeleted?: boolean | undefined; }) {
        const where: Prisma.OrderWhereInput = {};
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;
        if (query.payStatus) where.payStatus = query.payStatus;
        if (query.memberId) where.memberId = query.memberId;
        // 统一场景筛选（用于小程序与后台快捷筛选）
        if (query.scene) {
            const scene = String(query.scene).toUpperCase();
            if (scene === 'PENDING_PAYMENT') {
                (where as any).payStatus = 'UNPAID';
            } else if (scene === 'REFUND_AFTERSALE') {
                (where as any).OR = [
                    { payStatus: 'REFUNDED' },
                    { afterSalesRequests: { some: { status: { in: ['PENDING','APPROVED'] as any } } } },
                ];
            } else if (scene === 'PENDING_SERVICE') {
                (where as any).type = 'SERVICE';
                (where as any).payStatus = 'PAID';
                (where as any).fulfillmentStatus = { in: ['PENDING','IN_SERVICE'] } as any;
            } else if (scene === 'PENDING_DELIVERY') {
                (where as any).type = 'SP';
                (where as any).payStatus = 'PAID';
                (where as any).fulfillmentStatus = 'PENDING' as any;
            } else if (scene === 'PENDING_RECEIPT') {
                (where as any).type = 'SP';
                (where as any).payStatus = 'PAID';
                // 兼容旧数据
                (where as any).OR = [
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'SHIPPED' }] },
                    { AND: [{ type: 'SP' }, { status: 'FULFILLED' }] },
                ];
            } else if (scene === 'COMPLETED') {
                const rules: any[] = [
                    { AND: [{ type: 'SERVICE' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'DONE' }] },
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'RECEIVED' }] },
                    { AND: [{ type: 'FK' }, { payStatus: 'PAID' }] },
                    { AND: [{ type: 'SERVICE' }, { status: 'FULFILLED' }] },
                    { AND: [{ type: 'SP' }, { status: 'CLOSED' }] },
                ];
                (where as any).OR = rules;
            } else if (scene === 'CANCELLED') {
                if (query.type) {
                    (where as any).OR = [
                        { AND: [{ type: query.type }, { status: 'CANCELLED' }] },
                        { AND: [{ type: query.type }, { payStatus: 'CANCELLED' }] },
                    ];
                } else {
                    (where as any).OR = [
                        { status: 'CANCELLED' },
                        { payStatus: 'CANCELLED' },
                    ];
                }
            } else if (scene === 'REVIEW') {
                const rules: any[] = [
                    { AND: [{ type: 'SERVICE' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'DONE' }] },
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'RECEIVED' }] },
                    { AND: [{ type: 'FK' }, { payStatus: 'PAID' }] },
                    { AND: [{ type: 'SERVICE' }, { status: 'FULFILLED' }] },
                    { AND: [{ type: 'SP' }, { status: 'CLOSED' }] },
                ];
                (where as any).OR = rules;
            } else if (scene === 'DELETED') {
                (where as any).deletedAt = { not: null } as any;
            }
        }
        // 后台可全量查看时允许带 includeDeleted=true；小程序不会传该参数
        if (!query.includeDeleted) {
            (where as any).deletedAt = null as any;
        }
        if (query.keyword) {
            const kw = query.keyword;
            where.OR = [
                { no: { contains: kw } },
                { remark: { contains: kw } },
                { userRemark: { contains: kw } },
                { member: { phone: { contains: kw } } },
            ] as any;
        }
        if (query.start || query.end) {
            const createdAt: Prisma.DateTimeFilter = {};
            if (query.start) {
                const s = new Date(query.start);
                if (!isNaN(s.getTime())) createdAt.gte = s;
            }
            if (query.end) {
                const e = new Date(query.end);
                if (!isNaN(e.getTime())) createdAt.lte = e;
            }
            if (Object.keys(createdAt).length) (where as any).createdAt = createdAt;
        }
        return this.prisma.order.findMany({ where, orderBy: [{ id: 'desc' }], include: { items: true, member: true, afterSalesRequests: true } });
    }

    // 评价相关方法
    private isOrderCompletedForReview(o: any): boolean {
        if (!o) return false;
        if (o.type === 'SERVICE') return (o.payStatus === 'PAID') && (o.fulfillmentStatus === 'DONE' || o.status === 'FULFILLED');
        if (o.type === 'SP') return (o.payStatus === 'PAID') && (o.fulfillmentStatus === 'RECEIVED' || o.status === 'CLOSED');
        if (o.type === 'FK') return o.payStatus === 'PAID';
        return false;
    }

    async createOrderReview(params: { orderId: number; memberId: number; rating: number; content?: string | null; images?: any }) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: params.orderId } });
        if (order.memberId !== params.memberId) throw new Error('订单不属于当前用户');
        if (!this.isOrderCompletedForReview(order)) throw new Error('仅已完成订单可评价');
        if (order.reviewStatus === 'REVIEWED') throw new Error('订单已评价');
        const exists = await (this.prisma as any).orderReview.findUnique({ where: { orderId: params.orderId } });
        if (exists) throw new Error('订单已评价');
        const rating = Math.max(1, Math.min(5, Number(params.rating || 5)));
        const created = await (this.prisma as any).orderReview.create({ data: { orderId: params.orderId, memberId: params.memberId, rating, content: params.content ?? null, imagesJson: params.images ?? undefined } });
        try { await this.syncBindings('OrderReview', String(created.id), 'imagesJson', Array.isArray(params.images)? params.images: []); } catch {}
        await this.prisma.order.update({ where: { id: order.id }, data: { reviewStatus: 'REVIEWED' as any } });
        // 时间线：用户已评价（记录评分）
        await this.writeTimeline({ orderId: order.id, event: 'REVIEW', value: 'RATED', remark: `评分${rating}`, operatorUserId: null });
        return created;
    }

    getOrderReviewByOrderId(orderId: number) {
        return (this.prisma as any).orderReview.findUnique({ where: { orderId }, include: { replyUser: { select: { name: true } } } });
    }

    listReviews(query: { page?: number; pageSize?: number; memberId?: number | undefined; orderNo?: string | undefined; ratingMin?: number | undefined; ratingMax?: number | undefined; start?: string | undefined; end?: string | undefined }) {
        const page = Math.max(1, Number(query.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
        const where: any = {};
        if (query.memberId) where.memberId = query.memberId;
        if (query.ratingMin != null || query.ratingMax != null) {
            where.rating = {};
            if (query.ratingMin != null) where.rating.gte = Number(query.ratingMin);
            if (query.ratingMax != null) where.rating.lte = Number(query.ratingMax);
        }
        if (query.start || query.end) {
            const createdAt: any = {};
            if (query.start) createdAt.gte = new Date(query.start);
            if (query.end) createdAt.lte = new Date(query.end);
            where.createdAt = createdAt;
        }
        if (query.orderNo) {
            where.order = { no: { contains: String(query.orderNo) } };
        }
        return (this.prisma as any).orderReview.findMany({
            where,
            orderBy: { id: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { order: { select: { no: true } }, member: { select: { name: true, phone: true } } },
        });
    }

    async deleteReview(id: number) {
        const r = await (this.prisma as any).orderReview.findUnique({ where: { id } });
        if (!r) return null;
        await this.prisma.order.update({ where: { id: r.orderId }, data: { reviewStatus: 'NONE' as any } });
        return (this.prisma as any).orderReview.delete({ where: { id } });
    }

    async replyReview(id: number, replyContent: string, replyUserId?: number | null) {
        const updated = await (this.prisma as any).orderReview.update({ where: { id }, data: { replyContent, replyUserId: replyUserId ?? null, replyAt: new Date() } });
        // 时间线：商家已回复
        try { await this.writeTimeline({ orderId: updated.orderId, event: 'REVIEW', value: 'REPLIED', operatorUserId: replyUserId ?? null }); } catch {}
        return updated;
    }

    // 支付（手动确认）：现金/收钱吧/线下
    async markPaid(params: { orderId: number; method: PayMethod; paidAt?: Date | null; operatorUserId?: number | null; wechatTransactionId?: string | null }) {
        // 仅未支付订单可标记
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: params.orderId } });
        if (order.payStatus !== 'UNPAID') throw new Error('仅未支付订单可标记支付');
        const paidAt = params.paidAt ?? new Date();
        // 防并发：仅当仍为 UNPAID 时才更新为 PAID，避免多通道/多回调重复入账
        const upd = await this.prisma.order.updateMany({ where: { id: order.id, payStatus: 'UNPAID' }, data: { payStatus: 'PAID', status: 'PAID', payMethod: params.method, paidAt, wechatTransactionId: params.wechatTransactionId ?? undefined } });
        if (!upd || (upd as any).count === 0) {
            // 已有其他并发流程完成了标记支付，这里不再重复入账；仅补写交易单号（若需要）
            try{
                if (params.wechatTransactionId) { await this.saveWechatTransactionId(order.id, params.wechatTransactionId); }
            }catch{}
            return await this.prisma.order.findUnique({ where: { id: order.id } });
        }
        const updated = await this.prisma.order.findUnique({ where: { id: order.id } });
        await this.writeTimeline({ orderId: order.id, event: 'PAY_STATUS', value: 'PAID', operatorUserId: params.operatorUserId ?? null });
        await this.writeTimeline({ orderId: order.id, event: 'ORDER_STATUS', value: 'PAID', operatorUserId: params.operatorUserId ?? null });
        // 成长：累计支付金额与成长值入账，并尝试按成长值升级会员等级
        try {
            const amountYuan = Number(order.payAmount || 0);
            if (amountYuan > 0) {
                const ss: any = await this.prisma.siteSetting.findFirst().catch(()=>null);
                const growthPerYuan = Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1)));
                const growthInc = Math.max(0, Math.floor(amountYuan * growthPerYuan));
                await this.prisma.member.update({ where: { id: order.memberId }, data: { totalPaidAmount: { increment: amountYuan as any }, growthPoints: { increment: growthInc } } as any });
                // 成长值日志
                if (growthInc > 0) {
                    await (this.prisma as any).memberGrowthLog.create({ data: { memberId: order.memberId, change: growthInc, source: 'PAY', desc: `支付订单 ${order.no}`, orderId: order.id } });
                }
                // 积分入账（含等级倍数）
                try{
                    // 幂等保护：若该订单已产生过 PAY 类型的积分入账，则不重复入账
                    const exists:any[] = await (this.prisma as any).memberPointsLog.findMany({ where: { orderId: order.id, source: 'PAY' }, take: 1 });
                    if (!exists || exists.length === 0){
                        const pointsPerYuan = Math.max(0, Math.floor(Number(ss?.pointsPerYuan ?? 1)));
                        let basePoints = Math.max(0, Math.floor(amountYuan * pointsPerYuan));
                        let multiplier = 1;
                        try{
                            const m:any = await this.prisma.member.findUnique({ where: { id: order.memberId }, select: { id:true, level: { select: { pointsMultiplier:true } } } });
                            multiplier = Math.max(1, Math.floor(Number(m?.level?.pointsMultiplier ?? 1)));
                        }catch{}
                        const pointsInc = Math.max(0, Math.floor(basePoints * multiplier));
                        if (pointsInc > 0){
                            await this.prisma.member.update({ where: { id: order.memberId }, data: { points: { increment: pointsInc } } });
                            await (this.prisma as any).memberPointsLog.create({ data: { memberId: order.memberId, change: pointsInc, source: 'PAY', desc: `支付订单 ${order.no}`, orderId: order.id } });
                        }
                    }
                }catch{}
                // 计算应有等级：找出 growthPoints 达标的最高 level
                const m: any = await this.prisma.member.findUnique({ where: { id: order.memberId }, select: { id: true, /* @ts-ignore */ growthPoints: true, levelId: true } as any });
                const levels: any[] = await this.prisma.memberLevel.findMany({ orderBy: { /* @ts-ignore */ level: 'desc' } as any });
                const target = levels.find(l => Number(m?.growthPoints ?? 0) >= Number((l as any)?.requiredGrowth ?? 0));
                if (target && target.id !== (m?.levelId || null)) {
                    await this.prisma.member.update({ where: { id: order.memberId }, data: { levelId: target.id } });
                }
            }
        } catch {}
        // 支付成功后，若订单包含绑定洗车计次卡的商品，则为会员发放洗车卡，并记录购买日志（含订单号）
        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const prod = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!prod || prod.type !== 'VIRTUAL_CARD' || !prod.couponId) continue;
            const coupon = await this.prisma.coupon.findUnique({ where: { id: prod.couponId } });
            if (!coupon || coupon.type !== 'WASH_CARD') continue;
            const times = coupon.totalTimes || 0;
            if (times <= 0) continue;
            const change = times * it.quantity;
            const remark = `购买入账（订单号：${order.no}）`;
            // 计算有效期
            let expiryAt: Date | null = null;
            if (coupon.expiryType === 'FIXED') { expiryAt = coupon.endAt ? new Date(coupon.endAt as any) : null; }
            else if (coupon.expiryType === 'AFTER_RECEIVE') { const now2 = new Date(); expiryAt = (coupon.validDays && coupon.validDays > 0) ? new Date(now2.getTime() + Number(coupon.validDays) * 24 * 60 * 60 * 1000) : null; }
            else { expiryAt = null; }
            const existing = await this.prisma.washCard.findFirst({ where: { ownerMemberId: order.memberId, name: coupon.name } });
            if (existing) {
                const before = existing.remainingTimes;
                const afterRemaining = before + change;
                let nextExpiry: Date | null = existing.expiryAt ?? null;
                if (expiryAt) { if (!nextExpiry || new Date(expiryAt) > new Date(nextExpiry)) nextExpiry = expiryAt; }
                await this.prisma.washCard.update({ where: { id: existing.id }, data: { totalTimes: existing.totalTimes + change, remainingTimes: afterRemaining, expiryAt: nextExpiry } });
                await this.prisma.washCardLog.create({ data: { cardId: existing.id, action: 'ADD' as any, reason: 'PURCHASE_ADD' as any, change, beforeRemaining: before, afterRemaining: afterRemaining, remark, purchaseOrderId: order.id } });
            } else {
                async function gen(tx: PrismaService){ for (let i=0;i<20;i++){ const n = Math.floor(Math.random()*100000000); const candidate = String(n).padStart(8,'0'); const exists = await tx.washCard.findUnique({ where: { cardNo: candidate } }).catch(()=>null); if (!exists) return candidate; } return String(Date.now()).slice(-8); }
                const cardNo = await gen(this.prisma);
                const created = await this.prisma.washCard.create({ data: { ownerMemberId: order.memberId, name: coupon.name, totalTimes: change, remainingTimes: change, cardNo, expiryAt } });
                await this.prisma.washCardLog.create({ data: { cardId: created.id, action: 'ADD' as any, reason: 'PURCHASE_ADD' as any, change, beforeRemaining: 0, afterRemaining: change, remark, purchaseOrderId: order.id } });
            }
        }
        // 注意：库存已在“下单”阶段预占，此处不再扣减库存，避免重复扣减
        // 若为商品订单（SP）且所有订单项均为虚拟卡券商品，则发放完成后直接将订单置为已完成，并记录时间线
        if (order.type === 'SP') {
            const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
            if (productIds.length > 0) {
                const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
                const idToType = new Map(products.map(p => [p.id, p.type] as const));
                const allVirtual = items.every(it => (it.productId ? idToType.get(it.productId) === 'VIRTUAL_CARD' : false));
                if (allVirtual) {
                    const closed = await this.prisma.order.update({ where: { id: order.id }, data: { status: 'CLOSED', fulfillmentStatus: 'RECEIVED' as any } });
                    try{
                        await this.writeTimeline({ orderId: order.id, event: 'FULFILLMENT', value: 'RECEIVED', operatorUserId: params.operatorUserId ?? null });
                        await this.writeTimeline({ orderId: order.id, event: 'ORDER_STATUS', value: 'CLOSED', operatorUserId: params.operatorUserId ?? null });
                        await this.writeTimeline({ orderId: order.id, event: 'NOTE', value: 'VIRTUAL_CARD_ISSUED', remark: 'SYS_AUTO', operatorUserId: params.operatorUserId ?? null });
                        // JSAPI虚拟商品订单：卡券发放后按要求上报发货信息（logistics_type=3）
                        try{
                            if ((params as any)?.method === 'WECHAT_JSAPI' && this.wxship){
                                await this.wxship.uploadShippingInfo({ orderId: order.id, logisticsType: 3 });
                            }
                        }catch{}
                    }catch{}
                    return closed;
                }
            }
        }
        return updated;
    }

    // 容错：单独补写微信交易单号
    async saveWechatTransactionId(orderId: number, transactionId: string){
        if (!transactionId) return;
        await this.prisma.order.update({ where: { id: orderId }, data: { wechatTransactionId: transactionId } });
    }

    // 关闭/取消订单：如已支付且尚未退款，回滚库存并将支付状态置为 CANCELLED
    async closeOrder(id: number, reason?: string, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.payStatus === 'PAID') {
            const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
            for (const it of items) {
                if (!it.productId) continue;
                const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
                if (!product || (product.type !== 'PHYSICAL' && product.type !== 'VIRTUAL_CARD')) continue;
                if (product.specType === 'MULTI') {
                    if (!it.skuId) continue;
                    const sku = await this.prisma.productSku.findUniqueOrThrow({ where: { id: it.skuId } });
                    const before = sku.stockQuantity;
                    const change = Math.abs(it.quantity);
                    const after = before + change;
                    await this.prisma.productSku.update({ where: { id: sku.id }, data: { stockQuantity: after } });
                    await this.prisma.inventoryLog.create({
                        data: {
                            productId: product.id,
                            skuId: sku.id,
                            change,
                            beforeStock: before,
                            afterStock: after,
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `订单回滚（订单号：${order.no}）` ,
                            operatorUserId: operatorUserId ?? null,
                        },
                    });
                } else {
                    const before = product.stockQuantity ?? 0;
                    const change = Math.abs(it.quantity);
                    const after = before + change;
                    await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                    await this.prisma.inventoryLog.create({
                        data: {
                            productId: product.id,
                            skuId: null,
                            change,
                            beforeStock: before,
                            afterStock: after,
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `订单回滚（订单号：${order.no}）` ,
                            operatorUserId: operatorUserId ?? null,
                        },
                    });
                }
            }
            return this.prisma.order.update({ where: { id }, data: { status: 'CLOSED', payStatus: 'CANCELLED', remark: reason ?? undefined } });
        }
        return this.prisma.order.update({ where: { id }, data: { status: 'CLOSED', remark: reason ?? undefined } });
    }

    // 退款：仅已支付订单可退款，回仓并标记为 REFUNDED + CANCELLED
    async refundOrder(id: number, reason?: string, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可退款');
        // 创建/补充 RefundRecord（内部退款，默认全额，部分退款调用方应传渠道接口）
        try{
            const pm = String(order.payMethod||'').toUpperCase();
            if (pm !== 'WECHAT_JSAPI' && pm !== 'WECHAT_MICROPAY'){
                await this.createRefundRecord({ orderId: id, memberId: order.memberId, amount: order.payAmount as any, method: order.payMethod ?? null, reasonCode: 'INTERNAL', reasonText: reason || null, status: 'SUCCESS' as any });
            }
        }catch{}
        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!product || (product.type !== 'PHYSICAL' && product.type !== 'VIRTUAL_CARD')) continue;
            if (product.specType === 'MULTI') {
                if (!it.skuId) {
                    // 兜底：缺失 skuId 时回补到商品总库存并写异常备注
                    const before = product.stockQuantity ?? 0;
                    const change = Math.abs(it.quantity);
                    const after = before + change;
                    await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                    await this.prisma.inventoryLog.create({ data: { productId: product.id, skuId: null, change, beforeStock: before, afterStock: after, reason: 'REFUND_RETURN' as any, remark: `退款回仓（缺少SKU，订单号：${order.no}）`, operatorUserId: operatorUserId ?? null } });
                    continue;
                }
                const sku = await this.prisma.productSku.findUniqueOrThrow({ where: { id: it.skuId } });
                const before = sku.stockQuantity;
                const change = Math.abs(it.quantity);
                const after = before + change;
                await this.prisma.productSku.update({ where: { id: sku.id }, data: { stockQuantity: after } });
                await this.prisma.inventoryLog.create({
                    data: {
                        productId: product.id,
                        skuId: sku.id,
                        change,
                        beforeStock: before,
                        afterStock: after,
                        reason: 'REFUND_RETURN' as any,
                        remark: `退款回仓（订单号：${order.no}）` ,
                        operatorUserId: operatorUserId ?? null,
                    },
                });
            } else {
                const before = product.stockQuantity ?? 0;
                const change = Math.abs(it.quantity);
                const after = before + change;
                await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                await this.prisma.inventoryLog.create({
                    data: {
                        productId: product.id,
                        skuId: null,
                        change,
                        beforeStock: before,
                        afterStock: after,
                        reason: 'REFUND_RETURN' as any,
                        remark: `退款回仓（订单号：${order.no}）` ,
                        operatorUserId: operatorUserId ?? null,
                    },
                });
            }
        }
        const updated = await this.prisma.order.update({ where: { id }, data: { status: 'CANCELLED', payStatus: 'REFUNDED', refundedAmount: order.payAmount, remark: reason ?? undefined } });
        try{
            await this.writeTimeline({ orderId: id, event: 'PAY_STATUS', value: 'REFUNDED', remark: reason || undefined, operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'CANCELLED', remark: reason || undefined, operatorUserId: operatorUserId ?? null });
        }catch{}
        return updated;
    }

    // 取消订单（未支付）：库存回滚并标记 CLOSED/CANCELLED（与 closeOrder 类似但保留语义）
    async cancelOrder(id: number, reason?: string, operatorUserId?: number | null, opts?: { userInitiated?: boolean }) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.payStatus !== 'UNPAID') throw new Error('仅未支付订单可取消');
        // 若有占用库存，回滚（下单阶段已预占）
        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!product) continue;
            if (product.type === 'PHYSICAL' || product.type === 'VIRTUAL_CARD') {
                if (product.specType === 'MULTI') {
                    if (!it.skuId) {
                        const before = product.stockQuantity ?? 0;
                        const change = Math.abs(it.quantity);
                        const after = before + change;
                        await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                        await this.prisma.inventoryLog.create({ data: { productId: product.id, skuId: null, change, beforeStock: before, afterStock: after, reason: 'ORDER_ROLLBACK' as any, remark: `取消订单回滚（缺少SKU，订单号：${order.no}）`, operatorUserId: operatorUserId ?? null } });
                        continue;
                    }
                    const sku = await this.prisma.productSku.findUniqueOrThrow({ where: { id: it.skuId } });
                    const before = sku.stockQuantity;
                    const change = Math.abs(it.quantity);
                    const after = before + change;
                    await this.prisma.productSku.update({ where: { id: sku.id }, data: { stockQuantity: after } });
                    await this.prisma.inventoryLog.create({
                        data: {
                            productId: product.id,
                            skuId: sku.id,
                            change,
                            beforeStock: before,
                            afterStock: after,
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `取消订单回滚（订单号：${order.no}）` ,
                            operatorUserId: operatorUserId ?? null,
                        },
                    });
                } else {
                    const before = product.stockQuantity ?? 0;
                    const change = Math.abs(it.quantity);
                    const after = before + change;
                    await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                    await this.prisma.inventoryLog.create({
                        data: {
                            productId: product.id,
                            skuId: null,
                            change,
                            beforeStock: before,
                            afterStock: after,
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `取消订单回滚（订单号：${order.no}）` ,
                            operatorUserId: operatorUserId ?? null,
                        },
                    });
                }
            }
        }
        // 返还下单时已扣的积分（仅限未支付取消场景）
        const updated = await this.prisma.$transaction(async (tx)=>{
            const updatedOrder = await tx.order.update({ where: { id }, data: { status: 'CANCELLED', payStatus: 'CANCELLED', remark: reason ?? undefined } });
            const usedPts = Math.max(0, Number(order.usedPoints || 0));
            if (usedPts > 0){
                await tx.member.update({ where: { id: order.memberId }, data: { points: { increment: usedPts } } });
                try{ await (tx as any).memberPointsLog.create({ data: { memberId: order.memberId, change: usedPts, source: 'REFUND', desc: `取消订单返还积分（订单${order.no}）`, orderId: order.id, operatorUserId: operatorUserId ?? null } }); }catch{}
            }
            return updatedOrder;
        });
        const cancelRemark = opts?.userInitiated ? '用户主动取消' : undefined;
        await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'CANCELLED', remark: cancelRemark, operatorUserId });
        await this.writeTimeline({ orderId: id, event: 'PAY_STATUS', value: 'CANCELLED', remark: cancelRemark, operatorUserId });
        // 统一封装：恢复优惠券
        try{ await this.coupons.restoreUsedCouponsForOrder({ orderId: id, operatorUserId: operatorUserId ?? null, reasonRemark: '取消订单恢复优惠券' }); }catch{}
        return updated;
    }

    // 软删除订单：仅打标 deletedAt，不改变其他状态
    async softDeleteOrder(id: number, operatorUserId?: number | null) {
        await this.prisma.order.findUniqueOrThrow({ where: { id } });
        return this.prisma.order.update({ where: { id }, data: { deletedAt: new Date() } });
    }

    // 恢复软删除：清空 deletedAt
    async restoreOrder(id: number, operatorUserId?: number | null) {
        await this.prisma.order.findUniqueOrThrow({ where: { id } });
        return this.prisma.order.update({ where: { id }, data: { deletedAt: null } });
    }

    // 发货（SP）：支持无需快递/快递发货并记录物流信息
    async shipOrder(id: number, operatorUserId?: number | null, payload?: { noExpress?: boolean; companyCode?: string | null; companyName?: string | null; companyLogo?: string | null; trackingNo?: string | null; extra?: any | null; contactSenderPhoneMasked?: string | null; contactReceiverPhoneMasked?: string | null }) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SP') throw new Error('仅商品订单可发货');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可发货');
        const data = {
            fulfillmentStatus: 'SHIPPED' as any,
            shippedAt: new Date(),
            shipNoExpress: !!payload?.noExpress,
            shipExpressCompanyCode: payload?.companyCode ?? null,
            shipExpressCompanyName: payload?.companyName ?? null,
            shipExpressCompanyLogo: payload?.companyLogo ?? null,
            shipExpressTrackingNo: payload?.trackingNo ?? null,
            shipExpressExtra: payload?.extra ?? undefined,
        };
        const updatedShip = await this.prisma.order.update({ where: { id }, data });
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'SHIPPED', operatorUserId });
        const remark = [payload?.companyName || payload?.companyCode, payload?.trackingNo].filter(Boolean).join(' / ');
        if (remark) await this.writeTimeline({ orderId: id, event: 'LOGISTICS', value: 'SHIPPED', remark, operatorUserId });
        // 若为微信JSAPI支付，则上报微信发货信息管理服务
        try{
            if (order.payMethod === 'WECHAT_JSAPI' && this.wxship){
                const logisticsType = payload?.noExpress ? 4 : 1;
                const contact = (payload?.companyName?.includes('顺丰') || (payload?.companyCode||'').toUpperCase()==='SF') ? {
                    senderPhoneMasked: payload?.contactSenderPhoneMasked || undefined,
                    receiverPhoneMasked: payload?.contactReceiverPhoneMasked || undefined,
                } : undefined;
                await this.wxship.uploadShippingInfo({
                    orderId: order.id,
                    logisticsType: logisticsType as any,
                    deliveryId: payload?.companyCode || undefined,
                    trackingNo: payload?.trackingNo || undefined,
                    contact: contact as any,
                });
            }
        }catch{/* ignore report errors */}
        // 若存在最近的"换货"售后，发货后自动完结该售后
        await this.completeLatestAftersalesByOrderAndType(id, 'EXCHANGE', operatorUserId ?? null);
        return updatedShip;
    }

    // 确认收货（SP）：SHIPPED -> RECEIVED，并置为完成（CLOSED）
    async receiveOrder(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SP') throw new Error('仅商品订单可收货');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可收货');
        // 收货不应触发“修改物流单号”校验路径，确保不调用 editShipTrackingNo
        const updatedReceive = await this.prisma.order.update({ where: { id }, data: { fulfillmentStatus: 'RECEIVED' as any, status: 'CLOSED' } });
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'RECEIVED', operatorUserId });
        await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'CLOSED', operatorUserId });
        return updatedReceive;
    }

    // 仅一次：修改物流单号（未收货前且仅能一次），记录时间线
    async editShipTrackingNo(id: number, newTrackingNo: string, operatorUserId?: number | null, payload?: { companyCode?: string | null; companyName?: string | null; companyLogo?: string | null; contactSenderPhoneMasked?: string | null; contactReceiverPhoneMasked?: string | null }){
        const order: any = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SP') throw new Error('仅商品订单可修改物流单号');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可修改物流单号');
        if (order.fulfillmentStatus !== 'SHIPPED') throw new Error('仅已发货且未收货订单可修改物流单号');
        const extra: any = order.shipExpressExtra || {};
        if (extra && typeof extra === 'object' && extra.editedOnce === true) throw new Error('物流单号仅允许修改一次');
        const prev = String(order.shipExpressTrackingNo||'');
        const next = String(newTrackingNo||'').trim();
        if (!next) throw new Error('新物流单号不能为空');
        const companyCode = payload?.companyCode ?? order.shipExpressCompanyCode ?? null;
        const companyName = payload?.companyName ?? order.shipExpressCompanyName ?? null;
        const companyLogo = payload?.companyLogo ?? order.shipExpressCompanyLogo ?? null;
        const newExtra = { ...(extra||{}), editedOnce: true, editAt: new Date().toISOString(), prevTrackingNo: prev };
        const updated = await this.prisma.order.update({ where: { id }, data: { shipExpressTrackingNo: next, shipExpressCompanyCode: companyCode, shipExpressCompanyName: companyName, shipExpressCompanyLogo: companyLogo, shipExpressExtra: newExtra } });
        await this.writeTimeline({ orderId: id, event: 'LOGISTICS', value: 'EDITED', remark: `${prev||'-'} -> ${next}`, operatorUserId });
        // 若为微信JSAPI并存在快递公司（表示快递发货），上报微信：等价于发货上报但只有单号不同
        try{
            if ((order as any).payMethod === 'WECHAT_JSAPI' && !order.shipNoExpress && this.wxship){
                await this.wxship.uploadShippingInfo({
                    orderId: order.id,
                    logisticsType: 1,
                    deliveryId: companyCode || undefined,
                    trackingNo: next,
                    contact: { senderPhoneMasked: payload?.contactSenderPhoneMasked || undefined, receiverPhoneMasked: payload?.contactReceiverPhoneMasked || undefined }
                });
            }
        }catch{}
        return updated;
    }

    // 开始服务（SERVICE）：PENDING -> IN_SERVICE
    async startService(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SERVICE') throw new Error('仅服务订单可开始服务');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可开始服务');
        const updatedStart = await this.prisma.order.update({ where: { id }, data: { fulfillmentStatus: 'IN_SERVICE' as any } });
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'IN_SERVICE', operatorUserId });
        return updatedStart;
    }

    // 结束服务（SERVICE）：IN_SERVICE/PENDING -> DONE，并置为已完成（FULFILLED）
    async finishService(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SERVICE') throw new Error('仅服务订单可结束服务');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可结束服务');
        const updatedFinish = await this.prisma.order.update({ where: { id }, data: { fulfillmentStatus: 'DONE' as any, status: 'FULFILLED' } });
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'DONE', operatorUserId });
        await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'FULFILLED', operatorUserId });
        // 若存在最近的"重新服务"售后，服务完成后自动完结
        await this.completeLatestAftersalesByOrderAndType(id, 'RE_SERVICE', operatorUserId ?? null);
        // JSAPI服务订单：按要求上报发货信息（logistics_type=3）
        try{
            if (order.payMethod === 'WECHAT_JSAPI' && this.wxship){
                await this.wxship.uploadShippingInfo({ orderId: id, logisticsType: 3 });
            }
        }catch{}
        return updatedFinish;
    }

    // ========================
    // 售后与退款
    // ========================
    async createAfterSalesRequest(params: {
        orderId: number;
        memberId: number;
        type: AfterSalesType;
        reasonCode?: string | null;
        reasonText?: string | null;
        description?: string | null;
        imagesJson?: any;
        exchangeAddressSnapshot?: any;
        requestedAmount?: Prisma.Decimal | number | null;
    }) {
        // 校验订单归属
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: params.orderId } });
        if (order.memberId !== params.memberId) throw new Error('订单不属于当前用户');
        // 并发防护：存在进行中售后则拒绝
        const exists = await this.prisma.afterSalesRequest.findFirst({ where: { orderId: params.orderId, status: { in: ['PENDING','APPROVED'] as any } } }).catch(()=>null);
        if (exists) throw new Error('该订单已有进行中的售后处理');
        const created = await this.prisma.afterSalesRequest.create({
            data: {
                orderId: params.orderId,
                memberId: params.memberId,
                type: params.type,
                reasonCode: params.reasonCode || null,
                reasonText: params.reasonText || null,
                description: params.description || null,
                imagesJson: params.imagesJson ?? undefined,
                exchangeAddressSnapshot: params.exchangeAddressSnapshot ?? undefined,
                status: 'PENDING' as any,
                requestedAmount: params.requestedAmount != null ? new Prisma.Decimal(params.requestedAmount as any) : undefined,
            },
        });
        try { await this.syncBindings('AfterSalesRequest', String(created.id), 'imagesJson', Array.isArray(params.imagesJson)? params.imagesJson: []); } catch {}
        try { await this.writeTimeline({ orderId: params.orderId, event: 'AFTERSALES', value: 'PENDING', remark: String(params.type||'') }); } catch {}
        return created;
    }

    async listAfterSales(query: { status?: AfterSalesStatus | undefined; memberId?: number | undefined }) {
        const where: any = {};
        if (query.status) where.status = query.status;
        if (query.memberId) where.memberId = query.memberId;
        return this.prisma.afterSalesRequest.findMany({ where, orderBy: { id: 'desc' }, include: { order: true, member: true, auditUser: true } });
    }

    async getAfterSales(id: number) {
        return this.prisma.afterSalesRequest.findUnique({ where: { id }, include: { order: true, member: true, auditUser: true } });
    }

    async auditAfterSales(id: number, approve: boolean, auditRemark?: string | null, auditUserId?: number | null, requestedAmountOverride?: number | null) {
        const req = await this.prisma.afterSalesRequest.findUnique({ where: { id }, include: { order: true } });
        if (!req) throw new Error('售后申请不存在');
        const nextStatus: AfterSalesStatus = approve ? 'APPROVED' : 'REJECTED';
        // 先更新审核结果
        const updated = await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: nextStatus, auditRemark: auditRemark || null, auditUserId: auditUserId ?? null, auditedAt: new Date() } });
        await this.writeTimeline({ orderId: req.orderId, event: 'AFTERSALES', value: String(nextStatus), remark: req.type, operatorUserId: auditUserId ?? null });

        if (!approve) {
            return updated;
        }

        // 审核通过后的联动处理
        if (req.type === 'REFUND') {
            if (req.order?.payStatus === 'PAID') {
                const pm = String((req.order as any)?.payMethod||'').toUpperCase();
                if (pm === 'WECHAT_JSAPI') {
                    // JSAPI 渠道退款：标记审核通过，等待渠道回调（由回调完成售后与订单状态）
                    return await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'APPROVED' as any } });
                }
                if (pm === 'WECHAT_MICROPAY'){
                    // 付款码支付：发起 v2 渠道退款，等待通知/查询回写
                    const order = req.order as any;
                    const amountFen = Math.round(Number(order.payAmount) * 100);
                    const requestedYuan = (requestedAmountOverride != null ? requestedAmountOverride : req.requestedAmount);
                    const requestedFen = Math.round(Number((requestedYuan != null ? requestedYuan : order.payAmount)) * 100);
                    const isFullRequest = (requestedAmountOverride != null)
                        ? Math.abs(Number(requestedAmountOverride) - Number(order.payAmount)) < 0.000001
                        : (req.requestedAmount == null || Math.abs(Number(req.requestedAmount) - Number(order.payAmount)) < 0.000001);
                    const existing:any = await this.getOrder(order.id);
                    const successSumFen = Math.round(((existing?.refundRecords||[]).filter((r:any)=>r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0)) * 100);
                    const refundableFen = Math.max(0, amountFen - successSumFen);
                    const refundFen = Math.min(requestedFen, refundableFen);
                    if (isFullRequest && successSumFen > 0) throw new Error('已发生部分退款，不能再使用全额退款');
                    if (refundFen <= 0) throw new Error('累计退款金额已达上限');
                    const allowed = await this.verifyRefundAllowed(order.id, refundFen / 100);
                    if (!allowed) throw new Error('退款校验未通过：关联权益已部分使用');
                    const outRefundNo = `R_${order.no}_${Date.now()}`;
                    // 避免重复提交：检查近1分钟内是否已存在相同金额的 PENDING/PROCESSING 记录
                    try{
                        const recent = await this.prisma.refundRecord.findFirst({ where: { orderId: order.id, status: { in: ['PENDING','PROCESSING'] as any }, amount: new Prisma.Decimal(refundFen/100 as any) }, orderBy: { id: 'desc' } });
                        if (recent && (Date.now() - new Date((recent as any).createdAt||0).getTime()) < 60_000){
                            return await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'APPROVED' as any } });
                        }
                    }catch{}
                    await this.createRefundRecord({ orderId: order.id, memberId: order.memberId, amount: (refundFen/100), method: 'WECHAT_MICROPAY' as any, reasonCode: 'WECHAT', reasonText: '售后退款', outRefundNo, status: 'PENDING' as any });
                    const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund-v2';
                    try{
                        await this.wxpay.createRefundV2({ outTradeNo: order.no, outRefundNo, totalFeeFen: amountFen, refundFeeFen: refundFen, refundDesc: '售后退款', notifyUrl });
                        await this.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, null, null);
                    }catch(e:any){ await this.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, String(e?.message||e||'FAIL')); }
                    // 审核通过但等待渠道回调/查询，不立即完结售后
                    return await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'APPROVED' as any } });
                }
                // 其它渠道：内部退款并回收权益
                await this.finalizeInternalRefund(req.orderId, '售后退款', auditUserId ?? null);
                await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'COMPLETED' as any, completedAt: new Date() } });
                await this.writeTimeline({ orderId: req.orderId, event: 'AFTERSALES', value: 'COMPLETED', remark: req.type, operatorUserId: auditUserId ?? null });
                return await this.prisma.afterSalesRequest.findUnique({ where: { id }, include: { order: true, member: true, auditUser: true } });
            } else {
                // 未支付：等同取消
                await this.cancelOrder(req.orderId, '售后取消（未支付）', auditUserId ?? null);
                await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'COMPLETED' as any, completedAt: new Date() } });
                await this.writeTimeline({ orderId: req.orderId, event: 'AFTERSALES', value: 'COMPLETED', remark: req.type, operatorUserId: auditUserId ?? null });
                return await this.prisma.afterSalesRequest.findUnique({ where: { id }, include: { order: true, member: true, auditUser: true } });
            }
        } else if (req.type === 'EXCHANGE') {
            // 换货：商品订单且已支付
            const ord = await this.prisma.order.findUnique({ where: { id: req.orderId } });
            if (ord && ord.type === 'SP' && ord.payStatus === 'PAID') {
                await this.prisma.order.update({ where: { id: ord.id }, data: { fulfillmentStatus: 'PENDING' as any, status: 'PAID' } });
            } else {
                return await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'REJECTED' as any, auditRemark: '未支付不可换货' } });
            }
            await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'COMPLETED' as any, completedAt: new Date() } });
            await this.writeTimeline({ orderId: req.orderId, event: 'FULFILLMENT', value: 'PENDING', remark: 'EXCHANGE_RESET', operatorUserId: auditUserId ?? null });
            await this.writeTimeline({ orderId: req.orderId, event: 'AFTERSALES', value: 'COMPLETED', remark: 'EXCHANGE', operatorUserId: auditUserId ?? null });
        } else if (req.type === 'RE_SERVICE') {
            // 重新服务：服务订单且已支付
            const ord = await this.prisma.order.findUnique({ where: { id: req.orderId } });
            if (ord && ord.type === 'SERVICE' && ord.payStatus === 'PAID') {
                await this.prisma.order.update({ where: { id: ord.id }, data: { fulfillmentStatus: 'PENDING' as any, status: 'PAID' } });
            } else {
                return await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'REJECTED' as any, auditRemark: '未支付不可重新服务' } });
            }
            await this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'COMPLETED' as any, completedAt: new Date() } });
            await this.writeTimeline({ orderId: req.orderId, event: 'FULFILLMENT', value: 'PENDING', remark: 'RE_SERVICE_RESET', operatorUserId: auditUserId ?? null });
            await this.writeTimeline({ orderId: req.orderId, event: 'AFTERSALES', value: 'COMPLETED', remark: 'RE_SERVICE', operatorUserId: auditUserId ?? null });
        }
        return this.prisma.afterSalesRequest.findUnique({ where: { id }, include: { order: true, member: true, auditUser: true } });
    }

    async completeAfterSales(id: number) {
        return this.prisma.afterSalesRequest.update({ where: { id }, data: { status: 'COMPLETED' as any, completedAt: new Date() } });
    }

    // 幂等：查找近窗口期内相同金额的退款记录（PENDING/PROCESSING）
    async findRecentRefundRecord(params: { orderId: number; amountYuan: number; statuses?: RefundStatus[]; windowMs?: number }){
        const { orderId, amountYuan } = params;
        const statuses = (params.statuses && params.statuses.length) ? params.statuses : (['PENDING','PROCESSING'] as any);
        const windowMs = Number.isFinite(params.windowMs as any) ? Number(params.windowMs) : 60_000;
        const rec = await this.prisma.refundRecord.findFirst({ where: { orderId, status: { in: statuses as any }, amount: new Prisma.Decimal(amountYuan as any) }, orderBy: { id: 'desc' } });
        if (!rec) return null;
        try{
            const createdAt: any = (rec as any).createdAt;
            if (!createdAt) return rec;
            const ts = new Date(createdAt).getTime();
            if (Date.now() - ts <= windowMs) return rec;
            return null;
        }catch{ return rec; }
    }

    async createRefundRecord(params: { orderId: number; memberId: number; amount: Prisma.Decimal | number; method?: PayMethod | null; reasonCode?: string | null; reasonText?: string | null; outRefundNo?: string | null; wechatRefundId?: string | null; status?: RefundStatus }) {
        const rec = await this.prisma.refundRecord.create({
            data: {
                orderId: params.orderId,
                memberId: params.memberId,
                amount: new Prisma.Decimal(params.amount as any),
                method: params.method ?? null,
                reasonCode: params.reasonCode || null,
                reasonText: params.reasonText || null,
                outRefundNo: params.outRefundNo || null,
                wechatRefundId: params.wechatRefundId || null,
                status: (params.status || 'PENDING') as any,
            },
        });
        try { await this.writeTimeline({ orderId: params.orderId, event: 'PAY_STATUS', value: 'REFUND_REQUESTED', remark: `¥${Number(params.amount||0).toFixed(2)}` }); } catch {}
        return rec;
    }

    async updateRefundStatusByOutRefundNo(outRefundNo: string, status: RefundStatus, wechatRefundId?: string | null, failedReason?: string | null) {
        const rec = await this.prisma.refundRecord.findFirst({ where: { outRefundNo } });
        if (!rec) return null;
        // 幂等：若已是目标状态，直接返回当前记录
        if (rec.status === status) return rec;
        return this.prisma.refundRecord.update({ where: { id: rec.id }, data: { status: status as any, wechatRefundId: wechatRefundId || undefined, failedReason: failedReason || undefined } });
    }

    // 完成指定订单的最新退款型售后（用于渠道退款回调）
    async completeLatestRefundAftersalesByOrder(orderId: number, operatorUserId?: number | null) {
        const afr = await this.prisma.afterSalesRequest.findFirst({
            where: { orderId, type: 'REFUND' as any, status: { in: ['PENDING','APPROVED'] as any } },
            orderBy: { id: 'desc' }
        });
        if (!afr) return null;
        await this.prisma.afterSalesRequest.update({ where: { id: afr.id }, data: { status: 'COMPLETED' as any, completedAt: new Date() } });
        await this.writeTimeline({ orderId, event: 'AFTERSALES', value: 'COMPLETED', remark: 'REFUND', operatorUserId: operatorUserId ?? null });
        return afr.id;
    }

    // 记录微信退款原始响应（用于排障与重试判定）
    async saveRefundWechatResp(outRefundNo: string, resp: any){
        const rec = await this.prisma.refundRecord.findFirst({ where: { outRefundNo } });
        if (!rec) return null;
        return this.prisma.refundRecord.update({ where: { id: rec.id }, data: { wechatResp: resp as any } });
    }

    // 查询退款记录
    async getRefundRecordById(id: number){
        return this.prisma.refundRecord.findUnique({ where: { id }, include: { order: true, member: true } });
    }

    async getRefundRecordByOutRefundNo(outRefundNo: string){
        return this.prisma.refundRecord.findFirst({ where: { outRefundNo } });
    }

    // 若退款记录缺少 outRefundNo，设置一个（用于重试）
    async setRefundOutRefundNo(id: number, outRefundNo: string){
        return this.prisma.refundRecord.update({ where: { id }, data: { outRefundNo } });
    }

    async completeLatestAftersalesByOrderAndType(orderId: number, type: 'EXCHANGE'|'RE_SERVICE', operatorUserId?: number | null) {
        const afr = await this.prisma.afterSalesRequest.findFirst({
            where: { orderId, type: type as any, status: { in: ['PENDING','APPROVED'] as any } },
            orderBy: { id: 'desc' }
        });
        if (!afr) return null;
        await this.prisma.afterSalesRequest.update({ where: { id: afr.id }, data: { status: 'COMPLETED' as any, completedAt: new Date() } });
        await this.writeTimeline({ orderId, event: 'AFTERSALES', value: 'COMPLETED', remark: type, operatorUserId: operatorUserId ?? null });
        return afr.id;
    }

    // 换货售后：独立发货（不改动订单主发货字段，只写入扩展JSON与时间线）
    async shipExchangeForAfterSales(afrId: number, operatorUserId?: number | null, payload?: { noExpress?: boolean; companyCode?: string | null; companyName?: string | null; companyLogo?: string | null; trackingNo?: string | null; contactSenderPhoneMasked?: string | null; contactReceiverPhoneMasked?: string | null }){
        const afr = await this.prisma.afterSalesRequest.findUnique({ where: { id: afrId }, include: { order: true } });
        if (!afr) throw new Error('售后申请不存在');
        if (afr.type !== 'EXCHANGE') throw new Error('仅换货售后可使用该接口');
        const ord = afr.order as any;
        if (!ord) throw new Error('关联订单不存在');
        if (ord.type !== 'SP') throw new Error('仅商品订单支持换货发货');
        if (ord.payStatus !== 'PAID') throw new Error('仅已支付订单可换货发货');

        // 写入到订单扩展JSON中，独立记录换货发货
        const extra: any = ord.shipExpressExtra || {};
        const list: any[] = Array.isArray(extra.exchangeShipments) ? extra.exchangeShipments : [];
        const entry = {
            noExpress: !!payload?.noExpress,
            companyCode: payload?.companyCode || null,
            companyName: payload?.companyName || null,
            companyLogo: payload?.companyLogo || null,
            trackingNo: payload?.trackingNo || null,
            contact: {
                senderPhoneMasked: payload?.contactSenderPhoneMasked || null,
                receiverPhoneMasked: payload?.contactReceiverPhoneMasked || null,
            },
            operatorUserId: operatorUserId ?? null,
            createdAt: new Date().toISOString(),
        };
        list.push(entry);
        const newExtra = { ...(extra||{}), exchangeShipments: list };
        await this.prisma.order.update({ where: { id: ord.id }, data: { shipExpressExtra: newExtra } });

        // 时间线：换货已发货
        const remark = [payload?.companyName || payload?.companyCode, payload?.trackingNo].filter(Boolean).join(' / ');
        await this.writeTimeline({ orderId: ord.id, event: 'LOGISTICS', value: 'EXCHANGE_SHIPPED', remark, operatorUserId });

        // 更新履约状态：置为已发货（不覆盖主物流字段，仅用于状态与列表展示）
        try{
            const cur = await this.prisma.order.findUnique({ where: { id: ord.id }, select: { fulfillmentStatus: true } });
            if (cur && (cur.fulfillmentStatus as any) === 'PENDING'){
                await this.prisma.order.update({ where: { id: ord.id }, data: { fulfillmentStatus: 'SHIPPED' as any } });
                await this.writeTimeline({ orderId: ord.id, event: 'FULFILLMENT', value: 'SHIPPED', remark: 'EXCHANGE', operatorUserId });
            }
        }catch{/* ignore */}

        // 微信 JSAPI：条件上报发货信息（若已修改过物流单号，则认为已变更过发货，不再上报）
        try{
            const editedOnce = !!(extra && typeof extra==='object' && (extra as any).editedOnce === true);
            if (ord.payMethod === 'WECHAT_JSAPI' && this.wxship && !editedOnce){
                const logisticsType = payload?.noExpress ? 4 : 1;
                const isSF = (payload?.companyName||'').includes('顺丰') || String(payload?.companyCode||'').toUpperCase()==='SF';
                const contact = isSF ? { senderPhoneMasked: payload?.contactSenderPhoneMasked || undefined, receiverPhoneMasked: payload?.contactReceiverPhoneMasked || undefined } : undefined;
                await this.wxship.uploadShippingInfo({ orderId: ord.id, logisticsType: logisticsType as any, deliveryId: payload?.companyCode || undefined, trackingNo: payload?.trackingNo || undefined, contact });
            }
        }catch{/* ignore report errors */}

        return await this.prisma.order.findUnique({ where: { id: ord.id } });
    }
}

// ========== 文件绑定辅助 ==========
async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]>{
    const set = new Set<string>();
    for (const u of urls){ if(!u) continue; const s=String(u).trim(); if(!s) continue; set.add(s); try{ if(/^https?:\/\//i.test(s)){ const rel=new URL(s).pathname; if(rel) set.add(rel); } }catch{} }
    const arr = Array.from(set); if(!arr.length) return [];
    const rows = await (prisma as any).fileAsset.findMany({ where: { url: { in: arr } }, select: { id: true } });
    return Array.isArray(rows) ? rows.map((r:any)=>String(r.id)) : [];
}

OrderService.prototype['syncBindings'] = async function(this: OrderService, tableName: string, rowId: string, fieldName: string, urls: string[]){
    try{
        const desired = new Set<string>(await getAssetIdsFromUrls(this['prisma'], urls));
        const existing:any[] = await (this['prisma'] as any).fileBinding.findMany({ where: { tableName, rowId: String(rowId), fieldName } });
        for (const b of existing){ if(!desired.has(String(b.fileId))) { try{ await this['assets']?.unbindReference(String(b.fileId), String(b.id)); }catch{} } }
        for (const fid of desired){ const ok = existing.find((b:any)=> String(b.fileId)===fid); if(!ok){ try{ await this['assets']?.bindReference(String(fid), { tableName, rowId: String(rowId), fieldName }); }catch{} } }
    }catch{}
};


