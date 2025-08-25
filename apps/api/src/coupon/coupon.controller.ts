import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CouponService } from './coupon.service.js';

@ApiTags('Coupon')
@Controller('coupons')
export class CouponController {
    constructor(private readonly svc: CouponService) {}

    @Get('')
    list(@Query('groupId') groupIdStr?: string, @Query('type') type?: 'COUPON'|'WASH_CARD', @Query('enabled') enabledStr?: string){
        const groupId = groupIdStr !== undefined ? Number(groupIdStr) : undefined;
        const enabled = enabledStr !== undefined ? enabledStr === 'true' : undefined;
        return this.svc.listCoupons({ groupId, type: type || null, enabled: enabled as any });
    }
    @Get(':id') get(@Param('id', ParseIntPipe) id: number){ return this.svc.getCoupon(id); }
    @Post('') create(@Body() body: any){ return this.svc.createCoupon(body); }
    @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: any){ return this.svc.updateCoupon(id, body); }
    @Delete(':id') remove(@Param('id', ParseIntPipe) id: number){ return this.svc.deleteCoupon(id); }
}


