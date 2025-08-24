import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberService } from './member.service.js';

@ApiTags('member')
@Controller('member')
export class MemberController {
	constructor(private service: MemberService) {}

	@Get('list')
	list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
		return this.service.list(Number(page || 1), Number(pageSize || 20), keyword);
	}

	// 放在参数路由之前，避免被 ":id" 匹配到
	@Get('me/profile')
	me(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
		const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
		const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
		return this.service.getProfileByToken(token);
	}

	@Post('me/active')
	setActive(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
		const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
		const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
		return this.service.setActiveByToken(token);
	}

	@Get(':id')
	get(@Param('id') id: string) {
		return this.service.findById(Number(id));
	}

	@Post('create')
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
	setPassword(@Param('id') id: string, @Body() body: { password: string }) {
		return this.service.setPassword(Number(id), body.password);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.service.remove(Number(id));
	}
}


