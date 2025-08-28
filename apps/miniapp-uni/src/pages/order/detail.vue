<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<!-- 标题，仅保留标题文字 -->
		<view class="title-bar">
			<text class="title">订单详情</text>
		</view>

		<!-- 基本信息 -->
		<view class="card" v-if="order">
			<view class="sub-title">基本信息</view>
			<view class="kv"><text class="k">订单状态</text><text class="v">{{ displayStatus(order) }}</text></view>
			<view class="kv"><text class="k">订单号</text><text class="v">{{ order.no }}</text></view>
			<view class="kv"><text class="k">下单时间</text><text class="v">{{ formatTime(order.createdAt) }}</text></view>
			<view class="kv" v-if="order.remark"><text class="k">备注</text><text class="v">{{ order.remark }}</text></view>
		</view>

		<!-- 服务车辆横幅（独立风格，无标题） -->
		<view :class="['vehicle-banner', gradientClass]" v-if="order && order.type==='SERVICE'">
			<view class="vehicle-tag">服务车辆</view>
			<view class="vehicle-banner-body">
				<image class="vehicle-logo" :src="vehicleBrandIcon(order.vehicle)" mode="aspectFit" />
				<view class="vehicle-info">
					<text class="vehicle-line1">{{ vehicleBrandSeries(order.vehicle) }}</text>
					<text class="vehicle-line2">{{ order.vehicle?.plateNumber || '-' }}</text>
				</view>
			</view>
		</view>

		<!-- 商品/服务 -->
		<view class="card" v-if="order">
			<view class="sub-title">商品/服务</view>
			<view class="item" v-for="it in order.items" :key="it.id">
				<image class="thumb" :src="resolveImageUrl(it.imageUrl) || '/static/icons/warning.png'" />
				<view class="ibody">
					<view class="name">{{ it.name }}</view>
					<view class="specs" v-if="displaySpecs(it)">{{ displaySpecs(it) }}</view>
					<view class="meta"><text class="price">¥{{ formatPrice(it.price) }}</text><text class="qty">x{{ it.quantity }}</text></view>
				</view>
			</view>
		</view>

		<!-- 支付信息 -->
		<view class="card" v-if="order">
			<view class="sub-title">支付信息</view>
			<view class="kv"><text class="k">支付方式</text><text class="v">{{ displayPayMethod(order.payMethod) }}</text></view>
			<view class="kv"><text class="k">支付时间</text><text class="v">{{ order.paidAt ? formatTime(order.paidAt) : '-' }}</text></view>
		</view>

		<!-- 收货地址横幅（商品订单显示，独立风格） -->
		<view :class="['address-banner', addressGradientClass]" v-if="order && order.type==='SP'">
			<view class="address-tag">收货地址</view>
			<view class="address-banner-body">
				<view class="address-info">
					<text class="address-line1">{{ addressLine1 }}</text>
					<text class="address-line2">{{ addressLine2 }}</text>
					<text class="address-line3">{{ addressLine3 }}</text>
				</view>
			</view>
		</view>

		<!-- 金额汇总 -->
		<view class="card" v-if="order">
			<view class="sub-title">金额汇总</view>
			<view class="kv"><text class="k">商品总额</text><text class="v">¥{{ formatPrice(order.totalAmount) }}</text></view>
			<view class="kv"><text class="k">优惠</text><text class="v">-¥{{ formatPrice(order.discountAmount) }}</text></view>
			<view class="kv" v-if="order.type!=='SERVICE'"><text class="k">运费</text><text class="v">¥{{ formatPrice(order.shippingFee) }}</text></view>
			<view class="kv total"><text class="k">应付金额</text><text class="v">¥{{ formatPrice(order.payAmount) }}</text></view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { createHttp } from '../../utils/auth';
import { resolveImageUrl } from '../../utils/url';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

type OrderItem = { id: number; name: string; imageUrl?: string|null; price: number|string; quantity: number; specsText?: string|null; specsJson?: any };
type Vehicle = { plateNumber?: string; brand?: string|null; series?: string|null; brandLogo?: string|null; [k:string]: any };
type ShippingAddress = { province?: string; city?: string; district?: string; street?: string; detail?: string; phone?: string };
type Order = {
	id: number;
	no: string;
	type: 'SERVICE'|'SP'|'FK';
	status: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED';
	payStatus: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED';
	fulfillmentStatus?: 'NONE'|'PENDING'|'SHIPPED'|'RECEIVED'|'IN_SERVICE'|'DONE';
	createdAt: string;
	items: OrderItem[];
	vehicle?: Vehicle|null;
	totalAmount: number|string;
	discountAmount: number|string;
	shippingFee: number|string;
	payAmount: number|string;
	payMethod?: string|null;
	paidAt?: string|null;
	shippingAddress?: ShippingAddress|null;
	shippingAddressSnapshot?: ShippingAddress|null;
	remark?: string|null;
};

const order = ref<Order|null>(null);

function getShippingAddress(o?: Order|null): ShippingAddress|null {
	if (!o) return null;
	// 根据给定响应结构，优先使用 shippingAddressSnapshot，其次使用 shippingAddress
	const a: any = o.shippingAddressSnapshot || o.shippingAddress || null;
	if (!a) return null;
	return {
		province: a?.province || '',
		city: a?.city || '',
		district: a?.district || '',
		street: a?.street || '',
		detail: a?.detail || '',
		phone: a?.phone || ''
	};
}
const addressLine1 = ref<string>('-');
const addressLine2 = ref<string>('-');
const addressLine3 = ref<string>('-');

function goBack(){
	try {
		// 特殊场景：从下单创建后进入详情，返回应回到订单列表
		if ((uni as any).$$orderDetailBackToList) {
			const pages = getCurrentPages?.() || [];
			const target = pages.findIndex((p:any)=>String(p?.route||'').endsWith('pages/order/index'));
			if (target >= 0) { uni.navigateBack({ delta: pages.length - target - 1 }); return; }
			uni.reLaunch({ url: '/pages/order/index' });
			return;
		}
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/index/index' });
	} catch { uni.reLaunch({ url: '/pages/index/index' }); }
}

function formatPrice(p: any){ const n = Number(p); return isNaN(n) ? p : n.toFixed(2); }
function formatTime(t: any){ try { const d = new Date(t); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; } catch { return ''; } }

function zhStatusOld(s: Order['status'], type: Order['type']){ if (s==='PAID') return type==='SERVICE'?'待服务':'待发货'; if (s==='FULFILLED') return type==='SERVICE'?'已完成':'待收货'; if (s==='CLOSED') return '已完成'; if (s==='CANCELLED') return '已取消'; return '已创建'; }
function displayStatus(o?: Order|null){
	if (!o) return '';
	if (o.payStatus==='UNPAID') return '待支付';
	if (o.payStatus==='REFUNDED') return '已退款';
	if (o.payStatus==='CANCELLED') return '已取消';
	if (o.type==='FK') return o.payStatus==='PAID' ? '已支付' : '待支付';
	if (o.type==='SERVICE'){
		if (o.fulfillmentStatus==='IN_SERVICE' || o.fulfillmentStatus==='PENDING') return '待服务';
		if (o.fulfillmentStatus==='DONE') return '已完成';
	}
	if (o.type==='SP'){
		if (o.fulfillmentStatus==='PENDING') return '待发货';
		if (o.fulfillmentStatus==='SHIPPED') return '待收货';
		if (o.fulfillmentStatus==='RECEIVED') return '已完成';
	}
	return zhStatusOld(o.status, o.type);
}

function normalizeSpecs(specsRaw: any): Array<{ key: string; value: string }>{
	try{
		if (Array.isArray(specsRaw)) return specsRaw.map((it:any)=>({ key:String(it?.key||it?.name||'').trim(), value:String(it?.value||it?.v||'').trim() })).filter(it=>it.key&&it.value);
		if (typeof specsRaw==='string'){ try { const p=JSON.parse(specsRaw); return normalizeSpecs(p); } catch { /* ignore */ } }
		if (specsRaw && typeof specsRaw==='object') return Object.keys(specsRaw).map(k=>({ key:String(k).trim(), value:String(specsRaw[k]??'').trim() })).filter(it=>it.key&&it.value);
		return [];
	}catch{ return []; }
}
function displaySpecs(it: OrderItem){
	if (it?.specsText) return it.specsText;
	const arr = normalizeSpecs((it as any)?.specsJson);
	return arr.length ? arr.map(x=>`${x.key}：${x.value}`).join('/') : '';
}

function displayPayMethod(m?: string|null){
	const v = String(m||'').toUpperCase();
	if (!v) return '-';
	if (v.includes('WECHAT')) return '微信支付';
	if (v.includes('ALI')) return '支付宝';
	if (v.includes('CASH')) return '现金支付';
	if (v.includes('OFFLINE')) return '线下支付';
	if (v.includes('QRCODE')) return '扫码支付';
	return '其它';
}

function vehicleBrandIcon(v?: Vehicle|null){
	const s = String((v as any)?.brandImage || '').trim();
	if (!s) return '/static/icons/placeholder.png';
	if (/^https?:\/\//i.test(s)) return s;
	return resolveImageUrl(s as any) || '/static/icons/placeholder.png';
}
function vehicleBrandSeries(v?: Vehicle|null){
	const brand = (v as any)?.brand?.name || v?.brand || (v as any)?.brandName || '';
	const series = v?.series || (v as any)?.seriesName || (v as any)?.model || '';
	const text = [brand, series].filter(Boolean).join(' ');
	return text || '车辆信息';
}

const bannerVariants = ['vehicle-banner--v0', 'vehicle-banner--v1', 'vehicle-banner--v2'];
const vehicleBannerStyleIndex = ref<number>(Math.floor(Math.random()*bannerVariants.length));
const gradientClass = computed(() => bannerVariants[vehicleBannerStyleIndex.value] || bannerVariants[0]);
// 地址横幅配色（两套）
const addrVariants = ['address-banner--v0', 'address-banner--v1'];
const addressBannerStyleIndex = ref<number>(Math.floor(Math.random()*addrVariants.length));
const addressGradientClass = computed(() => addrVariants[addressBannerStyleIndex.value] || addrVariants[0]);

onLoad(async (query:any)=>{
	try {
		const no = (query?.no ? String(query.no) : '').trim();
		const id = query?.id ? Number(query.id) : NaN;
		const fromCreated = String(query?.src||'') === 'created';
		if (!no && !id) { uni.showToast({ title:'参数错误', icon:'none' }); return; }
		const http = createHttp();
		const data = no
			? await http<Order>(`/orders/by-no/${encodeURIComponent(no)}`, { method:'GET' })
			: await http<Order>(`/orders/${id}`, { method:'GET' });
		order.value = data || null;
		// 若来自下单页，则调整返回行为：返回到订单列表
		if (fromCreated) {
			try{
				const pages = getCurrentPages?.() || [];
				// 查找栈内是否已有订单列表页
				const idx = pages.findIndex((p:any)=>String(p?.route||'').endsWith('pages/order/index'));
				if (idx >= 0) {
					// 设置一个自定义返回逻辑：覆盖 goBack
					(uni as any).$$orderDetailBackToList = true;
				} else {
					(uni as any).$$orderDetailBackToList = true;
				}
			}catch{}
		}
		// 初始化地址显示
		const addr = getShippingAddress(order.value);
		if (addr) {
			addressLine1.value = `${addr.province||''} ${addr.city||''} ${addr.district||''} ${addr.street||''}`.replace(/\s+/g,' ').trim() || '-';
			addressLine2.value = (addr.detail||'').trim() || '-';
			addressLine3.value = (addr.phone||'').trim() || '-';
		} else {
			addressLine1.value = '-'; addressLine2.value = '-'; addressLine3.value = '-';
		}
	} catch { uni.showToast({ title:'加载失败', icon:'none' }); }
});
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }
.title-bar { padding: 12rpx 8rpx; }
.title { font-size: 32rpx; font-weight: 700; }
.sub-title { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.kv { display:flex; align-items:center; justify-content: space-between; padding: 10rpx 0; }
.kv .k { color:#6b7280; }
.kv .v { color:#111827; font-weight: 600; }
.item { display:flex; gap: 12rpx; padding: 12rpx 0; border-bottom: 2rpx dashed #eef2f7; }
.thumb { width: 120rpx; height: 120rpx; border-radius: 16rpx; background:#f1f5f9; }
.ibody { display:flex; flex-direction: column; gap: 6rpx; flex:1; min-width:0; }
.name { font-size: 28rpx; font-weight: 600; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space: nowrap; }
.specs { font-size: 22rpx; color:#6b7280; }
.meta { display:flex; align-items: baseline; gap: 8rpx; }
.price { font-size: 30rpx; font-weight: 800; color:#111827; }
.qty { font-size: 24rpx; color:#6b7280; }

/* 返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }

/* 地址样式 */
.addr { display:flex; flex-direction: column; gap: 6rpx; }
.addr-line { font-size: 24rpx; color:#1f2937; }
.kv.total .v { color:#111827; font-weight: 800; }

/* 独立风格的服务车辆横幅 */
.vehicle-banner { position: relative; margin: 0 0 24rpx 0; padding: 20rpx; border-radius: 20rpx; box-shadow: 0 8rpx 24rpx rgba(2, 6, 23, 0.18); }
.vehicle-banner--v0 { background: linear-gradient(90deg, #eef7ff, #60a5fa); }
.vehicle-banner--v1 { background: linear-gradient(90deg, #fff5ee, #fb923c); }
.vehicle-banner--v2 { background: linear-gradient(90deg, #f3efff, #8b5cf6); }
.vehicle-tag { position: absolute; top: 12rpx; right: 12rpx; padding: 4rpx 10rpx; font-size: 18rpx; border-radius: 999rpx; border: 2rpx solid rgba(255,255,255,0.35); color: rgba(255,255,255,0.85); background: transparent; }
.vehicle-banner-body { display:flex; align-items:center; gap: 16rpx; }
.vehicle-logo { width: 108rpx; height: 108rpx; display:block; border-radius: 16rpx; }
.vehicle-info { display:flex; flex-direction: column; }
.vehicle-line1 { font-size: 30rpx; font-weight: 700; letter-spacing: .5rpx; }
.vehicle-line2 { font-size: 24rpx; margin-top: 6rpx; }
/* 文本配色按横幅变体适配，确保对比度 */
.vehicle-banner--v0 .vehicle-line1 { color:#0b1220; }
.vehicle-banner--v0 .vehicle-line2 { color:#334155; }
.vehicle-banner--v1 .vehicle-line1 { color:#7c2d12; }
.vehicle-banner--v1 .vehicle-line2 { color:#9a3412; }
.vehicle-banner--v2 .vehicle-line1 { color:#2e1065; }
.vehicle-banner--v2 .vehicle-line2 { color:#4c1d95; }

/* 收货地址横幅 */
.address-banner { position: relative; margin: 0 0 24rpx 0; padding: 20rpx; border-radius: 20rpx; box-shadow: 0 8rpx 24rpx rgba(2, 6, 23, 0.12); }
.address-banner--v0 { background: linear-gradient(90deg, #ecfeff, #06b6d4); }
.address-banner--v1 { background: linear-gradient(90deg, #f0fdf4, #22c55e); }
.address-tag { position: absolute; top: 12rpx; right: 12rpx; padding: 4rpx 10rpx; font-size: 18rpx; border-radius: 999rpx; border: 2rpx solid rgba(255,255,255,0.35); color: rgba(255,255,255,0.9); background: transparent; }
.address-banner-body { display:flex; align-items:center; gap: 16rpx; }
.address-info { display:flex; flex-direction: column; }
.address-line1 { font-size: 26rpx; font-weight: 600; }
.address-line2, .address-line3 { font-size: 24rpx; margin-top: 4rpx; }
.address-banner--v0 .address-line1 { color:#083344; }
.address-banner--v0 .address-line2, .address-banner--v0 .address-line3 { color:#0e7490; }
.address-banner--v1 .address-line1 { color:#064e3b; }
.address-banner--v1 .address-line2, .address-banner--v1 .address-line3 { color:#047857; }
</style>



