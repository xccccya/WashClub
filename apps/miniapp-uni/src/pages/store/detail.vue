<template>
	<view class="page">
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back2.png" />
		</view>

		<!-- 图片轮播 -->
		<view class="gallery" :style="{ height: galleryHeight + 'px' }">
			<swiper class="swiper" circular :indicator-dots="true" :autoplay="false" :current="currentIndex" @change="onSwiperChange">
				<swiper-item v-for="(img, idx) in displayImages" :key="idx">
					<view class="img-wrap">
						<image class="img" :src="resolveImageUrl(img)" mode="aspectFill" :lazy-load="true" @load="onImgLoad(idx)" @tap="onTapImage(idx)" @longpress="onLongPressImage(idx)" />
						<view class="img-skeleton" v-if="!imgLoaded[idx]"></view>
					</view>
				</swiper-item>
			</swiper>
			<view class="indicator" v-if="displayImages && displayImages.length">{{ currentIndex + 1 }}/{{ displayImages.length }}</view>
		</view>

		<!-- 基本信息 -->
		<view class="card info-card">
			<view class="row-top">
				<text class="name">{{ product?.name || '' }}</text>
			</view>
			<view class="row-mid">
				<template v-if="isRangeMode">
					<text class="price-hint">价格区间：</text>
					<text class="price">¥{{ minPriceText }}-¥{{ maxPriceText }}</text>
				</template>
				<template v-else>
					<text class="price">¥{{ displayPrice }}</text>
				</template>
				<text class="list-price" v-if="showListPrice">¥{{ formatPrice(effectiveListPrice) }}</text>
				<view class="promo-tags" v-if="promoTags.length">
					<text v-for="(t,i) in promoTags" :key="i" class="promo-tag">{{ t }}</text>
				</view>
				<view class="spacer"></view>
				<view class="decision-info" v-if="decisionChips.length">
					<view v-for="(chip,i) in decisionChips" :key="i" class="decision-chip">{{ chip }}</view>
				</view>
			</view>
			<view class="row-meta" v-if="trustSummaryText">
				<text class="meta-text">{{ trustSummaryText }}</text>
			</view>
			<view v-if="product?.sellPoint" class="sell">{{ product?.sellPoint }}</view>
			<!-- 单规格实物商品：直接展示库存信息 -->
			<view v-if="product?.type==='PHYSICAL' && product?.specType==='SINGLE'" class="stock-chip" :class="stockClass">
				<text class="dot"></text>
				<text class="stock-text">{{ stockText }}</text>
			</view>
		</view>

		<!-- 规格选择（多规格） -->
		<view v-if="product?.specType==='MULTI'" class="card" id="spec-block">
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
			<view v-if="descLoading" class="desc-skeleton">
				<view class="sk-line w80" /><view class="sk-line w90" /><view class="sk-line w60" />
			</view>
			<view v-else-if="renderNodesHtml" class="desc" :class="{ collapsed: descCollapsed && shouldShowCollapse }">
				<!-- #ifdef MP-WEIXIN -->
				<mp-html :content="renderNodesHtml" :tag-style="mpTagStyle" :copy-link="true" :selectable="true" :lazy-load="true" />
				<!-- #endif -->
				<!-- #ifndef MP-WEIXIN -->
				<rich-text :nodes="renderNodesHtml" />
				<!-- #endif -->
				<view v-if="hasTable" class="scroll-tip">左右滑动查看表格</view>
				<view class="desc-fade" v-if="descCollapsed && shouldShowCollapse"></view>
			</view>
			<view v-else class="desc">暂无介绍</view>
			<view v-if="renderNodesHtml && shouldShowCollapse" class="desc-toggle" @tap="descCollapsed = !descCollapsed">{{ descCollapsed ? '展开全部' : '收起' }}</view>
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
				<view v-if="cartCount>0" class="badge">{{ cartCount>99 ? '99+' : cartCount }}</view>
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
// #ifdef MP-WEIXIN
// 通过 easycom 使用 mp-html 组件
// #endif

// 微信小程序端 mp-html 标签样式（避免未定义导致渲染失败，并提供基础排版）
// #ifdef MP-WEIXIN
const mpTagStyle: Record<string, string> = {
	'body': 'font-size:26rpx; line-height:1.7; color:#1f2937;',
	'p': 'margin:0 0 12rpx; font-size:26rpx; line-height:1.7; color:#1f2937;',
	'img': 'max-width:100%; height:auto; display:block; border-radius:0;',
	'a': 'color:#2563eb; word-break:break-all; text-decoration:underline;',
	'ul': 'padding-left:28rpx; margin:0 0 12rpx;',
	'ol': 'padding-left:28rpx; margin:0 0 12rpx;',
	'li': 'margin:0 0 8rpx; font-size:26rpx; line-height:1.7;',
	'table': 'width:100%; border-collapse:collapse; margin:8rpx 0;',
	'th': 'border:1px solid #e5e7eb; padding:8rpx; background:#f9fafb; font-weight:600; font-size:24rpx;',
	'td': 'border:1px solid #e5e7eb; padding:8rpx; font-size:24rpx;'
};
// #endif

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
	// 可选：用于决策信息与信任概要（若后端未提供则不显示）
	serviceMode?: 'IN_STORE'|'DELIVERY'|'BOTH'|null;
	durationMinutes?: number|null;
	scopeText?: string|null;
	ratingAvg?: number|null;
	ratingCount?: number|null;
};

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const http = createHttp();

const id = ref<number|undefined>(undefined);
const product = ref<Product|null>(null);
const selectedSkuId = ref<number|undefined>(undefined);
const collected = ref<boolean>(false);
const sheetVisible = ref<boolean>(false);
const cartCount = ref<number>(0);

// 图集：高度自适应与懒加载骨架
const sysInfo = uni.getSystemInfoSync?.() as any;
const galleryHeight = Math.floor(sysInfo?.windowWidth || 375);
const imgLoaded = ref<boolean[]>([]);
function onImgLoad(idx:number){ const arr = imgLoaded.value.slice(); arr[idx] = true; imgLoaded.value = arr; }

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
	refreshCartCount();
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
	finally { descLoading.value = false; }
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

const displayImageAbsUrls = computed<string[]>(() => (displayImages.value || []).map(u => resolveImageUrl(u) || u));
const currentIndex = ref<number>(0);
function onSwiperChange(e:any){ try{ currentIndex.value = Number(e?.detail?.current||0) || 0; }catch{ currentIndex.value = 0; } }
function onTapImage(idx:number){
	try{
		const urls = displayImageAbsUrls.value;
		const i = Math.min(Math.max(0, idx||0), urls.length-1);
		uni.previewImage({ current: urls[i], urls });
	}catch{}
}
function onLongPressImage(idx:number){
	try{
		const urls = displayImageAbsUrls.value;
		const i = Math.min(Math.max(0, idx||0), urls.length-1);
		const url = urls[i];
		// #ifdef MP-WEIXIN
		uni.showActionSheet({
			itemList: ['保存到相册'],
			success: async (res:any) => {
				if (res.tapIndex === 0) {
					try{
						const d:any = await uni.downloadFile({ url });
						if (Number(d?.statusCode) === 200 && d?.tempFilePath) {
							await uni.saveImageToPhotosAlbum({ filePath: d.tempFilePath });
							uni.showToast({ title:'已保存到相册', icon:'none' });
						}
					}catch{ uni.showToast({ title:'保存失败', icon:'none' }); }
				}
			}
		});
		// #endif
		// #ifdef H5
		try{
			const a = document.createElement('a');
			a.href = url; a.download = url.split('/').pop() || 'image.jpg';
			document.body.appendChild(a); a.click(); document.body.removeChild(a);
			uni.showToast({ title:'已触发下载', icon:'none' });
		}catch{}
		// #endif
	}catch{}
}

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
	if (qty <= 0) return '库存不足';
	if (qty > 0 && qty <= 5) return `仅剩 ${qty} 件`;
	return `剩余 ${qty}`;
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

// 价格区与CTA逻辑
const isRangeMode = computed<boolean>(() => {
	if (!product.value) return false;
	if (product.value.specType !== 'MULTI') return false;
	if (typeof selectedSkuId.value === 'number') return false;
	const min = Number(product.value.minPrice || 0);
	const max = Number(product.value.maxPrice || 0);
	return max > 0 && (max - min) > 0.009;
});
const minPriceText = computed<string>(() => {
	const min = Number(product.value?.minPrice || product.value?.price || 0);
	return isNaN(min) ? '0.00' : min.toFixed(2);
});
const maxPriceText = computed<string>(() => {
	const max = Number(product.value?.maxPrice || product.value?.price || 0);
	return isNaN(max) ? '0.00' : max.toFixed(2);
});
const effectiveListPrice = computed<number>(() => {
	if (!product.value) return 0;
	if (product.value.specType === 'SINGLE') return Number(product.value.listPrice || 0);
	// 多规格：缺少SKU划线价数据则不展示
	return 0;
});
const showListPrice = computed<boolean>(() => effectiveListPrice.value > 0 && effectiveListPrice.value > Number(unitPrice.value || 0));
const promoTags = computed<string[]>(() => {
	const tags: string[] = [];
	if (showListPrice.value) {
		const lp = effectiveListPrice.value;
		const p = Number(unitPrice.value || 0);
		if (lp > 0 && p > 0 && lp > p) {
			const off = Math.round((1 - p / lp) * 100);
			if (off >= 5) tags.push(`立省${off}%`);
		}
		// 轻量标签（占位）
		tags.push('限时');
	}
	return tags.slice(0,2);
});
const decisionChips = computed<string[]>(() => {
	const chips: string[] = [];
	const p = product.value as any;
	const mode = p?.serviceMode as string|undefined;
	if (mode === 'IN_STORE') chips.push('到店');
	else if (mode === 'DELIVERY') chips.push('配送');
	else if (mode === 'BOTH') chips.push('到店/配送');
	if (typeof p?.durationMinutes === 'number' && p.durationMinutes > 0) chips.push(`预计时长约${p.durationMinutes}分钟`);
	if (p?.scopeText) chips.push(`适用范围：${String(p.scopeText).trim()}`);
	return chips;
});
const trustSummaryText = computed<string>(() => {
	const p = product.value as any;
	const arr: string[] = [];
	if (typeof p?.ratingAvg === 'number' && p.ratingAvg > 0) arr.push(`评分 ${p.ratingAvg.toFixed(1)}`);
	if (typeof p?.ratingCount === 'number' && p.ratingCount > 0) arr.push(`评价 ${p.ratingCount}`);
	if (typeof p?.totalSales === 'number' && p.totalSales > 0) arr.push(`销量 ${p.totalSales}`);
	return arr.join(' · ');
});

const buyText = computed<string>(() => {
	if (product.value?.specType === 'MULTI' && !selectionComplete.value) return '选择规格';
	if (product.value?.type !== 'PHYSICAL') return '立即购买';
	if (product.value.specType === 'SINGLE') return buyDisabled.value ? '当前商品售罄' : '立即购买';
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
	if (selectedSpecValues.value[key] === value) {
		// 再次点击同一值，撤销选择
		const next = { ...selectedSpecValues.value };
		delete next[key];
		selectedSpecValues.value = next;
	} else {
		if (isOptionDisabled(key, value)) return;
		selectedSpecValues.value = { ...selectedSpecValues.value, [key]: value };
	}
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
		refreshCartCount();
	} catch {
		uni.showToast({ title:'加入失败', icon:'none' });
	}
}

function onBuyTap(){
	if (!product.value) return;
	if (!getToken()) { uni.navigateTo({ url:'/pages/login/index' }); return; }
	checkAuthAndRefresh({ redirectIfExpired: true });
	if (product.value.type !== 'PHYSICAL') { sheetVisible.value = true; return; }
	if (product.value.specType === 'MULTI' && !selectionComplete.value) {
		// 引导滚动到规格区
		try { uni.pageScrollTo({ selector:'#spec-block', duration: 300 }); } catch {}
		return;
	}
	if (buyDisabled.value) return; // 售罄时不可点击
	sheetVisible.value = true;
}
function onSubmitted(){ /* 可根据需要刷新 */ }

// 富文本渲染：将后端编辑器内容做适配（图片绝对化与自适应）+ 骨架屏
const descLoading = ref<boolean>(true);
const renderedHtml = computed<string>(() => {
	const html = String(product.value?.description || '').trim();
	if (!html) return '';
	return sanitizeHtml(transformEditorHtml(html));
});
const isHtmlRich = computed<boolean>(() => /<\w+[^>]*>/.test(String(product.value?.description||'')));
const hasTable = computed<boolean>(() => /<table\b/i.test(String(renderedHtml.value||'')));
const descCollapsed = ref<boolean>(true);
const shouldShowCollapse = computed<boolean>(() => {
	const plain = String(product.value?.description||'');
	if (!plain) return false;
	if (/\n/.test(plain) || /<img\b/i.test(String(renderedHtml.value||''))) return true;
	return plain.length > 160;
});
const renderedHtmlAsParagraph = computed<string>(() => {
	const text = String(product.value?.description||'').trim();
	if (!text) return '';
	const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
	return `<p>${esc}</p>`;
});
// 统一 rich-text nodes，避免 mp-html 依赖在某些环境不生效
const renderNodesHtml = computed<string>(() => {
	if (!renderedHtml.value) return '';
	return isHtmlRich.value ? renderedHtml.value : renderedHtmlAsParagraph.value;
});

function transformEditorHtml(html: string): string{
	try{
		let out = html;
		// 去除 DOCTYPE / html / head 包裹并抽取 body 内部
		out = out.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
		const bodyMatch = out.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
		if (bodyMatch && bodyMatch[1]) out = bodyMatch[1];
		out = out.replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, '');
		out = out.replace(/<html[^>]*>|<\/html>/gi, '');
		// 语义标签替换为 div，提升在小程序端的兼容性
		out = out.replace(/<\/?(section|article|header|footer|main|aside|figure|figcaption)\b/gi, (m) => m.replace(/\w+/, (w)=> w[0]==='<'?'<div':'div'));
		// 移除可能影响布局的行内宽高
		out = out.replace(/\swidth=["'][^"']*["']/gi, '').replace(/\sheight=["'][^"']*["']/gi, '');
		// 处理 img：src 绝对化，添加自适应样式
		out = out.replace(/<img\b[^>]*>/gi, (tag) => {
			let t = tag;
			t = t.replace(/src=["']([^"']+)["']/i, (m, p1) => {
				const abs = resolveImageUrl(p1) || p1;
				return `src="${abs}"`;
			});
			if (/style=/.test(t)) {
				t = t.replace(/style=["']([^"']*)["']/, (m, s) => `style="${s};max-width:100%;height:auto;display:block"`);
			} else {
				t = t.replace(/<img\b/i, '<img style="max-width:100%;height:auto;display:block"');
			}
			return t;
		});
		return out;
	}catch{ return html; }
}

function sanitizeHtml(html: string): string{
	try{
		// 仅移除危险脚本/样式/iframe，保留其它内容
		let out = html;
		out = out.replace(/<(script|style|iframe)[\s\S]*?>[\s\S]*?<\/\1>/gi,'');
		// 过滤行内事件与 javascript: 协议
		out = out.replace(/<([^\s>\/]+)([^>]*)>/gi, (m, tag, attrs) => {
			let a = String(attrs||'');
			a = a.replace(/\son[a-zA-Z]+\s*=\s*"[^"]*"/gi,'').replace(/\son[a-zA-Z]+\s*=\s*'[^']*'/gi,'');
			a = a.replace(/\shref\s*=\s*"javascript:[^"]*"/gi,'').replace(/\shref\s*=\s*'javascript:[^']*'/gi,'');
			a = a.replace(/\ssrc\s*=\s*"javascript:[^"]*"/gi,'').replace(/\ssrc\s*=\s*'javascript:[^']*'/gi,'');
			return `<${tag}${a}>`;
		});
		return out;
	}catch{ return html; }
}

async function refreshCartCount(){
	try{
		const token = getToken(); if (!token) { cartCount.value = 0; return; }
		const list:any[] = await http('/cart/me/list', { method:'GET' });
		const total = (Array.isArray(list)? list:[]).reduce((s:number,row:any)=> s + Number(row?.quantity||0), 0);
		cartCount.value = Math.max(0, Number(total||0));
	}catch{ cartCount.value = 0; }
}
</script>

<style>
.page { min-height: 100vh; background:#f7fafc; padding-bottom: calc(env(safe-area-inset-bottom) + 120rpx); }
.gallery { position: relative; background:#fff; }
.swiper { width: 100%; height: 100%; }
.img-wrap { position: relative; width: 100%; height: 100%; }
.img { width: 100%; height: 100%; display:block; }
.img-skeleton { position:absolute; inset:0; background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6); background-size:200% 100%; animation: sk 1.2s infinite; }
.indicator { position: absolute; right: 16rpx; bottom: 16rpx; padding: 6rpx 12rpx; font-size: 22rpx; color:#fff; background: rgba(17,24,39,.4); border-radius: 999rpx; }
.card { background:#ffffff; border-radius:24rpx; padding:24rpx; margin: 16rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); }
.info-card .row-top { display:flex; align-items:center; justify-content: space-between; }
.name { font-size: 32rpx; font-weight: 800; color:#0b1220; }
.sales { font-size: 24rpx; color:#6b7280; }
.row-mid { margin-top: 8rpx; display:flex; align-items: center; gap: 8rpx; }
.price { font-size: 36rpx; color:#ef4444; font-weight: 800; }
.list-price { font-size: 24rpx; color:#6b7280; text-decoration: line-through; }
.price-hint { font-size: 24rpx; color:#6b7280; }
.promo-tags { display:flex; gap:8rpx; margin-left: 8rpx; }
.promo-tag { font-size: 20rpx; color:#0ea5e9; background:#e0f2fe; border-radius: 999rpx; padding: 4rpx 10rpx; }
.spacer { flex:1; }
.decision-info { display:flex; gap:8rpx; flex-wrap:wrap; justify-content:flex-end; }
.decision-chip { font-size: 20rpx; color:#475569; background:#f1f5f9; padding: 4rpx 10rpx; border-radius: 999rpx; }
.row-meta { margin-top: 6rpx; }
.meta-text { font-size: 22rpx; color:#6b7280; }
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
.spec-chip.disabled { opacity: .5; border-style: dashed; }
.desc { font-size: 26rpx; color:#1f2937; line-height: 1.6; white-space: pre-wrap; position: relative; }
.desc.collapsed { max-height: 240rpx; overflow: hidden; }
.desc-fade { position:absolute; left:0; right:0; bottom:0; height: 80rpx; background: linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 70%); }
.desc-toggle { margin-top: 8rpx; color:#2563eb; font-size: 26rpx; }
.scroll-tip { margin-top: 8rpx; font-size: 22rpx; color:#94a3b8; }
.desc-skeleton { display:flex; flex-direction: column; gap: 12rpx; }
.sk-line { height: 28rpx; background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6); background-size: 200% 100%; border-radius: 8rpx; animation: sk 1.2s infinite; }
.sk-line.w80 { width: 80%; }
.sk-line.w90 { width: 90%; }
.sk-line.w60 { width: 60%; }
@keyframes sk { 0% { background-position: 0 0; } 100% { background-position: -200% 0; } }
.bottom-bar { position: fixed; left:0; right:0; bottom:0; background:#ffffff; border-top: 2rpx solid #e5e7eb; padding: 12rpx 16rpx; display:flex; align-items:center; gap: 12rpx; }
.action { min-width: 160rpx; text-align:center; padding: 8rpx 0; border-radius: 16rpx; background: transparent; color:#111827; border: none; display:flex; flex-direction: column; align-items:center; gap: 6rpx; transition: transform .15s ease, opacity .15s ease; }
.action.active { background: transparent; color:#2563eb; border: none; }
.fav-action { min-width: 120rpx; }
.fav-action .fav-text { color:#111827; font-size: 22rpx; }
.fav-action.active .fav-text { color:#2563eb; }
.fav-icon { width: 40rpx; height: 40rpx; }
.cart-action { min-width: 160rpx; position: relative; }
.cart-icon { width: 40rpx; height: 40rpx; }
.cart-svg { width: 40rpx; height: 40rpx; display:block; }
.cart-text { font-size: 22rpx; color:#111827; }
.badge { position:absolute; top:-4rpx; right: 8rpx; background:#ef4444; color:#fff; font-size: 18rpx; padding: 2rpx 6rpx; border-radius: 999rpx; min-width: 28rpx; text-align:center; }
.buy { flex:1; text-align:center; padding: 18rpx 0; border-radius: 16rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; font-size: 28rpx; transition: transform .15s ease, opacity .15s ease; }
.buy.disabled { opacity: .6; filter: grayscale(0.15); }
.action:active { transform: scale(0.98); }
.buy:active { transform: scale(0.985); }

/* 返回按钮复用风格 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; width: 72rpx; height: 72rpx; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,0.1); border-radius: 50%; backdrop-filter: blur(2px); }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>
