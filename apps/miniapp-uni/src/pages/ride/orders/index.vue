<template>
	<view class="page">
		<RidePageHeader :title="driver ? '司机行程订单' : '我的行程订单'" subtitle="每一段路程，都有清晰记录">
			<view class="refresh" @tap="load">刷新</view>
		</RidePageHeader>
		<view class="summary">
			<view><text class="summary-label">全部行程</text><text class="summary-value">{{ items.length }}</text></view>
			<view class="summary-art"><text>内部用车</text><text>安全 · 清晰 · 可追溯</text></view>
		</view>
		<scroll-view class="filters" scroll-x :show-scrollbar="false">
			<view class="filter-row">
				<view v-for="item in filters" :key="item.value" class="filter" :class="{ active: filter === item.value }" @tap="filter = item.value">{{ item.label }}</view>
			</view>
		</scroll-view>
		<view class="list">
			<view v-for="item in visibleItems" :key="item.id" class="trip-card" @tap="open(item.id)">
				<view class="card-head">
					<view class="status" :class="statusTone(item.status)"><text class="status-dot" />{{ statusText(item) }}</view>
					<text class="time">{{ formatTime(item.createdAt) }}</text>
				</view>
				<view class="route">
					<view class="route-line"><text class="route-dot start" /><text class="address">{{ item.originAddress }}</text></view>
					<view class="route-track" />
					<view class="route-line"><text class="route-dot end" /><text class="address">{{ item.destinationAddress }}</text></view>
				</view>
				<view class="card-foot">
					<view class="driver"><image :src="vehicleLocationIcon" mode="aspectFit" /><text>{{ counterpartText(item) }}</text></view>
					<view class="amount"><text>行程金额</text><strong>¥{{ money(item.finalAmount ?? item.estimatedAmount) }}</strong><text class="chevron">›</text></view>
				</view>
			</view>
			<view v-if="!loading && !visibleItems.length" class="empty"><image :src="vehicleLocationIcon" mode="aspectFit" /><strong>暂无相关行程</strong><text>{{ filter === 'all' ? '完成首次呼叫后，记录会出现在这里' : '换个状态看看其他行程' }}</text></view>
			<view v-if="loading" class="loading">正在加载行程…</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import RidePageHeader from '../../../components/ride/RidePageHeader.vue';
import { rideApi } from '../../../services/ride';
import vehicleLocationIcon from '../../../static/icons/ride-vehicle-location.svg';

type FilterValue = 'all' | 'active' | 'completed' | 'cancelled';
const filters: Array<{ label: string; value: FilterValue }> = [
	{ label: '全部', value: 'all' }, { label: '进行中', value: 'active' }, { label: '已完成', value: 'completed' }, { label: '已取消', value: 'cancelled' },
];
const activeStatuses = ['PREPAY_PENDING','DISPATCHING','TO_PICKUP','ARRIVED_PICKUP','IN_TRIP','ARRIVED_DESTINATION','FARE_PENDING','SUPPLEMENT_PENDING'];
const driver = ref(false);
const items = ref<any[]>([]);
const filter = ref<FilterValue>('all');
const loading = ref(false);
const visibleItems = computed(() => items.value.filter((item) => {
	if (filter.value === 'active') return activeStatuses.includes(item.status);
	if (filter.value === 'completed') return item.status === 'COMPLETED';
	if (filter.value === 'cancelled') return ['REFUND_PENDING','CANCELLED','NO_DRIVER'].includes(item.status);
	return true;
}));

async function load(){
	if (loading.value) return;
	loading.value = true;
	try {
		const data = driver.value ? await rideApi.driverOrders({ page:1, pageSize:50 }) : await rideApi.list({ page:1, pageSize:50 });
		items.value = data?.items || [];
	} catch (error:any) { uni.showToast({ title:error?.message || '行程加载失败', icon:'none' }); }
	finally { loading.value=false; uni.stopPullDownRefresh(); }
}
function open(id:number){uni.navigateTo({url:`/pages/ride/detail/index?id=${id}${driver.value?'&driver=1':''}`})}
function formatTime(value:string){if(!value)return '-';const date=new Date(value);return `${date.getMonth()+1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`}
function money(value:any){return Number(value||0).toFixed(2)}
function refundCompleted(item:any){const paid=Number(item?.order?.payAmount||0);const target=item?.finalAmount==null?paid:Math.max(0,paid-Number(item.finalAmount||0));return target>0&&Number(item?.order?.refundedAmount||0)+0.000001>=target}
function statusText(item:any){const value=item?.status;if(value==='REFUND_PENDING'&&refundCompleted(item))return item?.finalAmount==null?'已退款':'已完成（差额已退）';if(value==='CANCELLED'&&Number(item?.order?.refundedAmount||0)>0)return'已取消（已退款）';if(value==='NO_DRIVER'&&Number(item?.order?.refundedAmount||0)>0)return'无司机（已退款）';return({PREPAY_PENDING:'待预付',DISPATCHING:'等待司机接单',TO_PICKUP:'司机前往上车点',ARRIVED_PICKUP:'司机已到达',IN_TRIP:'行程中',ARRIVED_DESTINATION:'已到目的地',FARE_PENDING:'费用确认',SUPPLEMENT_PENDING:'待补款',REFUND_PENDING:'退款处理中',COMPLETED:'已完成',CANCELLED:'已取消',NO_DRIVER:'暂无司机'}as any)[value]||value}
function statusTone(value:string){return activeStatuses.includes(value)?'active':value==='COMPLETED'?'done':'muted'}
function counterpartText(item:any){if(driver.value)return`乘客${item.passenger?.phoneLastFour||''}`;return item.driverEmployee?.name||item.driverMember?.name||(item.status==='DISPATCHING'?'正在匹配司机':'未匹配司机')}
onLoad((query:any)=>{driver.value=query?.driver==='1'});
onShow(load);
onPullDownRefresh(load);
</script>

<style scoped>
.page{min-height:100vh;padding-bottom:calc(env(safe-area-inset-bottom) + 32rpx);background:linear-gradient(180deg,#eaf5ff 0,#fff1f7 340rpx,#f8fafc 700rpx);box-sizing:border-box}.refresh{padding:12rpx 18rpx;border-radius:999rpx;background:rgba(255,255,255,.88);color:#2563eb;font-size:23rpx}.summary{display:flex;align-items:center;justify-content:space-between;margin:0 24rpx 22rpx;padding:28rpx;border:1rpx solid rgba(255,255,255,.82);border-radius:32rpx;background:linear-gradient(135deg,rgba(53,128,255,.95),rgba(129,140,248,.9));box-shadow:0 16rpx 38rpx rgba(53,128,255,.2);color:#fff}.summary-label,.summary-value,.summary-art text{display:block}.summary-label{font-size:23rpx;opacity:.84}.summary-value{margin-top:4rpx;font-size:52rpx;font-weight:850}.summary-art{text-align:right}.summary-art text:first-child{font-size:28rpx;font-weight:800}.summary-art text:last-child{margin-top:6rpx;font-size:20rpx;opacity:.8}.filters{width:100%;white-space:nowrap}.filter-row{display:inline-flex;gap:12rpx;padding:0 24rpx 20rpx}.filter{padding:14rpx 28rpx;border:1rpx solid #e2e8f0;border-radius:999rpx;background:rgba(255,255,255,.82);color:#64748b;font-size:24rpx}.filter.active{border-color:#3580ff;background:#3580ff;color:#fff;box-shadow:0 8rpx 20rpx rgba(53,128,255,.2)}.list{padding:0 24rpx}.trip-card{margin-bottom:20rpx;padding:24rpx;border:1rpx solid rgba(226,232,240,.9);border-radius:28rpx;background:rgba(255,255,255,.96);box-shadow:0 10rpx 30rpx rgba(15,23,42,.07)}.card-head,.card-foot,.driver,.amount{display:flex;align-items:center}.card-head,.card-foot{justify-content:space-between}.status{display:flex;align-items:center;gap:8rpx;padding:9rpx 15rpx;border-radius:999rpx;font-size:22rpx;font-weight:700}.status-dot{width:12rpx;height:12rpx;border-radius:50%;background:currentColor}.status.active{background:#eff6ff;color:#2563eb}.status.done{background:#ecfdf5;color:#059669}.status.muted{background:#f1f5f9;color:#64748b}.time{color:#94a3b8;font-size:21rpx}.route{padding:24rpx 0}.route-line{display:flex;align-items:center;gap:16rpx}.route-dot{width:18rpx;height:18rpx;flex:none;border:5rpx solid #fff;border-radius:50%;box-shadow:0 0 0 2rpx currentColor}.route-dot.start{color:#3580ff;background:#3580ff}.route-dot.end{color:#fb7185;background:#fb7185}.route-track{width:2rpx;height:28rpx;margin:4rpx 0 4rpx 8rpx;background:linear-gradient(#93c5fd,#fda4af)}.address{overflow:hidden;color:#1e293b;font-size:26rpx;text-overflow:ellipsis;white-space:nowrap}.card-foot{padding-top:18rpx;border-top:1rpx solid #f1f5f9}.driver{min-width:0;gap:9rpx;color:#64748b;font-size:22rpx}.driver image{width:34rpx;height:34rpx}.driver text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.amount{gap:8rpx}.amount>text{color:#94a3b8;font-size:20rpx}.amount strong{color:#0f172a;font-size:28rpx}.amount .chevron{color:#3580ff;font-size:38rpx}.empty{display:flex;flex-direction:column;align-items:center;padding:100rpx 24rpx;color:#94a3b8}.empty image{width:110rpx;height:110rpx;opacity:.5}.empty strong{margin-top:18rpx;color:#475569;font-size:28rpx}.empty text{margin-top:8rpx;font-size:22rpx}.loading{text-align:center;padding:80rpx;color:#94a3b8;font-size:23rpx}
.route-dot.start{color:#16a34a;background:#16a34a}.route-dot.end{color:#ef4444;background:#ef4444}.route-track{background:linear-gradient(#86efac,#fca5a5)}
</style>
