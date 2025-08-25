import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service.js';

@ApiTags('StoreInventory')
@Controller('store/inventory')
export class StoreInventoryController {
    constructor(private readonly store: StoreService) {}

    @Post('adjust')
    adjust(@Body() body: { productId: number; skuId?: number | null; change: number; reason: string; remark?: string | null; operatorUserId?: number | null }) {
        return this.store.adjustInventory(body);
    }
}


