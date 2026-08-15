import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberCategoryService } from './category.service.js';
import { CreateMemberCategoryDto, UpdateMemberCategoryDto } from './category.dto.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('member-category')
@Controller('member-category')
export class MemberCategoryController {
	constructor(private service: MemberCategoryService) {}

	@Get()
	@UseGuards(AdminGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: '会员分类列表' })
	list() {
		return this.service.list();
	}

	@Post()
	@UseGuards(AdminGuard)
	@RequirePerm('member-categories')
	@ApiBearerAuth()
	@ApiOperation({ summary: '创建会员分类' })
	create(@Body() body: CreateMemberCategoryDto) {
		return this.service.create(body as any);
	}

	@Put(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('member-categories')
	@ApiBearerAuth()
	@ApiOperation({ summary: '更新会员分类' })
	update(@Param('id') id: string, @Body() body: UpdateMemberCategoryDto) {
		return this.service.update(Number(id), body as any);
	}

	@Delete(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('member-categories')
	@ApiBearerAuth()
	@ApiOperation({ summary: '删除会员分类' })
	remove(@Param('id') id: string) {
		return this.service.remove(Number(id));
	}
}



