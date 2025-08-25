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
        return this.prisma.coupon.findMany({ where, orderBy: [{ id: 'desc' }], include: { group: true } });
    }
    getCoupon(id: number){ return this.prisma.coupon.findUnique({ where: { id }, include: { group: true } }); }
    createCoupon(data: any){ return this.prisma.coupon.create({ data }); }
    updateCoupon(id: number, data: any){ return this.prisma.coupon.update({ where: { id }, data }); }
    deleteCoupon(id: number){ return this.prisma.coupon.delete({ where: { id } }); }
}


