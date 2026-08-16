import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export type RideRoute = {
	distanceMeters: number;
	durationSeconds: number;
	tollAmount: number;
	tollDistanceMeters: number;
	tollRoads: string[];
	preference: 'RECOMMENDED' | 'AVOID_HIGHWAY';
	points: Array<{ longitude: number; latitude: number }>;
	raw: Record<string, unknown>;
};

type CachedRoute = { expiresAt: number; value: RideRoute[] };

@Injectable()
export class RideAmapService {
	private readonly cache = new Map<string, CachedRoute>();
	private readonly timeoutMs = 5000;

	private get key() {
		return String(process.env.AMAP_WEBSERVICE_KEY || '').trim();
	}

	async drivingRoute(origin: { longitude: number; latitude: number }, destination: { longitude: number; latitude: number }): Promise<RideRoute> {
		const routes = await this.drivingRoutes(origin, destination, 1);
		return routes[0];
	}

	async drivingRoutes(
		origin: { longitude: number; latitude: number },
		destination: { longitude: number; latitude: number },
		count = 3,
		options: { strategy?: string; preference?: RideRoute['preference'] } = {},
	): Promise<RideRoute[]> {
		this.assertCoordinate(origin.longitude, origin.latitude);
		this.assertCoordinate(destination.longitude, destination.latitude);
		if (!this.key) throw new ServiceUnavailableException('路线服务未配置，请联系管理员');
		const alternativeRoute = Math.max(1, Math.min(3, Math.round(count)));
		const strategy = String(options.strategy || '32');
		const preference = options.preference || 'RECOMMENDED';
		const cacheKey = `${origin.longitude.toFixed(6)},${origin.latitude.toFixed(6)}:${destination.longitude.toFixed(6)},${destination.latitude.toFixed(6)}:${strategy}:${alternativeRoute}`;
		const cached = this.cache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) return cached.value;

		const url = new URL('https://restapi.amap.com/v5/direction/driving');
		url.searchParams.set('key', this.key);
		url.searchParams.set('origin', `${origin.longitude},${origin.latitude}`);
		url.searchParams.set('destination', `${destination.longitude},${destination.latitude}`);
		url.searchParams.set('strategy', strategy);
		url.searchParams.set('alternative_route', String(alternativeRoute));
		url.searchParams.set('show_fields', 'cost,polyline');
		const data = await this.fetchJsonWithRetry(url);
		if (String(data?.status) !== '1') {
			throw new BadGatewayException(`路线规划失败：${String(data?.info || data?.infocode || '高德服务异常')}`);
		}
		const paths = Array.isArray(data?.route?.paths) ? data.route.paths.slice(0, alternativeRoute) : [];
		if (!paths.length) throw new BadGatewayException('路线规划失败：未找到可用路线');
		const results = paths.map((path: any) => this.parseRoute(path, preference)).filter((route: RideRoute) => route.distanceMeters > 0 && route.durationSeconds > 0 && route.points.length >= 2);
		if (!results.length) throw new BadGatewayException('路线规划失败：高德返回的路线不完整');
		this.cache.set(cacheKey, { expiresAt: Date.now() + 4500, value: results });
		if (this.cache.size > 500) {
			for (const [key, item] of this.cache) if (item.expiresAt <= Date.now()) this.cache.delete(key);
		}
		return results;
	}

	private parseRoute(path: any, preference: RideRoute['preference']): RideRoute {
		const points: Array<{ longitude: number; latitude: number }> = [];
		const tollRoads = new Set<string>();
		for (const step of Array.isArray(path.steps) ? path.steps : []) {
			for (const token of String(step?.polyline || '').split(';')) {
				const [lngText, latText] = token.split(',');
				const longitude = Number(lngText);
				const latitude = Number(latText);
				if (Number.isFinite(longitude) && Number.isFinite(latitude)) points.push({ longitude, latitude });
			}
			if (step?.toll_road) tollRoads.add(String(step.toll_road));
		}
		const cost = path.cost || {};
		return {
			distanceMeters: Math.max(0, Math.round(Number(path.distance || 0))),
			durationSeconds: Math.max(0, Math.round(Number(cost.duration || path.duration || 0))),
			tollAmount: Math.max(0, Number(cost.tolls || path.tolls || 0)),
			tollDistanceMeters: Math.max(0, Math.round(Number(cost.toll_distance || path.toll_distance || 0))),
			tollRoads: [...tollRoads],
			preference,
			points,
			raw: {
				strategy: path.strategy || null,
				restriction: path.restriction || null,
				trafficLights: cost.traffic_lights || null,
			},
		};
	}

	async inputTips(keywords: string, city?: string, origin?: { longitude: number; latitude: number }) {
		const value = String(keywords || '').trim();
		if (!value) return [];
		if (!this.key) throw new ServiceUnavailableException('地点搜索服务未配置，请联系管理员');
		const url = new URL('https://restapi.amap.com/v3/assistant/inputtips');
		url.searchParams.set('key', this.key);
		url.searchParams.set('keywords', value);
		url.searchParams.set('datatype', 'poi');
		if (city) url.searchParams.set('city', city);
		if (origin) {
			this.assertCoordinate(origin.longitude, origin.latitude);
			url.searchParams.set('location', `${origin.longitude},${origin.latitude}`);
		}
		const data = await this.fetchJsonWithRetry(url);
		if (String(data?.status) !== '1') throw new BadGatewayException('地点搜索失败，请稍后重试');
		const results = (Array.isArray(data?.tips) ? data.tips : []).flatMap((tip: any) => {
			if (typeof tip?.location !== 'string') return [];
			const [longitude, latitude] = tip.location.split(',').map(Number);
			if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
			const distanceMeters = origin ? Math.round(this.distance(origin.latitude, origin.longitude, latitude, longitude)) : undefined;
			return [{ id: String(tip.id || ''), name: String(tip.name || ''), address: String(tip.address || ''), district: String(tip.district || ''), longitude, latitude, distanceMeters }];
		});
		return origin ? results.sort((a: any, b: any) => Number(a.distanceMeters || 0) - Number(b.distanceMeters || 0)) : results;
	}

	async reverseGeocode(longitude: number, latitude: number) {
		this.assertCoordinate(longitude, latitude);
		if (!this.key) throw new ServiceUnavailableException('地点服务未配置，请联系管理员');
		const url = new URL('https://restapi.amap.com/v3/geocode/regeo');
		url.searchParams.set('key', this.key);
		url.searchParams.set('location', `${longitude},${latitude}`);
		url.searchParams.set('extensions', 'base');
		url.searchParams.set('radius', '500');
		const data = await this.fetchJsonWithRetry(url);
		if (String(data?.status) !== '1') throw new BadGatewayException('地图选点解析失败，请稍后重试');
		const regeocode = data?.regeocode || {};
		const component = regeocode.addressComponent || {};
		const formattedAddress = String(regeocode.formatted_address || '').trim();
		return {
			id: '',
			name: String(component.neighborhood?.name || component.building?.name || formattedAddress || '地图选点'),
			address: formattedAddress || '地图选点',
			district: String(component.district || ''),
			longitude,
			latitude,
		};
	}

	private distance(lat1: number, lng1: number, lat2: number, lng2: number) {
		const rad = (value: number) => (value * Math.PI) / 180;
		const dLat = rad(lat2 - lat1);
		const dLng = rad(lng2 - lng1);
		const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
		return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

	private assertCoordinate(longitude: number, latitude: number) {
		if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
			throw new BadRequestException('经纬度无效');
		}
	}

	private async fetchJsonWithRetry(url: URL): Promise<any> {
		let lastError: unknown;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), this.timeoutMs);
			try {
				const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return await response.json();
			} catch (error) {
				lastError = error;
			} finally {
				clearTimeout(timer);
			}
		}
		throw new BadGatewayException(lastError instanceof Error && lastError.name === 'AbortError' ? '路线请求超时，请稍后重试' : '路线服务暂时不可用');
	}
}
