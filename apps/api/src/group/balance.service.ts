import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class GroupBalanceService {
  constructor(private prisma: PrismaService) {}

  private parseYm(v?: string | null): { y: number; m: number } | null {
    const s = String(v || '').trim();
    if (!/^\d{4}-\d{2}$/.test(s)) return null;
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(5, 7));
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
    return { y, m };
  }

  private ymToStr(y: number, m: number) {
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  }

  private addMonths(ym: { y: number; m: number }, delta: number) {
    const base = ym.y * 12 + (ym.m - 1);
    const v = base + delta;
    const y = Math.floor(v / 12);
    const m = (v % 12) + 1;
    return { y, m };
  }

  private ymStartDate(ym: { y: number; m: number }) {
    // 使用本地时区构造，避免与 MySQL server time_zone 不一致导致边界月偏移
    return new Date(ym.y, ym.m - 1, 1, 0, 0, 0, 0);
  }

  async getSummary(groupId: number) {
    const acc = await this.prisma.groupBalanceAccount.findUnique({ where: { groupId } });
    return { balance: Number(acc?.balance || 0) };
  }

  async getMonthlyConsumption(
    groupId: number,
    opts?: { startMonth?: string; endMonth?: string; months?: number }
  ) {
    const now = new Date();
    const defaultEnd = { y: now.getFullYear(), m: now.getMonth() + 1 };

    const endParsed = this.parseYm(opts?.endMonth ?? null) || defaultEnd;
    const months = Math.max(1, Math.min(36, Number(opts?.months || 12)));

    const startParsed =
      this.parseYm(opts?.startMonth ?? null) || this.addMonths(endParsed, -(months - 1));

    // 规范化：保证 start <= end
    const startIndex = startParsed.y * 12 + (startParsed.m - 1);
    const endIndex = endParsed.y * 12 + (endParsed.m - 1);
    const realStart = startIndex <= endIndex ? startParsed : endParsed;
    const realEnd = startIndex <= endIndex ? endParsed : startParsed;

    const startAt = this.ymStartDate(realStart);
    const endNext = this.ymStartDate(this.addMonths(realEnd, 1)); // end 为闭区间，这里用 < endNext

    // MySQL：按月分组。仅统计“集团余额支付”产生的扣减：type=DEDUCT 且 orderId 不为空
    const rows = await this.prisma.$queryRaw<Array<{ ym: string; total: any }>>(
      Prisma.sql`
        SELECT
          DATE_FORMAT(createdAt, '%Y-%m') AS ym,
          SUM(ABS(amount)) AS total
        FROM GroupBalanceLedger
        WHERE
          groupId = ${groupId}
          AND type = 'DEDUCT'
          AND orderId IS NOT NULL
          AND createdAt >= ${startAt}
          AND createdAt < ${endNext}
        GROUP BY ym
        ORDER BY ym ASC
      `
    );

    const byYm = new Map<string, number>();
    for (const r of rows || []) {
      const ym = String((r as any)?.ym || '').trim();
      if (!ym) continue;
      const v = Number((r as any)?.total || 0);
      byYm.set(ym, Number.isFinite(v) ? v : 0);
    }

    const monthsList: Array<{ month: string; amount: number }> = [];
    const sIdx = realStart.y * 12 + (realStart.m - 1);
    const eIdx = realEnd.y * 12 + (realEnd.m - 1);
    for (let idx = sIdx; idx <= eIdx; idx++) {
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      const key = this.ymToStr(y, m);
      monthsList.push({ month: key, amount: Number(byYm.get(key) || 0) });
    }

    const total = monthsList.reduce((s, it) => s + Number(it.amount || 0), 0);
    const avg = monthsList.length ? total / monthsList.length : 0;
    const latest = monthsList.length ? monthsList[monthsList.length - 1] : null;

    return {
      startMonth: this.ymToStr(realStart.y, realStart.m),
      endMonth: this.ymToStr(realEnd.y, realEnd.m),
      total,
      avg,
      latestMonth: latest?.month || null,
      latestAmount: latest ? latest.amount : 0,
      months: monthsList,
    };
  }

  async listLedger(groupId: number, page = 1, pageSize = 20, type?: 'RECHARGE'|'DEDUCT'|'ADJUST'|'REFUND', start?: string, end?: string) {
    const where: any = { groupId };
    if (type) where.type = type as any;
    if (start) where.createdAt = { ...(where.createdAt||{}), gte: new Date(start) };
    if (end) where.createdAt = { ...(where.createdAt||{}), lte: new Date(end) };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.groupBalanceLedger.count({ where }),
      this.prisma.groupBalanceLedger.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { order: { select: { id: true, no: true } } } })
    ]);
    const items = (Array.isArray(rows) ? rows : []).map((r:any)=> ({
      id: r.id,
      createdAt: r.createdAt,
      groupId: r.groupId,
      type: r.type,
      amount: r.amount,
      orderId: r.orderId ?? (r.order?.id ?? null),
      orderNo: r.orderNo ?? (r.order?.no ?? null),
      operatorUserId: r.operatorUserId,
      note: r.note
    }));
    return { total, page, pageSize, items };
  }

  async adjust(groupId: number, amount: number, note?: string | null, operatorUserId?: number | null) {
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('金额必须为非零数字');
    return this.prisma.$transaction(async (tx) => {
      const acc = await tx.groupBalanceAccount.findUnique({ where: { groupId } });
      if (!acc) throw new BadRequestException('集团账户不存在');
      const before = new Prisma.Decimal(acc.balance as any);
      const after = new Prisma.Decimal((Number(before) + amount) as any);
      // 乐观锁
      const upd = await tx.groupBalanceAccount.updateMany({ where: { groupId, version: acc.version }, data: { balance: after, version: { increment: 1 } as any } });
      if (!upd || (upd as any).count === 0) throw new BadRequestException('余额状态已变，请重试');
      await tx.groupBalanceLedger.create({ data: { groupId, type: (amount > 0 ? 'ADJUST' : 'DEDUCT') as any, amount: new Prisma.Decimal(amount as any), operatorUserId: operatorUserId ?? null, note: note || null } });
      return { ok: true } as any;
    });
  }

  async createRechargeOrder(groupId: number, amount: number, remark?: string | null, memberIdForPayment?: number | null) {
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('金额必须为正数');
    const mId = Number(memberIdForPayment || 0);
    if (!Number.isFinite(mId) || mId <= 0) throw new BadRequestException('请选择付款会员');

    return this.prisma.$transaction(async (tx) => {
      const g = await tx.group.findUnique({ where: { id: groupId } });
      if (!g) throw new BadRequestException('集团不存在');
      const member = await tx.member.findUnique({ where: { id: mId } });
      if (!member) throw new BadRequestException('付款会员不存在');

      // 创建 FK 付款订单，挂载 groupId；后续支付回调再入账集团余额
      const orderNo = await this.generateOrderNo(tx);
      const yyyy = new Date().getFullYear();
      const MM = String(new Date().getMonth() + 1).padStart(2, '0');
      const dd = String(new Date().getDate()).padStart(2, '0');
      const HH = String(new Date().getHours()).padStart(2, '0');
      const mm = String(new Date().getMinutes()).padStart(2, '0');
      const ss = String(new Date().getSeconds()).padStart(2, '0');
      const ts = `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
      const amountText = Number(amount).toFixed(2);
      const sysRemark = `管理代为${member?.name || ''}下单“${g.name}”集团余额账户充值¥${amountText}${remark ? `。${remark}` : ''}`;
      const order = await tx.order.create({
        data: ({
          no: orderNo,
          type: 'FK' as any,
          status: 'CREATED' as any,
          fulfillmentStatus: 'NONE' as any,
          totalAmount: new Prisma.Decimal(amount as any),
          discountAmount: new Prisma.Decimal(0 as any),
          memberDiscountAmount: new Prisma.Decimal(0 as any),
          payAmount: new Prisma.Decimal(amount as any),
          shippingFee: new Prisma.Decimal(0 as any),
          payStatus: 'UNPAID' as any,
          memberId: member.id,
          groupId: groupId,
          paymentExpireAt: new Date(Date.now() + 15 * 60 * 1000),
          userRemark: null,
          paymentNote: sysRemark,
        } as any)
      });
      // 时间线：创建/待支付/履约状态
      try {
        await tx.orderTimeline.create({ data: { orderId: order.id, event: 'ORDER_STATUS', value: 'CREATED' } });
      } catch {}
      try {
        await tx.orderTimeline.create({ data: { orderId: order.id, event: 'PAY_STATUS', value: 'UNPAID' } });
      } catch {}
      try {
        await tx.orderTimeline.create({ data: { orderId: order.id, event: 'FULFILLMENT', value: 'NONE' } });
      } catch {}
      return { id: order.id, no: order.no };
    });
  }

  private async generateOrderNo(tx: PrismaClient | Prisma.TransactionClient) {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ts = `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const rand8 = () => Array.from({ length: 8 }).map(() => charset[Math.floor(Math.random() * charset.length)]).join('');
    const prefix = `FK_${ts}_`;
    let tries = 0;
    while (true) {
      const no = `${prefix}${rand8()}`;
      const exists = await tx.order.findUnique({ where: { no } });
      if (!exists) return no;
      tries++;
      if (tries > 100) throw new Error('订单号生成失败');
    }
  }
}
