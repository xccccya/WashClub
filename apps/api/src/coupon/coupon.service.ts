import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class CouponService {
    constructor(private readonly prisma: PrismaService) {}

    private async writeFlow(params: { action: 'ISSUE'|'CLAIM'|'USE'|'RESTORE'|'REVOKE'|'EXPIRE'|'ADJUST'; memberId?: number|null; orderId?: number|null; couponId?: number|null; memberCouponId?: number|null; count?: number; remark?: string|null; snapshot?: any; operatorUserId?: number|null }){
        try{
            await (this.prisma as any).couponFlowLog.create({ data: {
                action: params.action,
                memberId: params.memberId ?? null,
                orderId: params.orderId ?? null,
                couponId: params.couponId ?? null,
                memberCouponId: params.memberCouponId ?? null,
                count: Math.max(1, Number(params.count || 1)),
                remark: params.remark ?? null,
                snapshot: params.snapshot ?? null,
                operatorUserId: params.operatorUserId ?? null,
            } });
        }catch{}
    }

    // 分组
    listGroups(){ return this.prisma.couponGroup.findMany({ orderBy: [{ weight: 'desc' }, { id: 'desc' }] }); }
    createGroup(data: { name: string; description?: string | null; enabled?: boolean; weight?: number }) {
        return this.prisma.couponGroup.create({ data: { name: data.name, description: data.description ?? null, enabled: data.enabled ?? true, weight: data.weight ?? 0 } }); }
    updateGroup(id: number, data: { name?: string; description?: string | null; enabled?: boolean; weight?: number }) {
        return this.prisma.couponGroup.update({ where: { id }, data }); }
    deleteGroup(id: number){ return this.prisma.couponGroup.delete({ where: { id } }); }

    // 卡券
    listCoupons(query: { groupId?: number | null; type?: 'COUPON'|'WASH_CARD' | null; enabled?: boolean | null }){
        const where: any = {};
        if (query.groupId !== undefined) where.groupId = query.groupId;
        if (query.type) where.type = query.type;
        if (query.enabled !== undefined && query.enabled !== null) where.enabled = query.enabled;
        return this.prisma.coupon.findMany({ where, orderBy: [{ id: 'desc' }], include: { group: true, applicableProducts: { include: { product: true } } } }); }
    async getCoupon(id: number){
        const c = await this.prisma.coupon.findUnique({ where: { id }, include: { group: true, applicableProducts: { include: { product: true } } } });
        if (!c) return c as any;
        const issuedCount = await (this.prisma as any).memberCoupon.count({ where: { couponId: id } });
        const usedCount = await (this.prisma as any).memberCoupon.count({ where: { couponId: id, usedAt: { not: null } } });
        const remainingIssue = c.issueTotal != null ? Math.max(0, Number(c.issueTotal) - issuedCount) : null;
        return { ...c, stats: { issuedCount, usedCount, remainingIssue } } as any;
    }

    async createCoupon(data: any){
        const { applicableProductIds, ...rest } = data || {};
        const payload: any = { ...rest };
        if ('id' in payload) delete payload.id;
        ['startAt','endAt','imageUrl','description','adminRemark'].forEach((k)=>{ if (payload[k] === '' || payload[k] === undefined) payload[k] = null; });
        if (payload.startAt) payload.startAt = new Date(payload.startAt);
        if (payload.endAt) payload.endAt = new Date(payload.endAt);
        return this.prisma.$transaction(async (tx)=>{
            if (payload.type === 'COUPON' && payload.expiryType === 'AFTER_RECEIVE') {
                if (payload.validDays == null || Number(payload.validDays) <= 0) throw new Error('有效天数必须为正整数'); }
            const created = await tx.coupon.create({ data: payload });
            if (Array.isArray(applicableProductIds) && applicableProductIds.length > 0) {
                await tx.couponApplicableProduct.createMany({ data: applicableProductIds.map((pid: number)=>({ couponId: created.id, productId: Number(pid) })) }); }
            return tx.coupon.findUnique({ where: { id: created.id }, include: { group: true, applicableProducts: { include: { product: true } } } }); }); }

    async updateCoupon(id: number, data: any){
        const { applicableProductIds, ...rest } = data || {};
        const payload: any = { ...rest };
        if ('id' in payload) delete payload.id;
        ['startAt','endAt','imageUrl','description','adminRemark'].forEach((k)=>{ if (payload[k] === '' || payload[k] === undefined) payload[k] = null; });
        if (payload.startAt) payload.startAt = new Date(payload.startAt);
        if (payload.endAt) payload.endAt = new Date(payload.endAt);
        return this.prisma.$transaction(async (tx)=>{
            if (payload.type === 'COUPON' && payload.expiryType === 'AFTER_RECEIVE') { if (payload.validDays == null || Number(payload.validDays) <= 0) throw new Error('有效天数必须为正整数'); }
            await tx.coupon.update({ where: { id }, data: payload });
            if (Array.isArray(applicableProductIds)) {
                await tx.couponApplicableProduct.deleteMany({ where: { couponId: id } });
                if (applicableProductIds.length > 0) { await tx.couponApplicableProduct.createMany({ data: applicableProductIds.map((pid: number)=>({ couponId: id, productId: Number(pid) })) }); } }
            return tx.coupon.findUnique({ where: { id }, include: { group: true, applicableProducts: { include: { product: true } } } }); }); }
    deleteCoupon(id: number){ return this.prisma.coupon.delete({ where: { id } }); }

    // =======================
    // 会员优惠券实例管理
    // =======================
    async listMemberCoupons(query: { page?: number; pageSize?: number; memberId?: number | null; couponId?: number | null; used?: '0'|'1'|null; expired?: '0'|'1'|null }){
        const page = Math.max(1, Number(query.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
        const where: any = {};
        if (query.memberId != null) where.memberId = query.memberId;
        if (query.couponId != null) where.couponId = query.couponId;
        if (query.used === '0') where.usedAt = null;
        if (query.used === '1') where.usedAt = { not: null };
        if (query.expired === '0') where.OR = [ { endAt: null }, { endAt: { gt: new Date() } } ];
        if (query.expired === '1') where.endAt = { lte: new Date() };
        const [total, items] = await this.prisma.$transaction([
            (this.prisma as any).memberCoupon.count({ where }),
            (this.prisma as any).memberCoupon.findMany({ where, orderBy: { id: 'desc' }, skip: (page-1)*pageSize, take: pageSize, include: { member: { select: { id:true, name:true, phone:true } }, coupon: { select: { id:true, name:true } }, order: { select: { id:true, no:true } } } }) ]);
        return { total, page, pageSize, items }; }

    getMemberCoupon(id: number){ return (this.prisma as any).memberCoupon.findUnique({ where: { id }, include: { member: { select: { id:true, name:true, phone:true } }, coupon: true, order: { select: { id:true, no:true } } } }); }

    async updateMemberCouponExpiry(id: number, payload: { startAt?: Date | null; endAt?: Date | null }){
        const data: any = {};
        if (payload.startAt !== undefined) data.startAt = payload.startAt;
        if (payload.endAt !== undefined) data.endAt = payload.endAt;
        const updated = await (this.prisma as any).memberCoupon.update({ where: { id }, data });
        try{ await this.writeFlow({ action: 'ADJUST', memberId: updated.memberId, couponId: updated.couponId, memberCouponId: updated.id, remark: '调整有效期', snapshot: { startAt: updated.startAt, endAt: updated.endAt } }); }catch{}
        return updated; }

    async deleteMemberCoupon(id: number){
        const mc = await (this.prisma as any).memberCoupon.findUnique({ where: { id } });
        const r = await (this.prisma as any).memberCoupon.delete({ where: { id } });
        try{ if (mc) await this.writeFlow({ action: 'REVOKE', memberId: mc.memberId, couponId: mc.couponId, memberCouponId: mc.id, remark: '后台删除/作废' }); }catch{}
        return r; }

    // 卡券流水列表（新：使用 CouponFlowLog 作为券相关流水）
    async listCouponLogs(query: { page?: number; pageSize?: number; memberId?: number | null; orderId?: number | null }){
        const page = Math.max(1, Number(query.page || 1));
        const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
        const where: any = {};
        if (query.memberId != null) where.memberId = query.memberId;
        if (query.orderId != null) where.orderId = query.orderId;
        const [total, items] = await this.prisma.$transaction([
            (this.prisma as any).couponFlowLog.count({ where }),
            (this.prisma as any).couponFlowLog.findMany({ where, orderBy: { id: 'desc' }, skip: (page-1)*pageSize, take: pageSize, include: { member: { select: { id:true, name:true, phone:true } }, order: { select: { id:true, no:true } }, coupon: { select: { id:true, name:true } }, memberCoupon: { select: { id:true, name:true } } } }) ]);
        return { total, page, pageSize, items }; }

    // =======================
    // 发放/领取
    // =======================
    async issueToMember(params: { couponId: number; memberId: number; count?: number; action?: 'ISSUE'|'CLAIM' }){
        const { couponId, memberId } = params;
        const count = Math.max(1, Number(params.count || 1));
        const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
        if (!coupon) throw new Error('卡券不存在');
        if (!coupon.enabled) throw new Error('卡券未启用');
        if (coupon.type !== 'COUPON') throw new Error('仅支持优惠券类型的发放');
        if (coupon.issueTotal != null) {
            const issued = await (this.prisma as any).memberCoupon.count({ where: { couponId } });
            if (issued + count > Number(coupon.issueTotal)) throw new Error('发行数量不足'); }
        if (coupon.perMemberLimit != null) {
            const owned = await (this.prisma as any).memberCoupon.count({ where: { couponId, memberId } });
            if (owned + count > Number(coupon.perMemberLimit)) throw new Error('超过每人限领次数'); }
        const now = new Date();
        const buildPayload = () => {
            const payload: any = { memberId, couponId, name: coupon.name, expiryType: coupon.expiryType };
            if (coupon.expiryType === 'FIXED') { payload.startAt = coupon.startAt ?? null; payload.endAt = coupon.endAt ?? null; }
            else if (coupon.expiryType === 'AFTER_RECEIVE') { payload.startAt = now; payload.endAt = (coupon.validDays && coupon.validDays > 0) ? new Date(now.getTime() + Number(coupon.validDays) * 24 * 60 * 60 * 1000) : null; }
            else { payload.startAt = null; payload.endAt = null; }
            return payload; };
        const items = Array.from({ length: count }).map(() => buildPayload());
        await this.prisma.$transaction(async (tx)=>{
            if (coupon.issueTotal != null) { const reCount = await (tx as any).memberCoupon.count({ where: { couponId } }); if (reCount + count > Number(coupon.issueTotal)) throw new Error('发行数量不足'); }
            if (coupon.perMemberLimit != null) { const reOwned = await (tx as any).memberCoupon.count({ where: { couponId, memberId } }); if (reOwned + count > Number(coupon.perMemberLimit)) throw new Error('超过每人限领次数'); }
            await (tx as any).memberCoupon.createMany({ data: items }); });
        await this.writeFlow({ action: params.action === 'CLAIM' ? 'CLAIM' : 'ISSUE', memberId, couponId, count, remark: params.action === 'CLAIM' ? '小程序领取' : '后台发放' });
        return { ok: true, issued: count }; }

    async claimForMember(params: { couponId: number; memberId: number }){
        const coupon = await this.prisma.coupon.findUnique({ where: { id: params.couponId } });
        if (!coupon) throw new Error('卡券不存在');
        if (!coupon.enabled) throw new Error('卡券未启用');
        if (!coupon.allowMiniappClaim) throw new Error('当前卡券不可自助领取');
        const now = new Date();
        if (coupon.expiryType === 'FIXED') { if (coupon.startAt && coupon.startAt > now) throw new Error('卡券未到领取时间'); if (coupon.endAt && coupon.endAt < now) throw new Error('卡券已过期'); }
        return this.issueToMember({ couponId: params.couponId, memberId: params.memberId, count: 1, action: 'CLAIM' }); }
}


