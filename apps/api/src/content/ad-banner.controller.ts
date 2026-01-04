import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdBannerService } from './ad-banner.service.js';
import { CreateBannerDto, SetBannerEnableDto, UpdateBannerDto } from './ad-banner.dto.js';

@ApiTags('content')
@Controller('content')
export class AdBannerController {
    constructor(private service: AdBannerService) {}

    // 管理端：列表，可按启用状态筛选
    @Get('banners')
    @ApiOperation({ summary: '广告位列表（可按启用状态筛选）' })
    list(@Query('enabled') enabled?: 'true' | 'false' | '') { return this.service.list(enabled); }

    // 管理端：创建
    @Post('banners')
    @ApiOperation({ summary: '创建广告位' })
    create(@Body() body: CreateBannerDto) { return this.service.create(body); }

    // 管理端：更新
    @Put('banners/:id')
    @ApiOperation({ summary: '更新广告位' })
    update(@Param('id') id: string, @Body() body: UpdateBannerDto) { return this.service.update(Number(id), body); }

    // 管理端：删除
    @Delete('banners/:id')
    @ApiOperation({ summary: '删除广告位' })
    remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

    // 管理端：启用/禁用
    @Post('banners/:id/enable')
    @ApiOperation({ summary: '启用/禁用广告位' })
    setEnable(@Param('id') id: string, @Body() body: SetBannerEnableDto) {
        return this.service.enable(Number(id), String(body?.enabled) !== 'false');
    }

    // 小程序端：获取已启用列表
    @Get('banners/active')
    @ApiOperation({ summary: '小程序端：获取已启用广告位列表' })
    active() { return this.service.activeList(); }
}


