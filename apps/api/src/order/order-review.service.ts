import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AssetService } from '../file/asset.service.js';

@Injectable()
export class OrderReviewService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly assets?: AssetService
    ) {}

    private syncBindings!: (tableName: string, rowId: string, fieldName: string, urls: string[]) => Promise<void>;

    private async writeTimeline(params: { tx?: any; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }) {
        try {
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        } catch {/* ignore timeline errors */ }
    }

    // 判断订单是否可以评价
    private isOrderCompletedForReview(o: any): boolean {
        if (!o) return false;
        if (o.type === 'SERVICE') return (o.payStatus === 'PAID') && (o.fulfillmentStatus === 'DONE' || o.status === 'FULFILLED');
        if (o.type === 'SP') return (o.payStatus === 'PAID') && (o.fulfillmentStatus === 'RECEIVED' || o.status === 'CLOSED');
        if (o.type === 'FK') return o.payStatus === 'PAID';
        return false;
    }

    // 创建订单评价
    async createOrderReview(params: {
        orderId: number;
        memberId: number;
        rating: number;
        content?: string | null;
        images?: any;
    }) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: params.orderId } });
        if (order.memberId !== params.memberId) throw new Error('订单不属于当前用户');
        if (!this.isOrderCompletedForReview(order)) throw new Error('仅已完成订单可评价');
        if (order.reviewStatus === 'REVIEWED') throw new Error('订单已评价');
        
        const exists = await (this.prisma as any).orderReview.findUnique({ where: { orderId: params.orderId } });
        if (exists) throw new Error('订单已评价');
        
        const rating = Math.max(1, Math.min(5, Number(params.rating || 5)));
        const created = await (this.prisma as any).orderReview.create({
            data: {
                orderId: params.orderId,
                memberId: params.memberId,
                rating,
                content: params.content ?? null,
                imagesJson: params.images ?? undefined
            }
        });
        
        try {
            await this.syncBindings('OrderReview', String(created.id), 'imagesJson', Array.isArray(params.images) ? params.images : []);
        } catch { }
        
        await this.prisma.order.update({
            where: { id: order.id },
            data: { reviewStatus: 'REVIEWED' as any }
        });
        
        // 时间线：用户已评价（记录评分）
        await this.writeTimeline({
            orderId: order.id,
            event: 'REVIEW',
            value: 'RATED',
            remark: `评分${rating}`,
            operatorUserId: null
        });
        
        return created;
    }

    // 根据订单ID获取评价
    getOrderReviewByOrderId(orderId: number) {
        return (this.prisma as any).orderReview.findUnique({
            where: { orderId },
            include: { replyUser: { select: { name: true } } }
        });
    }

    // 查询评价列表
    listReviews(query: {
        page?: number;
        pageSize?: number;
        memberId?: number | undefined;
        orderNo?: string | undefined;
        ratingMin?: number | undefined;
        ratingMax?: number | undefined;
        start?: string | undefined;
        end?: string | undefined;
    }) {
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
            include: {
                order: { select: { no: true } },
                member: { select: { name: true, phone: true } }
            },
        });
    }

    // 删除评价
    async deleteReview(id: number) {
        const r = await (this.prisma as any).orderReview.findUnique({ where: { id } });
        if (!r) return null;
        
        await this.prisma.order.update({
            where: { id: r.orderId },
            data: { reviewStatus: 'NONE' as any }
        });
        
        return (this.prisma as any).orderReview.delete({ where: { id } });
    }

    // 回复评价
    async replyReview(id: number, replyContent: string, replyUserId?: number | null) {
        const updated = await (this.prisma as any).orderReview.update({
            where: { id },
            data: {
                replyContent,
                replyUserId: replyUserId ?? null,
                replyAt: new Date()
            }
        });
        
        // 时间线：商家已回复
        try {
            await this.writeTimeline({
                orderId: updated.orderId,
                event: 'REVIEW',
                value: 'REPLIED',
                operatorUserId: replyUserId ?? null
            });
        } catch { }
        
        return updated;
    }
}

// ========== 文件绑定辅助 ==========
async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]> {
    const set = new Set<string>();
    for (const u of urls) {
        if (!u) continue;
        const s = String(u).trim();
        if (!s) continue;
        set.add(s);
        try {
            if (/^https?:\/\//i.test(s)) {
                const rel = new URL(s).pathname;
                if (rel) set.add(rel);
            }
        } catch { }
    }
    const arr = Array.from(set);
    if (!arr.length) return [];
    const rows = await (prisma as any).fileAsset.findMany({
        where: { url: { in: arr } },
        select: { id: true }
    });
    return Array.isArray(rows) ? rows.map((r: any) => String(r.id)) : [];
}

OrderReviewService.prototype['syncBindings'] = async function (this: OrderReviewService, tableName: string, rowId: string, fieldName: string, urls: string[]) {
    try {
        const desired = new Set<string>(await getAssetIdsFromUrls(this['prisma'], urls));
        const existing: any[] = await (this['prisma'] as any).fileBinding.findMany({
            where: { tableName, rowId: String(rowId), fieldName }
        });
        for (const b of existing) {
            if (!desired.has(String(b.fileId))) {
                try {
                    await this['assets']?.unbindReference(String(b.fileId), String(b.id));
                } catch { }
            }
        }
        for (const fid of desired) {
            const ok = existing.find((b: any) => String(b.fileId) === fid);
            if (!ok) {
                try {
                    await this['assets']?.bindReference(String(fid), {
                        tableName,
                        rowId: String(rowId),
                        fieldName
                    });
                } catch { }
            }
        }
    } catch { }
};
