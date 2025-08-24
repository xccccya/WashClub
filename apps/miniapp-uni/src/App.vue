<script setup lang="ts">
// 应用入口
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

