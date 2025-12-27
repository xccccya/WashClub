<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="card">
			<view class="card-inner">
				<view class="header">
					<text class="title">我的购物车</text>
				</view>
				<view v-if="items.length===0" class="empty">购物车空空如也，去商店逛逛吧~</view>
				<view v-else>
					<view class="toolbar">
						<label class="checkbox" @tap="toggleAll">
							<view class="box" :class="{ on: allChecked }">
								<!-- #ifdef H5 -->
								<svg v-if="allChecked" class="tick-svg" width="200" height="200" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M896 288a32 32 0 0 0-54.656-22.592L416 690.752 182.656 457.408a32 32 0 1 0-45.264 45.232l255.952 255.952c5.808 5.824 13.808 9.408 22.656 9.408s16.848-3.584 22.64-9.392l447.952-447.952c5.824-5.808 9.408-13.808 9.408-22.656z" fill="#231815" class=""></path></svg>
								<!-- #endif -->
								<!-- #ifndef H5 -->
								<image v-if="allChecked" class="tick-img" src="/static/icons/ok.png" mode="aspectFit" />
								<!-- #endif -->
							</view>
							<text class="txt">全选</text>
						</label>
					</view>

					<view class="list">
						<view v-for="it in items" :key="it.key" class="row">
							<view class="col-check" @tap="toggleItem(it)">
								<view class="box" :class="{ on: it.checked }">
									<!-- #ifdef H5 -->
									<svg v-if="it.checked" class="tick-svg" width="200" height="200" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M896 288a32 32 0 0 0-54.656-22.592L416 690.752 182.656 457.408a32 32 0 1 0-45.264 45.232l255.952 255.952c5.808 5.824 13.808 9.408 22.656 9.408s16.848-3.584 22.64-9.392l447.952-447.952c5.824-5.808 9.408-13.808 9.408-22.656z" fill="#231815" class=""></path></svg>
									<!-- #endif -->
									<!-- #ifndef H5 -->
									<image v-if="it.checked" class="tick-img" src="/static/icons/ok.png" mode="aspectFit" />
									<!-- #endif -->
								</view>
							</view>
							<image class="thumb" :src="resolveImageUrl(it.snapshot?.imageUrl) || '/static/icons/placeholder.png'" mode="aspectFill" />
							<view class="col-info">
								<view class="name">{{ it.snapshot?.name }}</view>
								<view v-if="isMultiSpec(it)" class="spec" @tap="() => openSkuPicker(it)">{{ displaySpecs(it) }} ▼</view>
								<view v-else class="spec">{{ displaySpecs(it) }}</view>
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

				<!-- 优惠券预计信息卡片（独立卡片，美观） -->
				<view class="coupon-card">
					<view class="coupon-card__header">
						<text class="coupon-card__title">优惠券</text>
						<text class="coupon-card__subtitle">为当前勾选商品智能匹配</text>
					</view>
					<view v-if="couponLoading" class="coupon-card__loading">加载可用优惠券...</view>
					<view v-else>
						<view v-if="applicableCoupons.length===0" class="coupon-card__empty">暂无可用优惠券</view>
						<view v-else class="coupon-card__chips">
							<view v-for="c in applicableCoupons" :key="c.id" class="coupon-chip" :class="{ active: selectedCouponIds.has(c.id), disabled: disabledByCombine(c) }" @tap="() => toggleCoupon(c)">
								<text class="c-name">{{ c.name }}</text>
								<text class="c-discount">-¥{{ formatPrice(c.discountApplied) }}</text>
								<text v-if="c.allowCombine===false" class="c-tag">不可叠加其他券</text>
								<text v-if="c.allowStackWithPoints===false" class="c-tag">不可叠加积分抵扣</text>
								<text v-if="c.allowStackWithMemberDiscount===false" class="c-tag">不可叠加会员折扣</text>
							</view>
						</view>
						<view class="coupon-card__summary">
							<text class="sum-label">预计优惠</text>
							<text class="sum-discount">-¥{{ formatPrice(couponDiscount) }}</text>
							<text class="sum-split">·</text>
							<text class="sum-label">券后预计</text>
							<text class="sum-pay">¥{{ expectedPayAmountText }}</text>
						</view>
					</view>
				</view>

				<!-- 积分与会员折扣说明卡片 -->
				<view class="coupon-card" v-if="checkedCount>0">
					<view class="coupon-card__header">
						<text class="coupon-card__title">会员与积分</text>
						<text class="coupon-card__subtitle">基于当前勾选商品预计</text>
					</view>
					<view>
						<view class="coupon-card__tags">
							<text class="meta-tag" v-if="supportsMemberDiscount && memberPayDiscountPercent>0 && memberDiscountAllowedByCoupons && memberDiscountEstYuan>0">会员折扣 -¥{{ memberDiscountEstText }}</text>
							<text class="meta-tag" v-else>会员折扣 无</text>
							<text class="meta-tag" v-if="supportsPoints && fenPerPoint>0 && pointsAllowedByCoupons">积分：100分=¥{{ (fenPerPoint/100).toFixed(2) }}，单笔上限¥{{ maxDeductYuanText }}</text>
							<text class="meta-tag" v-else-if="supportsPoints && fenPerPoint>0 && !pointsAllowedByCoupons">积分：与所选优惠券不可叠加</text>
							<text class="meta-tag" v-else>积分抵扣 未开启</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<view class="bottom-bar" v-if="items.length>0">
			<label class="checkbox" @tap="toggleAll">
				<view class="box" :class="{ on: allChecked }">
					<!-- #ifdef H5 -->
					<svg v-if="allChecked" class="tick-svg" width="200" height="200" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M896 288a32 32 0 0 0-54.656-22.592L416 690.752 182.656 457.408a32 32 0 1 0-45.264 45.232l255.952 255.952c5.808 5.824 13.808 9.408 22.656 9.408s16.848-3.584 22.64-9.392l447.952-447.952c5.824-5.808 9.408-13.808 9.408-22.656z" fill="#231815" class=""></path></svg>
					<!-- #endif -->
					<!-- #ifndef H5 -->
					<image v-if="allChecked" class="tick-img" src="/static/icons/ok.png" mode="aspectFit" />
					<!-- #endif -->
				</view>
				<text class="txt">全选</text>
			</label>
			<view class="summary">
				<text class="label">合计：</text>
				<text class="amount">¥{{ expectedPayAmountText }}</text>
			</view>
			<view class="checkout" @tap="checkout">去结算¥{{ expectedPayAmountText }}</view>
		</view>

		<!-- 规格选择器（维度化选择） -->
		<view v-if="skuPicker.visible" class="sheet-backdrop" @tap="closeSkuPicker">
			<view class="sheet" @tap.stop>
				<view class="sheet-header"><text class="title">选择规格</text><view class="close" @tap="closeSkuPicker">×</view></view>
				<view v-for="key in specKeys" :key="key" class="spec-group">
					<text class="spec-key">{{ key }}</text>
					<view class="spec-row">
						<view v-for="val in specOptions[key]" :key="val" class="spec-chip" :class="{ active: selectedSpecValues[key]===val, disabled: isOptionDisabled(key, val) }" @tap="() => onSelectSpec(key, val)">{{ val }}</view>
					</view>
				</view>
				<view class="footer"><view class="submit" @tap="applySku">确定</view></view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
declare const uni: any;
declare function getCurrentPages(): any[];
import { computed, reactive, ref, watch } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { checkAuthAndRefresh } from '../../utils/auth';
import { resolveImageUrl } from '../../utils/url';
import {
	cartControllerClearChecked,
	cartControllerMyDelete,
	cartControllerMyList,
	cartControllerMyUpdate,
	cartControllerToggleAll,
	memberControllerMe,
	miniappCouponControllerApplicable,
	storeProductControllerGet,
	systemSettingControllerGetPublicSetting,
} from '@wash/api-client';


const { topSpacerHeight, statusBarHeight } = useSafeArea();

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/store/index' });
	} catch { uni.reLaunch({ url: '/pages/store/index' }); }
}

function formatPrice(p:any){ const n=Number(p); return isNaN(n)? '0.00' : n.toFixed(2); }

// 购物车存储结构
// key: `${productId}-${skuId||0}`
// { key, productId, skuId, quantity, checked, snapshot: { id, name, imageUrl, price, skuName, specsJson? } }
const items = ref<any[]>([]);
// 规格名缓存：productId -> [规格名顺序列表]
const specKeyCache = reactive<Record<number, string[]>>({});

async function loadCart(){
	try {
		items.value = await cartControllerMyList({ token: '', onlyChecked: 'false' } as any) as any;
		// 异步确保需要的规格名可用（用于将 "S/2" 转为 "大小：S/长度：2"）
		ensureSpecKeysForItems(items.value).catch(()=>{});
	} catch { items.value = []; }
}

function saveCart(){ /* 后端持久化，前端无需本地保存 */ }

const allChecked = computed(()=> items.value.length>0 && items.value.every(it=>!!it.checked));
const totalAmount = computed(()=> items.value.filter(it=>it.checked).reduce((sum:number, it:any)=> sum + Number(it?.snapshot?.price||0)*Number(it.quantity||0), 0));
const totalAmountText = computed(()=> totalAmount.value.toFixed(2));

// 可用优惠券（购物车页直接展示与选择）
const couponLoading = ref<boolean>(false);
const applicableCoupons = ref<Array<{ id:number; couponId:number; name:string; allowCombine:boolean; allowStackWithPoints?: boolean; allowStackWithMemberDiscount?: boolean; discountApplied:number }>>([]);
const selectedCouponIds = ref<Set<number>>(new Set());
const couponDiscount = computed(()=> Array.from(selectedCouponIds.value).reduce((s, id)=>{ const c = applicableCoupons.value.find(x=>x.id===id); return s + (c ? Number(c.discountApplied||0) : 0); }, 0));
const expectedPayAmount = computed(()=>{
  const memberDeduct = Number(memberDiscountAllowedByCoupons.value ? (memberDiscountEstYuan.value||0) : 0);
  return Math.max(0, Number(totalAmount.value)
    - Number(couponDiscount.value||0)
    - memberDeduct);
});
const expectedPayAmountText = computed(()=> expectedPayAmount.value.toFixed(2));
const checkedCount = computed(()=> items.value.filter(it=>it.checked).length);
// 会员折扣与积分说明元数据
const fenPerPoint = ref<number>(0);
const maxFenPerOrder = ref<number>(0);
// 积分抵扣相关变量
const usedPoints = ref<number>(0);
const usedPointsText = ref<string>('0');
const maxDeductYuanText = computed(()=>{
    const v = Math.max(0, Number(maxFenPerOrder.value||0));
    return (v>0 ? (v/100).toFixed(2) : '不限');
});
const supportsPoints = computed(()=> items.value.filter(it=>it.checked).some(it => !!(it?.snapshot?.pointsDeductible)));
const supportsMemberDiscount = computed(()=> items.value.filter(it=>it.checked).some(it => !!(it?.snapshot?.memberDiscount)));
const memberPayDiscountPercent = ref<number>(0);
const memberDiscountEligibleYuan = computed(()=>{
    if (!supportsMemberDiscount.value) return 0;
    try{
        return items.value.filter(it=>it.checked).reduce((sum:number, it:any)=> sum + (it?.snapshot?.memberDiscount ? Number(it?.snapshot?.price||0) * Number(it?.quantity||0) : 0), 0);
    }catch{ return 0; }
});
const memberDiscountEstYuan = computed(()=>{
    const pct = Math.max(0, Number(memberPayDiscountPercent.value||0));
    if (!pct) return 0;
    return (memberDiscountEligibleYuan.value * pct) / 100;
});
const memberDiscountEstText = computed(()=> Number(memberDiscountEstYuan.value||0).toFixed(2));
const pointsAllowedByCoupons = computed(()=>{
    const picked = applicableCoupons.value.filter(c => selectedCouponIds.value.has(c.id));
    return picked.every(c => c.allowStackWithPoints !== false);
});
const memberDiscountAllowedByCoupons = computed(()=>{
    const picked = applicableCoupons.value.filter(c => selectedCouponIds.value.has(c.id));
    return picked.every(c => c.allowStackWithMemberDiscount !== false);
});
function buildApplicableItems(){ return items.value.filter(it=>it.checked).map(it=>({ productId: it.productId, price: Number(it?.snapshot?.price||0), quantity: Number(it.quantity||0) })); }
async function loadApplicableCoupons(){
	couponLoading.value = true;
	try{
		const authed = await checkAuthAndRefresh({ redirectIfExpired: false });
		if (!authed) { applicableCoupons.value=[]; selectedCouponIds.value=new Set(); return; }
		const body:any = { items: buildApplicableItems() };
		const res:any = await miniappCouponControllerApplicable(body as any, { token: '' } as any);
		applicableCoupons.value = Array.isArray(res?.applicable) ? res.applicable : [];
		selectedCouponIds.value = new Set(applicableCoupons.value.length ? [applicableCoupons.value[0].id] : []);
	}catch{ applicableCoupons.value=[]; selectedCouponIds.value=new Set(); }
	finally{ couponLoading.value=false; }
}

// 会员/积分元数据加载
(async ()=>{
    try{
        const ss:any = await systemSettingControllerGetPublicSetting() as any;
        fenPerPoint.value = Math.max(0, Number(ss?.pointsFenPerPoint||0));
        maxFenPerOrder.value = Math.max(0, Number(ss?.pointsMaxDeductFenPerOrder||0));
        const prof:any = await memberControllerMe({ token: '' } as any) as any;
        memberPayDiscountPercent.value = Math.max(0, Number((prof as any)?.level?.payDiscountPercent||0));
    }catch{}
})();
function disabledByCombine(c:any){ if (!c) return false; if (selectedCouponIds.value.has(c.id)) return false; if (!c.allowCombine && selectedCouponIds.value.size>0) return true; return false; }
function toggleCoupon(c:any){ if (!c) return; if (disabledByCombine(c)) return; const set=new Set(selectedCouponIds.value); if (set.has(c.id)) set.delete(c.id); else set.add(c.id); selectedCouponIds.value=set; }
watch(selectedCouponIds, ()=>{
    try{
        const picked = applicableCoupons.value.filter(x => selectedCouponIds.value.has(x.id));
        const pointsAllowed = picked.every(x => x.allowStackWithPoints !== false);
        if (!pointsAllowed) { usedPointsText.value = '0'; usedPoints.value = 0; }
    }catch{}
});

async function toggleAll(){ try { await cartControllerToggleAll({ checked: !allChecked.value } as any); await loadCart(); await loadApplicableCoupons(); } catch {} }
async function toggleItem(it:any){ try { await cartControllerMyUpdate(Number(it.id), { checked: !it.checked } as any); it.checked=!it.checked; await loadApplicableCoupons(); } catch {} }
async function inc(it:any){
    try {
        // 获取最新商品/库存信息用于校验
        const prod:any = await storeProductControllerGet(Number(it.productId)) as any;
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
        await cartControllerMyUpdate(Number(it.id), { quantity: next } as any); it.quantity = next; await loadApplicableCoupons();
    } catch {}
}
async function dec(it:any){
	try {
		const cur = Number(it.quantity||0);
		if (cur <= 1) {
			uni.showModal({ title:'提示', content:'是否删除该商品？', success: async (res:any) => {
				if (res?.confirm) { try { await cartControllerMyDelete(Number(it.id)); await loadCart(); await loadApplicableCoupons(); } catch {} }
			}});
			return;
		}
		const q=Math.max(1, cur-1); await cartControllerMyUpdate(Number(it.id), { quantity:q } as any); it.quantity=q; await loadApplicableCoupons();
	} catch {}
}

// 规格展示（规格名：规格值/... 或 默认规格）
function normalizeSpecs(specsRaw: any): Array<{ key: string; value: string }>{
	try{
		if (Array.isArray(specsRaw)) return specsRaw.map((it:any)=>({ key:String(it?.key||it?.name||'').trim(), value:String(it?.value||it?.v||'').trim() })).filter(it=>it.key&&it.value);
		if (typeof specsRaw==='string'){ try { const p=JSON.parse(specsRaw); return normalizeSpecs(p); } catch { /* ignore */ } }
		if (specsRaw && typeof specsRaw==='object') return Object.keys(specsRaw).map(k=>({ key:String(k).trim(), value:String(specsRaw[k]??'').trim() })).filter(it=>it.key&&it.value);
		return [];
	}catch{ return []; }
}

// 判断该条目是否需要规格名辅助（snapshot 无结构化规格，skuName 也无“：”）
function needsSpecKeyNames(row:any): boolean{
    try{
        const snap:any = row?.snapshot || {};
        const arr = normalizeSpecs(snap.specsJson || snap.specs);
        if (arr.length) return false;
        const txt = String(snap.skuName||'').trim();
        if (!txt) return false;
        // 已经包含“规格名：值”的直接返回 false
        if (/[：:]/.test(txt)) return false;
        // 类似 "S/2" 的需要
        return /[\/|,，\s]/.test(txt);
    }catch{ return false; }
}

// 从商品详情推断规格名顺序
function deriveSpecKeysFromProduct(prod:any): string[]{
    try{
        const out:string[] = [];
        const pushKey = (k:string)=>{ const key=String(k||'').trim(); if (key && !out.includes(key)) out.push(key); };
        const skus:any[] = Array.isArray(prod?.skus) ? prod.skus : [];
        for (const s of skus){
            const list = normalizeSpecs((s as any)?.specsJson) || normalizeSpecs((s as any)?.specs);
            for (const it of list){ pushKey(it.key); }
        }
        if (out.length) return out;
        const prodSpecs = normalizeSpecs((prod as any)?.specsJson || (prod as any)?.specs);
        for (const it of prodSpecs){ pushKey(it.key); }
        return out;
    }catch{ return []; }
}

// 为购物车条目批量补充规格名缓存
async function ensureSpecKeysForItems(rows:any[]){
    try{
        const ids = Array.from(new Set<number>(rows
            .filter(r => needsSpecKeyNames(r))
            .map(r => Number(r?.productId||0))
            .filter(id => id>0 && !specKeyCache[id])));
        if (!ids.length) return;
        await Promise.all(ids.map(async(pid)=>{
            try{
                const prod:any = await storeProductControllerGet(Number(pid)) as any;
                const keys = deriveSpecKeysFromProduct(prod);
                if (keys.length) specKeyCache[pid] = keys;
            }catch{}
        }));
    }catch{}
}
function displaySpecs(it:any){
	const snap:any = it?.snapshot || {};
	// 1) 后端已给完整文本
	if (snap.specsText && String(snap.specsText).trim()) return String(snap.specsText).trim();
	// 2) 结构化规格
	let arr = normalizeSpecs(snap.specsJson || snap.specs);
	if (arr.length) return arr.map(x=>`${x.key}：${x.value}`).join('/');
	// 3) 从 skuName 文本回退
	const txt = String(snap.skuName||'').trim();
	if (/[：:]/.test(txt)) return txt;
	// 3.1) 若 skuName 仅为值（如 "S/2"），尝试用缓存的规格名重建
	try {
		const keys = specKeyCache[it?.productId as number] || [];
		const parts = txt.split(/[\/|,，\s]+/).map(s=>s.trim()).filter(Boolean);
		if (keys.length && parts.length && keys.length === parts.length) {
			return keys.map((k, idx)=>`${k}：${parts[idx]}`).join('/');
		}
	} catch {}
	// 4) 最终回退
	return txt ? txt : '默认规格';
}

function isMultiSpec(it:any){
	try {
		// 有 skuId 通常表示多规格条目
		if (it && it.skuId) return true;
		const arr = normalizeSpecs((it?.snapshot as any)?.specsJson);
		return Array.isArray(arr) && arr.length > 0;
	} catch { return false; }
}

// 规格选择（维度化）
type Sku = { id: number; name?: string; specsJson?: any; price: number; enabled?: boolean };
const skuPicker = reactive<{ visible:boolean; itemKey:string|undefined; productId:number|undefined; rowId:number|undefined; selectedId:number|undefined; skus: Sku[] }>({ visible:false, itemKey: undefined, productId: undefined, rowId: undefined, selectedId: undefined, skus: [] });
const selectedSpecValues = ref<Record<string,string>>({});
const specOptions = computed<Record<string, string[]>>(()=>{
	const map:Record<string, Set<string>> = {} as any;
	for (const s of skuPicker.skus) {
		const list = normalizeSpecs((s as any)?.specsJson);
		for (const it of list) { if (!map[it.key]) map[it.key]=new Set(); map[it.key].add(it.value); }
	}
	const out:Record<string,string[]> = {}; Object.keys(map).forEach(k=> out[k] = Array.from(map[k])); return out;
});
const specKeys = computed<string[]>(()=> Object.keys(specOptions.value));
function getSkuSpecValue(s:Sku, key:string){ const arr=normalizeSpecs((s as any)?.specsJson); const f=arr.find(it=>it.key===key); return String(f?.value||''); }
function isSkuMatchSelection(s:Sku, sel:Record<string,string>){ for (const k of Object.keys(sel)){ const v=sel[k]; if (!v) continue; if (getSkuSpecValue(s,k)!==v) return false; } return true; }
function isOptionDisabled(key:string, value:string){ const cand={ ...selectedSpecValues.value, [key]: value }; return skuPicker.skus.filter(s=>isSkuMatchSelection(s, cand)).length===0; }
function onSelectSpec(key:string, value:string){ if (isOptionDisabled(key,value)) return; selectedSpecValues.value = { ...selectedSpecValues.value, [key]: value }; const matches = skuPicker.skus.filter(s=>isSkuMatchSelection(s, selectedSpecValues.value)); skuPicker.selectedId = matches.length===1 ? matches[0].id : skuPicker.selectedId; }

async function openSkuPicker(it:any){
	try {
		const prod:any = await storeProductControllerGet(Number(it.productId)) as any;
		const skus:Sku[] = Array.isArray(prod?.skus) ? (prod.skus as any[]).filter(s=>s.enabled!==false).map((s:any)=>({ id:s.id, name:s.name, specsJson:s.specsJson, price:Number(s.price||0) })) : [];
		skuPicker.visible = true; skuPicker.itemKey = it.key; skuPicker.productId = it.productId; skuPicker.rowId = it.id; skuPicker.skus = skus; skuPicker.selectedId = it.skuId || skus[0]?.id;
		// 预选维度
		selectedSpecValues.value = {};
		const cur = skus.find(s=>s.id===skuPicker.selectedId);
		if (cur){ const arr=normalizeSpecs((cur as any)?.specsJson); arr.forEach(it=>{ if(it?.key&&it?.value) selectedSpecValues.value[it.key]=it.value; }); }
	} catch {}
}
function closeSkuPicker(){ skuPicker.visible=false; }
async function applySku(){
	const s = skuPicker.skus.find(x=>x.id===skuPicker.selectedId);
	if (!s || typeof skuPicker.rowId !== 'number') { closeSkuPicker(); return; }
	try { await cartControllerMyUpdate(Number(skuPicker.rowId), { skuId: s.id } as any); await loadCart(); } catch {}
	closeSkuPicker();
}

function checkout(){
	const selected = items.value.filter(it=>it.checked);
	if (selected.length===0){ uni.showToast({ title:'请选择商品', icon:'none' }); return; }
	try { uni.navigateTo({ url: '/pages/cart/confirm' }); } catch {}
}

// 初始化
loadCart().then(()=>{ loadApplicableCoupons(); });
</script>

<style>
.page { min-height: 100vh; padding: 24rpx 24rpx 140rpx 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:12rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom: 24rpx; }
.card-inner { background: transparent; border-radius:20rpx; padding:24rpx; }
.header { display:flex; align-items:center; justify-content: space-between; }
.title { font-size: 32rpx; font-weight: 800; color:#0b1220; }
.empty { padding: 24rpx; color:#6b7280; text-align:center; }
.toolbar { margin: 8rpx 0 8rpx 0; display:flex; align-items:center; justify-content:flex-start; }
.checkbox { display:inline-flex; align-items:center; gap: 8rpx; }
.box { width: 30rpx; height: 30rpx; border: 2rpx solid #e5e7eb; border-radius: 6rpx; display:flex; align-items:center; justify-content:center; background:#fff; }
.box.on { background:#fff; border-color:#111827; }
.tick-svg { width: 26rpx; height: 26rpx; display:block; }
.tick-img { width: 26rpx; height: 26rpx; display:block; }
.txt { font-size: 24rpx; color:#1f2937; }
.list { display:flex; flex-direction: column; gap: 16rpx; }
.row { display:flex; gap: 12rpx; align-items: center; background:#f9fafb; border: 2rpx solid #e5e7eb; border-radius: 16rpx; padding: 12rpx; }
.col-check { width: 40rpx; display:flex; align-items:center; justify-content:center; }
.thumb { width: 120rpx; height: 120rpx; border-radius: 12rpx; background:#f3f4f6; }
.col-info { flex:1; display:flex; flex-direction: column; gap: 6rpx; }
.name { font-size: 28rpx; color:#111827; font-weight: 600; }
.spec { font-size: 22rpx; color:#6b7280; }
.price { font-size: 26rpx; color:#ef4444; font-weight: 700; }
.col-qty { display:flex; align-items:center; gap: 8rpx; }
.col-qty .btn { width: 42rpx; height: 42rpx; border-radius: 10rpx; background:#e5e7eb; text-align:center; line-height: 42rpx; }
.col-qty .num { min-width: 48rpx; text-align:center; }
.bottom-bar { position: fixed; left:0; right:0; bottom:0; background:#ffffff; border-top: 2rpx solid #e5e7eb; padding: 12rpx 16rpx; display:flex; align-items:center; justify-content: space-between; gap: 12rpx; box-sizing: border-box; }
.summary { display:flex; align-items: baseline; gap: 6rpx; }
.label { font-size: 24rpx; color:#6b7280; }
.amount { font-size: 30rpx; color:#ef4444; font-weight: 800; }
.checkout { padding: 18rpx 22rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; border-radius: 16rpx; font-size: 26rpx; }

/* 统一返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }

/* 弹层与规格维度化选择 */
.sheet-backdrop { position: fixed; left:0; right:0; top:0; bottom:0; background: rgba(0,0,0,0.45); z-index: 999; display:flex; align-items:flex-end; }
.sheet { width: 100%; background: #fff; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx; padding: 24rpx; max-height: 70vh; overflow: auto; box-shadow: 0 -8rpx 24rpx rgba(0,0,0,0.1); }
.sheet-header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.spec-group { margin-top: 8rpx; }
.spec-key { display:block; font-size: 24rpx; color:#6b7280; margin-bottom: 8rpx; }
.spec-row { display:flex; flex-wrap: wrap; gap: 12rpx; }
.spec-chip { padding: 10rpx 18rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; color:#1f2937; background:#fff; }
.spec-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.spec-chip.disabled { opacity: .5; }
.close { width: 48rpx; height: 48rpx; text-align:center; line-height:48rpx; border-radius: 12rpx; background:#f3f4f6; color:#111827; }
.submit { padding: 16rpx 18rpx; background:#111827; color:#fff; border-radius: 12rpx; font-size: 26rpx; }
.footer { display:flex; align-items:center; justify-content:flex-end; margin-top: 12rpx; }

/* 优惠券预计信息卡片 */
.coupon-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:16rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-top: 12rpx; }
.coupon-card__header { display:flex; align-items: baseline; justify-content: space-between; margin-bottom: 8rpx; }
.coupon-card__title { font-size: 28rpx; font-weight: 800; color:#0b1220; }
.coupon-card__subtitle { font-size: 22rpx; color:#6b7280; }
.coupon-card__loading, .coupon-card__empty { padding: 12rpx; color:#6b7280; }
.coupon-card__chips { display:flex; flex-wrap: wrap; gap: 10rpx; margin-top: 6rpx; }
.coupon-card__summary { display:flex; align-items: baseline; gap: 10rpx; margin-top: 10rpx; padding-top: 10rpx; border-top: 2rpx dashed #e5e7eb; }
.coupon-card__summary .sum-label { font-size: 22rpx; color:#6b7280; }
.coupon-card__summary .sum-discount { font-size: 26rpx; color:#ef4444; font-weight: 700; }
.coupon-card__summary .sum-split { color:#d1d5db; }
.coupon-card__summary .sum-pay { font-size: 28rpx; color:#111827; font-weight: 800; }

/* 会员与积分：标签化，自动换行避免错位 */
.coupon-card__tags { display:flex; flex-wrap: wrap; gap: 8rpx; margin-top: 10rpx; padding-top: 10rpx; border-top: 2rpx dashed #e5e7eb; }
.meta-tag { display:inline-flex; align-items:center; gap: 6rpx; padding: 4rpx 10rpx; background:#f3f4f6; border: 2rpx solid #e5e7eb; border-radius: 999rpx; font-size: 22rpx; color:#374151; }

/* 可用券 Chips（与确认页风格一致） */
.coupon-chip { display:inline-flex; align-items:center; gap: 8rpx; padding: 10rpx 14rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#fff; color:#111827; }
.coupon-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; border-color: transparent; box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.08); }
.coupon-chip.disabled { opacity: .6; }
.coupon-chip .c-name { font-size: 22rpx; }
.coupon-chip .c-discount { font-size: 22rpx; color:#ef4444; font-weight: 700; }
.coupon-chip.active .c-discount { color:#fff; opacity: .95; }
.coupon-chip .c-tag { font-size: 20rpx; color:#374151; background:#f3f4f6; padding: 2rpx 8rpx; border-radius: 999rpx; }
</style>
