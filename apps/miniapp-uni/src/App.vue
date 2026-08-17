<script setup lang="ts">
// 应用入口
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { API_BASE, getToken } from './utils/auth';
import { realtime } from './utils/realtime';

function ensureRealtimeConnection() {
	const token = getToken();
	if (token) realtime.start({ apiBase: API_BASE, token });
	else realtime.stop();
}

onLaunch(ensureRealtimeConnection);
onShow(ensureRealtimeConnection);
</script>

<template>
	<slot />
	<!-- #ifdef H5 -->
	<TabBarH5 />
	<!-- #endif -->
</template>

<script lang="ts">
// #ifdef H5
import TabBarH5 from './components/TabBarH5.vue';
export default { components: { TabBarH5 } };
// #endif
</script>

<style>
/* 全局样式 */
</style>

