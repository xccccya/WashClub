import { All, Controller, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';

@ApiExcludeController()
@Controller('_AMapService')
export class RideAmapProxyController {
	@All('*path')
	async proxy(@Req() req: Request, @Res() res: Response) {
		// 该安全码只属于 Web 端 JSAPI v2.0 的 serviceHost 代理，与 Web Service API Key 无关。
		const securityCode = String(process.env.AMAP_JSAPI_SECURITY_JSCODE || '').trim();
		if (!securityCode) throw new ServiceUnavailableException('高德 JSAPI 安全代理未配置');
		const rawPath = Array.isArray((req.params as any)?.path) ? (req.params as any).path.join('/') : String((req.params as any)?.path || '');
		const path = `/${rawPath.replace(/^\/+/, '')}`;
		if (!/^\/(?:v3|v4|v5|rest|ws)\//.test(path)) return res.status(400).json({ message: '不允许的高德代理路径' });
		const target = new URL(`https://restapi.amap.com${path}`);
		for (const [key, value] of Object.entries(req.query || {})) {
			if (key === 'jscode') continue;
			if (Array.isArray(value)) for (const item of value) target.searchParams.append(key, String(item));
			else if (value != null) target.searchParams.set(key, String(value));
		}
		target.searchParams.set('jscode', securityCode);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
		try {
			const method = String(req.method || 'GET').toUpperCase();
			const response = await fetch(target, {
				method,
				signal: controller.signal,
				headers: { accept: String(req.headers.accept || 'application/json'), ...(method === 'GET' || method === 'HEAD' ? {} : { 'content-type': 'application/json' }) },
				body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(req.body || {}),
			});
			const contentType = response.headers.get('content-type');
			if (contentType) res.setHeader('content-type', contentType);
			return res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
		} catch (error) {
			return res.status(502).json({ message: error instanceof Error && error.name === 'AbortError' ? '高德代理请求超时' : '高德代理暂时不可用' });
		} finally {
			clearTimeout(timer);
		}
	}
}
