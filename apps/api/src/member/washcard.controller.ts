import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Put, Query, Delete, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WashCardService } from './washcard.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { AdminOrEmployeeGuard } from '../auth/admin-or-employee.guard.js';
import { extractBearerTokenFromHeaders } from '../auth/bearer.js';
import { AllowEmployee } from '../auth/allow-employee.decorator.js';

@ApiTags('wash-card')
@Controller('wash-card')
export class WashCardController {
    constructor(private service: WashCardService) {}
    private bearer(headers: Record<string, unknown>) { return extractBearerTokenFromHeaders(headers as any) || ''; }

    // 管理端
    @Get('member-stats')
    @ApiOperation({ summary: '按会员聚合洗车卡统计（管理员，用于详情抽屉顶部统计）' })
    @UseGuards(AdminOrEmployeeGuard)
    @AllowEmployee()
    @RequirePerm('member-washcards')
    adminMemberStats(@Query('memberId') memberId?: string){
        const mid = Number(memberId || 0);
        return this.service.getMemberStats(mid);
    }

    @Get('list')
    @ApiOperation({ summary: '洗车卡列表（管理员，分页/关键词/按会员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminList(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string, @Query('memberId') memberId?: string){
        const mid = Number(memberId||'');
        return this.service.listAdmin(Number(page||1), Number(pageSize||20), keyword, Number.isFinite(mid) && mid>0 ? mid : undefined);
    }

    @Get(':id')
    @ApiOperation({ summary: '洗车卡详情（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminGet(@Param('id') id: string){ return this.service.getAdmin(Number(id)); }

    @Post('create')
    @ApiOperation({ summary: '创建洗车卡（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminCreate(@Body() body: { ownerMemberId: number; name?: string; totalTimes?: number; remainingTimes?: number; expiryAt?: string | null; isDefault?: boolean }){
        if (!body?.ownerMemberId) throw new BadRequestException('ownerMemberId 必填');
        return this.service.createCard({ ownerMemberId: Number(body.ownerMemberId), name: body.name, totalTimes: body.totalTimes, remainingTimes: body.remainingTimes, expiryAt: body.expiryAt||null, isDefault: !!body?.isDefault });
    }

    @Post(':id/add')
    @ApiOperation({ summary: '增加洗车卡次数（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminAdd(@Param('id') id: string, @Body() body: { count: number; remark?: string; purchaseOrderId?: number }){
        const c = Number(body?.count||0); if (!Number.isFinite(c) || c<=0) throw new BadRequestException('count 必须为正整数');
        return this.service.addTimes(Number(id), c, undefined, body?.remark, body?.purchaseOrderId);
    }

    @Post(':id/deduct')
    @ApiOperation({ summary: '扣减洗车卡次数（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminDeduct(@Param('id') id: string, @Body() body: { count: number; reason?: 'BACKEND_DEDUCT' | 'SERVICE_DEDUCT' | 'REFUND_DEDUCT'; remark?: string; vehicleId?: number; serviceOrderId?: number; refundRecordId?: number }){
        const c = Number(body?.count||0); if (!Number.isFinite(c) || c<=0) throw new BadRequestException('count 必须为正整数');
        const reason = (body?.reason || 'BACKEND_DEDUCT') as any;
        return this.service.deductTimes(Number(id), c, reason, { remark: body?.remark, vehicleId: body?.vehicleId, serviceOrderId: body?.serviceOrderId, refundRecordId: body?.refundRecordId });
    }

    @Get(':id/logs')
    @ApiOperation({ summary: '洗车卡变更记录（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminLogs(@Param('id') id: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string){
        return this.service.listLogs(Number(id), Number(page||1), Number(pageSize||20));
    }

    @Get(':id/shares')
    @ApiOperation({ summary: '共享成员列表（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminShares(@Param('id') id: string){ return this.service.listShares(Number(id)); }
    @Post(':id/shares')
    @ApiOperation({ summary: '添加共享成员（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminAddShare(@Param('id') id: string, @Body() body: { memberId: number }){ if(!body?.memberId) throw new BadRequestException('memberId 必填'); return this.service.addShare(Number(id), Number(body.memberId)); }
    @Post(':id/shares/:memberId/remove')
    @ApiOperation({ summary: '移除共享成员（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminRemoveShare(@Param('id') id: string, @Param('memberId') memberId: string){ return this.service.removeShare(Number(id), Number(memberId)); }

    @Post(':id/set-default')
    @ApiOperation({ summary: '设置会员默认洗车卡（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminSetDefault(@Param('id') id: string){ return this.service.setDefault(Number(id)); }

    @Delete(':id')
    @ApiOperation({ summary: '删除洗车卡（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-washcards')
    adminDelete(@Param('id') id: string){ return this.service.deleteCard(Number(id)); }

    // 会员端
    @Get('me/list')
    @ApiOperation({ summary: '我的洗车卡列表（会员端）' })
    async myList(@Headers() headers: Record<string,string>){
        const token = this.bearer(headers as any);
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.myCards(memberId);
    }

    @Get('me/:id')
    @ApiOperation({ summary: '我的洗车卡详情（会员端）' })
    async myGet(@Param('id') id: string, @Headers() headers: Record<string,string>){
        const token = this.bearer(headers as any);
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.getCardForMember(memberId, Number(id));
    }

    @Get('me/:id/logs')
    @ApiOperation({ summary: '我的洗车卡记录（会员端）' })
    async myLogs(@Param('id') id: string, @Headers() headers: Record<string,string>, @Query('page') page?: string, @Query('pageSize') pageSize?: string){
        const token = this.bearer(headers as any);
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.listLogsForMember(memberId, Number(id), Number(page||1), Number(pageSize||20));
    }

    @Post('me/:id/set-default')
    @ApiOperation({ summary: '设置我的默认洗车卡（会员端）' })
    async mySetDefault(@Param('id') id: string, @Headers() headers: Record<string,string>){
        const token = this.bearer(headers as any);
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.setDefaultForOwner(memberId, Number(id));
    }

    // 会员端：共享管理（仅持有人可管理）
    @Get('me/:id/shares')
    @ApiOperation({ summary: '我的洗车卡共享成员列表（仅持有人）' })
    async myShares(@Param('id') id: string, @Headers() headers: Record<string,string>){
        const token = this.bearer(headers as any);
        const memberId = await this.service.getMemberIdFromToken(token);
        return (this.service as any).listSharesForOwner(memberId, Number(id));
    }

    @Post('me/:id/shares')
    @ApiOperation({ summary: '添加共享成员（仅持有人，按手机号）' })
    async myAddShare(@Param('id') id: string, @Headers() headers: Record<string,string>, @Body() body: { phone: string }){
        const token = this.bearer(headers as any);
        const memberId = await this.service.getMemberIdFromToken(token);
        return (this.service as any).addShareForOwnerByPhone(memberId, Number(id), String(body?.phone || ''));
    }

    @Delete('me/:id/shares/:memberId')
    @ApiOperation({ summary: '移除共享成员（仅持有人）' })
    async myRemoveShare(@Param('id') id: string, @Param('memberId') memberIdParam: string, @Headers() headers: Record<string,string>){
        const token = this.bearer(headers as any);
        const memberId = await this.service.getMemberIdFromToken(token);
        return (this.service as any).removeShareForOwner(memberId, Number(id), Number(memberIdParam));
    }
}


