<template>
	<div style="width:360px;margin:10vh auto;">
		<el-card>
			<h2>后台登录</h2>
			<el-form :model="form" @keyup.enter="onSubmit">
				<el-form-item label="手机号">
					<el-input v-model="form.phone" />
				</el-form-item>
				<el-form-item label="密码">
					<el-input v-model="form.password" type="password" />
				</el-form-item>
				<el-form-item>
					<el-button type="primary" :loading="loading" @click="onSubmit">登录</el-button>
				</el-form-item>
			</el-form>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const router = useRouter();
const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const form = ref({ phone: '', password: '' });
const loading = ref(false);

async function onSubmit() {
	loading.value = true;
	try {
		const res = await http<{ token: string; user: { id: number; name?: string; role: string; roleId?: number | null; permissions?: string[] } }>('/auth/admin/login', {
			method: 'POST',
			body: form.value,
		});
		localStorage.setItem('token', res.token);
		localStorage.setItem('user', JSON.stringify(res.user || {}));
		router.push('/');
	} catch (e: any) {
		ElMessage.error(e?.message || '登录失败');
	} finally {
		loading.value = false;
	}
}
</script>

