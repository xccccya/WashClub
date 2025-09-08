import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberSignInService } from './signin.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('member-signin')
@Controller('member-signin')
export class MemberSignInController {
  constructor(private service: MemberSignInService) {}

  // 会员自助签到（小程序后续复用）：从 token 取会员身份
  @Post('me')
  @ApiOperation({ summary: '会员签到（自助）' })
  async signInMe(@Headers('authorization') authHeader?: string) {
    const m = /^Bearer\s+(.+)$/.exec(String(authHeader||''));
    const token = m?.[1];
    if (!token) throw new UnauthorizedException('未登录');
    return this.service.signInByToken(token);
  }

  // 管理员代为签到
  @Post('by-admin')
  @UseGuards(AdminGuard)
  @RequirePerm('members')
  @ApiOperation({ summary: '管理员代为签到' })
  signInByAdmin(@Body() body: { memberId: number }) {
    return this.service.signInByAdmin(Number(body?.memberId));
  }

  // 查询签到记录（简单统计）
  @Get('logs')
  @UseGuards(AdminGuard)
  @RequirePerm('member-signins')
  @ApiOperation({ summary: '查询签到日志（按会员或日期）' })
  list(@Query('memberId') memberId?: string, @Query('date') dateStr?: string) {
    return this.service.listLogs(memberId ? Number(memberId) : undefined, dateStr);
  }

  // 会员：获取签到状态与今日奖励
  @Get('me/status')
  @ApiOperation({ summary: '会员签到状态（自助）' })
  async meStatus(@Headers('authorization') authHeader?: string){
    const m = /^Bearer\s+(.+)$/.exec(String(authHeader||''));
    const token = m?.[1];
    if (!token) throw new UnauthorizedException('未登录');
    return this.service.getStatusByToken(token);
  }

  // 会员：按月获取签到日历
  @Get('me/month')
  @ApiOperation({ summary: '会员签到日历（自助）' })
  async meMonth(@Headers('authorization') authHeader?: string, @Query('ym') ym?: string){
    const m = /^Bearer\s+(.+)$/.exec(String(authHeader||''));
    const token = m?.[1];
    if (!token) throw new UnauthorizedException('未登录');
    return this.service.getMonthByToken(token, ym);
  }

  // 管理后台：读取/保存签到配置
  @Get('config')
  @UseGuards(AdminGuard)
  @RequirePerm('member-signins')
  @ApiOperation({ summary: '读取签到奖励配置' })
  getConfig(){ return this.service.getConfigForAdmin(); }

  @Post('config')
  @UseGuards(AdminGuard)
  @RequirePerm('member-signins')
  @ApiOperation({ summary: '保存签到奖励配置' })
  saveConfig(@Body() body: { dayRewards: number[]; after7: number }){ return this.service.saveConfigForAdmin(body); }

  // 管理后台：查询指定会员的签到统计状态
  @Get('member-status')
  @UseGuards(AdminGuard)
  @RequirePerm('member-signins')
  @ApiOperation({ summary: '查询会员签到统计状态' })
  getMemberStatus(@Query('memberId') memberId?: string){
    const id = Number(memberId||0); if (!id) throw new UnauthorizedException('memberId无效');
    return this.service.getStatusByMember(id);
  }
}


