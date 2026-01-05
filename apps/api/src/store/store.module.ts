import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StoreService } from './store.service.js';
import { StoreCategoryController } from './category.controller.js';
import { StoreProductController } from './product.controller.js';
import { StoreInventoryController } from './inventory.controller.js';
import { FileModule } from '../file/file.module.js';
import { resolveJwtSecretEnv } from '../env.js';

@Module({
    imports: [
        JwtModule.register({
            secret: resolveJwtSecretEnv(),
        }),
        FileModule,
    ],
    controllers: [StoreCategoryController, StoreProductController, StoreInventoryController],
    providers: [StoreService],
})
export class StoreModule {}


