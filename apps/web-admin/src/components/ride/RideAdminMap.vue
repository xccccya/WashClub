<template>
	<div class="ride-map-shell">
		<div ref="container" class="ride-map" />
		<div v-if="error" class="ride-map-error">{{ error }}</div>
		<div class="ride-map-legend">
			<span><i class="dot available" />空闲</span>
			<span><i class="dot busy" />忙碌</span>
			<span><i class="dot offline" />离线</span>
			<span v-if="plannedPoints.length"><i class="line planned" />规划路线</span>
			<span v-if="actualPoints.length"><i class="line actual" />实际轨迹</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import AMapLoader from '@amap/amap-jsapi-loader';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

type Point = { longitude: number; latitude: number };
type Driver = Point & { memberId?: number; status?: string; driverName?: string; lastLocationAt?: string; vehicle?: any; currentVehicle?: any };

const props = withDefaults(defineProps<{
	drivers?: Driver[];
	origin?: (Point & { address?: string }) | null;
	destination?: (Point & { address?: string }) | null;
	plannedPoints?: Point[];
	actualPoints?: Point[];
	height?: string;
}>(), { drivers: () => [], origin: null, destination: null, plannedPoints: () => [], actualPoints: () => [], height: '620px' });

const emit = defineEmits<{ driverClick: [driver: Driver] }>();
const container = ref<HTMLElement | null>(null);
const error = ref('');
let map: any = null;
let AMap: any = null;
let overlays: any[] = [];

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

function markerContent(driver: Driver) {
	const status = String(driver.status || 'OFFLINE').toUpperCase();
	const color = status === 'AVAILABLE' ? '#16a34a' : status === 'BUSY' ? '#f59e0b' : '#64748b';
	const statusLabel = status === 'AVAILABLE' ? '空闲' : status === 'BUSY' ? '忙碌' : '离线';
	const name = escapeHtml(driver.driverName || `司机${driver.memberId || ''}`);
	const plate = escapeHtml(driver.vehicle?.plateNumber || driver.currentVehicle?.vehicle?.plateNumber || '未选车辆');
	const lastLocation = driver.lastLocationAt ? new Date(driver.lastLocationAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '暂无定位';
	return `<div class="ride-driver-marker" style="--ride-color:${color}"><span class="ride-driver-marker__dot"></span><strong>${name} · ${statusLabel}</strong><small>${plate} · ${escapeHtml(lastLocation)}</small></div>`;
}

function render() {
	if (!map || !AMap) return;
	if (overlays.length) map.remove(overlays);
	overlays = [];
	for (const driver of props.drivers) {
		if (!Number.isFinite(Number(driver.longitude)) || !Number.isFinite(Number(driver.latitude))) continue;
		const marker = new AMap.Marker({ position: [Number(driver.longitude), Number(driver.latitude)], content: markerContent(driver), offset: new AMap.Pixel(-74, -48), zIndex: 120 });
		marker.on('click', () => emit('driverClick', driver));
		overlays.push(marker);
	}
	if (props.origin) overlays.push(new AMap.Marker({ position: [props.origin.longitude, props.origin.latitude], title: props.origin.address || '起点', label: { content: '起点', direction: 'top' } }));
	if (props.destination) overlays.push(new AMap.Marker({ position: [props.destination.longitude, props.destination.latitude], title: props.destination.address || '终点', label: { content: '终点', direction: 'top' } }));
	if (props.plannedPoints.length > 1) overlays.push(new AMap.Polyline({ path: props.plannedPoints.map((p) => [p.longitude, p.latitude]), strokeColor: '#2563eb', strokeWeight: 7, strokeOpacity: 0.8, showDir: true, lineJoin: 'round' }));
	if (props.actualPoints.length > 1) overlays.push(new AMap.Polyline({ path: props.actualPoints.map((p) => [p.longitude, p.latitude]), strokeColor: '#ef4444', strokeWeight: 5, strokeOpacity: 0.9, strokeStyle: 'dashed', lineJoin: 'round' }));
	if (overlays.length) {
		map.add(overlays);
		map.setFitView(overlays, false, [60, 60, 60, 60], 17);
	}
}

watch(() => [props.drivers, props.origin, props.destination, props.plannedPoints, props.actualPoints], render, { deep: true });
onMounted(init);
onBeforeUnmount(() => {
	try { if (map && overlays.length) map.remove(overlays); } catch {}
	try { map?.destroy?.(); } catch {}
	overlays = [];
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
.line { width:22px; border-top:4px solid; display:inline-block; }.line.planned{border-color:#2563eb}.line.actual{border-color:#ef4444;border-top-style:dashed}
:global(.ride-driver-marker){min-width:148px;display:grid;grid-template-columns:12px 1fr;column-gap:6px;align-items:center;padding:7px 9px;border-radius:10px;background:#fff;box-shadow:0 5px 18px rgba(15,23,42,.2);border:1px solid color-mix(in srgb,var(--ride-color) 35%,#fff)}
:global(.ride-driver-marker__dot){grid-row:1/3;width:10px;height:10px;border-radius:50%;background:var(--ride-color);box-shadow:0 0 0 4px color-mix(in srgb,var(--ride-color) 16%,transparent)}
:global(.ride-driver-marker strong){font-size:12px;color:#0f172a;white-space:nowrap}:global(.ride-driver-marker small){font-size:10px;color:#64748b;white-space:nowrap}
</style>
