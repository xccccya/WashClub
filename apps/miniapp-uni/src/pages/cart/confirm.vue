<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="card">
			<view class="header">
				<text class="title">确认订单</text>
			</view>
			<view v-if="items.length===0" class="empty">暂无可结算商品</view>
			<view v-else class="list">
				<view v-for="it in items" :key="it.key" class="row">
					<image class="thumb" :src="resolveImageUrl(it.snapshot?.imageUrl) || '/static/icons/placeholder.png'" mode="aspectFill" />
					<view class="col-info">
						<view class="name">{{ it.snapshot?.name }}</view>
						<view class="spec">规格：{{ it.snapshot?.skuName || '默认' }}</view>
						<view class="price">¥{{ formatPrice(it.snapshot?.price) }}</view>
					</view>
					<view class="col-qty">
						<view class="btn" @tap="() => dec(it)">-</view>
						<text class="num">{{ it.quantity }}</text>
						<view class="btn" @tap="() => inc(it)">+</view>
					</view>
				</view>
			</view>
		</view>

		<!-- 地址选择卡片（若有实体商品则需要地址） -->
		<view class="card">
			<view class="block-title">收货地址</view>
			<view v-if="requiresAddress && addresses.length===0" class="addr-empty" @tap="gotoAddress">去新增收货地址</view>
			<scroll-view v-else-if="requiresAddress" scroll-y class="addr-list">
				<view v-for="a in addresses" :key="a.id" class="addr-card" :class="{ active: a.id===selectedAddressId }" @tap="() => selectAddress(a.id)">
					<text class="addr-line1">{{ a.province }} {{ a.city }} {{ a.district }} {{ a.street }}</text>
					<text class="addr-line2">{{ a.detail }}</text>
					<text class="addr-line3">{{ a.phone }}</text>
				</view>
			</scroll-view>
			<view v-if="requiresAddress" class="addr-manage" @tap="gotoAddress">管理地址</view>
			<!-- 优惠券选择（在支付方式前） -->
			<view class="block-title">优惠券</view>
			<view v-if="couponLoading" class="tip">加载可用优惠券...</view>
			<view v-else-if="applicableCoupons.length===0" class="tip">暂无可用优惠券</view>
			<view v-else class="coupon-list">
				<view v-for="c in applicableCoupons" :key="c.id" class="coupon-chip" :class="{ active: selectedCouponIds.has(c.id), disabled: disabledByCombine(c) }" @tap="() => toggleCoupon(c)">
					<text class="c-name">{{ c.name }}</text>
					<text class="c-discount">-¥{{ formatPrice(c.discountApplied) }}</text>
					<text v-if="!c.allowCombine" class="c-tag">不可叠加</text>
				</view>
			</view>
			<view class="tip" v-if="couponDiscount>0">预计优惠：¥{{ formatPrice(couponDiscount) }}，应付：¥{{ payAmountWithCouponText }}</view>

			<!-- 支付方式与备注 -->
			<view class="block-title">支付方式</view>
			<view class="pay-row">
				<!-- #ifdef MP-WEIXIN -->
				<view class="pay-chip" :class="{ active: payMethod==='WECHAT' }" @tap="() => setPayMethod('WECHAT')">微信支付</view>
				<!-- #endif -->
				<view class="pay-chip" :class="{ active: payMethod==='OFFLINE' }" @tap="() => setPayMethod('OFFLINE')">线下支付（现金/收钱吧）</view>
			</view>
			<view class="tip" v-if="payMethod==='OFFLINE'">支付后由门店在后台确认收款</view>
		</view>
		<view class="card">
			<view class="block-title">备注</view>
			<textarea class="remark" v-model="remark" placeholder="选填：如需特别说明" maxlength="120" />
		</view>

		<view class="bottom-bar" v-if="items.length>0">
			<view class="summary">
				<text class="label">合计：</text>
				<text class="amount">¥{{ payAmountWithCouponText }}</text>
			</view>
			<view class="checkout" @tap="submit">立即支付¥{{ payAmountWithCouponText }}</view>
		</view>
	</view>
</template>

<script setup lang="ts">
declare const uni: any;
import { ref, computed } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { checkAuthAndRefresh, createHttp } from '../../utils/auth';
import { resolveImageUrl } from '../../utils/url';

const { topSpacerHeight, statusBarHeight } = useSafeArea();

function goBack(){
	try {
		uni.navigateBack();
	} catch { uni.reLaunch({ url: '/pages/cart/index' }); }
}

function formatPrice(p:any){ const n=Number(p); return isNaN(n)? '0.00' : n.toFixed(2); }

const items = ref<any[]>([]);
const remark = ref<string>('');
const payMethod = ref<'WECHAT'|'OFFLINE'|undefined>(undefined);
// #ifdef MP-WEIXIN
payMethod.value = 'WECHAT';
// #endif
const couponLoading = ref<boolean>(false);
const applicableCoupons = ref<Array<{ id:number; couponId:number; name:string; allowCombine:boolean; discountApplied:number }>>([]);
const selectedCouponIds = ref<Set<number>>(new Set());
type Address = { id: number; province: string; city: string; district: string; street: string; detail: string; phone: string };
const addresses = ref<Address[]>([]);
const selectedAddressId = ref<number|undefined>(undefined);

async function loadSelected(){
	try { const http=createHttp(); items.value = await http<any[]>('/cart/me/list', { method:'GET', query:{ onlyChecked: true } }); } catch { items.value = []; }
	// 若包含实体商品则加载地址
	if (requiresAddress.value) {
		try {
			const http = createHttp();
			const list = await http<Address[]>('/address/me/list', { method:'GET' });
			addresses.value = Array.isArray(list) ? list : [];
			selectedAddressId.value = addresses.value[0]?.id;
		} catch { addresses.value = []; selectedAddressId.value = undefined; }
	} else { addresses.value = []; selectedAddressId.value = undefined; }
}

async function saveBack(){ /* 实时写入后端，不需要本地回写 */ }

async function inc(it:any){
    try{
        const http = createHttp();
        const prod:any = await http(`/store/products/${it.productId}`, { method:'GET' });
        let max = 99;
        if (String(prod?.type||'') !== 'SERVICE'){
            if (String(prod?.specType||'') === 'MULTI'){
                const sku = (Array.isArray(prod?.skus)? prod.skus:[]).find((s:any)=> s?.id===it.skuId);
                max = Math.max(1, Math.min(99, Number(sku?.stockQuantity||0)));
            } else {
                max = Math.max(1, Math.min(99, Number(prod?.stockQuantity||0)));
            }
        }
        const next = Math.min(max, Number(it.quantity||0)+1);
        if (next === Number(it.quantity||0)) { uni.showToast({ title:'超过商品库存', icon:'none' }); return; }
        it.quantity = next; await saveBack();
        try{ await loadApplicableCoupons(); }catch{}
    }catch{}
}
function dec(it:any){ it.quantity = Math.max(1, Number(it.quantity||0)-1); saveBack(); try{ loadApplicableCoupons(); }catch{} }

const totalAmount = computed(()=> items.value.reduce((sum:number, it:any)=> sum + Number(it?.snapshot?.price||0)*Number(it.quantity||0), 0));
const totalAmountText = computed(()=> totalAmount.value.toFixed(2));
const couponDiscount = computed(()=> Array.from(selectedCouponIds.value).reduce((s, id)=>{ const c = applicableCoupons.value.find(x=>x.id===id); return s + (c ? Number(c.discountApplied||0) : 0); }, 0));
const payAmountWithCoupon = computed(()=> Math.max(0, Number(totalAmount.value) - couponDiscount.value));
const payAmountWithCouponText = computed(()=> payAmountWithCoupon.value.toFixed(2));
const requiresAddress = computed(()=> items.value.some(it => String(it?.snapshot?.type||'')==='PHYSICAL'));
function gotoAddress(){ try { uni.navigateTo({ url: '/pages/address/index' }); } catch {} }
function selectAddress(id?: number){ selectedAddressId.value = id; }
function setPayMethod(m: 'WECHAT'|'OFFLINE'){ payMethod.value = m; }
function buildApplicableItems(){ return items.value.map(it=>({ productId: it.productId, price: Number(it?.snapshot?.price||0), quantity: Number(it.quantity||0) })); }
function disabledByCombine(c:any){ if (!c) return false; if (selectedCouponIds.value.has(c.id)) return false; if (!c.allowCombine && selectedCouponIds.value.size>0) return true; return false; }
function toggleCoupon(c:any){ if (!c) return; if (disabledByCombine(c)) return; const set=new Set(selectedCouponIds.value); if (set.has(c.id)) set.delete(c.id); else set.add(c.id); selectedCouponIds.value=set; }
async function loadApplicableCoupons(){
    couponLoading.value = true;
    try{
        const http = createHttp();
        const body:any = { items: buildApplicableItems() };
        const res:any = await http('/coupon/miniapp/applicable', { method:'POST', body });
        applicableCoupons.value = Array.isArray(res?.applicable) ? res.applicable : [];
        selectedCouponIds.value = new Set(applicableCoupons.value.length ? [applicableCoupons.value[0].id] : []);
    }catch{ applicableCoupons.value=[]; selectedCouponIds.value=new Set(); }
    finally{ couponLoading.value = false; }
}

async function submit(){
	const authed = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!authed) return;
	const http = createHttp();
	// 拉取 profile 获取 memberId
	let profile:any=null; try { profile = await http('/member/me/profile', { method:'GET' }); } catch {}
	const memberId = Number(profile?.id||0); if (!memberId){ uni.showToast({ title:'请先登录', icon:'none' }); return; }
	// 组装订单项（仅实体商品 SP）
	const orderItems = items.value.map(it=>({
		productId: it.productId,
		skuId: it.skuId || undefined,
		name: it.snapshot?.name,
		imageUrl: it.snapshot?.imageUrl || null,
		specsText: it?.snapshot?.skuName ? String(it.snapshot.skuName) : '默认规格',
		price: Number(it?.snapshot?.price||0),
		discount: 0,
		quantity: Number(it.quantity||0)
	}));
	if (orderItems.length===0){ uni.showToast({ title:'没有可结算商品', icon:'none' }); return; }
	// 校验地址（含实体商品时）
	if (requiresAddress.value) {
		if (!addresses.value.length) { uni.showToast({ title:'请先添加收货地址', icon:'none' }); return; }
		if (!selectedAddressId.value) { uni.showToast({ title:'请选择收货地址', icon:'none' }); return; }
	}
	if (!payMethod.value) { uni.showToast({ title:'请选择支付方式', icon:'none' }); return; }
	const body:any = { type: 'SP', memberId, items: orderItems, userRemark: remark.value || undefined, shippingAddressId: requiresAddress.value ? selectedAddressId.value : undefined, memberCouponIds: Array.from(selectedCouponIds.value) };
	try {
		const created = await http<any>('/orders', { method:'POST', body });
		// 清理后端已勾选条目
		try { await http('/cart/me/clear-checked', { method:'DELETE' }); } catch {}
		if (payMethod.value === 'WECHAT'){
			try{
				const params:any = await http(`/orders/${created?.id}/pay/wechat-jsapi`, { method:'POST' });
				// #ifdef MP-WEIXIN
				await new Promise<void>((resolve,reject)=>{
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
				uni.showToast({ title:'支付成功', icon:'success' });
				setTimeout(()=>{ try { uni.navigateTo({ url: `/pages/order/detail?no=${created?.no||''}` }); } catch {} }, 200);
				// #endif
				// #ifndef MP-WEIXIN
				uni.showToast({ title:'请在微信小程序内完成支付', icon:'none' });
				// #endif
			} catch {
				uni.showToast({ title:'支付未完成', icon:'none' });
				setTimeout(()=>{ try { uni.navigateTo({ url: `/pages/order/detail?no=${created?.no||''}` }); } catch {} }, 200);
			}
		} else {
			uni.showToast({ title:'下单成功，线下支付', icon:'none' });
			setTimeout(()=>{ try { uni.navigateTo({ url: `/pages/order/detail?no=${created?.no||''}` }); } catch {} }, 300);
		}
	} catch (e:any) {
		uni.showToast({ title: e?.message || '下单失败', icon:'none' });
	}
}

// 进入页面时先校验登录，再加载选中商品与可用优惠券
(async ()=>{
	const authed = await checkAuthAndRefresh({ redirectIfExpired: true });
	if (!authed) { items.value = []; applicableCoupons.value = []; selectedCouponIds.value = new Set(); return; }
	await loadSelected();
	await loadApplicableCoupons();
})();
</script>

<style>
.page { min-height: 100vh; padding: 24rpx 24rpx 140rpx 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom: 24rpx; }
.header { display:flex; align-items:center; justify-content: space-between; }
.title { font-size: 32rpx; font-weight: 800; color:#0b1220; }
.empty { padding: 24rpx; color:#6b7280; text-align:center; }
.list { display:flex; flex-direction: column; gap: 16rpx; }
.row { display:flex; gap: 12rpx; align-items: center; background:#f9fafb; border: 2rpx solid #e5e7eb; border-radius: 16rpx; padding: 12rpx; }
.thumb { width: 120rpx; height: 120rpx; border-radius: 12rpx; background:#f3f4f6; }
.col-info { flex:1; display:flex; flex-direction: column; gap: 6rpx; }
.name { font-size: 28rpx; color:#111827; font-weight: 600; }
.spec { font-size: 22rpx; color:#6b7280; }
.price { font-size: 26rpx; color:#ef4444; font-weight: 700; }
.col-qty { display:flex; align-items:center; gap: 8rpx; }
.col-qty .btn { width: 42rpx; height: 42rpx; border-radius: 10rpx; background:#e5e7eb; text-align:center; line-height: 42rpx; }
.col-qty .num { min-width: 48rpx; text-align:center; }

/* 支付/备注 */
.block-title { font-size: 26rpx; color:#374151; margin-bottom: 8rpx; }
.pay-row { display:flex; gap: 12rpx; flex-wrap: wrap; }
.pay-chip { display:inline-flex; padding: 12rpx 18rpx; border-radius: 999rpx; background:#e5e7eb; color:#111827; font-size: 24rpx; }
.pay-chip.active { background:#111827; color:#fff; }
.tip { margin-top: 6rpx; color:#6b7280; font-size: 22rpx; }
.coupon-list { display:flex; flex-wrap: wrap; gap: 10rpx; margin-top: 8rpx; }
.coupon-chip { display:inline-flex; align-items:center; gap: 8rpx; padding: 10rpx 14rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#fff; color:#111827; }
.coupon-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; border-color: transparent; }
.coupon-chip.disabled { opacity: .6; }
.coupon-chip .c-name { font-size: 22rpx; }
.coupon-chip .c-discount { font-size: 22rpx; color:#ef4444; font-weight: 700; }
.coupon-chip .c-tag { font-size: 20rpx; color:#374151; background:#f3f4f6; padding: 2rpx 8rpx; border-radius: 999rpx; }
.remark { width: 100%; min-height: 120rpx; background:#f9fafb; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 12rpx; box-sizing: border-box; }

.bottom-bar { position: fixed; left:0; right:0; bottom:0; background:#ffffff; border-top: 2rpx solid #e5e7eb; padding: 12rpx 16rpx; display:flex; align-items:center; justify-content: space-between; gap: 12rpx; box-sizing: border-box; }
.summary { display:flex; align-items: baseline; gap: 6rpx; }
.label { font-size: 24rpx; color:#6b7280; }
.amount { font-size: 30rpx; color:#ef4444; font-weight: 800; }
.checkout { padding: 18rpx 22rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; border-radius: 16rpx; font-size: 26rpx; }

/* 返回按钮 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }

/* 地址选择（纵向卡片列表） */
.addr-empty { padding: 12rpx 16rpx; background:#f9fafb; border: 2rpx dashed #e5e7eb; border-radius: 12rpx; text-align:center; color:#6b7280; font-size: 24rpx; }
.addr-list { max-height: 260rpx; }
.addr-card { background: #f8fbff; border: 2rpx solid #dbeafe; border-radius: 16rpx; padding: 16rpx; margin-bottom: 12rpx; }
.addr-card.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.addr-line1 { display:block; color:#0b1220; font-size: 26rpx; }
.addr-line2 { display:block; color:#6b7280; font-size: 24rpx; margin-top: 6rpx; }
.addr-line3 { display:block; color:#6b7280; font-size: 24rpx; margin-top: 6rpx; }
.addr-card.active .addr-line1, .addr-card.active .addr-line2, .addr-card.active .addr-line3 { color:#fff; }
.addr-manage { margin-top: 8rpx; padding: 8rpx 12rpx; display:inline-flex; align-items:center; gap: 6rpx; background:#f1f5ff; color:#1d4ed8; border-radius: 999rpx; font-size: 22rpx; }
.addr-manage:after { content:'›'; font-size: 22rpx; line-height: 1; }

</style>
