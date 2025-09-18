import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from './queue.service.js';
import { QueueController } from './queue.controller.js';
import { QueueTypeService } from './queue-type.service.js';
import { QueueTypeController } from './queue-type.controller.js';
import { VehicleService } from '../member/vehicle.service.js';
import { JwtService } from '@nestjs/jwt';
import { FileModule } from '../file/file.module.js';
import { OrderModule } from '../order/order.module.js';
import { GroupService } from '../group/group.service.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
    imports: [FileModule, OrderModule, NotificationModule],
    providers: [PrismaService, QueueService, VehicleService, JwtService, QueueTypeService, GroupService],
    controllers: [QueueController, QueueTypeController],
})
export class QueueModule {}


