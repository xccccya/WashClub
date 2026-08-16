<template>
	<view class="header" :style="headerStyle">
		<view class="back" role="button" aria-label="返回" @tap="goBack">‹</view>
		<view class="copy"><text class="title">{{ title }}</text><text v-if="subtitle" class="subtitle">{{ subtitle }}</text></view>
		<slot />
	</view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
defineProps<{ title: string; subtitle?: string }>();
const safeArea = useSafeArea();
const headerStyle = computed(() => ({ paddingTop: `${safeArea.topSpacerHeight + 8}px` }));
function goBack(){
	try{const pages=getCurrentPages?.()||[];if(pages.length>1){uni.navigateBack();return}}catch{}
	try{uni.switchTab({url:'/pages/index/index'})}catch{uni.reLaunch({url:'/pages/index/index'})}
}
</script>

<style scoped>
.header{display:flex;align-items:center;gap:16rpx;padding-right:24rpx;padding-bottom:20rpx;padding-left:24rpx;box-sizing:border-box}.back{display:grid;place-items:center;width:64rpx;height:64rpx;border-radius:20rpx;background:rgba(255,255,255,.82);box-shadow:0 8rpx 24rpx rgba(15,23,42,.1);font-size:50rpx;line-height:1}.copy{min-width:0;flex:1}.title,.subtitle{display:block}.title{font-size:36rpx;font-weight:850;color:#0f172a}.subtitle{margin-top:4rpx;color:#64748b;font-size:22rpx}
</style>
