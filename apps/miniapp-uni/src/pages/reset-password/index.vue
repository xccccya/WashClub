<template>
	<!-- 兼容页：老的重置密码页面入口，统一跳转到合并后的登录页 -->
	<view class="page" />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
declare const uni: any;

onLoad((q: any) => {
	const phone = String(q?.phone || '').replace(/\D+/g, '').slice(0, 11);
	const url = `/pages/login/index?screen=reset${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`;
	// 老入口保持可用：直接替换为合并页
	try {
		uni.redirectTo({ url });
	} catch {
		try {
			uni.navigateTo({ url });
		} catch {}
	}
});
</script>

<style>
.page { min-height: 100vh; background: transparent; }
</style>


