import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { GroupCardService } from './card.service.js';

@ApiTags('GroupCard')
@Controller('group/:id/cards')
@UseGuards(AdminGuard)
export class GroupCardController {
  constructor(private service: GroupCardService) {}

  @Get('')
  @RequirePerm('group-cards' as any)
  list(@Param('id', ParseIntPipe) id: number) {
    return this.service.list(id);
  }

  @Post('')
  @RequirePerm('group-cards' as any)
  @ApiOperation({ summary: '新购集团洗车卡（直接入账次数）' })
  create(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string | null; totalTimes: number; remainingTimes?: number | null; expiryAt?: string | null; cardNo?: string | null }) {
    return this.service.create(id, { ...body, totalTimes: Number(body?.totalTimes || 0), remainingTimes: (body?.remainingTimes ?? null) as any });
  }

  @Post(':cardId/add')
  @RequirePerm('group-cards' as any)
  @ApiOperation({ summary: '集团洗车卡加次（后台）' })
  add(@Param('id', ParseIntPipe) id: number, @Param('cardId', ParseIntPipe) cardId: number, @Body() body: { count: number; remark?: string | null }) {
    return this.service.addTimes(cardId, Number(body?.count || 0), { remark: body?.remark ?? null });
  }

  @Post(':cardId/consume')
  @RequirePerm('group-cards' as any)
  @ApiOperation({ summary: '集团洗车卡扣次（后台/收银台）' })
  consume(
    @Param('id', ParseIntPipe) id: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() body: { times: number; reason?: 'SERVICE_DEDUCT'|'REFUND_DEDUCT'|'BACKEND_DEDUCT'; vehicleId?: number | null; memberId?: number | null; remark?: string | null; serviceOrderId?: number | null; refundRecordId?: number | null; purchaseOrderId?: number | null }
  ) {
    return this.service.consume(cardId, Number(body?.times || 0), { reason: (body?.reason || 'SERVICE_DEDUCT') as any, vehicleId: body?.vehicleId ?? null, memberId: body?.memberId ?? null, remark: body?.remark ?? null, serviceOrderId: body?.serviceOrderId ?? null, refundRecordId: body?.refundRecordId ?? null, purchaseOrderId: body?.purchaseOrderId ?? null });
  }

  @Get(':cardId/logs')
  @RequirePerm('group-cards' as any)
  @ApiOperation({ summary: '集团洗车卡日志列表' })
  logs(
    @Param('id', ParseIntPipe) id: number,
    @Param('cardId', ParseIntPipe) cardId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listLogs(cardId, Number(page || 1), Number(pageSize || 10));
  }

  @Delete(':cardId')
  @RequirePerm('group-cards' as any)
  @ApiOperation({ summary: '删除集团洗车卡' })
  remove(@Param('id', ParseIntPipe) id: number, @Param('cardId', ParseIntPipe) cardId: number) {
    return this.service.remove(id, cardId);
  }
}
