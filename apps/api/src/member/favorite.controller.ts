import { Controller, Get, Headers, Post, Delete, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FavoriteService } from './favorite.service.js';

@ApiTags('favorite')
@Controller('favorite')
export class FavoriteController {
    constructor(private service: FavoriteService) {}

    private extractToken(headers: Record<string, string>, tokenParam?: string) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        return (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
    }

    @Get('me/list')
    async myList(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.list(token);
    }

    @Post('me/:productId')
    async add(@Param('productId', ParseIntPipe) productId: number, @Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.add(token, productId);
    }

    @Delete('me/:productId')
    async remove(@Param('productId', ParseIntPipe) productId: number, @Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
        const token = this.extractToken(headers, tokenParam);
        return this.service.remove(token, productId);
    }
}


