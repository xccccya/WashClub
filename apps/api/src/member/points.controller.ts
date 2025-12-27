import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberPointsService } from './points.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { MemberPointsAdjustDto, MemberPointsSaveConfigDto } from './points.dto.js';

@ApiTags('member-points')
@Controller('member-points')
export class MemberPointsController {
  constructor(private service: MemberPointsService) {}

  @Get('config')
  @UseGuards(AdminGuard)
  @RequirePerm('member-points')
  @ApiOperation({ summary: '获取积分配置' })
  getConfig(){ return this.service.getConfig(); }

  @Post('config')
  @UseGuards(AdminGuard)
  @RequirePerm('member-points')
  @ApiOperation({ summary: '保存积分配置' })
  save(@Body() body: MemberPointsSaveConfigDto){ return this.service.saveConfig(body); }

  @Get('logs')
  @UseGuards(AdminGuard)
  @RequirePerm('member-points')
  @ApiOperation({ summary: '查询积分日志' })
  listLogs(@Query('memberId') memberId?: string, @Query('source') source?: string){ return this.service.listLogs({ memberId: memberId ? Number(memberId) : undefined, source }); }

  @Post('adjust')
  @UseGuards(AdminGuard)
  @RequirePerm('member-points')
  @ApiOperation({ summary: '后台调整指定会员积分（正负均可）' })
  adjust(@Body() body: MemberPointsAdjustDto){
    return this.service.adjustByAdmin(Number(body?.memberId||0), Number(body?.delta||0), body?.remark ?? null, body?.operatorUserId ?? null);
  }
}


