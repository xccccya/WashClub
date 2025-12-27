import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CouponService } from './coupon.service.js';
import { CouponGroupCreateDto, CouponGroupUpdateDto } from './group.dto.js';

@ApiTags('CouponGroup')
@Controller('coupon/groups')
export class CouponGroupController {
    constructor(private readonly svc: CouponService) {}

    @Get('') list(){ return this.svc.listGroups(); }
    @Post('') create(@Body() body: CouponGroupCreateDto){ return this.svc.createGroup(body); }
    @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: CouponGroupUpdateDto){ return this.svc.updateGroup(id, body); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number){ return this.svc.deleteGroup(id); }
}


