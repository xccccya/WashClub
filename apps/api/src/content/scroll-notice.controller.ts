import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ScrollNoticeService, NoticeType } from './scroll-notice.service.js';
import { CreateScrollNoticeDto, UpdateScrollNoticeDto } from './scroll-notice.dto.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('content')
@Controller('content')
export class ScrollNoticeController {
    constructor(private service: ScrollNoticeService) {}

    // 管理端：列表
    @Get('notices')
	@UseGuards(AdminGuard)
	@RequirePerm('content-notices')
	@ApiBearerAuth()
    @ApiOperation({ summary: '滚动公告列表（可按类型筛选）' })
    list(@Query('type') type?: NoticeType) { return this.service.list(type); }

    // 管理端：创建
    @Post('notices')
	@UseGuards(AdminGuard)
	@RequirePerm('content-notices')
	@ApiBearerAuth()
    @ApiOperation({ summary: '创建滚动公告' })
    create(@Body() body: CreateScrollNoticeDto) { return this.service.create(body); }

    // 管理端：更新
    @Put('notices/:id')
	@UseGuards(AdminGuard)
	@RequirePerm('content-notices')
	@ApiBearerAuth()
    @ApiOperation({ summary: '更新滚动公告' })
    update(@Param('id') id: string, @Body() body: UpdateScrollNoticeDto) { return this.service.update(Number(id), body); }

    // 管理端：删除
    @Delete('notices/:id')
	@UseGuards(AdminGuard)
	@RequirePerm('content-notices')
	@ApiBearerAuth()
    @ApiOperation({ summary: '删除滚动公告' })
    remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

    // 管理端：启用指定公告（会自动禁用同类型其他）
    @Post('notices/:id/enable')
	@UseGuards(AdminGuard)
	@RequirePerm('content-notices')
	@ApiBearerAuth()
    @ApiOperation({ summary: '启用指定公告（自动禁用同类型其他）' })
    enable(@Param('id') id: string) { return this.service.enable(Number(id)); }

    // 小程序端：获取某类型当前启用公告
    @Get('notices/active')
    @ApiOperation({ summary: '小程序端：获取某类型当前启用公告' })
    active(@Query('type') type: NoticeType) { return this.service.getActive(type); }
}


