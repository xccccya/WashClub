import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { GroupService } from './group.service.js';

@ApiTags('Group')
@Controller('group')
@UseGuards(AdminGuard)
export class GroupController {
  constructor(private service: GroupService) {}

  @Post('')
  @RequirePerm('group')
  @ApiOperation({ summary: '创建集团（含首位管理员）' })
  create(@Body() body: { name: string; iconUrl?: string | null; firstAdminMemberId: number; remark?: string | null }) {
    if (!body?.name) throw new BadRequestException('缺少名称');
    if (!body?.firstAdminMemberId) throw new BadRequestException('缺少首位管理员');
    return this.service.create({ name: body.name, iconUrl: body.iconUrl ?? null, firstAdminMemberId: Number(body.firstAdminMemberId), remark: body.remark ?? null });
  }

  @Get('')
  @RequirePerm('group')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: 'createdAt'|'name'|'balance',
    @Query('sortOrder') sortOrder?: 'asc'|'desc',
  ) {
    const p = Math.max(1, Number(page || 1));
    const ps = Math.max(1, Math.min(100, Number(pageSize || 20)));
    return this.service.list(p, ps, keyword || undefined, sortBy, sortOrder);
  }

  @Get(':id')
  @RequirePerm('group')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }

  @Patch(':id')
  @RequirePerm('group')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string | null; iconUrl?: string | null; remark?: string | null }) {
    return this.service.updateBasic(id, { name: body?.name ?? undefined, iconUrl: body?.iconUrl ?? undefined, remark: body?.remark ?? undefined });
  }

  @Delete(':id')
  @RequirePerm('group')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
