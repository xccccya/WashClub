import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberCategoryService } from './category.service.js';
import { CreateMemberCategoryDto, UpdateMemberCategoryDto } from './category.dto.js';

@ApiTags('member-category')
@Controller('member-category')
export class MemberCategoryController {
	constructor(private service: MemberCategoryService) {}

	@Get()
	@ApiOperation({ summary: '会员分类列表' })
	list() {
		return this.service.list();
	}

	@Post()
	@ApiOperation({ summary: '创建会员分类' })
	create(@Body() body: CreateMemberCategoryDto) {
		return this.service.create(body as any);
	}

	@Put(':id')
	@ApiOperation({ summary: '更新会员分类' })
	update(@Param('id') id: string, @Body() body: UpdateMemberCategoryDto) {
		return this.service.update(Number(id), body as any);
	}

	@Delete(':id')
	@ApiOperation({ summary: '删除会员分类' })
	remove(@Param('id') id: string) {
		return this.service.remove(Number(id));
	}
}



