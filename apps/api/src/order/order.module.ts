import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaService } from '../prisma.service.js';
import { OrderService } from './order.service.js';
import { OrderPaymentService } from './order-payment.service.js';
import { OrderRefundService } from './order-refund.service.js';
import { OrderAfterSalesService } from './order-aftersales.service.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { OrderReviewService } from './order-review.service.js';
import { OrderRewardsService } from './order-rewards.service.js';
import { TanshuService } from './tanshu.service.js';
import { OrderController } from './order.controller.js';
import { WxpayService } from './wxpay.service.js';
import { OrderTimeoutService } from './timeout.service.js';
import { WechatShippingService } from './wechat-shipping.service.js';
import { CouponService } from '../coupon/coupon.service.js';
import { FileModule } from '../file/file.module.js';
import { MemberModule } from '../member/member.module.js';
import { GroupModule } from '../group/group.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { resolveJwtSecretEnv } from '../env.js';

@Module({
    imports: [
        AuthModule,
        FileModule,
        MemberModule,
        GroupModule,
        NotificationModule,
        JwtModule.register({
            secret: resolveJwtSecretEnv(),
        })
    ],
    controllers: [OrderController],
    providers: [
        PrismaService, 
        CouponService, 
        OrderService, 
        OrderPaymentService,
        OrderRefundService,
        OrderAfterSalesService,
        OrderFulfillmentService,
        OrderReviewService,
        OrderRewardsService,
        TanshuService, 
        WxpayService, 
        OrderTimeoutService, 
        WechatShippingService
    ],
    exports: [OrderService]
})
export class OrderModule {}


