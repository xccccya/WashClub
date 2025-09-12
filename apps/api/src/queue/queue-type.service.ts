import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class QueueTypeService {
    constructor(private prisma: PrismaService) {}

    async list() {
        const types = await (this.prisma as any).serviceQueueType.findMany({
            orderBy: [{ sortWeight: 'desc' }, { id: 'asc' }],
            include: {
                steps: { orderBy: { orderIndex: 'asc' } },
                products: { include: { product: true } }
            }
        } as any);
        return types;
    }

    async create(input: { name: string; enabled?: boolean; sortWeight?: number; remark?: string | null; participateInEta?: boolean | null; etaParallelSlots?: number | null; etaGroupKey?: string | null; displayColor?: string | null }) {
        const name = String(input?.name || '').trim();
        if (!name) throw new BadRequestException('名称为必填');
        const enabled = !!(input?.enabled ?? true);
        const sortWeight = Number.isFinite(input?.sortWeight) ? Number(input?.sortWeight) : 0;
        const remark = input?.remark ?? null;
        const participateInEta = typeof input?.participateInEta === 'boolean' ? !!input.participateInEta : null;
        const etaParallelSlots = Number.isFinite(input?.etaParallelSlots) ? Number(input?.etaParallelSlots) : null;
        const etaGroupKey = typeof input?.etaGroupKey === 'string' ? (String(input?.etaGroupKey).trim() || null) : null;
        const displayColor = typeof input?.displayColor === 'string' ? (String(input?.displayColor).trim() || null) : null;
        return (this.prisma as any).serviceQueueType.create({ data: { name, enabled, sortWeight, remark, participateInEta, etaParallelSlots, etaGroupKey, displayColor } });
    }

    async update(id: number, input: { name?: string; enabled?: boolean; sortWeight?: number; remark?: string | null; participateInEta?: boolean | null; etaParallelSlots?: number | null; etaGroupKey?: string | null; displayColor?: string | null }) {
        const data: any = {};
        if (typeof input?.name === 'string') data.name = String(input.name).trim();
        if (typeof input?.enabled === 'boolean') data.enabled = !!input.enabled;
        if (typeof input?.sortWeight === 'number') data.sortWeight = Number(input.sortWeight);
        if (typeof input?.remark !== 'undefined') data.remark = input.remark ?? null;
        if (typeof input?.participateInEta !== 'undefined') data.participateInEta = input.participateInEta === null ? null : !!input.participateInEta;
        if (typeof input?.etaParallelSlots !== 'undefined') data.etaParallelSlots = Number.isFinite(input?.etaParallelSlots as any) ? Number(input?.etaParallelSlots as any) : null;
        if (typeof input?.etaGroupKey !== 'undefined') data.etaGroupKey = typeof input?.etaGroupKey === 'string' ? (String(input.etaGroupKey).trim() || null) : null;
        if (typeof input?.displayColor !== 'undefined') data.displayColor = typeof input?.displayColor === 'string' ? (String(input.displayColor).trim() || null) : null;
        if (Object.keys(data).length === 0) throw new BadRequestException('无更新项');
        return (this.prisma as any).serviceQueueType.update({ where: { id }, data });
    }

    async remove(id: number) {
        const count = await (this.prisma as any).serviceQueueItem.count({ where: { queueTypeId: id } });
        if (count > 0) throw new BadRequestException('该队列类型仍被队列项引用，无法删除');
        await (this.prisma as any).serviceQueueStep.deleteMany({ where: { queueTypeId: id } });
        await (this.prisma as any).serviceQueueTypeProduct.deleteMany({ where: { queueTypeId: id } });
        return (this.prisma as any).serviceQueueType.delete({ where: { id } });
    }

    async setSteps(id: number, steps: Array<{ orderIndex: number; name: string; durationMin: number; isEta?: boolean | null }>) {
        if (!Array.isArray(steps) || steps.length === 0) throw new BadRequestException('步骤不能为空');
        if (steps.length > 10) throw new BadRequestException('步骤数建议≤10');
        const normalized = steps.map((s, i) => ({
            orderIndex: Number.isFinite(s.orderIndex) ? Number(s.orderIndex) : i,
            name: String(s.name || '').trim(),
            durationMin: Math.max(0, Math.min(120, Math.floor(Number(s.durationMin || 0)))),
            isEta: typeof s.isEta === 'boolean' ? !!s.isEta : null
        }));
        if (normalized.some(s => !s.name)) throw new BadRequestException('步骤名不能为空');
        return (this.prisma as any).$transaction(async (tx: any) => {
            await tx.serviceQueueStep.deleteMany({ where: { queueTypeId: id } });
            for (const s of normalized) {
                await tx.serviceQueueStep.create({ data: { queueTypeId: id, orderIndex: s.orderIndex, name: s.name, durationMin: s.durationMin, isEta: s.isEta } });
            }
            return tx.serviceQueueType.findUnique({ where: { id }, include: { steps: { orderBy: { orderIndex: 'asc' } } } } as any);
        });
    }

    async setProducts(id: number, productIds: number[]) {
        const ids = (Array.isArray(productIds) ? productIds : []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
        if (ids.length > 100) throw new BadRequestException('可选商品数量建议≤100');
        const products = await (this.prisma as any).product.findMany({ where: { id: { in: ids } }, select: { id: true, type: true } });
        if (products.some(p => p.type !== 'SERVICE')) throw new BadRequestException('仅允许绑定服务类商品');
        return (this.prisma as any).$transaction(async (tx: any) => {
            await tx.serviceQueueTypeProduct.deleteMany({ where: { queueTypeId: id } });
            for (const pid of ids) {
                await tx.serviceQueueTypeProduct.create({ data: { queueTypeId: id, productId: pid } });
            }
            return tx.serviceQueueType.findUnique({ where: { id }, include: { products: { include: { product: true } } } } as any);
        });
    }
}


