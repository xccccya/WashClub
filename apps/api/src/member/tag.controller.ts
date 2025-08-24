import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
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
}


