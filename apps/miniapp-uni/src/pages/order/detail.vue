<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 统一返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="header card">
			<view class="row-1">
				<text class="title">订单详情</text>
				<text class="no" v-if="order?.no">#{{ order?.no }}</text>
			</view>
			<view class="row-2">
				<text class="status">{{ displayStatus(order) }}</text>
				<text class="time">{{ formatTime(order?.createdAt) }}</text>
			</view>
		</view>

		<view class="card" v-if="order">
			<view class="sub-title">基本信息</view>
			<view class="kv"><text class="k">订单类型</text><text class="v">{{ order.type==='SERVICE' ? '服务订单' : '商品订单' }}</text></view>
			<view class="kv"><text class="k">支付状态</text><text class="v">{{ order.payStatus==='UNPAID' ? '待支付' : (order.payStatus==='PAID' ? '已支付' : (order.payStatus==='REFUNDED'?'已退款':'已取消')) }}</text></view>
			<view class="kv"><text class="k">订单状态</text><text class="v">{{ zhStatus(order.status, order.type) }}</text></view>
			<view class="kv" v-if="order.vehicle"><text class="k">车辆</text><text class="v">{{ order.vehicle?.plateNumber }}</text></view>
		</view>

		<view class="card" v-if="order">
			<view class="sub-title">商品/服务</view>
			<view class="item" v-for="it in order.items" :key="it.id">
				<image class="thumb" :src="it.imageUrl || '/static/icons/warning.png'" />
				<view class="ibody">
					<view class="name">{{ it.name }}</view>
					<view class="specs" v-if="it.specsText">{{ it.specsText }}</view>
					<view class="meta"><text class="price">¥{{ formatPrice(it.price) }}</text><text class="qty">x{{ it.quantity }}</text></view>
				</view>
			</view>
		</view>

		<view class="card" v-if="order">
			<view class="sub-title">金额汇总</view>
			<view class="kv"><text class="k">商品总额</text><text class="v">¥{{ formatPrice(order.totalAmount) }}</text></view>
			<view class="kv"><text class="k">优惠</text><text class="v">-¥{{ formatPrice(order.discountAmount) }}</text></view>
			<view class="kv"><text class="k">运费</text><text class="v">¥{{ formatPrice(order.shippingFee) }}</text></view>
			<view class="kv total"><text class="k">应付金额</text><text class="v">¥{{ formatPrice(order.payAmount) }}</text></view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { createHttp } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

type OrderItem = { id: number; name: string; imageUrl?: string|null; price: number|string; quantity: number; specsText?: string|null };
type Vehicle = { plateNumber?: string };
type Order = { id: number; no: string; type: 'SERVICE'|'SP'|'FK'; status: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED'; payStatus: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED'; createdAt: string; items: OrderItem[]; vehicle?: Vehicle|null; totalAmount: number|string; discountAmount: number|string; shippingFee: number|string; payAmount: number|string };

const order = ref<Order|null>(null);

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/index/index' });
	} catch { uni.reLaunch({ url: '/pages/index/index' }); }
}

function formatPrice(p: any){ const n = Number(p); return isNaN(n) ? p : n.toFixed(2); }
function formatTime(t: any){ try { const d = new Date(t); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; } catch { return ''; } }
function zhStatus(s: Order['status'], type: Order['type']){ if (s==='PAID') return type==='SERVICE'?'待服务':'待发货'; if (s==='FULFILLED') return type==='SERVICE'?'已完成':'待收货'; if (s==='CLOSED') return '已关闭'; if (s==='CANCELLED') return '已取消'; return '已创建'; }
function displayStatus(o?: Order|null){ if (!o) return ''; if (o.payStatus==='UNPAID') return '待支付'; if (o.payStatus==='REFUNDED') return '已退款'; if (o.payStatus==='CANCELLED') return '已取消'; return zhStatus(o.status, o.type); }

onLoad(async (query:any)=>{
	try {
		const id = Number(query?.id);
		if (!id) { uni.showToast({ title:'参数错误', icon:'none' }); return; }
		const http = createHttp();
		const data = await http<Order>(`/orders/${id}`, { method:'GET' });
		order.value = data || null;
	} catch { uni.showToast({ title:'加载失败', icon:'none' }); }
});
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: #f8fafc; box-sizing: border-box; }
.card { background:#ffffff; border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }
.header .row-1 { display:flex; align-items:center; justify-content: space-between; }
.title { font-size: 32rpx; font-weight: 700; }
.no { color:#6b7280; font-size: 24rpx; }
.row-2 { margin-top: 8rpx; display:flex; align-items:center; justify-content: space-between; color:#6b7280; }
.sub-title { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.kv { display:flex; align-items:center; justify-content: space-between; padding: 10rpx 0; }
.kv.total .v { color:#111827; font-weight: 800; }
.k { color:#6b7280; }
.v { color:#111827; }
.item { display:flex; gap: 12rpx; padding: 12rpx 0; border-bottom: 2rpx dashed #eef2f7; }
.thumb { width: 120rpx; height: 120rpx; border-radius: 16rpx; background:#f1f5f9; }
.ibody { display:flex; flex-direction: column; gap: 6rpx; flex:1; min-width:0; }
.name { font-size: 28rpx; font-weight: 600; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space: nowrap; }
.specs { font-size: 22rpx; color:#6b7280; }
.meta { display:flex; align-items: baseline; gap: 8rpx; }
.price { font-size: 30rpx; font-weight: 800; color:#111827; }
.qty { font-size: 24rpx; color:#6b7280; }

/* 统一返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>



