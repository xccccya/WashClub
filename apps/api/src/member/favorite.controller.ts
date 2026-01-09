import { Controller, Get, Headers, Post, Delete, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FavoriteService } from './favorite.service.js';
import { extractBearerTokenFromHeaders } from '../auth/bearer.js';

@ApiTags('favorite')
@Controller('favorite')
export class FavoriteController {
    constructor(private service: FavoriteService) {}

    private extractToken(headers: Record<string, string>) {
        return extractBearerTokenFromHeaders(headers as any) || '';
    }

    @Get('me/list')
    async myList(@Headers() headers: Record<string, string>) {
        const token = this.extractToken(headers);
        return this.service.list(token);
    }

    @Post('me/:productId')
    async add(@Param('productId', ParseIntPipe) productId: number, @Headers() headers: Record<string, string>) {
        const token = this.extractToken(headers);
        return this.service.add(token, productId);
    }

    @Delete('me/:productId')
    async remove(@Param('productId', ParseIntPipe) productId: number, @Headers() headers: Record<string, string>) {
        const token = this.extractToken(headers);
        return this.service.remove(token, productId);
    }
}


