import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { CouponService } from './coupon.service.js';
import { CouponGroupController } from './group.controller.js';
import { CouponController } from './coupon.controller.js';
import { MemberCouponAdminController } from './member-coupon.controller.js';

@Module({
    imports: [AuthModule],
    controllers: [CouponGroupController, CouponController, MemberCouponAdminController],
    providers: [PrismaService, CouponService],
})
export class CouponModule {}


