import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class GroupBalanceService {
  constructor(private prisma: PrismaService) {}

  async getSummary(groupId: number) {
    const acc = await this.prisma.groupBalanceAccount.findUnique({ where: { groupId } });
    return { balance: Number(acc?.balance || 0) };
  }

  async listLedger(groupId: number, page = 1, pageSize = 20, type?: 'RECHARGE'|'DEDUCT'|'ADJUST'|'REFUND', start?: string, end?: string) {
    const where: any = { groupId };
    if (type) where.type = type as any;
    if (start) where.createdAt = { ...(where.createdAt||{}), gte: new Date(start) };
    if (end) where.createdAt = { ...(where.createdAt||{}), lte: new Date(end) };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.groupBalanceLedger.count({ where }),
      this.prisma.groupBalanceLedger.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })
    ]);
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
        data: {
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
          remark: sysRemark,
        }
      });
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
