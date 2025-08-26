<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />

		<!-- 顶部店铺信息 -->
		<view class="card store-header">
			<text class="store-name">{{ storeName }}</text>
			<text class="store-distance">{{ distanceText }}</text>
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
						<view v-for="p in products" :key="p.id" class="product-card">
							<view class="thumb" />
							<view class="info">
								<text class="name">{{ p.name }}</text>
								<text class="price">¥{{ formatPrice(p.price) }}</text>
							</view>
							<view class="buy-btn" @tap="() => buy(p)">立即购买</view>
						</view>
					</view>
				</scroll-view>
			</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { createHttp, checkAuthAndRefresh } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';

const { topSpacerHeight } = useSafeArea();

// 顶部店铺信息（UI占位）
const storeName = ref('巨科汽车美容（威远店）');
const distanceText = ref('距离约 2.3km');

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

async function fetchCategories(){
	try {
		const http = createHttp();
		// 秒杀页：隐藏并清空分类
		if (activeTab.value === 'flash') { categories.value = []; activeCategory.value = null; return; }
		// 按 Tab 类型筛选分类
		let typeParam: string | undefined = undefined;
		if (activeTab.value === 'service') typeParam = 'SERVICE';
		else if (activeTab.value === 'goods') typeParam = 'PHYSICAL';
		const list = await http<any[]>('/store/categories', { method:'GET', query: { type: typeParam } });
		categories.value = Array.isArray(list) ? list : [];
		activeCategory.value = categories.value[0]?.id || null;
	} catch { categories.value = []; activeCategory.value = null; }
}
async function fetchProducts(){
	try {
		// 秒杀页：占位，清空商品
		if (activeTab.value === 'flash') { products.value = []; return; }
		const http = createHttp();
		const list = await http<any[]>('/store/products', { method:'GET', query: { categoryId: activeCategory.value || undefined } });
		// 根据 Tab 过滤：服务 或 实物（仅 PHYSICAL）
		products.value = (Array.isArray(list) ? list : []).filter((p:any) => activeTab.value==='service' ? p.type==='SERVICE' : p.type==='PHYSICAL');
	} catch { products.value = []; }
}

watch(activeTab, async () => { await fetchCategories(); await fetchProducts(); });

// 公告（保留API对接）
const noticeStore = ref('');
onShow(async () => {
	try {
		const http = createHttp();
		const active = await http<any>('/content/notices/active', { method: 'GET', query: { type: 'store' } });
		noticeStore.value = active?.content || '';
	} catch {}
	await fetchCategories();
	await fetchProducts();
});

// 购买下单（手动支付）
async function buy(p:any){
	// 登录校验
	const authed = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!authed) return;
	const http = createHttp();
	// 读取当前会员信息
	let profile: any = null; try { profile = await http<any>('/member/me/profile', { method:'GET' }); } catch {}
	if (!profile?.id) { uni.showToast({ title:'请先登录', icon:'none' }); return; }

	// 服务项目需绑定车辆
	let vehicleId: number | null = null;
	if (p.type === 'SERVICE') {
		const vs = Array.isArray(profile?.vehicles) ? profile.vehicles : [];
		if (vs.length === 0) {
			uni.showModal({ title:'提示', content:'请先添加车辆后再购买服务', confirmText:'去添加', success: (res:any)=>{ if (res.confirm) try{ uni.navigateTo({ url:'/pages/vehicle/create' }); }catch{} } });
			return;
		} else if (vs.length === 1) {
			vehicleId = vs[0].id;
		} else {
			// 选择车辆
			try {
				const names = vs.map((v:any)=>v.plateNumber||`车辆#${v.id}`);
				const sel:any = await new Promise((resolve)=>{ uni.showActionSheet({ itemList: names, success: resolve, fail: ()=>resolve(null) }); });
				if (!sel || typeof sel.tapIndex !== 'number') return;
				vehicleId = vs[sel.tapIndex].id;
			} catch { return; }
		}
	}

	// 仅单件下单，提示到店支付
	try {
		const body = { type: p.type === 'SERVICE' ? 'SERVICE' : 'SP', memberId: profile.id, vehicleId: vehicleId || undefined, items: [{ productId: p.id, name: p.name, imageUrl: p.imageUrl || null, price: Number(p.price || 0), discount: 0, quantity: 1, barcode: p.barcode || null }] };
		await http<any>('/orders', { method:'POST', body });
		uni.showToast({ title: '下单成功，请到店支付', icon: 'none' });
		setTimeout(()=>{ try { uni.switchTab({ url:'/pages/order/index' }); } catch {} }, 400);
	} catch (e:any) {
		uni.showToast({ title: e?.message || '下单失败', icon:'none' });
	}
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx 24rpx 0 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }

.card { background:#ffffff; border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }

/* 顶部店铺信息 */
.store-header { display:flex; align-items:center; justify-content: space-between; }
.store-name { font-size:30rpx; font-weight:600; color:#111827; }
.store-distance { font-size:24rpx; color:#6b7280; }

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
.content-card { background:#ffffff; border-radius:32rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); display:flex; flex-direction: column; overflow:hidden; min-height: 920rpx; }
.content-body { display:flex; flex:1; overflow:hidden; }

/* 左侧分类 */
.category-sidebar { width: 220rpx; background:#f9fafb; padding: 16rpx 0; display:flex; flex-direction: column; }
.category-list { height: 100%; max-height: 1000rpx; }
.category-item { padding: 24rpx 20rpx; font-size:26rpx; color:#374151; border-left: 8rpx solid transparent; }
.category-item.active { background:#ffffff; color:#111827; border-left-color:#60a5fa; }

/* 右侧面板 */
.product-panel { flex:1; padding: 16rpx; display:flex; flex-direction: column; background:#ffffff; }
.panel-head { font-size:26rpx; color:#6b7280; margin: 4rpx 8rpx 16rpx 8rpx; }
.product-scroller { height: 100%; }
.product-list { display:flex; flex-direction: column; gap: 16rpx; padding: 0 8rpx 16rpx 8rpx; }
.product-card { background:#f7fbff; border: 2rpx dashed #77bfff; border-radius: 20rpx; padding: 16rpx; display:flex; flex-direction: row; gap: 12rpx; align-items:center; }
.thumb { width: 160rpx; height: 160rpx; border-radius: 16rpx; background: linear-gradient(135deg, #e0f2fe, #ffe4ef); flex-shrink:0; }
.info { display:flex; flex-direction: column; gap: 8rpx; flex:1; }
.name { font-size:26rpx; color:#111827; }
.price { font-size:26rpx; color:#ef4444; font-weight:600; }
.buy-btn { margin-left:auto; text-align:center; padding: 18rpx 24rpx; background:#111827; color:#ffffff; border-radius: 16rpx; font-size:24rpx; }

.flash-placeholder { height: 100%; display:flex; align-items:center; justify-content:center; color:#9ca3af; }

</style>


