<template>
	<div class="base-page">
		<div class="base-page__header">
			<h2>{{ title }}</h2>
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
}
.base-page__header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}
</style>


