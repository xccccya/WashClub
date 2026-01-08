import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { GroupBalanceService } from './balance.service.js';
import { GroupBalanceAdjustDto, GroupBalanceRechargeDto } from './group.dto.js';

@ApiTags('GroupBalance')
@Controller('group/:id/balance')
@UseGuards(AdminGuard)
export class GroupBalanceController {
  constructor(private service: GroupBalanceService) {}

  @Get('')
  @RequirePerm('group-balance')
  summary(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSummary(id);
  }

  @Get('ledger')
  @RequirePerm('group-balance')
  ledger(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('type') type?: 'RECHARGE'|'DEDUCT'|'ADJUST'|'REFUND',
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const p = Math.max(1, Number(page || 1));
    const ps = Math.max(1, Math.min(100, Number(pageSize || 20)));
    return this.service.listLedger(id, p, ps, type, start, end);
  }

  @Get('monthly-consumption')
  @RequirePerm('group-balance')
  @ApiOperation({ summary: '按月累计消费金额（集团余额支付扣减）' })
  monthlyConsumption(
    @Param('id', ParseIntPipe) id: number,
    @Query('startMonth') startMonth?: string,
    @Query('endMonth') endMonth?: string,
    @Query('months') months?: string,
  ) {
    const m = months == null ? undefined : Number(months);
    return this.service.getMonthlyConsumption(id, {
      startMonth: startMonth || undefined,
      endMonth: endMonth || undefined,
      months: Number.isFinite(m as any) ? Number(m) : undefined,
    });
  }

  @Post('adjust')
  @RequirePerm('group-balance')
  @ApiOperation({ summary: '手工调账（正/负）' })
  adjust(@Param('id', ParseIntPipe) id: number, @Body() body: GroupBalanceAdjustDto) {
    return this.service.adjust(id, Number(body?.amount), body?.note ?? null, null);
  }

  @Post('recharge')
  @RequirePerm('group-balance')
  @ApiOperation({ summary: '创建集团余额充值订单（FK）' })
  createRecharge(@Param('id', ParseIntPipe) id: number, @Body() body: GroupBalanceRechargeDto) {
    return this.service.createRechargeOrder(id, Number(body?.amount), body?.remark ?? null, Number(body?.memberIdForPayment));
  }
}
