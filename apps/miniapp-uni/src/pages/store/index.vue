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
			<!-- 左侧分类 -->
			<view class="category-sidebar">
				<scroll-view scroll-y class="category-list">
					<view v-for="c in categories" :key="c" class="category-item" :class="{ active: c===activeCategory }" @tap="() => selectCategory(c)" @click="() => selectCategory(c)">{{ c }}</view>
				</scroll-view>
			</view>

			<!-- 右侧商品面板 -->
			<view class="product-panel">
				<view class="panel-head">商品展示列表</view>
				<scroll-view scroll-y class="product-scroller">
					<view v-if="activeTab==='flash'" class="flash-placeholder">
						<text>暂无活动，敬请期待</text>
					</view>
					<view v-else class="product-list">
						<view v-for="p in products" :key="p.name" class="product-card">
							<view class="thumb" />
							<view class="info">
								<text class="name">{{ p.name }}</text>
								<text class="price">¥{{ p.price }}</text>
							</view>
							<view class="buy-btn">立即购买</view>
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
import { createHttp } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';

const { topSpacerHeight } = useSafeArea();

// 顶部店铺信息（UI占位）
const storeName = ref('巨科汽车美容（威远店）');
const distanceText = ref('距离约 2.3km');

// 顶部标签
type TabKey = 'service' | 'goods' | 'flash';
const activeTab = ref<TabKey>('service');
function switchTab(tab: TabKey) { activeTab.value = tab; }

// 分类与商品（纯UI数据）
const serviceCategories = ['常规洗护', '精洗养护', '美容镀晶', '内饰清洁', '年检代办', '其他'];
const goodsCategories = ['车品耗材', '内饰清洁', '外观养护', '电子设备', '香氛周边'];
const categories = computed(() => activeTab.value === 'goods' ? goodsCategories : serviceCategories);

const activeCategory = ref<string>(serviceCategories[0]);
function selectCategory(c: string) { activeCategory.value = c; }

watch(activeTab, () => {
	activeCategory.value = categories.value[0];
});

interface ProductItem { name: string; price: string; }
function makeProducts(prefix: string): ProductItem[] {
	return Array.from({ length: 8 }, (_, i) => ({ name: `${prefix} · 示例${i + 1}`, price: (i + 1) * 10 + '.00' }));
}
const products = computed<ProductItem[]>(() => {
	if (activeTab.value === 'flash') return [];
	return makeProducts(activeCategory.value);
});

// 公告（保留API对接）
const noticeStore = ref('');
onShow(async () => {
	try {
		const http = createHttp();
		const active = await http<any>('/content/notices/active', { method: 'GET', query: { type: 'store' } });
		noticeStore.value = active?.content || '';
	} catch {}
});
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
.product-list { display:grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx; padding: 0 8rpx 16rpx 8rpx; }
.product-card { background:#f7fbff; border: 2rpx dashed #77bfff; border-radius: 20rpx; padding: 16rpx; display:flex; flex-direction: column; gap: 12rpx; }
.thumb { height: 160rpx; border-radius: 16rpx; background: linear-gradient(135deg, #e0f2fe, #ffe4ef); }
.info { display:flex; align-items:center; justify-content: space-between; }
.name { font-size:26rpx; color:#111827; }
.price { font-size:26rpx; color:#ef4444; font-weight:600; }
.buy-btn { margin-top: 4rpx; text-align:center; padding: 18rpx 0; background:#111827; color:#ffffff; border-radius: 16rpx; font-size:24rpx; }

.flash-placeholder { height: 100%; display:flex; align-items:center; justify-content:center; color:#9ca3af; }

</style>


