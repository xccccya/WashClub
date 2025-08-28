import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { OrderService } from './order.service.js';
import { TanshuService } from './tanshu.service.js';
import { OrderController } from './order.controller.js';
import { WxpayService } from './wxpay.service.js';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'dev_secret',
        })
    ],
    controllers: [OrderController],
    providers: [PrismaService, OrderService, TanshuService, WxpayService],
})
export class OrderModule {}


