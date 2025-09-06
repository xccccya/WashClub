<template>
	<BasePage title="基础设置">
		<el-form :model="form" label-width="120px" style="max-width:720px;">
			<el-form-item label="系统标题">
				<el-input v-model="form.title" placeholder="例如：WashClub 管理后台" />
			</el-form-item>
			<el-form-item label="LOGO">
				<div class="logo-row">
					<el-avatar v-if="form.logoUrl" :src="absUrl(form.logoUrl)" :size="64" />
					<el-upload :http-request="uploadLogo" accept="image/*" :show-file-list="false">
						<el-button><el-icon style="margin-right:4px;"><Upload /></el-icon>上传图片</el-button>
					</el-upload>
					<el-button v-if="form.logoUrl" text type="danger" @click="form.logoUrl=null">移除</el-button>
				</div>
			</el-form-item>
			<el-form-item label="登录页背景">
				<el-radio-group v-model="form.bgType">
					<el-radio-button label="bing">必应每日壁纸（默认）</el-radio-button>
					<el-radio-button label="image">自定义图片</el-radio-button>
				</el-radio-group>
			</el-form-item>
			<el-form-item v-if="form.bgType==='image'" label="背景图片">
				<div class="logo-row">
					<img v-if="form.bgImageUrl" :src="absUrl(form.bgImageUrl)" style="width:160px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--el-border-color);" />
					<el-upload :http-request="uploadBg" accept="image/*" :show-file-list="false">
						<el-button><el-icon style="margin-right:4px;"><Upload /></el-icon>上传图片</el-button>
					</el-upload>
					<el-button v-if="form.bgImageUrl" text type="danger" @click="form.bgImageUrl=null">移除</el-button>
				</div>
			</el-form-item>
			<el-form-item>
				<el-button type="primary" @click="save">保存</el-button>
			</el-form-item>
		</el-form>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import { absUrl as abs } from '../utils/http';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const form = ref<{ title: string; logoUrl: string|null; bgType: 'bing'|'image'; bgImageUrl: string|null }>({ title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null });

function absUrl(u?: string | null){ return abs(u); }

async function fetchSetting(){ form.value = await http('/system/site-setting', { method: 'GET' }); }

async function save(){
  await http('/system/site-setting', { method:'POST', body: form.value });
  try { localStorage.setItem('siteTitle', form.value.title || 'WashClub 管理后台'); document.title = `${form.value.title || 'WashClub 管理后台'} - 基础设置`; } catch {}
  ElMessage.success('已保存');
}

async function uploadLogo(p: any){
  const fd = new FormData(); fd.append('file', p.file); fd.append('dir', 'public');
  const res = await fetch(`${API_BASE}/file/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('上传失败');
  const data: any = await res.json();
  form.value.logoUrl = data?.url || '';
}

async function uploadBg(p: any){
  const fd = new FormData(); fd.append('file', p.file); fd.append('dir', 'public');
  const res = await fetch(`${API_BASE}/file/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('上传失败');
  const data: any = await res.json();
  form.value.bgImageUrl = data?.url || '';
}

onMounted(fetchSetting);
</script>

<style scoped>
.logo-row{ display:flex; align-items:center; gap:12px; }
</style>


