<template>
	<view class="map-shell">
		<!-- #ifdef MP-WEIXIN -->
		<map class="map" :longitude="center.longitude" :latitude="center.latitude" :markers="nativeMarkers" :polyline="nativePolyline" :show-location="showLocation" @markertap="onMarkerTap" @tap="onMapTap" />
		<!-- #endif -->
		<!-- #ifdef H5 -->
		<div ref="h5Container" class="map" />
		<!-- #endif -->
		<view v-if="error" class="map-error">{{ error }}</view>
	</view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RideMapMarker, RideMapPoint } from '../../services/ride-map';
import { toNativeMarkers, toNativePolyline } from '../../services/ride-map';
import vehicleLocationIcon from '../../static/icons/ride-vehicle-location.svg';
import originMarkerIcon from '../../static/icons/ride-origin-marker.svg';
import destinationMarkerIcon from '../../static/icons/ride-destination-marker.svg';

const props = withDefaults(defineProps<{ markers?: RideMapMarker[]; routePoints?: RideMapPoint[]; showLocation?: boolean; selectable?: boolean }>(), { markers: () => [], routePoints: () => [], showLocation: true, selectable: false });
const emit = defineEmits<{ markerTap: [id: number]; mapTap: [point: RideMapPoint] }>();
const error = ref('');
const fallbackCenter = { longitude: 104.6688, latitude: 29.5274 };
function isValidPoint(point: Partial<RideMapPoint> | null | undefined): point is RideMapPoint {
	return Number.isFinite(Number(point?.longitude)) && Number.isFinite(Number(point?.latitude));
}
const center = computed(() => {
	const point = props.markers.find(isValidPoint) || props.routePoints.find(isValidPoint) || fallbackCenter;
	return { longitude: Number(point.longitude), latitude: Number(point.latitude) };
});
const nativeMarkers = computed(() => toNativeMarkers(props.markers));
const nativePolyline = computed(() => toNativePolyline(props.routePoints));
function onMarkerTap(event: any) { emit('markerTap', Number(event?.detail?.markerId)); }
function onMapTap(event: any) {
	if (!props.selectable) return;
	const longitude = Number(event?.detail?.longitude);
	const latitude = Number(event?.detail?.latitude);
	if (Number.isFinite(longitude) && Number.isFinite(latitude)) emit('mapTap', { longitude, latitude });
}

// #ifdef H5
import AMapLoader from '@amap/amap-jsapi-loader';
const h5Container = ref<HTMLElement | null>(null);
let map: any = null;
let AMap: any = null;
let overlays: any[] = [];
let destroyed = false;
function escapeHtml(value: unknown) {
	return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}
function driverMeta(marker: RideMapMarker) {
	const kind = String(marker.kind || '');
	if (kind === 'driver-available') return { label: '空闲', color: '#16a34a', pulse: true };
	if (kind === 'driver-busy') return { label: '忙碌', color: '#f59e0b', pulse: true };
	return { label: '司机位置', color: '#2563eb', pulse: true };
}
function pointMarkerContent(marker: RideMapMarker) {
	const src = marker.kind === 'origin' ? originMarkerIcon : destinationMarkerIcon;
	return `<img class="ride-point-location-marker" src="${src}" alt="${marker.kind === 'origin' ? '起点' : '终点'}" />`;
}
function driverBubbleContent(marker: RideMapMarker) {
	const meta = driverMeta(marker);
	return `<div class="ride-driver-location-card" style="--ride-status:${meta.color}"><i class="ride-driver-location-card__dot${meta.pulse ? ' is-pulsing' : ''}"></i><span>${escapeHtml(marker.title || meta.label)}</span></div>`;
}
async function initH5() {
	const env: any = import.meta.env || {};
	const key = String(env.VITE_AMAP_JSAPI_KEY || '').trim();
	if (!key) { error.value = '地图未配置，请联系管理员'; return; }
	const serviceHost = String(env.VITE_AMAP_JSAPI_SERVICE_HOST || '').trim();
	const securityJsCode = env.PROD ? '' : String(env.VITE_AMAP_JSAPI_SECURITY_JSCODE || '').trim();
	(window as any)._AMapSecurityConfig = serviceHost ? { serviceHost } : (securityJsCode ? { securityJsCode } : {});
	try {
		AMap = await AMapLoader.load({ key, version: '2.0', plugins: [] }).then((loaded: any) => {
			loaded.getConfig().appname = 'amap-jsapi-skill';
			return loaded;
		});
		if (destroyed || !h5Container.value?.isConnected) return;
		map = new AMap.Map(h5Container.value, { viewMode: '3D', zoom: 14, center: [center.value.longitude, center.value.latitude] });
		map.on('click', (event: any) => {
			if (!props.selectable) return;
			const longitude = Number(event?.lnglat?.getLng?.() ?? event?.lnglat?.lng);
			const latitude = Number(event?.lnglat?.getLat?.() ?? event?.lnglat?.lat);
			if (Number.isFinite(longitude) && Number.isFinite(latitude)) emit('mapTap', { longitude, latitude });
		});
		renderH5();
	} catch { error.value = '地图加载失败，请稍后重试'; }
}
function renderH5() {
	if (!map || !AMap) return;
	if (overlays.length) map.remove(overlays);
	overlays = props.markers.filter(isValidPoint).flatMap((marker) => {
		const isDriver = String(marker.kind || '').startsWith('driver-');
		const isPoint = marker.kind === 'origin' || marker.kind === 'destination';
		const item = new AMap.Marker({
			position: [marker.longitude, marker.latitude],
			title: marker.title || '',
			content: isDriver ? `<img class="ride-vehicle-location-marker" src="${vehicleLocationIcon}" alt="车辆位置" />` : isPoint ? pointMarkerContent(marker) : undefined,
			offset: new AMap.Pixel(isDriver ? -20 : -18, isDriver ? -40 : -44),
			zIndex: 130,
		});
		item.on('click', () => emit('markerTap', marker.id));
		if (!isDriver || !marker.title) return [item];
		const bubble = new AMap.Marker({
			position: [marker.longitude, marker.latitude],
			content: driverBubbleContent(marker),
			offset: new AMap.Pixel(-70, -82),
			zIndex: 120,
		});
		bubble.on('click', () => emit('markerTap', marker.id));
		return [item, bubble];
	});
	const validRoutePoints = props.routePoints.filter(isValidPoint);
	if (validRoutePoints.length > 1) overlays.push(new AMap.Polyline({ path: validRoutePoints.map((point) => [Number(point.longitude), Number(point.latitude)]), strokeColor: '#2563eb', strokeWeight: 7, strokeOpacity: 0.85, showDir: true, lineJoin: 'round' }));
	if (overlays.length) { map.add(overlays); map.setFitView(overlays, false, [50, 50, 50, 50], 18); }
}
watch(() => [props.markers, props.routePoints], renderH5, { deep: true });
// #endif

onMounted(() => {
	// #ifdef H5
	destroyed = false;
	initH5();
	// #endif
});
onBeforeUnmount(() => {
	// #ifdef H5
	destroyed = true;
	try { if (map && overlays.length) map.remove(overlays); map?.destroy?.(); } catch {}
	overlays = []; map = null; AMap = null;
	// #endif
});
</script>

<style scoped>
.map-shell,.map{width:100%;height:100%;min-height:420rpx}.map-shell{position:relative;background:#e2e8f0}.map-error{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:32rpx;color:#64748b;background:#f8fafc}
:global(.ride-vehicle-location-marker){display:block;width:40px;height:40px;filter:drop-shadow(0 4px 7px rgba(15,23,42,.28))}
:global(.ride-point-location-marker){display:block;width:36px;height:44px;filter:drop-shadow(0 4px 7px rgba(15,23,42,.2))}
:global(.ride-driver-location-card){display:flex;align-items:center;gap:7px;max-width:160px;padding:7px 10px;border:1px solid color-mix(in srgb,var(--ride-status) 24%,#fff);border-radius:10px;background:rgba(255,255,255,.96);box-shadow:0 6px 20px rgba(15,23,42,.18);color:#0f172a;font-size:12px;font-weight:700;white-space:nowrap}
:global(.ride-driver-location-card__dot){width:9px;height:9px;flex:none;border-radius:50%;background:var(--ride-status);box-shadow:0 0 0 4px color-mix(in srgb,var(--ride-status) 16%,transparent)}
:global(.ride-driver-location-card__dot.is-pulsing){animation:ride-location-pulse 1.8s ease-out infinite}
@keyframes ride-location-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ride-status) 38%,transparent)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
</style>
