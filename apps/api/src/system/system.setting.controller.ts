import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('system')
@Controller('system')
export class SystemSettingController {
    constructor(private prisma: PrismaService) {}

    // 公共获取：无需登录，供登录页读取站点展示
    @Get('public/site-setting')
    @ApiOperation({ summary: '公共-获取站点基础设置' })
    async getPublicSetting() {
        const ss = await this.prisma.siteSetting.findFirst().catch(() => null);
        return ss || { title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null };
    }

    // 公共：获取必应每日壁纸直链（由服务端代理获取 JSON，避免浏览器 CORS）
    @Get('public/bing-wallpaper')
    @ApiOperation({ summary: '公共-获取必应每日壁纸URL' })
    async getBingWallpaper() {
        const api = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN';
        let url: string | null = null;
        try {
            const controller = new AbortController();
            const timer = setTimeout(()=>controller.abort(), 8000);
            const resp = await fetch(api, { signal: controller.signal });
            clearTimeout(timer);
            const j: any = await resp.json();
            const part = j?.images?.[0]?.url || j?.images?.[0]?.urlbase;
            if (typeof part === 'string') url = part.startsWith('http') ? part : `https://www.bing.com${part}`;
        } catch {}
        return { url };
    }

    // 受权获取：后台页面编辑
    @Get('site-setting')
    @UseGuards(AdminGuard)
    @RequirePerm('system-basic')
    @ApiOperation({ summary: '获取站点基础设置' })
    async getSetting() {
        const ss = await this.prisma.siteSetting.findFirst().catch(() => null);
        return ss || { id: 1, title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null } as any;
    }

    @Post('site-setting')
    @UseGuards(AdminGuard)
    @RequirePerm('system-basic')
    @ApiOperation({ summary: '保存站点基础设置' })
    async saveSetting(@Body() body: { title?: string; logoUrl?: string | null; bgType?: 'bing'|'image'; bgImageUrl?: string | null }) {
        const payload: any = {
            title: (body.title || 'WashClub 管理后台').slice(0, 60),
            logoUrl: body.logoUrl ?? null,
            bgType: body.bgType === 'image' ? 'image' : 'bing',
            bgImageUrl: body.bgImageUrl ?? null,
        };
        const exists = await this.prisma.siteSetting.findFirst().catch(() => null);
        if (exists) {
            const updated = await this.prisma.siteSetting.update({ where: { id: exists.id }, data: payload });
            return updated;
        }
        const created = await this.prisma.siteSetting.create({ data: payload });
        return created;
    }
}


