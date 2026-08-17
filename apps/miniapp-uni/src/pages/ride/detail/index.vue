<template>
	<view class="page">
		<view class="map"><RideMap v-if="trip" ref="rideMap" :markers="markers" :route-points="routePoints" :fit-padding-px="mapFitPaddingPx" :show-location="canUseLocation" :show-locate-control="false" /></view>
		<RideStatusBar class="top-fit-card" :title="statusText" :subtitle="`${isDriverView ? '司机视角' : '乘客视角'} · ${trip?.order?.no || ''}`" />
		<view v-if="trip" class="drawer-shell">
			<RideLocateControl v-if="canUseLocation" class="drawer-locate" :action="locateOnMap" />
			<view class="drawer">
			<scroll-view scroll-y class="drawer-scroll">
			<view class="drawer-content">
				<view class="status-line"><view class="status-dot" /><view class="status-copy"><strong>{{ statusText }}</strong><text>{{ statusHint }}</text></view><text class="collapse-toggle" @tap="toggleDetail">{{ detailCollapsed ? '展开' : '收起' }}</text></view>
				<transition name="ride-collapse">
				<view v-if="!detailCollapsed" class="collapse-content">
				<view class="route-card"><view class="route-row"><text class="point origin">起</text><text>{{ trip.originAddress }}</text></view><view class="route-link" /><view class="route-row"><text class="point destination">终</text><text>{{ trip.destinationAddress }}</text></view></view>
				<view class="driver-card">
					<image v-if="isDriverView" :src="passengerAvatar" mode="aspectFill" />
					<image v-else :src="vehicleLogo" mode="aspectFit" @error="vehicleLogoFailed = true" />
					<view class="driver-copy"><strong>{{ counterpartName }}</strong><text>{{ counterpartHint }}</text></view>
					<RideContactActions v-if="canContact" :unread="chatUnreadCount" @call="callOtherParty" @message="chat = true" />
				</view>
				<view v-if="fareDetails" class="fare-card">
					<view class="fare-head"><view><text>{{ fareModeText }}</text><strong>¥{{ money(fareDetails.amount) }}</strong></view><view class="fare-trip"><text>{{ distanceText(fareDetails.distanceMeters) }}</text><text>{{ durationText(fareDetails.durationSeconds) }}</text></view></view>
					<view class="fare-breakdown">
						<view><text>起步</text><strong>¥{{ money(fareDetails.baseFare) }}</strong></view>
						<view><text>里程</text><strong>¥{{ money(fareDetails.distanceFare) }}</strong></view>
						<view><text>时长</text><strong>¥{{ money(fareDetails.durationFare) }}</strong></view>
						<view><text>过路费</text><strong>¥{{ money(fareDetails.tollAmount) }}</strong></view>
					</view>
					<transition name="ride-collapse">
					<view v-if="fareExpanded" class="fare-details">
						<view><text>里程计价</text><strong>超出 {{ numberText(fareDetails.chargeableDistanceKm) }}km × ¥{{ money(fareDetails.pricePerKm) }}/km</strong></view>
						<view><text>时长计价</text><strong>超出 {{ numberText(fareDetails.chargeableDurationMinutes) }}分钟 × ¥{{ money(fareDetails.pricePerMinute) }}/分钟</strong></view>
						<view v-if="Number(fareDetails.parkingAmount || 0)"><text>停车费</text><strong>¥{{ money(fareDetails.parkingAmount) }}</strong></view>
						<view v-if="Number(fareDetails.otherAmount || 0)"><text>其他费用</text><strong>¥{{ money(fareDetails.otherAmount) }}</strong></view>
					</view>
					</transition>
					<view class="fare-rule"><text>含 {{ numberText(fareDetails.includedDistanceKm) }}km / {{ numberText(fareDetails.includedDurationMinutes) }}分钟{{ fareDetails.minimumApplied ? ` · 最低消费 ¥${money(fareDetails.minimumFare)}` : '' }}</text><text class="fare-toggle" @tap="fareExpanded = !fareExpanded">{{ fareExpanded ? '收起' : '计价明细' }} {{ fareExpanded ? '⌃' : '⌄' }}</text></view>
				<view class="settlement-grid"><view><text>预付</text><strong>¥{{ money(fareDetails.prepaidAmount) }}</strong></view><view v-if="Number(fareDetails.supplementAmount || 0)"><text>需补款</text><strong class="warn">¥{{ money(fareDetails.supplementAmount) }}</strong></view><view v-if="Number(fareDetails.refundableAmount || 0)"><text>应退差额</text><strong class="success">¥{{ money(fareDetails.refundableAmount) }}</strong></view><view v-if="Number(fareDetails.refundedAmount || 0)"><text>已退款</text><strong class="success">¥{{ money(fareDetails.refundedAmount) }}</strong></view></view>
			</view>
			<view v-if="refundText" class="refund-note"><strong>{{ refundText }}</strong><text v-if="Number(trip.order?.refundedAmount || 0) > 0">已退 ¥{{ money(trip.order.refundedAmount) }}</text></view>
			<button v-if="isDriverView && trip.status === 'DISPATCHING'" class="primary" @tap="acceptTrip">接取此订单</button><button v-if="!isDriverView && trip.status === 'PREPAY_PENDING'" class="primary" @tap="pay(trip.order.id)">立即支付</button><button v-if="!isDriverView && trip.status === 'SUPPLEMENT_PENDING'" class="primary" @tap="pay(trip.supplementOrderId)">支付补款</button><button v-if="!isDriverView && ['PREPAY_PENDING', 'DISPATCHING'].includes(trip.status)" class="cancel" @tap="cancelTrip">取消行程</button>
			</view>
			</transition>
			</view>
			</scroll-view>
			</view>
		</view>
		<view v-else class="loading">正在加载行程…</view><RideChatSheet v-if="trip" v-model="chat" :ride-id="trip.id" :member-id="memberId" @unread-change="chatUnreadCount = $event" />
	</view>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import RideMap from '../../../components/ride/RideMap.vue';
import RideLocateControl from '../../../components/ride/RideLocateControl.vue';
import RideStatusBar from '../../../components/ride/RideStatusBar.vue';
import RideChatSheet from '../../../components/ride/RideChatSheet.vue';
import RideContactActions from '../../../components/ride/RideContactActions.vue';
import { rideApi } from '../../../services/ride';
import { onRideRealtime } from '../../../services/ride-realtime';
import { formatRidePassengerLabel } from '../../../utils/ride-format';
import { resolveImageUrl } from '../../../utils/url';
import { useRideMapFitPadding } from '../../../utils/ride-map-fit';
import passengerFallback from '../../../static/icons/jtuser.png';
import vehicleLocationIcon from '../../../static/icons/ride-vehicle-location.svg';

const rideMap = ref<InstanceType<typeof RideMap> | null>(null);
const trip = ref<any>(null); const chat = ref(false); const chatUnreadCount = ref(0); const vehicleLogoFailed = ref(false); const fareExpanded = ref(false); const detailCollapsed = ref(true); let id = 0; const isDriverView = ref(false); let stopRealtime: (() => void) | null = null; let poll: ReturnType<typeof setInterval> | undefined;
const memberId = computed(() => Number(uni.getStorageSync('user')?.id || 0));
const fareDetails = computed(() => trip.value?.fareDetails || null);
const routePoints = computed(() => trip.value?.selectedRouteSnapshot?.points || []);
const driverLocationStatuses = new Set(['ACCEPTED', 'TO_PICKUP', 'ARRIVED_PICKUP', 'IN_TRIP', 'ARRIVED_DESTINATION', 'FARE_PENDING', 'SUPPLEMENT_PENDING']);
const endedStatuses = new Set(['REFUND_PENDING', 'COMPLETED', 'CANCELLED', 'NO_DRIVER']);
const canUseLocation = computed(() => !!trip.value && !endedStatuses.has(String(trip.value.status)));
const { paddingPx: mapFitPaddingPx, refresh: refreshMapFit } = useRideMapFitPadding({
	topSelector: '.top-fit-card',
	bottomSelector: '.drawer',
	topFallbackRpx: 150,
	bottomFallbackRpx: 520,
});
const markers = computed(() => { if (!trip.value) return []; const current = trip.value; const list: any[] = [{ id: 1, longitude: Number(current.originLongitude), latitude: Number(current.originLatitude), title: '起点', kind: 'origin' }, { id: 2, longitude: Number(current.destinationLongitude), latitude: Number(current.destinationLatitude), title: '终点', kind: 'destination' }]; const location = driverLocationStatuses.has(current.status) ? current.locations?.[0] : null; if (location) list.push({ id: 3, longitude: Number(location.longitude), latitude: Number(location.latitude), title: '司机位置', kind: 'driver-current' }); return list; });
const refundCompleted = computed(() => { const paid = Number(trip.value?.order?.payAmount || 0); const target = trip.value?.finalAmount == null ? paid : Math.max(0, paid - Number(trip.value.finalAmount || 0)); return target > 0 && Number(trip.value?.order?.refundedAmount || 0) + 0.000001 >= target; });
const statusText = computed(() => { if (trip.value?.status === 'REFUND_PENDING' && refundCompleted.value) return trip.value?.finalAmount == null ? '退款已完成' : '行程已完成'; return ({ PREPAY_PENDING: '等待预付', DISPATCHING: isDriverView.value ? '待接取行程' : '等待司机接单', TO_PICKUP: isDriverView.value ? '前往乘客上车点' : '司机正在赶来', ARRIVED_PICKUP: isDriverView.value ? '等待乘客验证' : '司机已到达', IN_TRIP: '行程进行中', ARRIVED_DESTINATION: '已到目的地', FARE_PENDING: '正在结算', SUPPLEMENT_PENDING: '等待补款', REFUND_PENDING: '退款处理中', COMPLETED: '行程已完成', CANCELLED: '行程已取消', NO_DRIVER: '暂无司机' } as Record<string, string>)[trip.value?.status] || '行程详情'; });
const statusHint = computed(() => { if (trip.value?.status === 'REFUND_PENDING' && refundCompleted.value) return trip.value?.finalAmount == null ? '本次行程退款已按原渠道完成' : '最终费用已结算，预付差额已退回'; return ({ PREPAY_PENDING: '完成预付后开始派单', DISPATCHING: isDriverView.value ? '可查看乘客与路线信息后接单' : '正在通知附近空闲司机', TO_PICKUP: isDriverView.value ? '请按导航前往上车点' : '请留意司机实时位置', ARRIVED_PICKUP: isDriverView.value ? '请核验乘客手机号后四位' : '请与司机确认后上车', IN_TRIP: '费用与司机端计价器实时同步', ARRIVED_DESTINATION: '司机正在确认最终费用', FARE_PENDING: '费用确认后将完成行程', SUPPLEMENT_PENDING: '请完成差额支付', REFUND_PENDING: '退款已提交，将按原支付渠道退回', COMPLETED: '感谢使用内部用车服务', CANCELLED: Number(trip.value?.order?.refundedAmount || 0) > 0 ? '本次行程已取消，退款已完成' : '本次行程已结束', NO_DRIVER: Number(trip.value?.order?.refundedAmount || 0) > 0 ? '未匹配到司机，退款已完成' : '可稍后重试呼叫' } as Record<string, string>)[trip.value?.status] || '行程状态将实时更新'; });
const passengerAvatar = computed(() => resolveImageUrl(trip.value?.passenger?.avatarUrl) || passengerFallback);
const passengerLabel = computed(() => formatRidePassengerLabel(trip.value?.passenger?.phoneLastFour));
const vehicleLogo = computed(() => !vehicleLogoFailed.value ? (resolveImageUrl(trip.value?.vehicle?.brandImage) || vehicleLocationIcon) : vehicleLocationIcon);
const vehicleDescription = computed(() => [trip.value?.vehicle?.brand, trip.value?.vehicle?.series].map((value) => String(value || '').trim()).filter((value) => value && value !== '-').join(' '));
const counterpartName = computed(() => isDriverView.value ? passengerLabel.value : (trip.value?.driverEmployee?.name || trip.value?.driverMember?.name || (trip.value?.status === 'DISPATCHING' ? '正在匹配司机' : '未匹配司机')));
const counterpartHint = computed(() => { if (isDriverView.value) return '乘客信息 · 仅用于当前行程联系'; const plate = trip.value?.vehicle?.plateNumber || (trip.value?.driverMemberId ? '司机暂未确认车辆' : '本行程未分配车辆'); return vehicleDescription.value ? `${plate} · ${vehicleDescription.value}` : plate; });
const canContact = computed(() => isDriverView.value ? Number(trip.value?.driverMemberId) === memberId.value : !!trip.value?.driverMemberId);
const refundText = computed(() => trip.value?.status === 'REFUND_PENDING' ? (refundCompleted.value ? '退款已完成' : '退款处理中') : Number(trip.value?.order?.refundedAmount || 0) > 0 ? '退款已完成' : '');
const fareModeText = computed(() => ({ ESTIMATED: '预估费用', LIVE: '实时费用', FINAL: '最终费用' } as any)[fareDetails.value?.mode] || '计价费用');

async function load() {
	try {
		const previousStatus = trip.value?.status;
		const nextTrip = await rideApi.detail(id);
		if (!previousStatus || previousStatus !== nextTrip?.status) detailCollapsed.value = !(isDriverView.value && nextTrip?.status === 'IN_TRIP');
		trip.value = nextTrip;
		vehicleLogoFailed.value = false;
	} catch (error: any) { uni.showToast({ title: error?.message || '行程加载失败', icon: 'none' }); }
}
async function pay(orderId: number) { if (!orderId) return; try { await rideApi.payOrder(orderId); uni.showToast({ title: '支付成功', icon: 'success' }); setTimeout(load, 800); } catch { uni.showToast({ title: '支付未完成', icon: 'none' }); } }
async function callOtherParty() { try { const contact = await rideApi.contact(id); uni.makePhoneCall({ phoneNumber: contact.phone }); } catch (error: any) { uni.showToast({ title: error?.message || '暂时无法联系对方', icon: 'none' }); } }
async function acceptTrip() { try { await rideApi.accept(id); uni.showToast({ title: '接单成功', icon: 'success' }); await load(); } catch (error: any) { uni.showToast({ title: error?.message || '订单已被接取', icon: 'none' }); } }
function cancelTrip() { uni.showModal({ title: '取消行程', content: '确认取消当前行程？', success: async (result) => { if (result.confirm) { await rideApi.cancel(id, '乘客取消'); await load(); } } }); }
function handleRealtime(event: any) { if (String(event?.type || '').startsWith('ride:message')) return; if (event?.type === 'ride:meter' && Number(event?.data?.rideTripId) === id && trip.value) { trip.value.fareDetails = { ...(trip.value.fareDetails || {}), ...(event.data.meter || {}), mode: 'LIVE' }; return; } void load(); }
function money(value: unknown) { return Number(value || 0).toFixed(2); }
function numberText(value: unknown) { return Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0); }
function distanceText(value: unknown) { const meters = Number(value || 0); return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`; }
function durationText(value: unknown) { return `${Math.max(0, Math.ceil(Number(value || 0) / 60))}分钟`; }
function locateOnMap() { if (canUseLocation.value) return rideMap.value?.locateCurrent(); }
function toggleDetail() { detailCollapsed.value = !detailCollapsed.value; refreshMapFit(); }
watch(() => [detailCollapsed.value, fareExpanded.value, trip.value?.status, fareDetails.value?.amount], refreshMapFit, { flush: 'post' });
onLoad((query: any) => { id = Number(query?.id || 0); isDriverView.value = query?.driver === '1'; void load(); stopRealtime = onRideRealtime(handleRealtime); poll = setInterval(load, 8000); });
onBeforeUnmount(() => { stopRealtime?.(); if (poll) clearInterval(poll); });
</script>

<style scoped>
.page{height:100vh;position:relative;overflow:hidden;background:#e2e8f0}.map{height:100%}.drawer-shell{position:absolute;z-index:20;right:20rpx;bottom:calc(24rpx + env(safe-area-inset-bottom));left:20rpx}.drawer-locate{position:absolute;z-index:2;top:-106rpx;right:4rpx}.drawer{position:relative;max-height:70vh;border:1rpx solid rgba(255,255,255,.8);border-radius:34rpx;background:rgba(255,255,255,.97);box-shadow:0 18rpx 52rpx rgba(15,23,42,.2);box-sizing:border-box}.drawer-content{min-width:0;padding:24rpx;box-sizing:border-box}.status-line{display:flex;align-items:center;gap:16rpx;margin-bottom:18rpx}.status-line view:last-child{min-width:0}.status-line strong,.status-line text{display:block}.status-line strong{color:#0f172a;font-size:30rpx}.status-line text{margin-top:4rpx;color:#64748b;font-size:22rpx}.status-dot{width:18rpx;height:18rpx;border:8rpx solid #dbeafe;border-radius:50%;background:#3580ff}.route-card{padding:18rpx;border-radius:22rpx;background:#f8fafc}.route-row{display:flex;align-items:center;gap:14rpx;color:#334155;font-size:25rpx}.route-row>text:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.point{display:grid;flex:none;width:40rpx;height:40rpx;place-items:center;border-radius:50%;color:#fff;font-size:20rpx}.origin{background:#22c55e}.destination{background:#f43f5e}.route-link{width:2rpx;height:22rpx;margin:4rpx 0 4rpx 19rpx;background:#cbd5e1}.driver-card{display:flex;align-items:center;gap:12rpx;margin-top:18rpx;padding:16rpx;border:1rpx solid #dbeafe;border-radius:22rpx;background:#eff6ff}.driver-card image{width:66rpx;height:66rpx;flex:none;border-radius:16rpx;background:#fff}.driver-copy{min-width:0;flex:1}.driver-copy strong,.driver-copy text{display:block}.driver-copy strong{color:#0f172a;font-size:27rpx}.driver-copy text{margin-top:4rpx;overflow:hidden;color:#64748b;font-size:22rpx;text-overflow:ellipsis;white-space:nowrap}.fare-card{width:100%;max-width:100%;min-width:0;margin-top:18rpx;padding:18rpx;border-radius:24rpx;border:1rpx solid #dbe7f4;background:linear-gradient(145deg,#fff,#f5f9ff);box-shadow:0 10rpx 26rpx rgba(37,99,235,.1);color:#0f172a;box-sizing:border-box;overflow:hidden}.fare-head,.settlement-grid,.fare-rule{display:flex;align-items:center;justify-content:space-between}.fare-head{gap:12rpx}.fare-head>view:first-child{min-width:0}.fare-head>view:first-child text,.fare-head>view:first-child strong{display:block}.fare-head>view:first-child text{color:#64748b;font-size:19rpx}.fare-head>view:first-child strong{margin-top:2rpx;color:#0f172a;font-size:40rpx;line-height:1.12}.fare-trip{display:flex;flex:none;flex-direction:column;align-items:flex-end;gap:5rpx}.fare-trip text{max-width:150rpx;padding:7rpx 10rpx;border-radius:999rpx;background:#eff6ff;color:#2563eb;font-size:17rpx;white-space:nowrap}.fare-breakdown{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8rpx;margin-top:14rpx}.fare-breakdown>view{min-width:0;padding:10rpx 8rpx;border-radius:14rpx;background:#f8fafc;text-align:left}.fare-breakdown text,.fare-breakdown strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fare-breakdown text{color:#64748b;font-size:16rpx}.fare-breakdown strong{margin-top:3rpx;color:#0f172a;font-size:20rpx}.fare-details{display:grid;grid-template-columns:minmax(0,1fr);gap:8rpx;margin-top:10rpx;padding:12rpx 14rpx;border-radius:15rpx;background:#f8fafc}.fare-details>view{display:grid;grid-template-columns:116rpx minmax(0,1fr);align-items:start;gap:10rpx;min-width:0;padding:8rpx 0;border-bottom:1rpx solid #e8eef6}.fare-details>view:last-child{border-bottom:0}.fare-details text{min-width:0;color:#64748b;font-size:16rpx;line-height:1.45}.fare-details strong{min-width:0;color:#334155;font-size:16rpx;font-weight:600;line-height:1.45;text-align:left;overflow-wrap:anywhere;word-break:break-word}.fare-rule{gap:12rpx;margin-top:12rpx;color:#64748b;font-size:16rpx}.fare-rule>text:first-child{min-width:0;line-height:1.45}.fare-toggle{flex:none;color:#2563eb;font-weight:700;white-space:nowrap}.settlement-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8rpx;margin-top:12rpx;padding-top:12rpx;border-top:1rpx solid #e2e8f0}.settlement-grid>view{min-width:0;padding:8rpx 10rpx;border-radius:12rpx;background:#f8fafc;box-sizing:border-box}.settlement-grid text,.settlement-grid strong{display:block}.settlement-grid text{color:#64748b;font-size:16rpx}.settlement-grid strong{margin-top:2rpx;color:#0f172a;font-size:20rpx}.settlement-grid .warn{color:#d97706}.settlement-grid .success{color:#059669}.refund-note{display:flex;align-items:center;justify-content:space-between;margin-top:16rpx;padding:16rpx 18rpx;border-radius:18rpx;background:#fff7ed;color:#9a3412;font-size:22rpx}.refund-note strong{font-size:24rpx}.refund-note text{color:#c2410c}.primary,.cancel{margin-top:16rpx;border:0;border-radius:44rpx}.primary{background:#0f172a;color:#fff}.cancel{background:#f8fafc;color:#64748b}.loading{position:absolute;top:45%;right:80rpx;left:80rpx;z-index:20;padding:24rpx;border-radius:24rpx;background:rgba(255,255,255,.92);color:#64748b;text-align:center}button::after{border:0}.collapse-content{min-width:0}.ride-collapse-enter-active,.ride-collapse-leave-active{overflow:hidden;transition:max-height .32s ease,opacity .22s ease,transform .32s ease}.ride-collapse-enter-from,.ride-collapse-leave-to{max-height:0;opacity:0;transform:translateY(-8rpx)}.ride-collapse-enter-to,.ride-collapse-leave-from{max-height:2400rpx;opacity:1;transform:translateY(0)}

.status-copy{min-width:0;flex:1}.collapse-toggle{flex:none;padding:8rpx 4rpx;color:#2563eb;font-size:21rpx;font-weight:700}.route-row>text:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.point{width:30rpx;height:30rpx;font-size:17rpx}.route-link{margin-left:15rpx}.fare-card{max-width:100%;border:1rpx solid #dbe7f4;background:linear-gradient(145deg,#fff,#f5f9ff);box-shadow:0 10rpx 26rpx rgba(37,99,235,.1);color:#0f172a}.fare-head{gap:12rpx}.fare-head>view:first-child strong{color:#0f172a;font-size:40rpx}.fare-head>view:first-child text{color:#64748b}.fare-trip{flex-direction:column;align-items:flex-end;gap:5rpx}.fare-trip text{max-width:150rpx;background:#eff6ff;color:#2563eb}.fare-breakdown{grid-template-columns:repeat(2,minmax(0,1fr));gap:8rpx}.fare-breakdown>view{padding:10rpx 8rpx;background:#f8fafc;text-align:left}.fare-breakdown text{color:#64748b}.fare-breakdown strong{color:#0f172a}.fare-details{background:#f8fafc}.fare-details text{color:#64748b}.fare-details strong{color:#334155}.fare-rule{color:#64748b}.fare-toggle{color:#2563eb}.settlement-grid{gap:8rpx;border-top-color:#e2e8f0}.settlement-grid>view{background:#f8fafc}.settlement-grid text{color:#64748b}.settlement-grid strong{color:#0f172a}.settlement-grid .warn{color:#d97706}.settlement-grid .success{color:#059669}
.drawer{width:auto;max-width:none;overflow:hidden}
.drawer-scroll{display:block;width:auto;max-width:none;max-height:70vh;box-sizing:border-box}
.drawer-content,.collapse-content{width:auto;max-width:none;overflow-x:hidden;box-sizing:border-box}
.fare-card{width:auto;max-width:none}
</style>
