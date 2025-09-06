<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<!-- 图片轮播 -->
		<view class="gallery">
			<swiper class="swiper" circular :indicator-dots="true" :autoplay="false">
				<swiper-item v-for="(img, idx) in displayImages" :key="idx">
					<image class="img" :src="resolveImageUrl(img)" mode="aspectFill" />
				</swiper-item>
			</swiper>
		</view>

		<!-- 基本信息 -->
		<view class="card info-card">
			<view class="row-top">
				<text class="name">{{ product?.name || '' }}</text>
				<text class="sales" v-if="Number(product?.totalSales||0)>0">销量 {{ product?.totalSales }}</text>
			</view>
			<view class="row-mid">
				<text class="price">¥{{ displayPriceText }}</text>
				<text class="list-price" v-if="Number(product?.listPrice||0)>0 && (product?.specType!=='MULTI')">¥{{ formatPrice(product?.listPrice) }}</text>
			</view>
			<view v-if="product?.sellPoint" class="sell">{{ product?.sellPoint }}</view>
			<!-- 单规格实物商品：直接展示库存信息 -->
			<view v-if="product?.type==='PHYSICAL' && product?.specType==='SINGLE'" class="stock-chip" :class="stockClass">
				<text class="dot"></text>
				<text class="stock-text">{{ stockText }}</text>
			</view>
		</view>

		<!-- 规格选择（多规格） -->
		<view v-if="product?.specType==='MULTI'" class="card">
			<view class="block-title">选择规格</view>
			<view v-if="specKeys.length" v-for="key in specKeys" :key="key" class="spec-group">
				<text class="spec-key">{{ key }}</text>
				<view class="spec-row">
					<view v-for="val in specOptions[key]" :key="val" class="spec-chip" :class="{ active: selectedSpecValues[key]===val, disabled: isOptionDisabled(key, val) }" @tap="() => onSelectSpec(key, val)">{{ val }}</view>
				</view>
			</view>
			<view v-else class="desc">暂无可选规格，请联系门店</view>
			<!-- 多规格实物商品：选择完整规格后展示库存信息 -->
			<view v-if="product?.type==='PHYSICAL' && selectionComplete" class="stock-chip" :class="stockClass">
				<text class="dot"></text>
				<text class="stock-text">{{ stockText }}</text>
			</view>
		</view>

		<!-- 商品介绍 -->
		<view class="card">
			<view class="block-title">商品介绍</view>
			<view class="desc" v-if="product?.description">{{ product?.description }}</view>
			<view class="desc" v-else>暂无介绍</view>
		</view>

		<!-- 底部操作栏 -->
		<view class="bottom-bar">
			<view class="action fav-action" :class="{ active: collected }" @tap="toggleCollect">
				<image class="fav-icon" :src="collected ? '/static/icons/favorite-fill.png' : '/static/icons/favorite.png'" mode="aspectFit" />
				<text class="fav-text">{{ collected ? '已收藏' : '收藏' }}</text>
			</view>
			<view v-if="product?.type==='PHYSICAL'" class="action cart-action" @tap="addToCart">
				<!-- #ifdef H5 -->
				<svg class="cart-svg" width="226.5625" height="200" viewBox="0 0 1160 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
					<path d="M415.1296 857.429333a83.285333 83.285333 0 1 1 0 166.570667 83.285333 83.285333 0 0 1 0-166.570667z m499.643733 0a83.285333 83.285333 0 1 1 0 166.570667 83.285333 83.285333 0 0 1 0-166.570667zM213.435733 0v0.4096l5.12-0.034133a34.133333 34.133333 0 0 1 34.2016 29.2864l20.48 143.803733h834.013867a34.133333 34.133333 0 0 1 33.6896 39.697067l-83.524267 506.88a68.266667 68.266667 0 0 1-67.345066 57.1392H318.327467c-1.774933 0-3.515733-0.136533-5.2224-0.375467h-6.144a34.133333 34.133333 0 0 1-34.2016-29.2864L197.188267 218.043733l-7.338667-44.578133h0.989867l-12.868267-90.2144H20.48V0h192.955733z m330.308267 340.138667H481.28v270.404266h62.464V340.138667z m312.285867 0h-62.464v270.404266h62.464V340.138667z" fill="#1296DB" class=""></path>
				</svg>
				<!-- #endif -->
				<!-- #ifndef H5 -->
				<image class="cart-icon" src="/static/icons/cart.png" mode="aspectFit" />
				<!-- #endif -->
				<text class="cart-text">加入购物车</text>
			</view>
			<view class="buy" :class="{ disabled: buyDisabled }" @tap="onBuyTap">{{ buyText }}</view>
		</view>

		<PurchaseSheet v-model:visible="sheetVisible" :product="product || null" :preselectedSkuId="selectedSkuId" :preselectedSpecValues="selectedSpecValues" @submitted="onSubmitted" />
	</view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { createHttp, getToken, checkAuthAndRefresh } from '../../utils/auth';
import { resolveImageUrl } from '../../utils/url';
import { useSafeArea } from '../../utils/safe-area';
import PurchaseSheet from '../../components/PurchaseSheet.vue';

type Sku = { id: number; name?: string; price: number; stockQuantity?: number; enabled?: boolean; specsJson?: Array<{ key: string; value: string }>|null };

type Product = {
	id: number;
	type: 'SERVICE'|'PHYSICAL'|'VIRTUAL_CARD'|'OTHER'|'SP';
	specType: 'SINGLE'|'MULTI';
	name: string;
	price?: number|null;
	listPrice?: number|null;
	stockQuantity?: number|null;
	skus?: Sku[];
	imageUrl?: string|null;
	imagesJson?: string[]|null;
	description?: string|null;
	sellPoint?: string|null;
	totalSales?: number;
	minPrice?: number; maxPrice?: number;
	priceRange?: string|null;
};

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const http = createHttp();

const id = ref<number|undefined>(undefined);
const product = ref<Product|null>(null);
const selectedSkuId = ref<number|undefined>(undefined);
const collected = ref<boolean>(false);
const sheetVisible = ref<boolean>(false);

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/store/index' });
	} catch { uni.reLaunch({ url: '/pages/store/index' }); }
}

function formatPrice(p:any){ const n=Number(p); return isNaN(n)? '0.00' : n.toFixed(2); }

onLoad(async (q: any) => {
	const pid = Number(q?.id || 0);
	if (!pid) { uni.showToast({ title:'参数错误', icon:'none' }); setTimeout(()=>goBack(), 500); return; }
	id.value = pid;
	await fetchDetail();
	initCollect();
});

async function fetchDetail(){
	try {
		const res = await http<Product>(`/store/products/${id.value}`, { method:'GET' });
		if (res && (res as any)?.enabled === false) {
			uni.showToast({ title:'商品已下架', icon:'none' });
			setTimeout(()=>{ goBack(); }, 600);
			return;
		}
		product.value = res || null;
		// 多规格：初始化规格维度，若仅有唯一 SKU 可直接选中
		selectedSkuId.value = undefined;
		selectedSpecValues.value = {};
		if (product.value?.specType === 'MULTI' && enabledSkus.value.length === 1) {
			const only = enabledSkus.value[0] as any;
			selectedSkuId.value = only?.id;
			let specs = normalizeSpecs((only as any)?.specsJson) || normalizeSpecs((only as any)?.specs);
			if (!specs.length) specs = normalizeSpecsFromSku(only, specKeys.value);
			specs.forEach(it => { if (it?.key && it?.value) selectedSpecValues.value[it.key] = it.value; });
		}
		await initCollect();
	} catch { product.value = null; }
}

const displayImages = computed(() => {
	const raw: string[] = [];
	if (product.value?.imagesJson && Array.isArray(product.value.imagesJson)) raw.push(...product.value.imagesJson.filter(Boolean));
	if (product.value?.imageUrl) raw.unshift(product.value.imageUrl);
	// 去重：按解析后的绝对地址去重，避免头图重复显示
	const seen = new Set<string>();
	const urls: string[] = [];
	for (const u of raw) {
		const abs = resolveImageUrl(u);
		if (!abs) continue;
		const key = abs.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		urls.push(u);
	}
	return urls.length ? urls : ['/static/icons/placeholder.png'];
});

const enabledSkus = computed(() => (product.value?.skus||[]).filter(s => s.enabled!==false));
const selectionComplete = computed(() => {
	if (product.value?.specType !== 'MULTI') return true;
	const keys = specKeys.value || [];
	if (!keys.length) return false;
	for (const k of keys) { if (!selectedSpecValues.value[k]) return false; }
	const matches = enabledSkus.value.filter(s => isSkuMatchSelection(s, selectedSpecValues.value));
	return matches.length === 1;
});

const selectedSku = computed<Sku|undefined>(() => {
	if (product.value?.specType !== 'MULTI') return undefined;
	return enabledSkus.value.find(s => s.id === selectedSkuId.value);
});

const currentStock = computed<number|undefined>(() => {
	if (!product.value || product.value.type !== 'PHYSICAL') return undefined;
	if (product.value.specType === 'SINGLE') return Number(product.value.stockQuantity ?? 0);
	const sku = selectedSku.value;
	if (!selectionComplete.value || !sku) return undefined;
	return Number(sku.stockQuantity ?? 0);
});

const stockText = computed<string>(() => {
	if (product.value?.type !== 'PHYSICAL') return '';
	const qty = currentStock.value;
	if (qty === undefined) return '';
	return qty <= 0 ? '库存不足' : `剩余 ${qty}`;
});

const stockClass = computed<string>(() => {
	if (product.value?.type !== 'PHYSICAL') return '';
	const qty = currentStock.value;
	if (qty === undefined) return '';
	return qty <= 0 ? 'low' : 'ok';
});

const buyDisabled = computed<boolean>(() => {
	if (!product.value) return false;
	if (product.value.type !== 'PHYSICAL') return false;
	if (product.value.specType === 'SINGLE') return Number(product.value.stockQuantity ?? 0) <= 0;
	// 多规格：未选择完整规格或所选SKU库存不足均禁用
	if (!selectionComplete.value) return true;
	const qty = Number(selectedSku.value?.stockQuantity ?? 0);
	return qty <= 0;
});

const buyText = computed<string>(() => {
	if (product.value?.type !== 'PHYSICAL') return '立即购买';
	if (product.value.specType === 'SINGLE') return buyDisabled.value ? '当前商品售罄' : '立即购买';
	// 多规格
	if (!selectionComplete.value) return '立即购买';
	return buyDisabled.value ? '当前商品售罄' : '立即购买';
});

// 规格归一化：兼容数组/字符串(JSON)/对象
function normalizeSpecs(specsRaw: any): Array<{ key: string; value: string }>{
	try{
		// 数组形式
		if (Array.isArray(specsRaw)) {
			const out: Array<{key:string; value:string}> = [];
			for (const it of specsRaw) {
				// 对象：支持 key/k/name/label 与 value/v/val
				if (it && typeof it === 'object' && !Array.isArray(it)) {
					const keyLike = (it as any).key ?? (it as any).k ?? (it as any).name ?? (it as any).label;
					const valLike = (it as any).value ?? (it as any).v ?? (it as any).val;
					const key = String(keyLike||'').trim();
					const value = String(valLike||'').trim();
					if (key && value) { out.push({ key, value }); continue; }
					// 兜底：对象中只有一个键值对
					const keys = Object.keys(it);
					if (keys.length === 1) {
						const k = String(keys[0]||'').trim();
						const v = String((it as any)[keys[0]]||'').trim();
						if (k && v) { out.push({ key:k, value:v }); continue; }
					}
				}
				// 二元数组：[key, value]
				if (Array.isArray(it) && it.length >= 2) {
					const k = String(it[0]||'').trim();
					const v = String(it[1]||'').trim();
					if (k && v) { out.push({ key:k, value:v }); continue; }
				}
				// 字符串：形如 "颜色:红色"
				if (typeof it === 'string') {
					const m = it.split(/[:：]/);
					if (m.length >= 2) {
						const k = String(m[0]||'').trim();
						const v = String(m.slice(1).join(':')||'').trim();
						if (k && v) { out.push({ key:k, value:v }); continue; }
					}
				}
			}
			return out.filter(it=>it.key && it.value);
		}
		// 字符串：优先按 JSON 解析，其次按 "k:v;k2:v2" 解析
		if (typeof specsRaw === 'string') {
			try { const parsed = JSON.parse(specsRaw); return normalizeSpecs(parsed); } catch {}
			const out: Array<{key:string; value:string}> = [];
			const pairs = specsRaw.split(/[;；,/，\n]+/).map(s=>s.trim()).filter(Boolean);
			for (const p of pairs) {
				const m = p.split(/[:：]/);
				if (m.length >= 2) {
					const k = String(m[0]||'').trim();
					const v = String(m.slice(1).join(':')||'').trim();
					if (k && v) out.push({ key:k, value:v });
				}
			}
			return out;
		}
		// 对象：键值映射
		if (specsRaw && typeof specsRaw === 'object') {
			const out: Array<{key:string; value:string}> = [];
			Object.keys(specsRaw).forEach(k => {
				const v = (specsRaw as any)[k];
				const key = String(k||'').trim(); const value = String(v||'').trim();
				if (key && value) out.push({ key, value });
			});
			return out;
		}
		return [];
	}catch { return []; }
}

// 从商品或 SKU 猜测规格名顺序
function guessProductSpecKeys(): string[]{
	// 优先从 SKU 的规范化数据提取第一个出现的键顺序
	const keys: string[] = [];
	for (const s of enabledSkus.value) {
		const specs = normalizeSpecs((s as any)?.specsJson) || normalizeSpecs((s as any)?.specs);
		for (const it of specs) { if (!keys.includes(it.key)) keys.push(it.key); }
	}
	if (keys.length) return keys;
	// 再看商品级
	const prodSpecs = normalizeSpecs((product.value as any)?.specsJson || (product.value as any)?.specs);
	for (const it of prodSpecs) { if (!keys.includes(it.key)) keys.push(it.key); }
	return keys;
}

// 从 SKU 衍生规格（包含从 name 拆分的回退）
function normalizeSpecsFromSku(s: any, productKeys?: string[]): Array<{key:string; value:string}>{
	const primary = normalizeSpecs(s?.specsJson) || [];
	if (primary.length) return primary;
	const secondary = normalizeSpecs(s?.specs) || [];
	if (secondary.length) return secondary;
	// 从 name 解析：如 "红色/大" 按顺序映射到 productKeys，否则使用 规格1/规格2
	const name = String(s?.name||'').trim();
	if (!name) return [];
	const parts = name.split(/[\s/|,，]+/).map(p=>p.trim()).filter(Boolean);
	if (!parts.length) return [];
	const keys = (productKeys && productKeys.length===parts.length) ? productKeys : parts.map((_,i)=>`规格${i+1}`);
	return keys.map((k,idx)=>({ key: k, value: parts[idx] || '' })).filter(it=>it.key && it.value);
}

// 规格维度与选中值
const specOptions = computed<Record<string, string[]>>(() => {
	try{
		const map: Record<string, Set<string>> = {} as any;
		// 优先使用不含 name 回退的规范化 key，避免出现“规格1/2”
		for (const s of enabledSkus.value) {
			const specs = normalizeSpecs((s as any)?.specsJson) || normalizeSpecs((s as any)?.specs);
			for (const it of specs) {
				const k = it.key; const v = it.value;
				if (!k || !v) continue;
				if (!map[k]) map[k] = new Set<string>();
				map[k].add(v);
			}
		}
		// 若仍无 key，再回退到从 name 推断
		if (Object.keys(map).length === 0) {
			const guessedKeys = guessProductSpecKeys();
			for (const s of enabledSkus.value) {
				const specs = normalizeSpecsFromSku(s, guessedKeys);
				for (const it of specs) {
					const k = it.key; const v = it.value;
					if (!k || !v) continue;
					if (!map[k]) map[k] = new Set<string>();
					map[k].add(v);
				}
			}
		}
		const out: Record<string, string[]> = {};
		Object.keys(map).forEach(k => { out[k] = Array.from(map[k]); });
		return out;
	}catch{ return {}; }
});
const specKeys = computed<string[]>(() => Object.keys(specOptions.value));

const selectedSpecValues = ref<Record<string, string>>({});

function getSkuSpecValue(s: Sku, key: string){
	// 优先用规范化 key 的数据
	let arr = normalizeSpecs((s as any)?.specsJson) || normalizeSpecs((s as any)?.specs);
	if (!arr.length) arr = normalizeSpecsFromSku(s, specKeys.value);
	const f = arr.find(it => it.key === key);
	return String(f?.value||'');
}

function isSkuMatchSelection(s: Sku, sel: Record<string,string>){
	for (const k of Object.keys(sel)) {
		const v = sel[k]; if (!v) continue;
		if (getSkuSpecValue(s, k) !== v) return false;
	}
	return true;
}

function isOptionDisabled(key: string, value: string){
	const candidate: Record<string,string> = { ...selectedSpecValues.value, [key]: value };
	return enabledSkus.value.filter(s => isSkuMatchSelection(s, candidate)).length === 0;
}

function onSelectSpec(key: string, value: string){
	if (isOptionDisabled(key, value)) return;
	selectedSpecValues.value = { ...selectedSpecValues.value, [key]: value };
	const matches = enabledSkus.value.filter(s => isSkuMatchSelection(s, selectedSpecValues.value));
	selectedSkuId.value = matches.length === 1 ? matches[0].id : undefined;
}

function skuName(s: Sku){
	const n = String(s?.name||'').trim();
	if (n) return n;
	const arr = Array.isArray(s?.specsJson) ? s.specsJson.map(it => it?.value).filter(Boolean) : [];
	return arr.length ? arr.join('/') : '默认';
}

function selectSku(id?: number){ selectedSkuId.value = id; }

const unitPrice = computed(() => {
	if (!product.value) return 0;
	if (product.value.specType === 'MULTI') {
		const sku = enabledSkus.value.find(s => s.id===selectedSkuId.value);
		return Number(sku?.price||product.value.minPrice||0);
	}
	return Number(product.value.price||0);
});
const displayPrice = computed(() => unitPrice.value.toFixed(2));
const displayPriceText = computed(() => {
	if (product.value?.specType==='MULTI' && typeof selectedSkuId.value !== 'number') {
		return `${displayPrice.value}起`;
	}
	return displayPrice.value;
});

function initCollect(){
	return (async () => {
		try {
			const list:any[] = await http('/favorite/me/list', { method:'GET' });
			const set = new Set<number>(Array.isArray(list) ? list.map((x:any)=>x?.productId).filter((v:any)=>typeof v==='number') : []);
			collected.value = set.has(product.value?.id || -1);
		} catch { collected.value = false; }
	})();
}

async function toggleCollect(){
	if (!product.value?.id) return;
	try {
		const token = getToken(); if (!token) { uni.navigateTo({ url:'/pages/login/index' }); return; }
		const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!ok) return;
		if (collected.value) { await http(`/favorite/me/${product.value.id}`, { method:'DELETE' }); collected.value = false; uni.showToast({ title:'已取消收藏', icon:'none' }); }
		else { await http(`/favorite/me/${product.value.id}`, { method:'POST' }); collected.value = true; uni.showToast({ title:'已收藏', icon:'none' }); }
	} catch {}
}

async function addToCart(){
	if (!product.value) return;
	if (product.value.type !== 'PHYSICAL') return;
	{
		const token = getToken(); if (!token) { uni.navigateTo({ url:'/pages/login/index' }); return; }
		const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!ok) return;
	}
	if (product.value.specType==='MULTI' && typeof selectedSkuId.value !== 'number') { uni.showToast({ title:'请选择规格', icon:'none' }); return; }
	// 库存检查（考虑购物车已加数量，避免超过库存）
	try {
		let stock = 0;
		if (product.value.specType === 'SINGLE') {
			stock = Math.max(0, Number(product.value.stockQuantity ?? 0));
		} else {
			const sku = enabledSkus.value.find(s => s.id===selectedSkuId.value);
			stock = Math.max(0, Number(sku?.stockQuantity ?? 0));
		}
		if (stock <= 0) { uni.showToast({ title:'库存不足', icon:'none' }); return; }
		let inCart = 0;
		try{
			const list:any[] = await http('/cart/me/list', { method:'GET' });
			if (product.value.specType === 'SINGLE') {
				inCart = (Array.isArray(list)? list:[]).filter((row:any)=> Number(row?.productId)===Number(product.value?.id) && !row?.skuId).reduce((s:number,row:any)=> s + Number(row?.quantity||0), 0);
			} else {
				const curSkuId = Number(selectedSkuId.value);
				inCart = (Array.isArray(list)? list:[]).filter((row:any)=> Number(row?.productId)===Number(product.value?.id) && Number(row?.skuId)===curSkuId).reduce((s:number,row:any)=> s + Number(row?.quantity||0), 0);
			}
		}catch{}
		const canAdd = Math.min(1, Math.max(0, stock - inCart));
		if (canAdd <= 0) { uni.showToast({ title:'超过商品库存', icon:'none' }); return; }
		await http('/cart/me/add', { method:'POST', body: { productId: product.value.id, skuId: product.value.specType==='MULTI' ? selectedSkuId.value : null, quantity: canAdd } });
		uni.showToast({ title: canAdd===1 ? '已加入购物车' : `库存不足，已加入${canAdd}件`, icon:'none' });
	} catch {
		uni.showToast({ title:'加入失败', icon:'none' });
	}
}

function onBuyTap(){
	if (!product.value) return;
	if (!getToken()) { uni.navigateTo({ url:'/pages/login/index' }); return; }
	checkAuthAndRefresh({ redirectIfExpired: true });
	if (product.value.type !== 'PHYSICAL') { sheetVisible.value = true; return; }
	if (product.value.specType === 'MULTI' && !selectionComplete.value) { uni.showToast({ title:'请选择规格', icon:'none' }); return; }
	if (buyDisabled.value) return; // 售罄时不可点击
	sheetVisible.value = true;
}
function onSubmitted(){ /* 可根据需要刷新 */ }
</script>

<style>
.page { min-height: 100vh; background:#f7fafc; padding-bottom: calc(env(safe-area-inset-bottom) + 120rpx); }
.gallery { height: 520rpx; background:#fff; }
.swiper { width: 100%; height: 100%; }
.img { width: 100%; height: 100%; display:block; }
.card { background:#ffffff; border-radius:24rpx; padding:24rpx; margin: 16rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); }
.info-card .row-top { display:flex; align-items:center; justify-content: space-between; }
.name { font-size: 32rpx; font-weight: 800; color:#0b1220; }
.sales { font-size: 24rpx; color:#6b7280; }
.row-mid { margin-top: 8rpx; display:flex; align-items: baseline; gap: 8rpx; }
.price { font-size: 36rpx; color:#ef4444; font-weight: 800; }
.list-price { font-size: 24rpx; color:#6b7280; text-decoration: line-through; }
.price-hint { font-size: 24rpx; color:#6b7280; }
.sell { margin-top: 8rpx; font-size: 24rpx; color:#374151; background:#f3f4f6; padding: 10rpx 12rpx; border-radius: 12rpx; }
.stock-chip { margin-top: 10rpx; display:inline-flex; align-items:center; gap: 8rpx; padding: 8rpx 12rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#ffffff; }
.stock-chip.ok { border-color:#86efac; background:#ecfdf5; }
.stock-chip.low { border-color:#fca5a5; background:#fef2f2; }
.stock-chip .dot { width: 10rpx; height: 10rpx; border-radius: 999rpx; background:#10b981; }
.stock-chip.low .dot { background:#ef4444; }
.stock-chip .stock-text { font-size: 22rpx; color:#0f172a; }
.block-title { font-size: 26rpx; color:#374151; margin-bottom: 8rpx; }
.sku-row { white-space: nowrap; padding: 0 8rpx; }
.sku-chip { display:inline-flex; align-items:center; justify-content:center; padding: 10rpx 18rpx; margin-right: 12rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; color:#1f2937; background:#fff; }
.sku-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
/* 规格维度化 */
.spec-group { margin-top: 8rpx; }
.spec-key { display:block; font-size: 24rpx; color:#6b7280; margin-bottom: 8rpx; }
.spec-row { display:flex; flex-wrap: wrap; gap: 12rpx; }
.spec-chip { padding: 10rpx 18rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; color:#1f2937; background:#fff; }
.spec-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.spec-chip.disabled { opacity: .5; }
.desc { font-size: 26rpx; color:#1f2937; line-height: 1.6; white-space: pre-wrap; }
.bottom-bar { position: fixed; left:0; right:0; bottom:0; background:#ffffff; border-top: 2rpx solid #e5e7eb; padding: 12rpx 16rpx; display:flex; align-items:center; gap: 12rpx; }
.action { min-width: 160rpx; text-align:center; padding: 8rpx 0; border-radius: 16rpx; background: transparent; color:#111827; border: none; display:flex; flex-direction: column; align-items:center; gap: 6rpx; }
.action.active { background: transparent; color:#ef4444; border: none; }
.fav-action { min-width: 120rpx; }
.fav-action .fav-text { color:#111827; font-size: 22rpx; }
.fav-action.active .fav-text { color:#ef4444; }
.fav-icon { width: 40rpx; height: 40rpx; }
.cart-action { min-width: 160rpx; }
.cart-icon { width: 40rpx; height: 40rpx; }
.cart-svg { width: 40rpx; height: 40rpx; display:block; }
.cart-text { font-size: 22rpx; color:#111827; }
.buy { flex:1; text-align:center; padding: 18rpx 0; border-radius: 16rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; font-size: 28rpx; }
.buy.disabled { opacity: .6; filter: grayscale(0.15); }

/* 返回按钮复用风格 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>
