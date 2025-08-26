import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

type AMapDistrictResponse = {
    status: string;
    info: string;
    infocode: string;
    districts?: any[];
};

@ApiTags('content')
@Controller('content')
export class DistrictController {
    @Get('district')
    @ApiOperation({ summary: '行政区查询（代理高德API）' })
    async getDistrict(
        @Query('keywords') keywords?: string,
        @Query('subdistrict') subdistrict?: string,
        @Query('extensions') extensions?: string,
        @Query('level') level?: string,
    ) {
        const key = process.env.AMAP_KEY || process.env.AMAP_WEB_KEY;
        if (!key) throw new BadRequestException('Missing AMAP_KEY');
        const baseUrl = 'https://restapi.amap.com/v3/config/district';
        const toQS = (params: Record<string, string>) =>
            Object.entries(params)
                .filter(([, v]) => typeof v !== 'undefined' && v !== null && String(v).length > 0)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
                .join('&');
        const url = `${baseUrl}?${toQS({
            key,
            keywords: (keywords || '').trim(),
            subdistrict: (subdistrict || '').trim(),
            extensions: (extensions || '').trim(),
            level: (level || '').trim(),
        })}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as AMapDistrictResponse;
            return json;
        } catch (e: any) {
            clearTimeout(timer);
            return { status: '0', info: 'network_or_proxy', infocode: '0', error: e?.message || 'failed' };
        }
    }
}


