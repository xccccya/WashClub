import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberService } from './member.service.js';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('member')
@Controller('member')
export class MemberController {
	constructor(private service: MemberService, private jwt: JwtService) {}

	@Get('list')
	@ApiOperation({ summary: '会员列表（分页/关键词）' })
	list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
		return this.service.list(Number(page || 1), Number(pageSize || 20), keyword);
	}

	// 放在参数路由之前，避免被 ":id" 匹配到
	@Get('me/profile')
	@ApiOperation({ summary: '查询当前会员资料（支持token参数）' })
	me(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
		const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
		const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
		return this.service.getProfileByToken(token);
	}

	@Get('me/growth-logs')
	@ApiOperation({ summary: '查询当前会员成长值日志（持久化）' })
	getGrowthLogs(@Headers() headers: Record<string, string>, @Query('limit') limitStr?: string, @Query('token') tokenParam?: string){
		const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
		const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
		const limit = limitStr ? Number(limitStr) : undefined;
		return (this.service as any).getGrowthLogsByToken(token, limit);
	}

	@Get(':id/growth-logs')
	@ApiOperation({ summary: '根据会员ID查询成长值日志（管理后台使用）' })
	getGrowthLogsByMember(@Param('id') id: string, @Query('limit') limitStr?: string){
		const limit = limitStr ? Number(limitStr) : undefined;
		return (this.service as any).getGrowthLogsByMemberId(Number(id), limit);
	}

	@Post(':id/growth-adjust')
	@UseGuards(AdminGuard)
	@RequirePerm('members')
	@ApiOperation({ summary: '管理员手动调整成长值（正负均可），记录备注' })
	adjustGrowth(
		@Param('id') id: string,
		@Body() body: { delta: number; remark?: string|null },
		@Headers('authorization') authHeader?: string,
	){
		// 读取管理员ID（由守卫保证为管理员）
		const token = (authHeader||'').replace(/^Bearer\s+/i,'');
		let operatorUserId: number | null = null;
		try{ const decoded:any = this.jwt.verify(token); operatorUserId = Number(decoded?.sub)||null; }catch{}
		return (this.service as any).adjustGrowthByAdmin(Number(id), Number(body?.delta||0), (body?.remark??null), operatorUserId ?? null);
	}

	@Post('me/active')
	@ApiOperation({ summary: '心跳：设置会员在线活跃状态' })
	setActive(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
		const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
		const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
		return this.service.setActiveByToken(token);
	}

	@Get(':id')
	@ApiOperation({ summary: '获取会员详情' })
	get(@Param('id') id: string) {
		return this.service.findById(Number(id));
	}

	@Post('create')
	@ApiOperation({ summary: '创建会员' })
	create(
		@Body()
		body: {
			name: string;
			phone: string;
			password?: string;
			points?: number;
			balance?: number;
			levelId?: number;
			categoryId?: number;
			tagIds?: number[];
			avatarUrl?: string | null;
		},
	) {
		// 昵称长度校验：≤10 个字符（按 Unicode 码点计）
		const nameTrim = String(body?.name || '').trim();
		if (!nameTrim) throw new BadRequestException('昵称不能为空');
		if (Array.from(nameTrim).length > 10) throw new BadRequestException('昵称长度不可超过10个字符');
		if (!body?.levelId) throw new BadRequestException('会员等级为必选项');
		if (!body?.categoryId) throw new BadRequestException('会员分类为必选项');
		return this.service.create(body);
	}

	@Put(':id')
	@ApiOperation({ summary: '更新会员资料' })
	update(
		@Param('id') id: string,
		@Body()
		body: {
			name?: string;
			phone?: string;
			password?: string;
			points?: number;
			balance?: number;
			levelId?: number | null;
			categoryId?: number | null;
			tagIds?: number[];
			avatarUrl?: string | null;
		},
	) {
		// 若传入 name，则进行长度与非空校验
		if (Object.prototype.hasOwnProperty.call(body, 'name')) {
			const nameTrim = String(body?.name ?? '').trim();
			if (!nameTrim) throw new BadRequestException('昵称不能为空');
			if (Array.from(nameTrim).length > 10) throw new BadRequestException('昵称长度不可超过10个字符');
		}
		// 仅当显式传入这些字段时才强制校验；
		if (Object.prototype.hasOwnProperty.call(body, 'levelId') && body.levelId == null)
			throw new BadRequestException('会员等级为必选项');
		if (Object.prototype.hasOwnProperty.call(body, 'categoryId') && body.categoryId == null)
			throw new BadRequestException('会员分类为必选项');
		return this.service.update(Number(id), body);
	}

	@Put(':id/password')
	@ApiOperation({ summary: '设置/重置会员密码（管理员）' })
	setPassword(@Param('id') id: string, @Body() body: { password: string }) {
		return this.service.setPassword(Number(id), body.password);
	}

	@Delete(':id')
	@ApiOperation({ summary: '删除会员' })
	remove(@Param('id') id: string) {
		return this.service.remove(Number(id));
	}
}


