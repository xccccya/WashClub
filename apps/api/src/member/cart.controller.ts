import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service.js';

@ApiTags('cart')
@Controller('cart')
export class CartController {
    constructor(private service: CartService) {}

    private extractToken(headers: Record<string, string>, tokenParam?: string) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        return (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
    }

    @Get('me/list')
    async myList(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string, @Query('onlyChecked') onlyChecked?: string) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.list(token, String(onlyChecked||'').toLowerCase()==='true');
    }

    @Post('me/add')
    async myAdd(@Headers() headers: Record<string, string>, @Query('token') tokenParam: string | undefined, @Body() body: { productId: number; skuId?: number | null; quantity?: number }) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.add(token, body);
    }

    @Put('me/:id')
    async myUpdate(@Param('id', ParseIntPipe) id: number, @Headers() headers: Record<string, string>, @Query('token') tokenParam: string | undefined, @Body() body: { quantity?: number; checked?: boolean; skuId?: number | null }) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.update(token, id, body);
    }

    @Post('me/toggle-all')
    async toggleAll(@Headers() headers: Record<string, string>, @Query('token') tokenParam: string | undefined, @Body() body: { checked: boolean }) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.toggleAll(token, !!body?.checked);
    }

    @Delete('me/clear-checked')
    async clearChecked(@Headers() headers: Record<string, string>, @Query('token') tokenParam: string | undefined) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.clearChecked(token);
    }

    @Delete('me/:id')
    async myDelete(@Param('id', ParseIntPipe) id: number, @Headers() headers: Record<string, string>, @Query('token') tokenParam: string | undefined) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.remove(token, id);
    }
}


