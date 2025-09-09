<template>
	<BasePage title="基础设置">
		<el-form :model="form" label-width="120px" style="max-width:720px;">
			<el-form-item label="系统标题">
				<el-input v-model="form.title" placeholder="例如：WashClub 管理后台" />
			</el-form-item>
			<el-form-item label="LOGO">
				<div class="logo-row">
					<div v-if="form.logoUrl" class="square" title="点击放大">
						<el-image
							:src="absUrl(form.logoUrl)"
							fit="cover"
							style="width:100%;height:100%;cursor:zoom-in;"
							:preview-src-list="[absUrl(form.logoUrl)]"
							:initial-index="0"
							preview-teleported
						/>
					</div>
					<FileInput v-model="(form.logoUrl as any)" placeholder="输入URL或从文件库选择" :showPreview="false" />
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
					<el-image
						v-if="form.bgImageUrl"
						:src="absUrl(form.bgImageUrl)"
						fit="contain"
						style="max-width:240px;border:1px solid var(--el-border-color);border-radius:6px;background:#fff;cursor:zoom-in;"
						:preview-src-list="[absUrl(form.bgImageUrl)]"
						:initial-index="0"
						preview-teleported
					/>
					<FileInput v-model="(form.bgImageUrl as any)" placeholder="输入URL或从文件库选择" :showPreview="false" />
					<el-button v-if="form.bgImageUrl" text type="danger" @click="form.bgImageUrl=null">移除</el-button>
				</div>
			</el-form-item>
			<el-form-item label="默认会员头像">
				<div class="logo-row">
					<div v-if="form.defaultMemberAvatarUrl" class="square" title="点击放大">
						<el-image
							:src="absUrl(form.defaultMemberAvatarUrl)"
							fit="cover"
							style="width:100%;height:100%;cursor:zoom-in;"
							:preview-src-list="[absUrl(form.defaultMemberAvatarUrl)]"
							:initial-index="0"
							preview-teleported
						/>
					</div>
					<FileInput v-model="(form.defaultMemberAvatarUrl as any)" placeholder="输入URL或从文件库选择" :showPreview="false" />
					<el-button v-if="form.defaultMemberAvatarUrl" text type="danger" @click="form.defaultMemberAvatarUrl=null">移除</el-button>
				</div>
			</el-form-item>
			<el-form-item>
				<el-button type="primary" @click="save">
					<el-icon style="vertical-align: middle; margin-right:4px;"><Check /></el-icon>
					<span style="vertical-align: middle;">保存</span>
				</el-button>
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
import FileInput from './_components/FileInput.vue';
import { Check } from '@element-plus/icons-vue';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const form = ref<{ title: string; logoUrl: string|null; bgType: 'bing'|'image'; bgImageUrl: string|null; defaultMemberAvatarUrl: string|null }>({ title: 'WashClub 管理后台', logoUrl: null, bgType: 'bing', bgImageUrl: null, defaultMemberAvatarUrl: null });

function absUrl(u?: string | null){ return abs(u); }

async function fetchSetting(){ form.value = await http('/system/site-setting', { method: 'GET' }); }

const showLogoViewer = ref(false);
const showAvatarViewer = ref(false);

async function save(){
  await http('/system/site-setting', { method:'POST', body: form.value });
  try { localStorage.setItem('siteTitle', form.value.title || 'WashClub 管理后台'); document.title = `${form.value.title || 'WashClub 管理后台'} - 基础设置`; } catch {}
  ElMessage.success('已保存');
}

// 统一由 FileInput 处理上传或选择，保留回退逻辑可移除

onMounted(fetchSetting);
</script>

<style scoped>
.logo-row{ display:flex; align-items:center; gap:12px; }
/* 固定方形预览容器，确保始终是正方形外框 */
.square{ width:64px; height:64px; flex: none; border-radius:0; border:1px solid var(--el-border-color); background:#fff; overflow:hidden; display:flex; align-items:center; justify-content:center; position:relative; line-height:0; }
.square :deep(.el-image){ width:100% !important; height:100% !important; display:block; border-radius:0 !important; }
.square :deep(.el-image__inner){ width:100% !important; height:100% !important; object-fit:cover !important; border-radius:0 !important; }
.square :deep(img){ width:100% !important; height:100% !important; object-fit:cover !important; border-radius:0 !important; display:block !important; }
.avatar-square{ width:64px; height:64px; border-radius:6px; border:1px solid var(--el-border-color); overflow:hidden; display:flex; align-items:center; justify-content:center; cursor:zoom-in; }
.avatar-square :deep(.el-avatar){ width:64px; height:64px; }
</style>


