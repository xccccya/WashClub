import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service.js';

@ApiTags('Order')
@Controller('orders')
export class OrderController {
    constructor(private readonly orders: OrderService) {}

    @Post('')
    create(@Body() body: any) { return this.orders.createOrder(body); }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) { return this.orders.getOrder(id); }

    @Get('')
    list(
        @Query('type') type?: 'SERVICE'|'SP'|'FK',
        @Query('status') status?: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED',
        @Query('payStatus') payStatus?: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED',
        @Query('memberId') memberIdStr?: string,
        @Query('keyword') keyword?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        const memberId = memberIdStr ? Number(memberIdStr) : undefined;
        return this.orders.listOrders({ type: type as any, status: status as any, payStatus: payStatus as any, memberId, keyword, start, end });
    }

    @Post(':id/pay/manual')
    markPaid(@Param('id', ParseIntPipe) id: number, @Body() body: { method: 'CASH'|'SHOUQIANBA'|'OFFLINE'; paidAt?: string }) {
        const paidAt = body.paidAt ? new Date(body.paidAt) : undefined;
        return this.orders.markPaid({ orderId: id, method: body.method, paidAt });
    }

    @Post(':id/close')
    close(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) { return this.orders.closeOrder(id, body?.reason); }
}


