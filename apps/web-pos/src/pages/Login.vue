<template>
	<div class="login-wrap" :style="bgStyle">
		<div class="login-panel">
			<div class="brand">
				<img v-if="setting.logoUrl" :src="absUrl(setting.logoUrl)" class="logo" alt="LOGO" />
				<div class="title">{{ setting.title || '收银台' }}</div>
			</div>
			<el-card class="card">
				<h2 class="card-title">登录</h2>
				<el-form :model="form" :rules="rules" ref="formRef" label-width="80px" @keyup.enter="onSubmit">
					<el-form-item label="手机号" prop="phone">
						<el-input v-model="form.phone" placeholder="请输入手机号" clearable :disabled="loading" name="username" autocomplete="username" />
					</el-form-item>
					<el-form-item label="密码" prop="password">
						<el-input v-model="form.password" type="password" show-password placeholder="请输入密码" :disabled="loading" name="password" autocomplete="current-password" />
					</el-form-item>
					<el-form-item>
						<el-button type="primary" :loading="loading" :disabled="loading" @click="onSubmit" class="btn-lg">登录</el-button>
					</el-form-item>
				</el-form>
			</el-card>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import { absUrl } from '../utils/http';

const router = useRouter();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const form = ref({ phone: '', password: '' });
const loading = ref(false);
const formRef = ref();
const setting = ref<{ title?: string; logoUrl?: string|null; bgType?: 'bing'|'image'; bgImageUrl?: string|null }>({});

const bingUrl = ref<string>('');
const bgStyle = computed(()=>{
	const common = { backgroundSize: 'cover', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat' } as any;
	const type = String(setting.value.bgType||'bing');
	if (type === 'image' && setting.value.bgImageUrl) {
		return { ...common, backgroundImage: `url(${absUrl(setting.value.bgImageUrl)})` } as any;
	}
	const url = bingUrl.value || 'https://www.bing.com/th?id=OHR.BridgeLisbon_ZH-CN9917265341_UHD.jpg&pid=hp&w=1920&h=1080&rs=1&c=4';
	return { ...common, backgroundImage: `url(${url})` } as any;
});

const rules = {
	phone: [
		{ required: true, message: '请输入手机号', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (/^1\d{10}$/.test(String(val||'')) ? cb() : cb(new Error('手机号格式不正确'))), trigger: 'blur' },
	],
	password: [
		{ required: true, message: '请输入密码', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (String(val||'').length >= 6 ? cb() : cb(new Error('密码至少6位'))), trigger: 'blur' },
	],
};

async function onSubmit() {
	if (loading.value) return;
	try {
		await (formRef.value as any)?.validate();
	} catch {
		return;
	}
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

onMounted(async ()=>{
	try{ document.body.classList.add('login-page'); }catch{}
	try{ setting.value = await http('/system/public/site-setting', { method:'GET' }); }catch{}
	try{ const r:any = await http('/system/public/bing-wallpaper', { method:'GET' }); bingUrl.value = r?.url || ''; }catch{}
});

onUnmounted(()=>{ try{ document.body.classList.remove('login-page'); }catch{} });
</script>

<style scoped>
.login-wrap{ position:fixed; inset:0; background-position:center; background-size:cover; background-repeat:no-repeat; }
.login-wrap::after{ content:""; position:absolute; inset:0; background: color-mix(in oklab, #000, transparent 70%); }
.login-panel{ position:relative; z-index:1; width:min(520px, 92vw); margin:0 auto; padding: 8vh 0; display:flex; flex-direction:column; gap:16px; }
.brand{ display:flex; align-items:center; gap:12px; color:#fff; justify-content:center; }
.brand .logo{ width:42px; height:42px; object-fit:contain; background: transparent; }
.brand .title{ font-size:22px; font-weight:700; letter-spacing:.3px; text-shadow:0 1px 2px rgba(0,0,0,.35); }
.card{ backdrop-filter: blur(8px); background: color-mix(in oklab, #fff, transparent 10%); box-shadow: 0 8px 30px rgba(0,0,0,.12); }
.card-title{ margin:0 0 10px; font-size:18px; }
.btn-lg{ width:100%; height:44px; font-size:16px; }
@media (min-width: 1024px) {
	.btn-lg{ height:48px; font-size:16px; }
}
</style>

<style>
body.login-page { margin: 0; height: 100%; overflow: hidden; background-color: #000; }
</style>


