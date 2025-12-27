<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />

		<!-- 顶部店铺信息 -->
		<view class="card store-header">
			<view class="store-row">
				<text class="store-name">{{ storeName }}</text>
				<text class="store-distance" @tap="manualRefresh" @click="manualRefresh">{{ distanceText }}</text>
			</view>
			<view class="store-sub">
				<text class="biz-hours-sub">营业时间 {{ bizHoursStart }} - {{ bizHoursEnd }}</text>
			</view>
		</view>

		<!-- 顶部滚动公告（保留API对接） -->
		<view class="card notice-card" v-if="noticeStore">
			<view class="marquee">
				<text class="marquee-text">{{ noticeStore }}</text>
			</view>
		</view>

		<!-- 主体内容区 -->
		<view class="content-card">
			<!-- 合并后的标签置于卡片顶部 -->
			<view class="tabs tabs-embedded">
				<view class="tab-item" :class="{ active: activeTab==='service' }" @tap="switchTab('service')" @click="switchTab('service')">服务商品</view>
				<view class="tab-item" :class="{ active: activeTab==='goods' }" @tap="switchTab('goods')" @click="switchTab('goods')">实物商品</view>
				<view class="tab-item" :class="{ active: activeTab==='flash' }" @tap="switchTab('flash')" @click="switchTab('flash')">秒杀活动</view>
			</view>

			<view class="content-body">
			<!-- 左侧分类（服务端） -->
			<view class="category-sidebar" v-if="activeTab!=='flash'">
				<scroll-view scroll-y class="category-list">
					<view v-for="c in categories" :key="c.id" class="category-item" :class="{ active: c.id===activeCategory }" @tap="() => selectCategory(c)">{{ c.name }}</view>
				</scroll-view>
			</view>

			<!-- 右侧商品面板 -->
			<view class="product-panel">
				<scroll-view scroll-y class="product-scroller">
					<view v-if="activeTab==='flash'" class="flash-placeholder">
						<text>暂无活动，敬请期待</text>
					</view>
					<view v-else class="product-list">
							<view v-for="p in products" :key="p.id" class="product-card" @tap="() => goDetail(p)">
								<image class="thumb" :src="thumbOf(p)" mode="aspectFill" />
								<view class="info">
									<text class="name">{{ p.name }}</text>
									<text v-if="p.sellPoint" class="sell">{{ p.sellPoint }}</text>
									<view class="bottom-row">
										<text class="price">{{ displayPriceText(p) }}</text>
										<view v-if="activeTab==='service'" class="buy-btn" @tap.stop="() => openSheet(p)">立即购买</view>
										<view v-else class="add-cart-btn" @tap.stop="() => addToCartFromList(p)">
											<image class="add-icon" src="/static/icons/add.png" mode="aspectFit" />
										</view>
									</view>
								</view>
							</view>
					</view>
				</scroll-view>
			</view>
			</view>
		</view>

		<PurchaseSheet v-model:visible="sheetVisible" :product="currentProduct" @submitted="onSubmitted" />

		<!-- 仅在实物商品标签下显示购物车悬浮按钮 -->
		<view v-if="activeTab==='goods'" class="cart-fab" @tap="gotoCart">
			<!-- #ifdef H5 -->
			<svg class="cart-fab-svg" width="226.5625" height="200" viewBox="0 0 1160 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
				<path d="M415.1296 857.429333a83.285333 83.285333 0 1 1 0 166.570667 83.285333 83.285333 0 0 1 0-166.570667z m499.643733 0a83.285333 83.285333 0 1 1 0 166.570667 83.285333 83.285333 0 0 1 0-166.570667zM213.435733 0v0.4096l5.12-0.034133a34.133333 34.133333 0 0 1 34.2016 29.2864l20.48 143.803733h834.013867a34.133333 34.133333 0 0 1 33.6896 39.697067l-83.524267 506.88a68.266667 68.266667 0 0 1-67.345066 57.1392H318.327467c-1.774933 0-3.515733-0.136533-5.2224-0.375467h-6.144a34.133333 34.133333 0 0 1-34.2016-29.2864L197.188267 218.043733l-7.338667-44.578133h0.989867l-12.868267-90.2144H20.48V0h192.955733z m330.308267 340.138667H481.28v270.404266h62.464V340.138667z m312.285867 0h-62.464v270.404266h62.464V340.138667z" fill="#1296DB" class=""></path>
			</svg>
			<!-- #endif -->
			<!-- #ifndef H5 -->
			<image class="cart-fab-icon" src="/static/icons/cart.png" mode="aspectFit" />
			<!-- #endif -->
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { getToken, checkAuthAndRefresh } from '../../utils/auth';
import { resolveImageUrl } from '../../utils/url';
import { AMAP_API_BASE } from '../../utils/thirdparty';
import { readAmapKey, readStoreLocation } from '../../utils/env';
import { useSafeArea } from '../../utils/safe-area';
import PurchaseSheet from '../../components/PurchaseSheet.vue';
import {
	cartControllerMyAdd,
	cartControllerMyList,
	scrollNoticeControllerActive,
	storeCategoryControllerList,
	storeProductControllerGet,
	storeProductControllerList,
	systemSettingControllerGetPublicBusinessStatus,
} from '@wash/api-client';
declare const wx: any;

const { topSpacerHeight } = useSafeArea();

// 顶部店铺信息（动态距离/时长）
const storeName = ref('巨科汽车美容（威远店）');
const distanceText = ref('距离计算中…');
const lastLocateAt = ref<number>(0);

// 营业时间展示
const bizHoursStart = ref<string>('09:00');
const bizHoursEnd = ref<string>('18:00');
async function loadBizHours(){
  try{
    const j:any = await systemSettingControllerGetPublicBusinessStatus() as any;
    bizHoursStart.value = String(j?.hours?.start||'09:00');
    bizHoursEnd.value = String(j?.hours?.end||'18:00');
  }catch{}
}

function readEnv(key: string): string{
	try {
		const im: any = (import.meta as any)?.env || {};
		const v = String(im[key] ?? im[`VITE_${key}`] ?? (globalThis as any)?.process?.env?.[key] ?? '').trim();
		return v;
	} catch { return ''; }
}

function parseLngLat(input?: string|null): { lng: number; lat: number } | null {
	try {
		const s = String(input||'').trim(); if (!s) return null;
		const parts = s.split(/[,，\s]+/).map(x=>x.trim()).filter(Boolean);
		if (parts.length < 2) return null;
		const lng = Number(parts[0]); const lat = Number(parts[1]);
		if (!isFinite(lng) || !isFinite(lat)) return null;
		return { lng, lat };
	} catch { return null; }
}

function haversineKm(a:{lng:number;lat:number}, b:{lng:number;lat:number}): number{
	try{
		const toRad = (d:number)=> d*Math.PI/180;
		const R = 6371; // km
		const dLat = toRad(b.lat - a.lat);
		const dLng = toRad(b.lng - a.lng);
		const lat1 = toRad(a.lat);
		const lat2 = toRad(b.lat);
		const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
		return 2*R*Math.asin(Math.min(1, Math.sqrt(h)));
	}catch{ return NaN; }
}

async function requestJSON(url: string, query: Record<string, any>): Promise<any>{
	return new Promise((resolve) => {
		try {
			const qs = Object.keys(query||{}).map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(query[k]??'')}`).join('&');
			const full = qs ? `${url}?${qs}` : url;
			uni.request({ url: full, method: 'GET', timeout: 10000, dataType: 'json', success: (res:any)=> resolve(res?.data), fail: (err:any)=> { try{ console.warn('AMap request failed', full, err); }catch{} resolve(null); } });
		} catch { resolve(null); }
	});
}

async function updateStoreDistance(){
	// 显示进行中的状态
	distanceText.value = '定位中…';
	// 仅小程序内获取定位
	// #ifdef MP-WEIXIN
	try {
		await new Promise<void>((resolve)=>{
			try{
				try { uni.authorize({ scope: 'scope.userLocation', complete: ()=>{} }); } catch {}
				uni.getLocation({
					type: 'wgs84',
					isHighAccuracy: true,
					highAccuracyExpireTime: 5000,
					success: async (res:any) => {
						try{
							const gpsLng = Number(res?.longitude); const gpsLat = Number(res?.latitude);
							if (!isFinite(gpsLng) || !isFinite(gpsLat)) { distanceText.value = '定位失败'; resolve(); return; }
							// 读取配置（放在定位之后，确保先触发授权弹窗）
							const key = readAmapKey();
							const storeCoord = parseLngLat(readStoreLocation());
							if (!key || !storeCoord) { distanceText.value = '配置缺失'; resolve(); return; }
							const locs = `${gpsLng.toFixed(6)},${gpsLat.toFixed(6)}`;
							// 坐标转换（WGS84->GCJ02/高德）
							distanceText.value = '坐标转换中…';
							const convertResp = await requestJSON(`${AMAP_API_BASE}/v3/assistant/coordinate/convert`, { key, locations: locs, coordsys: 'gps' });
							if (!convertResp || String(convertResp?.status) !== '1') { distanceText.value = '坐标转换失败'; resolve(); return; }
							const locStr = String(convertResp?.locations||'').trim();
							const userConv = parseLngLat(locStr);
							const originLng = userConv?.lng ?? gpsLng; const originLat = userConv?.lat ?? gpsLat;
							// 路线规划2.0 驾车
							distanceText.value = '路径规划中…';
							let driveResp = await requestJSON(`${AMAP_API_BASE}/v5/direction/driving`, {
								key,
								origin: `${originLng},${originLat}`,
								destination: `${storeCoord.lng},${storeCoord.lat}`,
								show_fields: 'cost'
							});
							if (!driveResp || String(driveResp?.status) !== '1') {
								// 回退到 v3 驾车
								driveResp = await requestJSON(`${AMAP_API_BASE}/v3/direction/driving`, {
									key,
									origin: `${originLng},${originLat}`,
									destination: `${storeCoord.lng},${storeCoord.lat}`,
									strategy: 10,
									extensions: 'base'
								});
							}
							const path = (driveResp?.route?.paths||[])[0] || {};
							const distanceM = Number(path?.distance||0);
							const durationS = Number(path?.cost?.duration||path?.duration||0);
							if (!isFinite(distanceM) || distanceM<=0) {
								const kmLine = haversineKm({lng:originLng,lat:originLat}, {lng:storeCoord.lng,lat:storeCoord.lat});
								if (isFinite(kmLine)) { distanceText.value = `直线 ${Math.max(0.1, Math.round(kmLine*10)/10)}km`; resolve(); return; }
								distanceText.value = '距离获取失败'; resolve(); return;
							}
							const km = Math.max(0.1, Math.round((distanceM/1000)*10)/10);
							const min = Math.max(1, Math.round(durationS/60));
							distanceText.value = `距离${km}km.驾车预计${min}分钟`;
							try { uni.setStorageSync('store_last_distance_text', distanceText.value); uni.setStorageSync('store_last_locate_at', Date.now()); } catch {}
							resolve();
						}catch{ distanceText.value = '距离获取失败'; resolve(); }
					},
					fail: ()=>{ distanceText.value = '定位未授权'; resolve(); }
				});
			}catch{ distanceText.value = '定位失败'; resolve(); }
		});
	} catch { distanceText.value = '定位失败'; }
	// #endif
	// H5 环境：统一使用 uni.getLocation 以触发系统定位授权
	// #ifdef H5
	try {
		await new Promise<void>(async (resolve)=>{
			try{
				try { await new Promise(r => uni.authorize({ scope: 'scope.userLocation', complete: ()=> r(null) })); } catch {}
				uni.getLocation({
					type: 'wgs84',
					isHighAccuracy: true,
					highAccuracyExpireTime: 5000,
					success: async (pos:any)=>{
						try{
							const gpsLng = Number(pos?.longitude); const gpsLat = Number(pos?.latitude);
							if (!isFinite(gpsLng) || !isFinite(gpsLat)) { distanceText.value = '定位失败'; resolve(); return; }
							// 读取配置（放在定位之后，确保先触发授权弹窗）
							const key = readAmapKey();
							const storeCoord = parseLngLat(readStoreLocation());
							if (!key || !storeCoord) { distanceText.value = '配置缺失'; resolve(); return; }
							const locs = `${gpsLng.toFixed(6)},${gpsLat.toFixed(6)}`;
							distanceText.value = '坐标转换中…';
							const convertResp = await requestJSON(`${AMAP_API_BASE}/v3/assistant/coordinate/convert`, { key, locations: locs, coordsys: 'gps' });
							if (!convertResp || String(convertResp?.status) !== '1') { distanceText.value = '坐标转换失败'; resolve(); return; }
							const locStr = String(convertResp?.locations||'').trim();
							const userConv = parseLngLat(locStr);
							const originLng = userConv?.lng ?? gpsLng; const originLat = userConv?.lat ?? gpsLat;
							distanceText.value = '路径规划中…';
							let driveResp = await requestJSON(`${AMAP_API_BASE}/v5/direction/driving`, {
								key,
								origin: `${originLng},${originLat}`,
								destination: `${storeCoord.lng},${storeCoord.lat}`,
								show_fields: 'cost'
							});
							if (!driveResp || String(driveResp?.status) !== '1') {
								// 回退到 v3
								driveResp = await requestJSON(`${AMAP_API_BASE}/v3/direction/driving`, {
									key,
									origin: `${originLng},${originLat}`,
									destination: `${storeCoord.lng},${storeCoord.lat}`,
									strategy: 10,
									extensions: 'base'
								});
							}
							const path = (driveResp?.route?.paths||[])[0] || {};
							const distanceM = Number(path?.distance||0);
							const durationS = Number(path?.cost?.duration||path?.duration||0);
							if (!isFinite(distanceM) || distanceM<=0) {
								const kmLine = haversineKm({lng:originLng,lat:originLat}, {lng:storeCoord.lng,lat:storeCoord.lat});
								if (isFinite(kmLine)) { distanceText.value = `直线 ${Math.max(0.1, Math.round(kmLine*10)/10)}km`; resolve(); return; }
								distanceText.value = '距离获取失败'; resolve(); return;
							}
							const km = Math.max(0.1, Math.round((distanceM/1000)*10)/10);
							const min = Math.max(1, Math.round(durationS/60));
							distanceText.value = `距离${km}km.驾车预计${min}分钟`;
							try { uni.setStorageSync('store_last_distance_text', distanceText.value); uni.setStorageSync('store_last_locate_at', Date.now()); } catch {}
							resolve();
						}catch{ distanceText.value = '距离获取失败'; resolve(); }
					}, fail: ()=>{ distanceText.value = '定位未授权'; resolve(); }
				});
			}catch{ distanceText.value = '定位失败'; resolve(); }
		});
	} catch { distanceText.value = '定位失败'; }
	// #endif
}

function manualRefresh(){ lastLocateAt.value = 0; updateStoreDistance(); }

// 顶部标签
type TabKey = 'service' | 'goods' | 'flash';
const activeTab = ref<TabKey>('service');
function switchTab(tab: TabKey) { activeTab.value = tab; }

// 分类与商品（服务端数据）
const categories = ref<any[]>([]);
const activeCategory = ref<number | null>(null);
function selectCategory(c: any) { activeCategory.value = c?.id || null; fetchProducts(); }

const products = ref<any[]>([]);
function formatPrice(p: any){ const n = Number(p); return isNaN(n) ? p : n.toFixed(2); }

function displayPriceText(p: any){
	if (p?.specType === 'MULTI') {
		const min = Number(p?.minPrice ?? 0);
		return `¥${formatPrice(min)}起`;
	}
	return `¥${formatPrice(p?.price)}`;
}

function thumbOf(p:any){
	const arr = Array.isArray(p?.imagesJson) ? p.imagesJson : [];
	const raw = p?.imageUrl || arr?.[0] || '';
	return resolveImageUrl(raw) || '/static/icons/placeholder.png';
}

async function fetchCategories(){
	try {
		// 秒杀页：隐藏并清空分类
		if (activeTab.value === 'flash') { categories.value = []; activeCategory.value = null; return; }
		// 按 Tab 类型筛选分类
		let typeParam: string | undefined = undefined;
		if (activeTab.value === 'service') typeParam = 'SERVICE';
		else if (activeTab.value === 'goods') typeParam = 'PHYSICAL';
		const list = await storeCategoryControllerList({ type: typeParam } as any) as any;
		categories.value = Array.isArray(list) ? list : [];
		activeCategory.value = categories.value[0]?.id || null;
	} catch { categories.value = []; activeCategory.value = null; }
}
async function fetchProducts(){
	try {
		// 秒杀页：占位，清空商品
		if (activeTab.value === 'flash') { products.value = []; return; }
		const list = await storeProductControllerList({ categoryId: activeCategory.value || undefined } as any) as any;
		// 根据 Tab 过滤：服务 或 实物（仅 PHYSICAL）
		products.value = (Array.isArray(list) ? list : [])
		  .filter((p:any) => activeTab.value==='service' ? p.type==='SERVICE' : p.type==='PHYSICAL')
		  .filter((p:any) => p?.enabled !== false);
	} catch { products.value = []; }
}

watch(activeTab, async () => { await fetchCategories(); await fetchProducts(); });

// 公告（保留API对接）
const noticeStore = ref('');
onShow(async () => {
	try {
		const active = await scrollNoticeControllerActive({ type: 'store' } as any) as any;
		noticeStore.value = active?.content || '';
	} catch {}
	await loadBizHours();
	await fetchCategories();
	await fetchProducts();
	// 计算到店距离：5分钟缓存
	const now = Date.now();
	const cachedAt = Number(uni.getStorageSync('store_last_locate_at') || 0);
	if (!cachedAt || now - cachedAt > 5*60*1000) {
		lastLocateAt.value = now;
		uni.setStorageSync('store_last_locate_at', now);
		// #ifdef MP-WEIXIN
		updateStoreDistance();
		// #endif
		// #ifdef H5
		updateStoreDistance();
		// #endif
	} else {
		lastLocateAt.value = cachedAt;
		distanceText.value = uni.getStorageSync('store_last_distance_text') || '距离已缓存';
	}
});

// 登录校验：未登录跳转登录页，已登录则校验/刷新
async function requireLogin(): Promise<boolean>{
	try{
		const token = getToken();
		if (!token) { uni.navigateTo({ url: '/pages/login/index' }); return false; }
		const ok = await checkAuthAndRefresh({ redirectIfExpired: true });
		return !!ok;
	}catch{ return false; }
}

// 购买：弹出统一确认卡片
const sheetVisible = ref(false);
const currentProduct = ref<any|null>(null);
async function openSheet(p:any){ if (!(await requireLogin())) return; currentProduct.value = p; sheetVisible.value = true; }
function onSubmitted(){ /* 提交后可刷新订单页或本页 */ }

function goDetail(p:any){ if (!p?.id) return; uni.navigateTo({ url: `/pages/store/detail?id=${p.id}` }); }
async function gotoCart(){ if (!(await requireLogin())) return; try { uni.navigateTo({ url: '/pages/cart/index' }); } catch {} }

async function addToCartFromList(p:any){
	try{
		if (!p || p.type !== 'PHYSICAL') return;
		if (!(await requireLogin())) return;
		if (p.specType === 'MULTI') { goDetail(p); return; }
		// 单规格：加入前做库存校验（商品库存 - 购物车已加数量）
		const detail:any = await storeProductControllerGet(Number(p.id)) as any;
		const stock = Math.max(0, Number(detail?.stockQuantity ?? p?.stockQuantity ?? 0));
		if (stock <= 0) { uni.showToast({ title:'已售罄', icon:'none' }); return; }
		let inCart = 0;
		try{
			const list:any[] = await cartControllerMyList({ token: '', onlyChecked: 'false' } as any) as any;
			inCart = (Array.isArray(list)? list:[]).filter((row:any)=> Number(row?.productId)===Number(p.id) && !row?.skuId).reduce((s:number,row:any)=> s + Number(row?.quantity||0), 0);
		}catch{}
		if (inCart >= stock) { uni.showToast({ title:'超过商品库存', icon:'none' }); return; }
		const canAdd = Math.min(1, Math.max(0, stock - inCart));
		if (canAdd <= 0) { uni.showToast({ title:'超过商品库存', icon:'none' }); return; }
		await cartControllerMyAdd({ productId: p.id, skuId: null, quantity: canAdd } as any);
		uni.showToast({ title: canAdd===1 ? '已加入购物车' : `库存不足，已加入${canAdd}件`, icon:'none' });
	}catch{
		uni.showToast({ title:'加入失败', icon:'none' });
	}
}
</script>

<style>
.page { min-height: 100vh; display:flex; flex-direction: column; padding: 24rpx 24rpx 0 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; padding-bottom: calc(env(safe-area-inset-bottom) + 120rpx); }

.card { background:#ffffff; border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }

/* 顶部店铺信息 */
.store-header { display:flex; flex-direction: column; align-items: stretch; }
.store-row { display:flex; align-items:flex-start; justify-content: space-between; gap: 12rpx; margin-bottom: 4rpx; }
.store-name { font-size:30rpx; font-weight:600; color:#111827; max-width: 70%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.store-distance { font-size:24rpx; color:#374151; white-space: nowrap; font-weight:600; }
.store-sub { display:flex; align-items:center; justify-content:flex-start; }
.biz-hours-sub { font-size:22rpx; color:#6b7280; }

/* 公告 */
.notice-card { padding: 16rpx 24rpx; }
.marquee { overflow:hidden; white-space: nowrap; }
.marquee-text { display:inline-block; padding-left:100%; animation: scroll-left 12s linear infinite; color:#374151; }
@keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

/* 顶部标签 */
.tabs { display:flex; align-items:center; justify-content: space-around; background:#ffffff; border-radius:24rpx; padding: 8rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }
.tab-item { flex:1; text-align:center; padding: 20rpx 0; font-size:26rpx; color:#6b7280; border-bottom: 4rpx solid transparent; }
.tab-item.active { color:#111827; font-weight:600; border-bottom-color:#60a5fa; }

/* 主内容卡片 */
.content-card { background:#ffffff; border-radius:32rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); display:flex; flex-direction: column; overflow:hidden; flex: 1; }
.content-body { display:flex; flex:1; overflow:hidden; }

/* 左侧分类 */
.category-sidebar { width: 220rpx; background:#f9fafb; padding: 16rpx 0; display:flex; flex-direction: column; }
.category-list { height: 100%; }
.category-item { padding: 24rpx 20rpx; font-size:26rpx; color:#374151; border-left: 8rpx solid transparent; }
.category-item.active { background:#ffffff; color:#111827; border-left-color:#60a5fa; }

/* 右侧面板 */
.product-panel { flex:1; padding: 16rpx; display:flex; flex-direction: column; background:#ffffff; }
.panel-head { font-size:26rpx; color:#6b7280; margin: 4rpx 8rpx 16rpx 8rpx; }
.product-scroller { height: 100%; }
.product-list { display:flex; flex-direction: column; gap: 16rpx; padding: 0 8rpx 16rpx 8rpx; }
.product-card { background:#ffffff; border-radius: 20rpx; padding: 16rpx; display:flex; flex-direction: row; gap: 12rpx; align-items:stretch; box-shadow:0 4rpx 12rpx rgba(0,0,0,0.04); }
.thumb { width: 120rpx; height: 120rpx; border-radius: 16rpx; background: linear-gradient(135deg, #e0f2fe, #ffe4ef); flex-shrink:0; }
.info { display:flex; flex-direction: column; gap: 6rpx; flex:1; }
.name { font-size:26rpx; color:#111827; font-weight:600; }
.sell { font-size:22rpx; color:#6b7280; line-height: 1.4; }
.bottom-row { margin-top:auto; display:flex; align-items:center; justify-content: space-between; }
.price { font-size:26rpx; color:#ef4444; font-weight:700; }
.buy-btn { text-align:center; padding: 14rpx 20rpx; background:#111827; color:#ffffff; border-radius: 16rpx; font-size:24rpx; }
.add-cart-btn { width: 60rpx; height: 60rpx; border-radius: 30rpx; background: transparent; display:flex; align-items:center; justify-content:center; overflow: hidden; }
.add-icon { width: 40rpx; height: 40rpx; display:block; }

.flash-placeholder { height: 100%; display:flex; align-items:center; justify-content:center; color:#9ca3af; }

/* 购物车悬浮按钮 */
.cart-fab { position: fixed; right: 24rpx; bottom: calc(env(safe-area-inset-bottom) + 48rpx); width: 96rpx; height: 96rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx solid #e5e7eb; display:flex; align-items:center; justify-content:center; box-shadow:0 12rpx 24rpx rgba(0,0,0,0.08); z-index: 1000; }
.cart-fab-icon { width: 56rpx; height: 56rpx; }
.cart-fab-svg { width: 56rpx; height: 56rpx; display:block; }

/* H5 环境下提高悬浮按钮底部偏移，避免被底部导航遮挡/贴边 */
/* #ifdef H5 */
.cart-fab { bottom: calc(env(safe-area-inset-bottom) + 160rpx); }
/* #endif */

</style>


