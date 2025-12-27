import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponService } from './coupon.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { UpdateMemberCouponExpiryDto } from './member-coupon.dto.js';

@ApiTags('MemberCoupons')
@Controller('member-coupons')
@UseGuards(AdminGuard)
export class MemberCouponAdminController {
    constructor(private readonly svc: CouponService) {}

    @Get('')
    @ApiOperation({ summary: '会员优惠券实例列表' })
    @RequirePerm('member-coupons')
    list(
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
        @Query('memberId') memberId?: string,
        @Query('couponId') couponId?: string,
        @Query('used') used?: '0'|'1',
        @Query('expired') expired?: '0'|'1',
    ){
        return this.svc.listMemberCoupons({ page: Number(page||1), pageSize: Number(pageSize||20), memberId: memberId? Number(memberId): null, couponId: couponId? Number(couponId): null, used: used ?? null, expired: expired ?? null });
    }

    @Get(':id')
    @ApiOperation({ summary: '会员优惠券详情' })
    @RequirePerm('member-coupons')
    get(@Param('id', ParseIntPipe) id: number){ return this.svc.getMemberCoupon(id); }

    @Put(':id/expiry')
    @ApiOperation({ summary: '修改有效期（开始/结束时间）' })
    @RequirePerm('member-coupons')
    updateExpiry(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateMemberCouponExpiryDto){
        const payload: any = {};
        if ('startAt' in (body||{})) payload.startAt = body.startAt ? new Date(body.startAt) : null;
        if ('endAt' in (body||{})) payload.endAt = body.endAt ? new Date(body.endAt) : null;
        return this.svc.updateMemberCouponExpiry(id, payload);
    }

    @Delete(':id')
    @ApiOperation({ summary: '删除会员优惠券实例' })
    @RequirePerm('member-coupons')
    remove(@Param('id', ParseIntPipe) id: number){ return this.svc.deleteMemberCoupon(id); }
}


