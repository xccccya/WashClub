import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Put, Query, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WashCardService } from './washcard.service.js';

@ApiTags('wash-card')
@Controller('wash-card')
export class WashCardController {
    constructor(private service: WashCardService) {}

    // 管理端
    @Get('list')
    adminList(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string){
        return this.service.listAdmin(Number(page||1), Number(pageSize||20), keyword);
    }

    @Get(':id')
    adminGet(@Param('id') id: string){ return this.service.getAdmin(Number(id)); }

    @Post('create')
    adminCreate(@Body() body: { ownerMemberId: number; name?: string; totalTimes?: number; remainingTimes?: number; expiryAt?: string | null; isDefault?: boolean }){
        if (!body?.ownerMemberId) throw new BadRequestException('ownerMemberId 必填');
        return this.service.createCard({ ownerMemberId: Number(body.ownerMemberId), name: body.name, totalTimes: body.totalTimes, remainingTimes: body.remainingTimes, expiryAt: body.expiryAt||null, isDefault: !!body?.isDefault });
    }

    @Post(':id/add')
    adminAdd(@Param('id') id: string, @Body() body: { count: number; remark?: string; purchaseOrderId?: number }){
        const c = Number(body?.count||0); if (!Number.isFinite(c) || c<=0) throw new BadRequestException('count 必须为正整数');
        return this.service.addTimes(Number(id), c, undefined, body?.remark, body?.purchaseOrderId);
    }

    @Post(':id/deduct')
    adminDeduct(@Param('id') id: string, @Body() body: { count: number; reason?: 'BACKEND_DEDUCT' | 'SERVICE_DEDUCT' | 'REFUND_DEDUCT'; remark?: string; vehicleId?: number; serviceOrderId?: number; refundRecordId?: number }){
        const c = Number(body?.count||0); if (!Number.isFinite(c) || c<=0) throw new BadRequestException('count 必须为正整数');
        const reason = (body?.reason || 'BACKEND_DEDUCT') as any;
        return this.service.deductTimes(Number(id), c, reason, { remark: body?.remark, vehicleId: body?.vehicleId, serviceOrderId: body?.serviceOrderId, refundRecordId: body?.refundRecordId });
    }

    @Get(':id/logs')
    adminLogs(@Param('id') id: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string){
        return this.service.listLogs(Number(id), Number(page||1), Number(pageSize||20));
    }

    @Get(':id/shares')
    adminShares(@Param('id') id: string){ return this.service.listShares(Number(id)); }
    @Post(':id/shares')
    adminAddShare(@Param('id') id: string, @Body() body: { memberId: number }){ if(!body?.memberId) throw new BadRequestException('memberId 必填'); return this.service.addShare(Number(id), Number(body.memberId)); }
    @Post(':id/shares/:memberId/remove')
    adminRemoveShare(@Param('id') id: string, @Param('memberId') memberId: string){ return this.service.removeShare(Number(id), Number(memberId)); }

    @Post(':id/set-default')
    adminSetDefault(@Param('id') id: string){ return this.service.setDefault(Number(id)); }

    @Delete(':id')
    adminDelete(@Param('id') id: string){ return this.service.deleteCard(Number(id)); }

    // 会员端
    @Get('me/list')
    async myList(@Headers() headers: Record<string,string>, @Query('token') tokenParam?: string){
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.myCards(memberId);
    }

    @Get('me/:id')
    async myGet(@Param('id') id: string, @Headers() headers: Record<string,string>, @Query('token') tokenParam?: string){
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.getCardForMember(memberId, Number(id));
    }

    @Get('me/:id/logs')
    async myLogs(@Param('id') id: string, @Headers() headers: Record<string,string>, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('token') tokenParam?: string){
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.listLogsForMember(memberId, Number(id), Number(page||1), Number(pageSize||20));
    }

    @Post('me/:id/set-default')
    async mySetDefault(@Param('id') id: string, @Headers() headers: Record<string,string>, @Query('token') tokenParam?: string){
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.setDefaultForOwner(memberId, Number(id));
    }
}


