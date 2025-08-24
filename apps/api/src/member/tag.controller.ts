import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberTagService } from './tag.service.js';

@ApiTags('member-tag')
@Controller('member-tag')
export class MemberTagController {
	constructor(private service: MemberTagService) {}

	@Get()
	list() { return this.service.list(); }

	@Post()
	create(@Body() body: { name: string }) { return this.service.create(body); }

	@Put(':id')
	update(@Param('id') id: string, @Body() body: { name?: string }) { return this.service.update(Number(id), body); }

	@Delete(':id')
	remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

	@Get(':id/members')
	members(
		@Param('id') id: string,
		@Query('page') page?: string,
		@Query('pageSize') pageSize?: string,
		@Query('keyword') keyword?: string,
	) {
		return this.service.listMembers(Number(id), Number(page||1), Number(pageSize||20), keyword);
	}
}


