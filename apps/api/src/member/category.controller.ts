import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberCategoryService } from './category.service.js';

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
	create(@Body() body: { name: string; weight: number }) {
		return this.service.create(body);
	}

	@Put(':id')
	@ApiOperation({ summary: '更新会员分类' })
	update(@Param('id') id: string, @Body() body: { name?: string; weight?: number }) {
		return this.service.update(Number(id), body);
	}

	@Delete(':id')
	@ApiOperation({ summary: '删除会员分类' })
	remove(@Param('id') id: string) {
		return this.service.remove(Number(id));
	}
}



