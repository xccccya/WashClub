import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CouponService } from './coupon.service.js';
import { CouponGroupController } from './group.controller.js';
import { CouponController } from './coupon.controller.js';

@Module({
    imports: [],
    controllers: [CouponGroupController, CouponController],
    providers: [PrismaService, CouponService],
})
export class CouponModule {}


