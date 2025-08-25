import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { OrderService } from './order.service.js';
import { OrderController } from './order.controller.js';

@Module({
    imports: [],
    controllers: [OrderController],
    providers: [PrismaService, OrderService],
})
export class OrderModule {}


