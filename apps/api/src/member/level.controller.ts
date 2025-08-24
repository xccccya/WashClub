import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MemberLevelService } from './level.service.js';

@ApiTags('member-level')
@Controller('member-level')
export class MemberLevelController {
  constructor(private service: MemberLevelService) {}

  @Get()
  list() { return this.service.list(); }

  @Post()
  create(@Body() body: { name: string; weight: number; isDefault?: boolean }) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; weight?: number; isDefault?: boolean }) {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(Number(id)); }
}


