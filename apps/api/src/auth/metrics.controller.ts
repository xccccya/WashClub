import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from './admin.guard.js';
import { RequirePerm } from './perm.decorator.js';

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
}


