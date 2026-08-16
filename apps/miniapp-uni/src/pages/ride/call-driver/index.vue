<template>
	<view class="page">
		<RideMap :markers="markers" :route-points="routePoints" @marker-tap="onMarkerTap" />
		<RideStatusBar title="呼叫司机" :subtitle="availabilityText">
			<view class="orders-link" @tap="goOrders">行程订单</view>
		</RideStatusBar>
		<view class="drawer">
			<view v-if="locationNotice" class="location-notice"><text>{{ locationNotice }}</text><text class="retry" @tap="locate">重新定位</text></view>
			<view class="field"><text class="badge start">起</text><input v-model="origin.address" placeholder="请输入或使用当前起点" @input="searchOrigin" /></view>
			<view v-if="originTips.length" class="tips"><view v-for="tip in originTips" :key="tip.id" @tap="pickOrigin(tip)">{{ tip.name }}<text>{{ tip.address }}</text></view></view>
			<view class="field"><text class="badge end">终</text><input v-model="destination.address" placeholder="请输入目的地" @input="searchDestination" /></view>
			<view v-if="destinationTips.length" class="tips"><view v-for="tip in destinationTips" :key="tip.id" @tap="pickDestination(tip)">{{ tip.name }}<text>{{ tip.address }}</text></view></view>
			<view v-if="preview" class="routes">
				<view v-for="(candidate, index) in preview.routes" :key="index" class="route" :class="{ selected: selectedRouteIndex === index }" @tap="selectedRouteIndex = index">
					<text>路线 {{ index + 1 }} · {{ (candidate.route.distanceMeters / 1000).toFixed(1) }}km · {{ Math.ceil(candidate.route.durationSeconds / 60) }}分钟</text><strong>¥{{ Number(candidate.fare.amount).toFixed(2) }}</strong><text v-if="candidate.route.tollAmount">含过路费 ¥{{ candidate.route.tollAmount }}</text>
				</view>
			</view>
			<view v-if="availability && !availability.availableCount" class="warning">3km 内暂无空闲司机，可点地图上的忙碌车辆联系司机。</view>
			<button class="primary" :disabled="loading || !canCall" @tap="callDriver">{{ preview ? '支付并呼叫司机' : '预览路线与价格' }}</button>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import RideMap from '../../../components/ride/RideMap.vue';
import RideStatusBar from '../../../components/ride/RideStatusBar.vue';
import { rideApi } from '../../../services/ride';
import { getCurrentRideLocation, locationErrorMessage } from '../../../services/geolocation';

const loading = ref(false);
const availability = ref<any>(null);
const preview = ref<any>(null);
const selectedRouteIndex = ref(0);
const originTips = ref<any[]>([]);
const destinationTips = ref<any[]>([]);
const locationNotice = ref('');
const origin = ref<any>({ longitude: 104.6688, latitude: 29.5274, address: '请定位或手动选择起点' });
const destination = ref<any>({ longitude: 0, latitude: 0, address: '' });
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const availabilityText = computed(() => availability.value ? `${availability.value.availableCount} 位空闲司机` : '正在检查附近司机');
const canCall = computed(() => !!availability.value?.availableCount && !!destination.value.longitude);
const selectedRoute = computed(() => preview.value?.routes?.[selectedRouteIndex.value] || preview.value);
const routePoints = computed(() => selectedRoute.value?.route?.points || []);
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
		origin.value = { longitude: point.longitude, latitude: point.latitude, address: '当前位置' };
		await check();
	} catch (error) {
		availability.value = null;
		locationNotice.value = locationErrorMessage(error);
		uni.showToast({ title: locationNotice.value.slice(0, 30), icon: 'none' });
	}
}
async function check() { availability.value = await rideApi.availability(origin.value.longitude, origin.value.latitude); }
function searchOrigin(event: any) { search('origin', event.detail.value); }
function searchDestination(event: any) { search('destination', event.detail.value); }
function search(kind: 'origin' | 'destination', value: string) {
	if (searchTimer) clearTimeout(searchTimer);
	searchTimer = setTimeout(async () => {
		const data = value.trim() ? await rideApi.places(value.trim()) : [];
		(kind === 'origin' ? originTips : destinationTips).value = data;
	}, 300);
}
function pickOrigin(tip: any) {
	origin.value = { longitude: tip.longitude, latitude: tip.latitude, address: `${tip.name} ${tip.address}`.trim(), poiId: tip.id };
	originTips.value = []; preview.value = null; selectedRouteIndex.value = 0; check();
}
function pickDestination(tip: any) {
	destination.value = { longitude: tip.longitude, latitude: tip.latitude, address: `${tip.name} ${tip.address}`.trim(), poiId: tip.id };
	destinationTips.value = []; preview.value = null; selectedRouteIndex.value = 0;
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
onMounted(locate);
</script>

<style scoped>
.page{height:100vh;position:relative;overflow:hidden}.drawer{position:absolute;z-index:20;left:20rpx;right:20rpx;bottom:calc(24rpx + env(safe-area-inset-bottom));padding:24rpx;background:#fff;border-radius:32rpx;box-shadow:0 16rpx 50rpx rgba(15,23,42,.18)}
.location-notice{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx;margin-bottom:12rpx;padding:14rpx 16rpx;border-radius:16rpx;background:#fff7ed;color:#9a3412;font-size:22rpx;line-height:1.5}.location-notice>text:first-child{flex:1}.retry{flex:none;color:#2563eb;font-weight:700}
.field{display:flex;align-items:center;gap:14rpx;padding:14rpx 0;border-bottom:1px solid #e2e8f0}.field input{flex:1}.badge{width:42rpx;height:42rpx;border-radius:50%;display:grid;place-items:center;color:#fff}.start{background:#16a34a}.end{background:#ef4444}
.tips,.routes{max-height:220rpx;overflow:auto;background:#f8fafc}.tips view{padding:14rpx;border-bottom:1px solid #e2e8f0}.tips text,.route text{display:block;font-size:22rpx;color:#64748b}.route{display:grid;grid-template-columns:1fr auto;gap:4rpx 12rpx;padding:14rpx;border:2rpx solid transparent;border-radius:12rpx}.route.selected{border-color:#2563eb;background:#eff6ff}.route strong{grid-row:1/3;grid-column:2;font-size:28rpx;align-self:center}
.warning{padding:14rpx;background:#fff7ed;color:#c2410c;border-radius:14rpx;font-size:23rpx}.primary{margin-top:18rpx;background:#0f172a;color:#fff;border-radius:44rpx}.orders-link{margin-left:auto;color:#2563eb;font-size:24rpx}
</style>
