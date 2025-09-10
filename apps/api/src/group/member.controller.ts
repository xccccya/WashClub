import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { GroupMemberService } from './member.service.js';

@ApiTags('GroupMember')
@Controller('group/:id/members')
@UseGuards(AdminGuard)
export class GroupMemberController {
  constructor(private service: GroupMemberService) {}

  @Get('')
  @RequirePerm('group')
  list(@Param('id', ParseIntPipe) id: number) {
    return this.service.list(id);
  }

  @Post('')
  @RequirePerm('group')
  @ApiOperation({ summary: '添加成员（可批量）' })
  add(@Param('id', ParseIntPipe) id: number, @Body() body: { memberIds: number[] }) {
    const ids = Array.isArray(body?.memberIds) ? body.memberIds.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [];
    if (ids.length === 0) throw new BadRequestException('缺少成员');
    return this.service.addMembers(id, ids);
  }

  @Delete(':memberId')
  @RequirePerm('group')
  remove(@Param('id', ParseIntPipe) id: number, @Param('memberId', ParseIntPipe) memberId: number) {
    return this.service.removeMember(id, memberId);
  }

  @Patch(':memberId/admin')
  @RequirePerm('group')
  setAdmin(@Param('id', ParseIntPipe) id: number, @Param('memberId', ParseIntPipe) memberId: number, @Body() body: { isAdmin: boolean }) {
    return this.service.setAdmin(id, memberId, !!body?.isAdmin);
  }
}
