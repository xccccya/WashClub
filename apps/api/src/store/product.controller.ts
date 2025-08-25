import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service.js';
import { FileService } from '../file/file.service.js';

@ApiTags('StoreProduct')
@Controller('store/products')
export class StoreProductController {
    constructor(private readonly store: StoreService, private readonly files: FileService) {}

    @Get('')
    list(@Query('keyword') keyword?: string, @Query('categoryId') categoryIdStr?: string, @Query('type') type?: string, @Query('enabled') enabledStr?: string) {
        const categoryId = categoryIdStr !== undefined ? Number(categoryIdStr) : undefined;
        const enabled = enabledStr !== undefined ? enabledStr === 'true' : undefined;
        return this.store.listProducts({ keyword, categoryId, type, enabled });
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) { return this.store.getProduct(id); }

    @Post('')
    create(@Body() body: any) { return this.store.createProduct(body); }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.store.updateProduct(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.store.deleteProduct(id); }

    // 复用已有文件上传用于商品图片
    @Post(':id/upload-image')
    async uploadImage(){
        // 控制器层仅占位，文件上传由全局 /file/upload 提供
        return { message: '请使用 /file/upload 上传文件后，将返回的 url 保存到 product.imageUrl 或 sku.imageUrl' };
    }
}


