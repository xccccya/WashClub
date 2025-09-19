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
			<view class="kv" v-if="order.payStatus==='UNPAID' && !isExpired"><text class="k">支付剩余</text><text class="v">{{ countdownText }}</text></view>
			<view class="kv"><text class="k">订单号</text><text class="v v--small">{{ order.no }}</text></view>
			<view class="kv"><text class="k">下单时间</text><text class="v">{{ formatTime(order.createdAt) }}</text></view>
			<view class="kv" v-if="isTimeoutUnpaid(order)"><text class="k">提示</text><text class="v" style="color:#b91c1c;">超过15分钟未支付，系统已自动取消</text></view>
			<view class="kv" v-if="order.remark"><text class="k">系统备注</text><text class="v">{{ order.remark }}</text></view>
			<view class="kv" v-if="(order as any).userRemark"><text class="k">用户备注</text><text class="v">{{ (order as any).userRemark }}</text></view>
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

		<!-- 商品/服务：付款订单(FK)不展示 -->
		<view class="card" v-if="order && order.type!=='FK'">
			<view class="sub-title">商品/服务</view>
			<view class="item" v-for="it in order.items" :key="it.id" @tap="goProductInDetail(it)">
				<image class="thumb" :src="resolveImageUrl(it.imageUrl) || '/static/icons/placeholder.png'" />
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
			<view class="kv" v-if="(order as any)?.wechatTransactionId"><text class="k">微信交易单号</text><text class="v v--small">{{ (order as any).wechatTransactionId }}</text></view>
			<view class="kv" v-if="hasPartialRefund"><text class="k">提示</text><text class="v" style="color:#92400e;">该订单已发生部分退款</text></view>
		</view>

		<!-- 付款说明（有值时展示） -->
		<view class="card" v-if="order && (order as any).paymentNote">
			<view class="sub-title">付款说明</view>
			<view class="payment-note">{{ (order as any).paymentNote }}</view>
		</view>

		<!-- 物流信息：商品订单展示（纯虚拟卡券订单不展示） -->
		<view class="logistics-card" v-if="order && order.type==='SP' && !isVirtualOnly(order)">
			<view class="logistics-head">物流信息</view>
			<view v-if="(order as any).shipNoExpress" class="logistics-empty">商家已选择无需快递发货</view>
			<view v-else-if="(order as any).shipExpressTrackingNo" class="logistics-body">
				<image v-if="(order as any).shipExpressCompanyLogo" class="logistics-logo" :src="(order as any).shipExpressCompanyLogo" mode="aspectFit" />
				<view class="logistics-info">
					<text class="line">快递公司：{{ (order as any).shipExpressCompanyName || (order as any).shipExpressCompanyCode || '-' }}</text>
					<text class="line">运单号：{{ (order as any).shipExpressTrackingNo }}</text>
					<text v-if="(order as any).shippedAt" class="line">发货时间：{{ formatTime((order as any).shippedAt) }}</text>
					<text v-if="((order as any).shipExpressExtra||{}).editedOnce" class="line" style="color:#6b7280;">提示：物流单号已修改一次（{{ formatTime(((order as any).shipExpressExtra||{}).editAt) }}），原单号：{{ ((order as any).shipExpressExtra||{}).prevTrackingNo || '-' }}</text>
					<text v-if="mainTraceStatusDesc" class="line">状态：{{ mainTraceStatusDesc }}</text>
				</view>
				<view class="trace-btn" @tap="loadTrace">查看物流</view>
			</view>
			<view v-else class="logistics-empty">暂无物流信息</view>
			<view v-if="traceList.length" class="trace-list">
				<view v-for="(it,idx) in traceList" :key="idx" class="trace-item">
					<text class="time">{{ it.datetime }}</text>
					<text class="desc">{{ it.remark }}</text>
				</view>
			</view>
		</view>

		<!-- 收货地址横幅（商品订单显示，独立风格；纯虚拟卡券订单不展示） -->
		<view :class="['address-banner', addressGradientClass]" v-if="order && order.type==='SP' && !isVirtualOnly(order)">
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
			<view class="kv kv--sub" v-if="(order as any).memberDiscountAmount && Number((order as any).memberDiscountAmount)>0"><text class="k">会员折扣</text><text class="v">-¥{{ formatPrice((order as any).memberDiscountAmount) }}</text></view>
			<view class="kv kv--sub" v-if="(order as any).cashierDiscountAmount && Number((order as any).cashierDiscountAmount)>0"><text class="k">收银立减</text><text class="v">-¥{{ formatPrice((order as any).cashierDiscountAmount) }}</text></view>
			<view class="kv kv--sub" v-if="(order as any).pointsAmount && Number((order as any).pointsAmount)>0"><text class="k">积分抵扣</text><text class="v">-¥{{ formatPrice((order as any).pointsAmount) }}</text></view>
			<view class="kv kv--sub" v-if="(order as any).washCardDeductAmount && Number((order as any).washCardDeductAmount)>0"><text class="k">洗车卡抵扣</text><text class="v">-¥{{ formatPrice((order as any).washCardDeductAmount) }}</text></view>
			<view class="kv kv--sub" v-for="(c, idx) in couponDisplayList" :key="idx"><text class="k">{{ c.name }}</text><text class="v">-¥{{ formatPrice(c.amount) }}</text></view>
			<view class="kv" v-if="order.type!=='SERVICE' && order.type!=='FK'"><text class="k">运费</text><text class="v">¥{{ formatPrice(order.shippingFee) }}</text></view>
			<view class="kv total"><text class="k">应付金额</text><text class="v">¥{{ formatPrice(order.payAmount) }}</text></view>
			<view class="kv refunded" v-if="hasPartialRefund"><text class="k">已退金额</text><text class="v">¥{{ formatPrice(refundedAmountYuan) }}</text></view>
		</view>

		<!-- 订单进度（折叠：默认仅展示最新一条） -->
		<view class="card" v-if="timelineList.length">
			<view class="sub-title">订单进度</view>
			<view class="timeline">
				<view v-for="(it,idx) in (showAllTimeline ? timelineList : [timelineList[timelineList.length-1]])" :key="it.id" :class="['timeline-row', timelineClass(it)]">
					<view class="dot"></view>
					<text class="time">{{ formatTime(it.createdAt) }}</text>
					<text class="desc">{{ zhEvent(it.event) }}：{{ zhTimelineValue(it.event, it.value, order) }}<text v-if="it.remark">（{{ zhRemark(it.event, it.remark) }}）</text></text>
				</view>
			</view>
			<view class="actions" style="justify-content:flex-start; margin-top:8rpx;">
				<view class="btn ghost" @tap="toggleTimeline">
					<text class="btn-icon">{{ showAllTimeline ? '▲' : '▼' }}</text>
					<text class="btn-text">{{ showAllTimeline ? '收起' : '展开全部' }}</text>
				</view>
			</view>
		</view>

		<!-- 换货发货：存在换货发货记录时展示 -->
		<view class="logistics-card" v-if="exchangeShipments.length">
			<view class="logistics-head">换货物流信息</view>
			<view v-for="(ex,idx) in exchangeShipments" :key="idx" style="margin-bottom:12rpx;">
				<view class="logistics-body">
					<image v-if="ex.companyLogo" class="logistics-logo" :src="ex.companyLogo" mode="aspectFit" />
					<view class="logistics-info">
						<text class="line">快递公司：{{ ex.companyName || ex.companyCode || (ex.noExpress ? '无需快递' : '-') }}</text>
						<text class="line" v-if="!ex.noExpress">运单号：{{ ex.trackingNo || '-' }}</text>
						<text class="line">发货时间：{{ formatTime(ex.createdAt) }}</text>
						<text class="line" v-if="getExStatusDesc(ex)">状态：{{ getExStatusDesc(ex) }}</text>
					</view>
					<view class="trace-btn" v-if="ex.trackingNo" @tap="openExchangeTrace(ex)">查看物流</view>
				</view>
				<view v-if="getExList(ex).length" class="trace-list">
					<view v-for="(it,ii) in getExList(ex)" :key="ii" class="trace-item">
						<text class="time">{{ it.datetime }}</text>
						<text class="desc">{{ it.remark }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 底部操作区：与订单列表页保持一致的可操作按钮 -->
		<view style="height: 24rpx;"></view>
		<view class="actions actions--footer" v-if="order">
			<template v-if="order.payStatus==='UNPAID'">
				<view v-if="canShowCancel(order as any)" class="btn ghost" @tap="confirmCancelInDetail">取消订单</view>
				<view class="btn primary" @tap="choosePayInDetail">去支付</view>
			</template>
			<template v-else>
				<view v-if="canReceive(order as any)" class="btn primary" @tap="confirmReceiveInDetail">确认收货</view>
				<!-- 申请退款按钮（支付后允许，且无进行中售后） -->
				<view v-if="canRefund(order as any)" class="btn ghost" @tap="openAfterSalesInDetail('REFUND')">申请退款</view>
				<!-- 已完成订单支持申请售后与评价 -->
				<view v-if="canAfterSales(order as any)" class="btn ghost" @tap="openAfterSalesInDetail('AUTO')">申请售后</view>
				<view v-if="canReview(order as any)" class="btn primary" @tap="goReviewInDetail">去评价</view>
			</template>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app';
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
const countdownText = ref<string>('');
const isExpired = ref<boolean>(false);
let countdownTimer: any = null;
let visibleRefreshTimer: any = null;
let visibleRefreshStartAtMs: number = 0;

function computeRemainMs(): number {
    try{
        const o:any = order.value; if (!o) return 0;
        const expRaw:any = (o as any).paymentExpireAt || (o as any).expireAt || null;
        if (!expRaw) return 0;
        const exp = new Date(expRaw).getTime();
        return Math.max(0, exp - Date.now());
    }catch{ return 0; }
}
function fmt(ms: number): string {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function tickCountdown(){
    const ms = computeRemainMs();
    isExpired.value = ms <= 0;
    countdownText.value = isExpired.value ? '' : fmt(ms);
}
function startCountdown(){
    try{ if (countdownTimer){ clearInterval(countdownTimer); countdownTimer=null; } }catch{}
    tickCountdown();
    countdownTimer = setInterval(tickCountdown, 1000);
}
const couponDisplayList = computed(() => {
    try{
        const o:any = order.value;
        if (!o) return [];
        const flows:any[] = Array.isArray(o.couponFlows) ? o.couponFlows : [];
        const useFlows = flows.filter(f=> String(f?.action||'').toUpperCase()==='USE');
        const list = useFlows.map(f=>({ name: f?.snapshot?.couponName || f?.coupon?.name || '优惠券', amount: Number(f?.snapshot?.discountApplied||0) }));
        if (list.length) return list.filter(it=> it.amount>0);
        // 回退到单券 couponInfo
        const ci:any = (o as any).couponInfo || null;
        if (ci && (ci.name || ci.discountApplied)) return [{ name: ci.name || '优惠券', amount: Number(ci.discountApplied||0) }];
        return [];
    }catch{ return []; }
});
const traceList = ref<Array<{ datetime: string; remark: string }>>([]);
const mainTraceStatusDesc = ref<string>('');
const lastKey = ref<string>('');
const timelineList = ref<Array<any>>([]);
const showAllTimeline = ref<boolean>(false);
const hasPartialRefund = ref<boolean>(false);
function computePartialRefundFlag(data: any){
	try{
		const payAmountFen = Math.round(Number(data?.payAmount||0) * 100);
		const successSumFen = Math.round((Array.isArray(data?.refundRecords) ? data.refundRecords : []).filter((r:any)=> r?.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r?.amount||0), 0) * 100);
		return successSumFen > 0 && successSumFen < payAmountFen;
	}catch{ return false; }
}
// 换货发货记录
const exchangeShipments = computed(()=>{
    try{
        const extra:any = (order.value as any)?.shipExpressExtra || {};
        const list:any[] = Array.isArray(extra?.exchangeShipments) ? extra.exchangeShipments : [];
        return list.slice().sort((a:any,b:any)=> new Date(b?.createdAt||0).getTime() - new Date(a?.createdAt||0).getTime());
    }catch{ return []; }
});
function exchangeShipmentText(ex:any){
    try{
        if (!ex) return '-';
        if (ex.noExpress) return '无需快递';
        const com = ex.companyName || ex.companyCode || '';
        const no = ex.trackingNo || '';
        const phones = [ex?.contact?.senderPhoneMasked, ex?.contact?.receiverPhoneMasked].filter(Boolean).join(' / ');
        const tail = phones ? `（隐私号：${phones}）` : '';
        return [com, no].filter(Boolean).join(' / ') + tail;
    }catch{ return '-'; }
}

// 按换货记录独立维护轨迹（不影响主物流）
const exchangeTraceMap = reactive<Record<string, { list: Array<{ datetime: string; remark: string }>; statusDesc: string }>>({});
function exchangeKey(ex:any){ return `${ex?.companyCode||''}|${ex?.trackingNo||''}`; }
function getExList(ex:any){ const k = exchangeKey(ex); const v = exchangeTraceMap[k]; return Array.isArray(v?.list) ? v.list : []; }
function getExStatusDesc(ex:any){ const k = exchangeKey(ex); const v = exchangeTraceMap[k]; return v?.statusDesc || ''; }

async function openExchangeTrace(ex:any){
    try{
        if (!ex?.trackingNo) return;
        const http = createHttp();
        const res:any = await http('/orders/_logistics/query', { method:'GET', query: { com: ex?.companyCode || undefined, no: ex?.trackingNo } });
        const rawList:any[] = Array.isArray(res?.data?.list) ? res.data.list : [];
        const getTime = (it:any)=> it?.datetime || it?.time || '';
        const getRemark = (it:any)=> it?.remark || it?.context || '';
        rawList.sort((a,b)=> new Date(getTime(b)||0).getTime() - new Date(getTime(a)||0).getTime());
        const list = rawList.map(it=>({ datetime: String(getTime(it)||'').trim(), remark: String(getRemark(it)||'').trim() }));
        const statusDesc = String(res?.data?.status_desc || res?.data?.statusDesc || res?.data?.status || res?.msg || '');
        exchangeTraceMap[exchangeKey(ex)] = { list, statusDesc };
    }catch{}
}
// 是否为纯虚拟卡券商品的商品订单（SP）：基于后端返回的 item.productType 判断
function isVirtualOnly(o?: any): boolean {
    try{
        if (!o || o.type !== 'SP') return false;
        const items: any[] = Array.isArray(o.items) ? o.items : [];
        if (!items.length) return false;
        // productType 取值：SERVICE / PHYSICAL / VIRTUAL_CARD
        return items.every((it:any)=> String(it?.productType||'').toUpperCase() === 'VIRTUAL_CARD');
    }catch{ return false; }
}
// 时间线样式映射：参照洗车卡页面的不同色点
function timelineClass(it: any){
    try{
        const e = String(it?.event||'').toUpperCase();
        const v = String(it?.value||'').toUpperCase();
        if (e==='ORDER_STATUS'){
            if (v==='CREATED') return 'tl--created';
            if (v==='PAID') return 'tl--paid';
            if (v==='FULFILLED' || v==='CLOSED') return 'tl--done';
            if (v==='CANCELLED') return 'tl--cancelled';
        }
        if (e==='PAY_STATUS'){
            if (v==='UNPAID') return 'tl--unpaid';
            if (v==='PAID') return 'tl--paid';
            if (v==='PARTIAL_REFUND' || v==='REFUND_REQUESTED') return 'tl--partial';
            if (v==='REFUNDED' || v==='CANCELLED') return 'tl--cancelled';
        }
        if (e==='FULFILLMENT'){
            if (v==='PENDING') return 'tl--pending';
            if (v==='IN_SERVICE' || v==='SHIPPED') return 'tl--inprogress';
            if (v==='RECEIVED' || v==='DONE') return 'tl--done';
        }
        if (e==='AFTERSALES'){
            if (v==='PENDING' || v==='APPROVED') return 'tl--aftersales';
            if (v==='REJECTED') return 'tl--cancelled';
            if (v==='COMPLETED' || v==='SUCCESS') return 'tl--done';
        }
        if (e==='LOGISTICS') return 'tl--inprogress';
        if (e==='REVIEW') return 'tl--review';
        if (e==='BENEFITS') return 'tl--benefit';
        if (e==='NOTE') return 'tl--note';
        return '';
    }catch{ return ''; }
}
// 复用列表页的能力：在详情页内实现相同判断与操作
function isAftersalesRunning(o: any){ return (o?.afterSalesRequests && Array.isArray(o.afterSalesRequests) && o.afterSalesRequests.some((x:any)=>x.status==='PENDING'||x.status==='APPROVED')); }
function canRefund(o: any){ if (isAftersalesRunning(o)) return false; try { if (displayStatus(o)==='已完成') return false; } catch {} return o?.payStatus === 'PAID'; }
function canAfterSales(o: any){ if (isAftersalesRunning(o)) return false; try { return displayStatus(o)==='已完成'; } catch { return false; } }
function canReceive(o: any){ if (!o) return false; if (o.type!=='SP') return false; if (o.payStatus!=='PAID') return false; return o.fulfillmentStatus==='SHIPPED' || o.status==='FULFILLED'; }
function canReview(o: any){ try { if (!o) return false; if (o?.type==='FK') return false; const done = (o.type==='SERVICE') ? ((o.payStatus==='PAID')&&(o.fulfillmentStatus==='DONE'||o.status==='FULFILLED')) : ((o.type==='SP')?((o.payStatus==='PAID')&&(o.fulfillmentStatus==='RECEIVED'||o.status==='CLOSED')):false); return done && (o?.reviewStatus!=='REVIEWED'); } catch { return false; } }

function openAfterSalesInDetail(mode: 'REFUND'|'AUTO'){
    try{ const o:any = order.value; if (!o) return; const type = (mode==='REFUND') ? 'refund' : 'aftersales'; uni.navigateTo({ url: `/pages/aftersales/apply?orderId=${o.id}&type=${type}&orderType=${o.type}` }); }catch{}
}
const awaitingWxConfirm = ref<boolean>(false);
async function confirmReceiveInDetail(){
    try{
        const o:any = order.value; if(!o) return;
        // #ifdef MP-WEIXIN
        if (o?.payMethod === 'WECHAT_JSAPI' && o?.wechatTransactionId){
            try{
                awaitingWxConfirm.value = true;
                (uni as any).openBusinessView?.({
                    businessType: 'weappOrderConfirm',
                    extraData: { transaction_id: o.wechatTransactionId },
                    success(){}, fail(){}, complete(){}
                });
            }catch{ awaitingWxConfirm.value = false; }
            return;
        }
        // #endif
        // #ifndef MP-WEIXIN
        if (o?.payMethod === 'WECHAT_JSAPI') { uni.showToast({ title:'微信支付订单请在微信小程序内确认收货', icon:'none' }); return; }
        // #endif
        const http = createHttp(); await http(`/orders/${o.id}/receive`, { method:'POST' }); uni.showToast({ title:'收货成功', icon:'success' }); await reloadDetail();
    }catch{ uni.showToast({ title:'操作失败，请稍后重试', icon:'none' }); }
}
function within15min(createdAt?: string){ try{ if(!createdAt) return false; const t = new Date(createdAt).getTime(); return Date.now() - t <= 15*60*1000; }catch{ return false; } }
function canShowCancel(o:any){ try{ if (!o) return false; if (o.payStatus!=='UNPAID') return false; if (String(o.type||'').toUpperCase()!=='SERVICE') return within15min(o.createdAt); const fs = String(o.fulfillmentStatus||'').toUpperCase(); if (fs!=='PENDING') return false; return within15min(o.createdAt); }catch{ return false; } }
async function confirmCancelInDetail(){ try{ const ok = await new Promise<boolean>(r=>{ uni.showModal({ title:'取消订单', content:'确定要取消该订单吗？', success:(x:any)=>r(!!x.confirm), fail:()=>r(false) }); }); if(!ok) return; const authed = await (async()=>{ try{ const { checkAuthAndRefresh } = await import('../../utils/auth'); return await checkAuthAndRefresh({ redirectIfExpired: true }); }catch{return true} })(); if (!authed) return; const o:any = order.value; if(!o) return; if (!canShowCancel(o)) { uni.showToast({ title:'服务已开始/完成，订单不可取消，如需帮助请联系门店', icon:'none' }); return; } const http = createHttp(); await http(`/orders/${o.id}/cancel`, { method:'POST', body: { reason:'用户主动取消' } }); uni.showToast({ title:'已取消', icon:'success' }); await reloadDetail(); }catch(e:any){ const msg = String(e?.message||''); if (msg.includes('服务已开始')||/409/.test(msg)) { uni.showToast({ title:'服务已开始/完成，订单不可取消，如需帮助请联系门店', icon:'none' }); } else { uni.showToast({ title:'操作失败，请稍后重试', icon:'none' }); } } }
async function choosePayInDetail(){ try{ const o:any = order.value; if(!o) return; let list = ['线下支付'];
    // #ifdef MP-WEIXIN
    list = ['微信支付','线下支付'];
    // #endif
    const res = await new Promise<any>(resolve=>{ uni.showActionSheet({ itemList: list, success:(r:any)=>resolve(r), fail:()=>resolve(null) }); }); if(!res||typeof res.tapIndex!=='number') return;
    // #ifdef MP-WEIXIN
    if (res.tapIndex===0){
        if (isExpired.value) { uni.showToast({ title:'订单已超时，请重新下单', icon:'none' }); return; }
        // 服务单先服务后付：未完成服务禁止拉起支付（与后端一致）
        if (String(o.type||'').toUpperCase()==='SERVICE' && o.payAfterService===true){
            const fs = String(o.fulfillmentStatus||'').toUpperCase();
            if (fs !== 'DONE') { uni.showToast({ title:'服务尚未完成，完成后请支付', icon:'none' }); return; }
        }
        try{ const http = createHttp(); const params:any = await http(`/orders/${o.id}/pay/wechat-jsapi`, { method:'POST' }); await new Promise<void>((resolve,reject)=>{ (uni as any).requestPayment({ timeStamp: params.timeStamp, nonceStr: params.nonceStr, package: params.package, signType: params.signType || 'RSA', paySign: params.paySign, success:()=>resolve(), fail:(e:any)=>reject(e) }); }); uni.showToast({ title:'支付成功', icon:'success' }); await reloadDetail(); }catch{ uni.showToast({ title:'支付未完成', icon:'none' }); }
    } else { uni.showToast({ title:'请到店线下支付', icon:'none' }); }
    // #endif
    // #ifndef MP-WEIXIN
    { uni.showToast({ title:'请到店线下支付', icon:'none' }); }
    // #endif
}catch{}}

function goReviewInDetail(){
    try{
        const o:any = order.value; if(!o) return;
        const url = `/pages/review/create?orderId=${o.id}`;
        // #ifdef H5
        try{ if (typeof window !== 'undefined'){ (window as any).location.hash = url.startsWith('/') ? `#${url}` : `#/${url}`; return; } }catch{}
        // #endif
        uni.navigateTo({ url });
    }catch{}
}

async function reloadDetail(){ try{ const o:any = order.value; if(!o) return; const http = createHttp(); const data:any = await http(`/orders/${o.id}`, { method:'GET' }); order.value = data || null; try{ timelineList.value = Array.isArray((data as any)?.timelines) ? (data as any).timelines : []; }catch{ timelineList.value = []; } }catch{} }
const refundedAmountYuan = computed(()=>{
	try{ const list = (order.value as any)?.refundRecords || []; const sum = list.filter((r:any)=>r?.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0); return sum; }catch{return 0}
});

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
function formatTime(t: any){ try { const d = new Date(t); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); const ss=String(d.getSeconds()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`; } catch { return ''; } }

function zhStatusOld(s: Order['status'], type: Order['type']){ if (s==='PAID') return type==='SERVICE'?'待服务':'待发货'; if (s==='FULFILLED') return type==='SERVICE'?'已完成':'待收货'; if (s==='CLOSED') return '已完成'; if (s==='CANCELLED') return '已取消'; return '已创建'; }
function displayStatus(o?: Order|null){
	if (!o) return '';
	if (o.payStatus==='UNPAID') return '待支付';
	if (o.payStatus==='REFUNDED') return '已退款';
	if (o.payStatus==='CANCELLED') return '已取消';
	if ((o as any)?.afterSalesRequests && Array.isArray((o as any).afterSalesRequests) && (o as any).afterSalesRequests.some((x:any)=>x.status==='PENDING'||x.status==='APPROVED')) return '售后中';
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

function isTimeoutUnpaid(o?: Order|null){
	if (!o) return false;
	if (o.payStatus!=='CANCELLED') return false;
	const text = String(o?.remark||'');
	return text.includes('系统超时取消');
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
	if (v==='WECHAT_JSAPI') return '微信支付';
	if (v==='WECHAT_MICROPAY') return '微信付款码';
	if (v.includes('WECHAT')) return '微信支付';
	if (v.includes('ALI')) return '支付宝';
	if (v.includes('SHOUQIANBA')) return '收钱吧扫码支付';
	if (v.includes('CASH')) return '现金支付';
	if (v.includes('OFFLINE')) return '线下支付';
	if (v.includes('WASH_CARD') || v==='WASH_CARD') return '洗车卡结算';
	if (v==='GROUP_BALANCE') return '集团余额支付';
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

function goProductInDetail(it: any){
    try{
        const pid = Number(it?.productId || it?.product_id || it?.pid || 0);
        if (pid) { uni.navigateTo({ url: `/pages/store/detail?id=${pid}` }); return; }
    }catch{}
    uni.showToast({ title:'无法定位商品', icon:'none' });
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
		startCountdown();
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
		// 记录当前参数键，用于 H5 返回后再次进入强制刷新
		const idStr = isNaN(id) ? '' : String(id);
		lastKey.value = `no=${no}&id=${idStr}`;
		// 设置时间线
		try{ timelineList.value = Array.isArray((data as any)?.timelines) ? (data as any).timelines : []; }catch{ timelineList.value = []; }
		showAllTimeline.value = false;
		hasPartialRefund.value = computePartialRefundFlag(data);
	} catch { uni.showToast({ title:'加载失败', icon:'none' }); }
});

onShow(async ()=>{
	try{
		const pages = getCurrentPages?.() || [];
		const cur:any = pages[pages.length - 1] || {};
		const opt:any = cur?.options || {};
		const no = (opt?.no ? String(opt.no) : '').trim();
		const idNum = opt?.id ? Number(opt.id) : NaN;
		const idStr = isNaN(idNum) ? '' : String(idNum);
		const key = `no=${no}&id=${idStr}`;
		// 无条件轻量刷新一次（返回时也同步状态）
		const http = createHttp();
		const data = no
			? await http<Order>(`/orders/by-no/${encodeURIComponent(no)}`, { method:'GET' })
			: await http<Order>(`/orders/${idNum}`, { method:'GET' });
		order.value = data || null;
		startCountdown();
		// 初始化地址显示
		const addr = getShippingAddress(order.value);
		if (addr) {
			addressLine1.value = `${addr.province||''} ${addr.city||''} ${addr.district||''} ${addr.street||''}`.replace(/\s+/g,' ').trim() || '-';
			addressLine2.value = (addr.detail||'').trim() || '-';
			addressLine3.value = (addr.phone||'').trim() || '-';
		} else {
			addressLine1.value = '-'; addressLine2.value = '-'; addressLine3.value = '-';
		}
		traceList.value = [];
		lastKey.value = key;
		// 设置时间线
		try{ timelineList.value = Array.isArray((data as any)?.timelines) ? (data as any).timelines : []; }catch{ timelineList.value = []; }
		showAllTimeline.value = false;
		hasPartialRefund.value = computePartialRefundFlag(data);

		// 可见态低频轮询（仅 UNPAID），每15秒一次，最长2分钟或状态变更即停止
		try{ if (visibleRefreshTimer) { clearInterval(visibleRefreshTimer); visibleRefreshTimer = null; } }catch{}
		visibleRefreshStartAtMs = Date.now();
		if ((order.value as any)?.payStatus === 'UNPAID'){
			visibleRefreshTimer = setInterval(async ()=>{
				try{
					const o:any = order.value; if (!o) return;
					if (o.payStatus !== 'UNPAID') { clearInterval(visibleRefreshTimer as any); visibleRefreshTimer=null; return; }
					if (Date.now() - visibleRefreshStartAtMs > 120000) { clearInterval(visibleRefreshTimer as any); visibleRefreshTimer=null; return; }
					const latest:any = await createHttp()(`/orders/${o.id}`, { method:'GET' });
					const changed = !latest || latest.payStatus !== o.payStatus || latest.fulfillmentStatus !== (o as any).fulfillmentStatus || String(latest.updatedAt||'') !== String((o as any).updatedAt||'');
					if (changed) { order.value = latest || null; }
				}catch{}
			}, 15000);
		}
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
						const o:any = order.value; if(o){ const http = createHttp(); await http(`/orders/${o.id}/receive`, { method:'POST' }); uni.showToast({ title:'收货成功', icon:'success' }); await reloadDetail(); }
					} else {
						uni.showToast({ title:'未完成确认收货', icon:'none' });
					}
				}
			}catch{}
			awaitingWxConfirm.value = false;
		}
		// #endif
	}catch{}
});

async function loadTrace(){
	try{
		traceList.value = []; mainTraceStatusDesc.value = '';
		const o:any = order.value;
		if (!o?.shipExpressTrackingNo) return;
		const http = createHttp();
		const res:any = await http('/orders/_logistics/query', { method:'GET', query: { com: o?.shipExpressCompanyCode || undefined, no: o?.shipExpressTrackingNo } });
		const rawList:any[] = Array.isArray(res?.data?.list) ? res.data.list : [];
		const getTime = (it:any)=> it?.datetime || it?.time || '';
		const getRemark = (it:any)=> it?.remark || it?.context || '';
		rawList.sort((a,b)=> new Date(getTime(b)||0).getTime() - new Date(getTime(a)||0).getTime());
		traceList.value = rawList.map(it=>({ datetime: String(getTime(it)||'').trim(), remark: String(getRemark(it)||'').trim() }));
		mainTraceStatusDesc.value = String(res?.data?.status_desc || res?.data?.statusDesc || res?.data?.status || res?.msg || '');
	}catch{}
}

// #ifdef H5
function parseHashParams(): Record<string,string> {
	try{
		const h = String(location.hash || '');
		const q = h.includes('?') ? h.slice(h.indexOf('?') + 1) : '';
		const out: Record<string,string> = {};
		(q.split('&')||[]).forEach(p=>{
			const [k,v] = p.split('=');
			if (k) out[decodeURIComponent(k)] = decodeURIComponent(v||'');
		});
		return out;
	}catch{ return {}; }
}

async function handleHashChange(){
	try{
		const hash = String(location.hash||'');
		if (!hash.includes('/pages/order/detail')) return;
		const params = parseHashParams();
		const no = String(params.no||'').trim();
		const idNum = params.id ? Number(params.id) : NaN;
		if (!no && !idNum) return;
		const key = `no=${no}&id=${isNaN(idNum)?'':String(idNum)}`;
		if (key === lastKey.value) return;
		const http = createHttp();
		const data:any = no
			? await http(`/orders/by-no/${encodeURIComponent(no)}`, { method:'GET' })
			: await http(`/orders/${idNum}`, { method:'GET' });
		order.value = data || null;
		try{ timelineList.value = Array.isArray((data as any)?.timelines) ? (data as any).timelines : []; }catch{ timelineList.value = []; }
		showAllTimeline.value = false;
		hasPartialRefund.value = computePartialRefundFlag(data);
		const addr = getShippingAddress(order.value);
		if (addr) {
			addressLine1.value = `${addr.province||''} ${addr.city||''} ${addr.district||''} ${addr.street||''}`.replace(/\s+/g,' ').trim() || '-';
			addressLine2.value = (addr.detail||'').trim() || '-';
			addressLine3.value = (addr.phone||'').trim() || '-';
		} else {
			addressLine1.value = '-'; addressLine2.value = '-'; addressLine3.value = '-';
		}
		traceList.value = [];
		lastKey.value = key;
	}catch{}
}

onMounted(()=>{ try { window.addEventListener('hashchange', handleHashChange); } catch {} });
onUnmounted(()=>{ try { window.removeEventListener('hashchange', handleHashChange); } catch {} try{ if (countdownTimer){ clearInterval(countdownTimer); countdownTimer=null; } }catch{} try{ if (visibleRefreshTimer){ clearInterval(visibleRefreshTimer); visibleRefreshTimer=null; } }catch{} });
onHide(()=>{ try{ if (visibleRefreshTimer){ clearInterval(visibleRefreshTimer); visibleRefreshTimer=null; } }catch{} });
onUnload(()=>{ try{ if (visibleRefreshTimer){ clearInterval(visibleRefreshTimer); visibleRefreshTimer=null; } }catch{} });
// #endif

function toggleTimeline(){ showAllTimeline.value = !showAllTimeline.value; }
function zhEvent(e: string){
	const v = String(e||'').toUpperCase();
	if (v==='ORDER_STATUS') return '订单状态';
	if (v==='PAY_STATUS') return '支付状态';
	if (v==='FULFILLMENT') return '履约状态';
	if (v==='LOGISTICS') return '物流';
	if (v==='AFTERSALES') return '售后';
	if (v==='BENEFITS') return '权益变更';
	if (v==='REVIEW') return '评价';
	if (v==='NOTE') return '备注';
	return e || '-';
}

function zhTimelineValue(eventType?: string, value?: string, order?: any){
	const e = String(eventType||'').toUpperCase();
	const v = String(value||'').toUpperCase();
	if (!v) return '-';
	if (e==='ORDER_STATUS'){
		if (v==='CREATED') return '已创建';
		if (v==='PAID') return '已支付';
		if (v==='FULFILLED') return '已履约';
		if (v==='CLOSED') return '已完成';
		if (v==='CANCELLED') return '已取消';
	}
	if (e==='PAY_STATUS'){
		if (v==='UNPAID') return '未支付';
		if (v==='PAID') return '已支付';
		if (v==='REFUND_REQUESTED') return '已提交退款';
		if (v==='PARTIAL_REFUND') return '部分退款';
		if (v==='REFUNDED') return '已退款';
		if (v==='CANCELLED') return '已取消';
	}
	if (e==='FULFILLMENT'){
		const type = String(order?.type||'').toUpperCase();
		if (v==='PENDING') return type==='SERVICE' ? '待服务' : '待发货';
		if (v==='IN_SERVICE') return '服务中';
		if (v==='SHIPPED') return '已发货';
		if (v==='RECEIVED') return '已收货';
		if (v==='DONE') return '已完成';
	}
	if (e==='BENEFITS'){
		if (v==='WASHCARD_ROLLBACK') return '退款回收计次';
		if (v==='WASHCARD_DEDUCT') return '洗车卡划扣';
		if (v==='POINTS_ROLLBACK') return '返还积分';
		if (v==='COUPON_RESTORE') return '恢复优惠券';
		if (v==='COUPON_NOTE') return '优惠券说明';
	}
	if (e==='LOGISTICS'){
		if (v==='SHIPPED') return '已发货';
		if (v==='EXCHANGE_SHIPPED') return '换货已发货';
		if (v==='EDITED') return '已修改物流单号';
		return '物流更新';
	}
	if (e==='AFTERSALES'){
		if (v==='PENDING') return '处理中';
		if (v==='APPROVED') return '已同意';
		if (v==='REJECTED') return '已拒绝';
		if (v==='SUCCESS' || v==='COMPLETED') return '已完成';
		if (v==='CANCELLED') return '已取消';
	}
	if (e==='REVIEW'){
		if (v==='RATED') return '用户已评价';
		if (v==='REPLIED') return '商家已回复';
	}
	if (e==='NOTE'){
		if (v==='RECEIVED') return '用户已确认收货';
		if (v==='VIRTUAL_CARD_ISSUED') return '系统发放卡券完成';
		if (v==='WECHAT_MICROPAY') return '微信付款码支付';
		if (v==='CASHIER_DISCOUNT_ADJUST') return '收银立减调整';
		if (v==='GROUP_RECHARGE_CREDIT') return '集团余额充值入账';
		if (v==='GROUP_RECHARGE_REFUND_DEBIT') return '集团充值退款出账';
		if (v==='GROUP_BALANCE_PAY') return '集团余额支付';
		if (v==='GROUP_BALANCE_REFUND_CREDIT') return '集团余额退款入账';
	}
	return value || '-';
}

function zhRemark(eventType?: string, remark?: string){
	const e = String(eventType||'').toUpperCase();
	const r = String(remark||'').toUpperCase();
	if (!r) return '';
	if (e==='AFTERSALES'){
		if (r==='REFUND') return '仅退款';
		if (r==='RETURN') return '退货退款';
		if (r==='EXCHANGE') return '换货';
		if (r==='RE_SERVICE') return '重新服务';
	}
	if (e==='FULFILLMENT'){
		if (r==='EXCHANGE_RESET') return '换货流转重置';
		if (r==='RE_SERVICE_RESET') return '重新服务流转重置';
	}
	if (r==='TIMEOUT_15MIN') return '超时15分钟';
	if (e==='NOTE'){
		if (r==='USER_CONFIRMED') return '用户操作';
		if (r==='SYS_AUTO') return '系统自动';
		const raw = String(remark||'');
		const m = /交易成功；银行：([^；\s]+)；完成时间：([0-9]{14})/.exec(raw);
		if (m){
			const bank = m[1];
			const ts = m[2];
			const t = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)} ${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}`;
			const bankMap:any = { 'OTHERS':'其他' };
			const bankZh = bankMap[bank] || bank;
			return `交易成功，银行：${bankZh}，完成时间：${t}`;
		}
	}
	return remark || '';
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }
.title-bar { padding: 12rpx 8rpx; }
.title { font-size: 32rpx; font-weight: 700; }
.sub-title { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.kv { display:flex; align-items:flex-start; gap: 12rpx; padding: 10rpx 0; }
.kv .k { color:#6b7280; flex: none; min-width: 160rpx; white-space: nowrap; }
.kv .v { color:#111827; font-weight: 600; flex: 1; text-align: right; word-break: break-word; white-space: normal; }
.kv.kv--sub .k { font-size: 22rpx; color:#7c7f85; }
.kv.kv--sub .v { font-size: 22rpx; font-weight: 500; color:#444; }
.kv .v.v--small { font-size: 24rpx; font-weight: 500; color:#1f2937; }
.payment-note { white-space: pre-wrap; line-height: 1.6; color:#111827; font-weight:600; border: 2rpx dashed #e5e7eb; border-radius: 16rpx; padding: 16rpx; background: #fff; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.03); }
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
.kv.refunded .v { color:#ef4444; font-weight: 600; }

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

/* 物流卡片样式 */
.logistics-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }
.logistics-head { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.logistics-empty { font-size: 24rpx; color:#6b7280; }
.logistics-body { display:flex; align-items:center; gap: 12rpx; }
.logistics-logo { width: 48rpx; height: 48rpx; border-radius: 8rpx; background:#fff; }
.logistics-info { display:flex; flex-direction: column; gap: 6rpx; flex:1; min-width:0; }
.logistics-info .line { font-size: 24rpx; color:#1f2937; }
.trace-btn { padding: 10rpx 16rpx; border-radius: 999rpx; background:#111827; color:#fff; font-size: 24rpx; }
.trace-list { margin-top: 12rpx; display:flex; flex-direction: column; gap: 10rpx; }
.trace-item { display:flex; flex-direction: column; gap: 4rpx; background:#ffffff; border: 2rpx solid #e5e7eb; border-radius: 16rpx; padding: 12rpx; }
.trace-item .time { font-size: 22rpx; color:#6b7280; }
.trace-item .desc { font-size: 24rpx; color:#111827; }

/* 订单进度时间线样式 */
.timeline { display:flex; flex-direction: column; gap: 12rpx; margin-top: 8rpx; }
.timeline-row { position:relative; display:flex; flex-direction: column; gap: 4rpx; background:#ffffff; border: 2rpx dashed #e5e7eb; border-radius: 16rpx; padding: 12rpx 12rpx 12rpx 28rpx; }
.timeline-row::before { content: ""; position:absolute; left: 12rpx; top: 12rpx; bottom: 12rpx; width: 2rpx; background: #e5e7eb; }
.dot { position:absolute; left: 6rpx; top: 16rpx; width: 12rpx; height: 12rpx; border-radius: 999rpx; background: #94a3b8; box-shadow: 0 0 0 6rpx rgba(203,213,225,0.22); }
.timeline .time { font-size: 22rpx; color:#6b7280; }
.timeline .desc { font-size: 24rpx; color:#111827; }

/* 参照洗车卡时间线的彩色点：为不同事件/状态赋色 */
.timeline-row.tl--created .dot { background:#3b82f6; box-shadow: 0 0 0 6rpx rgba(59,130,246,0.12); }
.timeline-row.tl--unpaid .dot { background:#64748b; box-shadow: 0 0 0 6rpx rgba(100,116,139,0.12); }
.timeline-row.tl--paid .dot { background:#10b981; box-shadow: 0 0 0 6rpx rgba(16,185,129,0.12); }
.timeline-row.tl--pending .dot { background:#f59e0b; box-shadow: 0 0 0 6rpx rgba(245,158,11,0.12); }
.timeline-row.tl--inprogress .dot { background:#06b6d4; box-shadow: 0 0 0 6rpx rgba(6,182,212,0.12); }
.timeline-row.tl--done .dot { background:#84cc16; box-shadow: 0 0 0 6rpx rgba(132,204,22,0.12); }
.timeline-row.tl--cancelled .dot { background:#ef4444; box-shadow: 0 0 0 6rpx rgba(239,68,68,0.12); }
.timeline-row.tl--partial .dot { background:#a855f7; box-shadow: 0 0 0 6rpx rgba(168,85,247,0.12); }
.timeline-row.tl--aftersales .dot { background:#8b5cf6; box-shadow: 0 0 0 6rpx rgba(139,92,246,0.12); }
.timeline-row.tl--review .dot { background:#f97316; box-shadow: 0 0 0 6rpx rgba(249,115,22,0.12); }
.timeline-row.tl--benefit .dot { background:#0ea5e9; box-shadow: 0 0 0 6rpx rgba(14,165,233,0.12); }
.timeline-row.tl--note .dot { background:#94a3b8; box-shadow: 0 0 0 6rpx rgba(148,163,184,0.12); }

/* 展开全部/收起 胶囊按钮样式 */
.actions .btn { display:inline-flex; align-items:center; gap: 6rpx; padding: 8rpx 14rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#fff; }
.actions .btn .btn-icon { font-size: 20rpx; color:#6b7280; }
.actions .btn .btn-text { font-size: 24rpx; color:#374151; }
/* 底部操作区样式与列表页一致 */
.actions--footer { position: sticky; bottom: 0; background: transparent; display:flex; align-items:center; justify-content: flex-end; gap: 16rpx; padding: 12rpx 0 24rpx 0; }
.actions--footer .btn { padding: 10rpx 22rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx solid #ffd6e7; color:#1f2937; font-size: 24rpx; }
.actions--footer .btn.primary { background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#ffffff; border: none; overflow: hidden; }
.actions--footer .btn.ghost { background:#ffffff; color:#374151; border-color:#e5e7eb; }
</style>



