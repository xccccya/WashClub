import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { CouponService } from './coupon.service.js';
import { CouponGroupController } from './group.controller.js';
import { CouponController } from './coupon.controller.js';
import { MemberCouponAdminController } from './member-coupon.controller.js';
import { MiniappCouponController } from './miniapp.controller.js';

@Module({
    imports: [AuthModule, NotificationModule],
    controllers: [CouponGroupController, CouponController, MemberCouponAdminController, MiniappCouponController],
    providers: [CouponService],
})
export class CouponModule {}


