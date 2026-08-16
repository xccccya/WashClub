<template>
	<view class="bar" :style="barStyle">
		<view class="back" role="button" aria-label="返回" @tap="goBack"><image :src="backIcon" mode="aspectFit" /></view>
		<view class="copy">
			<text class="title">{{ title }}</text>
			<text v-if="subtitle" class="subtitle">{{ subtitle }}</text>
		</view>
		<view class="actions"><slot /></view>
	</view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import backIcon from '../../static/icons/ride-back.svg';
import { useSafeArea } from '../../utils/safe-area';

defineProps<{ title: string; subtitle?: string }>();
const safeArea = useSafeArea();
const barStyle = computed(() => ({ top: `${safeArea.topSpacerHeight + 8}px` }));

function goBack() {
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
	} catch {}
	try { uni.switchTab({ url: '/pages/index/index' }); }
	catch { uni.reLaunch({ url: '/pages/index/index' }); }
}
</script>

<style scoped>
.bar{position:absolute;z-index:30;left:20rpx;right:20rpx;display:flex;align-items:center;gap:16rpx;min-height:72rpx;padding:14rpx 18rpx;border:1rpx solid rgba(255,255,255,.8);border-radius:26rpx;background:rgba(255,255,255,.94);box-shadow:0 12rpx 34rpx rgba(15,23,42,.14);backdrop-filter:blur(18px);box-sizing:border-box}
.back{display:grid;place-items:center;width:58rpx;height:58rpx;border-radius:18rpx;background:#f1f5f9}.back image{width:32rpx;height:32rpx}
.copy{min-width:0;flex:1}.title,.subtitle{display:block}.title{font-size:30rpx;font-weight:800;color:#0f172a}.subtitle{margin-top:3rpx;overflow:hidden;color:#64748b;font-size:22rpx;text-overflow:ellipsis;white-space:nowrap}
.actions{display:flex;align-items:center;flex:none}
</style>
