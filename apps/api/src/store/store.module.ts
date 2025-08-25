import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { StoreService } from './store.service.js';
import { StoreCategoryController } from './category.controller.js';
import { StoreProductController } from './product.controller.js';
import { StoreInventoryController } from './inventory.controller.js';
import { FileService } from '../file/file.service.js';

@Module({
    imports: [],
    controllers: [StoreCategoryController, StoreProductController, StoreInventoryController],
    providers: [PrismaService, StoreService, FileService],
})
export class StoreModule {}


