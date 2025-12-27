import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressService } from './address.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { AddressAdminCreateDto, AddressAdminUpdateDto, AddressMyCreateDto, AddressMyUpdateDto } from './address.dto.js';

@ApiTags('address')
@Controller('address')
export class AddressController {
    constructor(private service: AddressService) {}

    // 管理端：分页列表
    @Get('list')
    @ApiOperation({ summary: '收货地址列表（管理员，分页/关键词）' })
    adminList(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
        return this.service.adminList(Number(page || 1), Number(pageSize || 20), keyword);
    }

    // 管理端：按会员ID
    @Get('member/:memberId')
    @ApiOperation({ summary: '按会员ID查询收货地址（管理员）' })
    listByMember(@Param('memberId') memberId: string) {
        return this.service.listByMember(Number(memberId));
    }

    // 会员端：我的列表
    @Get('me/list')
    @ApiOperation({ summary: '我的收货地址列表（会员端）' })
    async myList(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        return this.service.meList(token);
    }

    // 会员端：新增
    @Post('me/create')
    @ApiOperation({ summary: '新增我的收货地址（会员端）' })
    async myCreate(
        @Headers() headers: Record<string, string>,
        @Query('token') tokenParam: string | undefined,
        @Body()
        body: AddressMyCreateDto,
    ) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        return this.service.meCreate(token, body);
    }

    // 会员端：修改
    @Put('me/:id')
    @ApiOperation({ summary: '修改我的收货地址（会员端）' })
    async myUpdate(
        @Param('id') id: string,
        @Headers() headers: Record<string, string>,
        @Query('token') tokenParam: string | undefined,
        @Body()
        body: AddressMyUpdateDto,
    ) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        return this.service.meUpdate(token, Number(id), body);
    }

    // 会员端：删除
    @Delete('me/:id')
    @ApiOperation({ summary: '删除我的收货地址（会员端）' })
    async myDelete(
        @Param('id') id: string,
        @Headers() headers: Record<string, string>,
        @Query('token') tokenParam: string | undefined,
    ) {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        return this.service.meDelete(token, Number(id));
    }

    // ================= 管理端（POS 代客） =================
    @Post('admin/create')
    @UseGuards(AdminGuard)
    @RequirePerm('member-addresses')
    @ApiOperation({ summary: '管理员创建收货地址（支持指定会员或使用游客会员）' })
    adminCreate(@Body() body: AddressAdminCreateDto) {
        return this.service.adminCreate({ memberId: body?.memberId ?? null, useGuest: !!body?.useGuest, input: body?.input as any });
    }

    @Put('admin/:id')
    @UseGuards(AdminGuard)
    @RequirePerm('member-addresses')
    @ApiOperation({ summary: '管理员修改收货地址' })
    adminUpdate(@Param('id') id: string, @Body() body: AddressAdminUpdateDto) {
        return this.service.adminUpdate(Number(id), body);
    }

    @Delete('admin/:id')
    @UseGuards(AdminGuard)
    @RequirePerm('member-addresses')
    @ApiOperation({ summary: '管理员删除收货地址' })
    adminDelete(@Param('id') id: string) {
        return this.service.adminDelete(Number(id));
    }
}


