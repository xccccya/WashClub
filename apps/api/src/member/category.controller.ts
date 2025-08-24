import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberCategoryService } from './category.service.js';

@ApiTags('member-category')
@Controller('member-category')
export class MemberCategoryController {
	constructor(private service: MemberCategoryService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Post()
	create(@Body() body: { name: string; weight: number }) {
		return this.service.create(body);
	}

	@Put(':id')
	update(@Param('id') id: string, @Body() body: { name?: string; weight?: number }) {
		return this.service.update(Number(id), body);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.service.remove(Number(id));
	}
}



