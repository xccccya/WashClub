import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from './admin.guard.js';
import { RequirePerm } from './perm.decorator.js';
import { Prisma } from '@prisma/client';

type RangeKey = 'today' | 'last7' | 'last30' | 'thisMonth';

function getRange(range: RangeKey | undefined): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    switch (range) {
        case 'last7': {
            const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { start, end };
        }
        case 'last30': {
            const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return { start, end };
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
        case 'today':
        default: {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            const endDt = new Date(start);
            endDt.setDate(endDt.getDate() + 1);
            return { start, end: endDt };
        }
    }
}

@ApiTags('system')
@Controller('system')
@UseGuards(AdminGuard)
export class MetricsController {
    constructor(private prisma: PrismaService) {}

    @Get('metrics/overview')
    @ApiOperation({ summary: '运营概览指标（订单数/支付金额/洗车卡划扣/活跃会员/新增会员）' })
    @RequirePerm('dashboard-metrics')
    async overview(
        @Query('range') rangeKey?: RangeKey,
    ) {
        const { start, end } = getRange(rangeKey || 'today');
        const [orderCount, paySumAgg, washcardDeductTimes, activeMembers, newMembers] = await this.prisma.$transaction([
            this.prisma.order.count({ where: { payStatus: 'PAID' as any, paidAt: { gte: start, lt: end }, deletedAt: null } }),
            this.prisma.order.aggregate({ _sum: { payAmount: true }, where: { payStatus: 'PAID' as any, paidAt: { gte: start, lt: end }, deletedAt: null } }),
            this.prisma.washCardLog.count({ where: { action: 'DEDUCT' as any, createdAt: { gte: start, lt: end } } }),
            this.prisma.member.count({ where: { lastActiveAt: { gte: start, lt: end } } }),
            this.prisma.member.count({ where: { createdAt: { gte: start, lt: end } } }),
        ]);
        const payAmount = Number((paySumAgg as any)?._sum?.payAmount || 0) || 0;
        return {
            range: rangeKey || 'today',
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            orderCount,
            payAmount,
            washcardDeductTimes,
            activeMembers,
            newMembers,
        };
    }

    @Get('metrics/daily')
    @ApiOperation({ summary: '按日营收（CTE补零时间序列）' })
    @RequirePerm('dashboard-metrics')
    async daily(
        @Query('start') startStr?: string,
        @Query('end') endStr?: string,
    ) {
        const now = new Date();
        const end = endStr ? new Date(endStr) : now;
        const start = startStr ? new Date(startStr) : new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('时间参数无效');
        const rows: Array<{ d: Date; amt: Prisma.Decimal | number | null }> = await this.prisma.$queryRaw(
            Prisma.sql`
            WITH RECURSIVE dd AS (
              SELECT CAST(${Prisma.sql`${start}`} AS DATE) AS d
              UNION ALL
              SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM dd WHERE d < CAST(${Prisma.sql`${end}`} AS DATE)
            ),
            rev AS (
              SELECT DATE(o.paidAt) AS d, SUM(o.payAmount) AS amt
              FROM \`Order\` o
              WHERE o.payStatus='PAID' AND o.paidAt BETWEEN ${start} AND ${end}
              GROUP BY DATE(o.paidAt)
            )
            SELECT dd.d AS d, COALESCE(rev.amt, 0) AS amt
            FROM dd LEFT JOIN rev ON dd.d = rev.d
            ORDER BY dd.d;
            `
        );
        return rows.map(r => ({ date: new Date(r.d).toISOString().slice(0,10), amount: Number(r.amt || 0) }));
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
        const end = endStr ? new Date(endStr) : now;
        const start = startStr ? new Date(startStr) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const limit = Math.max(1, Math.min(100, Number(limitStr || 10)));
        if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('时间参数无效');
        const categoryId = categoryIdStr ? Number(categoryIdStr) : null;
        const whereCategory = categoryId ? Prisma.sql`AND p.categoryId = ${categoryId}` : Prisma.sql``;
        const rows: Array<{ id: number; name: string; qty: number }> = await this.prisma.$queryRaw(
            Prisma.sql`
            SELECT p.id AS id, p.name AS name, SUM(oi.quantity) AS qty
            FROM OrderItem oi
            JOIN \`Order\` o ON o.id = oi.orderId AND o.payStatus = 'PAID' AND o.paidAt BETWEEN ${start} AND ${end}
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


