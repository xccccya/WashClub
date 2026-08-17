<template>
	<view class="ride-locate-control" :class="{ locating }" @tap.stop="locate"><image class="ride-locate-control__icon" :src="locateControlIcon" mode="aspectFit" /></view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import locateControlIcon from '../../static/icons/ride-locate-control.svg';

const props = defineProps<{ action: () => void | Promise<void> }>();
const locating = ref(false);

async function locate() {
	if (locating.value) return;
	locating.value = true;
	try { await props.action(); }
	finally { locating.value = false; }
}
</script>

<style scoped>
.ride-locate-control{display:grid;width:78rpx;height:78rpx;place-items:center;border:1rpx solid rgba(255,255,255,.9);border-radius:24rpx;background:rgba(255,255,255,.94);box-shadow:0 12rpx 32rpx rgba(15,23,42,.2);backdrop-filter:blur(10px);box-sizing:border-box;transition:bottom .3s ease,top .3s ease,transform .2s ease}
.ride-locate-control:active{transform:scale(.96)}.ride-locate-control.locating{opacity:.65}.ride-locate-control__icon{width:42rpx;height:42rpx;transition:transform .3s ease}.ride-locate-control.locating .ride-locate-control__icon{transform:rotate(45deg)}
</style>
