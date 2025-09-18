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
	/* 占满父容器高度，避免使用 100vh 导致平板地址栏裁切问题 */
	height: 100%;
	padding: 16px;
	display: flex;
	flex-direction: column;
	min-height: 0;
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
	min-height: 0;
	/* 由内部模块自行控制滚动（如表格/面板），此处保持隐藏防止双滚动 */
	overflow: hidden;
}
</style>


