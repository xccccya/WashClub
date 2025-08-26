<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />

		<!-- 顶部主分类：全部订单 / 商品订单 / 服务订单 -->
		<view class="tabs">
			<view class="tab" :class="{ active: mainTab==='all' }" @tap="setMain('all')">全部订单</view>
			<view class="tab" :class="{ active: mainTab==='product' }" @tap="setMain('product')">商品订单</view>
			<view class="tab" :class="{ active: mainTab==='service' }" @tap="setMain('service')">服务订单</view>
		</view>

		<!-- 二级筛选：根据主分类动态变化，仅展示UI -->
		<scroll-view scroll-x class="filters" show-scrollbar="false">
			<view class="filter-chip" v-for="f in currentFilters" :key="f" :class="{ active: f===activeFilter }" @tap="activeFilter=f">{{ f }}</view>
		</scroll-view>

		<!-- 订单列表（已接入 API） -->
		<view v-if="!loading && orders.length===0" class="empty">暂无订单</view>
		<view v-for="o in orders" :key="o.id" class="card order-card">
			<image class="thumb" :src="firstItem(o)?.imageUrl || '/static/icons/warning.png'" mode="aspectFit" />
			<view class="order-body">
				<view class="title">{{ firstItem(o)?.name || '订单' }}</view>
				<view class="tags-row">
					<text class="tag" v-if="o.type==='SERVICE'">服务订单</text>
					<text class="tag" v-else>商品订单</text>
					<text class="tag" v-if="o.no">{{ o.no }}</text>
				</view>
				<view class="meta-row">
					<text class="status">{{ displayStatus(o) }}</text>
					<view class="price-qty">
						<text class="price">¥{{ formatPrice(firstItem(o)?.price) }}</text>
						<text class="qty">x{{ firstItem(o)?.quantity || 1 }}</text>
					</view>
				</view>
				<view class="actions">
					<text class="more">{{ formatTime(o.createdAt) }}</text>
					<view class="btn" @tap="() => viewOrder(o)">查看订单</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { createHttp, checkAuthAndRefresh } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';

const { topSpacerHeight } = useSafeArea();

type MainTab = 'all' | 'product' | 'service';
const mainTab = ref<MainTab>('all');

const filterMap: Record<MainTab, string[]> = {
	all: ['全部','待支付','待发货','待收货','待服务','退款/售后','评价'],
	product: ['全部','待支付','待发货','待收货','退款/售后','评价'],
	service: ['全部','待支付','待服务','退款/售后','评价']
};

const activeFilter = ref<string>('全部');
const currentFilters = computed(() => filterMap[mainTab.value]);

function setMain(tab: MainTab){
	mainTab.value = tab;
	activeFilter.value = '全部';
	fetchOrders();
}

type OrderItem = { id: number; name: string; imageUrl?: string|null; price: number; quantity: number; specsText?: string|null };
type Order = { id: number; no: string; type: 'SERVICE'|'SP'|'FK'; status: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED'; payStatus: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED'; createdAt: string; items: OrderItem[] };

const orders = ref<Order[]>([]);
const loading = ref(false);

function navigate(url: string){
	// #ifdef H5
	if (typeof window !== 'undefined') { window.location.hash = url.startsWith('/') ? `#${url}` : `#/${url}`; return; }
	// #endif
	uni.navigateTo({ url });
}

function firstItem(o?: Order | null){ return (o?.items||[])[0] || null; }
function formatPrice(p: any){ const n = Number(p); return isNaN(n) ? p : n.toFixed(2); }
function formatTime(t: any){ try { const d = new Date(t); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; } catch { return ''; } }
function displayStatus(o: Order){
	if (o.payStatus==='UNPAID') return '待支付';
	if (o.payStatus==='REFUNDED') return '已退款';
	if (o.status==='PAID') return o.type==='SERVICE' ? '待服务' : '待发货';
	if (o.status==='FULFILLED') return o.type==='SERVICE' ? '已完成' : '待收货';
	if (o.status==='CANCELLED' || o.payStatus==='CANCELLED') return '已取消';
	return '处理中';
}

function buildQuery(){
	const q: any = {};
	if (mainTab.value==='product') q.type = 'SP';
	else if (mainTab.value==='service') q.type = 'SERVICE';
	// 二级筛选
	if (activeFilter.value==='待支付') q.payStatus = 'UNPAID';
	if (activeFilter.value==='退款/售后') q.payStatus = 'REFUNDED';
	if (mainTab.value==='service' && activeFilter.value==='待服务') q.status = 'PAID';
	if (mainTab.value==='product' && activeFilter.value==='待发货') q.status = 'PAID';
	if (mainTab.value==='product' && activeFilter.value==='待收货') q.status = 'FULFILLED';
	return q;
}

async function fetchOrders(){
	loading.value = true;
	try {
		const authed = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!authed) { orders.value = []; return; }
		const http = createHttp();
		let profile: any = null; try { profile = await http('/member/me/profile', { method:'GET' }); } catch {}
		const memberId = profile?.id;
		const q = buildQuery();
		if (memberId) q.memberId = memberId;
		const list = await http<Order[]>('/orders', { method:'GET', query: q });
		orders.value = Array.isArray(list) ? list : [];
	} finally { loading.value = false; }
}

function viewOrder(o: Order){ navigate(`/pages/order/detail?id=${o.id}`); }

onShow(async()=>{ await fetchOrders(); });
</script>

<style>
.page {
	min-height: 100vh;
	padding: 24rpx 24rpx 0 24rpx;
	background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%);
	box-sizing: border-box;
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
}

.card { background: #ffffff; border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom: 24rpx; }

.tabs { display:flex; align-items:center; justify-content: space-around; background:#ffffff; border-radius: 20rpx; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.04); margin-bottom: 12rpx; }
.tab { flex:1; text-align:center; padding: 20rpx 0; font-size: 26rpx; color:#6b7280; position: relative; }
.tab.active { color:#111827; font-weight: 700; }
.tab.active::after { content:''; position:absolute; left: 25%; right: 25%; bottom: 0; height: 6rpx; background: linear-gradient(90deg, #a8d8ff, #ffc9de); border-radius: 999rpx; }

.filters { white-space: nowrap; margin: 16rpx 0 8rpx 0; }
.filter-chip { display:inline-flex; align-items:center; padding: 12rpx 20rpx; margin-right: 16rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx dashed #e5e7eb; color:#374151; font-size: 24rpx; }
.filter-chip.active { border-color: #77bfff; background:#f7fbff; }

.section-time { margin: 12rpx 0; color:#6b7280; font-size: 22rpx; }

.order-card { display:flex; gap: 16rpx; background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.thumb { width: 120rpx; height: 120rpx; border-radius: 16rpx; background:#ffffff; border: 2rpx solid #e5e7eb; }
.order-body { flex:1; display:flex; flex-direction: column; gap: 8rpx; min-width: 0; }
.title { font-size: 28rpx; font-weight: 600; color:#1f2937; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.tags-row { display:flex; flex-wrap: wrap; gap: 10rpx; }
.tag { font-size: 22rpx; color:#374151; background:#ffffff; border: 2rpx dashed #e5e7eb; padding: 4rpx 8rpx; border-radius: 999rpx; }
.meta-row { display:flex; align-items:center; justify-content: space-between; margin-top: 4rpx; }
.status { font-size: 24rpx; color:#6b7280; }
.price-qty { display:flex; align-items: baseline; gap: 8rpx; }
.price { font-size: 30rpx; font-weight: 800; color:#111827; }
.qty { font-size: 24rpx; color:#6b7280; }
.actions { margin-top: 8rpx; display:flex; align-items:center; justify-content: flex-end; gap: 16rpx; }
.more { font-size: 24rpx; color:#6b7280; }
.btn { padding: 10rpx 18rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx solid #ffd6e7; color:#1f2937; font-size: 24rpx; }
.empty { text-align:center; color:#9ca3af; margin-top: 80rpx; }
</style>


