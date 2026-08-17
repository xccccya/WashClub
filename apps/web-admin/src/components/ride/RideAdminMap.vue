<template>
	<div class="ride-map-shell">
		<div ref="container" class="ride-map" />
		<div v-if="error" class="ride-map-error">{{ error }}</div>
		<div class="ride-map-legend">
			<span><i class="dot available" />空闲</span>
			<span><i class="dot busy" />忙碌</span>
			<span><i class="dot offline" />离线</span>
			<span v-if="plannedPoints.length"><i class="line planned" />规划路线</span>
			<span v-if="pickupPoints.length"><i class="line pickup" />接驾轨迹</span>
			<span v-if="passengerPoints.length"><i class="line passenger" />载客轨迹</span>
			<span v-if="settlementPoints.length"><i class="line settlement" />到达后结算</span>
			<span v-if="actualPoints.length && !hasSegmentedTrack"><i class="line passenger" />实际轨迹</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import AMapLoader from '@amap/amap-jsapi-loader';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import vehicleLocationIcon from '../../assets/ride-vehicle-location.svg';

type Point = { longitude: number; latitude: number };
type Driver = Point & { memberId?: number; status?: string; driverName?: string; lastLocationAt?: string; vehicle?: any; currentVehicle?: any };

const props = withDefaults(defineProps<{
	drivers?: Driver[];
	origin?: (Point & { address?: string }) | null;
	destination?: (Point & { address?: string }) | null;
	plannedPoints?: Point[];
	actualPoints?: Point[];
	pickupPoints?: Point[];
	passengerPoints?: Point[];
	settlementPoints?: Point[];
	height?: string;
	fitMode?: 'always' | 'initial' | 'never';
	highlightedDriverId?: number | null;
}>(), {
	drivers: () => [], origin: null, destination: null, plannedPoints: () => [], actualPoints: () => [],
	pickupPoints: () => [], passengerPoints: () => [], settlementPoints: () => [], height: '620px', fitMode: 'always', highlightedDriverId: null,
});

const emit = defineEmits<{ driverClick: [driver: Driver]; driverHover: [driver: Driver | null] }>();
const container = ref<HTMLElement | null>(null);
const error = ref('');
let map: any = null;
let AMap: any = null;
let overlays: any[] = [];
let driverMarkers = new Map<number, { driver: Driver; vehicleMarker: any; infoMarker: any }>();
let hoveredDriverId: number | null = null;
let hoverLeaveTimer: number | undefined;
let hasFittedView = false;
const hasSegmentedTrack = computed(() => props.pickupPoints.length > 0 || props.passengerPoints.length > 0 || props.settlementPoints.length > 0);

function securityConfig() {
	const env: any = import.meta.env || {};
	const serviceHost = String(env.VITE_AMAP_JSAPI_SERVICE_HOST || '').trim();
	const securityJsCode = env.PROD ? '' : String(env.VITE_AMAP_JSAPI_SECURITY_JSCODE || '').trim();
	(window as any)._AMapSecurityConfig = serviceHost ? { serviceHost } : (securityJsCode ? { securityJsCode } : {});
}

async function init() {
	const key = String((import.meta as any).env?.VITE_AMAP_JSAPI_KEY || '').trim();
	if (!key) { error.value = '未配置 VITE_AMAP_JSAPI_KEY，地图暂不可用'; return; }
	securityConfig();
	try {
		AMap = await AMapLoader.load({ key, version: '2.0', plugins: ['AMap.Scale'] }).then((loaded: any) => {
			loaded.getConfig().appname = 'amap-jsapi-skill';
			return loaded;
		});
		if (!container.value) return;
		map = new AMap.Map(container.value, { viewMode: '3D', zoom: 13, mapStyle: 'amap://styles/normal' });
		map.addControl(new AMap.Scale());
		render();
	} catch {
		error.value = '地图加载失败，请检查高德 Key、安全代理和域名白名单';
	}
}

function escapeHtml(value: unknown) {
	return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

function markerContent(driver: Driver, highlighted = false) {
	const status = String(driver.status || 'OFFLINE').toUpperCase();
	const color = status === 'AVAILABLE' ? '#16a34a' : status === 'BUSY' ? '#f59e0b' : '#64748b';
	const statusLabel = status === 'AVAILABLE' ? '空闲' : status === 'BUSY' ? '忙碌' : '离线';
	const name = escapeHtml(driver.driverName || `司机${driver.memberId || ''}`);
	const plate = escapeHtml(driver.vehicle?.plateNumber || driver.currentVehicle?.vehicle?.plateNumber || '未选车辆');
	const lastLocation = driver.lastLocationAt ? new Date(driver.lastLocationAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '暂无定位';
	return `<div class="ride-driver-card${highlighted ? ' is-highlighted' : ''}" style="--ride-color:${color}"><span class="ride-driver-card__status${status === 'OFFLINE' ? '' : ' is-pulsing'}"></span><strong>${name} · ${statusLabel}</strong><small>${plate} · ${escapeHtml(lastLocation)}</small></div>`;
}

function vehicleContent(highlighted = false) {
	return `<div class="ride-driver-location${highlighted ? ' is-highlighted' : ''}"><img class="ride-driver-location-icon" src="${vehicleLocationIcon}" alt="车辆位置"/></div>`;
}

function setDriverHighlight(memberId: number, highlighted: boolean) {
	const entry = driverMarkers.get(memberId);
	if (!entry) return;
	entry.vehicleMarker.setContent(vehicleContent(highlighted));
	entry.infoMarker.setContent(markerContent(entry.driver, highlighted));
	entry.vehicleMarker.setTop(highlighted);
	entry.infoMarker.setTop(highlighted);
}

function syncDriverHighlight(nextId: number | null | undefined, previousId?: number | null) {
	if (previousId != null && previousId !== nextId) setDriverHighlight(previousId, false);
	if (nextId != null) setDriverHighlight(nextId, true);
}

function onDriverMouseEnter(driver: Driver) {
	if (hoverLeaveTimer) window.clearTimeout(hoverLeaveTimer);
	hoverLeaveTimer = undefined;
	hoveredDriverId = Number(driver.memberId);
	emit('driverHover', driver);
}

function onDriverMouseLeave(driver: Driver) {
	const leavingId = Number(driver.memberId);
	if (hoverLeaveTimer) window.clearTimeout(hoverLeaveTimer);
	hoverLeaveTimer = window.setTimeout(() => {
		if (hoveredDriverId !== leavingId) return;
		hoveredDriverId = null;
		emit('driverHover', null);
	}, 50);
}

function pointContent(kind: 'origin' | 'destination') {
	const label = kind === 'origin' ? '起' : '终';
	return `<div class="ride-route-point ride-route-point--${kind}"><span>${label}</span></div>`;
}

function render() {
	if (!map || !AMap) return;
	if (overlays.length) map.remove(overlays);
	overlays = [];
	driverMarkers.clear();
	for (const driver of props.drivers) {
		if (!Number.isFinite(Number(driver.longitude)) || !Number.isFinite(Number(driver.latitude))) continue;
		const position = [Number(driver.longitude), Number(driver.latitude)];
		const highlighted = Number(driver.memberId) === props.highlightedDriverId;
		const vehicleMarker = new AMap.Marker({ position, content: vehicleContent(highlighted), offset: new AMap.Pixel(-21, -42), zIndex: 140 });
		const infoMarker = new AMap.Marker({ position, content: markerContent(driver, highlighted), offset: new AMap.Pixel(-92, -93), zIndex: 130 });
		vehicleMarker.on('click', () => emit('driverClick', driver));
		infoMarker.on('click', () => emit('driverClick', driver));
		vehicleMarker.on('mouseover', () => onDriverMouseEnter(driver));
		infoMarker.on('mouseover', () => onDriverMouseEnter(driver));
		vehicleMarker.on('mouseout', () => onDriverMouseLeave(driver));
		infoMarker.on('mouseout', () => onDriverMouseLeave(driver));
		if (driver.memberId != null) driverMarkers.set(Number(driver.memberId), { driver, vehicleMarker, infoMarker });
		if (highlighted) { vehicleMarker.setTop(true); infoMarker.setTop(true); }
		overlays.push(vehicleMarker, infoMarker);
	}
	if (props.origin) overlays.push(new AMap.Marker({ position: [props.origin.longitude, props.origin.latitude], title: props.origin.address || '起点', content: pointContent('origin'), offset: new AMap.Pixel(-19, -46), zIndex: 125 }));
	if (props.destination) overlays.push(new AMap.Marker({ position: [props.destination.longitude, props.destination.latitude], title: props.destination.address || '终点', content: pointContent('destination'), offset: new AMap.Pixel(-19, -46), zIndex: 125 }));
	if (props.plannedPoints.length > 1) overlays.push(new AMap.Polyline({ path: props.plannedPoints.map((p) => [p.longitude, p.latitude]), strokeColor: '#2563eb', strokeWeight: 7, strokeOpacity: 0.65, showDir: true, lineJoin: 'round', lineCap: 'round', zIndex: 40 }));
	if (props.pickupPoints.length > 1) overlays.push(new AMap.Polyline({ path: props.pickupPoints.map((p) => [p.longitude, p.latitude]), strokeColor: '#f59e0b', strokeWeight: 6, strokeOpacity: 0.95, isOutline: true, outlineColor: '#ffffff', borderWeight: 2, lineJoin: 'round', lineCap: 'round', zIndex: 60 }));
	if (props.passengerPoints.length > 1) overlays.push(new AMap.Polyline({ path: props.passengerPoints.map((p) => [p.longitude, p.latitude]), strokeColor: '#ef4444', strokeWeight: 6, strokeOpacity: 0.95, isOutline: true, outlineColor: '#ffffff', borderWeight: 2, lineJoin: 'round', lineCap: 'round', zIndex: 61 }));
	if (props.settlementPoints.length > 1) overlays.push(new AMap.Polyline({ path: props.settlementPoints.map((p) => [p.longitude, p.latitude]), strokeColor: '#8b5cf6', strokeWeight: 6, strokeOpacity: 0.95, isOutline: true, outlineColor: '#ffffff', borderWeight: 2, lineJoin: 'round', lineCap: 'round', zIndex: 62 }));
	if (!hasSegmentedTrack.value && props.actualPoints.length > 1) overlays.push(new AMap.Polyline({ path: props.actualPoints.map((p) => [p.longitude, p.latitude]), strokeColor: '#ef4444', strokeWeight: 6, strokeOpacity: 0.95, isOutline: true, outlineColor: '#ffffff', borderWeight: 2, lineJoin: 'round', lineCap: 'round', zIndex: 61 }));
	if (overlays.length) {
		map.add(overlays);
		if (props.fitMode === 'always' || (props.fitMode === 'initial' && !hasFittedView)) {
			map.setFitView(overlays, false, [60, 60, 60, 60], 17);
			hasFittedView = true;
		}
	}
}

watch(() => [props.drivers, props.origin, props.destination, props.plannedPoints, props.actualPoints, props.pickupPoints, props.passengerPoints, props.settlementPoints], render, { deep: true });
watch(() => props.highlightedDriverId, (nextId, previousId) => syncDriverHighlight(nextId, previousId));
onMounted(init);
onBeforeUnmount(() => {
	if (hoverLeaveTimer) window.clearTimeout(hoverLeaveTimer);
	try { if (map && overlays.length) map.remove(overlays); } catch {}
	try { map?.destroy?.(); } catch {}
	overlays = [];
	driverMarkers.clear();
	hasFittedView = false;
	map = null;
	AMap = null;
});
</script>

<style scoped>
.ride-map-shell { position: relative; width: 100%; min-height: v-bind(height); border-radius: 16px; overflow: hidden; background: #e2e8f0; }
.ride-map { width: 100%; height: v-bind(height); }
.ride-map-error { position:absolute; inset:0; display:grid; place-items:center; color:#475569; background:#f8fafc; padding:24px; }
.ride-map-legend { position:absolute; left:16px; bottom:16px; z-index:10; display:flex; gap:14px; flex-wrap:wrap; padding:10px 14px; border-radius:10px; background:rgba(255,255,255,.92); box-shadow:0 6px 24px rgba(15,23,42,.12); font-size:13px; }
.ride-map-legend span { display:flex; align-items:center; gap:6px; }
.dot { width:10px; height:10px; border-radius:50%; display:inline-block; }.dot.available{background:#16a34a}.dot.busy{background:#f59e0b}.dot.offline{background:#64748b}
.line { width:22px; border-top:4px solid; display:inline-block; }.line.planned{border-color:#2563eb}.line.pickup{border-color:#f59e0b}.line.passenger{border-color:#ef4444}.line.settlement{border-color:#8b5cf6}
:global(.ride-driver-location){width:42px;height:42px;transition:transform .16s ease,filter .16s ease;transform-origin:50% 100%}
:global(.ride-driver-location.is-highlighted){transform:scale(1.22);filter:drop-shadow(0 0 7px rgba(37,99,235,.9))}
:global(.ride-driver-location-icon){display:block;width:42px;height:42px;filter:drop-shadow(0 4px 7px rgba(15,23,42,.28))}
:global(.ride-driver-card){min-width:184px;display:grid;grid-template-columns:12px 1fr;column-gap:8px;align-items:center;padding:8px 10px;border-radius:11px;background:rgba(255,255,255,.97);box-shadow:0 6px 20px rgba(15,23,42,.2);border:1px solid color-mix(in srgb,var(--ride-color) 30%,#fff)}
:global(.ride-driver-card.is-highlighted){border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.22),0 10px 28px rgba(15,23,42,.28);transform:translateY(-2px)}
:global(.ride-driver-card__status){grid-row:1/3;width:10px;height:10px;border-radius:50%;background:var(--ride-color);box-shadow:0 0 0 4px color-mix(in srgb,var(--ride-color) 15%,transparent)}
:global(.ride-driver-card__status.is-pulsing){animation:ride-admin-pulse 1.8s ease-out infinite}
:global(.ride-driver-card strong){font-size:12px;color:#0f172a;white-space:nowrap}:global(.ride-driver-card small){font-size:10px;color:#64748b;white-space:nowrap}
:global(.ride-route-point){position:relative;display:grid;width:38px;height:38px;place-items:center;border:3px solid #fff;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);box-shadow:0 5px 12px rgba(15,23,42,.24);color:#fff;font-weight:800}
:global(.ride-route-point span){transform:rotate(45deg)}
:global(.ride-route-point--origin){background:#16a34a}:global(.ride-route-point--destination){background:#ef4444}
@keyframes ride-admin-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ride-color) 40%,transparent)}70%{box-shadow:0 0 0 9px transparent}100%{box-shadow:0 0 0 0 transparent}}
</style>
