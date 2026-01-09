import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VehicleService } from './vehicle.service.js';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { JwtService } from '@nestjs/jwt';
import {
    VehicleAdminListQueryDto,
    VehicleCreateForMemberByPhoneDto,
    VehicleCreateForMemberDto,
    VehicleGuestCreateDto,
    VehicleMyCreateDto,
    VehicleRebindLogsQueryDto,
    VehicleSearchQueryDto,
    VehicleUpdateDto,
} from './vehicle.dto.js';

@ApiTags('vehicle')
@Controller('vehicle')
export class VehicleController {
    constructor(private service: VehicleService, private jwt: JwtService) {}

    // 管理端列表
    @Get('list')
    @ApiOperation({ summary: '车辆列表（管理员，分页/关键词）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    adminList(@Query() q: VehicleAdminListQueryDto) {
        const page = q?.page;
        const pageSize = q?.pageSize;
        const keyword = q?.keyword;
        const scope = q?.scope;
        const guest = q?.guest;
        // 兼容旧参数：guest=1 时仅返回游客车辆；优先级高于 scope
        if (Number(guest || 0) === 1) {
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
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    listByMember(@Param('memberId') memberId: string) {
        return this.service.listByMember(Number(memberId));
    }

    // 新增车辆（管理员）
    @Post('member/:memberId')
    @ApiOperation({ summary: '为会员新增车辆（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    createForMember(
        @Param('memberId') memberId: string,
        @Body() body: VehicleCreateForMemberDto,
    ) {
        if (!body?.plateNumber) throw new BadRequestException('车牌号为必填项');
        if (!body?.typeMain) throw new BadRequestException('车辆主类型为必填项');
        return this.service.createForMember(Number(memberId), body);
    }

    // 新增车辆（管理员-按会员手机号）
    @Post('member/by-phone')
    @ApiOperation({ summary: '按手机号为会员新增车辆（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    createForMemberByPhone(
        @Body() body: VehicleCreateForMemberByPhoneDto,
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
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    updateVehicle(
        @Param('id') id: string,
        @Body() body: VehicleUpdateDto,
    ) {
        return this.service.updateVehicle(Number(id), body);
    }

    // 删除车辆
    @Delete(':id')
    @ApiOperation({ summary: '删除车辆' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    remove(@Param('id') id: string) {
        return this.service.deleteVehicle(Number(id));
    }

    // 设置默认车辆
    @Post(':id/set-default')
    @ApiOperation({ summary: '设置默认车辆' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    setDefault(@Param('id') id: string) {
        return this.service.setDefault(Number(id));
    }

    // 模糊搜索车牌（管理端/队列用）
    @Get('search')
    @ApiOperation({ summary: '模糊搜索车牌（管理端/队列）' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    search(@Query() q: VehicleSearchQueryDto) {
        return this.service.searchByPlateLike(String(q?.q || ''), Number(q?.limit || 15));
    }

    // 创建游客车辆
    @Post('guest/create')
    @ApiOperation({ summary: '创建游客车辆' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    createGuest(@Body() body: VehicleGuestCreateDto) {
        if (!body?.plateNumber) throw new BadRequestException('车牌号为必填项');
        return this.service.createGuestVehicle(body);
    }

    // 将游客车辆绑定到会员
    @Post(':id/bind-member/:memberId')
    @ApiOperation({ summary: '将游客车辆绑定到会员' })
    @UseGuards(AdminGuard)
    @RequirePerm('member-vehicles' as any)
    bindMember(
        @Param('id') id: string,
        @Param('memberId') memberId: string,
        @Headers('authorization') authHeader?: string,
    ) {
        // 兼容：部分调用方可能没有带 admin token；尽量记录操作人
        const token = (authHeader||'').replace(/^Bearer\s+/i,'');
        let operatorUserId: number | null = null;
        try{ const dec:any = this.jwt.decode(token) || {}; operatorUserId = Number(dec?.sub)||null; }catch{}
        return this.service.bindGuestVehicle(Number(id), Number(memberId), { operatorUserId });
    }

    // 一键换绑（管理员）：支持跨集团换绑；需二次确认与备注
    @Post(':id/rebind')
    @UseGuards(AdminGuard)
    @RequirePerm('vehicles' as any)
    @ApiOperation({ summary: '一键换绑车辆（管理员）' })
    async adminRebind(
        @Param('id') id: string,
        @Body() body: { toMemberId?: number | null; toGroupId?: number | null; toGuest?: boolean; remark?: string | null; confirm?: boolean },
        @Headers('authorization') authHeader?: string,
    ){
        if (!body?.confirm) throw new BadRequestException('请勾选二次确认');
        const token = (authHeader||'').replace(/^Bearer\s+/i,'');
        let operatorUserId: number | null = null;
        try{ const dec:any = this.jwt.decode(token) || {}; operatorUserId = Number(dec?.sub)||null; }catch{}
        return (this.service as any).adminRebindVehicle(Number(id), {
            toMemberId: Number((body as any)?.toMemberId||0) || null,
            toGroupId: Number((body as any)?.toGroupId||0) || null,
            toGuest: !!(body as any)?.toGuest,
            remark: (body as any)?.remark || null,
            operatorUserId,
        });
    }

    // 改绑审计日志（管理员）
    @Get(':id/rebind-logs')
    @UseGuards(AdminGuard)
    @RequirePerm('vehicles' as any)
    @ApiOperation({ summary: '车辆改绑记录（管理员，分页）' })
    async adminRebindLogs(@Param('id') id: string, @Query() q: VehicleRebindLogsQueryDto) {
        return (this.service as any).adminGetRebindLogs(Number(id), Number(q?.page || 1), Number(q?.pageSize || 20));
    }

    // 我的车辆（会员端）
    @Get('me/list')
    @ApiOperation({ summary: '我的车辆列表（会员端）' })
    async myVehicles(@Headers() headers: Record<string, string>) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        return this.service.listByMember(memberId);
    }

    // 新增我的车辆（会员端）
    @Post('me/create')
    @ApiOperation({ summary: '新增我的车辆（会员端）' })
    async myCreate(
        @Headers() headers: Record<string, string>,
        @Body() body: VehicleMyCreateDto,
    ) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || '';
        const memberId = await this.service.getMemberIdFromToken(token);
        if (!body?.plateNumber) throw new BadRequestException('车牌号为必填项');
        if (!body?.typeMain) throw new BadRequestException('车辆主类型为必填项');
        return this.service.createForMember(memberId, body);
    }
}


