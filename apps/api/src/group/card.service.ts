import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class GroupCardService {
  constructor(private prisma: PrismaService) {}

  async list(groupId: number) {
    return this.prisma.groupWashCard.findMany({ where: { groupId }, orderBy: { id: 'desc' } });
  }

  async create(groupId: number, input: { name?: string | null; totalTimes: number; remainingTimes?: number | null; expiryAt?: string | null; cardNo?: string | null }) {
    const total = Number(input?.totalTimes || 0);
    const initialRemain = input?.remainingTimes == null ? total : Number(input.remainingTimes);
    if (!Number.isInteger(total) || total <= 0) throw new BadRequestException('总次数必须为正整数');
    return this.prisma.$transaction(async (tx) => {
      const g = await tx.group.findUnique({ where: { id: groupId } });
      if (!g) throw new BadRequestException('集团不存在');
      const cardNo = await this.generateCardNo(tx);
      const card = await tx.groupWashCard.create({ data: { groupId, name: input?.name || '集团洗车计次卡', totalTimes: total, remainingTimes: Math.max(0, initialRemain), status: 'ACTIVE' as any, expiryAt: input?.expiryAt ? new Date(input.expiryAt) : null, cardNo: input?.cardNo || cardNo } });
      if (initialRemain > 0) {
        await tx.groupWashCardLog.create({ data: { cardId: card.id, action: 'ADD' as any, reason: 'BACKEND_ADD' as any, change: initialRemain, beforeRemaining: 0, afterRemaining: Math.max(0, initialRemain), remark: '后台创建卡并设置初始次数' } });
      }
      return card;
    });
  }

  async addTimes(cardId: number, count: number, opts?: { remark?: string | null; operatorUserId?: number | null }) {
    const qty = Number(count || 0);
    if (!Number.isInteger(qty) || qty <= 0) throw new BadRequestException('增加次数必须为正整数');
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.groupWashCard.findUnique({ where: { id: cardId } });
      if (!card) throw new BadRequestException('卡不存在');
      if (card.status !== 'ACTIVE') throw new BadRequestException('卡不可用');
      const before = card.remainingTimes;
      const after = before + qty;
      const updated = await tx.groupWashCard.update({ where: { id: card.id }, data: { remainingTimes: after, totalTimes: Math.max(card.totalTimes, after) } });
      await tx.groupWashCardLog.create({
        data: {
          cardId: card.id,
          action: 'ADD' as any,
          reason: 'BACKEND_ADD' as any,
          change: qty,
          beforeRemaining: before,
          afterRemaining: after,
          remark: opts?.remark || null,
          operatorUserId: opts?.operatorUserId ?? null,
        }
      });
      return updated;
    });
  }

  async consume(cardId: number, times: number, opts?: { reason?: 'SERVICE_DEDUCT'|'REFUND_DEDUCT'|'BACKEND_DEDUCT'; vehicleId?: number | null; memberId?: number | null; remark?: string | null; operatorUserId?: number | null; serviceOrderId?: number | null; refundRecordId?: number | null; purchaseOrderId?: number | null }) {
    const qty = Number(times || 0);
    if (!Number.isInteger(qty) || qty <= 0) throw new BadRequestException('扣减次数必须为正整数');
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.groupWashCard.findUnique({ where: { id: cardId } });
      if (!card) throw new BadRequestException('卡不存在');
      if (card.status !== 'ACTIVE') throw new BadRequestException('卡不可用');
      if (card.expiryAt && new Date(card.expiryAt).getTime() < Date.now()) throw new BadRequestException('卡已过期');
      if (card.remainingTimes < qty) throw new BadRequestException('余次不足');
      const before = card.remainingTimes;
      const after = before - qty;
      const updated = await tx.groupWashCard.update({ where: { id: card.id }, data: { remainingTimes: after } });
      // 预取订单号（若提供了对应ID）
      let serviceOrderNo: string | null = null;
      let purchaseOrderNo: string | null = null;
      try { if (opts?.serviceOrderId) { const o:any = await tx.order.findUnique({ where: { id: opts.serviceOrderId }, select: { no: true } }); serviceOrderNo = o?.no || null; } } catch {}
      try { if (opts?.purchaseOrderId) { const o:any = await tx.order.findUnique({ where: { id: opts.purchaseOrderId }, select: { no: true } }); purchaseOrderNo = o?.no || null; } } catch {}
      await tx.groupWashCardLog.create({
        data: {
          cardId: card.id,
          action: 'DEDUCT' as any,
          reason: (opts?.reason || 'SERVICE_DEDUCT') as any,
          change: -qty,
          beforeRemaining: before,
          afterRemaining: after,
          remark: opts?.remark || null,
          vehicleId: opts?.vehicleId ?? null,
          memberId: opts?.memberId ?? null,
          operatorUserId: opts?.operatorUserId ?? null,
          serviceOrderId: opts?.serviceOrderId ?? null,
          serviceOrderNo,
          refundRecordId: opts?.refundRecordId ?? null,
          purchaseOrderId: opts?.purchaseOrderId ?? null,
          purchaseOrderNo,
        } as any
      });
      return updated;
    });
  }

  async remove(groupId: number, cardId: number) {
    // 限制：仅允许删除本集团下的卡，且建议仅在未使用或归档时删除（此处不强校验使用次数，由业务方控制）
    const card = await this.prisma.groupWashCard.findUnique({ where: { id: cardId } });
    if (!card) throw new BadRequestException('卡不存在');
    if (card.groupId !== groupId) throw new BadRequestException('无权删除其他集团的卡');
    // 强校验：已使用过（剩余 < 总次数）不允许删除，避免账实不符
    if (Number(card.remainingTimes) < Number(card.totalTimes)) {
      throw new BadRequestException('该卡已使用，禁止删除。请改为停用/归档处理');
    }
    // 直接级联删除日志（模型上 onDelete: Cascade 已配置）
    await this.prisma.groupWashCard.delete({ where: { id: cardId } });
    return { ok: true } as const;
  }

  async listLogs(cardId: number, page = 1, pageSize = 10) {
    const p = Math.max(1, Number(page || 1));
    const ps = Math.max(1, Math.min(100, Number(pageSize || 10)));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.groupWashCardLog.count({ where: { cardId } }),
      this.prisma.groupWashCardLog.findMany({ where: { cardId }, orderBy: { id: 'desc' }, skip: (p - 1) * ps, take: ps, include: { member: { select: { id: true, name: true, phone: true } }, vehicle: { select: { id: true, plateNumber: true } } } as any })
    ]);
    const serviceIds = (rows || []).map((r:any)=> r.serviceOrderId).filter((v:any)=> typeof v==='number');
    const purchaseIds = (rows || []).map((r:any)=> r.purchaseOrderId).filter((v:any)=> typeof v==='number');
    const uniq = (arr:number[]) => Array.from(new Set(arr));
    const [serviceOrders, purchaseOrders] = await Promise.all([
      serviceIds.length ? this.prisma.order.findMany({ where: { id: { in: uniq(serviceIds) } }, select: { id:true, no:true } }) : Promise.resolve([]),
      purchaseIds.length ? this.prisma.order.findMany({ where: { id: { in: uniq(purchaseIds) } }, select: { id:true, no:true } }) : Promise.resolve([]),
    ]);
    const toMap = (list:any[])=>{ const m = new Map<number,string>(); for (const it of (list||[])) { if (typeof it?.id==='number') m.set(it.id, String(it.no||'')); } return m; };
    const serviceMap = toMap(serviceOrders as any);
    const purchaseMap = toMap(purchaseOrders as any);
    const items = (Array.isArray(rows)?rows:[]).map((r:any)=> ({
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      reason: r.reason,
      change: r.change,
      beforeRemaining: r.beforeRemaining,
      afterRemaining: r.afterRemaining,
      remark: r.remark,
      vehicle: r.vehicle || null,
      member: r.member || null,
      serviceOrderId: r.serviceOrderId || null,
      purchaseOrderId: r.purchaseOrderId || null,
      serviceOrderNo: r.serviceOrderNo || serviceMap.get(r.serviceOrderId) || null,
      purchaseOrderNo: r.purchaseOrderNo || purchaseMap.get(r.purchaseOrderId) || null,
    }));
    return { total, page: p, pageSize: ps, items } as any;
  }

  private async generateCardNo(tx: PrismaClient | Prisma.TransactionClient) {
    let seq = 1;
    while (true) {
      const no = String(Math.floor(10000000 + Math.random() * 90000000));
      const exists = await tx.groupWashCard.findFirst({ where: { cardNo: no } });
      if (!exists) return no;
      seq++;
      if (seq > 100000) throw new Error('卡号生成失败');
    }
  }
}
