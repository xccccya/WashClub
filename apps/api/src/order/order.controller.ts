import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Headers } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Order')
@Controller('orders')
export class OrderController {
    constructor(private readonly orders: OrderService, private readonly jwt: JwtService) {}

    @Post('')
    create(@Body() body: any) { return this.orders.createOrder(body); }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) { return this.orders.getOrder(id); }

    @Get('by-no/:no')
    getByNo(@Param('no') no: string) { return this.orders.getOrderByNo(no); }

    @Get('')
    list(
        @Query('type') type?: 'SERVICE'|'SP'|'FK',
        @Query('status') status?: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED',
        @Query('payStatus') payStatus?: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED',
        @Query('scene') scene?: string,
        @Query('includeDeleted') includeDeletedStr?: string,
        @Query('memberId') memberIdStr?: string,
        @Query('keyword') keyword?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        const memberId = memberIdStr ? Number(memberIdStr) : undefined;
        const includeDeleted = String(includeDeletedStr||'').toLowerCase() === 'true';
        return this.orders.listOrders({ type: type as any, status: status as any, payStatus: payStatus as any, scene, includeDeleted, memberId, keyword, start, end });
    }

    @Post(':id/pay/manual')
    markPaid(@Param('id', ParseIntPipe) id: number, @Body() body: { method: 'CASH'|'SHOUQIANBA'|'OFFLINE'; paidAt?: string }, @Headers('authorization') authHeader?: string) {
        const paidAt = body.paidAt ? new Date(body.paidAt) : undefined;
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.markPaid({ orderId: id, method: body.method, paidAt, operatorUserId });
    }

    // 软删除（替换原“关闭”操作）：仅设置 deletedAt，不改其他状态
    @Post(':id/close')
    close(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.softDeleteOrder(id, operatorUserId);
    }

    // 恢复软删除
    @Post(':id/restore')
    restore(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.restoreOrder(id, operatorUserId);
    }

    @Post(':id/refund')
    refund(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.refundOrder(id, body?.reason, operatorUserId);
    }

    // 发货
    @Post(':id/ship')
    ship(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.shipOrder(id, operatorUserId);
    }
    // 收货
    @Post(':id/receive')
    receive(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.receiveOrder(id, operatorUserId);
    }
    // 开始服务
    @Post(':id/start-service')
    startService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.startService(id, operatorUserId);
    }
    // 结束服务
    @Post(':id/finish-service')
    finishService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.finishService(id, operatorUserId);
    }

    private extractAdminIdFromAuthHeader(authHeader?: string): number | undefined {
        if (!authHeader) return undefined;
        const m = /^Bearer\s+(.+)$/.exec(authHeader);
        const token = m?.[1];
        if (!token) return undefined;
        try {
            const decoded: any = this.jwt.verify(token);
            if (decoded?.type !== 'admin') return undefined;
            const id = Number(decoded?.sub);
            return Number.isFinite(id) && id > 0 ? id : undefined;
        } catch {
            return undefined;
        }
    }
}


