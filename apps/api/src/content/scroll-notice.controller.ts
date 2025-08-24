import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScrollNoticeService, NoticeType } from './scroll-notice.service.js';

@ApiTags('content')
@Controller('content')
export class ScrollNoticeController {
    constructor(private service: ScrollNoticeService) {}

    // 管理端：列表
    @Get('notices')
    list(@Query('type') type?: NoticeType) { return this.service.list(type); }

    // 管理端：创建
    @Post('notices')
    create(@Body() body: { type: NoticeType; content: string; enabled?: boolean }) { return this.service.create(body); }

    // 管理端：更新
    @Put('notices/:id')
    update(@Param('id') id: string, @Body() body: { content?: string; enabled?: boolean }) { return this.service.update(Number(id), body); }

    // 管理端：删除
    @Delete('notices/:id')
    remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

    // 管理端：启用指定公告（会自动禁用同类型其他）
    @Post('notices/:id/enable')
    enable(@Param('id') id: string) { return this.service.enable(Number(id)); }

    // 小程序端：获取某类型当前启用公告
    @Get('notices/active')
    active(@Query('type') type: NoticeType) { return this.service.getActive(type); }
}


