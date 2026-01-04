import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from './admin.guard.js';
import { RequirePerm } from './perm.decorator.js';
import { Prisma } from '@prisma/client';

type RangeKey = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';

function getRange(range: RangeKey | undefined): { start: Date; end: Date } {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    switch (range) {
        case 'last7': {
            const start = new Date(startOfTomorrow);
            start.setDate(start.getDate() - 7);
            return { start, end: startOfTomorrow };
        }
        case 'last30': {
            const start = new Date(startOfTomorrow);
            start.setDate(start.getDate() - 30);
            return { start, end: startOfTomorrow };
        }
        case 'thisMonth': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            // 下个月一号 00:00:00 作为结束
            const endMonth = now.getMonth() + 1;
            const endYear = now.getFullYear() + (endMonth >= 12 ? 1 : 0);
            const endMonthNorm = endMonth % 12;
            const endDt = new Date(endYear, endMonthNorm, 1, 0, 0, 0, 0);
            return { start, end: endDt };
        }
        case 'lastMonth': {
            const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const firstOfLastMonth = new Date(firstOfThisMonth);
            firstOfLastMonth.setMonth(firstOfLastMonth.getMonth() - 1);
            return { start: firstOfLastMonth, end: firstOfThisMonth };
        }
        case 'today':
        default: {
            const start = startOfToday;
            const endDt = startOfTomorrow;
            return { start, end: endDt };
        }
    }
}

function getPrevRange(range: RangeKey | undefined): { start: Date; end: Date; base: 'yesterday'|'prev7'|'prev30'|'lastMonth'|'prevMonth' } {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    switch (range) {
        case 'last7': {
            const end = new Date(startOfToday);
            const start = new Date(end);
            start.setDate(start.getDate() - 7);
            return { start, end, base: 'prev7' };
        }
        case 'last30': {
            const end = new Date(startOfToday);
            const start = new Date(end);
            start.setDate(start.getDate() - 30);
            return { start, end, base: 'prev30' };
        }
        case 'thisMonth': {
            const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const firstOfLastMonth = new Date(firstOfThisMonth);
            firstOfLastMonth.setMonth(firstOfLastMonth.getMonth() - 1);
            return { start: firstOfLastMonth, end: firstOfThisMonth, base: 'lastMonth' };
        }
        case 'lastMonth': {
            const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const firstOfLastMonth = new Date(firstOfThisMonth);
            firstOfLastMonth.setMonth(firstOfLastMonth.getMonth() - 1);
            const firstOfPrevMonth = new Date(firstOfLastMonth);
            firstOfPrevMonth.setMonth(firstOfPrevMonth.getMonth() - 1);
            return { start: firstOfPrevMonth, end: firstOfLastMonth, base: 'prevMonth' };
        }
        case 'today':
        default: {
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);
            return { start: startOfYesterday, end: startOfToday, base: 'yesterday' };
        }
    }
}

function calcRate(curr: number, prev: number): number | null {
    const c = Number(curr || 0);
    const p = Number(prev || 0);
    if (p === 0) {
        if (c === 0) return 0;
        return null; // 无法计算相对增幅
    }
    return (c - p) / p;
}

function formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
}

function parseLocalDateOnly(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
    if (!y || !mo || !d) return null;
    const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
    if (isNaN(dt.getTime())) return null;
    return dt;
}

function parseMonthOnly(s: string): { year: number; month0: number } | null {
    const m = /^(\d{4})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return null;
    const y = Number(m[1]); const mo = Number(m[2]);
    if (!y || !mo || mo < 1 || mo > 12) return null;
    return { year: y, month0: mo - 1 };
}

function resolveRange(args: {
    rangeKey?: RangeKey;
    startStr?: string;
    endStr?: string;
    monthStr?: string;
}): { start: Date; end: Date; prevStart: Date; prevEnd: Date; base: 'yesterday'|'prev7'|'prev30'|'lastMonth'|'prevMonth'|'prevPeriod'; range: RangeKey | 'custom' | 'month' } {
    const { rangeKey, startStr, endStr, monthStr } = args;

    // 1) month（YYYY-MM）
    if (monthStr) {
        const ym = parseMonthOnly(monthStr);
        if (!ym) throw new Error('month 参数无效（期望 YYYY-MM）');
        const start = new Date(ym.year, ym.month0, 1, 0, 0, 0, 0);
        const end = new Date(ym.year, ym.month0 + 1, 1, 0, 0, 0, 0);
        const prevStart = new Date(ym.year, ym.month0 - 1, 1, 0, 0, 0, 0);
        const prevEnd = start;
        return { start, end, prevStart, prevEnd, base: 'lastMonth', range: 'month' };
    }

    // 2) start/end（ISO 或 YYYY-MM-DD），区间为 [start, end)
    if (startStr || endStr) {
        const start =
            parseLocalDateOnly(startStr || '') ??
            (startStr ? new Date(startStr) : null) ??
            null;
        const end =
            parseLocalDateOnly(endStr || '') ??
            (endStr ? new Date(endStr) : null) ??
            null;
        if (!start || !end) throw new Error('start/end 参数无效');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('start/end 参数无效');
        if (start.getTime() >= end.getTime()) throw new Error('start 必须小于 end');
        const span = end.getTime() - start.getTime();
        const prevEnd = start;
        const prevStart = new Date(start.getTime() - span);
        return { start, end, prevStart, prevEnd, base: 'prevPeriod', range: 'custom' };
    }

    // 3) range 预置
    const rk: RangeKey = (rangeKey || 'today') as RangeKey;
    const { start, end } = getRange(rk);
    const { start: prevStart, end: prevEnd, base } = getPrevRange(rk);
    return { start, end, prevStart, prevEnd, base, range: rk };
}

@ApiTags('system')
@Controller('system')
@UseGuards(AdminGuard)
export class MetricsController {
    constructor(private prisma: PrismaService) {}

    @Get('metrics/overview')
    @ApiOperation({ summary: '运营概览指标（订单数/支付金额/洗车数量(总)/洗车卡划扣/活跃会员/新增会员）' })
    @ApiQuery({ name: 'range', required: false, enum: ['today','last7','last30','thisMonth','lastMonth'], description: '预置时间范围（与 start/end、month 互斥；优先级：month > start/end > range）' })
    @ApiQuery({ name: 'month', required: false, description: '指定月份（YYYY-MM），区间为该月 [01 00:00, 下月01 00:00)' })
    @ApiQuery({ name: 'start', required: false, description: '自定义开始时间（ISO 或 YYYY-MM-DD），区间为 [start, end)' })
    @ApiQuery({ name: 'end', required: false, description: '自定义结束时间（ISO 或 YYYY-MM-DD），区间为 [start, end)' })
    @RequirePerm('dashboard-metrics')
    async overview(
        @Query('range') rangeKey?: RangeKey,
        @Query('start') startStr?: string,
        @Query('end') endStr?: string,
        @Query('month') monthStr?: string,
    ) {
        const { start, end, prevStart, prevEnd, base, range } = resolveRange({ rangeKey, startStr, endStr, monthStr });
        // 订单数：按已支付订单
        const orderCountPromise = this.prisma.order.count({ where: { payStatus: 'PAID' as any, paidAt: { gte: start, lt: end }, deletedAt: null } });

        // 支付金额（净额）：支付总额 - 退款成功总额（均按时间窗聚合）
        const paymentsSumPromise = this.prisma.order.aggregate({ _sum: { payAmount: true }, where: { payStatus: { in: ['PAID','REFUNDED'] as any }, paidAt: { gte: start, lt: end }, deletedAt: null } });
        const refundsSumPromise = this.prisma.refundRecord.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' as any, updatedAt: { gte: start, lt: end } } });

        // 洗车卡划扣（个人）：仅统计 SERVICE_DEDUCT，且关联订单仍为 PAID（排除已退款订单）
        const washcardTimesPromise = this.prisma.$queryRaw(
            Prisma.sql`
            SELECT COALESCE(SUM(ABS(l.\`change\`)), 0) AS times
            FROM WashCardLog l
            JOIN \`Order\` o ON o.id = l.serviceOrderId
            WHERE l.action = 'DEDUCT' AND l.reason = 'SERVICE_DEDUCT'
              AND l.createdAt >= ${start} AND l.createdAt < ${end}
              AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
            `
        ) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
        // 洗车卡划扣（集团）：同口径，排除已退款订单
        const groupWashcardTimesPromise = this.prisma.$queryRaw(
            Prisma.sql`
            SELECT COALESCE(SUM(ABS(g.\`change\`)), 0) AS times
            FROM GroupWashCardLog g
            JOIN \`Order\` o ON o.id = g.serviceOrderId
            WHERE g.action = 'DEDUCT' AND g.reason = 'SERVICE_DEDUCT'
              AND g.createdAt >= ${start} AND g.createdAt < ${end}
              AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
            `
        ) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
        // 洗车服务销量（排除用卡结算的服务订单项）
        const washSalesPromise = this.prisma.$queryRaw(
            Prisma.sql`
            SELECT COALESCE(SUM(oi.quantity), 0) AS qty
            FROM OrderItem oi
            JOIN \`Order\` o ON o.id = oi.orderId
              AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
              AND o.paidAt >= ${start} AND o.paidAt < ${end}
              AND o.settlement NOT IN ('WASH_CARD','GROUP_WASH_CARD')
            JOIN Product p ON p.id = oi.productId
              AND p.type = 'SERVICE' AND p.isCarWash = true
            `
        ) as unknown as Promise<Array<{ qty: Prisma.Decimal | number | null }>>;

        // 活跃会员/新增会员
        const activeMembersPromise = this.prisma.member.count({ where: { lastActiveAt: { gte: start, lt: end } } });
        const newMembersPromise = this.prisma.member.count({ where: { createdAt: { gte: start, lt: end } } });

        // 累计数据：累计交易金额（净额）、累计订单数、总会员数、总集团客户数
        const cumulativePaymentsPromise = this.prisma.order.aggregate({ _sum: { payAmount: true }, where: { payStatus: 'PAID' as any, deletedAt: null } });
        const cumulativeRefundsPromise = this.prisma.refundRecord.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' as any } });
        const cumulativeOrdersPromise = this.prisma.order.count({ where: { payStatus: 'PAID' as any, deletedAt: null } });
        const totalMembersPromise = this.prisma.member.count();
        const totalGroupsPromise = this.prisma.group.count();

        // 上一周期：与当前口径一致
        const orderCountPrevPromise = this.prisma.order.count({ where: { payStatus: 'PAID' as any, paidAt: { gte: prevStart, lt: prevEnd }, deletedAt: null } });
        const paymentsSumPrevPromise = this.prisma.order.aggregate({ _sum: { payAmount: true }, where: { payStatus: { in: ['PAID','REFUNDED'] as any }, paidAt: { gte: prevStart, lt: prevEnd }, deletedAt: null } });
        const refundsSumPrevPromise = this.prisma.refundRecord.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' as any, updatedAt: { gte: prevStart, lt: prevEnd } } });
        const washcardTimesPrevPromise = this.prisma.$queryRaw(
            Prisma.sql`
            SELECT COALESCE(SUM(ABS(l.\`change\`)), 0) AS times
            FROM WashCardLog l
            JOIN \`Order\` o ON o.id = l.serviceOrderId
            WHERE l.action = 'DEDUCT' AND l.reason = 'SERVICE_DEDUCT'
              AND l.createdAt >= ${prevStart} AND l.createdAt < ${prevEnd}
              AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
            `
        ) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
        const groupWashcardTimesPrevPromise = this.prisma.$queryRaw(
            Prisma.sql`
            SELECT COALESCE(SUM(ABS(g.\`change\`)), 0) AS times
            FROM GroupWashCardLog g
            JOIN \`Order\` o ON o.id = g.serviceOrderId
            WHERE g.action = 'DEDUCT' AND g.reason = 'SERVICE_DEDUCT'
              AND g.createdAt >= ${prevStart} AND g.createdAt < ${prevEnd}
              AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
            `
        ) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>;
        const washSalesPrevPromise = this.prisma.$queryRaw(
            Prisma.sql`
            SELECT COALESCE(SUM(oi.quantity), 0) AS qty
            FROM OrderItem oi
            JOIN \`Order\` o ON o.id = oi.orderId
              AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
              AND o.paidAt >= ${prevStart} AND o.paidAt < ${prevEnd}
              AND o.settlement NOT IN ('WASH_CARD','GROUP_WASH_CARD')
            JOIN Product p ON p.id = oi.productId
              AND p.type = 'SERVICE' AND p.isCarWash = true
            `
        ) as unknown as Promise<Array<{ qty: Prisma.Decimal | number | null }>>;
        const activeMembersPrevPromise = this.prisma.member.count({ where: { lastActiveAt: { gte: prevStart, lt: prevEnd } } });
        const newMembersPrevPromise = this.prisma.member.count({ where: { createdAt: { gte: prevStart, lt: prevEnd } } });

        const [orderCount, paymentsSumAgg, refundsSumAgg, washcardTimesRows, groupWashcardTimesRows, washSalesRows, activeMembers, newMembers, cumPayAgg, cumRefundAgg, cumOrderCount, totalMembers, totalGroups,
            orderCountPrev, paymentsSumPrevAgg, refundsSumPrevAgg, washcardTimesPrevRows, groupWashcardTimesPrevRows, washSalesPrevRows, activeMembersPrev, newMembersPrev
        ] = await Promise.all([
            orderCountPromise,
            paymentsSumPromise,
            refundsSumPromise,
            washcardTimesPromise,
            groupWashcardTimesPromise,
            washSalesPromise,
            activeMembersPromise,
            newMembersPromise,
            cumulativePaymentsPromise,
            cumulativeRefundsPromise,
            cumulativeOrdersPromise,
            totalMembersPromise,
            totalGroupsPromise,
            orderCountPrevPromise,
            paymentsSumPrevPromise,
            refundsSumPrevPromise,
            washcardTimesPrevPromise,
            groupWashcardTimesPrevPromise,
            washSalesPrevPromise,
            activeMembersPrevPromise,
            newMembersPrevPromise,
        ]);

        const payAmountGross = Number((paymentsSumAgg as any)?._sum?.payAmount || 0) || 0;
        const refundAmount = Number((refundsSumAgg as any)?._sum?.amount || 0) || 0;
        const payAmount = Math.max(0, payAmountGross - refundAmount);
        const washcardDeductTimesPersonal = Number((washcardTimesRows?.[0] as any)?.times || 0) || 0;
        const washcardDeductTimesGroup = Number((groupWashcardTimesRows?.[0] as any)?.times || 0) || 0;
        const washcardDeductTimes = washcardDeductTimesPersonal + washcardDeductTimesGroup;
        const washSales = Number((washSalesRows?.[0] as any)?.qty || 0) || 0;
        const washCount = washSales + washcardDeductTimes;
        const payAmountPrevGross = Number((paymentsSumPrevAgg as any)?._sum?.payAmount || 0) || 0;
        const refundAmountPrev = Number((refundsSumPrevAgg as any)?._sum?.amount || 0) || 0;
        const payAmountPrev = Math.max(0, payAmountPrevGross - refundAmountPrev);
        const washcardDeductTimesPrevPersonal = Number((washcardTimesPrevRows?.[0] as any)?.times || 0) || 0;
        const washcardDeductTimesPrevGroup = Number((groupWashcardTimesPrevRows?.[0] as any)?.times || 0) || 0;
        const washcardDeductTimesPrev = washcardDeductTimesPrevPersonal + washcardDeductTimesPrevGroup;
        const washSalesPrev = Number((washSalesPrevRows?.[0] as any)?.qty || 0) || 0;
        const washCountPrev = washSalesPrev + washcardDeductTimesPrev;

        const cumulativePayGross = Number((cumPayAgg as any)?._sum?.payAmount || 0) || 0;
        const cumulativeRefund = Number((cumRefundAgg as any)?._sum?.amount || 0) || 0;
        const cumulativeTransactionAmount = Math.max(0, cumulativePayGross - cumulativeRefund);
        // 累计洗车：服务销量（排除用卡结算）+ 个人卡扣次 + 集团卡扣次
        const [cumWashSalesRows, cumWashcardRows, cumGroupWashcardRows] = await Promise.all([
            this.prisma.$queryRaw(
                Prisma.sql`
                SELECT COALESCE(SUM(oi.quantity), 0) AS qty
                FROM OrderItem oi
                JOIN \`Order\` o ON o.id = oi.orderId
                  AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
                  AND o.settlement NOT IN ('WASH_CARD','GROUP_WASH_CARD')
                JOIN Product p ON p.id = oi.productId
                  AND p.type = 'SERVICE' AND p.isCarWash = true
                `
            ) as unknown as Promise<Array<{ qty: Prisma.Decimal | number | null }>>,
            this.prisma.$queryRaw(
                Prisma.sql`
                SELECT COALESCE(SUM(ABS(l.\`change\`)), 0) AS times
                FROM WashCardLog l
                JOIN \`Order\` o ON o.id = l.serviceOrderId
                WHERE l.action = 'DEDUCT' AND l.reason = 'SERVICE_DEDUCT'
                  AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
                `
            ) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>,
            this.prisma.$queryRaw(
                Prisma.sql`
                SELECT COALESCE(SUM(ABS(g.\`change\`)), 0) AS times
                FROM GroupWashCardLog g
                JOIN \`Order\` o ON o.id = g.serviceOrderId
                WHERE g.action = 'DEDUCT' AND g.reason = 'SERVICE_DEDUCT'
                  AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
                `
            ) as unknown as Promise<Array<{ times: Prisma.Decimal | number | null }>>,
        ]);
        const cumulativeWashSales = Number((cumWashSalesRows?.[0] as any)?.qty || 0) || 0;
        const cumulativeWashCardPersonal = Number((cumWashcardRows?.[0] as any)?.times || 0) || 0;
        const cumulativeWashCardGroup = Number((cumGroupWashcardRows?.[0] as any)?.times || 0) || 0;
        const cumulativeWashcardDeductTimes = cumulativeWashCardPersonal + cumulativeWashCardGroup;
        const cumulativeWashCount = cumulativeWashSales + cumulativeWashcardDeductTimes;

        return {
            range,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            orderCount,
            payAmount,
            washCount,
            washcardDeductTimes,
            activeMembers,
            newMembers,
            cumulative: {
                transactionAmount: cumulativeTransactionAmount,
                orderCount: cumOrderCount,
                totalMembers,
                totalGroups,
                washcardDeductTimes: cumulativeWashcardDeductTimes,
                washCount: cumulativeWashCount,
            },
            compare: {
                base,
                orderCountPrev,
                orderCountRate: calcRate(orderCount, orderCountPrev),
                payAmountPrev,
                payAmountRate: calcRate(payAmount, payAmountPrev),
                washcardDeductTimesPrev,
                washcardDeductTimesRate: calcRate(washcardDeductTimes, washcardDeductTimesPrev),
                washCountPrev,
                washCountRate: calcRate(washCount, washCountPrev),
                activeMembersPrev,
                activeMembersRate: calcRate(activeMembers, activeMembersPrev),
                newMembersPrev,
                newMembersRate: calcRate(newMembers, newMembersPrev),
            }
        };
    }

    @Get('metrics/daily')
    @ApiOperation({ summary: '按日营收（CTE补零时间序列）' })
    @RequirePerm('dashboard-metrics')
    async daily(
        @Query('start') startStr?: string,
        @Query('end') endStr?: string,
    ) {
        let start: Date; let end: Date;
        if (startStr || endStr) {
            const now = new Date();
            end = endStr ? new Date(endStr) : new Date(now);
            start = startStr ? new Date(startStr) : new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        } else {
            ({ start, end } = getRange('last7'));
        }
        if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('时间参数无效');
        const sDateStr = formatLocalDate(start);
        const eDateStr = formatLocalDate(end);
        const rows: Array<{ d: Date; amt: Prisma.Decimal | number | null }> = await this.prisma.$queryRaw(
            Prisma.sql`
            WITH RECURSIVE dd AS (
              SELECT DATE(${Prisma.sql`${sDateStr}`}) AS d
              UNION ALL
              SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dd WHERE DATE_ADD(d, INTERVAL 1 DAY) < DATE(${Prisma.sql`${eDateStr}`})
            ),
            rev AS (
              SELECT DATE(o.paidAt) AS d, SUM(o.payAmount) AS amt
              FROM \`Order\` o
              WHERE o.payStatus='PAID' AND o.paidAt >= ${start} AND o.paidAt < ${end}
              GROUP BY DATE(o.paidAt)
            )
            SELECT dd.d AS d, COALESCE(rev.amt, 0) AS amt
            FROM dd LEFT JOIN rev ON dd.d = rev.d
            ORDER BY dd.d;
            `
        );
        return rows.map(r => ({ date: formatLocalDate(new Date(r.d)), amount: Number(r.amt || 0) }));
    }

    @Get('metrics/series')
    @ApiOperation({ summary: '时间序列：订单笔数/净支付金额/洗车卡划扣次数/洗车数量(总)（近7日/近一月/本月）' })
    @ApiQuery({ name: 'metric', required: true, enum: ['orders','payments','washcard','washcount'] })
    @ApiQuery({ name: 'range', required: false, enum: ['today','last7','last30','thisMonth','lastMonth'], description: '预置时间范围（与 start/end、month 互斥；优先级：month > start/end > range）' })
    @ApiQuery({ name: 'month', required: false, description: '指定月份（YYYY-MM），区间为该月 [01 00:00, 下月01 00:00)' })
    @ApiQuery({ name: 'start', required: false, description: '自定义开始时间（ISO 或 YYYY-MM-DD），区间为 [start, end)' })
    @ApiQuery({ name: 'end', required: false, description: '自定义结束时间（ISO 或 YYYY-MM-DD），区间为 [start, end)' })
    @RequirePerm('dashboard-metrics')
    async series(
        @Query('metric') metric: 'orders'|'payments'|'washcard'|'washcount',
        @Query('range') rangeKey?: RangeKey,
        @Query('start') startStr?: string,
        @Query('end') endStr?: string,
        @Query('month') monthStr?: string,
    ) {
        const { start, end, range } = resolveRange({ rangeKey: (rangeKey || 'last7') as any, startStr, endStr, monthStr });
        // 防御：避免超长区间导致递归 CTE/聚合过慢
        const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        if (days > 370) throw new Error('时间区间过大（请缩小到 370 天以内）');
        const sDateStr = formatLocalDate(start);
        const eDateStr = formatLocalDate(end);
        if (metric === 'orders') {
            const rows: Array<{ d: Date; c: number }> = await this.prisma.$queryRaw(
                Prisma.sql`
                WITH RECURSIVE dd AS (
                  SELECT DATE(${Prisma.sql`${sDateStr}`}) AS d
                  UNION ALL
                  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dd WHERE DATE_ADD(d, INTERVAL 1 DAY) < DATE(${Prisma.sql`${eDateStr}`})
                ),
                oc AS (
                  SELECT DATE(paidAt) AS d, COUNT(1) AS c
                  FROM \`Order\`
                  WHERE payStatus='PAID' AND deletedAt IS NULL AND paidAt >= ${start} AND paidAt < ${end}
                  GROUP BY DATE(paidAt)
                )
                SELECT dd.d AS d, COALESCE(oc.c, 0) AS c
                FROM dd LEFT JOIN oc ON dd.d = oc.d
                ORDER BY dd.d;
                `
            );
            return { range, startAt: start.toISOString(), endAt: end.toISOString(), points: rows.map(r=>({ date: formatLocalDate(new Date(r.d)), value: Number(r.c || 0) })) };
        }
        if (metric === 'payments') {
            // 净支付：每日支付总额 - 每日退款成功总额
            const rows: Array<{ d: Date; amt: number }> = await this.prisma.$queryRaw(
                Prisma.sql`
                WITH RECURSIVE dd AS (
                  SELECT DATE(${Prisma.sql`${sDateStr}`}) AS d
                  UNION ALL
                  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dd WHERE DATE_ADD(d, INTERVAL 1 DAY) < DATE(${Prisma.sql`${eDateStr}`})
                ),
                pay AS (
                  SELECT DATE(paidAt) AS d, SUM(payAmount) AS amt
                  FROM \`Order\`
                  WHERE payStatus='PAID' AND deletedAt IS NULL AND paidAt >= ${start} AND paidAt < ${end}
                  GROUP BY DATE(paidAt)
                ),
                ref AS (
                  SELECT DATE(updatedAt) AS d, SUM(amount) AS amt
                  FROM RefundRecord
                  WHERE status='SUCCESS' AND updatedAt >= ${start} AND updatedAt < ${end}
                  GROUP BY DATE(updatedAt)
                ),
                net AS (
                  SELECT dd.d AS d, COALESCE(pay.amt,0) - COALESCE(ref.amt,0) AS amt
                  FROM dd
                  LEFT JOIN pay ON dd.d = pay.d
                  LEFT JOIN ref ON dd.d = ref.d
                )
                SELECT net.d AS d, CASE WHEN net.amt < 0 THEN 0 ELSE net.amt END AS amt FROM net ORDER BY net.d;
                `
            );
            return { range, startAt: start.toISOString(), endAt: end.toISOString(), points: rows.map(r=>({ date: formatLocalDate(new Date(r.d)), value: Number(r.amt || 0) })) };
        }
        if (metric === 'washcard') {
            const rows: Array<{ d: Date; t: number }> = await this.prisma.$queryRaw(
                Prisma.sql`
                WITH RECURSIVE dd AS (
                  SELECT DATE(${Prisma.sql`${sDateStr}`}) AS d
                  UNION ALL
                  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dd WHERE DATE_ADD(d, INTERVAL 1 DAY) < DATE(${Prisma.sql`${eDateStr}`})
                ),
                wc1 AS (
                  SELECT DATE(l.createdAt) AS d, SUM(ABS(l.\`change\`)) AS t
                  FROM WashCardLog l
                  JOIN \`Order\` o ON o.id = l.serviceOrderId
                  WHERE l.action='DEDUCT' AND l.reason='SERVICE_DEDUCT' AND l.createdAt >= ${start} AND l.createdAt < ${end}
                    AND o.payStatus='PAID' AND o.deletedAt IS NULL
                  GROUP BY DATE(l.createdAt)
                ),
                wc2 AS (
                  SELECT DATE(g.createdAt) AS d, SUM(ABS(g.\`change\`)) AS t
                  FROM GroupWashCardLog g
                  JOIN \`Order\` o ON o.id = g.serviceOrderId
                  WHERE g.action='DEDUCT' AND g.reason='SERVICE_DEDUCT' AND g.createdAt >= ${start} AND g.createdAt < ${end}
                    AND o.payStatus='PAID' AND o.deletedAt IS NULL
                  GROUP BY DATE(g.createdAt)
                ),
                wc AS (
                  SELECT dd2.d AS d, COALESCE(wc1.t,0) + COALESCE(wc2.t,0) AS t
                  FROM (
                    SELECT d FROM dd
                  ) dd2
                  LEFT JOIN wc1 ON dd2.d = wc1.d
                  LEFT JOIN wc2 ON dd2.d = wc2.d
                )
                SELECT dd.d AS d, COALESCE(wc.t, 0) AS t
                FROM dd LEFT JOIN wc ON dd.d = wc.d
                ORDER BY dd.d;
                `
            );
            return { range, startAt: start.toISOString(), endAt: end.toISOString(), points: rows.map(r=>({ date: formatLocalDate(new Date(r.d)), value: Number(r.t || 0) })) };
        }
        if (metric === 'washcount') {
            // 洗车数量(总) = 洗车服务销量(排除用卡结算) + 洗车卡划扣(个人+集团)
            const rows: Array<{ d: Date; v: number }> = await this.prisma.$queryRaw(
                Prisma.sql`
                WITH RECURSIVE dd AS (
                  SELECT DATE(${Prisma.sql`${sDateStr}`}) AS d
                  UNION ALL
                  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dd WHERE DATE_ADD(d, INTERVAL 1 DAY) < DATE(${Prisma.sql`${eDateStr}`})
                ),
                sales AS (
                  SELECT DATE(o.paidAt) AS d, SUM(oi.quantity) AS qty
                  FROM OrderItem oi
                  JOIN \`Order\` o ON o.id = oi.orderId
                    AND o.payStatus = 'PAID' AND o.deletedAt IS NULL
                    AND o.paidAt >= ${start} AND o.paidAt < ${end}
                    AND o.settlement NOT IN ('WASH_CARD','GROUP_WASH_CARD')
                  JOIN Product p ON p.id = oi.productId
                    AND p.type = 'SERVICE' AND p.isCarWash = true
                  GROUP BY DATE(o.paidAt)
                ),
                wc1 AS (
                  SELECT DATE(l.createdAt) AS d, SUM(ABS(l.\`change\`)) AS t
                  FROM WashCardLog l
                  JOIN \`Order\` o ON o.id = l.serviceOrderId
                  WHERE l.action='DEDUCT' AND l.reason='SERVICE_DEDUCT' AND l.createdAt >= ${start} AND l.createdAt < ${end}
                    AND o.payStatus='PAID' AND o.deletedAt IS NULL
                  GROUP BY DATE(l.createdAt)
                ),
                wc2 AS (
                  SELECT DATE(g.createdAt) AS d, SUM(ABS(g.\`change\`)) AS t
                  FROM GroupWashCardLog g
                  JOIN \`Order\` o ON o.id = g.serviceOrderId
                  WHERE g.action='DEDUCT' AND g.reason='SERVICE_DEDUCT' AND g.createdAt >= ${start} AND g.createdAt < ${end}
                    AND o.payStatus='PAID' AND o.deletedAt IS NULL
                  GROUP BY DATE(g.createdAt)
                ),
                agg AS (
                  SELECT ddd.d AS d,
                         COALESCE(sales.qty,0) + COALESCE(wc1.t,0) + COALESCE(wc2.t,0) AS v
                  FROM (
                    SELECT d FROM dd
                  ) ddd
                  LEFT JOIN sales ON ddd.d = sales.d
                  LEFT JOIN wc1 ON ddd.d = wc1.d
                  LEFT JOIN wc2 ON ddd.d = wc2.d
                )
                SELECT agg.d AS d, agg.v AS v FROM agg ORDER BY agg.d;
                `
            );
            return { range, startAt: start.toISOString(), endAt: end.toISOString(), points: rows.map(r=>({ date: formatLocalDate(new Date(r.d)), value: Number(r.v || 0) })) };
        }
        return { range, startAt: start.toISOString(), endAt: end.toISOString(), points: [] };
    }

    @Get('metrics/top-products')
    @ApiOperation({ summary: '商品销量Top-N（窗口函数可扩展）' })
    @RequirePerm('dashboard-metrics')
    async topProducts(
        @Query('start') startStr?: string,
        @Query('end') endStr?: string,
        @Query('limit') limitStr?: string,
        @Query('categoryId') categoryIdStr?: string,
    ) {
        const now = new Date();
        let start: Date; let end: Date;
        if (startStr || endStr) {
            end = endStr ? new Date(endStr) : new Date(now);
            start = startStr ? new Date(startStr) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
            ({ start, end } = getRange('last7'));
        }
        const limit = Math.max(1, Math.min(100, Number(limitStr || 10)));
        if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('时间参数无效');
        const categoryId = categoryIdStr ? Number(categoryIdStr) : null;
        const whereCategory = categoryId ? Prisma.sql`AND p.categoryId = ${categoryId}` : Prisma.sql``;
        const rows: Array<{ id: number; name: string; qty: number }> = await this.prisma.$queryRaw(
            Prisma.sql`
            SELECT p.id AS id, p.name AS name, SUM(oi.quantity) AS qty
            FROM OrderItem oi
            JOIN \`Order\` o ON o.id = oi.orderId AND o.payStatus = 'PAID' AND o.paidAt >= ${start} AND o.paidAt < ${end}
            JOIN Product p ON p.id = oi.productId
            ${whereCategory}
            GROUP BY p.id, p.name
            ORDER BY qty DESC
            LIMIT ${limit};
            `
        );
        return rows.map(r => ({ id: r.id, name: r.name, quantity: Number(r.qty || 0) }));
    }
}


