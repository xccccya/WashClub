<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 顶部滚动公告 -->
		<view class="card notice-card" v-if="noticeStore">
			<view class="marquee">
				<text class="marquee-text">{{ noticeStore }}</text>
			</view>
		</view>

		<!-- 服务商品 -->
		<view class="card section-card">
			<view class="section-head">
				<text class="card-title">服务商品</text>
				<text class="link">点击查看全部商品</text>
			</view>
			<view class="items">
				<view v-for="item in serviceDisplayItems" :key="item" class="item-box">{{ item }}</view>
			</view>
			<view class="switch-row">
				<view class="pill" :class="{ active: serviceTab==='hot' }" @tap="() => serviceTab='hot'" @click="() => serviceTab='hot'">热销服务</view>
				<view class="pill" :class="{ active: serviceTab==='rec' }" @tap="() => serviceTab='rec'" @click="() => serviceTab='rec'">推荐服务</view>
			</view>
		</view>

		<!-- 实物商品 -->
		<view class="card section-card">
			<view class="section-head">
				<text class="card-title">实物商品</text>
				<text class="link">点击查看全部商品</text>
			</view>
			<view class="items">
				<view v-for="item in goodsDisplayItems" :key="item" class="item-box">{{ item }}</view>
			</view>
			<view class="switch-row">
				<view class="pill" :class="{ active: goodsTab==='hot' }" @tap="() => goodsTab='hot'" @click="() => goodsTab='hot'">热销商品</view>
				<view class="pill" :class="{ active: goodsTab==='rec' }" @tap="() => goodsTab='rec'" @click="() => goodsTab='rec'">推荐商品</view>
			</view>
		</view>

		
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { createHttp } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';

const { topSpacerHeight } = useSafeArea();

// 服务商品切换
const serviceTab = ref<'hot' | 'rec'>('hot');
const serviceHotItems = ['标准洗车', '精洗打蜡', '内饰清洁'];
const serviceRecItems = ['精致养护', '漆面护理', '空调消杀'];
const serviceDisplayItems = computed(() => serviceTab.value === 'hot' ? serviceHotItems : serviceRecItems);

// 实物商品切换
const goodsTab = ref<'hot' | 'rec'>('hot');
const goodsHotItems = ['玻璃水', '毛巾套装', '清洁泡沫'];
const goodsRecItems = ['香氛挂件', '车载吸尘器', '皮座保养液'];
const goodsDisplayItems = computed(() => goodsTab.value === 'hot' ? goodsHotItems : goodsRecItems);
const noticeStore = ref('');

function navigate(url: string) {
    const isTab = url === '/pages/index/index' || url === '/pages/store/index' || url === '/pages/me/index';
    if (isTab) { try { uni.switchTab({ url }); return; } catch {}
    }
    try { uni.navigateTo({ url }); } catch {}
}

// 已切换为系统 tabBar

onShow(async ()=>{
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
.card-title { font-size:28rpx; font-weight:600; color:#2b2f36; }

/* 公告 */
.notice-card { padding: 16rpx 24rpx; }
.marquee { overflow:hidden; white-space: nowrap; }
.marquee-text { display:inline-block; padding-left:100%; animation: scroll-left 12s linear infinite; color:#374151; }
@keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

/* 商品区块 */
.section-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 16rpx; }
.link { font-size:24rpx; color:#2563eb; }
.items { display:flex; flex-direction: column; gap: 16rpx; }
.item-box { height: 94rpx; border-radius: 20rpx; background:#f7fbff; border: 2rpx dashed #77bfff; display:flex; align-items:center; padding: 0 20rpx; color:#1f2937; }
.switch-row { display:flex; gap: 24rpx; margin-top: 18rpx; }
.pill { flex:1; text-align:center; padding: 22rpx 0; border-radius: 24rpx; background:#ffffff; border: 2rpx solid #e5e7eb; }
.pill.active { background: linear-gradient(135deg, #a8d8ff, #ffc9de); border:none; color:#111827; }


</style>


