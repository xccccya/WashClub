import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponService } from './coupon.service.js';
import { CouponGroupCreateDto, CouponGroupUpdateDto } from './group.dto.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('CouponGroup')
@Controller('coupon/groups')
export class CouponGroupController {
    constructor(private readonly svc: CouponService) {}

    @Get('')
	@UseGuards(AdminGuard)
	@ApiBearerAuth()
	list(){ return this.svc.listGroups(); }

    @Post('')
	@UseGuards(AdminGuard)
	@RequirePerm('coupon-groups')
	@ApiBearerAuth()
	create(@Body() body: CouponGroupCreateDto){ return this.svc.createGroup(body); }

    @Put(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('coupon-groups')
	@ApiBearerAuth()
	update(@Param('id', ParseIntPipe) id: number, @Body() body: CouponGroupUpdateDto){ return this.svc.updateGroup(id, body); }

    @Delete(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('coupon-groups')
	@ApiBearerAuth()
	remove(@Param('id', ParseIntPipe) id: number){ return this.svc.deleteGroup(id); }
}


