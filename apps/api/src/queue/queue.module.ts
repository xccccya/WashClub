import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { QueueService } from './queue.service.js';
import { QueueController } from './queue.controller.js';
import { VehicleService } from '../member/vehicle.service.js';
import { JwtService } from '@nestjs/jwt';
import { FileService } from '../file/file.service.js';
import { AssetService } from '../file/asset.service.js';

@Module({
    providers: [PrismaService, QueueService, VehicleService, JwtService, FileService, AssetService],
    controllers: [QueueController],
})
export class QueueModule {}


