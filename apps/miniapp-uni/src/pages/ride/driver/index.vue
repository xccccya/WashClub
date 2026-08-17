<template>
	<view class="page">
		<RideMap ref="rideMap" :markers="markers" :route-points="routePoints" :fit-padding-px="mapFitPaddingPx" :show-locate-control="false" />
		<RideStatusBar title="内部司机" :subtitle="statusText"><view class="orders-link" @tap="goOrders">行程订单</view></RideStatusBar>
		<view class="status-panel" :style="statusPanelStyle">
			<view class="switches"><button :class="{ active: status === 'AVAILABLE' }" @tap="setStatus('AVAILABLE')">空闲</button><button :class="{ active: status === 'BUSY' }" @tap="setStatus('BUSY')">忙碌</button><button :class="{ active: status === 'OFFLINE' }" @tap="setStatus('OFFLINE')">离线</button></view>
			<view class="vehicle" @tap="manageVehicles"><view><text>当前出车车辆</text><strong>{{ currentVehicle?.vehicle?.plateNumber || '未选择车辆' }}</strong></view><text>管理 ›</text></view>
		</view>

		<view class="bottom-shell">
			<RideLocateControl class="bottom-locate" :action="locateOnMap" />
		<view v-if="activeTrip" class="order-card">
			<view class="order-head"><view><text class="eyebrow">当前行程 · #{{ activeTrip.id }}</text><strong>{{ tripTitle }}</strong></view><view class="order-head-actions"><view class="trip-status">{{ statusLabel(activeTrip.status) }}</view><text class="collapse-toggle" @tap="toggleOrder">{{ orderCollapsed ? '展开' : '收起' }}</text></view></view>
			<transition name="ride-collapse">
			<view v-if="!orderCollapsed" class="collapse-content">
			<view class="passenger-row"><image class="avatar" :src="passengerAvatar" mode="aspectFill" /><view><strong>{{ passengerLabel }}</strong><text>仅用于本次行程联系</text></view><RideContactActions :unread="chatUnreadCount" @call="callPassenger" @message="chat = true" /></view>
			<view class="route-card"><view class="route-row"><text class="point origin">起</text><text>{{ activeTrip.originAddress }}</text></view><view class="route-link" /><view class="route-row"><text class="point destination">终</text><text>{{ activeTrip.destinationAddress }}</text></view></view>
			<view class="trip-metrics"><view><text>预计里程</text><strong>{{ distanceText(activeTrip.estimatedDistanceMeters) }}</strong></view><view><text>预计时长</text><strong>{{ durationText(activeTrip.estimatedDurationSeconds) }}</strong></view><view><text>预估费用</text><strong>¥{{ money(activeTrip.estimatedAmount) }}</strong></view></view>
			<view v-if="activeTrip.status === 'TO_PICKUP'" class="action-row"><RideSlideAction class="slide-action" label="滑动确认到达上车点" @confirm="arrivePickup" /></view>
			<view v-else-if="activeTrip.status === 'ARRIVED_PICKUP'" class="action-row"><RideSlideAction class="slide-action" label="滑动验证并开始行程" @confirm="openPhoneVerification" /></view>
			<view v-else-if="activeTrip.status === 'IN_TRIP'" class="action-row in-trip-action"><RideSlideAction class="slide-action" label="滑动确认到达目的地" @confirm="arriveDestination" /><view class="live-meter"><text>实时金额</text><strong>¥{{ money(meter?.amount) }}</strong></view></view>
			<button v-else-if="activeTrip.status === 'ARRIVED_DESTINATION'" class="primary" @tap="goFare">确认到达费用</button>
			<view v-else class="settlement">{{ tripTitle }}</view>
			</view>
			</transition>
		</view>

		<view v-else-if="dispatching.length" class="dispatch-panel">
			<view class="section-head"><view><strong>可接行程</strong><text>拒绝后仍可在此重新接取</text></view><text>{{ dispatching.length }} 单</text></view>
			<scroll-view scroll-y class="dispatch-list">
				<view v-for="trip in dispatching" :key="trip.id" class="dispatch-row" @tap="openOrder(trip.id)"><view class="dispatch-route"><text>{{ trip.originAddress }}</text><text>→ {{ trip.destinationAddress }}</text></view><view class="dispatch-price"><strong>¥{{ money(trip.estimatedAmount) }}</strong><text>{{ distanceText(trip.estimatedDistanceMeters) }}</text></view><button class="accept-small" @tap.stop="accept(trip.id)">接单</button></view>
			</scroll-view>
		</view>
		<view v-else class="empty"><strong>{{ status === 'AVAILABLE' ? '正在等待新订单' : '当前不参与派单' }}</strong><text>{{ status === 'AVAILABLE' ? '保持定位开启，新订单会弹窗提醒' : '切换为空闲并选择车辆后即可接单' }}</text></view>
		</view>

		<view v-if="pendingDispatch" class="modal-mask">
			<view class="new-order-modal">
				<view class="modal-accent" /><view class="new-badge">新订单</view><strong class="modal-title">附近乘客正在呼叫</strong><text class="modal-subtitle">请确认路线后及时接单</text>
				<view class="modal-route"><view><text class="point origin">起</text><text>{{ pendingDispatch.originAddress }}</text></view><view class="modal-route-line" /><view><text class="point destination">终</text><text>{{ pendingDispatch.destinationAddress }}</text></view></view>
				<view class="modal-metrics"><view><text>预计里程</text><strong>{{ distanceText(pendingDispatch.estimatedDistanceMeters) }}</strong></view><view><text>预计时长</text><strong>{{ durationText(pendingDispatch.estimatedDurationSeconds) }}</strong></view><view><text>预估费用</text><strong>¥{{ money(pendingDispatch.estimatedAmount) }}</strong></view></view>
				<view class="modal-actions"><button class="secondary" @tap="rejectPending">暂不接</button><button class="accept" @tap="accept(pendingDispatch.id)">立即接单</button></view>
			</view>
		</view>

		<view v-if="phoneModal" class="modal-mask">
			<view class="phone-modal"><view class="phone-icon">✓</view><strong>验证乘客手机号</strong><text>请乘客告知手机号后四位，验证成功后开始行程</text><view class="digit-boxes"><view v-for="index in 4" :key="index" :class="{ filled: phoneLastFour[index - 1] }">{{ phoneLastFour[index - 1] || '' }}</view><input :focus="phoneFocus" :value="phoneLastFour" type="number" maxlength="4" @input="onPhoneInput" @confirm="submitPhone" /></view><view class="modal-actions"><button class="secondary" @tap="closePhoneVerification">取消</button><button class="accept" :disabled="phoneLastFour.length !== 4 || verifying" @tap="submitPhone">{{ verifying ? '验证中' : '验证并开始' }}</button></view></view>
		</view>
		<view v-if="vehicleModal" class="modal-mask" @tap="vehicleModal = false">
			<view class="vehicle-modal" @tap.stop>
				<view class="vehicle-modal-head"><view><strong>选择出车车辆</strong><text>可直接使用账号已有会员车辆</text></view><text @tap="vehicleModal = false">关闭</text></view>
				<scroll-view scroll-y class="vehicle-options">
					<view v-for="option in vehicleOptions" :key="option.vehicle.id" class="vehicle-option" :class="{ current: option.binding?.id === profile?.currentVehicleId }" @tap="chooseVehicle(option)">
						<view><strong>{{ option.vehicle.plateNumber }}</strong><text>{{ vehicleOptionHint(option) }}</text></view><text class="vehicle-check">{{ option.binding?.id === profile?.currentVehicleId ? '当前' : option.binding ? '选择' : '使用' }}</text>
					</view>
					<view v-if="!vehicleOptions.length" class="vehicle-empty">账号下暂无车辆，可在此新增</view>
				</scroll-view>
				<button class="vehicle-add" :disabled="vehicleSelecting" @tap="addDriverVehicle">+ 新增车辆</button>
			</view>
		</view>
		<RideChatSheet v-if="activeTrip" v-model="chat" :ride-id="activeTrip.id" :member-id="memberId" @unread-change="chatUnreadCount = $event" />
	</view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import RideChatSheet from '../../../components/ride/RideChatSheet.vue';
import RideContactActions from '../../../components/ride/RideContactActions.vue';
import RideMap from '../../../components/ride/RideMap.vue';
import RideLocateControl from '../../../components/ride/RideLocateControl.vue';
import RideSlideAction from '../../../components/ride/RideSlideAction.vue';
import RideStatusBar from '../../../components/ride/RideStatusBar.vue';
import passengerFallback from '../../../static/icons/jtuser.png';
import { getCurrentRideLocation, locationErrorMessage } from '../../../services/geolocation';
import { rideApi } from '../../../services/ride';
import { onRideRealtime, reportDriverLocation, startDriverLocationTracking } from '../../../services/ride-realtime';
import { getToken } from '../../../utils/auth';
import { openLogin } from '../../../utils/auth-navigation';
import { useSafeArea } from '../../../utils/safe-area';
import { formatRidePassengerLabel } from '../../../utils/ride-format';
import { resolveImageUrl } from '../../../utils/url';
import { useRideMapFitPadding } from '../../../utils/ride-map-fit';

const profile = ref<any>(null);
const rideMap = ref<InstanceType<typeof RideMap> | null>(null);
const vehicles = ref<any[]>([]);
const memberVehicles = ref<any[]>([]);
const orders = ref<any[]>([]);
const routePoints = ref<any[]>([]);
const currentLocation = ref<any>(null);
const meter = ref<any>(null);
const pendingDispatch = ref<any>(null);
const chat = ref(false);
const chatUnreadCount = ref(0);
const phoneModal = ref(false);
const vehicleModal = ref(false);
const vehicleSelecting = ref(false);
const phoneLastFour = ref('');
const phoneFocus = ref(false);
const orderCollapsed = ref(true);
const verifying = ref(false);
const seenDispatchIds = new Set<number>();
let stopTracking: (() => void) | null = null;
let stopRealtime: (() => void) | null = null;
let poll: ReturnType<typeof setInterval> | undefined;
let activeTripState = '';
let routeTripId = 0;

const safeArea = useSafeArea();
const statusPanelStyle = computed(() => ({ top: (safeArea.topSpacerHeight + 88) + 'px' }));
const { paddingPx: mapFitPaddingPx, refresh: refreshMapFit } = useRideMapFitPadding({
	topSelector: '.status-panel',
	bottomSelector: '.bottom-shell',
	topFallbackRpx: 420,
	bottomFallbackRpx: 560,
});
const memberId = computed(() => Number(uni.getStorageSync('user')?.id || 0));
const status = computed(() => profile.value?.availabilityStatus || 'OFFLINE');
const statusText = computed(() => ({ AVAILABLE: '空闲接单中', BUSY: '忙碌，不参与新派单', OFFLINE: '当前离线' } as any)[status.value]);
const currentVehicle = computed(() => vehicles.value.find((vehicle) => vehicle.id === profile.value?.currentVehicleId));
const activeTrip = computed(() => orders.value.find((trip) => ['TO_PICKUP','ARRIVED_PICKUP','IN_TRIP','ARRIVED_DESTINATION','FARE_PENDING','SUPPLEMENT_PENDING'].includes(trip.status)));
const dispatching = computed(() => orders.value.filter((trip) => trip.status === 'DISPATCHING'));
const tripTitle = computed(() => ({ TO_PICKUP: '前往乘客上车点', ARRIVED_PICKUP: '等待乘客验证', IN_TRIP: '行程进行中', ARRIVED_DESTINATION: '已到目的地', FARE_PENDING: '费用结算中', SUPPLEMENT_PENDING: '等待乘客补款' } as any)[activeTrip.value?.status] || activeTrip.value?.status);
const passengerLabel = computed(() => formatRidePassengerLabel(activeTrip.value?.passenger?.phoneLastFour));
const passengerAvatar = computed(() => resolveImageUrl(activeTrip.value?.passenger?.avatarUrl) || passengerFallback);
const vehicleOptions = computed(() => {
	const accountVehicles = new Map(memberVehicles.value.map((vehicle) => [Number(vehicle.id), vehicle]));
	const options = vehicles.value.map((binding) => ({ binding, vehicle: binding.vehicle || accountVehicles.get(Number(binding.vehicleId)) })).filter((option) => option.vehicle);
	const boundIds = new Set(options.map((option) => Number(option.vehicle.id)));
	for (const vehicle of memberVehicles.value) if (!boundIds.has(Number(vehicle.id))) options.push({ binding: null, vehicle } as any);
	return options;
});
const markers = computed(() => {
	const trip = activeTrip.value;
	if (!trip) return [];
	const list: any[] = [
		{ id: 1, longitude: Number(trip.originLongitude), latitude: Number(trip.originLatitude), title: '乘客上车点', kind: 'origin' },
		{ id: 2, longitude: Number(trip.destinationLongitude), latitude: Number(trip.destinationLatitude), title: '目的地', kind: 'destination' },
	];
	const location = currentLocation.value || trip.locations?.[0];
	if (location) list.push({ id: 3, longitude: Number(location.longitude), latitude: Number(location.latitude), title: '我的位置', kind: 'driver-current' });
	return list;
});
function locateOnMap() { return rideMap.value?.locateCurrent(); }
function toggleOrder() { orderCollapsed.value = !orderCollapsed.value; refreshMapFit(); }

async function load() {
	const [nextProfile, nextVehicles, nextMemberVehicles, data] = await Promise.all([rideApi.driverProfile(), rideApi.driverVehicles(), rideApi.memberVehicles(), rideApi.driverOrders({ page: 1, pageSize: 50 })]);
	profile.value = nextProfile;
	vehicles.value = Array.isArray(nextVehicles) ? nextVehicles : [];
	memberVehicles.value = Array.isArray(nextMemberVehicles) ? nextMemberVehicles : [];
	orders.value = data?.items || [];
	let current = activeTrip.value;
	if (current) {
		const detail = await rideApi.detail(current.id);
		orders.value = orders.value.map((item) => Number(item.id) === Number(detail.id) ? detail : item);
		current = activeTrip.value;
	}
	const nextActiveTripState = current ? `${Number(current.id)}:${current.status}` : '';
	if (nextActiveTripState !== activeTripState) {
		orderCollapsed.value = current?.status !== 'IN_TRIP';
		activeTripState = nextActiveTripState;
	}
	if (current && routeTripId !== Number(current.id)) {
		routeTripId = Number(current.id);
		routePoints.value = current.selectedRouteSnapshot?.points || [];
	} else if (!current) { routeTripId = 0; routePoints.value = []; }
	if (current?.status === 'IN_TRIP') meter.value = current.fareDetails || meter.value;
	else meter.value = null;
	const freshDispatch = dispatching.value.find((trip) => !seenDispatchIds.has(Number(trip.id)));
	if (freshDispatch && !current && !pendingDispatch.value) {
		seenDispatchIds.add(Number(freshDispatch.id));
		pendingDispatch.value = freshDispatch;
	}
}
function refreshSilently() {
	void load().catch((error: any) => {
		if (/未登录|登录已过期/.test(String(error?.message || ''))) return;
		console.warn('[ride-driver] refresh failed', error);
	});
}
function handleLocationUpdate(result: any) {
	if (result?.location) currentLocation.value = result.location;
	if (result?.route?.points) routePoints.value = result.route.points;
	if (result?.meter) meter.value = result.meter;
}
function currentRideTripId() {
	return activeTrip.value?.id ? Number(activeTrip.value.id) : null;
}
function handleRealtime(event: any) {
	if (String(event?.type || '').startsWith('ride:message')) return;
	if (event?.type === 'ride:meter' && Number(event?.data?.rideTripId) === Number(activeTrip.value?.id)) {
		meter.value = event.data.meter;
		return;
	}
	refreshSilently();
}
async function setStatus(next: 'OFFLINE' | 'AVAILABLE' | 'BUSY') {
	try {
		if (next !== 'OFFLINE') {
			const location = await getCurrentRideLocation();
			currentLocation.value = location;
			await reportDriverLocation(location, currentRideTripId(), handleLocationUpdate);
		}
		profile.value = await rideApi.driverStatus(next);
		if (next !== 'OFFLINE' && !stopTracking) stopTracking = startDriverLocationTracking(currentRideTripId, handleLocationUpdate);
		if (next === 'OFFLINE' && stopTracking) { stopTracking(); stopTracking = null; }
	} catch (error: any) { uni.showToast({ title: locationErrorMessage(error) || error?.message || '状态切换失败', icon: 'none' }); }
}
async function accept(id: number) {
	try { await rideApi.accept(id); pendingDispatch.value = null; uni.showToast({ title: '接单成功', icon: 'success' }); await load(); }
	catch (error: any) { uni.showToast({ title: error?.message || '订单已被接走', icon: 'none' }); await load(); }
}
async function rejectPending() {
	if (!pendingDispatch.value) return;
	try { await rideApi.reject(pendingDispatch.value.id); pendingDispatch.value = null; uni.showToast({ title: '已暂不接单，可在列表重新接取', icon: 'none' }); await load(); }
	catch (error: any) { uni.showToast({ title: error?.message || '操作失败', icon: 'none' }); }
}
function distanceBetween(a: any, b: any) {
	const rad = (value: number) => value * Math.PI / 180;
	const dLat = rad(Number(b.latitude) - Number(a.latitude));
	const dLng = rad(Number(b.longitude) - Number(a.longitude));
	const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(a.latitude))) * Math.cos(rad(Number(b.latitude))) * Math.sin(dLng / 2) ** 2;
	return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function askFarArrival(message: string) {
	return new Promise<boolean>((resolve) => uni.showModal({ title: '距离目标点较远', content: message, confirmText: '仍然确认', confirmColor: '#dc2626', success: (result) => resolve(!!result.confirm), fail: () => resolve(false) }));
}
async function arrive(kind: 'pickup' | 'destination') {
	if (!activeTrip.value) return;
	try {
		const location = await getCurrentRideLocation();
		currentLocation.value = location;
		await reportDriverLocation(location, currentRideTripId(), handleLocationUpdate);
		const target = kind === 'pickup' ? { longitude: activeTrip.value.originLongitude, latitude: activeTrip.value.originLatitude } : { longitude: activeTrip.value.destinationLongitude, latitude: activeTrip.value.destinationLatitude };
		const distance = Math.round(distanceBetween(location, target));
		let confirmed = false;
		if (distance > 500) confirmed = await askFarArrival('当前位置距离' + (kind === 'pickup' ? '上车点' : '目的地') + '约 ' + distance + ' 米，是否仍要标记到达？');
		if (distance > 500 && !confirmed) return;
		try { await (kind === 'pickup' ? rideApi.arrivePickup(activeTrip.value.id, confirmed) : rideApi.arriveDestination(activeTrip.value.id, confirmed)); }
		catch (error: any) {
			if (!confirmed && /距离.*米|RIDE_ARRIVAL_TOO_FAR/.test(String(error?.message || '')) && await askFarArrival(String(error.message))) await (kind === 'pickup' ? rideApi.arrivePickup(activeTrip.value.id, true) : rideApi.arriveDestination(activeTrip.value.id, true));
			else throw error;
		}
		await load();
	} catch (error: any) { uni.showToast({ title: locationErrorMessage(error) || error?.message || '到达确认失败', icon: 'none' }); }
}
function arrivePickup() { void arrive('pickup'); }
function arriveDestination() { void arrive('destination'); }
function openPhoneVerification() { phoneLastFour.value = ''; phoneModal.value = true; nextTick(() => { phoneFocus.value = true; }); }
function closePhoneVerification() { phoneModal.value = false; phoneFocus.value = false; phoneLastFour.value = ''; }
function onPhoneInput(event: any) { phoneLastFour.value = String(event?.detail?.value || '').replace(/\D/g, '').slice(0, 4); }
async function submitPhone() {
	if (!activeTrip.value || phoneLastFour.value.length !== 4 || verifying.value) return;
	verifying.value = true;
	try {
		const location = await getCurrentRideLocation();
		currentLocation.value = location;
		await reportDriverLocation(location, currentRideTripId(), handleLocationUpdate);
		await rideApi.start(activeTrip.value.id, phoneLastFour.value);
		closePhoneVerification();
		await load();
	}
	catch (error: any) { uni.showToast({ title: error?.message || '验证失败', icon: 'none' }); phoneLastFour.value = ''; phoneFocus.value = false; nextTick(() => { phoneFocus.value = true; }); }
	finally { verifying.value = false; }
}
async function callPassenger() {
	try { const contact = await rideApi.contact(activeTrip.value.id); uni.makePhoneCall({ phoneNumber: contact.phone }); }
	catch (error: any) { uni.showToast({ title: error?.message || '暂时无法联系乘客', icon: 'none' }); }
}
function goFare() { uni.navigateTo({ url: '/pages/ride/fare-confirm/index?id=' + activeTrip.value.id }); }
function goOrders() { uni.navigateTo({ url: '/pages/ride/orders/index?driver=1' }); }
function openOrder(id: number) { uni.navigateTo({ url: '/pages/ride/detail/index?id=' + id + '&driver=1' }); }
function statusLabel(value: string) { return ({ TO_PICKUP: '接驾中', ARRIVED_PICKUP: '已到上车点', IN_TRIP: '行程中', ARRIVED_DESTINATION: '已到目的地', FARE_PENDING: '结算中', SUPPLEMENT_PENDING: '待补款' } as any)[value] || value; }
function distanceText(value: any) { const meters = Number(value || 0); return meters < 1000 ? Math.round(meters) + 'm' : (meters / 1000).toFixed(1) + 'km'; }
function durationText(value: any) { const seconds = Number(value || 0); return Math.max(0, Math.ceil(seconds / 60)) + '分钟'; }
function money(value: any) { return Number(value || 0).toFixed(2); }
function manageVehicles() { vehicleModal.value = true; }
function vehicleOptionHint(option: any) {
	const description = [option.vehicle?.brand, option.vehicle?.series, option.vehicle?.typeMain].map((value) => String(value || '').trim()).filter((value) => value && value !== '-').join(' · ');
	return description || (option.binding ? '已绑定出车车辆' : '账号已有会员车辆');
}
async function chooseVehicle(option: any) {
	if (vehicleSelecting.value || option.binding?.id === profile.value?.currentVehicleId) return;
	vehicleSelecting.value = true;
	try {
		if (option.binding) await rideApi.updateDriverVehicle(option.binding.id, { selected: true, enabled: true });
		else await rideApi.createDriverVehicle({ vehicleId: Number(option.vehicle.id), selected: true });
		await load();
		vehicleModal.value = false;
		uni.showToast({ title: '出车车辆已切换', icon: 'success' });
	} catch (error: any) { uni.showToast({ title: error?.message || '车辆选择失败', icon: 'none' }); }
	finally { vehicleSelecting.value = false; }
}
function addDriverVehicle() {
	if (vehicleSelecting.value) return;
	vehicleModal.value = false;
	uni.showModal({
		title: '新增出车车辆', editable: true, placeholderText: '输入车牌号',
		success: async (result) => {
			const plateNumber = String(result.content || '').trim();
			if (!result.confirm || !plateNumber) return;
			vehicleSelecting.value = true;
			try { await rideApi.createDriverVehicle({ plateNumber, typeMain: '轿车', selected: true }); await load(); uni.showToast({ title: '车辆已添加', icon: 'success' }); }
			catch (error: any) { uni.showToast({ title: error?.message || '车辆添加失败', icon: 'none' }); }
			finally { vehicleSelecting.value = false; }
		},
	});
}
watch(() => [orderCollapsed.value, activeTrip.value?.status, dispatching.value.length, meter.value?.amount], refreshMapFit, { flush: 'post' });
onMounted(async () => {
	if (!getToken()) { openLogin('required'); return; }
	try { await load(); }
	catch (error: any) {
		if (!/未登录|登录已过期/.test(String(error?.message || ''))) uni.showToast({ title: error?.message || '司机工作台加载失败', icon: 'none' });
		return;
	}
	if (status.value !== 'OFFLINE') stopTracking = startDriverLocationTracking(currentRideTripId, handleLocationUpdate);
	stopRealtime = onRideRealtime(handleRealtime);
	poll = setInterval(refreshSilently, 8000);
});
onBeforeUnmount(() => { stopTracking?.(); stopRealtime?.(); if (poll) clearInterval(poll); });
</script>

<style scoped>
.page{height:100vh;position:relative;overflow:hidden;background:#e2e8f0}.orders-link{margin-left:auto;color:#2563eb;font-size:24rpx}.status-panel,.order-card,.dispatch-panel,.empty{position:absolute;z-index:20;right:20rpx;left:20rpx;border:1rpx solid rgba(255,255,255,.8);border-radius:30rpx;background:rgba(255,255,255,.97);box-shadow:0 16rpx 50rpx rgba(15,23,42,.2);backdrop-filter:blur(12px)}.status-panel{padding:16rpx}.switches{display:flex;gap:8rpx;padding:6rpx;border-radius:999rpx;background:#edf2f7}.switches button{height:62rpx;flex:1;margin:0;border:0;border-radius:999rpx;background:transparent;color:#64748b;font-size:22rpx;line-height:62rpx}.switches button.active{background:#0f172a;box-shadow:0 6rpx 14rpx rgba(15,23,42,.2);color:#fff}.vehicle{display:flex;align-items:center;justify-content:space-between;padding:13rpx 12rpx 4rpx;color:#2563eb;font-size:22rpx}.vehicle view text,.vehicle view strong{display:block}.vehicle view text{color:#94a3b8;font-size:19rpx}.vehicle view strong{margin-top:2rpx;color:#334155;font-size:24rpx}.order-card,.dispatch-panel,.empty{bottom:calc(22rpx + env(safe-area-inset-bottom));padding:22rpx;box-sizing:border-box}.order-card{max-height:68vh;overflow-y:auto}.order-head,.section-head,.passenger-row,.trip-metrics,.action-row,.modal-actions,.modal-metrics{display:flex;align-items:center}.order-head,.section-head{justify-content:space-between}.order-head strong,.order-head text,.section-head strong,.section-head text{display:block}.eyebrow{color:#94a3b8;font-size:19rpx}.order-head strong{margin-top:4rpx;color:#0f172a;font-size:31rpx}.trip-status{padding:9rpx 15rpx;border-radius:999rpx;background:#eff6ff;color:#2563eb;font-size:21rpx;font-weight:750}.passenger-row{gap:11rpx;margin:16rpx 0;padding:13rpx 15rpx;border-radius:20rpx;background:#f8fafc}.avatar{width:58rpx;height:58rpx;flex:none;border-radius:50%;background:#e2e8f0}.passenger-row>view:nth-child(2){min-width:0;flex:1}.passenger-row strong,.passenger-row text{display:block}.passenger-row strong{font-size:25rpx}.passenger-row text{color:#94a3b8;font-size:18rpx}.route-card{padding:16rpx;border-radius:20rpx;background:#f8fafc}.route-row{display:flex;align-items:center;gap:12rpx;color:#334155;font-size:23rpx}.route-row>text:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.point{display:grid;width:38rpx;height:38rpx;flex:none;place-items:center;border-radius:50%;color:#fff;font-size:19rpx;font-weight:800}.origin{background:#16a34a}.destination{background:#ef4444}.route-link{width:2rpx;height:17rpx;margin:3rpx 0 3rpx 18rpx;background:#cbd5e1}.trip-metrics,.modal-metrics{justify-content:space-between;gap:8rpx;margin:14rpx 0}.trip-metrics view,.modal-metrics view{min-width:0;flex:1;text-align:center}.trip-metrics text,.trip-metrics strong,.modal-metrics text,.modal-metrics strong{display:block}.trip-metrics text,.modal-metrics text{color:#94a3b8;font-size:18rpx}.trip-metrics strong,.modal-metrics strong{margin-top:3rpx;color:#0f172a;font-size:24rpx}.slide-action{min-width:0;flex:1}.meter{margin:4rpx 0 14rpx;padding:22rpx;border-radius:24rpx;background:linear-gradient(145deg,#0f172a,#1e293b);box-shadow:0 14rpx 30rpx rgba(15,23,42,.22);color:#fff}.meter-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18rpx}.meter-head>view:first-child text,.meter-head>view:first-child strong{display:block}.meter-head>view:first-child text{color:#93c5fd;font-size:20rpx}.meter-head>view:first-child strong{margin-top:2rpx;font-size:50rpx;line-height:1.15}.meter-head>view:last-child{display:flex;gap:12rpx;color:#cbd5e1;font-size:20rpx}.meter-breakdown{display:grid;grid-template-columns:repeat(4,1fr);gap:8rpx;margin-top:18rpx;padding-top:16rpx;border-top:1rpx solid rgba(255,255,255,.12)}.meter-breakdown view{min-width:0;text-align:center}.meter-breakdown text,.meter-breakdown strong{display:block}.meter-breakdown text{color:#94a3b8;font-size:17rpx}.meter-breakdown strong{margin-top:4rpx;color:#f8fafc;font-size:20rpx}.primary{margin-top:12rpx;border:0;border-radius:999rpx;background:#0f172a;color:#fff}.settlement{padding:18rpx;border-radius:18rpx;background:#f1f5f9;color:#64748b;text-align:center}.section-head strong{font-size:29rpx}.section-head view text{margin-top:3rpx;color:#94a3b8;font-size:19rpx}.section-head>text{padding:7rpx 12rpx;border-radius:999rpx;background:#eff6ff;color:#2563eb;font-size:20rpx}.dispatch-list{max-height:400rpx;margin-top:12rpx}.dispatch-row{display:flex;align-items:center;gap:10rpx;padding:14rpx 0;border-top:1rpx solid #eef2f7}.dispatch-route{min-width:0;flex:1}.dispatch-route text{display:block;overflow:hidden;color:#334155;font-size:22rpx;text-overflow:ellipsis;white-space:nowrap}.dispatch-route text+text{margin-top:4rpx;color:#64748b}.dispatch-price{flex:none;text-align:right}.dispatch-price strong,.dispatch-price text{display:block}.dispatch-price strong{font-size:25rpx}.dispatch-price text{color:#94a3b8;font-size:18rpx}.accept-small{flex:none;margin:0;padding:0 18rpx;border:0;border-radius:999rpx;background:#2563eb;color:#fff;font-size:21rpx}.empty{display:flex;flex-direction:column;align-items:center;padding:38rpx 22rpx;color:#94a3b8}.empty strong{color:#475569;font-size:27rpx}.empty text{margin-top:6rpx;font-size:20rpx}.modal-mask{position:fixed;z-index:110;inset:0;display:flex;align-items:center;justify-content:center;padding:34rpx;background:rgba(15,23,42,.48);backdrop-filter:blur(7px)}.new-order-modal,.phone-modal,.vehicle-modal{position:relative;width:100%;overflow:hidden;padding:34rpx;border:1rpx solid rgba(255,255,255,.85);border-radius:36rpx;background:#fff;box-shadow:0 30rpx 90rpx rgba(15,23,42,.3);box-sizing:border-box}.modal-accent{position:absolute;top:0;right:0;left:0;height:10rpx;background:linear-gradient(90deg,#2563eb,#818cf8,#ec4899)}.new-badge{display:inline-flex;padding:9rpx 16rpx;border-radius:999rpx;background:#eff6ff;color:#2563eb;font-size:21rpx;font-weight:800}.modal-title,.modal-subtitle{display:block}.modal-title{margin-top:18rpx;color:#0f172a;font-size:35rpx}.modal-subtitle{margin-top:5rpx;color:#94a3b8;font-size:22rpx}.modal-route{margin-top:24rpx;padding:20rpx;border-radius:22rpx;background:#f8fafc}.modal-route>view{display:flex;align-items:center;gap:13rpx;color:#334155;font-size:23rpx}.modal-route-line{width:2rpx;height:24rpx;margin:4rpx 0 4rpx 18rpx;background:#cbd5e1}.modal-actions{gap:12rpx;margin-top:24rpx}.modal-actions button{flex:1;margin:0;border-radius:999rpx;font-size:25rpx}.secondary{border:1rpx solid #e2e8f0;background:#f8fafc;color:#64748b}.accept{border:0;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;box-shadow:0 9rpx 20rpx rgba(37,99,235,.24)}.phone-modal{text-align:center}.phone-icon{display:grid;width:82rpx;height:82rpx;margin:0 auto 18rpx;place-items:center;border-radius:50%;background:linear-gradient(135deg,#2563eb,#818cf8);box-shadow:0 12rpx 28rpx rgba(37,99,235,.25);color:#fff;font-size:38rpx}.phone-modal>strong,.phone-modal>text{display:block}.phone-modal>strong{color:#0f172a;font-size:33rpx}.phone-modal>text{margin:9rpx auto 0;max-width:500rpx;color:#64748b;font-size:22rpx;line-height:1.6}.digit-boxes{position:relative;display:flex;justify-content:center;gap:14rpx;margin-top:26rpx}.digit-boxes>view{display:grid;width:76rpx;height:88rpx;place-items:center;border:2rpx solid #dbe4f0;border-radius:17rpx;background:#f8fafc;color:#0f172a;font-size:38rpx;font-weight:800}.digit-boxes>view.filled{border-color:#2563eb;background:#eff6ff;box-shadow:0 7rpx 18rpx rgba(37,99,235,.1)}.digit-boxes input{position:absolute;inset:0;width:100%;height:100%;opacity:.01;color:transparent}.vehicle-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20rpx}.vehicle-modal-head strong,.vehicle-modal-head text{display:block}.vehicle-modal-head strong{color:#0f172a;font-size:31rpx}.vehicle-modal-head view text{margin-top:5rpx;color:#94a3b8;font-size:20rpx}.vehicle-modal-head>text{padding:6rpx;color:#2563eb;font-size:22rpx}.vehicle-options{max-height:520rpx;margin-top:20rpx}.vehicle-option{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-bottom:12rpx;padding:18rpx;border:2rpx solid #e2e8f0;border-radius:20rpx;background:#f8fafc}.vehicle-option.current{border-color:#2563eb;background:#eff6ff}.vehicle-option>view{min-width:0}.vehicle-option strong,.vehicle-option view text{display:block}.vehicle-option strong{color:#0f172a;font-size:27rpx}.vehicle-option view text{margin-top:4rpx;overflow:hidden;color:#64748b;font-size:20rpx;text-overflow:ellipsis;white-space:nowrap}.vehicle-check{flex:none;padding:7rpx 12rpx;border-radius:999rpx;background:#fff;color:#2563eb;font-size:19rpx;font-weight:700}.vehicle-option.current .vehicle-check{background:#2563eb;color:#fff}.vehicle-empty{padding:50rpx 10rpx;color:#94a3b8;text-align:center;font-size:22rpx}.vehicle-add{margin-top:16rpx;border:0;border-radius:999rpx;background:#0f172a;color:#fff}button::after{border:0}

.order-head-actions{display:flex;align-items:center;gap:10rpx}.collapse-toggle{flex:none;padding:8rpx 4rpx;color:#2563eb;font-size:21rpx;font-weight:700}.meter{border:1rpx solid #dbe7f4;background:linear-gradient(145deg,#fff,#f5f9ff);box-shadow:0 10rpx 26rpx rgba(37,99,235,.1);color:#0f172a}.meter-head>view:first-child text{color:#64748b}.meter-head>view:first-child strong{color:#0f172a;font-size:42rpx}.meter-head>view:last-child{color:#64748b}.meter-breakdown{grid-template-columns:repeat(2,minmax(0,1fr));gap:8rpx;margin-top:14rpx;padding-top:12rpx;border-top-color:#e2e8f0}.meter-breakdown text{color:#64748b}.meter-breakdown strong{color:#0f172a}.point{width:30rpx;height:30rpx;font-size:17rpx}.route-link{margin-left:15rpx}

.collapse-content{min-width:0}.ride-collapse-enter-active,.ride-collapse-leave-active{overflow:hidden;transition:max-height .32s ease,opacity .22s ease,transform .32s ease}.ride-collapse-enter-from,.ride-collapse-leave-to{max-height:0;opacity:0;transform:translateY(-8rpx)}.ride-collapse-enter-to,.ride-collapse-leave-from{max-height:2400rpx;opacity:1;transform:translateY(0)}.meter{width:100%;max-width:100%;box-sizing:border-box}.meter-details{display:grid;gap:8rpx;margin-top:10rpx;padding:12rpx 14rpx;border-radius:15rpx;background:#f8fafc}.meter-details>view{display:grid;grid-template-columns:116rpx minmax(0,1fr);align-items:start;gap:10rpx;min-width:0;padding:8rpx 0;border-bottom:1rpx solid #e8eef6}.meter-details>view:last-child{border-bottom:0}.meter-details text{min-width:0;color:#64748b;font-size:16rpx;line-height:1.45}.meter-details strong{min-width:0;color:#334155;font-size:16rpx;font-weight:600;line-height:1.45;text-align:left;overflow-wrap:anywhere;word-break:break-word}.meter-rule{display:flex;align-items:center;justify-content:space-between;gap:12rpx;margin-top:12rpx;padding-top:12rpx;border-top:1rpx solid #e2e8f0;color:#64748b;font-size:16rpx}.meter-toggle{flex:none;color:#2563eb;font-weight:700}
.status-panel,.order-card,.dispatch-panel,.empty{right:20rpx;width:auto;max-width:none;overflow-x:hidden;box-sizing:border-box}
.collapse-content{width:auto;max-width:none;box-sizing:border-box}
.meter{width:auto;max-width:none;overflow:hidden}
.bottom-shell{position:absolute;z-index:20;right:20rpx;bottom:calc(22rpx + env(safe-area-inset-bottom));left:20rpx}
.bottom-shell>.order-card,.bottom-shell>.dispatch-panel,.bottom-shell>.empty{position:relative;right:auto;bottom:auto;left:auto}
.bottom-locate{position:absolute;z-index:2;top:-106rpx;right:4rpx}
.in-trip-action{gap:12rpx}.live-meter{display:flex;width:156rpx;flex:none;flex-direction:column;align-items:center;justify-content:center;border:1rpx solid #dbe7f4;border-radius:24rpx;background:linear-gradient(145deg,#fff,#f5f9ff);box-shadow:0 8rpx 20rpx rgba(37,99,235,.08);box-sizing:border-box}.live-meter text{color:#64748b;font-size:18rpx}.live-meter strong{margin-top:4rpx;color:#0f172a;font-size:28rpx;line-height:1.1;white-space:nowrap}
</style>
