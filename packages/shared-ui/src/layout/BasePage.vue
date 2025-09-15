<template>
	<div class="base-page">
		<div class="base-page__header">
			<slot name="actions" />
		</div>
		<div class="base-page__content">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<style scoped>
.base-page {
	padding: 16px;
	display: flex;
	flex-direction: column;
	height: 100vh;
	overflow: hidden;
}
.base-page__header {
	display: flex;
	justify-content: flex-start;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	margin-bottom: 12px;
}
.base-page__content {
	flex: 1 1 auto;
	min-height: 0; /* 允许子元素内滚动 */
	overflow: hidden;
}
</style>


