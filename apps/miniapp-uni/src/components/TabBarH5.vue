<template>
	<!-- 仅在 H5 使用：与小程序 tabBar 保持一致的兜底实现 -->
	<view class="tabbar-h5">
		<view class="tab-item" :class="{ active: activePath==='pages/index/index' }" @tap="go('/pages/index/index')" @click="go('/pages/index/index')">
			<image class="icon" :src="activePath==='pages/index/index' ? homeFill : home" mode="aspectFit" />
			<text class="label">首页</text>
		</view>
		<view class="tab-item" :class="{ active: activePath==='pages/store/index' }" @tap="go('/pages/store/index')" @click="go('/pages/store/index')">
			<image class="icon" :src="activePath==='pages/store/index' ? shopFill : shop" mode="aspectFit" />
			<text class="label">商店</text>
		</view>
		<view class="tab-item" :class="{ active: activePath==='pages/order/index' }" @tap="go('/pages/order/index')" @click="go('/pages/order/index')">
			<image class="icon" :src="activePath==='pages/order/index' ? formFill : form" mode="aspectFit" />
			<text class="label">订单</text>
		</view>
		<view class="tab-item" :class="{ active: activePath==='pages/me/index' }" @tap="go('/pages/me/index')" @click="go('/pages/me/index')">
			<image class="icon" :src="activePath==='pages/me/index' ? myFill : my" mode="aspectFit" />
			<text class="label">我的</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const home = '/static/tabbar/home.png';
const homeFill = '/static/tabbar/home_fill.png';
const shop = '/static/tabbar/shop.png';
const shopFill = '/static/tabbar/shop_fill.png';
const form = '/static/tabbar/form.png';
const formFill = '/static/tabbar/form_fill.png';
const my = '/static/tabbar/my.png';
const myFill = '/static/tabbar/my_fill.png';

const activePath = ref<string>('');

function resolveCurrentPath(){
	try {
		const pages = getCurrentPages?.() || [];
		const last: any = pages[pages.length - 1] || {};
		// route 例如: pages/index/index
		activePath.value = String(last?.route || '');
	} catch { activePath.value = ''; }
}

function go(url: string){
	try { uni.switchTab({ url }); } catch {}
	resolveCurrentPath();
}

onMounted(()=>{ resolveCurrentPath(); });
</script>

<style>
.tabbar-h5 {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	background: #ffffff;
	border-top: 1px solid #e5e7eb;
	display: flex;
	justify-content: space-around;
	padding: 8rpx 0 calc(env(safe-area-inset-bottom) + 8rpx) 0;
	box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.04);
}
.tab-item {
	flex: 1;
	text-align: center;
	padding: 8rpx 0 6rpx 0;
	color: #666666;
}
.tab-item.active { color: #49b7f0; }
.icon { width: 44rpx; height: 44rpx; display: block; margin: 0 auto 6rpx auto; }
.label { font-size: 22rpx; line-height: 1; }
</style>


