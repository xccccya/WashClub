import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service.js';
import { StoreCategoryCreateDto, StoreCategoryUpdateDto } from './category.dto.js';

@ApiTags('StoreCategory')
@Controller('store/categories')
export class StoreCategoryController {
    constructor(private readonly store: StoreService) {}

    @Get('')
    list(@Query('type') type?: string) { return this.store.listCategories({ type }); }

    @Post('')
    create(@Body() body: StoreCategoryCreateDto) {
        return this.store.createCategory(body);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: StoreCategoryUpdateDto) {
        return this.store.updateCategory(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.store.deleteCategory(id); }
}


