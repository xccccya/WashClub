import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class OrderRewardsService {
    constructor(private readonly prisma: PrismaService) {}

    // 成长值扣减：按每元成长值比例，对退款金额进行等比例扣减，确保累计扣减与累计入账一致
    async deductGrowthForRefund(orderId: number, refundAmountYuan: number, operatorUserId?: number | null, opts?: { finalizeAll?: boolean }) {
        if (!refundAmountYuan || refundAmountYuan <= 0) return;
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;
        const paidYuan = Number(order.payAmount || 0);
        if (paidYuan <= 0) return;
        // 读取"该订单实际入账成长值上限"：优先取 PAY 日志累积（避免配置漂移），否则回退为 floor(payAmount * current growthPerYuan)
        let totalGrowthForOrder = 0;
        try {
            const payLogs: any[] = await (this.prisma as any).memberGrowthLog.findMany({ where: { orderId: order.id, source: 'PAY' }, select: { change: true } });
            const sumPay = (payLogs || []).reduce((s, r) => s + Math.max(0, Number(r.change || 0)), 0);
            totalGrowthForOrder = Math.max(0, Math.floor(sumPay));
        } catch { totalGrowthForOrder = 0; }
        if (totalGrowthForOrder <= 0) {
            const ss: any = await this.prisma.siteSetting.findFirst().catch(() => null);
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
        if (opts?.finalizeAll) {
            willDeduct = remaining;
        } else {
            const ss: any = await this.prisma.siteSetting.findFirst().catch(() => null);
            const growthPerYuan = Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1)));
            const thisDeduct = Math.max(0, Math.floor(Number(refundAmountYuan) * growthPerYuan));
            willDeduct = Math.min(remaining, thisDeduct);
        }
        if (willDeduct <= 0) return;

        // 幂等与负值保护：事务内检查当前成长值，若不足则按当前值扣
        await this.prisma.$transaction(async (tx) => {
            const m0: any = await tx.member.findUnique({ where: { id: order.memberId }, select: { id: true, /* @ts-ignore */ growthPoints: true } as any });
            const currentGrowth = Math.max(0, Number(m0?.growthPoints || 0));
            const safeDeduct = Math.min(willDeduct, currentGrowth);
            if (safeDeduct <= 0) return;
            // 幂等保护：短时间内相同 orderId 与相同扣减量是否已记账（简单去重）；如需更强可引入唯一键（orderId, source, change, createdAt分钟粒度）
            const recent: any[] = await (tx as any).memberGrowthLog.findMany({ where: { orderId: order.id, source: 'REFUND', change: -safeDeduct }, orderBy: { id: 'desc' }, take: 1 });
            if (recent && recent.length) { return; }
            await tx.member.update({ where: { id: order.memberId }, data: { growthPoints: { decrement: safeDeduct } } });
            await (tx as any).memberGrowthLog.create({ data: { memberId: order.memberId, change: -safeDeduct, source: 'REFUND', desc: `订单退款扣减 ${order.no}`, orderId: order.id, operatorUserId: operatorUserId ?? null } });
            // 等级仅在阈值变更时重算：先查当前等级阈值与下一等级阈值，判断是否跨阈
            try {
                const m: any = await tx.member.findUnique({ where: { id: order.memberId }, select: { id: true, /* @ts-ignore */ growthPoints: true, levelId: true } as any });
                const gp = Number(m?.growthPoints || 0);
                const levels: any[] = await tx.memberLevel.findMany({ orderBy: { /* @ts-ignore */ level: 'desc' } as any });
                const target = levels.find(l => gp >= Number((l as any)?.requiredGrowth ?? 0));
                const nextLevelId = target ? target.id : null;
                if ((m?.levelId || null) !== nextLevelId) { await tx.member.update({ where: { id: order.memberId }, data: { levelId: nextLevelId } }); }
            } catch { }
        });
    }

    // 积分扣减：按订单累计退款比例，对支付入账积分进行等比例扣减（累计口径，避免取整误差）
    async deductPointsForRefund(orderId: number, operatorUserId?: number | null, opts?: { finalizeAll?: boolean }) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;
        const paidYuan = Number(order.payAmount || 0);
        if (paidYuan <= 0) return;
        // 该订单实际入账积分上限：累加 PAY 日志，避免配置/倍数漂移
        let totalPointsForOrder = 0;
        try {
            const payLogs: any[] = await (this.prisma as any).memberPointsLog.findMany({ where: { orderId: order.id, source: 'PAY' }, select: { change: true } });
            totalPointsForOrder = Math.max(0, (payLogs || []).reduce((s, r) => s + Math.max(0, Number(r.change || 0)), 0));
        } catch { totalPointsForOrder = 0; }
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
        if (opts?.finalizeAll) {
            willDeduct = remaining;
        } else {
            const fresh = await this.prisma.order.findUnique({ where: { id: orderId } });
            const refundedSoFar = Math.max(0, Number(fresh?.refundedAmount || 0));
            const ratio = Math.max(0, Math.min(1, paidYuan > 0 ? (refundedSoFar / paidYuan) : 0));
            const targetTotal = Math.max(0, Math.floor(totalPointsForOrder * ratio));
            willDeduct = Math.max(0, Math.min(remaining, targetTotal - alreadyDeducted));
        }
        if (willDeduct <= 0) return;
        await this.prisma.$transaction(async (tx) => {
            const m0 = await tx.member.findUnique({ where: { id: order.memberId }, select: { id: true, points: true } });
            const currentPoints = Math.max(0, Number(m0?.points || 0));
            const safeDeduct = Math.min(willDeduct, currentPoints);
            if (safeDeduct <= 0) return;
            // 幂等：1分钟内相同扣减去重（简单防抖）
            const recent: any[] = await (tx as any).memberPointsLog.findMany({ where: { orderId: order.id, source: 'REFUND', change: -safeDeduct }, orderBy: { id: 'desc' }, take: 1 });
            if (recent && recent.length) return;
            await tx.member.update({ where: { id: order.memberId }, data: { points: { decrement: safeDeduct } } });
            await (tx as any).memberPointsLog.create({ data: { memberId: order.memberId, change: -safeDeduct, source: 'REFUND', desc: `订单退款扣减 ${order.no}`, orderId: order.id, operatorUserId: operatorUserId ?? null } });
        });
    }

    // 验证洗车卡退款是否可行
    async verifyWashCardRefundable(orderId: number) {
        // 若该订单购买过洗车卡，则校验可回收次数是否充足
        const addLogs = await this.prisma.washCardLog.findMany({ where: { purchaseOrderId: orderId, reason: 'PURCHASE_ADD' as any } });
        if (!addLogs.length) return { ok: true } as const;
        // 聚合到卡
        const byCard = new Map<number, number>();
        for (const log of addLogs) { byCard.set(log.cardId, (byCard.get(log.cardId) || 0) + Math.abs(log.change)); }
        for (const [cardId, addCount] of byCard) {
            const card = await this.prisma.washCard.findUnique({ where: { id: cardId } });
            if (!card) continue;
            if ((card.remainingTimes || 0) < addCount) { return { ok: false as const, cardId, need: addCount, remain: card.remainingTimes } as const; }
        }
        return { ok: true } as const;
    }

    // 回滚洗车卡（退款时）
    async rollbackWashCardForRefund(orderId: number, operatorUserId?: number | null, ctx?: { outRefundNo?: string | null; wechatRefundId?: string | null }) {
        const addLogs = await this.prisma.washCardLog.findMany({ where: { purchaseOrderId: orderId, reason: 'PURCHASE_ADD' as any } });
        if (!addLogs.length) return;
        // 获取订单号用于日志备注展示
        let orderNo: string | undefined;
        try { const ord = await this.prisma.order.findUnique({ where: { id: orderId }, select: { no: true } }); orderNo = ord?.no; } catch { }
        for (const log of addLogs) {
            const card = await this.prisma.washCard.findUnique({ where: { id: log.cardId } });
            if (!card) continue;
            const canDeduct = Math.min(card.remainingTimes, Math.abs(log.change));
            const before = card.remainingTimes;
            const afterRemain = before - canDeduct;
            await this.prisma.washCard.update({ where: { id: card.id }, data: { totalTimes: Math.max(0, card.totalTimes - canDeduct), remainingTimes: afterRemain } });
            const mark = ctx?.outRefundNo ? `退款单号：${ctx.outRefundNo}` : (ctx?.wechatRefundId ? `微信退款ID：${ctx.wechatRefundId}` : `订单号：${orderNo || orderId}`);
            await this.prisma.washCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'REFUND_DEDUCT' as any, change: -canDeduct, beforeRemaining: before, afterRemaining: afterRemain, remark: `退款回收（${mark}）`, operatorUserId: operatorUserId ?? null, purchaseOrderId: orderId } as any });
        }
    }

    // 回滚积分和优惠券（取消订单时）
    async rollbackPointsForRefund(orderId: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;
        const points = order.usedPoints || 0;
        if (points > 0) {
            await this.prisma.member.update({ where: { id: order.memberId }, data: { points: { increment: points } } });
            try { await (this.prisma as any).memberPointsLog.create({ data: { memberId: order.memberId, change: points, source: 'REFUND', desc: `退款返还积分（订单${order.no}）`, orderId: order.id, operatorUserId: operatorUserId ?? null } }); } catch { }
        }
        // 恢复所有与该订单绑定且已使用的优惠券
        try {
            const usedMcs: any[] = await (this.prisma as any).memberCoupon.findMany({ where: { orderId: order.id, usedAt: { not: null } }, include: { coupon: true } });
            if (usedMcs && usedMcs.length) {
                for (const mc of usedMcs) { await (this.prisma as any).memberCoupon.update({ where: { id: mc.id }, data: { usedAt: null, orderId: null } }); try { await (this.prisma as any).couponFlowLog.create({ data: { action: 'RESTORE', memberId: order.memberId, orderId: order.id, couponId: mc.couponId ?? null, memberCouponId: mc.id, count: 1, remark: '全额退款恢复优惠券', snapshot: order.couponInfo as any } }); } catch { } }
            }
        } catch { }
    }

    // 支付成功后发放成长值和积分
    async grantRewardsForPayment(orderId: number) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;

        const amountYuan = Number(order.payAmount || 0);
        if (amountYuan <= 0) return;

        const ss: any = await this.prisma.siteSetting.findFirst().catch(() => null);
        const growthPerYuan = Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1)));
        const growthInc = Math.max(0, Math.floor(amountYuan * growthPerYuan));
        
        await this.prisma.member.update({ 
            where: { id: order.memberId }, 
            data: { 
                totalPaidAmount: { increment: amountYuan as any }, 
                growthPoints: { increment: growthInc } 
            } as any 
        });

        // 成长值日志
        if (growthInc > 0) {
            await (this.prisma as any).memberGrowthLog.create({ 
                data: { 
                    memberId: order.memberId, 
                    change: growthInc, 
                    source: 'PAY', 
                    desc: `支付订单 ${order.no}`, 
                    orderId: order.id 
                } 
            });
        }

        // 积分入账（含等级倍数）
        try {
            // 幂等保护：若该订单已产生过 PAY 类型的积分入账，则不重复入账
            const exists: any[] = await (this.prisma as any).memberPointsLog.findMany({ where: { orderId: order.id, source: 'PAY' }, take: 1 });
            if (!exists || exists.length === 0) {
                const pointsPerFen = Math.max(0, Math.floor(Number(ss?.pointsPerFen ?? 1)));
                const amountFen = Math.max(0, Math.floor(amountYuan * 100)); // 转换为分
                let basePoints = Math.max(0, Math.floor(amountFen * pointsPerFen));
                let multiplier = 1;
                try {
                    const m: any = await this.prisma.member.findUnique({ where: { id: order.memberId }, select: { id: true, level: { select: { pointsMultiplier: true } } } });
                    multiplier = Math.max(1, Math.floor(Number(m?.level?.pointsMultiplier ?? 1)));
                } catch { }
                const pointsInc = Math.max(0, Math.floor(basePoints * multiplier));
                if (pointsInc > 0) {
                    await this.prisma.member.update({ where: { id: order.memberId }, data: { points: { increment: pointsInc } } });
                    await (this.prisma as any).memberPointsLog.create({ data: { memberId: order.memberId, change: pointsInc, source: 'PAY', desc: `支付订单 ${order.no}`, orderId: order.id } });
                }
            }
        } catch { }

        // 计算应有等级：找出 growthPoints 达标的最高 level
        const m: any = await this.prisma.member.findUnique({ where: { id: order.memberId }, select: { id: true, /* @ts-ignore */ growthPoints: true, levelId: true } as any });
        const levels: any[] = await this.prisma.memberLevel.findMany({ orderBy: { /* @ts-ignore */ level: 'desc' } as any });
        const target = levels.find(l => Number(m?.growthPoints ?? 0) >= Number((l as any)?.requiredGrowth ?? 0));
        if (target && target.id !== (m?.levelId || null)) {
            await this.prisma.member.update({ where: { id: order.memberId }, data: { levelId: target.id } });
        }
    }

    // 支付成功后发放洗车卡
    async grantWashCardsForPayment(orderId: number) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) return;

        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const prod = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!prod || prod.type !== 'VIRTUAL_CARD' || !prod.couponId) continue;
            const coupon = await this.prisma.coupon.findUnique({ where: { id: prod.couponId } });
            if (!coupon) continue;
            const couponType = String((coupon as any).type);
            // 会员洗车计次卡
            if (couponType === 'WASH_CARD') {
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
                async function gen(tx: PrismaService) { for (let i = 0; i < 20; i++) { const n = Math.floor(Math.random() * 100000000); const candidate = String(n).padStart(8, '0'); const exists = await tx.washCard.findUnique({ where: { cardNo: candidate } }).catch(() => null); if (!exists) return candidate; } return String(Date.now()).slice(-8); }
                const cardNo = await gen(this.prisma);
                const created = await this.prisma.washCard.create({ data: { ownerMemberId: order.memberId, name: coupon.name, totalTimes: change, remainingTimes: change, cardNo, expiryAt } });
                await this.prisma.washCardLog.create({ data: { cardId: created.id, action: 'ADD' as any, reason: 'PURCHASE_ADD' as any, change, beforeRemaining: 0, afterRemaining: change, remark, purchaseOrderId: order.id } });
            }
            continue;
            }
            // 集团洗车计次卡
            if (couponType === 'GROUP_WASH_CARD') {
                if (!order.groupId) continue;
                const times = coupon.totalTimes || 0;
                if (times <= 0) continue;
                const change = times * it.quantity;
                const remark = `购买入账（订单号：${order.no}）`;
                let expiryAt: Date | null = null;
                if (coupon.expiryType === 'FIXED') { expiryAt = coupon.endAt ? new Date(coupon.endAt as any) : null; }
                else if (coupon.expiryType === 'AFTER_RECEIVE') { const now2 = new Date(); expiryAt = (coupon.validDays && coupon.validDays > 0) ? new Date(now2.getTime() + Number(coupon.validDays) * 24 * 60 * 60 * 1000) : null; }
                else { expiryAt = null; }
                const existing = await this.prisma.groupWashCard.findFirst({ where: { groupId: order.groupId, name: coupon.name } });
                if (existing) {
                    const before = existing.remainingTimes;
                    const afterRemaining = before + change;
                    let nextExpiry: Date | null = existing.expiryAt ?? null;
                    if (expiryAt) { if (!nextExpiry || new Date(expiryAt) > new Date(nextExpiry)) nextExpiry = expiryAt; }
                    await this.prisma.groupWashCard.update({ where: { id: existing.id }, data: { totalTimes: existing.totalTimes + change, remainingTimes: afterRemaining, expiryAt: nextExpiry } });
                    await this.prisma.groupWashCardLog.create({ data: { cardId: existing.id, action: 'ADD' as any, reason: 'PURCHASE_ADD' as any, change, beforeRemaining: before, afterRemaining: afterRemaining, remark } });
                } else {
                    async function gen2(tx: PrismaService) { for (let i = 0; i < 20; i++) { const n = Math.floor(Math.random() * 100000000); const candidate = String(n).padStart(8, '0'); const exists = await tx.groupWashCard.findFirst({ where: { cardNo: candidate } }).catch(() => null); if (!exists) return candidate; } return String(Date.now()).slice(-8); }
                    const cardNo = await gen2(this.prisma);
                    const created = await this.prisma.groupWashCard.create({ data: { groupId: order.groupId, name: coupon.name, totalTimes: change, remainingTimes: change, cardNo, expiryAt } });
                    await this.prisma.groupWashCardLog.create({ data: { cardId: created.id, action: 'ADD' as any, reason: 'PURCHASE_ADD' as any, change, beforeRemaining: 0, afterRemaining: change, remark } });
                }
                continue;
            }
        }
    }

    // 验证退款是否允许（主要检查洗车卡）
    async verifyRefundAllowed(orderId: number, amountYuan?: number | null) {
        // 若涉及洗车卡购买，且卡已部分使用，不允许全额退款；部分退款允许金额小于等于订单实付但不回收卡
        if (!amountYuan || amountYuan <= 0) return true;
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        const isFull = Math.abs(Number(order.payAmount)) - Math.abs(Number(amountYuan)) < 0.000001;
        if (!isFull) return true;
        const ok = await this.verifyWashCardRefundable(orderId);
        return !!(ok as any).ok;
    }
}
