<template>
	<view class="map-shell">
		<!-- #ifdef MP-WEIXIN -->
		<map class="map" :longitude="center.longitude" :latitude="center.latitude" :markers="nativeMarkers" :polyline="nativePolyline" :show-location="showLocation" @markertap="onMarkerTap" />
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

const props = withDefaults(defineProps<{ markers?: RideMapMarker[]; routePoints?: RideMapPoint[]; showLocation?: boolean }>(), { markers: () => [], routePoints: () => [], showLocation: true });
const emit = defineEmits<{ markerTap: [id: number] }>();
const error = ref('');
const center = computed(() => props.markers[0] || props.routePoints[0] || { longitude: 104.6688, latitude: 29.5274 });
const nativeMarkers = computed(() => toNativeMarkers(props.markers));
const nativePolyline = computed(() => toNativePolyline(props.routePoints));
function onMarkerTap(event: any) { emit('markerTap', Number(event?.detail?.markerId)); }

// #ifdef H5
import AMapLoader from '@amap/amap-jsapi-loader';
const h5Container = ref<HTMLElement | null>(null);
let map: any = null;
let AMap: any = null;
let overlays: any[] = [];
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
		if (!h5Container.value) return;
		map = new AMap.Map(h5Container.value, { viewMode: '3D', zoom: 14, center: [center.value.longitude, center.value.latitude] });
		renderH5();
	} catch { error.value = '地图加载失败，请稍后重试'; }
}
function renderH5() {
	if (!map || !AMap) return;
	if (overlays.length) map.remove(overlays);
	overlays = props.markers.map((marker) => {
		const item = new AMap.Marker({ position: [marker.longitude, marker.latitude], title: marker.title || '', label: marker.title ? { content: marker.title, direction: 'top' } : undefined });
		item.on('click', () => emit('markerTap', marker.id));
		return item;
	});
	if (props.routePoints.length > 1) overlays.push(new AMap.Polyline({ path: props.routePoints.map((point) => [point.longitude, point.latitude]), strokeColor: '#2563eb', strokeWeight: 7, strokeOpacity: 0.85, showDir: true, lineJoin: 'round' }));
	if (overlays.length) { map.add(overlays); map.setFitView(overlays, false, [50, 50, 50, 50], 18); }
}
watch(() => [props.markers, props.routePoints], renderH5, { deep: true });
// #endif

onMounted(() => {
	// #ifdef H5
	initH5();
	// #endif
});
onBeforeUnmount(() => {
	// #ifdef H5
	try { if (map && overlays.length) map.remove(overlays); map?.destroy?.(); } catch {}
	overlays = []; map = null; AMap = null;
	// #endif
});
</script>

<style scoped>
.map-shell,.map{width:100%;height:100%;min-height:420rpx}.map-shell{position:relative;background:#e2e8f0}.map-error{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:32rpx;color:#64748b;background:#f8fafc}
</style>
