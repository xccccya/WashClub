import { rideApi } from './ride';
import { getCurrentRideLocation } from './geolocation';

export function onRideRealtime(handler: (message: any) => void) {
	const listener = (message: any) => handler(message);
	try { uni.$on('ride:realtime', listener); } catch {}
	return () => { try { uni.$off('ride:realtime', listener); } catch {} };
}

export function startDriverLocationTracking(onUpdate?: (result: any) => void) {
	let stopped = false;
	let lastSentAt = 0;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	const report = async (location: any) => {
		if (stopped || Date.now() - lastSentAt < 4500) return;
		lastSentAt = Date.now();
		try {
			const result = await rideApi.reportLocation({
				longitude: Number(location.longitude), latitude: Number(location.latitude),
				heading: Number.isFinite(Number(location.direction ?? location.heading)) ? Number(location.direction ?? location.heading) : undefined,
				speedMetersPerSecond: Number.isFinite(Number(location.speed)) ? Math.max(0, Number(location.speed)) : undefined,
				clientTimestamp: new Date().toISOString(),
			});
			onUpdate?.(result);
		} catch {}
	};
	// #ifdef MP-WEIXIN
	try {
		(uni as any).startLocationUpdateBackground({ fail: () => uni.showToast({ title: '请允许后台定位后再出车', icon: 'none' }) });
		(uni as any).onLocationChange(report);
	} catch {}
	// #endif
	// 立即上报并主动维持心跳；静止时 onLocationChange/watchPosition 不保证按期触发。
	void getCurrentRideLocation().then(report).catch(() => {});
	heartbeatTimer = setInterval(() => { void getCurrentRideLocation().then(report).catch(() => {}); }, 5000);
	return () => {
		stopped = true;
		// #ifdef MP-WEIXIN
		try { (uni as any).offLocationChange(report); (uni as any).stopLocationUpdate(); } catch {}
		// #endif
		if (heartbeatTimer) clearInterval(heartbeatTimer);
	};
}
