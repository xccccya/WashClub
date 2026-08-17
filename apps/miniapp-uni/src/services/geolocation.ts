export type RideLocationPoint = { longitude: number; latitude: number; heading?: number; speed?: number; accuracy?: number; timestamp?: number };
export type RideLocationErrorCode = 'INSECURE_CONTEXT' | 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE' | 'UNSUPPORTED';

export class RideLocationError extends Error {
	constructor(public readonly code: RideLocationErrorCode, message: string) { super(message); this.name = 'RideLocationError'; }
}

function isLocalHostname(hostname: string) {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function assertH5LocationContext() {
	// #ifdef H5
	if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalHostname(window.location.hostname)) {
		throw new RideLocationError('INSECURE_CONTEXT', '浏览器定位需要 HTTPS，请使用安全域名或手动选择起点');
	}
	if (typeof navigator === 'undefined' || !navigator.geolocation) throw new RideLocationError('UNSUPPORTED', '当前浏览器不支持定位，请手动选择起点');
	// #endif
}

export async function getCurrentRideLocation(): Promise<RideLocationPoint> {
	assertH5LocationContext();
	return new Promise((resolve, reject) => {
		try {
			uni.getLocation({
				type: 'gcj02', isHighAccuracy: true, highAccuracyExpireTime: 8000,
				success: (result:any) => resolve({
					longitude: Number(result.longitude), latitude: Number(result.latitude),
					heading: Number(result.direction ?? result.heading), speed: Number(result.speed),
					accuracy: Number(result.accuracy ?? result.horizontalAccuracy),
					timestamp: Number(result.timestamp) || Date.now(),
				}),
				fail: (error:any) => {
					const text = String(error?.errMsg || error?.message || '').toLowerCase();
					if (/deny|denied|auth|permission/.test(text)) reject(new RideLocationError('PERMISSION_DENIED', '定位权限被拒绝，请在系统或浏览器设置中允许定位，也可手动选择起点'));
					else if (/timeout/.test(text)) reject(new RideLocationError('TIMEOUT', '定位超时，请到开阔位置重试或手动选择起点'));
					else reject(new RideLocationError('UNAVAILABLE', '暂时无法获取位置，请检查系统定位服务或手动选择起点'));
				},
			});
		} catch { reject(new RideLocationError('UNAVAILABLE', '定位服务不可用，请手动选择起点')); }
	});
}

export function locationErrorMessage(error: unknown) {
	return error instanceof Error && error.message ? error.message : '暂时无法获取位置，请手动选择起点';
}
