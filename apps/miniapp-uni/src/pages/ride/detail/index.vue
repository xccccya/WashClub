<template>
	<view class="page">
		<view class="map"><RideMap v-if="trip" :markers="markers" :route-points="routePoints" /></view>
		<RideStatusBar :title="statusText" :subtitle="`${isDriverView ? '司机视角' : '乘客视角'} · ${trip?.order?.no || ''}`" />
		<view v-if="trip" class="drawer">
			<view class="status-line"><view class="status-dot" /><view><strong>{{ statusText }}</strong><text>{{ statusHint }}</text></view></view>
			<view class="route-card">
				<view class="route-row"><text class="point origin">起</text><text>{{ trip.originAddress }}</text></view>
				<view class="route-link" />
				<view class="route-row"><text class="point destination">终</text><text>{{ trip.destinationAddress }}</text></view>
			</view>
			<view class="driver-card">
				<view v-if="isDriverView" class="passenger-avatar">乘</view>
				<image v-else :src="vehicleLocationIcon" mode="aspectFit" />
				<view class="driver-copy"><strong>{{ counterpartName }}</strong><text>{{ counterpartHint }}</text></view>
				<button v-if="canContact" size="mini" class="contact" @tap="callOtherParty">电话</button>
				<button v-if="canContact" size="mini" class="contact" @tap="chat = true">消息</button>
			</view>
			<view class="fare"><view><text>预估费用</text><strong>¥{{ money(trip.estimatedAmount) }}</strong></view><view v-if="trip.finalAmount != null"><text>最终费用</text><strong>¥{{ money(trip.finalAmount) }}</strong></view></view>
			<view v-if="refundText" class="refund-note"><strong>{{ refundText }}</strong><text v-if="Number(trip.order?.refundedAmount || 0) > 0">已退 ¥{{ money(trip.order.refundedAmount) }}</text></view>
			<button v-if="isDriverView && trip.status === 'DISPATCHING'" class="primary" @tap="acceptTrip">接取此订单</button>
			<button v-if="!isDriverView && trip.status === 'PREPAY_PENDING'" class="primary" @tap="pay(trip.order.id)">立即支付</button>
			<button v-if="!isDriverView && trip.status === 'SUPPLEMENT_PENDING'" class="primary" @tap="pay(trip.supplementOrderId)">支付补款</button>
			<button v-if="!isDriverView && ['PREPAY_PENDING', 'DISPATCHING'].includes(trip.status)" class="cancel" @tap="cancelTrip">取消行程</button>
		</view>
		<view v-else class="loading">正在加载行程…</view>
		<RideChatSheet v-if="trip" v-model="chat" :ride-id="trip.id" :member-id="memberId" />
	</view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import RideMap from '../../../components/ride/RideMap.vue';
import RideStatusBar from '../../../components/ride/RideStatusBar.vue';
import RideChatSheet from '../../../components/ride/RideChatSheet.vue';
import { rideApi } from '../../../services/ride';
import { onRideRealtime } from '../../../services/ride-realtime';
import vehicleLocationIcon from '../../../static/icons/ride-vehicle-location.svg';

const trip = ref<any>(null);
const chat = ref(false);
let id = 0;
const isDriverView = ref(false);
let stopRealtime: (() => void) | null = null;
let poll: ReturnType<typeof setInterval> | undefined;
const memberId = computed(() => Number(uni.getStorageSync('user')?.id || 0));
const routePoints = computed(() => trip.value?.selectedRouteSnapshot?.points || []);
const markers = computed(() => {
	if (!trip.value) return [];
	const current = trip.value;
	const list: any[] = [
		{ id: 1, longitude: Number(current.originLongitude), latitude: Number(current.originLatitude), title: '起点', kind: 'origin' },
		{ id: 2, longitude: Number(current.destinationLongitude), latitude: Number(current.destinationLatitude), title: '终点', kind: 'destination' },
	];
	const location = current.locations?.[0];
	if (location) list.push({ id: 3, longitude: Number(location.longitude), latitude: Number(location.latitude), title: '司机位置', kind: 'driver-current' });
	return list;
});
const statusText = computed(() => ({
	PREPAY_PENDING: '等待预付', DISPATCHING: isDriverView.value ? '待接取行程' : '等待司机接单', TO_PICKUP: isDriverView.value ? '前往乘客上车点' : '司机正在赶来', ARRIVED_PICKUP: isDriverView.value ? '等待乘客验证' : '司机已到达', IN_TRIP: '行程进行中', ARRIVED_DESTINATION: '已到目的地', FARE_PENDING: '正在结算', SUPPLEMENT_PENDING: '等待补款', REFUND_PENDING: '退款处理中', COMPLETED: '行程已完成', CANCELLED: '行程已取消', NO_DRIVER: '暂无司机',
} as Record<string, string>)[trip.value?.status] || '行程详情');
const statusHint = computed(() => ({
	PREPAY_PENDING: '完成预付后开始派单', DISPATCHING: isDriverView.value ? '可查看乘客与路线信息后接单' : '正在通知附近空闲司机', TO_PICKUP: isDriverView.value ? '请按导航前往上车点' : '请留意司机实时位置', ARRIVED_PICKUP: isDriverView.value ? '请核验乘客手机号后四位' : '请与司机确认后上车', IN_TRIP: '正在前往目的地', ARRIVED_DESTINATION: '司机正在确认最终费用', FARE_PENDING: '费用确认后将完成行程', SUPPLEMENT_PENDING: '请完成差额支付', REFUND_PENDING: '退款已提交，将按原支付渠道退回', COMPLETED: '感谢使用内部用车服务', CANCELLED: Number(trip.value?.order?.refundedAmount || 0) > 0 ? '本次行程已取消，退款已完成' : '本次行程已结束', NO_DRIVER: Number(trip.value?.order?.refundedAmount || 0) > 0 ? '未匹配到司机，退款已完成' : '可稍后重试呼叫',
} as Record<string, string>)[trip.value?.status] || '行程状态将实时更新');
const counterpartName = computed(() => isDriverView.value ? (trip.value?.passenger?.name || '乘客') : (trip.value?.driverEmployee?.name || trip.value?.driverMember?.name || (trip.value?.status === 'DISPATCHING' ? '正在匹配司机' : '未匹配司机')));
const counterpartHint = computed(() => isDriverView.value ? '乘客信息 · 仅用于当前行程联系' : (trip.value?.vehicle?.plateNumber || (trip.value?.driverMemberId ? '司机暂未确认车辆' : '本行程未分配车辆')));
const canContact = computed(() => isDriverView.value ? Number(trip.value?.driverMemberId) === memberId.value : !!trip.value?.driverMemberId);
const refundText = computed(() => trip.value?.status === 'REFUND_PENDING' ? '退款处理中' : Number(trip.value?.order?.refundedAmount || 0) > 0 ? '退款已完成' : '');

async function load() {
	try { trip.value = await rideApi.detail(id); } catch (error: any) { uni.showToast({ title: error?.message || '行程加载失败', icon: 'none' }); }
}
async function pay(orderId: number) {
	if (!orderId) return;
	try { await rideApi.payOrder(orderId); uni.showToast({ title: '支付成功', icon: 'success' }); setTimeout(load, 800); }
	catch { uni.showToast({ title: '支付未完成', icon: 'none' }); }
}
async function callOtherParty() {
	try { const contact = await rideApi.contact(id); uni.makePhoneCall({ phoneNumber: contact.phone }); }
	catch (error: any) { uni.showToast({ title: error?.message || '暂时无法联系对方', icon: 'none' }); }
}
async function acceptTrip() {
	try { await rideApi.accept(id); uni.showToast({ title: '接单成功', icon: 'success' }); await load(); }
	catch (error: any) { uni.showToast({ title: error?.message || '订单已被接取', icon: 'none' }); }
}
function cancelTrip() {
	uni.showModal({ title: '取消行程', content: '确认取消当前行程？', success: async (result) => { if (result.confirm) { await rideApi.cancel(id, '乘客取消'); await load(); } } });
}
function money(value: unknown) { return Number(value || 0).toFixed(2); }

onLoad((query: any) => {
	id = Number(query?.id || 0);
	isDriverView.value = query?.driver === '1';
	load();
	stopRealtime = onRideRealtime(() => load());
	poll = setInterval(load, 8000);
});
onBeforeUnmount(() => { stopRealtime?.(); if (poll) clearInterval(poll); });
</script>

<style scoped>
.page{height:100vh;position:relative;overflow:hidden;background:#e2e8f0}.map{height:100%}.drawer{position:absolute;z-index:20;right:20rpx;bottom:calc(24rpx + env(safe-area-inset-bottom));left:20rpx;padding:24rpx;border:1rpx solid rgba(255,255,255,.8);border-radius:34rpx;background:rgba(255,255,255,.97);box-shadow:0 18rpx 52rpx rgba(15,23,42,.2)}
.status-line{display:flex;align-items:center;gap:16rpx;margin-bottom:18rpx}.status-line view:last-child{min-width:0}.status-line strong,.status-line text{display:block}.status-line strong{color:#0f172a;font-size:30rpx}.status-line text{margin-top:4rpx;color:#64748b;font-size:22rpx}.status-dot{width:18rpx;height:18rpx;border:8rpx solid #dbeafe;border-radius:50%;background:#3580ff}
.route-card{padding:18rpx;border-radius:22rpx;background:#f8fafc}.route-row{display:flex;align-items:center;gap:14rpx;color:#334155;font-size:25rpx}.route-row>text:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.point{display:grid;flex:none;width:40rpx;height:40rpx;place-items:center;border-radius:50%;color:#fff;font-size:20rpx}.origin{background:#22c55e}.destination{background:#f43f5e}.route-link{width:2rpx;height:22rpx;margin:4rpx 0 4rpx 19rpx;background:#cbd5e1}
.driver-card{display:flex;align-items:center;gap:12rpx;margin-top:18rpx;padding:16rpx;border:1rpx solid #dbeafe;border-radius:22rpx;background:#eff6ff}.driver-card image,.passenger-avatar{flex:none;width:66rpx;height:66rpx}.passenger-avatar{display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#2563eb,#818cf8);color:#fff;font-size:26rpx;font-weight:800}.driver-copy{min-width:0;flex:1}.driver-copy strong,.driver-copy text{display:block}.driver-copy strong{color:#0f172a;font-size:27rpx}.driver-copy text{margin-top:4rpx;color:#64748b;font-size:22rpx}.contact{flex:none;margin:0;padding:0 16rpx;border:0;background:#fff;color:#2563eb;font-size:22rpx}
.refund-note{display:flex;align-items:center;justify-content:space-between;margin-top:16rpx;padding:16rpx 18rpx;border-radius:18rpx;background:#fff7ed;color:#9a3412;font-size:22rpx}.refund-note strong{font-size:24rpx}.refund-note text{color:#c2410c}
.fare{display:flex;justify-content:space-between;gap:20rpx;margin-top:18rpx}.fare view{display:flex;align-items:baseline;gap:8rpx;color:#64748b;font-size:22rpx}.fare strong{color:#0f172a;font-size:30rpx}.primary,.cancel{margin-top:16rpx;border-radius:44rpx}.primary{background:#0f172a;color:#fff}.cancel{background:#f8fafc;color:#64748b}.loading{position:absolute;top:45%;right:80rpx;left:80rpx;z-index:20;padding:24rpx;border-radius:24rpx;background:rgba(255,255,255,.92);color:#64748b;text-align:center}
</style>
