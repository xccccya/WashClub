<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="title-bar">
			<text class="title">退款/售后申请</text>
		</view>

		<view class="card">
			<view class="sub-title">申请类型</view>
			<view class="chip-row">
				<view v-for="(t,idx) in visibleTypeOptions" :key="idx" class="chip" :class="{ active: typeIndex===idx }" @tap="setTypeIndex(idx)">{{ t }}</view>
			</view>
		</view>

		<view class="card" v-if="currentType==='REFUND'">
			<view class="sub-title">退款理由</view>
			<radio-group @change="(e:any)=> refundReason=e.detail.value">
				<label class="radio-item" v-for="r in refundReasonOptions" :key="r.v">
					<radio :value="r.v" :checked="refundReason===r.v" />
					<text>{{ r.t }}</text>
				</label>
			</radio-group>
		</view>

		<view class="card" v-if="currentType==='EXCHANGE'">
			<view class="sub-title">换货理由</view>
			<radio-group @change="(e:any)=> exchangeReason=e.detail.value">
				<label class="radio-item" v-for="r in exchangeReasonOptions" :key="r.v">
					<radio :value="r.v" :checked="exchangeReason===r.v" />
					<text>{{ r.t }}</text>
				</label>
			</radio-group>
			<view class="sub-title" style="margin-top:12rpx;">换货收货地址</view>
			<view v-if="addresses.length===0" class="addr-empty" @tap="gotoAddress">去新增收货地址</view>
			<scroll-view v-else scroll-y class="addr-list">
				<view v-for="a in addresses" :key="a.id" class="addr-card" :class="{ active: a.id===selectedAddressId }" :data-id="a.id" @tap="onSelectAddress">
					<text class="addr-line1">{{ a.province }} {{ a.city }} {{ a.district }} {{ a.street }}</text>
					<text class="addr-line2">{{ a.detail }}</text>
					<text class="addr-line3">{{ a.phone }}</text>
				</view>
			</scroll-view>
			<view class="addr-manage" @tap="gotoAddress">管理地址</view>
		</view>

		<view class="card" v-if="currentType==='RE_SERVICE'">
			<view class="sub-title">重新服务理由</view>
			<radio-group @change="(e:any)=> reServiceReason=e.detail.value">
				<label class="radio-item" v-for="r in reServiceReasonOptions" :key="r.v">
					<radio :value="r.v" :checked="reServiceReason===r.v" />
					<text>{{ r.t }}</text>
				</label>
			</radio-group>
		</view>

		<view class="card">
			<view class="sub-title">补充描述</view>
			<textarea class="textarea" placeholder="请补充说明（可选）" v-model="description" />
		</view>

		<view class="card">
			<view class="sub-title">上传凭证</view>
			<view class="upload-row">
				<view class="u-item" v-for="(img,idx) in images" :key="idx">
					<image :src="img" class="u-thumb" mode="aspectFill" @tap="preview(img)" />
				</view>
				<view class="u-add" @tap="chooseImages">+
				</view>
			</view>
		</view>

		<view class="fixed-bar">
			<view class="btn primary" @tap="submit">提交申请</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { checkAuthAndRefresh, API_BASE, getToken } from '../../utils/auth';
import { addressControllerMyList, orderControllerCreateAfterSales } from '@wash/api-client';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

const orderId = ref<number>(0);
const orderType = ref<'SERVICE'|'SP'|'FK'>('SP');
const pageType = ref<'refund'|'aftersales'>('aftersales');

const allTypeOptions = ['退款','换货','重新服务'];
const typeIndex = ref<number>(0);
const currentType = computed<'REFUND'|'EXCHANGE'|'RE_SERVICE'>(()=> {
    // 基于可见选项的索引映射
    const arr = visibleTypeOptions.value;
    const label = arr[typeIndex.value] || '退款';
    return label==='退款' ? 'REFUND' : label==='换货' ? 'EXCHANGE' : 'RE_SERVICE';
});
const visibleTypeOptions = computed<string[]>(()=>{
    // refund 页面仅显示退款
    if (pageType.value==='refund') return ['退款'];
    // aftersales 页面：根据订单类型限定
    const opts:string[] = ['退款'];
    if (orderType.value==='SP') opts.push('换货');
    if (orderType.value==='SERVICE') opts.push('重新服务');
    return opts;
});
function setTypeIndex(idx:number){ if (idx<0) idx=0; if (idx>=visibleTypeOptions.value.length) idx=visibleTypeOptions.value.length-1; typeIndex.value = idx; }
function onTypeChange(){ /* 不再使用 picker，此函数留空以兼容旧引用 */ }

const refundReasonOptions = [
	{ v:'NO_LONGER_NEED', t:'不想要了' },
	{ v:'PRICE_OR_COUPON', t:'买贵了/少用优惠' },
	{ v:'NOT_RECEIVED_OR_UNUSED', t:'未收到商品/未使用服务' },
];
const exchangeReasonOptions = [
	{ v:'OTHER', t:'其他' },
	{ v:'QUALITY', t:'质量问题' },
	{ v:'MISSING_OR_DAMAGED', t:'收到商品少件/破损/变形等' },
	{ v:'NOT_LIKE', t:'拍错/不喜欢/不合适' },
	{ v:'SELLER_WRONG', t:'卖家发错货' },
	{ v:'POOR_WORKMANSHIP', t:'做工粗糙/有瑕疵' },
];
const reServiceReasonOptions = [
	{ v:'NOT_SATISFIED', t:'不满意服务效果' },
	{ v:'UNFINISHED', t:'未完成服务说明的所有项目' },
	{ v:'OTHER', t:'其他' },
];

const refundReason = ref<string>('NO_LONGER_NEED');
const exchangeReason = ref<string>('OTHER');
const reServiceReason = ref<string>('NOT_SATISFIED');
const description = ref<string>('');
const images = ref<string[]>([]);
type Address = { id: number; province: string; city: string; district: string; street: string; detail: string; phone: string };
const addresses = ref<Address[]>([]);
const selectedAddressId = ref<number | undefined>(undefined);

function goBack(){
	const pages = getCurrentPages?.() || [];
	if (pages.length > 1) { uni.navigateBack(); return; }
	uni.reLaunch({ url: '/pages/order/index' });
}

function preview(url: string){ uni.previewImage({ urls: [url] }); }

async function chooseImages(){
	try{
		const r:any = await new Promise((resolve)=> uni.chooseImage({ count: 6, success: resolve, fail: ()=>resolve(null) }));
		if (!r || !Array.isArray(r.tempFilePaths)) return;
		const joinUrl = (base:string, pathStr:string) => {
			if (!pathStr) return '';
			if (/^https?:\/\//i.test(pathStr)) return pathStr;
			const b = String(base||'').replace(/\/+$/, '');
			const p = String(pathStr||'').replace(/^\/+/, '');
			return b + '/' + p;
		};
		for (const filePath of r.tempFilePaths){
			await new Promise<void>((resolve)=>{
				const base = API_BASE || '';
				const token = getToken() || '';
				uni.uploadFile({
					url: base + '/assets/upload',
					filePath,
					name: 'file',
					formData: { dir: 'miniapp', source: 'order-aftersales' },
					header: { Authorization: token ? ('Bearer ' + token) : '' },
					success: (res:any)=>{
						try{
							const j = JSON.parse(res.data||'{}');
							const u = j?.url || '';
							const full = joinUrl(base, u);
							if (full) images.value.push(full);
						} catch{}
						resolve();
					},
					fail: ()=> resolve(),
				});
			});
		}
	}catch{}
}

onLoad((q:any)=>{
	orderId.value = Number(q?.orderId||0) || 0;
	pageType.value = (String(q?.type||'aftersales')==='refund') ? 'refund' : 'aftersales';
	if (pageType.value==='refund') typeIndex.value = 0;
	const t = String(q?.orderType||'').toUpperCase();
	if (t==='SERVICE') { orderType.value = 'SERVICE'; }
	else if (t==='SP') { orderType.value = 'SP'; }
    // 预取地址数据（便于换货）
    loadAddresses();
});

async function loadAddresses(){
    try{
        const list = await (addressControllerMyList({} as any) as any);
        addresses.value = Array.isArray(list) ? list : [];
        selectedAddressId.value = addresses.value[0]?.id;
    }catch{ addresses.value = []; selectedAddressId.value = undefined; }
}
function onSelectAddress(e:any){ try { const id = Number(e?.currentTarget?.dataset?.id ?? e?.target?.dataset?.id); if (Number.isFinite(id)) selectedAddressId.value = id; } catch {} }
function gotoAddress(){ try { uni.navigateTo({ url: '/pages/address/index' }); } catch {} }

async function submit(){
	try{
		const authed = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!authed) return;
		// 可见类型由 visibleTypeOptions 限定，不再强制回退索引，避免 SERVICE 的“重新服务”被误改为“退款”
		const payload:any = {
			type: currentType.value,
			reasonCode: currentType.value==='REFUND' ? refundReason.value : currentType.value==='EXCHANGE' ? exchangeReason.value : reServiceReason.value,
			description: description.value,
			images: images.value,
			exchangeAddress: currentType.value==='EXCHANGE' ? (addresses.value.find(a=>a.id===selectedAddressId.value) || undefined) : undefined,
		};
		await orderControllerCreateAfterSales(Number(orderId.value||0), { body: payload } as any);
		uni.showToast({ title:'已提交', icon:'success' });
		setTimeout(()=>{ goBack(); }, 600);
	}catch{ uni.showToast({ title:'提交失败，请稍后再试', icon:'none' }); }
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; padding-bottom: calc(env(safe-area-inset-bottom) + 120rpx); }
.title-bar { padding: 12rpx 8rpx; }
.title { font-size: 32rpx; font-weight: 700; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin:0 2rpx 24rpx 2rpx; }
.sub-title { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.row { display:flex; align-items:center; justify-content: space-between; }
.picker { padding: 16rpx; background:#fff; border-radius: 12rpx; border: 2rpx solid #e5e7eb; min-width: 300rpx; }
.radio-item { display:flex; align-items:center; gap: 12rpx; padding: 12rpx 0; }
.input { padding: 16rpx; background:#fff; border-radius: 12rpx; border: 2rpx solid #e5e7eb; }
.textarea { width: 100%; max-width: 100%; min-height: 160rpx; padding: 16rpx; box-sizing: border-box; display:block; background:#fff; border-radius: 12rpx; border: 2rpx solid #e5e7eb; overflow: hidden; }
.upload-row { display:flex; align-items:center; gap: 12rpx; flex-wrap: wrap; }
.u-item { width: 160rpx; height: 160rpx; border-radius: 16rpx; overflow:hidden; border: 2rpx solid #e5e7eb; }
.u-thumb { width: 100%; height: 100%; display:block; }
.u-add { width: 160rpx; height: 160rpx; border-radius: 16rpx; background:#fff; border: 2rpx dashed #9ca3af; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size: 40rpx; }
.fixed-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 16rpx 24rpx; background: rgba(255,255,255,0.9); box-shadow: 0 -8rpx 24rpx rgba(0,0,0,0.06); }
.btn { padding: 16rpx 24rpx; border-radius: 999rpx; text-align:center; }
.btn.primary { color: #fff; background: linear-gradient(135deg, #60a5fa, #a78bfa); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
/* 申请类型按钮样式 */
.chip-row { display:flex; gap: 12rpx; flex-wrap: wrap; }
.chip { display:inline-flex; padding: 12rpx 18rpx; border-radius: 999rpx; background:#e5e7eb; color:#111827; font-size: 24rpx; }
.chip.active { background:#111827; color:#fff; }
/* 地址选择（复用下单样式） */
.addr-empty { padding: 12rpx 16rpx; background:#f9fafb; border: 2rpx dashed #e5e7eb; border-radius: 12rpx; text-align:center; color:#6b7280; font-size: 24rpx; }
.addr-list { max-height: 260rpx; }
.addr-card { background: #f8fbff; border: 2rpx solid #dbeafe; border-radius: 16rpx; padding: 16rpx; margin-bottom: 12rpx; }
.addr-card.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.addr-line1 { display:block; color:#0b1220; font-size: 26rpx; }
.addr-line2 { display:block; color:#6b7280; font-size: 24rpx; margin-top: 6rpx; }
.addr-line3 { display:block; color:#6b7280; font-size: 24rpx; margin-top: 6rpx; }
.addr-manage { margin-top: 8rpx; padding: 8rpx 12rpx; display:inline-flex; align-items:center; gap: 6rpx; background:#f1f5ff; color:#1d4ed8; border-radius: 999rpx; font-size: 22rpx; }
.addr-manage:after { content:'›'; font-size: 22rpx; line-height: 1; }
/* #ifdef H5 */
.textarea { width: calc(100% - 30rpx); }
/* #endif */
</style>


