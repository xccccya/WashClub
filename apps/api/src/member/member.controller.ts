import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MemberService } from './member.service.js';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { AdminOrEmployeeGuard } from '../auth/admin-or-employee.guard.js';
import { AdjustMemberGrowthDto, CreateMemberDto, SetMemberPasswordDto, UpdateMemberDto, UpdateMemberSelfDto } from './member.dto.js';
import { extractBearerToken, extractBearerTokenFromHeaders } from '../auth/bearer.js';
import { AllowEmployee } from '../auth/allow-employee.decorator.js';

@ApiTags('member')
@Controller('member')
export class MemberController {
	constructor(private service: MemberService, private jwt: JwtService) {}

	@Get('list')
	@ApiOperation({ summary: '会员列表（分页/关键词）' })
	@ApiQuery({ name: 'hasRemainingWashCard', required: false, type: String })
	@UseGuards(AdminOrEmployeeGuard)
	@AllowEmployee()
	@RequirePerm('members')
	list(
		@Query('page') page?: string,
		@Query('pageSize') pageSize?: string,
		@Query('keyword') keyword?: string,
		@Query('hasRemainingWashCard') hasRemainingWashCard?: string,
		@Query('levelId') levelId?: string,
		@Query('categoryId') categoryId?: string,
		@Query('tagId') tagId?: string,
		@Query('createdFrom') createdFrom?: string,
		@Query('createdTo') createdTo?: string,
		@Query('activeFrom') activeFrom?: string,
		@Query('activeTo') activeTo?: string,
		@Query('excludePlaceholders') excludePlaceholders?: string,
		@Query('sortBy') sortBy?: string,
		@Query('sortOrder') sortOrder?: string,
	) {
		return this.service.list({
			page: Number(page || 1),
			pageSize: Number(pageSize || 20),
			keyword,
			hasRemainingWashCard: hasRemainingWashCard === '1' || hasRemainingWashCard === 'true',
			levelId: levelId != null ? Number(levelId) : undefined,
			categoryId: categoryId != null ? Number(categoryId) : undefined,
			tagId: tagId != null ? Number(tagId) : undefined,
			createdFrom,
			createdTo,
			activeFrom,
			activeTo,
			excludePlaceholders: excludePlaceholders === '1' || excludePlaceholders === 'true',
			sortBy,
			sortOrder,
		});
	}

	@Post('_sync-guest-owner')
	@UseGuards(AdminGuard)
	@RequirePerm('members')
	@ApiOperation({ summary: '同步游客订单占位账号（根据环境变量 GUEST_MEMBER_ID）' })
	async syncGuestOrderOwner() {
		return this.service.syncGuestOrderOwnerByEnv();
	}

	@Get('_guest-owner')
	@UseGuards(AdminGuard)
	@RequirePerm('members')
	@ApiOperation({ summary: '获取当前游客订单占位账号信息（根据环境变量）' })
	async getGuestOrderOwner() {
		return this.service.getGuestOrderOwnerByEnv();
	}

	// 放在参数路由之前，避免被 ":id" 匹配到
	@Get('me/profile')
	@ApiOperation({ summary: '查询当前会员资料' })
	me(@Headers() headers: Record<string, string>) {
		const token = extractBearerTokenFromHeaders(headers as any) || '';
		return this.service.getProfileByToken(token);
	}

	@Put('me/profile')
	@ApiOperation({ summary: '当前会员修改自己的昵称或头像' })
	@ApiOkResponse({ schema: { type: 'object', additionalProperties: true } })
	updateMe(@Headers() headers: Record<string, string>, @Body() body: UpdateMemberSelfDto) {
		if (Object.prototype.hasOwnProperty.call(body, 'name')) {
			const name = String(body.name ?? '').trim();
			if (!name) throw new BadRequestException('昵称不能为空');
			if (Array.from(name).length > 10) throw new BadRequestException('昵称长度不可超过10个字符');
		}
		const token = extractBearerTokenFromHeaders(headers as any) || '';
		return this.service.updateProfileByToken(token, body);
	}

	@Get('me/growth-logs')
	@ApiOperation({ summary: '查询当前会员成长值日志（持久化）' })
	getGrowthLogs(@Headers() headers: Record<string, string>, @Query('limit') limitStr?: string){
		const token = extractBearerTokenFromHeaders(headers as any) || '';
		const limit = limitStr ? Number(limitStr) : undefined;
		return (this.service as any).getGrowthLogsByToken(token, limit);
	}

	@Get('me/points-logs')
	@ApiOperation({ summary: '查询当前会员积分日志（持久化）' })
	getPointsLogs(@Headers() headers: Record<string, string>, @Query('limit') limitStr?: string){
		const token = extractBearerTokenFromHeaders(headers as any) || '';
		const limit = limitStr ? Number(limitStr) : undefined;
		return (this.service as any).getPointsLogsByToken(token, limit);
	}

	@Get('me/points-stats')
	@ApiOperation({ summary: '查询当前会员积分统计（当前/本月使用/本月获得）' })
	getPointsStats(@Headers() headers: Record<string, string>){
		const token = extractBearerTokenFromHeaders(headers as any) || '';
		return (this.service as any).getPointsStatsByToken(token);
	}

	@Get(':id/growth-logs')
	@ApiOperation({ summary: '根据会员ID查询成长值日志（管理后台使用）' })
	@UseGuards(AdminGuard)
	@RequirePerm('members')
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
		@Body() body: AdjustMemberGrowthDto,
		@Headers('authorization') authHeader?: string,
	){
		// 读取管理员ID（由守卫保证为管理员）
		const token = extractBearerToken(authHeader) || '';
		let operatorUserId: number | null = null;
		try{ const decoded:any = this.jwt.verify(token); operatorUserId = Number(decoded?.sub)||null; }catch{}
		return (this.service as any).adjustGrowthByAdmin(Number(id), Number(body?.delta||0), (body?.remark??null), operatorUserId ?? null);
	}

	@Post('me/active')
	@ApiOperation({ summary: '心跳：设置会员在线活跃状态' })
	setActive(@Headers() headers: Record<string, string>) {
		const token = extractBearerTokenFromHeaders(headers as any) || '';
		return this.service.setActiveByToken(token);
	}

	@Get(':id')
	@ApiOperation({ summary: '获取会员详情' })
	@UseGuards(AdminOrEmployeeGuard)
	@AllowEmployee()
	@RequirePerm('members')
	get(@Param('id') id: string) {
		const n = Number(id);
		if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('会员ID无效');
		return this.service.findById(n);
	}

	@Post('create')
	@ApiOperation({ summary: '创建会员' })
	@UseGuards(AdminGuard)
	@RequirePerm('members')
	create(
		@Body()
		body: CreateMemberDto,
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
	@UseGuards(AdminGuard)
	@RequirePerm('members')
	update(
		@Param('id') id: string,
		@Body()
		body: UpdateMemberDto,
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
	@UseGuards(AdminGuard)
	@RequirePerm('members')
	setPassword(@Param('id') id: string, @Body() body: SetMemberPasswordDto) {
		return this.service.setPassword(Number(id), body.password);
	}

	@Delete(':id')
	@ApiOperation({ summary: '删除会员' })
	@UseGuards(AdminGuard)
	@RequirePerm('members')
	remove(@Param('id') id: string) {
		return this.service.remove(Number(id));
	}
}


