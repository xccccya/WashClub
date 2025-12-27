import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponService } from './coupon.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { CouponCreateDto, CouponIssueDto, CouponUpdateDto } from './coupon.dto.js';

@ApiTags('Coupon')
@Controller('coupons')
@UseGuards(AdminGuard)
export class CouponController {
    constructor(private readonly svc: CouponService) {}

    // 注意：将静态路由放在动态 :id 之前，避免被错误匹配
    @Get('logs')
    @ApiOperation({ summary: '卡券流水列表' })
    @RequirePerm('coupon-logs')
    listLogs(
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
        @Query('memberId') memberId?: string,
        @Query('orderId') orderId?: string,
    ){
        return this.svc.listCouponLogs({ page: Number(page||1), pageSize: Number(pageSize||20), memberId: memberId? Number(memberId): null, orderId: orderId? Number(orderId): null });
    }

    @Get('')
    @ApiOperation({ summary: '卡券列表' })
    @RequirePerm('coupons')
    list(@Query('groupId') groupIdStr?: string, @Query('type') type?: 'COUPON'|'WASH_CARD'|'GROUP_WASH_CARD', @Query('enabled') enabledStr?: string){
        const groupId = groupIdStr !== undefined ? Number(groupIdStr) : undefined;
        const enabled = enabledStr !== undefined ? enabledStr === 'true' : undefined;
        return this.svc.listCoupons({ groupId, type: type || null, enabled: enabled as any });
    }
    @Get(':id')
    @ApiOperation({ summary: '卡券详情' })
    @RequirePerm('coupons')
    get(@Param('id', ParseIntPipe) id: number){ return this.svc.getCoupon(id); }
    @Post('')
    @ApiOperation({ summary: '创建卡券' })
    @RequirePerm('coupons')
    create(@Body() body: CouponCreateDto){ return this.svc.createCoupon(body); }
    @Put(':id')
    @ApiOperation({ summary: '更新卡券' })
    @RequirePerm('coupons')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: CouponUpdateDto){ return this.svc.updateCoupon(id, body); }
    @Delete(':id')
    @ApiOperation({ summary: '删除卡券' })
    @RequirePerm('coupons')
    remove(@Param('id', ParseIntPipe) id: number){ return this.svc.deleteCoupon(id); }

    // 发放给指定会员
    @Post(':id/issue')
    @ApiOperation({ summary: '发放优惠券到指定会员' })
    @RequirePerm('coupons')
    issue(@Param('id', ParseIntPipe) id: number, @Body() body: CouponIssueDto){
        return this.svc.issueToMember({ couponId: id, memberId: Number(body.memberId), count: Number(body?.count||1) });
    }

}


