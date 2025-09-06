<template>
	<div class="login-wrap" :style="bgStyle">
		<div class="login-panel">
			<div class="brand">
				<img v-if="setting.logoUrl" :src="absUrl(setting.logoUrl)" class="logo" alt="LOGO" />
				<div class="title">{{ setting.title || '管理后台' }}</div>
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
						<el-button type="primary" :loading="loading" :disabled="loading" @click="onSubmit" style="width:100%">登录</el-button>
					</el-form-item>
				</el-form>
			</el-card>
		</div>
		<transition name="fade">
			<div v-if="loadingMask" class="loading-mask">
				<div class="loading-inner">
					<el-icon class="spin" color="#409eff" size="28"><Loading /></el-icon>
					<div class="loading-text">加载中...</div>
				</div>
			</div>
		</transition>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';

const router = useRouter();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const form = ref({ phone: '', password: '' });
const loading = ref(false);
const formRef = ref();
const setting = ref<{ title?: string; logoUrl?: string|null; bgType?: 'bing'|'image'; bgImageUrl?: string|null }>({});
const loadingMask = ref(true);

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
		return; // 本地校验未通过
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

function absUrl(u?: string | null){
	if (!u) return '';
	if (/^https?:\/\//i.test(u)) return u;
	return `${API_BASE}/${u.replace(/^\//,'')}`;
}

onMounted(async ()=>{
	try{ document.body.classList.add('login-page'); }catch{}
	try{ setting.value = await http('/system/public/site-setting', { method:'GET' }); }catch{}
	try{ const r:any = await http('/system/public/bing-wallpaper', { method:'GET' }); bingUrl.value = r?.url || ''; }catch{}
	// 预加载背景图后再移除遮罩，避免短暂黑屏
	try {
		const url = (()=>{
			const type = String(setting.value.bgType||'bing');
			if (type==='image' && setting.value.bgImageUrl) return absUrl(setting.value.bgImageUrl);
			return bingUrl.value || 'https://www.bing.com/th?id=OHR.BridgeLisbon_ZH-CN9917265341_UHD.jpg&pid=hp&w=1920&h=1080&rs=1&c=4';
		})();
		await new Promise<void>((resolve)=>{
			const img = new Image();
			let done = false;
			const finish = ()=>{ if (done) return; done = true; resolve(); };
			img.onload = finish; img.onerror = finish; img.src = url;
			setTimeout(finish, 1200); // 最多等待 1.2s，避免弱网长时间遮挡
		});
	} finally {
		setTimeout(()=>{ loadingMask.value = false; }, 100);
	}
});

onUnmounted(()=>{ try{ document.body.classList.remove('login-page'); }catch{} });
</script>

<style scoped>
.login-wrap{ position:fixed; inset:0; background-position:center; background-size:cover; background-repeat:no-repeat; }
.login-wrap::after{ content:""; position:absolute; inset:0; background: color-mix(in oklab, #000, transparent 70%); }
.login-panel{ position:relative; z-index:1; width:420px; margin:0 5vw 0 auto; padding: 10vh 0; display:flex; flex-direction:column; gap:16px; }
.brand{ display:flex; align-items:center; gap:12px; color:#fff; }
.brand .logo{ width:36px; height:36px; object-fit:contain; border-radius:0; box-shadow:none; background: transparent; }
.brand .title{ font-size:20px; font-weight:700; letter-spacing:.3px; text-shadow:0 1px 2px rgba(0,0,0,.35); }
.card{ backdrop-filter: blur(8px); background: color-mix(in oklab, #fff, transparent 10%); box-shadow: 0 8px 30px rgba(0,0,0,.12); }
.card-title{ margin:0 0 10px; font-size:18px; }
/* 页面加载遮罩 */
.loading-mask{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:#fff; z-index:9; }
.loading-inner{ display:flex; flex-direction:column; align-items:center; gap:8px; }
.spin{ animation: spin 1s linear infinite; }
.loading-text{ color:#606266; font-size:13px; }
.loading-mask :deep(svg){ width: 32px; height: 32px; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.fade-enter-active, .fade-leave-active{ transition: opacity .24s ease; }
.fade-enter-from, .fade-leave-to{ opacity: 0; }
@media (max-width: 720px){ .login-panel{ width:92vw; margin:0 auto; padding-top: 8vh; } }
</style>

<style>
body.login-page { margin: 0; height: 100%; overflow: hidden; background-color: #000; }
</style>

