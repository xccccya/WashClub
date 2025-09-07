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
  @RequirePerm('members')
  @ApiOperation({ summary: '查询签到日志（按会员或日期）' })
  list(@Query('memberId') memberId?: string, @Query('date') dateStr?: string) {
    return this.service.listLogs(memberId ? Number(memberId) : undefined, dateStr);
  }
}


