import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { CarBrandDto, CarBrandGroupDto, CarSeriesDto, CarSeriesQueryDto } from './car-data.dto.js';

@ApiTags('content')
@Controller('content/car')
export class CarDataController {
	private readonly apiKey = process.env.TANSHU_CAR_API_KEY || process.env.CAR_API_KEY || '';
	private static brandsCache: { data: CarBrandGroupDto[]; ts: number } = { data: [], ts: 0 };
	private static seriesCache = new Map<number, { data: CarSeriesDto[]; ts: number }>();
	private static readonly BRANDS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
	private static readonly SERIES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

	private async fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		try {
			const resp = await fetch(url, { signal: ctrl.signal });
			if (!resp.ok) throw new Error(`车型数据服务返回 HTTP ${resp.status}`);
			return await resp.json().catch(() => ({}));
		} finally {
			clearTimeout(timer);
		}
	}

	private imageUrl(value: unknown): string | undefined {
		if (typeof value !== 'string' || !value.trim()) return undefined;
		return value.trim().replace(/^http:\/\//i, 'https://');
	}

	private firstImage(source: Record<string, unknown>): string | undefined {
		for (const key of ['img', 'image', 'logo', 'icon', 'pic', 'pic_url', 'logo_url']) {
			const value = this.imageUrl(source[key]);
			if (value) return value;
		}
		return undefined;
	}

	private normalizeBrands(value: unknown): CarBrandGroupDto[] {
		if (!Array.isArray(value)) return [];
		return value.flatMap((raw): CarBrandGroupDto[] => {
			if (!raw || typeof raw !== 'object') return [];
			const source = raw as Record<string, unknown>;
			const mainBrandId = Number(source.main_brand_id);
			const mainBrandName = String(source.main_brand_name || '').trim();
			const letter = String(source.letter || '').trim().toUpperCase();
			if (!Number.isFinite(mainBrandId) || mainBrandId <= 0 || !mainBrandName) return [];
			const brandList = Array.isArray(source.brand_list) ? source.brand_list : [];
			const brands = brandList.flatMap((brand): CarBrandDto[] => {
				if (!brand || typeof brand !== 'object') return [];
				const item = brand as Record<string, unknown>;
				const brandId = Number(item.brand_id);
				const brandName = String(item.brand_name || '').trim();
				if (!Number.isFinite(brandId) || brandId <= 0 || !brandName) return [];
				const img = this.firstImage(item);
				return [{ brand_id: brandId, brand_name: brandName, ...(img ? { img } : {}) }];
			});
			const img = this.firstImage(source);
			return [{ main_brand_id: mainBrandId, main_brand_name: mainBrandName, letter, ...(img ? { img } : {}), brand_list: brands }];
		});
	}

	private normalizeSeries(value: unknown): CarSeriesDto[] {
		if (!Array.isArray(value)) return [];
		return value.flatMap((raw): CarSeriesDto[] => {
			if (!raw || typeof raw !== 'object') return [];
			const source = raw as Record<string, unknown>;
			const seriesId = Number(source.series_id);
			const seriesName = String(source.series_name || '').trim();
			if (!Number.isFinite(seriesId) || seriesId <= 0 || !seriesName) return [];
			const scale = typeof source.scale === 'string' && source.scale.trim() ? source.scale.trim() : undefined;
			const img = this.firstImage(source);
			return [{ series_id: seriesId, series_name: seriesName, ...(scale ? { scale } : {}), ...(img ? { img } : {}) }];
		});
	}

	@Get('brands')
	@ApiOperation({ summary: '车型品牌列表（含缓存）' })
	@ApiOkResponse({ type: CarBrandGroupDto, isArray: true })
	@ApiServiceUnavailableResponse({ description: '车型数据服务未配置或暂不可用' })
	async getBrands(): Promise<CarBrandGroupDto[]> {
		const now = Date.now();
		if (CarDataController.brandsCache.data.length && now - CarDataController.brandsCache.ts < CarDataController.BRANDS_TTL_MS) {
			return CarDataController.brandsCache.data;
		}
		if (!this.apiKey) throw new ServiceUnavailableException('车型数据服务暂不可用');
		const url = `https://api.tanshuapi.com/api/car/v1/carBrand?key=${this.apiKey}`;
		try {
			const json = await this.fetchJson(url, 8000) as { data?: unknown };
			const data = this.normalizeBrands(json?.data);
			if (data.length) CarDataController.brandsCache = { data, ts: now };
			return data;
		} catch {
			if (CarDataController.brandsCache.data.length) return CarDataController.brandsCache.data;
			throw new ServiceUnavailableException('车型数据服务暂不可用');
		}
	}

	@Get('series')
	@ApiOperation({ summary: '车型车系列表（按品牌，含缓存）' })
	@ApiOkResponse({ type: CarSeriesDto, isArray: true })
	@ApiServiceUnavailableResponse({ description: '车型数据服务未配置或暂不可用' })
	async getSeries(@Query() query: CarSeriesQueryDto): Promise<CarSeriesDto[]> {
		const id = query.brandId;
		const now = Date.now();
		const cached = CarDataController.seriesCache.get(id);
		if (cached && now - cached.ts < CarDataController.SERIES_TTL_MS) return cached.data;
		if (!this.apiKey) throw new ServiceUnavailableException('车型数据服务暂不可用');
		const url = `https://api.tanshuapi.com/api/car/v1/carSeries?brand_id=${id}&key=${this.apiKey}`;
		try {
			const json = await this.fetchJson(url, 8000) as { data?: unknown };
			const data = this.normalizeSeries(json?.data);
			if (data.length) CarDataController.seriesCache.set(id, { data, ts: now });
			return data;
		} catch {
			if (cached?.data.length) return cached.data;
			throw new ServiceUnavailableException('车型数据服务暂不可用');
		}
	}
}


