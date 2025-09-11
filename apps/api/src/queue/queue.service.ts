import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VehicleService } from '../member/vehicle.service.js';

type CreateQueueInput =
    | { mode: 'vehicleId'; vehicleId: number; queueTypeId?: number | undefined }
    | { mode: 'plateExisting'; plateNumber: string; queueTypeId?: number | undefined }
    | { mode: 'guest'; plateNumber: string; vin?: string | null; typeMain?: string; typeSub?: string | null; color?: string | null; brand?: string | null; series?: string | null; brandId?: number | null; seriesId?: number | null; queueTypeId?: number | undefined };

@Injectable()
export class QueueService {
    constructor(private prisma: PrismaService, private vehicleService: VehicleService) {}

    async addToQueue(input: CreateQueueInput) {
        let vehicleId: number | null = null;
        let plateNumber: string;
        let guest = false;
        const desiredQueueTypeId = (input as any)?.queueTypeId ? Number((input as any).queueTypeId) : undefined;

        if (input.mode === 'vehicleId') {
            const v = await this.prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
            if (!v) throw new BadRequestException('车辆不存在');
            vehicleId = v.id;
            plateNumber = v.plateNumber;
            guest = !v.memberId;
        } else if (input.mode === 'plateExisting') {
            const v = await this.prisma.vehicle.findUnique({ where: { plateNumber: input.plateNumber.trim() } });
            if (!v) throw new BadRequestException('未找到该车牌对应的车辆');
            vehicleId = v.id;
            plateNumber = v.plateNumber;
            guest = !v.memberId;
        } else {
            // guest create vehicle
            const created = await this.vehicleService.createGuestVehicle({
                plateNumber: input.plateNumber,
                vin: input.vin || undefined,
                typeMain: input.typeMain || '-',
                typeSub: input.typeSub || undefined,
                color: input.color || undefined,
                brand: input.brand || undefined,
                series: input.series || undefined,
                brandId: input.brandId || undefined,
                seriesId: input.seriesId || undefined,
            });
            vehicleId = created.id;
            plateNumber = created.plateNumber;
            guest = true;
        }

        // 重复检测：相同 vehicleId 或相同车牌在进行中/排队中
        const orConds: any[] = [{ plateNumber }];
        if (vehicleId) orConds.push({ vehicleId });
        const existed = await this.prisma.serviceQueueItem.findFirst({
            where: { status: { in: ['IN_QUEUE', 'SERVING'] as any }, OR: orConds },
        });
        if (existed) throw new BadRequestException('该车辆已在服务队列中');

        const created = await this.prisma.$transaction(async (tx) => {
            // 选取队列类型与步骤（若未显式指定，则选择启用的首个类型；若仍无则回退固定三步）
            let qtype: any = null;
            if (desiredQueueTypeId) {
                qtype = await (tx as any).serviceQueueType.findUnique({
                    where: { id: desiredQueueTypeId },
                    include: { steps: { orderBy: { orderIndex: 'asc' } } }
                });
            }
            if (!qtype) {
                qtype = await (tx as any).serviceQueueType.findFirst({
                    where: { enabled: true },
                    orderBy: [{ sortWeight: 'desc' }, { id: 'asc' }],
                    include: { steps: { orderBy: { orderIndex: 'asc' } } }
                });
            }

            const orderSort = await tx.serviceQueueItem.count();
            const currentTaskIndex = orderSort > 0 ? -1 : 0; // 若已有车辆，则新车未开始
            const item = await tx.serviceQueueItem.create({
                data: {
                    vehicleId: vehicleId || undefined,
                    plateNumber,
                    guest,
                    orderSort,
                    currentTaskIndex,
                    queueTypeId: qtype?.id || undefined,
                    tasks: {
                        create: (Array.isArray(qtype?.steps) && qtype.steps.length > 0)
                            ? qtype.steps.map((s: any) => ({ name: s.name, durationMin: s.durationMin, orderIndex: s.orderIndex }))
                            : [
                                { name: '外表清洗 I', durationMin: 5, orderIndex: 0 },
                                { name: '外表清洗 II', durationMin: 5, orderIndex: 1 },
                                { name: '内饰清洁', durationMin: 10, orderIndex: 2 },
                            ],
                    },
                },
                include: { tasks: true, vehicle: true },
            });
            return item;
        });

        return created;
    }

    async listActive() {
        const items = await this.prisma.serviceQueueItem.findMany({
            where: { status: { in: ['IN_QUEUE', 'SERVING'] as any } },
            orderBy: { orderSort: 'asc' },
            include: { tasks: { orderBy: { orderIndex: 'asc' } }, vehicle: { include: { member: true, group: true } } },
        });
        return items.map((it, idx) => this.decorateComputed(it, idx, items));
    }

    async summary() {
        const [serving, waiting] = await Promise.all([
            this.prisma.serviceQueueItem.count({ where: { status: 'SERVING' as any } }),
            this.prisma.serviceQueueItem.count({ where: { status: 'IN_QUEUE' as any } }),
        ]);
        return { servingCars: serving, waitingCars: waiting };
    }

    async setCurrentTask(queueItemId: number, taskIndex: number) {
        const item = await this.prisma.serviceQueueItem.findUnique({ where: { id: queueItemId }, include: { tasks: { orderBy: { orderIndex: 'asc' } } } });
        if (!item) throw new BadRequestException('队列项不存在');
        if ((item.currentTaskIndex as any) < 0) throw new BadRequestException('尚未开始，不能切换流程');
        if (taskIndex < 0 || taskIndex >= item.tasks.length) throw new BadRequestException('任务序号无效');
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            // 将小于目标索引的任务置为 DONE（仅补齐未完成的 finishedAt）
            for (let i = 0; i < taskIndex; i++) {
                await tx.serviceTask.updateMany({ where: { queueItemId, orderIndex: i }, data: { status: 'DONE' as any } });
                await tx.serviceTask.updateMany({ where: { queueItemId, orderIndex: i, finishedAt: null as any }, data: { finishedAt: now } });
            }
            // 目标任务置为 DOING（保留已存在 startedAt）
            const current = item.tasks.find((t: any) => t.orderIndex === taskIndex);
            await tx.serviceTask.updateMany({ where: { queueItemId, orderIndex: taskIndex }, data: { status: 'DOING' as any, startedAt: current?.startedAt || now } });
            const updated = await tx.serviceQueueItem.update({ where: { id: queueItemId }, data: { currentTaskIndex: taskIndex, status: 'SERVING' as any, startedAt: item.startedAt || now } });
            // 联动订单履约状态
            try {
                if ((item as any).orderId) {
                    await tx.order.update({ where: { id: (item as any).orderId }, data: { fulfillmentStatus: 'IN_SERVICE' as any } });
                    try { await (tx as any).orderTimeline.create({ data: { orderId: (item as any).orderId, event: 'FULFILLMENT', value: 'IN_SERVICE' } }); } catch {}
                }
            } catch {}
            return updated;
        });
    }

    async finishCurrentTask(queueItemId: number) {
        const item = await this.prisma.serviceQueueItem.findUnique({ where: { id: queueItemId }, include: { tasks: { orderBy: { orderIndex: 'asc' } } } });
        if (!item) throw new BadRequestException('队列项不存在');
        if ((item.currentTaskIndex as any) < 0) throw new BadRequestException('尚未开始，不能完成当前流程');
        const idx = item.currentTaskIndex || 0;
        const now = new Date();
        const hasNext = idx + 1 < item.tasks.length;
        return this.prisma.$transaction(async (tx) => {
            await tx.serviceTask.updateMany({ where: { queueItemId, orderIndex: idx }, data: { status: 'DONE' as any, finishedAt: now } });
            if (hasNext) {
                await tx.serviceTask.updateMany({ where: { queueItemId, orderIndex: idx + 1 }, data: { status: 'DOING' as any, startedAt: now } });
                return tx.serviceQueueItem.update({ where: { id: queueItemId }, data: { currentTaskIndex: idx + 1, status: 'SERVING' as any } });
            } else {
                // 等待人工确认完成
                return tx.serviceQueueItem.update({ where: { id: queueItemId }, data: { currentTaskIndex: idx, status: 'SERVING' as any } });
            }
        });
    }

    async confirmComplete(queueItemId: number) {
        const item = await this.prisma.serviceQueueItem.findUnique({ where: { id: queueItemId }, include: { tasks: true } });
        if (!item) throw new BadRequestException('队列项不存在');
        if ((item.currentTaskIndex as any) < 0) throw new BadRequestException('尚未开始，不能结束');
        const now = new Date();
        const updated = await this.prisma.$transaction(async (tx)=>{
            // 置所有任务为 DONE，补齐时间
            await tx.serviceTask.updateMany({ where: { queueItemId }, data: { status: 'DONE' as any, finishedAt: now } });
            return tx.serviceQueueItem.update({ where: { id: queueItemId }, data: { status: 'COMPLETED' as any, finishedAt: now } });
        });
        // 联动订单履约状态至 DONE（待支付）
        try {
            if ((item as any).orderId) {
                await this.prisma.order.update({ where: { id: (item as any).orderId }, data: { fulfillmentStatus: 'DONE' as any } });
                try { await (this.prisma as any).orderTimeline.create({ data: { orderId: (item as any).orderId, event: 'FULFILLMENT', value: 'DONE' } }); } catch {}
            }
        } catch {}
        return updated;
    }

    async remove(queueItemId: number) {
        return this.prisma.$transaction(async (tx) => {
            await tx.serviceTask.deleteMany({ where: { queueItemId } });
            return tx.serviceQueueItem.delete({ where: { id: queueItemId } });
        });
    }

    async startFirstTask(queueItemId: number) {
        const item = await this.prisma.serviceQueueItem.findUnique({ where: { id: queueItemId }, include: { tasks: true } });
        if (!item) throw new BadRequestException('队列项不存在');
        if ((item.currentTaskIndex as any) >= 0) throw new BadRequestException('已开始，无需重复开始');
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            await tx.serviceTask.updateMany({ where: { queueItemId, orderIndex: 0 }, data: { status: 'DOING' as any, startedAt: now } });
            const updated = await tx.serviceQueueItem.update({ where: { id: queueItemId }, data: { currentTaskIndex: 0, status: 'SERVING' as any, startedAt: now } });
            // 联动订单履约状态
            try {
                if ((item as any).orderId) {
                    await tx.order.update({ where: { id: (item as any).orderId }, data: { fulfillmentStatus: 'IN_SERVICE' as any } });
                    try { await (tx as any).orderTimeline.create({ data: { orderId: (item as any).orderId, event: 'FULFILLMENT', value: 'IN_SERVICE' } }); } catch {}
                }
            } catch {}
            return updated;
        });
    }
    private decorateComputed(item: any, index: number, all: any[]) {
        const ahead = all.slice(0, index);
        const aheadMinutes = ahead.reduce((sum, it) => sum + this.itemRemainingMinutes(it), 0);
        const remainingMinutes = this.itemRemainingMinutes(item) + aheadMinutes;
        return { ...item, aheadCount: ahead.length, aheadMinutes, remainingMinutes };
    }

    private itemRemainingMinutes(item: any): number {
        const idx = item.currentTaskIndex || 0;
        const tasks = (item.tasks || []).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
        let total = 0;
        for (let i = 0; i < tasks.length; i++) {
            const t = tasks[i];
            if (i < idx) continue;
            if (i === idx) {
                if (t.status === 'DONE') continue;
                // 简化：进行中的任务按剩余等于全部时长估算
                total += Number(t.durationMin || 0);
            } else {
                total += Number(t.durationMin || 0);
            }
        }
        return total;
    }
}


