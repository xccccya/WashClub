import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CouponService } from './coupon.service.js';

@ApiTags('CouponGroup')
@Controller('coupon/groups')
export class CouponGroupController {
    constructor(private readonly svc: CouponService) {}

    @Get('') list(){ return this.svc.listGroups(); }
    @Post('') create(@Body() body: { name: string; description?: string; enabled?: boolean; weight?: number }){ return this.svc.createGroup(body); }
    @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; description?: string | null; enabled?: boolean; weight?: number }){ return this.svc.updateGroup(id, body); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number){ return this.svc.deleteGroup(id); }
}


