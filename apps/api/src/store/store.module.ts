import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StoreService } from './store.service.js';
import { StoreCategoryController } from './category.controller.js';
import { StoreProductController } from './product.controller.js';
import { StoreInventoryController } from './inventory.controller.js';
import { FileModule } from '../file/file.module.js';
import { resolveJwtSecretEnv } from '../env.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
    imports: [
        JwtModule.register({
            secret: resolveJwtSecretEnv(),
        }),
        FileModule,
		AuthModule,
    ],
    controllers: [StoreCategoryController, StoreProductController, StoreInventoryController],
    providers: [StoreService],
})
export class StoreModule {}


