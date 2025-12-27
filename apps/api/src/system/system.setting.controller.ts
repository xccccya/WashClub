import { Body, Controller, Get, Post, UseGuards, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { AssetService } from '../file/asset.service.js';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Response } from 'express';
import { SystemSiteSettingSaveDto } from './system.setting.dto.js';

@ApiTags('system')
@Controller('system')
export class SystemSettingController {
    constructor(private prisma: PrismaService, private assets: AssetService) {}

    // 公共获取：无需登录，供登录页读取站点展示
    @Get('public/site-setting')
    @ApiOperation({ summary: '公共-获取站点基础设置' })
    async getPublicSetting() {
        const ss = await this.prisma.siteSetting.findFirst().catch(() => null);
        return ss || { title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null, defaultMemberAvatarUrl: null, businessHoursJson: { start: '09:00', end: '18:00' }, busyEnabled: false, pausedEnabled: false } as any;
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
        return ss || { id: 1, title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null, defaultMemberAvatarUrl: null, growthPerYuan: 1, businessHoursJson: { start: '09:00', end: '18:00' }, busyEnabled: false, pausedEnabled: false } as any;
    }

    @Post('site-setting')
    @UseGuards(AdminGuard)
    @RequirePerm('system-basic')
    @ApiOperation({ summary: '保存站点基础设置' })
    @ApiBody({ type: SystemSiteSettingSaveDto })
    async saveSetting(@Body() body: SystemSiteSettingSaveDto) {
        const payload: any = {
            title: (body.title || 'WashClub 管理后台').slice(0, 60),
            logoUrl: body.logoUrl ?? null,
            bgType: body.bgType === 'image' ? 'image' : 'bing',
            bgImageUrl: body.bgImageUrl ?? null,
            defaultMemberAvatarUrl: body.defaultMemberAvatarUrl ?? null,
            growthPerYuan: Math.max(1, Math.floor(Number(body?.growthPerYuan ?? 1))),
            businessHoursJson: normalizeBusinessHours(body?.businessHoursJson),
            ...normalizeManualStatus(body?.busyEnabled, body?.pausedEnabled),
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

    // 计算当前营业状态（公共接口）
    @Get('public/business-status')
    @ApiOperation({ summary: '公共-获取当前营业状态' })
    async getPublicBusinessStatus() {
        const ss: any = await this.prisma.siteSetting.findFirst().catch(() => null) || { businessHoursJson: { start: '09:00', end: '18:00' }, busyEnabled: false, pausedEnabled: false };
        const hours = normalizeBusinessHours(ss?.businessHoursJson);
        const flags = normalizeManualStatus(ss?.busyEnabled, ss?.pausedEnabled);
        const now = new Date();
        const status = computeBusinessStatus(hours, flags, now);
        return { now: now.toISOString(), hours, ...flags, status, label: statusLabel(status) };
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

    // =========================
    // 小程序用户协议：以静态HTML文件方式存储与输出
    // =========================

    private getTermsFilePath(): string {
        const dir = join(process.cwd(), 'uploads', 'public');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        return join(dir, 'miniapp-terms.html');
    }

    // 管理端：读取当前用户协议HTML
    @Get('miniapp-terms')
    @UseGuards(AdminGuard)
    @RequirePerm('system-basic')
    @ApiOperation({ summary: '获取小程序用户协议（HTML）' })
    async getMiniappTerms() {
        try {
            const path = this.getTermsFilePath();
            if (existsSync(path)) {
                const html = readFileSync(path, 'utf8');
                return { html };
            }
        } catch {}
        const fallback = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>用户协议</title><style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,\"PingFang SC\",\"Hiragino Sans GB\",\"Microsoft YaHei\",sans-serif;margin:16px;line-height:1.7;color:#111827}h1,h2{margin:.6em 0}a{color:#2563eb;text-decoration:underline}</style></head><body><h1>用户协议</h1><p>请在此处编辑用户协议内容。</p></body></html>';
        return { html: fallback };
    }

    // 管理端：保存用户协议HTML为静态文件
    @Post('miniapp-terms')
    @UseGuards(AdminGuard)
    @RequirePerm('system-basic')
    @ApiOperation({ summary: '保存小程序用户协议（HTML）' })
    async saveMiniappTerms(@Body() body: { html?: string }) {
        const raw = String(body?.html ?? '').trim();
        // 允许空：写入占位模板，确保有有效HTML骨架
        const html = raw || '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>用户协议</title></head><body><h1>用户协议</h1><p>内容为空。</p></body></html>';
        const filePath = this.getTermsFilePath();
        const dir = dirname(filePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(filePath, html, 'utf8');
        // 返回可公开访问的URL（供前端展示/复制）
        const publicPath = '/uploads/public/miniapp-terms.html';
        return { ok: true, url: publicPath };
    }

    // 公共：直接输出HTML（Content-Type: text/html）
    @Get('public/miniapp-terms')
    @ApiOperation({ summary: '公共-输出小程序用户协议HTML' })
    async getPublicMiniappTerms(@Res() res: Response) {
        try {
            const filePath = this.getTermsFilePath();
            if (existsSync(filePath)) {
                const html = readFileSync(filePath, 'utf8');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(html);
                return;
            }
        } catch {}
        const fallback = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/><title>用户协议</title></head><body><h1>用户协议</h1><p>内容暂未配置。</p></body></html>';
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(fallback);
    }

    // =========================
    // 工具方法（文件内局部）
    // =========================
}

function normalizeBusinessHours(input: any): { start: string; end: string } {
    try {
        const s = String(input?.start || '09:00').slice(0,5);
        const e = String(input?.end || '18:00').slice(0,5);
        const ok = (v:string)=> /^\d{2}:\d{2}$/.test(v);
        const start = ok(s) ? s : '09:00';
        const end = ok(e) ? e : '18:00';
        return { start, end };
    } catch { return { start: '09:00', end: '18:00' }; }
}

function normalizeManualStatus(busy?: any, paused?: any): { busyEnabled: boolean; pausedEnabled: boolean } {
    const b = !!busy; const p = !!paused;
    if (p) return { busyEnabled: false, pausedEnabled: true };
    if (b) return { busyEnabled: true, pausedEnabled: false };
    return { busyEnabled: false, pausedEnabled: false };
}

type BizStatus = 'OPEN'|'REST'|'BUSY'|'PAUSED';
function statusLabel(s: BizStatus): string {
    if (s==='OPEN') return '营业中';
    if (s==='REST') return '休息中';
    if (s==='BUSY') return '忙碌';
    return '暂停营业';
}

function computeBusinessStatus(hours: { start:string; end:string }, flags: { busyEnabled:boolean; pausedEnabled:boolean }, now: Date): BizStatus {
    if (flags.pausedEnabled) return 'PAUSED';
    if (flags.busyEnabled) return 'BUSY';
    // 自动：根据时间判断营业/休息；支持跨天营业（end < start）
    const [sh, sm] = hours.start.split(':').map(n=>parseInt(n,10));
    const [eh, em] = hours.end.split(':').map(n=>parseInt(n,10));
    const t = now.getHours()*60 + now.getMinutes();
    const startMin = (isFinite(sh)?sh:9)*60 + (isFinite(sm)?sm:0);
    const endMin = (isFinite(eh)?eh:18)*60 + (isFinite(em)?em:0);
    if (endMin === startMin) return 'REST'; // 0 营业时长视为休息
    if (endMin > startMin) {
        return (t >= startMin && t < endMin) ? 'OPEN' : 'REST';
    }
    // 跨天：如 20:00 - 02:00
    return (t >= startMin || t < endMin) ? 'OPEN' : 'REST';
}


