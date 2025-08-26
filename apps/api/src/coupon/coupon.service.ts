import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class CouponService {
    constructor(private readonly prisma: PrismaService) {}

    // 分组
    listGroups(){ return this.prisma.couponGroup.findMany({ orderBy: [{ weight: 'desc' }, { id: 'desc' }] }); }
    createGroup(data: { name: string; description?: string | null; enabled?: boolean; weight?: number }) {
        return this.prisma.couponGroup.create({ data: { name: data.name, description: data.description ?? null, enabled: data.enabled ?? true, weight: data.weight ?? 0 } });
    }
    updateGroup(id: number, data: { name?: string; description?: string | null; enabled?: boolean; weight?: number }) {
        return this.prisma.couponGroup.update({ where: { id }, data });
    }
    deleteGroup(id: number){ return this.prisma.couponGroup.delete({ where: { id } }); }

    // 卡券
    listCoupons(query: { groupId?: number | null; type?: 'COUPON'|'WASH_CARD' | null; enabled?: boolean | null }){
        const where: any = {};
        if (query.groupId !== undefined) where.groupId = query.groupId;
        if (query.type) where.type = query.type;
        if (query.enabled !== undefined && query.enabled !== null) where.enabled = query.enabled;
        return this.prisma.coupon.findMany({ where, orderBy: [{ id: 'desc' }], include: { group: true, applicableProducts: { include: { product: true } } } });
    }
    getCoupon(id: number){ return this.prisma.coupon.findUnique({ where: { id }, include: { group: true, applicableProducts: { include: { product: true } } } }); }

    async createCoupon(data: any){
        const {
            applicableProductIds,
            ...rest
        } = data || {};
        // 规范化字段
        const payload: any = { ...rest };
        if ('id' in payload) delete payload.id;
        // 空字符串转 null
        ['startAt','endAt','imageUrl','description','adminRemark'].forEach((k)=>{ if (payload[k] === '' || payload[k] === undefined) payload[k] = null; });
        // 日期字段规范
        if (payload.startAt) payload.startAt = new Date(payload.startAt);
        if (payload.endAt) payload.endAt = new Date(payload.endAt);

        return this.prisma.$transaction(async (tx)=>{
            const created = await tx.coupon.create({ data: payload });
            if (Array.isArray(applicableProductIds) && applicableProductIds.length > 0) {
                await tx.couponApplicableProduct.createMany({ data: applicableProductIds.map((pid: number)=>({ couponId: created.id, productId: Number(pid) })) });
            }
            return tx.coupon.findUnique({ where: { id: created.id }, include: { group: true, applicableProducts: { include: { product: true } } } });
        });
    }

    async updateCoupon(id: number, data: any){
        const { applicableProductIds, ...rest } = data || {};
        const payload: any = { ...rest };
        if ('id' in payload) delete payload.id;
        ['startAt','endAt','imageUrl','description','adminRemark'].forEach((k)=>{ if (payload[k] === '' || payload[k] === undefined) payload[k] = null; });
        if (payload.startAt) payload.startAt = new Date(payload.startAt);
        if (payload.endAt) payload.endAt = new Date(payload.endAt);

        return this.prisma.$transaction(async (tx)=>{
            await tx.coupon.update({ where: { id }, data: payload });
            if (Array.isArray(applicableProductIds)) {
                await tx.couponApplicableProduct.deleteMany({ where: { couponId: id } });
                if (applicableProductIds.length > 0) {
                    await tx.couponApplicableProduct.createMany({ data: applicableProductIds.map((pid: number)=>({ couponId: id, productId: Number(pid) })) });
                }
            }
            return tx.coupon.findUnique({ where: { id }, include: { group: true, applicableProducts: { include: { product: true } } } });
        });
    }
    deleteCoupon(id: number){ return this.prisma.coupon.delete({ where: { id } }); }
}


