<template>
	<BasePage title="收银台首页">
		<template #actions>
			<el-button type="primary" @click="goCashier">新建订单</el-button>
		</template>
		<div class="welcome">欢迎来到收银台</div>
	</BasePage>
</template>

<script setup lang="ts">
import { BasePage } from '@wash/shared-ui';
import { useRouter } from 'vue-router';
const router = useRouter();
function goCashier(){ router.push('/cashier'); }
</script>

<style scoped>
.welcome{ font-size:18px; color:#303133; }
</style>

