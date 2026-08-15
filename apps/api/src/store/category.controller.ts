import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service.js';
import { StoreCategoryCreateDto, StoreCategoryUpdateDto } from './category.dto.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('StoreCategory')
@Controller('store/categories')
export class StoreCategoryController {
    constructor(private readonly store: StoreService) {}

    @Get('')
    list(@Query('type') type?: string) { return this.store.listCategories({ type }); }

    @Post('')
	@UseGuards(AdminGuard)
	@RequirePerm('store-categories')
	@ApiBearerAuth()
    create(@Body() body: StoreCategoryCreateDto) {
        return this.store.createCategory(body);
    }

    @Put(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('store-categories')
	@ApiBearerAuth()
    update(@Param('id', ParseIntPipe) id: number, @Body() body: StoreCategoryUpdateDto) {
        return this.store.updateCategory(id, body);
    }

    @Delete(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('store-categories')
	@ApiBearerAuth()
    remove(@Param('id', ParseIntPipe) id: number) { return this.store.deleteCategory(id); }
}


