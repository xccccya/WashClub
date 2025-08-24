import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdBannerService, CreateBannerDto, UpdateBannerDto } from './ad-banner.service.js';

@ApiTags('content')
@Controller('content')
export class AdBannerController {
    constructor(private service: AdBannerService) {}

    // 管理端：列表，可按启用状态筛选
    @Get('banners')
    list(@Query('enabled') enabled?: 'true' | 'false' | '') { return this.service.list(enabled); }

    // 管理端：创建
    @Post('banners')
    create(@Body() body: CreateBannerDto) { return this.service.create(body); }

    // 管理端：更新
    @Put('banners/:id')
    update(@Param('id') id: string, @Body() body: UpdateBannerDto) { return this.service.update(Number(id), body); }

    // 管理端：删除
    @Delete('banners/:id')
    remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

    // 管理端：启用/禁用
    @Post('banners/:id/enable')
    setEnable(@Param('id') id: string, @Body('enabled') enabled?: any) { return this.service.enable(Number(id), String(enabled) !== 'false'); }

    // 小程序端：获取已启用列表
    @Get('banners/active')
    active() { return this.service.activeList(); }
}


