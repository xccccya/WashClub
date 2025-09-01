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
				<text class="amount">¥{{ totalAmountText }}</text>
			</view>
			<view class="checkout" @tap="checkout">去结算¥{{ totalAmountText }}</view>
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
import { createHttp } from '../../utils/auth';
import { resolveImageUrl } from '../../utils/url';

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
		const http = createHttp();
		items.value = await http<any[]>('/cart/me/list', { method:'GET' });
		// 异步确保需要的规格名可用（用于将 "S/2" 转为 "大小：S/长度：2"）
		ensureSpecKeysForItems(items.value).catch(()=>{});
	} catch { items.value = []; }
}

function saveCart(){ /* 后端持久化，前端无需本地保存 */ }

const allChecked = computed(()=> items.value.length>0 && items.value.every(it=>!!it.checked));
const totalAmount = computed(()=> items.value.filter(it=>it.checked).reduce((sum:number, it:any)=> sum + Number(it?.snapshot?.price||0)*Number(it.quantity||0), 0));
const totalAmountText = computed(()=> totalAmount.value.toFixed(2));
const expectedCouponDiscount = ref<number>(0);
const expectedPayAmount = computed(()=> Math.max(0, Number(totalAmount.value) - Number(expectedCouponDiscount.value||0)));
const expectedPayAmountText = computed(()=> expectedPayAmount.value.toFixed(2));

async function refreshExpectedCoupon(){
	try{
		// 懒加载校验，无需跳转
		const { checkAuthAndRefresh } = await import('../../utils/auth');
		const authed = await checkAuthAndRefresh({ redirectIfExpired: false });
		if (!authed) { expectedCouponDiscount.value = 0; return; }
		const http = createHttp();
		const itemsPayload = items.value.filter(it=>it.checked).map(it=>({ productId: it.productId, price: Number(it?.snapshot?.price||0), quantity: Number(it.quantity||0) }));
		if (!itemsPayload.length) { expectedCouponDiscount.value = 0; return; }
		const res:any = await http('/coupon/miniapp/applicable', { method:'POST', body: { items: itemsPayload } });
		const arr:any[] = Array.isArray(res?.applicable) ? res.applicable : [];
		expectedCouponDiscount.value = arr.length ? Number(arr[0]?.discountApplied||0) : 0;
	}catch{ expectedCouponDiscount.value = 0; }
}

async function toggleAll(){ try { const http=createHttp(); await http('/cart/me/toggle-all', { method:'POST', body:{ checked: !allChecked.value } }); await loadCart(); await refreshExpectedCoupon(); } catch {} }
async function toggleItem(it:any){ try { const http=createHttp(); await http(`/cart/me/${it.id}`, { method:'PUT', body:{ checked: !it.checked } }); it.checked=!it.checked; await refreshExpectedCoupon(); } catch {} }
async function inc(it:any){
    try {
        const http=createHttp();
        // 获取最新商品/库存信息用于校验
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
        await http(`/cart/me/${it.id}`, { method:'PUT', body:{ quantity: next } }); it.quantity = next; await refreshExpectedCoupon();
    } catch {}
}
async function dec(it:any){
	try {
		const http=createHttp();
		const cur = Number(it.quantity||0);
		if (cur <= 1) {
			uni.showModal({ title:'提示', content:'是否删除该商品？', success: async (res:any) => {
				if (res?.confirm) { try { await http(`/cart/me/${it.id}`, { method:'DELETE' }); await loadCart(); await refreshExpectedCoupon(); } catch {} }
			}});
			return;
		}
		const q=Math.max(1, cur-1); await http(`/cart/me/${it.id}`, { method:'PUT', body:{ quantity:q } }); it.quantity=q; await refreshExpectedCoupon();
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
        const http = createHttp();
        await Promise.all(ids.map(async(pid)=>{
            try{
                const prod:any = await http(`/store/products/${pid}`, { method:'GET' });
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
		const http = createHttp();
		const prod:any = await http(`/store/products/${it.productId}`, { method:'GET' });
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
	try { const http=createHttp(); await http(`/cart/me/${skuPicker.rowId}`, { method:'PUT', body:{ skuId: s.id } }); await loadCart(); } catch {}
	closeSkuPicker();
}

function checkout(){
	const selected = items.value.filter(it=>it.checked);
	if (selected.length===0){ uni.showToast({ title:'请选择商品', icon:'none' }); return; }
	try { uni.navigateTo({ url: '/pages/cart/confirm' }); } catch {}
}

// 初始化
loadCart().then(()=>{ refreshExpectedCoupon(); });
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
</style>
