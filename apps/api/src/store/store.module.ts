import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { StoreService } from './store.service.js';
import { StoreCategoryController } from './category.controller.js';
import { StoreProductController } from './product.controller.js';
import { StoreInventoryController } from './inventory.controller.js';
import { FileService } from '../file/file.service.js';
import { AssetService } from '../file/asset.service.js';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'dev_secret',
        }),
    ],
    controllers: [StoreCategoryController, StoreProductController, StoreInventoryController],
    providers: [PrismaService, StoreService, FileService, AssetService],
})
export class StoreModule {}


