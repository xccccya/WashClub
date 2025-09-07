import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { AssetService } from '../file/asset.service.js';

@ApiTags('system')
@Controller('system')
export class SystemSettingController {
    constructor(private prisma: PrismaService, private assets: AssetService) {}

    // 公共获取：无需登录，供登录页读取站点展示
    @Get('public/site-setting')
    @ApiOperation({ summary: '公共-获取站点基础设置' })
    async getPublicSetting() {
        const ss = await this.prisma.siteSetting.findFirst().catch(() => null);
        return ss || { title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null, defaultMemberAvatarUrl: null } as any;
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
        return ss || { id: 1, title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null, defaultMemberAvatarUrl: null, growthPerYuan: 1 } as any;
    }

    @Post('site-setting')
    @UseGuards(AdminGuard)
    @RequirePerm('system-basic')
    @ApiOperation({ summary: '保存站点基础设置' })
    async saveSetting(@Body() body: { title?: string; logoUrl?: string | null; bgType?: 'bing'|'image'; bgImageUrl?: string | null; defaultMemberAvatarUrl?: string | null; growthPerYuan?: number }) {
        const payload: any = {
            title: (body.title || 'WashClub 管理后台').slice(0, 60),
            logoUrl: body.logoUrl ?? null,
            bgType: body.bgType === 'image' ? 'image' : 'bing',
            bgImageUrl: body.bgImageUrl ?? null,
            defaultMemberAvatarUrl: body.defaultMemberAvatarUrl ?? null,
            growthPerYuan: Math.max(1, Math.floor(Number(body?.growthPerYuan ?? 1))),
        };
        const exists = await this.prisma.siteSetting.findFirst().catch(() => null);
        let saved: any;
        if (exists) {
            saved = await this.prisma.siteSetting.update({ where: { id: exists.id }, data: payload });
        } else {
            saved = await this.prisma.siteSetting.create({ data: payload });
        }
        // 同步文件引用绑定
        try {
            const id = '1'; // SiteSetting 逻辑唯一
            await this.syncBindings('SiteSetting', id, 'logoUrl', saved.logoUrl ? [saved.logoUrl] : []);
            await this.syncBindings('SiteSetting', id, 'bgImageUrl', saved.bgImageUrl ? [saved.bgImageUrl] : []);
            await this.syncBindings('SiteSetting', id, 'defaultMemberAvatarUrl', saved.defaultMemberAvatarUrl ? [saved.defaultMemberAvatarUrl] : []);
        } catch {}
        return saved;
    }

    private async getAssetIdsFromUrls(urls: string[]): Promise<string[]> {
        const set = new Set<string>();
        for (const u of urls) {
            if (!u || typeof u !== 'string') continue;
            const s = String(u).trim();
            if (!s) continue;
            set.add(s);
            try { if (/^https?:\/\//i.test(s)) { const rel = new URL(s).pathname; if (rel) set.add(rel); } } catch {}
        }
        const arr = Array.from(set);
        if (arr.length === 0) return [];
        const rows = await (this.prisma as any).fileAsset.findMany({ where: { url: { in: arr } }, select: { id: true } });
        return Array.isArray(rows) ? rows.map((r: any) => String(r.id)) : [];
    }

    private async syncBindings(tableName: string, rowId: string, fieldName: string, urls: string[]) {
        try {
            const desired = new Set<string>(await this.getAssetIdsFromUrls(urls));
            const existing: any[] = await (this.prisma as any).fileBinding.findMany({ where: { tableName, rowId: String(rowId), fieldName } });
            for (const b of existing) {
                if (!desired.has(String(b.fileId))) {
                    try { await this.assets.unbindReference(String(b.fileId), String(b.id)); } catch {}
                }
            }
            for (const fid of desired) {
                const ok = existing.find((b: any) => String(b.fileId) === fid);
                if (!ok) { try { await this.assets.bindReference(String(fid), { tableName, rowId: String(rowId), fieldName }); } catch {} }
            }
        } catch {}
    }
}


