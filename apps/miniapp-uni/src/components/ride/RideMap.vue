<template>
	<view class="map-shell">
		<!-- #ifdef MP-WEIXIN -->
		<map id="ride-map" class="map" :longitude="viewportCenter.longitude" :latitude="viewportCenter.latitude" :scale="nativeScale" :include-points="nativeIncludePoints" :padding="nativeFitPadding" :markers="nativeMarkers" :polyline="nativePolyline" :show-location="showLocation" @markertap="onMarkerTap" @tap="onMapTap" @regionchange="onRegionChange" />
		<!-- #endif -->
		<!-- #ifdef H5 -->
		<div ref="h5Container" class="map" />
		<!-- #endif -->
		<RideLocateControl v-if="showLocateControl" class="locate-control" :style="locateControlStyle" :action="locateCurrent" />
		<view v-if="error" class="map-error">{{ error }}</view>
	</view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RideLocateControl from './RideLocateControl.vue';
import type { RideMapMarker, RideMapPoint } from '../../services/ride-map';
import { spreadOverlappingMarkers, toNativeMarkers, toNativePolyline } from '../../services/ride-map';
import { getCurrentRideLocation, locationErrorMessage } from '../../services/geolocation';
import vehicleLocationIcon from '../../static/icons/ride-vehicle-location.svg';
import originMarkerIcon from '../../static/icons/ride-origin-marker.svg';
import destinationMarkerIcon from '../../static/icons/ride-destination-marker.svg';

const props = withDefaults(defineProps<{
	markers?: RideMapMarker[];
	routePoints?: RideMapPoint[];
	showLocation?: boolean;
	selectable?: boolean;
	showLocateControl?: boolean;
	autoFit?: boolean;
	autoFitPauseMs?: number;
	fitPadding?: number[];
	locateTop?: string;
}>(), {
	markers: () => [],
	routePoints: () => [],
	showLocation: true,
	selectable: false,
	showLocateControl: true,
	autoFit: true,
	autoFitPauseMs: 15000,
	fitPadding: () => [96, 36, 240, 36],
	locateTop: '220rpx',
});
const emit = defineEmits<{ markerTap: [id: number]; mapTap: [point: RideMapPoint] }>();
const componentInstance = getCurrentInstance();
const error = ref('');
const locating = ref(false);
const fallbackCenter = { longitude: 104.6688, latitude: 29.5274 };
const viewportCenter = ref({ ...fallbackCenter });
const nativeScale = ref(14);
const nativeIncludePoints = ref<RideMapPoint[]>([]);
const nativeFitPadding = computed(() => props.fitPadding.map((value) => Math.max(0, Math.round(uni.upx2px(Number(value))))));
const locateTop = computed(() => props.locateTop);
const locateControlStyle = computed(() => ({ top: locateTop.value, bottom: 'auto' }));
let nativeMapContext: any = null;
let lastUserInteractionAt = 0;
let lastFitSignature = '';
function isValidPoint(point: Partial<RideMapPoint> | null | undefined): point is RideMapPoint {
	return Number.isFinite(Number(point?.longitude)) && Number.isFinite(Number(point?.latitude));
}
const initialCenter = computed(() => {
	const point = props.markers.find(isValidPoint) || props.routePoints.find(isValidPoint) || fallbackCenter;
	return { longitude: Number(point.longitude), latitude: Number(point.latitude) };
});
const displayMarkers = computed(() => spreadOverlappingMarkers(props.markers.filter(isValidPoint)));
const nativeMarkers = computed(() => toNativeMarkers(displayMarkers.value));
const nativePolyline = computed(() => toNativePolyline(props.routePoints));
function onMarkerTap(event: any) { emit('markerTap', Number(event?.detail?.markerId)); }
function onMapTap(event: any) {
	if (!props.selectable) return;
	const longitude = Number(event?.detail?.longitude);
	const latitude = Number(event?.detail?.latitude);
	if (Number.isFinite(longitude) && Number.isFinite(latitude)) emit('mapTap', { longitude, latitude });
}
function markUserInteraction() {
	lastUserInteractionAt = Date.now();
}
function onRegionChange(event: any) {
	const causedBy = String(event?.detail?.causedBy || '').toLowerCase();
	if (event?.type === 'begin' && ['gesture', 'scale'].includes(causedBy)) markUserInteraction();
}
function fitPoints() {
	const route = props.routePoints.filter(isValidPoint);
	if (route.length > 1) return route.map((point) => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) }));
	const fixedMarkers = displayMarkers.value.filter((point) => point.kind === 'origin' || point.kind === 'destination');
	if (fixedMarkers.length) return fixedMarkers.map((point) => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) }));
	return displayMarkers.value.filter((point) => !String(point.kind || '').startsWith('driver-')).map((point) => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) }));
}
function pointsSignature(points: RideMapPoint[]) {
	return points.map((point) => `${Number(point.longitude).toFixed(5)},${Number(point.latitude).toFixed(5)}`).join('|');
}
function canAutoFit(force: boolean) {
	return force || Date.now() - lastUserInteractionAt >= props.autoFitPauseMs;
}
function fitViewport(force = false) {
	if (!props.autoFit && !force) return;
	const points = fitPoints();
	if (!points.length || !canAutoFit(force)) return;
	const signature = pointsSignature(points);
	if (!force && signature === lastFitSignature) return;
	lastFitSignature = signature;
	if (points.length === 1) {
		focusPoint(points[0], 15);
		return;
	}
	viewportCenter.value = {
		longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
		latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
	};
	nativeIncludePoints.value = points.map((point) => ({ ...point }));
	// #ifdef H5
	if (map && h5FitOverlays.length) map.setFitView(h5FitOverlays, false, fitPaddingPixels(), 18);
	// #endif
}
function fitPaddingPixels() {
	return props.fitPadding.map((value) => Math.max(0, Math.round(uni.upx2px(Number(value)))));
}
function focusPoint(point: RideMapPoint, zoom = 16) {
	viewportCenter.value = { longitude: Number(point.longitude), latitude: Number(point.latitude) };
	nativeScale.value = zoom;
	nativeIncludePoints.value = [];
	try { nativeMapContext?.moveToLocation?.({ longitude: Number(point.longitude), latitude: Number(point.latitude) }); } catch {}
	// #ifdef H5
	map?.setZoomAndCenter?.(zoom, [Number(point.longitude), Number(point.latitude)], false);
	// #endif
}
async function locateCurrent() {
	if (locating.value) return;
	locating.value = true;
	try {
		const point = await getCurrentRideLocation();
		focusPoint(point, 16);
	} catch (locationError) {
		uni.showToast({ title: locationErrorMessage(locationError).slice(0, 30), icon: 'none' });
	} finally { locating.value = false; }
}
defineExpose({ locateCurrent });

// #ifdef H5
import AMapLoader from '@amap/amap-jsapi-loader';
const h5Container = ref<HTMLElement | null>(null);
let map: any = null;
let AMap: any = null;
let overlays: any[] = [];
let h5FitOverlays: any[] = [];
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
		map = new AMap.Map(h5Container.value, { viewMode: '3D', zoom: 14, center: [viewportCenter.value.longitude, viewportCenter.value.latitude] });
		map.on('dragstart', markUserInteraction);
		map.on('zoomstart', (event: any) => { if (event?.originEvent) markUserInteraction(); });
		map.on('click', (event: any) => {
			if (!props.selectable) return;
			const longitude = Number(event?.lnglat?.getLng?.() ?? event?.lnglat?.lng);
			const latitude = Number(event?.lnglat?.getLat?.() ?? event?.lnglat?.lat);
			if (Number.isFinite(longitude) && Number.isFinite(latitude)) emit('mapTap', { longitude, latitude });
		});
		renderH5();
		fitViewport(true);
	} catch { error.value = '地图加载失败，请稍后重试'; }
}
function renderH5() {
	if (!map || !AMap) return;
	if (overlays.length) map.remove(overlays);
	h5FitOverlays = [];
	overlays = displayMarkers.value.flatMap((marker) => {
		const isDriver = String(marker.kind || '').startsWith('driver-');
		const isPoint = marker.kind === 'origin' || marker.kind === 'destination';
		const item = new AMap.Marker({
			position: [marker.longitude, marker.latitude],
			title: marker.title || '',
			content: isDriver ? `<img class="ride-vehicle-location-marker" src="${vehicleLocationIcon}" alt="车辆位置" />` : isPoint ? pointMarkerContent(marker) : undefined,
			offset: new AMap.Pixel(isDriver ? -15 : -14, isDriver ? -30 : -34),
			zIndex: 130,
		});
		if (isPoint) h5FitOverlays.push(item);
		item.on('click', () => emit('markerTap', marker.id));
		if (!isDriver || !marker.title) return [item];
		const bubble = new AMap.Marker({
			position: [marker.longitude, marker.latitude],
			content: driverBubbleContent(marker),
			offset: new AMap.Pixel(-70, -72),
			zIndex: 120,
		});
		bubble.on('click', () => emit('markerTap', marker.id));
		return [item, bubble];
	});
	const validRoutePoints = props.routePoints.filter(isValidPoint);
	if (validRoutePoints.length > 1) overlays.push(new AMap.Polyline({ path: validRoutePoints.map((point) => [Number(point.longitude), Number(point.latitude)]), strokeColor: '#2563eb', strokeWeight: 7, strokeOpacity: 0.85, showDir: true, lineJoin: 'round' }));
	if (overlays.length) map.add(overlays);
}
// #endif
watch(() => [props.markers, props.routePoints, props.fitPadding], () => {
	// #ifdef H5
	renderH5();
	// #endif
	fitViewport();
}, { deep: true });

onMounted(() => {
	viewportCenter.value = initialCenter.value;
	try { nativeMapContext = uni.createMapContext('ride-map', componentInstance?.proxy as any); } catch {}
	// #ifdef H5
	destroyed = false;
	initH5();
	// #endif
	// #ifndef H5
	setTimeout(() => fitViewport(true), 80);
	// #endif
});
onBeforeUnmount(() => {
	// #ifdef H5
	destroyed = true;
	try { if (map && overlays.length) map.remove(overlays); map?.destroy?.(); } catch {}
	overlays = []; h5FitOverlays = []; map = null; AMap = null;
	// #endif
	nativeMapContext = null;
});
</script>

<style scoped>
.map-shell,.map{width:100%;height:100%;min-height:420rpx}.map-shell{position:relative;background:#e2e8f0}.map-error{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:32rpx;color:#64748b;background:#f8fafc}
.locate-control{position:absolute;z-index:8;right:24rpx}
:global(.ride-vehicle-location-marker){display:block;width:30px;height:30px;filter:drop-shadow(0 3px 5px rgba(15,23,42,.24))}
:global(.ride-point-location-marker){display:block;width:28px;height:34px;filter:drop-shadow(0 3px 5px rgba(15,23,42,.18))}
:global(.ride-driver-location-card){display:flex;align-items:center;gap:7px;max-width:160px;padding:7px 10px;border:1px solid color-mix(in srgb,var(--ride-status) 24%,#fff);border-radius:10px;background:rgba(255,255,255,.96);box-shadow:0 6px 20px rgba(15,23,42,.18);color:#0f172a;font-size:12px;font-weight:700;white-space:nowrap}
:global(.ride-driver-location-card__dot){width:9px;height:9px;flex:none;border-radius:50%;background:var(--ride-status);box-shadow:0 0 0 4px color-mix(in srgb,var(--ride-status) 16%,transparent)}
:global(.ride-driver-location-card__dot.is-pulsing){animation:ride-location-pulse 1.8s ease-out infinite}
@keyframes ride-location-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ride-status) 38%,transparent)}70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
</style>
