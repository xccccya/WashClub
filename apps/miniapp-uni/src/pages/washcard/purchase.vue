<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="card home-style-card">
			<view class="header">
				<text class="title">购买洗车卡</text>
				<text class="subtitle">超值洗车卡套餐</text>
			</view>
			<view v-if="list.length===0" class="empty">暂无可购卡券</view>
			<view class="product-list">
				<view v-for="p in list" :key="p.id" class="product-card">
					<image class="thumb" :src="thumbOf(p)" mode="aspectFill" />
					<view class="info">
						<text class="name name--large">{{ p.name }}</text>
						<text class="desc" v-if="p.sellPoint">{{ p.sellPoint }}</text>
						<view class="bottom-row">
							<view class="price-box">
								<text class="price">¥{{ formatPrice(p.price) }}</text>
								<text class="list-price" v-if="Number(p.listPrice||0)>0">¥{{ formatPrice(p.listPrice) }}</text>
							</view>
							<view class="buy-btn" @tap="() => openSheet(p)">购买</view>
						</view>
					</view>
				</view>
			</view>
		</view>
		<PurchaseSheet v-model:visible="sheetVisible" :product="currentProduct" @submitted="onSubmitted" />
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import PurchaseSheet from '../../components/PurchaseSheet.vue';
import { resolveImageUrl } from '../../utils/url';
import { storeProductControllerList } from '@wash/api-client';

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const list = ref<any[]>([]);
const sheetVisible = ref(false);
const currentProduct = ref<any|null>(null);

function formatPrice(p: any){ const n = Number(p); return isNaN(n) ? p : n.toFixed(2); }

async function fetchList(){
	try {
		const items = (await storeProductControllerList({ type: 'VIRTUAL_CARD', enabled: true } as any)) as any;
		list.value = (Array.isArray(items) ? items : []).filter((p:any)=> p?.type==='VIRTUAL_CARD' && (p?.coupon?.type==='WASH_CARD'));
	} catch { list.value = []; }
}

onShow(async () => {
	await fetchList();
});

function thumbOf(p:any){ const arr = Array.isArray(p?.imagesJson) ? p.imagesJson : []; const raw = p?.imageUrl || arr?.[0] || ''; return resolveImageUrl(raw) || '/static/icons/placeholder.png'; }
function openSheet(p:any){ currentProduct.value = p; sheetVisible.value = true; }
function onSubmitted(){ sheetVisible.value = false; currentProduct.value = null; }

function goBack(){ try { uni.navigateBack(); } catch {} }
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,.04); }
.home-style-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.title { font-size: 30rpx; font-weight: 700; color:#111827; }
.subtitle { font-size: 22rpx; color:#6b7280; }
.empty { padding: 24rpx; color: #6b7280; text-align: center; }

.product-list { display:flex; flex-direction: column; gap: 16rpx; margin-top: 12rpx; }
.product-card { background:#ffffff; border-radius: 20rpx; padding: 16rpx; display:flex; flex-direction: row; gap: 12rpx; align-items:stretch; box-shadow:0 4rpx 12rpx rgba(0,0,0,0.04); }
.thumb { width: 160rpx; height: 160rpx; border-radius: 16rpx; background: linear-gradient(135deg, #e0f2fe, #ffe4ef); flex-shrink:0; }
.info { display:flex; flex-direction: column; gap: 6rpx; flex:1; }
.name { font-size:26rpx; color:#111827; font-weight:600; }
.name--large { font-size: 34rpx; }
.desc { font-size:22rpx; color:#6b7280; }
.bottom-row { margin-top:auto; display:flex; align-items:center; justify-content: space-between; }
.price-box { display:flex; align-items: baseline; gap: 8rpx; }
.price { font-size:34rpx; color:#ef4444; font-weight:700; }
.list-price { font-size: 22rpx; color:#6b7280; text-decoration: line-through; }
.buy-btn { text-align:center; padding: 14rpx 20rpx; background:#111827; color:#ffffff; border-radius: 16rpx; font-size:24rpx; }
</style>


