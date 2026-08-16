<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />

		<!-- 顶部主分类：全部订单 / 商品订单 / 服务订单 -->
		<view class="tabs">
			<view class="tab" :class="{ active: mainTab==='all' }" @tap="setMain('all')">全部订单</view>
			<view class="tab" :class="{ active: mainTab==='product' }" @tap="setMain('product')">商品订单</view>
			<view class="tab" :class="{ active: mainTab==='service' }" @tap="setMain('service')">服务订单</view>
			<view class="tab" @tap="openRideOrders">行程订单</view>
		</view>

		<!-- 二级筛选：根据主分类动态变化，仅展示UI -->
		<scroll-view scroll-x class="filters" :show-scrollbar="false">
			<view class="filter-chip" v-for="f in currentFilters" :key="f" :class="{ active: f===activeFilter }" @tap="setFilter(f)">{{ f }}</view>
		</scroll-view>

		<!-- 未登录提示 -->
		<view v-if="!authed" class="auth-tip card">
			<view class="auth-tip__title">请登录后查看订单</view>
			<view class="auth-tip__desc">登录后可查看您的全部订单和支付状态</view>
			<view class="auth-tip__actions">
				<view class="btn primary" @tap="goLogin">去登录</view>
			</view>
		</view>

		<!-- 订单列表（已接入 API） -->
		<view v-if="!loading && orders.length===0" class="empty">暂无订单</view>
		<view v-for="o in orders" :key="o.id" class="card order-card">
			<!-- 顶部：标签 + 右上角状态 -->
			<view class="header-row">
				<view class="tags-row">
					<text class="tag" v-if="o.type==='SERVICE'">服务订单</text>
					<text class="tag" v-else-if="o.type==='SP'">商品订单</text>
					<text class="tag" v-else-if="o.type==='RIDE'">行程订单</text>
					<text class="tag" v-else>付款订单</text>
				</view>
				<view class="status-wrap">
					<text v-if="o.payStatus==='UNPAID' && displayRemaining(o)" class="remain">支付倒计时 {{ displayRemaining(o) }}</text>
					<text class="status-badge">{{ displayStatus(o) }}</text>
				</view>
			</view>

			<!-- 商品/服务列表（逐行展示） -->
			<view class="items">
				<view class="item" v-for="it in o.items" :key="it.id" @tap="goProduct(it)">
					<image class="thumb" :src="resolveImageUrl(it.imageUrl) || '/static/icons/placeholder.png'" mode="aspectFill" />
					<view class="ibody">
						<view class="row-1">
							<view class="name">{{ it.name }}</view>
							<text class="price">¥{{ formatPrice(it.price) }}</text>
						</view>
						<view class="row-2">
							<text class="specs" v-if="displaySpecs(it)">{{ displaySpecs(it) }}</text>
							<text class="qty">x{{ it.quantity }}</text>
						</view>
					</view>
				</view>
			</view>

			<!-- 金额小结：实付款（位于按钮上方，右下角对齐） -->
			<view class="summary">
				<text class="label">实付款：</text>
				<text class="pay">¥{{ formatPrice(o.payAmount as any) }}</text>
			</view>

			<!-- 操作区：右下角按钮（去除时间） -->
			<view class="actions">
				<view class="btn ghost" @tap="viewOrder(o)">查看订单</view>
				<template v-if="canPay(o)">
					<view class="btn ghost" @tap="confirmCancel(o)">取消订单</view>
					<view class="btn primary" @tap="choosePay(o)">去支付</view>
				</template>
				<template v-else>
					<view v-if="canReceive(o)" class="btn primary" @tap="confirmReceive(o)">确认收货</view>
					<!-- 已完成订单仅允许申请售后，并且展示在评价按钮之前 -->
					<view v-if="canAfterSales(o)" class="btn ghost" @tap="openAfterSales(o, 'AUTO')">申请售后</view>
					<view v-if="canReview(o)" class="btn primary" @tap="goReview(o)">去评价</view>
					<view v-if="canViewReview(o)" class="btn ghost" @tap="viewReview(o)">查看评价</view>
				</template>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { resolveImageUrl } from '../../utils/url';
import { useSafeArea } from '../../utils/safe-area';

/** 动态导入 checkAuthAndRefresh，避免小程序模块解析时序问题 */
async function safeCheckAuthAndRefresh(options: { redirectIfExpired?: boolean } = { redirectIfExpired: true }): Promise<boolean> {
	try {
		const { checkAuthAndRefresh } = await import('../../utils/auth');
		return await checkAuthAndRefresh(options);
	} catch { return true; }
}
import { memberControllerMe, orderControllerCancelOrder, orderControllerList, orderControllerReceive, orderControllerWechatJsapi } from '@wash/api-client';
import { rideApi } from '../../services/ride';

const { topSpacerHeight } = useSafeArea();
const authed = ref<boolean>(false);

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

function setFilter(name: string){
	activeFilter.value = name;
	fetchOrders();
}

type OrderItem = { id: number; name: string; imageUrl?: string|null; price: number; quantity: number; specsText?: string|null; specsJson?: any };
type Order = { id: number; no: string; type: 'SERVICE'|'SP'|'FK'|'RIDE'; status: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED'; payStatus: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED'; fulfillmentStatus?: 'NONE'|'PENDING'|'SHIPPED'|'RECEIVED'|'IN_SERVICE'|'DONE'; createdAt: string; paymentExpireAt?: string|null; items: OrderItem[]; payAmount?: number|string };

const orders = ref<Order[]>([]);
const loading = ref(false);
let tickTimer: any = null;

function navigate(url: string){
	// #ifdef H5
	if (typeof window !== 'undefined') { window.location.hash = url.startsWith('/') ? `#${url}` : `#/${url}`; return; }
	// #endif
	uni.navigateTo({ url });
}

function firstItem(o?: Order | null){ return (o?.items||[])[0] || null; }
function formatPrice(p: any){ const n = Number(p); return isNaN(n) ? p : n.toFixed(2); }
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
function formatTime(t: any){ try { const d = new Date(t); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; } catch { return ''; } }
function displayStatus(o: Order){
	if (o.payStatus==='UNPAID') return '待支付';
	if (o.payStatus==='REFUNDED') return '已退款';
	if (o.payStatus==='CANCELLED') return '已取消';
	const as = (o as any)?.afterSalesRequests;
	if (Array.isArray(as) && as.some((x:any)=> x?.status==='PENDING' || x?.status==='APPROVED')) return '售后中';
	if (o.type==='FK') return o.payStatus==='PAID' ? '已支付' : '待支付';
	if (o.type==='RIDE') return o.status==='FULFILLED' ? '已完成' : o.status==='CANCELLED' ? '已取消' : '行程处理中';
	// 新履约维度优先
	if (o.type==='SERVICE'){
		if (o.fulfillmentStatus==='IN_SERVICE' || o.fulfillmentStatus==='PENDING') return '待服务';
		if (o.fulfillmentStatus==='DONE') return '已完成';
	}
	if (o.type==='SP'){
		if (o.fulfillmentStatus==='PENDING') return '待发货';
		if (o.fulfillmentStatus==='SHIPPED') return '待收货';
		if (o.fulfillmentStatus==='RECEIVED') return '已完成';
	}
	// 兼容旧字段
	if (o.status==='PAID') return o.type==='SERVICE' ? '待服务' : '待发货';
	if (o.status==='FULFILLED') return o.type==='SERVICE' ? '已完成' : '待收货';
	if (o.status==='CLOSED') return '已完成';
	if (o.status==='CANCELLED') return '已取消';
	return '处理中';
}

// 待支付剩余时间展示（mm:ss），过期则不显示
function displayRemaining(o: Order){
    try{
        const exp = (o as any)?.paymentExpireAt;
        if (!exp) return '';
        const end = new Date(exp).getTime();
        const now = Date.now();
        const diff = Math.max(0, end - now);
        if (diff <= 0) return '';
        const mm = String(Math.floor(diff / 60000)).padStart(2,'0');
        const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2,'0');
        return `${mm}:${ss}`;
    }catch{ return ''; }
}


function buildQuery(){
	const q: any = {};
	if (mainTab.value==='product') q.type = 'SP';
	else if (mainTab.value==='service') q.type = 'SERVICE';
	// 二级筛选：统一使用 scene
	if (activeFilter.value==='待支付') q.scene = 'PENDING_PAYMENT';
	else if (activeFilter.value==='退款/售后') q.scene = 'REFUND_AFTERSALE';
	else if (activeFilter.value==='待服务') q.scene = 'PENDING_SERVICE';
	else if (activeFilter.value==='待发货') q.scene = 'PENDING_DELIVERY';
	else if (activeFilter.value==='待收货') q.scene = 'PENDING_RECEIPT';
	else if (activeFilter.value==='评价') q.scene = 'REVIEW';
	return q;
}

async function fetchOrders(){
	loading.value = true;
	try {
		const ok = await safeCheckAuthAndRefresh({ redirectIfExpired: false });
		authed.value = !!ok;
		if (!ok) { orders.value = []; return; }
		let profile: any = null; try { profile = await (memberControllerMe() as any); } catch {}
		const memberId = profile?.id;
		const q = buildQuery();
		if (memberId) q.memberId = memberId;
		const list = await (orderControllerList(q as any) as any);
		orders.value = Array.isArray(list) ? list : [];
		// 重置倒计时计时器（每秒触发一次视图刷新）
		try { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } } catch {}
		const hasUnpaid = orders.value.some((o:any)=> o?.payStatus==='UNPAID' && (o as any)?.paymentExpireAt);
		if (hasUnpaid){ tickTimer = setInterval(()=>{ try{ orders.value = [...orders.value]; }catch{} }, 1000); }
	} finally { loading.value = false; }
}

async function viewOrder(o: Order){
	if (o.type === 'RIDE') {
		try { const data = await rideApi.list({ page: 1, pageSize: 100 }); const trip = (data?.items || []).find((item:any) => Number(item.orderId) === Number(o.id)); if (trip) { navigate(`/pages/ride/detail/index?id=${trip.id}`); return; } } catch {}
	}
	navigate(`/pages/order/detail?no=${encodeURIComponent(o.no)}`);
}
function openRideOrders(){ navigate('/pages/ride/orders/index'); }

function goLogin(){
	try{
		// 将期望跳回的页面/筛选条件暂存
		uni.setStorageSync('order:preset', { main: mainTab.value, filter: activeFilter.value });
	}catch{}
	navigate('/pages/login/index');
}

function goProduct(it: OrderItem){
    // 订单项没有保存 productId 时可以在后端补充；这里先尝试从 specsJson 中回退
    try{
        const pid = Number((it as any)?.productId || (it as any)?.product_id || (it as any)?.pid || 0);
        if (pid) { navigate(`/pages/store/detail?id=${pid}`); return; }
    }catch{}
    // 若无 productId，仅提示不可跳转
    uni.showToast({ title:'无法定位商品', icon:'none' });
}

function canPay(o: Order){
	return o.payStatus === 'UNPAID';
}
function canReceive(o: Order){
	// 支持新旧字段：优先新履约状态，其次旧 status=FULFILLED 视作“已发货待收货”
	if (o.type !== 'SP') return false;
	if (o.payStatus !== 'PAID') return false;
	return o.fulfillmentStatus === 'SHIPPED' || o.status === 'FULFILLED';
}

function canCancel(o: Order){ return o.payStatus === 'UNPAID'; }
function isAftersalesRunning(o: Order){ return (o as any)?.afterSalesRequests && Array.isArray((o as any).afterSalesRequests) && (o as any).afterSalesRequests.some((x:any)=>x.status==='PENDING'||x.status==='APPROVED'); }
function canRefund(o: Order){ if (isAftersalesRunning(o)) return false; return o.payStatus === 'PAID'; }
function canAfterSales(o: Order){ if (isAftersalesRunning(o)) return false; return displayStatus(o)==='已完成'; }

function isCompleted(o: Order){
	if (o.type==='SERVICE') return (o.payStatus==='PAID') && (o.fulfillmentStatus==='DONE' || o.status==='FULFILLED');
	if (o.type==='SP') return (o.payStatus==='PAID') && (o.fulfillmentStatus==='RECEIVED' || o.status==='CLOSED');
	if (o.type==='FK') return o.payStatus==='PAID';
	return false;
}
function canReview(o: Order){ return isCompleted(o) && (o as any)?.reviewStatus !== 'REVIEWED'; }
function canViewReview(o: Order){ return (o as any)?.reviewStatus === 'REVIEWED'; }
function goReview(o: Order){ navigate(`/pages/review/create?orderId=${o.id}`); }
function viewReview(o: Order){ navigate(`/pages/review/view?orderId=${o.id}`); }

async function goPay(o: Order){
	try {
		const authed = await safeCheckAuthAndRefresh({ redirectIfExpired: true });
		if (!authed) return;
		const params:any = await (orderControllerWechatJsapi(Number(o.id||0)) as any);
		// #ifdef MP-WEIXIN
		await new Promise<void>((resolve, reject)=>{
			(uni as any).requestPayment({
				timeStamp: params.timeStamp,
				nonceStr: params.nonceStr,
				package: params.package,
				signType: params.signType || 'RSA',
				paySign: params.paySign,
				success: ()=> resolve(),
				fail: (e:any)=> reject(e)
			});
		});
		uni.showToast({ title: '支付成功', icon: 'success' });
		await fetchOrders();
		// #endif
		// #ifndef MP-WEIXIN
		uni.showToast({ title: '请在微信小程序内完成支付', icon: 'none' });
		// #endif
	} catch(e) {
		uni.showToast({ title: '支付未完成', icon: 'none' });
	}
}

async function choosePay(o: Order){
	try{
		let list = ['线下支付'];
		// #ifdef MP-WEIXIN
		list = ['微信支付','线下支付'];
		// #endif
		const res = await new Promise<any>((resolve)=>{
			uni.showActionSheet({
				itemList: list,
				success: (r:any)=> resolve(r),
				fail: ()=> resolve(null)
			});
		});
		if (!res || typeof res.tapIndex !== 'number') return;
		// #ifdef MP-WEIXIN
		if (res.tapIndex === 0) { await goPay(o); }
		else {
			uni.showToast({ title:'请到店线下支付', icon:'none' });
			viewOrder(o);
		}
		// #endif
		// #ifndef MP-WEIXIN
		{
			uni.showToast({ title:'请到店线下支付', icon:'none' });
			viewOrder(o);
		}
		// #endif
	}catch{}
}

// ===== 新增：微信确认收货组件 接入 =====
const awaitingWxConfirm = ref<boolean>(false);
async function confirmReceive(o: Order){
	try {
		const authed = await safeCheckAuthAndRefresh({ redirectIfExpired: true });
		if (!authed) return;
		// #ifdef MP-WEIXIN
		const isWeChatPay = (o as any)?.payMethod === 'WECHAT_JSAPI';
		const txid = (o as any)?.wechatTransactionId;
		if (isWeChatPay && txid){
			try{
				awaitingWxConfirm.value = true;
				(uni as any).openBusinessView?.({ businessType: 'weappOrderConfirm', extraData: { transaction_id: txid }, success(){}, fail(){}, complete(){} });
			}catch{ awaitingWxConfirm.value = false; }
			return;
		}
		// #endif
		// #ifndef MP-WEIXIN
		if ((o as any)?.payMethod === 'WECHAT_JSAPI') { uni.showToast({ title:'微信支付订单请在微信小程序内确认收货', icon:'none' }); return; }
		// #endif
		await orderControllerReceive(Number(o.id||0));
		uni.showToast({ title: '收货成功', icon: 'success' });
		await fetchOrders();
	} catch(e){
		uni.showToast({ title: '操作失败，请稍后重试', icon: 'none' });
	}
}

async function confirmCancel(o: Order){
    try{
        const ok = await new Promise<boolean>((resolve)=>{
            uni.showModal({ title:'取消订单', content:'确定要取消该订单吗？', success: (r:any)=> resolve(!!r.confirm), fail: ()=> resolve(false) });
        });
        if (!ok) return;
        const authed = await safeCheckAuthAndRefresh({ redirectIfExpired: true }); if (!authed) return;
		if (o.type === 'RIDE') {
			const data = await rideApi.list({ page: 1, pageSize: 100 });
			const trip = (data?.items || []).find((item:any) => Number(item.orderId) === Number(o.id));
			if (!trip) throw new Error('行程不存在');
			await rideApi.cancel(trip.id, '用户主动取消');
			uni.showToast({ title:'已取消', icon:'success' });
			await fetchOrders();
			return;
		}
        await orderControllerCancelOrder(Number(o.id||0), { body: { reason: '用户主动取消' } } as any);
        uni.showToast({ title:'已取消', icon:'success' });
        await fetchOrders();
    } catch { uni.showToast({ title:'操作失败，请稍后重试', icon:'none' }); }
}

function openAfterSales(o: Order, mode: 'REFUND'|'AUTO'){
    const type = (mode==='REFUND') ? 'refund' : 'aftersales';
    navigate(`/pages/aftersales/apply?orderId=${o.id}&type=${type}&orderType=${o.type}`);
}

onShow(async()=>{
    try{
        const preset:any = uni.getStorageSync('order:preset');
        if (preset && typeof preset==='object'){
            const m = String(preset.main||'').trim();
            const f = String(preset.filter||'').trim();
            if (m==='all' || m==='product' || m==='service') mainTab.value = m as any;
            if (f && currentFilters.value.includes(f)) activeFilter.value = f;
            try { uni.removeStorageSync('order:preset'); } catch {}
        }
    } catch {}
    await fetchOrders();
    // 选做：若列表存在未支付订单，则在页面可见时低频刷新，最长2分钟
    try{ (onShow as any).__poll && clearInterval((onShow as any).__poll); }catch{}
    try{
        const hasUnpaid = orders.value.some((o:any)=> o?.payStatus==='UNPAID');
        if (hasUnpaid){
            const start = Date.now();
            (onShow as any).__poll = setInterval(async ()=>{
                try{
                    if (Date.now() - start > 120000){ clearInterval((onShow as any).__poll); (onShow as any).__poll=null; return; }
                    await fetchOrders();
                }catch{}
            }, 30000);
        }
    }catch{}
    // #ifdef MP-WEIXIN
    if (awaitingWxConfirm.value){
        try{
            const enter:any = (uni as any).getEnterOptionsSync?.() || {};
            const ref = enter?.referrerInfo || {};
            const fromAppId = String(ref?.appId||'');
            if (fromAppId === 'wx1183b055aeec94d1'){
                const ed = ref?.extraData || {};
                const status = String(ed?.status||'');
                if (status === 'success'){
                    uni.showToast({ title:'收货成功', icon:'success' });
                    await fetchOrders();
                } else {
                    uni.showToast({ title:'未完成确认收货', icon:'none' });
                }
            }
        }catch{}
        awaitingWxConfirm.value = false;
    }
    // #endif
});
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

/* H5：scroll-view 会渲染成 uni-scroll-view，真正滚动的是内部 .uni-scroll-view */
.filters::-webkit-scrollbar,
.filters .uni-scroll-view::-webkit-scrollbar,
uni-scroll-view.filters::-webkit-scrollbar,
uni-scroll-view.filters .uni-scroll-view::-webkit-scrollbar {
	width: 0;
	height: 0;
	display: none;
}
.filters,
.filters .uni-scroll-view,
uni-scroll-view.filters,
uni-scroll-view.filters .uni-scroll-view {
	scrollbar-width: none;
	-ms-overflow-style: none;
}
.filter-chip { display:inline-flex; align-items:center; padding: 12rpx 20rpx; margin-right: 16rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx dashed #e5e7eb; color:#374151; font-size: 24rpx; }
.filter-chip.active { border-color: #77bfff; background:#f7fbff; }

.auth-tip { text-align:center; }
.auth-tip__title { font-size: 30rpx; font-weight: 800; color:#111827; margin-bottom: 8rpx; }
.auth-tip__desc { font-size: 24rpx; color:#6b7280; margin-bottom: 16rpx; }
.auth-tip__actions { display:flex; align-items:center; justify-content:center; }

.section-time { margin: 12rpx 0; color:#6b7280; font-size: 22rpx; }

.order-card { display:flex; flex-direction: column; gap: 12rpx; background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.thumb { width: 120rpx; height: 120rpx; border-radius: 16rpx; background:#ffffff; border: 2rpx solid #e5e7eb; }
.order-body { flex:1; display:flex; flex-direction: column; gap: 8rpx; min-width: 0; }
.title { font-size: 28rpx; font-weight: 600; color:#1f2937; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.tags-row { display:flex; flex-wrap: wrap; gap: 10rpx; }
.tag { font-size: 22rpx; color:#374151; background:#ffffff; border: 2rpx dashed #e5e7eb; padding: 4rpx 8rpx; border-radius: 999rpx; }
.actions { margin-top: 12rpx; display:flex; align-items:center; justify-content: flex-end; gap: 16rpx; }
.btn { padding: 10rpx 22rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx solid #ffd6e7; color:#1f2937; font-size: 24rpx; }
.btn.primary { background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#ffffff; border: none; overflow: hidden; }
.btn.ghost { background:#ffffff; color:#374151; border-color:#e5e7eb; }

/* 新增：卡片头部与状态徽标 */
.header-row { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.status-badge { font-size: 24rpx; color:#0f766e; background:#ecfeff; border: 2rpx solid #99f6e4; padding: 6rpx 12rpx; border-radius: 999rpx; }
.status-wrap { display:flex; align-items:center; gap: 10rpx; }
.remain { font-size: 22rpx; color:#ef4444; background:#fee2e2; border: 2rpx solid #fecaca; padding: 4rpx 10rpx; border-radius: 999rpx; }

/* 新增：订单项列表 */
.items { display:flex; flex-direction: column; gap: 12rpx; }
.item { display:flex; gap: 12rpx; padding: 8rpx 0; border-bottom: 2rpx dashed #eef2f7; }
.item:last-child { border-bottom: none; }
.ibody { display:flex; flex-direction: column; gap: 6rpx; flex:1; min-width:0; }
.row-1 { display:flex; align-items:center; justify-content: space-between; gap: 12rpx; }
.row-2 { display:flex; align-items:center; justify-content: space-between; gap: 12rpx; }
.name { font-size: 28rpx; font-weight: 600; color:#111827; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.specs { font-size: 22rpx; color:#6b7280; }
.price { font-size: 30rpx; font-weight: 800; color:#111827; }
.qty { font-size: 24rpx; color:#6b7280; }

/* 金额汇总（实付款） */
.summary { display:flex; align-items: baseline; justify-content: flex-end; gap: 8rpx; margin-top: 4rpx; }
.summary .label { color:#6b7280; font-size: 24rpx; }
.summary .pay { color:#111827; font-size: 30rpx; font-weight: 800; }
.empty { text-align:center; color:#9ca3af; margin-top: 80rpx; }
</style>


