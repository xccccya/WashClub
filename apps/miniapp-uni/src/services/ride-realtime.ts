import { rideApi } from './ride';

export function onRideRealtime(handler: (message: any) => void) {
	const listener = (message: any) => handler(message);
	try { uni.$on('ride:realtime', listener); } catch {}
	return () => { try { uni.$off('ride:realtime', listener); } catch {} };
}

export function startDriverLocationTracking(onUpdate?: (result: any) => void) {
	let stopped = false;
	let lastSentAt = 0;
	let h5WatchId: number | null = null;
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
	// #ifdef H5
	try { h5WatchId = navigator.geolocation.watchPosition((position) => report({ longitude: position.coords.longitude, latitude: position.coords.latitude, heading: position.coords.heading, speed: position.coords.speed }), () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }); } catch {}
	// #endif
	return () => {
		stopped = true;
		// #ifdef MP-WEIXIN
		try { (uni as any).offLocationChange(report); (uni as any).stopLocationUpdate(); } catch {}
		// #endif
		// #ifdef H5
		try { if (h5WatchId != null) navigator.geolocation.clearWatch(h5WatchId); } catch {}
		// #endif
	};
}
