import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VehicleService } from './vehicle.service.js';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('vehicle')
@Controller('vehicle')
export class VehicleController {
    constructor(private service: VehicleService) {}

    // 管理端列表
    @Get('list')
    @ApiOperation({ summary: '车辆列表（管理员，分页/关键词）' })
    adminList(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string, @Query('scope') scope?: 'member'|'all', @Query('guest') guest?: string) {
        // 兼容旧参数：guest=1 时仅返回游客车辆；优先级高于 scope
        if (String(guest||'') === '1') {
            return this.service.adminList(Number(page || 1), Number(pageSize || 20), keyword, 'all').then((res: any)=>{
                try { res.items = (res.items||[]).filter((it:any)=> !it?.memberId); } catch {}
                return res;
            });
        }
        return this.service.adminList(Number(page || 1), Number(pageSize || 20), keyword, (scope === 'all' ? 'all' : 'member'));
    }

    // 按会员查询
    @Get('member/:memberId')
    @ApiOperation({ summary: '按会员ID查询车辆' })
    listByMember(@Param('memberId') memberId: string) {
        return this.service.listByMember(Number(memberId));
    }

    // 新增车辆（管理员）
    @Post('member/:memberId')
    @ApiOperation({ summary: '为会员新增车辆（管理员）' })
    createForMember(
        @Param('memberId') memberId: string,
        @Body()
        body: {
            plateNumber: string;
            vin?: string | null;
            brand?: string | null;
            series?: string | null;
            brandId?: number | null;
            seriesId?: number | null;
            typeMain: string;
            typeSub?: string | null;
            color?: string | null;
            isDefault?: boolean;
        },
    ) {
        if (!body?.plateNumber) throw new BadRequestException('车牌号为必填项');
        if (!body?.typeMain) throw new BadRequestException('车辆主类型为必填项');
        return this.service.createForMember(Number(memberId), body);
    }

    // 新增车辆（管理员-按会员手机号）
    @Post('member/by-phone')
    @ApiOperation({ summary: '按手机号为会员新增车辆（管理员）' })
    createForMemberByPhone(
        @Body()
        body: {
            phone: string;
            plateNumber: string;
            vin?: string | null;
            brand?: string | null;
            series?: string | null;
            typeMain: string;
            typeSub?: string | null;
            color?: string | null;
            isDefault?: boolean;
        },
    ) {
        const phone = String((body as any)?.phone || '').trim();
        if (!/^1\d{10}$/.test(phone)) throw new BadRequestException('会员手机号格式不正确');
        if (!body?.plateNumber) throw new BadRequestException('车牌号为必填项');
        if (!body?.typeMain) throw new BadRequestException('车辆主类型为必填项');
        return this.service.createForMemberByPhone(phone, body);
    }

    // 修改车辆
    @Put(':id')
    @ApiOperation({ summary: '修改车辆信息' })
    updateVehicle(
        @Param('id') id: string,
        @Body()
        body: Partial<{
            plateNumber: string;
            vin?: string | null;
            brand?: string | null;
            series?: string | null;
            brandId?: number | null;
            seriesId?: number | null;
            typeMain?: string;
            typeSub?: string | null;
            color?: string | null;
            isDefault?: boolean;
        }>,
    ) {
        return this.service.updateVehicle(Number(id), body);
    }

    // 删除车辆
    @Delete(':id')
    @ApiOperation({ summary: '删除车辆' })
    remove(@Param('id') id: string) {
        return this.service.deleteVehicle(Number(id));
    }

    // 设置默认车辆
    @Post(':id/set-default')
    @ApiOperation({ summary: '设置默认车辆' })
    setDefault(@Param('id') id: string) {
        return this.service.setDefault(Number(id));
    }

    // 模糊搜索车牌（管理端/队列用）
    @Get('search')
    @ApiOperation({ summary: '模糊搜索车牌（管理端/队列）' })
    search(@Query('q') q?: string, @Query('limit') limit?: string) {
        return this.service.searchByPlateLike(String(q || ''), Number(limit || 15));
    }

    // 创建游客车辆
    @Post('guest/create')
    @ApiOperation({ summary: '创建游客车辆' })
    createGuest(@Body() body: { plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain?: string; typeSub?: string | null; color?: string | null }) {
        if (!body?.plateNumber) throw new BadRequestException('车牌号为必填项');
        return this.service.createGuestVehicle(body);
    }

    // 将游客车辆绑定到会员
    @Post(':id/bind-member/:memberId')
    @ApiOperation({ summary: '将游客车辆绑定到会员' })
    bindMember(@Param('id') id: string, @Param('memberId') memberId: string) {
        return this.service.bindGuestVehicle(Number(id), Number(memberId));
    }

    // 一键换绑（管理员）：支持跨集团换绑；需二次确认与备注
    @Post(':id/rebind')
    @UseGuards(AdminGuard)
    @RequirePerm('vehicles' as any)
    @ApiOperation({ summary: '一键换绑车辆（管理员）' })
    async adminRebind(
        @Param('id') id: string,
        @Body() body: { toMemberId?: number | null; toGroupId?: number | null; remark?: string | null; confirm?: boolean },
        @Headers('authorization') authHeader?: string,
    ){
        if (!body?.confirm) throw new (require('@nestjs/common').BadRequestException)('请勾选二次确认');
        const token = (authHeader||'').replace(/^Bearer\s+/i,'');
        let operatorUserId: number | null = null;
        try{ const jwt = require('@nestjs/jwt'); const srv = new (jwt.JwtService)({ secret: process.env.JWT_SECRET || 'dev_secret' }); const dec:any = srv.decode(token) || {}; operatorUserId = Number(dec?.sub)||null; }catch{}
        return (this.service as any).adminRebindVehicle(Number(id), { toMemberId: Number((body as any)?.toMemberId||0) || null, toGroupId: Number((body as any)?.toGroupId||0) || null, remark: (body as any)?.remark || null, operatorUserId });
    }

    // 我的车辆（会员端）
    @Get('me/list')
    @ApiOperation({ summary: '我的车辆列表（会员端）' })
    async myVehicles(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.listByMember(memberId);
    }

    // 新增我的车辆（会员端）
    @Post('me/create')
    @ApiOperation({ summary: '新增我的车辆（会员端）' })
    async myCreate(
        @Headers() headers: Record<string, string>,
        @Query('token') tokenParam: string | undefined,
        @Body()
        body: { plateNumber: string; typeMain: string; typeSub?: string | null; vin?: string | null; brand?: string | null; series?: string | null; color?: string | null; isDefault?: boolean },
    ) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        if (!body?.plateNumber) throw new BadRequestException('车牌号为必填项');
        if (!body?.typeMain) throw new BadRequestException('车辆主类型为必填项');
        return this.service.createForMember(memberId, body);
    }
}


