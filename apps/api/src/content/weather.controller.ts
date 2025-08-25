import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

type AMapLiveResponse = {
	status: string;
	info: string;
	infocode: string;
	lives?: Array<{
		province: string;
		city: string;
		adcode: string;
		weather: string;
		temperature: string;
		winddirection: string;
		windpower: string;
		humidity: string;
		reporttime: string;
	}>;
};

type AMapForecastResponse = {
	status: string;
	info: string;
	infocode: string;
	forecasts?: Array<{
		city: string;
		adcode: string;
		province: string;
		reporttime: string;
		casts: Array<{
			date: string;
			week: string;
			dayweather: string;
			nightweather: string;
			daytemp: string;
			nighttemp: string;
			daywind: string;
			nightwind: string;
			daypower: string;
			nightpower: string;
		}>;
	}>;
};

@ApiTags('content')
@Controller('content')
export class WeatherController {
	@Get('weather')
	@ApiOperation({ summary: '天气：实时与预报（高德API）' })
	async getWeather(@Query('city') city?: string) {
		const adcode = (city || '511024').trim();
		const key = process.env.AMAP_KEY || process.env.AMAP_WEB_KEY;
		if (!key) throw new BadRequestException('Missing AMAP_KEY');

		const baseUrl = 'https://restapi.amap.com/v3/weather/weatherInfo';
		const toQS = (params: Record<string, string>) =>
			Object.entries(params)
				.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
				.join('&');

		async function fetchJson(url: string, timeoutMs = 6000, retries = 1): Promise<any> {
			let lastErr: unknown = null;
			for (let attempt = 0; attempt <= retries; attempt++) {
				const ctrl = new AbortController();
				const timer = setTimeout(() => ctrl.abort(), timeoutMs);
				try {
					const res = await fetch(url, { signal: ctrl.signal });
					clearTimeout(timer);
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					return await res.json();
				} catch (e) {
					lastErr = e;
					clearTimeout(timer);
					// 小退避
					await new Promise((r) => setTimeout(r, 200));
				}
			}
			throw lastErr ?? new Error('fetch failed');
		}

		const liveUrl = `${baseUrl}?${toQS({ city: adcode, key, extensions: 'base' })}`;
		const forecastUrl = `${baseUrl}?${toQS({ city: adcode, key, extensions: 'all' })}`;

		const [liveSettled, forecastSettled] = await Promise.allSettled([
			fetchJson(liveUrl, 6000, 1) as Promise<AMapLiveResponse>,
			fetchJson(forecastUrl, 6000, 1) as Promise<AMapForecastResponse>,
		]);

		const liveRes = liveSettled.status === 'fulfilled' ? liveSettled.value : null;
		const forecastRes = forecastSettled.status === 'fulfilled' ? forecastSettled.value : null;

		const liveOk = liveRes && liveRes.infocode === '10000';
		const forecastOk = forecastRes && forecastRes.infocode === '10000';

		if (!liveOk && !forecastOk) {
			return {
				ok: false,
				source: 'amap',
				adcode,
				cityLabel: adcode === '511024' ? '威远县' : '',
				error: 'network_or_proxy',
				message: '服务器访问高德天气失败，可能是网络、代理或 TLS 受限',
			};
		}

		const live = liveOk && Array.isArray(liveRes?.lives) && liveRes!.lives!.length > 0 ? liveRes!.lives![0] : null;
		const forecast = forecastOk && Array.isArray(forecastRes?.forecasts) && forecastRes!.forecasts!.length > 0 ? forecastRes!.forecasts![0] : null;

		return {
			ok: true,
			source: 'amap',
			adcode,
			cityName: live?.city || forecast?.city || '',
			province: live?.province || forecast?.province || '',
			reporttimeLive: live?.reporttime || null,
			reporttimeForecast: forecast?.reporttime || null,
			cityLabel: adcode === '511024' ? '威远县' : live?.city || forecast?.city || '',
			live,
			forecast,
			partial: { live: !!live, forecast: !!forecast },
		};
	}
}


