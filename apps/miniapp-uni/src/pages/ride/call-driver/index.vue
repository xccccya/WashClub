<template>
	<view class="page">
		<RideMap ref="rideMap" :markers="markers" :route-points="routePoints" :fit-padding-px="mapFitPaddingPx" :show-locate-control="false" :selectable="!!selecting" @marker-tap="onMarkerTap" @map-tap="pickFromMap" />
		<RideStatusBar class="top-fit-card" title="呼叫司机" :subtitle="availabilityText">
			<view class="orders-link" @tap="goOrders">行程订单</view>
		</RideStatusBar>
		<view class="drawer-shell">
			<RideLocateControl class="drawer-locate" :action="locateOnMap" />
			<view class="drawer">
			<view class="drawer-grabber" />
			<view class="drawer-head"><view><strong>规划本次行程</strong><text>选择地点后预览路线与费用</text></view><view class="drawer-head-actions"><text class="availability-pill">{{ availabilityText }}</text><text class="collapse-toggle" @tap="toggleDrawer">{{ drawerCollapsed ? '展开' : '收起' }}</text></view></view>
			<transition name="ride-collapse">
			<view v-if="!drawerCollapsed" class="collapse-content">
			<view v-if="selecting" class="map-pick-tip"><text>请在地图上点击{{ selecting === 'origin' ? '起点' : '终点' }}</text><text @tap="selecting = null">取消</text></view>
			<view v-if="locationNotice" class="location-notice"><text>{{ locationNotice }}</text><text class="retry" @tap="locate">重新定位</text></view>
			<view class="route-fields">
				<view class="field"><text class="badge start">起</text><input v-model="origin.address" placeholder="请输入或使用当前起点" @focus="showRecent('origin')" @input="searchOrigin" /><text class="map-pick" @tap="selecting = 'origin'">地图选点</text></view>
				<view class="field-connector" />
				<view class="field"><text class="badge end">终</text><input v-model="destination.address" placeholder="请输入目的地" @focus="showRecent('destination')" @input="searchDestination" /><text class="map-pick" @tap="selecting = 'destination'">地图选点</text></view>
			</view>

			<view v-if="originTips.length" class="tips"><view v-for="tip in originTips" :key="placeKey(tip)" @tap="pickOrigin(tip)"><view><strong>{{ tip.name }}</strong><text>{{ tip.address }}</text></view><text v-if="tip.distanceMeters != null" class="distance">{{ formatDistance(tip.distanceMeters) }}</text></view></view>
			<view v-if="destinationTips.length" class="tips"><view v-for="tip in destinationTips" :key="placeKey(tip)" @tap="pickDestination(tip)"><view><strong>{{ tip.name }}</strong><text>{{ tip.address }}</text></view><text v-if="tip.distanceMeters != null" class="distance">{{ formatDistance(tip.distanceMeters) }}</text></view></view>
			<view v-if="showRecentPanel" class="recent-panel">
				<view class="section-title"><view><strong>最近使用</strong><text>轻触即可设为目的地</text></view><text @tap="clearRecent">清空</text></view>
				<scroll-view scroll-x class="recent-scroll" :show-scrollbar="false"><view class="recent-list"><view v-for="place in recentPlaces" :key="placeKey(place)" class="recent-place" @tap="pickDestination(place)"><text class="recent-icon">↻</text><view><strong>{{ place.name || place.address }}</strong><text>{{ place.address }}</text></view></view></view></scroll-view>
			</view>
			<view v-if="preview" class="routes">
				<view class="section-title"><view><strong>选择路线</strong><text>地图将展示当前选中的路线</text></view><text>{{ preview.routes.length }} 条</text></view>
				<view v-for="(candidate, index) in preview.routes" :key="index" class="route" :class="{ selected: selectedRouteIndex === index }" @tap="selectedRouteIndex = index">
					<view class="route-radio"><i /></view>
					<view class="route-copy"><view class="route-title"><strong>{{ routeTitle(candidate, index) }}</strong><text v-if="candidate.route.preference === 'AVOID_HIGHWAY'" class="route-tag safe">不走高速</text><text v-else-if="index === 0" class="route-tag">推荐</text></view><view class="route-meta"><text>{{ formatDistance(candidate.route.distanceMeters) }}</text><text>{{ Math.ceil(candidate.route.durationSeconds / 60) }}分钟</text><text v-if="candidate.route.tollAmount" class="toll">过路费 ¥{{ money(candidate.route.tollAmount) }}</text><text v-else>无过路费</text></view><text v-if="candidate.route.tollRoads?.length" class="toll-roads">收费路段：{{ candidate.route.tollRoads.join('、') }}</text></view>
					<view class="route-price"><strong>¥{{ money(candidate.fare.amount) }}</strong><text>预估</text></view>
				</view>
				<view v-if="preview.customPrepayEnabled" class="prepay-notice">
					<view><text>本次线上预付</text><strong>¥{{ money(selectedPrepayAmount) }}</strong></view>
					<text>行程仍按最终车费结算；剩余差额可由司机确认线下付清。</text>
				</view>
			</view>
			<view v-if="availability && !availability.availableCount" class="warning">3km 内暂无空闲司机，可点地图上的忙碌车辆联系司机。</view>
			<button class="primary" :disabled="loading || !canCall" @tap="callDriver">{{ callButtonText }}</button>
			</view>
			</transition>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { onHide, onShow, onUnload } from '@dcloudio/uni-app';
import RideMap from '../../../components/ride/RideMap.vue';
import RideLocateControl from '../../../components/ride/RideLocateControl.vue';
import RideStatusBar from '../../../components/ride/RideStatusBar.vue';
import { rideApi } from '../../../services/ride';
import { getCurrentRideLocation, locationErrorMessage } from '../../../services/geolocation';
import { useRideMapFitPadding } from '../../../utils/ride-map-fit';

const loading = ref(false);
const rideMap = ref<InstanceType<typeof RideMap> | null>(null);
const availability = ref<any>(null);
const preview = ref<any>(null);
const selectedRouteIndex = ref(0);
const originTips = ref<any[]>([]);
const destinationTips = ref<any[]>([]);
const locationNotice = ref('');
const selecting = ref<'origin' | 'destination' | null>(null);
const currentLocation = ref<{ longitude: number; latitude: number } | null>(null);
const recentPlaces = ref<any[]>([]);
const drawerCollapsed = ref(false);
const origin = ref<any>({ longitude: 104.6688, latitude: 29.5274, address: '请定位或手动选择起点' });
const destination = ref<any>({ longitude: 0, latitude: 0, address: '' });
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let availabilityTimer: ReturnType<typeof setInterval> | undefined;
let checkingAvailability = false;
const RECENT_PLACES_KEY = 'rideRecentPlacesV1';

const availabilityText = computed(() => availability.value ? `${availability.value.availableCount} 位空闲司机` : '正在检查附近司机');
const canCall = computed(() => !!availability.value?.availableCount && !!destination.value.longitude);
const selectedRoute = computed(() => preview.value?.routes?.[selectedRouteIndex.value] || preview.value);
const selectedPrepayAmount = computed(() => Number(selectedRoute.value?.prepayAmount ?? selectedRoute.value?.fare?.amount ?? 0));
const callButtonText = computed(() => {
	if (!preview.value) return '预览路线与价格';
	return preview.value.customPrepayEnabled
		? '预付 ¥' + money(selectedPrepayAmount.value) + ' 并呼叫司机'
		: '支付 ¥' + money(selectedPrepayAmount.value) + ' 并呼叫司机';
});
const routePoints = computed(() => selectedRoute.value?.route?.points || []);
const showRecentPanel = computed(() => recentPlaces.value.length > 0 && !preview.value && !originTips.value.length && !destinationTips.value.length);
const { paddingPx: mapFitPaddingPx, refresh: refreshMapFit } = useRideMapFitPadding({
	topSelector: '.top-fit-card',
	bottomSelector: '.drawer',
	topFallbackRpx: 150,
	bottomFallbackRpx: 560,
	sideRpx: 28,
});
const markers = computed(() => {
	const list: any[] = [{ id: 1, ...origin.value, title: '起点', kind: 'origin' }];
	if (destination.value.longitude) list.push({ id: 2, ...destination.value, title: '终点', kind: 'destination' });
	for (const driver of availability.value?.availableDrivers || []) list.push({ id: 5000 + driver.memberId, longitude: driver.longitude, latitude: driver.latitude, title: `空闲 · ${driver.driverName}`, kind: 'driver-available' });
	for (const driver of availability.value?.busyDrivers || []) list.push({ id: 10000 + driver.memberId, longitude: driver.longitude, latitude: driver.latitude, title: `忙碌 · ${driver.driverName}`, kind: 'driver-busy' });
	return list;
});

async function locate() {
	try {
		locationNotice.value = '';
		const point = await getCurrentRideLocation();
		currentLocation.value = { longitude: point.longitude, latitude: point.latitude };
		const place = await rideApi.reverseGeocode(point.longitude, point.latitude);
		origin.value = {
			longitude: point.longitude,
			latitude: point.latitude,
			address: selectedAddress(place),
			poiId: place.poiId || place.id,
		};
		await check();
	} catch (error) {
		availability.value = null;
		locationNotice.value = locationErrorMessage(error);
		uni.showToast({ title: locationNotice.value.slice(0, 30), icon: 'none' });
	}
}
function locateOnMap() { return rideMap.value?.locateCurrent(); }
function toggleDrawer() { drawerCollapsed.value = !drawerCollapsed.value; refreshMapFit(); }
async function check(silent = false) {
	if (checkingAvailability || !Number(origin.value.longitude) || !Number(origin.value.latitude)) return;
	checkingAvailability = true;
	try { availability.value = await rideApi.availability(origin.value.longitude, origin.value.latitude); }
	catch (error: any) { if (!silent) uni.showToast({ title: error?.message || '司机状态刷新失败', icon: 'none' }); }
	finally { checkingAvailability = false; }
}
function stopAvailabilityRefresh() { if (availabilityTimer) clearInterval(availabilityTimer); availabilityTimer = undefined; }
function startAvailabilityRefresh() {
	stopAvailabilityRefresh();
	void check(true);
	availabilityTimer = setInterval(() => void check(true), 5000);
}
function searchOrigin(event: any) { search('origin', event.detail.value); }
function searchDestination(event: any) { search('destination', event.detail.value); }
function search(kind: 'origin' | 'destination', value: string) {
	if (searchTimer) clearTimeout(searchTimer);
	preview.value = null;
	selectedRouteIndex.value = 0;
	searchTimer = setTimeout(async () => {
		const data = value.trim() ? await rideApi.places(value.trim(), undefined, currentLocation.value || { longitude: origin.value.longitude, latitude: origin.value.latitude }) : recentPlaces.value;
		(kind === 'origin' ? originTips : destinationTips).value = data;
	}, 300);
}
function showRecent(kind: 'origin' | 'destination') {
	const value = kind === 'origin' ? origin.value.address : destination.value.address;
	if (!String(value || '').trim()) (kind === 'origin' ? originTips : destinationTips).value = recentPlaces.value;
}
function placeKey(place: any) { return String(place.poiId || place.id || `${Number(place.longitude).toFixed(6)},${Number(place.latitude).toFixed(6)}`); }
function saveRecent(place: any) {
	const normalized = { ...place, id: place.poiId || place.id || '', poiId: place.poiId || place.id || '', distanceMeters: undefined };
	const key = placeKey(normalized);
	recentPlaces.value = [normalized, ...recentPlaces.value.filter((item) => placeKey(item) !== key)].slice(0, 10);
	uni.setStorageSync(RECENT_PLACES_KEY, recentPlaces.value);
}
function clearRecent() {
	recentPlaces.value = [];
	uni.removeStorageSync(RECENT_PLACES_KEY);
}
function selectedAddress(place: any) {
	const name = String(place?.name || '').trim();
	const address = String(place?.address || '').trim();
	if (!name) return address;
	if (!address || address === name || address.includes(name)) return address || name;
	return `${name} ${address}`;
}
function pickOrigin(tip: any) {
	origin.value = { longitude: tip.longitude, latitude: tip.latitude, address: selectedAddress(tip), poiId: tip.poiId || tip.id };
	saveRecent({ ...tip, address: tip.address || '', poiId: tip.poiId || tip.id });
	originTips.value = []; preview.value = null; selectedRouteIndex.value = 0; check();
}
function pickDestination(tip: any) {
	destination.value = { longitude: tip.longitude, latitude: tip.latitude, address: selectedAddress(tip), poiId: tip.poiId || tip.id };
	saveRecent({ ...tip, address: tip.address || '', poiId: tip.poiId || tip.id });
	destinationTips.value = []; preview.value = null; selectedRouteIndex.value = 0;
}
async function pickFromMap(point: { longitude: number; latitude: number }) {
	if (!selecting.value) return;
	try {
		uni.showLoading({ title: '正在获取地址' });
		const place = await rideApi.reverseGeocode(point.longitude, point.latitude);
		if (selecting.value === 'origin') pickOrigin(place); else pickDestination(place);
		selecting.value = null;
	} catch (error: any) { uni.showToast({ title: error?.message || '地址解析失败', icon: 'none' }); }
	finally { uni.hideLoading(); }
}
function formatDistance(value: number) { return value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`; }
function money(value: unknown) { return Number(value || 0).toFixed(2); }
function routeTitle(candidate: any, index: number) {
	if (candidate?.route?.preference === 'AVOID_HIGHWAY') return '不走高速路线';
	return index === 0 ? '推荐路线' : `备选路线 ${index + 1}`;
}
async function callDriver() {
	if (!canCall.value) return;
	loading.value = true;
	try {
		if (!preview.value) { preview.value = await rideApi.preview({ origin: origin.value, destination: destination.value }); selectedRouteIndex.value = 0; return; }
		const created = await rideApi.create({ origin: origin.value, destination: destination.value, routeIndex: selectedRouteIndex.value });
		await rideApi.payOrder(Number(created.order.id));
		uni.redirectTo({ url: `/pages/ride/detail/index?id=${created.trip.id}` });
	} catch (error: any) {
		uni.showToast({ title: error?.message || '操作未完成', icon: 'none' });
	} finally { loading.value = false; }
}
async function onMarkerTap(id: number) {
	if (id < 10000) return;
	try {
		const contact = await rideApi.busyDriverContact(id - 10000);
		uni.showModal({ title: contact.name || '内部司机', content: `联系电话：${contact.phone}`, confirmText: '拨打电话', success: (result) => { if (result.confirm) uni.makePhoneCall({ phoneNumber: contact.phone }); } });
	} catch { uni.showToast({ title: '司机当前不可联系', icon: 'none' }); }
}
function goOrders() { uni.navigateTo({ url: '/pages/ride/orders/index' }); }
watch(() => [drawerCollapsed.value, !!preview.value, selecting.value, !!locationNotice.value, originTips.value.length, destinationTips.value.length, recentPlaces.value.length], refreshMapFit, { flush: 'post' });
onMounted(() => {
	const stored = uni.getStorageSync(RECENT_PLACES_KEY);
	recentPlaces.value = Array.isArray(stored) ? stored.slice(0, 10) : [];
	locate();
});
onShow(startAvailabilityRefresh);
onHide(stopAvailabilityRefresh);
onUnload(() => { stopAvailabilityRefresh(); if (searchTimer) clearTimeout(searchTimer); });
</script>

<style scoped>
.page{height:100vh;position:relative;overflow:hidden;background:#e2e8f0}.drawer{position:absolute;z-index:20;right:20rpx;bottom:calc(24rpx + env(safe-area-inset-bottom));left:20rpx;max-height:72vh;overflow-y:auto;padding:18rpx 24rpx 24rpx;border:1rpx solid rgba(255,255,255,.88);border-radius:34rpx;background:rgba(255,255,255,.97);box-shadow:0 20rpx 60rpx rgba(15,23,42,.2);box-sizing:border-box;backdrop-filter:blur(14px)}
.drawer-grabber{width:72rpx;height:7rpx;margin:0 auto 16rpx;border-radius:999rpx;background:#dbe3ee}.drawer-head,.section-title{display:flex;align-items:center;justify-content:space-between;gap:18rpx}.drawer-head{margin-bottom:16rpx}.drawer-head view,.section-title view{min-width:0}.drawer-head strong,.drawer-head text,.section-title strong,.section-title text{display:block}.drawer-head strong{color:#0f172a;font-size:31rpx}.drawer-head view text{margin-top:3rpx;color:#94a3b8;font-size:20rpx}.drawer-head-actions{display:flex;flex:none;align-items:center;gap:10rpx}.availability-pill{padding:8rpx 13rpx;border-radius:999rpx;background:#ecfdf5;color:#047857;font-size:19rpx;font-weight:750}.collapse-toggle{padding:7rpx 4rpx;color:#2563eb;font-size:20rpx;font-weight:700}.section-title{margin-bottom:12rpx}.section-title strong{color:#1e293b;font-size:24rpx}.section-title view text{margin-top:2rpx;color:#94a3b8;font-size:18rpx}.section-title>text{flex:none;color:#2563eb;font-size:20rpx}
.location-notice{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx;margin-bottom:12rpx;padding:14rpx 16rpx;border-radius:16rpx;background:#fff7ed;color:#9a3412;font-size:22rpx;line-height:1.5}.location-notice>text:first-child{flex:1}.retry{flex:none;color:#2563eb;font-weight:700}
.route-fields{position:relative;padding:4rpx 16rpx;border:1rpx solid #e2e8f0;border-radius:24rpx;background:#f8fafc}.field{display:flex;align-items:center;gap:14rpx;min-height:76rpx}.field input{min-width:0;flex:1;color:#0f172a;font-size:23rpx}.field:last-child{border-top:1rpx solid #e2e8f0}.field-connector{position:absolute;top:65rpx;left:36rpx;width:2rpx;height:28rpx;background:#cbd5e1}.badge{display:grid;width:42rpx;height:42rpx;flex:none;place-items:center;border:4rpx solid #fff;border-radius:50%;box-shadow:0 4rpx 12rpx rgba(15,23,42,.12);color:#fff;font-size:19rpx;font-weight:800;box-sizing:border-box}.start{background:#16a34a}.end{background:#f43f5e}
.map-pick-tip{display:flex;justify-content:space-between;margin-bottom:12rpx;padding:14rpx 18rpx;border-radius:18rpx;background:#eff6ff;color:#1d4ed8;font-size:23rpx;font-weight:700}.map-pick{flex:none;padding:8rpx 0 8rpx 14rpx;color:#2563eb;font-size:20rpx;font-weight:700}.tips{max-height:250rpx;overflow:auto;margin-top:10rpx;border:1rpx solid #e2e8f0;border-radius:18rpx;background:#fff}.tips>view{display:flex;align-items:center;justify-content:space-between;gap:14rpx;padding:14rpx 16rpx;border-bottom:1rpx solid #eef2f7}.tips>view:last-child{border-bottom:0}.tips>view>view{min-width:0}.tips strong,.tips text{display:block;color:#64748b;font-size:20rpx}.tips strong{overflow:hidden;color:#1e293b;font-size:23rpx;text-overflow:ellipsis;white-space:nowrap}.tips .distance{flex:none;color:#2563eb}
.recent-panel,.routes{margin-top:16rpx}.recent-scroll{display:block;width:100%;max-width:100%;white-space:nowrap;box-sizing:border-box}.recent-list{display:flex;gap:12rpx;padding:2rpx 2rpx 8rpx}.recent-place{display:flex;width:300rpx;max-width:calc(100vw - 112rpx);min-width:0;flex:none;align-items:flex-start;gap:12rpx;padding:15rpx;border:1rpx solid #e2e8f0;border-radius:20rpx;background:linear-gradient(145deg,#fff,#f8fafc);box-sizing:border-box}.recent-icon{display:grid;width:42rpx;height:42rpx;flex:none;place-items:center;border-radius:14rpx;background:#eff6ff;color:#2563eb;font-size:25rpx}.recent-place view{min-width:0;flex:1;overflow:hidden}.recent-place strong,.recent-place view text{display:-webkit-box;overflow:hidden;text-overflow:ellipsis;-webkit-box-orient:vertical;white-space:normal}.recent-place strong{-webkit-line-clamp:1;color:#1e293b;font-size:22rpx;line-height:1.35}.recent-place view text{margin-top:3rpx;-webkit-line-clamp:2;color:#94a3b8;font-size:18rpx;line-height:1.4}
.routes{padding-top:2rpx}.route{display:grid;grid-template-columns:36rpx minmax(0,1fr) auto;gap:12rpx;align-items:center;margin-top:10rpx;padding:16rpx;border:2rpx solid #e2e8f0;border-radius:22rpx;background:#fff;transition:.2s ease;box-sizing:border-box}.route.selected{border-color:#3b82f6;background:linear-gradient(145deg,#eff6ff,#fff);box-shadow:0 8rpx 22rpx rgba(37,99,235,.12)}.route-radio{display:grid;width:32rpx;height:32rpx;place-items:center;border:3rpx solid #cbd5e1;border-radius:50%;box-sizing:border-box}.route.selected .route-radio{border-color:#2563eb}.route-radio i{width:14rpx;height:14rpx;border-radius:50%;background:transparent}.route.selected .route-radio i{background:#2563eb}.route-copy{min-width:0}.route-title{display:flex;align-items:center;gap:8rpx}.route-title strong{overflow:hidden;color:#0f172a;font-size:23rpx;text-overflow:ellipsis;white-space:nowrap}.route-tag{flex:none;padding:4rpx 8rpx;border-radius:999rpx;background:#dbeafe;color:#1d4ed8;font-size:16rpx}.route-tag.safe{background:#dcfce7;color:#15803d}.route-meta{display:flex;flex-wrap:wrap;gap:8rpx 12rpx;margin-top:5rpx}.route-meta text{color:#64748b;font-size:18rpx}.route-meta .toll{color:#c2410c}.toll-roads{display:block;margin-top:5rpx;overflow:hidden;color:#94a3b8;font-size:17rpx;text-overflow:ellipsis;white-space:nowrap}.route-price{flex:none;text-align:right}.route-price strong,.route-price text{display:block}.route-price strong{color:#0f172a;font-size:28rpx}.route-price text{margin-top:2rpx;color:#94a3b8;font-size:17rpx}
.prepay-notice{margin-top:14rpx;padding:16rpx 18rpx;border:1rpx solid #bfdbfe;border-radius:18rpx;background:#eff6ff}.prepay-notice view{display:flex;align-items:center;justify-content:space-between;color:#1e3a8a}.prepay-notice view text{font-size:21rpx;font-weight:700}.prepay-notice view strong{font-size:29rpx}.prepay-notice>text{display:block;margin-top:6rpx;color:#475569;font-size:19rpx;line-height:1.5}
.warning{padding:14rpx;background:#fff7ed;color:#c2410c;border-radius:14rpx;font-size:23rpx}.primary{margin-top:18rpx;background:#0f172a;color:#fff;border-radius:44rpx}.orders-link{margin-left:auto;color:#2563eb;font-size:24rpx}
button::after{border:0}

.collapse-content{min-width:0}.ride-collapse-enter-active,.ride-collapse-leave-active{overflow:hidden;transition:max-height .32s ease,opacity .22s ease,transform .32s ease}.ride-collapse-enter-from,.ride-collapse-leave-to{max-height:0;opacity:0;transform:translateY(-8rpx)}.ride-collapse-enter-to,.ride-collapse-leave-from{max-height:2400rpx;opacity:1;transform:translateY(0)}
.drawer{right:20rpx;width:auto;max-width:none;overflow-x:hidden}
.collapse-content{width:auto;max-width:none;box-sizing:border-box}
.drawer-shell{position:absolute;z-index:20;right:20rpx;bottom:calc(24rpx + env(safe-area-inset-bottom));left:20rpx}
.drawer-shell>.drawer{position:relative;right:auto;bottom:auto;left:auto}
.drawer-locate{position:absolute;z-index:2;top:-106rpx;right:4rpx}
</style>
