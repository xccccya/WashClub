import { Controller, Get, Query } from '@nestjs/common';

@Controller('content/car')
export class CarDataController {
	private readonly apiKey = process.env.TANSHU_CAR_API_KEY || process.env.CAR_API_KEY || '';
	private static brandsCache: { data: any[]; ts: number } = { data: [], ts: 0 };
	private static seriesCache = new Map<number, { data: any[]; ts: number }>();
	private static readonly BRANDS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
	private static readonly SERIES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

	private async fetchJson(url: string, timeoutMs = 8000): Promise<any> {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		try {
			const resp = await fetch(url, { signal: ctrl.signal as any });
			return await resp.json().catch(() => ({}));
		} finally {
			clearTimeout(timer);
		}
	}

	@Get('brands')
	async getBrands() {
		const now = Date.now();
		if (CarDataController.brandsCache.data.length && now - CarDataController.brandsCache.ts < CarDataController.BRANDS_TTL_MS) {
			return CarDataController.brandsCache.data;
		}
		const url = `https://api.tanshuapi.com/api/car/v1/carBrand?key=${this.apiKey}`;
		try {
			const json: any = await this.fetchJson(url, 8000);
			const data = Array.isArray(json?.data) ? json.data : [];
			if (data.length) CarDataController.brandsCache = { data, ts: now };
			return data;
		} catch (e) {
			// 返回缓存兜底，避免 5xx
			return CarDataController.brandsCache.data || [];
		}
	}

	@Get('series')
	async getSeries(@Query('brandId') brandId?: string) {
		const id = Number(brandId);
		if (!id) return [];
		const now = Date.now();
		const cached = CarDataController.seriesCache.get(id);
		if (cached && now - cached.ts < CarDataController.SERIES_TTL_MS) return cached.data;
		const url = `https://api.tanshuapi.com/api/car/v1/carSeries?brand_id=${id}&key=${this.apiKey}`;
		try {
			const json: any = await this.fetchJson(url, 8000);
			const data = Array.isArray(json?.data) ? json.data : [];
			if (data.length) CarDataController.seriesCache.set(id, { data, ts: now });
			return data;
		} catch (e) {
			return cached?.data || [];
		}
	}
}


