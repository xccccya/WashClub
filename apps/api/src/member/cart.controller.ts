import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service.js';
import { CartMyAddDto, CartMyUpdateDto, CartToggleAllDto } from './cart.dto.js';

@ApiTags('cart')
@Controller('cart')
export class CartController {
    constructor(private service: CartService) {}

    private extractToken(headers: Record<string, string>) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        return (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || '';
    }

    @Get('me/list')
    @ApiOperation({ summary: '我的购物车列表（可选仅勾选）' })
    async myList(@Headers() headers: Record<string, string>, @Query('onlyChecked') onlyChecked?: string) {
        const token = this.extractToken(headers);
        return this.service.list(token, String(onlyChecked||'').toLowerCase()==='true');
    }

    @Post('me/add')
    @ApiOperation({ summary: '加入购物车（会员端）' })
    async myAdd(@Headers() headers: Record<string, string>, @Body() body: CartMyAddDto) {
        const token = this.extractToken(headers);
        return this.service.add(token, body);
    }

    @Put('me/:id')
    @ApiOperation({ summary: '更新购物车条目（数量/勾选/SKU）' })
    async myUpdate(@Param('id', ParseIntPipe) id: number, @Headers() headers: Record<string, string>, @Body() body: CartMyUpdateDto) {
        const token = this.extractToken(headers);
        return this.service.update(token, id, body);
    }

    @Post('me/toggle-all')
    @ApiOperation({ summary: '全选/全不选（会员端）' })
    async toggleAll(@Headers() headers: Record<string, string>, @Body() body: CartToggleAllDto) {
        const token = this.extractToken(headers);
        return this.service.toggleAll(token, !!body?.checked);
    }

    @Delete('me/clear-checked')
    @ApiOperation({ summary: '清空已勾选条目（会员端）' })
    async clearChecked(@Headers() headers: Record<string, string>) {
        const token = this.extractToken(headers);
        return this.service.clearChecked(token);
    }

    @Delete('me/:id')
    @ApiOperation({ summary: '删除购物车条目（会员端）' })
    async myDelete(@Param('id', ParseIntPipe) id: number, @Headers() headers: Record<string, string>) {
        const token = this.extractToken(headers);
        return this.service.remove(token, id);
    }
}


