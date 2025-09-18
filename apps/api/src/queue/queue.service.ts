import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VehicleService } from '../member/vehicle.service.js';
import { NotificationService } from '../notification/notification.service.js';

type CreateQueueInput =
    | { mode: 'vehicleId'; vehicleId: number; queueTypeId?: number | undefined }
    | { mode: 'plateExisting'; plateNumber: string; queueTypeId?: number | undefined }
    | { mode: 'guest'; plateNumber: string; vin?: string | null; typeMain?: string; typeSub?: string | null; color?: string | null; brand?: string | null; series?: string | null; brandId?: number | null; seriesId?: number | null; queueTypeId?: number | undefined };

@Injectable()
export class QueueService {
    constructor(
        private prisma: PrismaService, 
        private vehicleService: VehicleService,
        private notifier: NotificationService
    ) {}

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
            // 统一入队为未开始，需要人工点击“开始第一步”
            const currentTaskIndex = -1; // 若已有车辆或队列为空，均保持未开始
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
            where: { status: { in: ['IN_QUEUE', 'SERVING', 'COMPLETED'] as any } },
            orderBy: { orderSort: 'asc' },
            include: {
                tasks: { orderBy: { orderIndex: 'asc' } },
                vehicle: { include: { member: true, group: true } },
                queueType: { include: { steps: { orderBy: { orderIndex: 'asc' } } } }
            },
        });
        const basicDecorated = items.map((it, idx) => this.decorateComputed(it, idx, items));
        return this.decorateEta(basicDecorated);
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
                
                // 添加服务完成通知
                try{
                    const ord:any = await this.prisma.order.findUnique({ where: { id: (item as any).orderId }, select: { id:true, no:true, memberId:true, updatedAt:true } });
                    const endAt = (()=>{ try{ const d = now; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; }catch{return '';} })();
                    await this.notifier.sendByTemplate('SERVICE_DONE', { no: ord?.no, id: ord?.id, endAt }, { kind:'MEMBER', memberId: Number(ord?.memberId||0) }, { title:'服务已完成', content:`订单 ${ord?.no||''} 服务已完成。` }, `/pages/order/detail?id=${ord?.id}`);
                }catch{}
            }
        } catch {}
        return updated;
    }

    async remove(queueItemId: number) {
        return this.prisma.$transaction(async (tx) => {
            const item = await tx.serviceQueueItem.findUnique({ where: { id: queueItemId } });
            if (item && item.orderId) {
                const order = await tx.order.findUnique({ where: { id: item.orderId } });
                if (order && (order as any).type === 'SERVICE' && (order as any).payStatus === 'UNPAID') {
                    // 同步取消未支付的服务订单
                    await this.cancelUnpaidOrderTx(tx, order.id);
                }
            }
            await tx.serviceTask.deleteMany({ where: { queueItemId } });
            return tx.serviceQueueItem.delete({ where: { id: queueItemId } });
        });
    }

    private async cancelUnpaidOrderTx(tx: any, orderId: number){
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order || (order as any).payStatus !== 'UNPAID') return;
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const it of items) {
            if (!it.productId) continue;
            const product = await tx.product.findUnique({ where: { id: it.productId } });
            if (!product) continue;
            if (product.type === 'PHYSICAL' || product.type === 'VIRTUAL_CARD') {
                const qty = Math.max(1, Number(it.quantity || 0));
                if (product.specType === 'MULTI') {
                    if (!it.skuId) continue;
                    const beforeRow = await tx.productSku.findUnique({ where: { id: it.skuId }, select: { stockQuantity: true } });
                    const before = Number(beforeRow?.stockQuantity || 0);
                    await tx.productSku.update({ where: { id: it.skuId }, data: { stockQuantity: { increment: qty } } });
                    const after = before + qty;
                    await tx.inventoryLog.create({ data: { productId: product.id, skuId: it.skuId, change: qty, beforeStock: before, afterStock: after, reason: 'ORDER_ROLLBACK' as any, remark: '队列移除取消订单回滚库存', operatorUserId: null } });
                } else {
                    const beforeRow = await tx.product.findUnique({ where: { id: product.id }, select: { stockQuantity: true } });
                    const before = Number(beforeRow?.stockQuantity || 0);
                    await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { increment: qty } } });
                    const after = before + qty;
                    await tx.inventoryLog.create({ data: { productId: product.id, skuId: null, change: qty, beforeStock: before, afterStock: after, reason: 'ORDER_ROLLBACK' as any, remark: '队列移除取消订单回滚库存', operatorUserId: null } });
                }
            }
        }
        await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' as any, payStatus: 'CANCELLED' as any, remark: '队列移除同步取消订单' } });
        try { await (tx as any).orderTimeline.create({ data: { orderId, event: 'ORDER_STATUS', value: 'CANCELLED', remark: '队列移除', operatorUserId: null } }); } catch {}
        try { await (tx as any).orderTimeline.create({ data: { orderId, event: 'PAY_STATUS', value: 'CANCELLED', remark: '队列移除', operatorUserId: null } }); } catch {}
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
        const idx = typeof item.currentTaskIndex === 'number' ? item.currentTaskIndex : -1;
        const tasks = (item.tasks || []).sort((a: any, b: any) => a.orderIndex - b.orderIndex);
        let total = 0;
        for (let i = 0; i < tasks.length; i++) {
            const t = tasks[i];
            // 基于任务状态估算：DONE 不计入，其余按完整时长估算
            if (String(t?.status || '') === 'DONE') continue;
            total += Number(t.durationMin || 0);
        }
        return total;
    }

    // ===== ETA 计算扩展 =====
    private decorateEta(all: any[]) {
        // 预构建组级统计：仅面向“已配置且参与”的项
        interface GroupStat { totalRemaining: number; doingCount: number; types: Record<number, { parallelSlots: number | null }>; }
        const groupStats = new Map<string, GroupStat>();
        const etaStepIndexCache = new Map<number, Set<number>>(); // typeId -> eta step indexes

        const getEtaIndexes = (type: any): Set<number> => {
            const key = Number(type?.id || 0);
            if (!key) return new Set();
            if (etaStepIndexCache.has(key)) return etaStepIndexCache.get(key)!;
            const set = new Set<number>();
            const steps = Array.isArray(type?.steps) ? type.steps : [];
            for (const s of steps) { if (s && s.isEta === true) set.add(Number(s.orderIndex || 0)); }
            etaStepIndexCache.set(key, set);
            return set;
        };

        const isConfiguredAndParticipate = (type: any): { configured: boolean; excluded: boolean; parallel: number | null; groupKey: string } => {
            const participate = (type?.participateInEta === true);
            const excluded = (type?.participateInEta === false);
            const parallelSlots = Number.isFinite(type?.etaParallelSlots) ? Number(type.etaParallelSlots) : null;
            const etaIdx = getEtaIndexes(type);
            const configured = participate && !!parallelSlots && parallelSlots! > 0 && etaIdx.size > 0;
            const groupKey: string = String(type?.etaGroupKey || `TYPE:${type?.id || 'NA'}`);
            return { configured, excluded, parallel: configured ? (parallelSlots as number) : (parallelSlots ?? null), groupKey };
        };

        // 构建组统计
        for (const it of all) {
            const type = (it as any).queueType || null;
            const { configured, excluded, groupKey } = isConfiguredAndParticipate(type);
            if (!configured || excluded) continue;
            const etaIdx = getEtaIndexes(type);
            const tasks = Array.isArray(it?.tasks) ? it.tasks : [];
            let remain = 0; let doing = 0;
            for (const t of tasks) {
                const idx = Number(t?.orderIndex || 0);
                if (!etaIdx.has(idx)) continue;
                const status = String(t?.status || '');
                if (status === 'DONE') continue;
                remain += Number(t?.durationMin || 0);
                if (status === 'DOING') doing += 1;
            }
            const stat = groupStats.get(groupKey) || { totalRemaining: 0, doingCount: 0, types: {} };
            stat.totalRemaining += remain;
            stat.doingCount += doing;
            const tid = Number(type?.id || 0);
            if (tid && !(tid in stat.types)) stat.types[tid] = { parallelSlots: Number.isFinite(type?.etaParallelSlots) ? Number(type.etaParallelSlots) : null };
            groupStats.set(groupKey, stat);
        }

        // 逐项注入 ETA 字段
        return all.map((it, index) => {
            const type = (it as any).queueType || null;
            const { configured, excluded, parallel, groupKey } = isConfiguredAndParticipate(type);
            const etaIdx = getEtaIndexes(type);
            const tasks = Array.isArray(it?.tasks) ? it.tasks : [];
            // 本车 ETA 剩余：仅 ETA 步骤且未 DONE
            let remainingMinutesEta = 0;
            for (const t of tasks) {
                const oi = Number(t?.orderIndex || 0);
                if (!etaIdx.has(oi)) continue;
                if (String(t?.status || '') === 'DONE') continue;
                remainingMinutesEta += Number(t?.durationMin || 0);
            }
            // 计算前方等待（同组，且只看 index 之前的条目）
            let aheadEtaSum = 0;
            if (configured && !excluded) {
                for (let i = 0; i < index; i++) {
                    const prev = all[i];
                    const pType = (prev as any).queueType || null;
                    const { configured: pCfg, excluded: pEx, groupKey: pKey } = isConfiguredAndParticipate(pType);
                    if (!pCfg || pEx) continue;
                    if (pKey !== groupKey) continue;
                    const pIdx = getEtaIndexes(pType);
                    const pTasks = Array.isArray(prev?.tasks) ? prev.tasks : [];
                    for (const t of pTasks) {
                        const oi = Number(t?.orderIndex || 0);
                        if (!pIdx.has(oi)) continue;
                        if (String(t?.status || '') === 'DONE') continue;
                        aheadEtaSum += Number(t?.durationMin || 0);
                    }
                }
            }
            let aheadMinutesEta = aheadEtaSum;
            // 并行位修正：若同组 doing 小于并行位，则新车无需等待
            if (configured && !excluded && typeof parallel === 'number' && parallel > 0) {
                const stat = groupStats.get(groupKey) || { totalRemaining: 0, doingCount: 0, types: {} };
                if (stat.doingCount < parallel) {
                    aheadMinutesEta = 0;
                } else {
                    aheadMinutesEta = Math.max(0, Math.ceil(aheadEtaSum / parallel));
                }
            }
            const etaNote = configured && !excluded ? `仅计算已勾选ETA步骤；资源组=${String(type?.etaGroupKey || `TYPE:${type?.id||'NA'}`)}；并行=${typeof parallel==='number'?parallel:'未配'}` : undefined;
            return { ...it, excludedFromEta: !!excluded, etaConfigured: !!configured, aheadMinutesEta, remainingMinutesEta, etaNote };
        });
    }

    async etaSummaryByType() {
        // 取所有启用类型
        const types = await (this.prisma as any).serviceQueueType.findMany({
            orderBy: [{ sortWeight: 'desc' }, { id: 'asc' }],
            include: { steps: { orderBy: { orderIndex: 'asc' } } }
        });
        // 取活跃队列项
        const items = await this.prisma.serviceQueueItem.findMany({
            where: { status: { in: ['IN_QUEUE', 'SERVING', 'COMPLETED'] as any } },
            include: { tasks: true, queueType: { include: { steps: { orderBy: { orderIndex: 'asc' } } } } }
        });

        const etaIdxCache = new Map<number, Set<number>>();
        const getIdx = (t: any) => {
            const id = Number(t?.id || 0);
            if (!id) return new Set<number>();
            if (etaIdxCache.has(id)) return etaIdxCache.get(id)!;
            const set = new Set<number>();
            for (const s of (t?.steps || [])) { if (s?.isEta === true) set.add(Number(s.orderIndex||0)); }
            etaIdxCache.set(id, set); return set;
        };

        // 组统计
        interface G { totalRemaining: number; doingCount: number; }
        const groupMap = new Map<string, G>();
        for (const it of items) {
            const type = (it as any).queueType;
            if (!type) continue;
            const participate = (type?.participateInEta === true);
            const excluded = (type?.participateInEta === false);
            const parallelSlots = Number.isFinite(type?.etaParallelSlots) ? Number(type.etaParallelSlots) : null;
            const idxs = getIdx(type);
            const configured = participate && !!parallelSlots && parallelSlots! > 0 && idxs.size > 0;
            if (!configured || excluded) continue;
            const gk = String(type?.etaGroupKey || `TYPE:${type?.id}`);
            let rem = 0, doing = 0;
            for (const t of (it as any).tasks || []) {
                const oi = Number(t?.orderIndex || 0);
                if (!idxs.has(oi)) continue;
                const status = String(t?.status || '');
                if (status === 'DONE') continue;
                rem += Number(t?.durationMin || 0);
                if (status === 'DOING') doing += 1;
            }
            const g = groupMap.get(gk) || { totalRemaining: 0, doingCount: 0 };
            g.totalRemaining += rem; g.doingCount += doing; groupMap.set(gk, g);
        }

        // 汇总到类型维度（顶部按类型展示，但值来自其组）
        const result = types.map((t: any) => {
            const participate = (t?.participateInEta === true);
            const excluded = (t?.participateInEta === false);
            const idxs = getIdx(t);
            const parallel = Number.isFinite(t?.etaParallelSlots) ? Number(t.etaParallelSlots) : null;
            const configured = participate && !!parallel && parallel! > 0 && idxs.size > 0;
            const gk = String(t?.etaGroupKey || `TYPE:${t?.id}`);
            const g = groupMap.get(gk) || { totalRemaining: 0, doingCount: 0 };
            let etaForNewCar: number | null = null;
            if (configured && !excluded) {
                if ((g.doingCount || 0) < (parallel as number)) etaForNewCar = 0;
                else etaForNewCar = Math.max(0, Math.ceil((g.totalRemaining || 0) / (parallel as number)));
            }
            const tips = configured && !excluded ? `资源组=${gk}；并行=${parallel}; 步骤数(ETA)=${idxs.size}` : (excluded ? '不计入预计等待' : '未配置ETA');
            return { typeId: t.id, typeName: t.name, displayColor: t.displayColor || null, etaConfigured: !!configured, excludedFromEta: !!excluded, etaForNewCar, tips };
        });
        return result;
    }
}


