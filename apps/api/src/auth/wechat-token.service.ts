import { Injectable, BadRequestException, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class WechatTokenService implements OnModuleDestroy {
    private cache: { token: string; expiresAt: number } | null = null;
    private inFlight: Promise<string> | null = null;
    private refreshTimer: NodeJS.Timeout | null = null;

    private get appId(): string {
        const v = process.env.WECHAT_MINIAPP_APPID || process.env.WECHAT_APPID;
        if (!v) throw new BadRequestException('后台未配置 WECHAT_MINIAPP_APPID');
        return v;
    }

    private get secret(): string {
        const v = process.env.WECHAT_MINIAPP_SECRET || process.env.WECHAT_SECRET;
        if (!v) throw new BadRequestException('后台未配置 WECHAT_MINIAPP_SECRET');
        return v;
    }

    async getAccessToken(): Promise<string> {
        const now = Date.now();
        if (this.cache && this.cache.expiresAt - 30_000 > now) return this.cache.token;
        if (this.inFlight) return this.inFlight;
        this.inFlight = this.fetchAndCache();
        try { return await this.inFlight; } finally { this.inFlight = null; }
    }

    async forceRefresh(): Promise<string> {
        this.cache = null;
        if (this.refreshTimer) { try { clearTimeout(this.refreshTimer); } catch {} this.refreshTimer = null; }
        return this.getAccessToken();
    }

    private async fetchAndCache(): Promise<string> {
        const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(this.appId)}&secret=${encodeURIComponent(this.secret)}`;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);
            try {
                const resp = await fetch(url, { signal: controller.signal });
                clearTimeout(timeout);
                if (!resp.ok) { lastErr = new Error(`${resp.status} ${resp.statusText}`); }
                else {
                    const data = (await resp.json()) as any;
                    if (data?.access_token && data?.expires_in) {
                        const expiresAt = Date.now() + Number(data.expires_in) * 1000;
                        this.cache = { token: data.access_token, expiresAt };
                        this.scheduleRefresh(expiresAt, 300_000); // 提前5分钟刷新
                        return this.cache.token;
                    }
                    lastErr = new Error(`响应异常: ${JSON.stringify(data)}`);
                }
            } catch (e: any) { clearTimeout(timeout); lastErr = e; }
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
        throw new BadRequestException(`获取微信access_token网络失败: ${lastErr?.message || lastErr}`);
    }

    private scheduleRefresh(expiresAt: number, aheadMs: number) {
        if (this.refreshTimer) { try { clearTimeout(this.refreshTimer); } catch {} this.refreshTimer = null; }
        const now = Date.now();
        const delay = Math.max(10_000, Math.min(90 * 60 * 1000, expiresAt - now - (aheadMs || 0))); // 至少10秒，最多90分钟
        this.refreshTimer = setTimeout(() => { this.forceRefresh().catch(()=>{}); }, delay);
    }

    onModuleDestroy() {
        if (this.refreshTimer) { try { clearTimeout(this.refreshTimer); } catch {} this.refreshTimer = null; }
    }
}


