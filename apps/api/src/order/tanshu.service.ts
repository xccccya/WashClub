import { Injectable } from '@nestjs/common';

@Injectable()
export class TanshuService {
    private get apiKey(): string | undefined {
        try {
            return process.env.TANSHU_CAR_API_KEY
                || process.env.TANSHU_API_KEY
                || process.env.TS_API_KEY;
        } catch { return undefined; }
    }

    private async requestJson(url: string): Promise<any> {
        try {
            const res = await fetch(url as any);
            const data = await (res as any).json();
            return data;
        } catch {
            return null;
        }
    }

    async getCompanies(): Promise<Array<{ code: string; name: string; logo?: string }>> {
        // 探数“快递公司查询”接口：文档页提供 /api/exp/v1/com
        const url = `https://api.tanshuapi.com/api/exp/v1/com?key=${encodeURIComponent(this.apiKey || '')}`;
        const data = await this.requestJson(url);
        try {
            const list = Array.isArray(data?.data) ? data.data : [];
            return list.map((it: any) => ({ code: String(it?.com || it?.code || '').trim(), name: String(it?.company || it?.name || '').trim(), logo: String(it?.logo || it?.icon || '').trim() })).filter(x=>x.code && x.name);
        } catch { return []; }
    }

    async queryTracking(params: { com?: string; no: string; phone?: string }): Promise<any> {
        const key = this.apiKey || '';
        const qs = new URLSearchParams();
        if (params.com) qs.set('com', params.com);
        qs.set('no', params.no);
        if (params.phone) qs.set('phone', params.phone);
        const url = `https://api.tanshuapi.com/api/exp/v2/index?key=${encodeURIComponent(key)}&${qs.toString()}`;
        const data = await this.requestJson(url);
        return data;
    }
}


