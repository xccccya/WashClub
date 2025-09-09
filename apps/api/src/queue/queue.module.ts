import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from './queue.service.js';
import { QueueController } from './queue.controller.js';
import { VehicleService } from '../member/vehicle.service.js';
import { JwtService } from '@nestjs/jwt';
import { FileModule } from '../file/file.module.js';

@Module({
    imports: [FileModule],
    providers: [PrismaService, QueueService, VehicleService, JwtService],
    controllers: [QueueController],
})
export class QueueModule {}


