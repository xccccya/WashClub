import { BadRequestException, Controller, Get, Headers, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { Prisma } from '@prisma/client';

type RangeKey = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';

function getRange(range: RangeKey | undefined): { start: Date; end: Date } {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
  const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate()+1);
  switch (range) {
    case 'last7': { const start = new Date(startOfTomorrow); start.setDate(start.getDate()-7); return { start, end: startOfTomorrow }; }
    case 'last30': { const start = new Date(startOfTomorrow); start.setDate(start.getDate()-30); return { start, end: startOfTomorrow }; }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endMonth = now.getMonth() + 1;
      const endYear = now.getFullYear() + (endMonth >= 12 ? 1 : 0);
      const endMonthNorm = endMonth % 12;
      return { start, end: new Date(endYear, endMonthNorm, 1, 0, 0, 0, 0) };
    }
    case 'lastMonth': {
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const firstOfLastMonth = new Date(firstOfThisMonth);
      firstOfLastMonth.setMonth(firstOfLastMonth.getMonth() - 1);
      return { start: firstOfLastMonth, end: firstOfThisMonth };
    }
    case 'today':
    default: { return { start: startOfToday, end: startOfTomorrow }; }
  }
}

function getPrevRange(range: RangeKey | undefined): { start: Date; end: Date; base: 'yesterday'|'prev7'|'prev30'|'lastMonth' } {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
  switch (range) {
    case 'last7': { const end = new Date(startOfToday); const start = new Date(end); start.setDate(start.getDate()-7); return { start, end, base: 'prev7' }; }
    case 'last30': { const end = new Date(startOfToday); const start = new Date(end); start.setDate(start.getDate()-30); return { start, end, base: 'prev30' }; }
    case 'thisMonth': { const firstOfThis = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); const firstOfLast = new Date(firstOfThis); firstOfLast.setMonth(firstOfLast.getMonth()-1); return { start: firstOfLast, end: firstOfThis, base: 'lastMonth' }; }
    case 'lastMonth': { const firstOfThis = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0); const firstOfLast = new Date(firstOfThis); firstOfLast.setMonth(firstOfLast.getMonth()-1); const firstOfPrev = new Date(firstOfLast); firstOfPrev.setMonth(firstOfPrev.getMonth()-1); return { start: firstOfPrev, end: firstOfLast, base: 'lastMonth' }; }
    case 'today':
    default: { const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate()-1); return { start: startOfYesterday, end: startOfToday, base: 'yesterday' }; }
  }
}

function calcRate(curr: number, prev: number): number | null {
  const c = Number(curr || 0); const p = Number(prev || 0);
  if (p === 0) return c === 0 ? 0 : null; return (c - p) / p;
}

@ApiTags('MiniappEmployee')
@Controller('system/miniapp')
export class SystemMiniappEmployeeController {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  private async getMemberIdFromToken(headers: Record<string, string>, tokenParam?: string): Promise<number> {
    const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
    const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
    if (!token) throw new BadRequestException('缺少Token');
    try {
      const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
      if (decoded?.type !== 'member') throw 0; const id = Number(decoded?.sub); if (!id) throw 0; return id;
    } catch { throw new BadRequestException('Token无效'); }
  }

  private async assertEmployee(memberId: number): Promise<{ id: number; name: string|null; title: string|null; enabled: boolean; member: { id: number; name: string; phone: string } }>{
    const emp = await this.prisma.employee.findUnique({ where: { memberId }, include: { member: { select: { id: true, name: true, phone: true } } } });
    if (!emp || !emp.enabled) throw new BadRequestException('非员工或已禁用');
    return emp as any;
  }

  @Get('employee/profile')
  @ApiOperation({ summary: '查询当前会员的员工档案（用于前端入口判断）' })
  async myEmployeeProfile(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const emp = await this.prisma.employee.findUnique({ where: { memberId }, include: { member: { select: { id: true, name: true, phone: true } } } });
    if (!emp) return { isEmployee: false } as any;
    return { isEmployee: !!emp, enabled: !!emp.enabled, name: emp.name ?? emp.member?.name ?? '', title: emp.title ?? '', memberId: emp.memberId } as any;
  }

  @Get('employee/overview')
  @ApiOperation({ summary: '员工-基础运营概览（今日/近7/近30/本月/上月）' })
  async overview(@Headers() headers: Record<string,string>, @Query('range') rangeKey?: RangeKey, @Query('token') tokenParam?: string){
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const emp = await this.assertEmployee(memberId);
    const { start, end } = getRange(rangeKey || 'today');
    const { start: prevStart, end: prevEnd, base } = getPrevRange(rangeKey || 'today');

    const orderCountPromise = this.prisma.order.count({ where: { payStatus: 'PAID' as any, paidAt: { gte: start, lt: end }, deletedAt: null } });
    const paymentsSumPromise = this.prisma.order.aggregate({ _sum: { payAmount: true }, where: { payStatus: { in: ['PAID','REFUNDED'] as any }, paidAt: { gte: start, lt: end }, deletedAt: null } });
    const refundsSumPromise = this.prisma.refundRecord.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' as any, updatedAt: { gte: start, lt: end } } });
    const washcardTimesPromise = this.prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(SUM(ABS(l.\`change\`)), 0) AS times
      FROM WashCardLog l
      JOIN \`Order\` o ON o.id = l.serviceOrderId
      WHERE l.action='DEDUCT' AND l.reason='SERVICE_DEDUCT' AND l.createdAt >= ${start} AND l.createdAt < ${end}
        AND o.payStatus='PAID' AND o.deletedAt IS NULL
    `) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
    const groupWashcardTimesPromise = this.prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(SUM(ABS(g.\`change\`)), 0) AS times
      FROM GroupWashCardLog g
      JOIN \`Order\` o ON o.id = g.serviceOrderId
      WHERE g.action='DEDUCT' AND g.reason='SERVICE_DEDUCT' AND g.createdAt >= ${start} AND g.createdAt < ${end}
        AND o.payStatus='PAID' AND o.deletedAt IS NULL
    `) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
    const washSalesPromise = this.prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(SUM(oi.quantity), 0) AS qty
      FROM OrderItem oi JOIN \`Order\` o ON o.id = oi.orderId AND o.payStatus='PAID' AND o.deletedAt IS NULL AND o.paidAt >= ${start} AND o.paidAt < ${end}
      JOIN Product p ON p.id = oi.productId AND p.type='SERVICE' AND p.isCarWash = true AND o.settlement NOT IN ('WASH_CARD','GROUP_WASH_CARD')
    `) as unknown as Promise<Array<{ qty: Prisma.Decimal | number | null }>>;

    const [orderCount, paymentsSumAgg, refundsSumAgg, wc1, wc2, ws] = await Promise.all([orderCountPromise, paymentsSumPromise, refundsSumPromise, washcardTimesPromise, groupWashcardTimesPromise, washSalesPromise]);
    const payAmountGross = Number((paymentsSumAgg as any)?._sum?.payAmount || 0) || 0;
    const refundAmount = Number((refundsSumAgg as any)?._sum?.amount || 0) || 0;
    const payAmount = Math.max(0, payAmountGross - refundAmount);
    const washcardDeductTimes = Number((wc1?.[0] as any)?.times || 0) + Number((wc2?.[0] as any)?.times || 0);
    const washSales = Number((ws?.[0] as any)?.qty || 0) || 0;
    const washCount = washSales + washcardDeductTimes;

    const paymentsSumPrevPromise = this.prisma.order.aggregate({ _sum: { payAmount: true }, where: { payStatus: { in: ['PAID','REFUNDED'] as any }, paidAt: { gte: prevStart, lt: prevEnd }, deletedAt: null } });
    const refundsSumPrevPromise = this.prisma.refundRecord.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' as any, updatedAt: { gte: prevStart, lt: prevEnd } } });
    const wc1PrevPromise = this.prisma.$queryRaw(Prisma.sql`SELECT COALESCE(SUM(ABS(l.\`change\`)), 0) AS times FROM WashCardLog l JOIN \`Order\` o ON o.id = l.serviceOrderId WHERE l.action='DEDUCT' AND l.reason='SERVICE_DEDUCT' AND l.createdAt >= ${prevStart} AND l.createdAt < ${prevEnd} AND o.payStatus='PAID' AND o.deletedAt IS NULL`) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
    const wc2PrevPromise = this.prisma.$queryRaw(Prisma.sql`SELECT COALESCE(SUM(ABS(g.\`change\`)), 0) AS times FROM GroupWashCardLog g JOIN \`Order\` o ON o.id = g.serviceOrderId WHERE g.action='DEDUCT' AND g.reason='SERVICE_DEDUCT' AND g.createdAt >= ${prevStart} AND g.createdAt < ${prevEnd} AND o.payStatus='PAID' AND o.deletedAt IS NULL`) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
    const wsPrevPromise = this.prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(SUM(oi.quantity), 0) AS qty
      FROM OrderItem oi JOIN \`Order\` o ON o.id = oi.orderId AND o.payStatus='PAID' AND o.deletedAt IS NULL AND o.paidAt >= ${prevStart} AND o.paidAt < ${prevEnd}
      JOIN Product p ON p.id = oi.productId AND p.type='SERVICE' AND p.isCarWash = true AND o.settlement NOT IN ('WASH_CARD','GROUP_WASH_CARD')
    `) as unknown as Promise<Array<{ qty: Prisma.Decimal | number | null }>>;

    const [paymentsSumPrevAgg, refundsSumPrevAgg, wc1Prev, wc2Prev, wsPrev] = await Promise.all([paymentsSumPrevPromise, refundsSumPrevPromise, wc1PrevPromise, wc2PrevPromise, wsPrevPromise]);
    const payAmountPrev = Math.max(0, Number((paymentsSumPrevAgg as any)?._sum?.payAmount || 0) - Number((refundsSumPrevAgg as any)?._sum?.amount || 0));
    const washcardDeductTimesPrev = Number((wc1Prev?.[0] as any)?.times || 0) + Number((wc2Prev?.[0] as any)?.times || 0);
    const washSalesPrev = Number((wsPrev?.[0] as any)?.qty || 0) || 0;
    const washCountPrev = washSalesPrev + washcardDeductTimesPrev;

    return {
      employee: { name: emp.name ?? emp.member?.name ?? '', title: emp.title ?? '' },
      range: rangeKey || 'today', startAt: start.toISOString(), endAt: end.toISOString(),
      orderCount,
      payAmount,
      washCount,
      washcardDeductTimes,
      compare: {
        base,
        payAmountPrev,
        payAmountRate: calcRate(payAmount, payAmountPrev),
        washcardDeductTimesPrev,
        washcardDeductTimesRate: calcRate(washcardDeductTimes, washcardDeductTimesPrev),
        washCountPrev,
        washCountRate: calcRate(washCount, washCountPrev),
      }
    } as any;
  }

  @Get('employee/daily')
  @ApiOperation({ summary: '员工-按日指标列表（净支付/洗车卡划扣/洗车数量合计）' })
  async daily(
    @Headers() headers: Record<string,string>,
    @Query('range') rangeKey?: RangeKey,
    @Query('start') startStr?: string,
    @Query('end') endStr?: string,
    @Query('token') tokenParam?: string,
  ){
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    await this.assertEmployee(memberId);
    let start: Date; let end: Date;
    if (startStr || endStr) {
      const now = new Date();
      start = startStr ? new Date(startStr) : new Date(now.getTime() - 6*24*60*60*1000);
      end = endStr ? new Date(endStr) : now;
    } else {
      ({ start, end } = getRange(rangeKey || 'last7'));
    }
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new BadRequestException('时间参数无效');

    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH RECURSIVE dd AS (
        SELECT CAST(${Prisma.sql`${start}`} AS DATE) AS d
        UNION ALL SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dd WHERE d < CAST(${Prisma.sql`${end}`} AS DATE)
      ),
      pay AS (
        SELECT DATE(paidAt) AS d, SUM(payAmount) AS amt
        FROM \`Order\`
        WHERE payStatus IN ('PAID','REFUNDED') AND deletedAt IS NULL AND paidAt >= ${start} AND paidAt < ${end}
        GROUP BY DATE(paidAt)
      ),
      ref AS (
        SELECT DATE(updatedAt) AS d, SUM(amount) AS amt FROM RefundRecord WHERE status='SUCCESS' AND updatedAt >= ${start} AND updatedAt < ${end}
        GROUP BY DATE(updatedAt)
      ),
      wc1 AS (
        SELECT DATE(l.createdAt) AS d, SUM(ABS(l.\`change\`)) AS t FROM WashCardLog l JOIN \`Order\` o ON o.id = l.serviceOrderId WHERE l.action='DEDUCT' AND l.reason='SERVICE_DEDUCT' AND l.createdAt >= ${start} AND l.createdAt < ${end} AND o.payStatus='PAID' AND o.deletedAt IS NULL
        GROUP BY DATE(l.createdAt)
      ),
      wc2 AS (
        SELECT DATE(g.createdAt) AS d, SUM(ABS(g.\`change\`)) AS t FROM GroupWashCardLog g JOIN \`Order\` o ON o.id = g.serviceOrderId WHERE g.action='DEDUCT' AND g.reason='SERVICE_DEDUCT' AND g.createdAt >= ${start} AND g.createdAt < ${end} AND o.payStatus='PAID' AND o.deletedAt IS NULL
        GROUP BY DATE(g.createdAt)
      ),
      sales AS (
        SELECT DATE(o.paidAt) AS d, SUM(oi.quantity) AS qty
        FROM OrderItem oi JOIN \`Order\` o ON o.id = oi.orderId AND o.payStatus='PAID' AND o.deletedAt IS NULL AND o.paidAt >= ${start} AND o.paidAt < ${end}
        JOIN Product p ON p.id = oi.productId AND p.type='SERVICE' AND p.isCarWash = true AND o.settlement NOT IN ('WASH_CARD','GROUP_WASH_CARD')
        GROUP BY DATE(o.paidAt)
      )
      SELECT dd.d AS d,
             CASE WHEN COALESCE(pay.amt,0) - COALESCE(ref.amt,0) < 0 THEN 0 ELSE COALESCE(pay.amt,0) - COALESCE(ref.amt,0) END AS netPay,
             COALESCE(wc1.t,0) + COALESCE(wc2.t,0) AS wcTimes,
             COALESCE(sales.qty,0) + COALESCE(wc1.t,0) + COALESCE(wc2.t,0) AS washCount
      FROM dd
      LEFT JOIN pay ON dd.d = pay.d
      LEFT JOIN ref ON dd.d = ref.d
      LEFT JOIN wc1 ON dd.d = wc1.d
      LEFT JOIN wc2 ON dd.d = wc2.d
      LEFT JOIN sales ON dd.d = sales.d
      ORDER BY dd.d DESC;
    `) as unknown as Array<{ d: Date; netPay: number; wcTimes: number; washCount: number }>;

    const items = rows.map(r => ({ date: new Date(r.d).toISOString().slice(0,10), payAmount: Number((r as any).netPay || 0), washcardDeductTimes: Number((r as any).wcTimes || 0), washCount: Number((r as any).washCount || 0) }));
    const total = items.reduce((acc, it) => ({ payAmount: acc.payAmount + it.payAmount, washcardDeductTimes: acc.washcardDeductTimes + it.washcardDeductTimes, washCount: acc.washCount + it.washCount }), { payAmount: 0, washcardDeductTimes: 0, washCount: 0 });
    return { range: rangeKey || (startStr||endStr ? undefined : 'last7'), startAt: start.toISOString(), endAt: end.toISOString(), total, items } as any;
  }
}


