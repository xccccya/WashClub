<template>
	<view class="page">
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<!-- 微信小程序内嵌网页 -->
		<!-- #ifdef MP-WEIXIN -->
		<web-view :src="decodedUrl" />
		<!-- #endif -->
		<!-- H5 端直接渲染 iframe 以便本地开发调试 -->
		<!-- #ifndef MP-WEIXIN -->
		<iframe v-if="decodedUrl" class="h5-frame" :src="decodedUrl" />
		<!-- #endif -->
	</view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { useSafeArea } from '../../utils/safe-area';

const { statusBarHeight } = useSafeArea();
const decodedUrl = ref<string>('');

onLoad((q: any) => {
  try{
    const u = String(q?.url||'').trim();
    decodedUrl.value = u ? decodeURIComponent(u) : '';
    const title = decodeURIComponent(String(q?.title||'').trim());
    if (title){ try{ uni.setNavigationBarTitle({ title }); }catch{} }
  }catch{}
});

function goBack(){
  try { uni.navigateBack(); return; } catch {}
  try { uni.switchTab({ url: '/pages/me/index' }); } catch {}
}
</script>

<style>
.page { min-height:100vh; background:#fff; }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.h5-frame { position: absolute; left:0; right:0; top:0; bottom:0; width:100%; height:100%; border:0; }
</style>


