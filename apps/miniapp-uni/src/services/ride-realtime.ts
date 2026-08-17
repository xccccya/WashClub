import { getCurrentRideLocation, type RideLocationPoint } from './geolocation';
import { rideApi } from './ride';

type QueuedRideLocation = {
	clientPointId: string;
	clientTimestamp: string;
	rideTripId: number | null;
	longitude: number;
	latitude: number;
	heading?: number;
	speedMetersPerSecond?: number;
	accuracyMeters?: number;
};

const LOCATION_QUEUE_KEY = 'ride:driver-location-queue:v1';
const MAX_QUEUE_SIZE = 720;
const BATCH_SIZE = 100;
const MAX_QUEUE_AGE_MS = 23 * 60 * 60 * 1000;
let pointSequence = 0;
let flushPromise: Promise<any> | null = null;

export function onRideRealtime(handler: (message: any) => void) {
	const listener = (message: any) => handler(message);
	try { uni.$on('ride:realtime', listener); } catch {}
	return () => { try { uni.$off('ride:realtime', listener); } catch {} };
}

function readQueue(): QueuedRideLocation[] {
	try {
		const stored = uni.getStorageSync(LOCATION_QUEUE_KEY);
		if (!Array.isArray(stored)) return [];
		const now = Date.now();
		const queue = stored
			.filter((item: any) => {
				const sampledAt = new Date(item?.clientTimestamp).getTime();
				return item && typeof item.clientPointId === 'string'
					&& Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude))
					&& Number.isFinite(sampledAt) && sampledAt >= now - MAX_QUEUE_AGE_MS && sampledAt <= now + 60_000;
			})
			.map((item: any) => ({
				...item,
				longitude: Number(item.longitude),
				latitude: Number(item.latitude),
				rideTripId: Number.isInteger(Number(item.rideTripId)) && Number(item.rideTripId) > 0 ? Number(item.rideTripId) : null,
			}))
			.sort((left: QueuedRideLocation, right: QueuedRideLocation) => new Date(left.clientTimestamp).getTime() - new Date(right.clientTimestamp).getTime());
		if (queue.length !== stored.length) console.warn(`[ride-location] 已清理 ${stored.length - queue.length} 个无效或过期定位点`);
		return queue;
	} catch (error) {
		console.warn('[ride-location] 定位缓存读取失败', error);
		throw error;
	}
}

function writeQueue(queue: QueuedRideLocation[]) {
	try { uni.setStorageSync(LOCATION_QUEUE_KEY, queue); }
	catch (error) {
		console.warn('[ride-location] 定位缓存写入失败', error);
		throw error;
	}
}

function finiteNumber(value: unknown) {
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}

function sampleTime(location: RideLocationPoint | any) {
	const raw = finiteNumber(location?.timestamp);
	if (!raw || raw <= 0) return Date.now();
	const normalized = raw < 1_000_000_000_000 ? raw * 1000 : raw;
	return Number.isFinite(new Date(normalized).getTime()) ? normalized : Date.now();
}

function createQueuedPoint(location: RideLocationPoint | any, rideTripId: number | null): QueuedRideLocation {
	const at = sampleTime(location);
	const longitude = finiteNumber(location?.longitude);
	const latitude = finiteNumber(location?.latitude);
	if (longitude == null || longitude < -180 || longitude > 180 || latitude == null || latitude < -90 || latitude > 90) throw new Error('定位坐标无效，无法加入补传队列');
	pointSequence = (pointSequence + 1) % 1_000_000;
	const point: QueuedRideLocation = {
		clientPointId: `ride-location:${at.toString(36)}:${pointSequence.toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
		clientTimestamp: new Date(at).toISOString(),
		rideTripId: Number.isInteger(Number(rideTripId)) && Number(rideTripId) > 0 ? Number(rideTripId) : null,
		longitude,
		latitude,
	};
	const heading = finiteNumber(location.direction ?? location.heading);
	const speed = finiteNumber(location.speed);
	const accuracy = finiteNumber(location.accuracy ?? location.horizontalAccuracy);
	if (heading != null) point.heading = Math.max(0, Math.min(360, heading));
	if (speed != null) point.speedMetersPerSecond = Math.max(0, speed);
	if (accuracy != null) point.accuracyMeters = Math.max(0, accuracy);
	return point;
}

function enqueue(point: QueuedRideLocation) {
	const queue = [...readQueue(), point];
	if (queue.length > MAX_QUEUE_SIZE) {
		const dropped = queue.length - MAX_QUEUE_SIZE;
		queue.splice(0, dropped);
		console.warn(`[ride-location] 本地定位缓存达到上限，已移除最早的 ${dropped} 个点`);
	}
	writeQueue(queue);
}

export function flushDriverLocationQueue(onUpdate?: (result: any) => void) {
	if (flushPromise) return flushPromise;
	flushPromise = (async () => {
		let lastResult: any = null;
		writeQueue(readQueue());
		while (true) {
			const batch = readQueue().slice(0, BATCH_SIZE);
			if (!batch.length) break;
			const result = await rideApi.reportLocationBatch({ locations: batch });
			const sentIds = new Set(batch.map((item) => item.clientPointId));
			writeQueue(readQueue().filter((item) => !sentIds.has(item.clientPointId)));
			lastResult = result;
			onUpdate?.(result);
		}
		return lastResult;
	})().finally(() => { flushPromise = null; });
	return flushPromise;
}

export function reportDriverLocation(location: RideLocationPoint | any, rideTripId: number | null, onUpdate?: (result: any) => void) {
	enqueue(createQueuedPoint(location, rideTripId));
	return flushDriverLocationQueue(onUpdate);
}

export function startDriverLocationTracking(getRideTripId: () => number | null, onUpdate?: (result: any) => void) {
	let stopped = false;
	let lastSentAt = 0;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	const report = async (location: any) => {
		if (stopped || Date.now() - lastSentAt < 4500) return;
		lastSentAt = Date.now();
		try { await reportDriverLocation(location, getRideTripId(), onUpdate); }
		catch (error) { console.warn('[ride-location] 定位已缓存，等待网络恢复后补传', error); }
	};
	// #ifdef MP-WEIXIN
	try {
		(uni as any).startLocationUpdateBackground({ fail: () => uni.showToast({ title: '请允许后台定位后再出车', icon: 'none' }) });
		(uni as any).onLocationChange(report);
	} catch {}
	// #endif
	void flushDriverLocationQueue(onUpdate).catch((error) => console.warn('[ride-location] 历史定位补传等待重试', error));
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
