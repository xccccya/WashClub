import { Body, Controller, Get, Post, Query, Headers, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StoreService } from './store.service.js';
import { JwtService } from '@nestjs/jwt';
import { StoreInventoryAdjustDto } from './inventory.dto.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { extractBearerToken } from '../auth/bearer.js';

@ApiTags('StoreInventory')
@Controller('store/inventory')
export class StoreInventoryController {
    constructor(private readonly store: StoreService, private readonly jwt: JwtService) {}

    @Post('adjust')
    @UseGuards(AdminGuard)
    @RequirePerm('store-inventory' as any)
    adjust(@Body() body: StoreInventoryAdjustDto, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.store.adjustInventory({ ...body, operatorUserId });
    }

    @Get('logs')
    @UseGuards(AdminGuard)
    @RequirePerm('store-inventory' as any)
    logs(
        @Query('productId') productId?: string,
        @Query('skuId') skuId?: string,
        @Query('reason') reason?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.store.listInventoryLogs({
            productId: productId ? Number(productId) : undefined,
            skuId: skuId ? Number(skuId) : undefined,
            reason: reason || undefined,
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
        });
    }

    private extractAdminIdFromAuthHeader(authHeader?: string): number | undefined {
        if (!authHeader) return undefined;
        const token = extractBearerToken(authHeader);
        if (!token) return undefined;
        try {
            const decoded: any = this.jwt.verify(token);
            if (decoded?.type !== 'admin') return undefined;
            const id = Number(decoded?.sub);
            return Number.isFinite(id) && id > 0 ? id : undefined;
        } catch {
            // 忽略非法token，按匿名处理
            return undefined;
        }
    }
}


