import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberTagService } from './tag.service.js';

@ApiTags('member-tag')
@Controller('member-tag')
export class MemberTagController {
	constructor(private service: MemberTagService) {}

	@Get()
	@ApiOperation({ summary: '会员标签列表' })
	list() { return this.service.list(); }

	@Post()
	@ApiOperation({ summary: '创建会员标签' })
	create(@Body() body: { name: string }) { return this.service.create(body); }

	@Put(':id')
	@ApiOperation({ summary: '更新会员标签' })
	update(@Param('id') id: string, @Body() body: { name?: string }) { return this.service.update(Number(id), body); }

	@Delete(':id')
	@ApiOperation({ summary: '删除会员标签' })
	remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

	@Get(':id/members')
	@ApiOperation({ summary: '标签下的会员列表（分页/关键词）' })
	members(
		@Param('id') id: string,
		@Query('page') page?: string,
		@Query('pageSize') pageSize?: string,
		@Query('keyword') keyword?: string,
	) {
		return this.service.listMembers(Number(id), Number(page||1), Number(pageSize||20), keyword);
	}
}


