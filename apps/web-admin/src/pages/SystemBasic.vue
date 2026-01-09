<template>
	<BasePage title="基础设置">
		<template #actions>
			<div class="header-bar">
				<div class="header-left">
					<div class="title">
						<span class="title-dot" :data-dirty="isDirty ? 'true' : 'false'"></span>
						<span>基础设置</span>
					</div>
					<div class="sub">
						<span v-if="loadingSetting || loadingTerms">正在加载…</span>
						<span v-else-if="activeTab === 'basic'">
							{{ isSettingDirty ? '有未保存的修改' : (lastSavedAt ? `最近保存：${lastSavedAt}` : '已同步') }}
						</span>
						<span v-else>
							{{ isTermsDirty ? '有未保存的修改' : (lastSavedAtTerms ? `最近保存：${lastSavedAtTerms}` : '已同步') }}
						</span>
					</div>
				</div>
				<div class="header-right">
					<el-button v-if="activeTab==='basic'" @click="resetSetting" :disabled="!isSettingDirty || savingSetting || loadingSetting">重置</el-button>
					<el-button v-if="activeTab==='terms'" @click="resetTerms" :disabled="!isTermsDirty || savingTerms || loadingTerms">重置</el-button>

					<el-divider direction="vertical" />

					<el-button v-if="activeTab==='basic'" type="primary" :loading="savingSetting" :disabled="loadingSetting" @click="saveSetting">
						<el-icon style="vertical-align: middle; margin-right:4px;"><Check /></el-icon>
						<span style="vertical-align: middle;">保存</span>
					</el-button>
					<el-button v-else type="primary" :loading="savingTerms" :disabled="loadingTerms" @click="saveTerms">
						<el-icon style="vertical-align: middle; margin-right:4px;"><Check /></el-icon>
						<span style="vertical-align: middle;">保存协议</span>
					</el-button>
				</div>
			</div>
		</template>

		<div class="wrap">
			<!-- 轻量线条 Tabs：只做切换，不做容器 -->
			<el-tabs v-model="activeTab" class="simple-tabs">
				<el-tab-pane label="系统基础信息" name="basic" />
				<el-tab-pane label="小程序用户协议配置" name="terms" />
			</el-tabs>

			<!-- 单一滚动区：避免内外层多次滚动 -->
			<div class="scroll">
				<div v-show="activeTab==='basic'">
					<div class="grid">
						<el-card shadow="never" class="card">
							<template #header>
								<div class="card-title">
									<span>品牌与展示</span>
									<span class="muted">用于侧边栏与浏览器标题展示</span>
								</div>
							</template>

							<el-form ref="settingFormRef" :model="form" :rules="settingRules" label-position="top" class="form">
								<el-form-item label="系统标题" prop="title">
									<el-input v-model="form.title" placeholder="例如：WashClub 管理后台" maxlength="40" show-word-limit clearable />
									<div class="help">建议 6-16 字，过长会在侧边栏自动省略。</div>
								</el-form-item>

								<el-form-item label="LOGO" prop="logoUrl">
									<div class="asset">
										<div class="asset__preview">
											<el-image
												v-if="form.logoUrl"
												:src="absUrl(form.logoUrl)"
												fit="cover"
												:preview-src-list="[absUrl(form.logoUrl)]"
												:initial-index="0"
												preview-teleported
											/>
											<div v-else class="asset__placeholder">
												<el-icon><Picture /></el-icon>
												<span>未设置</span>
											</div>
										</div>
										<div class="asset__body">
											<FileInput v-model="(form.logoUrl as any)" placeholder="输入URL或从文件库选择" :showPreview="false" source="system-logo" />
											<div class="asset__ops">
												<el-button v-if="form.logoUrl" link type="danger" @click="form.logoUrl=null">移除</el-button>
												<el-button v-if="form.logoUrl" link @click="openInNewTab(form.logoUrl)">打开</el-button>
											</div>
											<div class="help">推荐 256×256 PNG / WebP，透明底效果更佳。</div>
										</div>
									</div>
								</el-form-item>

								<el-form-item label="默认会员头像" prop="defaultMemberAvatarUrl">
									<div class="asset">
										<div class="asset__preview">
											<el-image
												v-if="form.defaultMemberAvatarUrl"
												:src="absUrl(form.defaultMemberAvatarUrl)"
												fit="cover"
												:preview-src-list="[absUrl(form.defaultMemberAvatarUrl)]"
												:initial-index="0"
												preview-teleported
											/>
											<div v-else class="asset__placeholder">
												<el-icon><Picture /></el-icon>
												<span>未设置</span>
											</div>
										</div>
										<div class="asset__body">
											<FileInput v-model="(form.defaultMemberAvatarUrl as any)" placeholder="输入URL或从文件库选择" :showPreview="false" source="system-default-avatar" />
											<div class="asset__ops">
												<el-button v-if="form.defaultMemberAvatarUrl" link type="danger" @click="form.defaultMemberAvatarUrl=null">移除</el-button>
												<el-button v-if="form.defaultMemberAvatarUrl" link @click="openInNewTab(form.defaultMemberAvatarUrl)">打开</el-button>
											</div>
											<div class="help">用于未设置头像的会员/管理员展示（部分页面会回退使用）。</div>
										</div>
									</div>
								</el-form-item>
							</el-form>
						</el-card>

						<el-card shadow="never" class="card">
							<template #header>
								<div class="card-title">
									<span>登录页背景</span>
									<span class="muted">影响后台登录页视觉</span>
								</div>
							</template>

							<el-form :model="form" label-position="top" class="form">
								<el-form-item label="背景类型">
									<el-radio-group v-model="form.bgType">
										<el-radio-button value="bing">必应每日壁纸（默认）</el-radio-button>
										<el-radio-button value="image">自定义图片</el-radio-button>
									</el-radio-group>
									<div class="help">选择“自定义图片”后，建议使用 1920×1080 或更大尺寸。</div>
								</el-form-item>

								<el-form-item v-if="form.bgType==='image'" label="背景图片" prop="bgImageUrl">
									<div class="asset asset--wide">
										<div class="asset__preview asset__preview--wide">
											<el-image
												v-if="form.bgImageUrl"
												:src="absUrl(form.bgImageUrl)"
												fit="cover"
												:preview-src-list="[absUrl(form.bgImageUrl)]"
												:initial-index="0"
												preview-teleported
											/>
											<div v-else class="asset__placeholder">
												<el-icon><Picture /></el-icon>
												<span>未设置</span>
											</div>
										</div>
										<div class="asset__body">
											<FileInput v-model="(form.bgImageUrl as any)" placeholder="输入URL或从文件库选择" :showPreview="false" source="system-bg" />
											<div class="asset__ops">
												<el-button v-if="form.bgImageUrl" link type="danger" @click="form.bgImageUrl=null">移除</el-button>
												<el-button v-if="form.bgImageUrl" link @click="openInNewTab(form.bgImageUrl)">打开</el-button>
											</div>
											<div class="help">强烈建议压缩（WebP/AVIF），避免登录页加载过慢。</div>
										</div>
									</div>
								</el-form-item>
							</el-form>
						</el-card>
					</div>
				</div>

				<div v-show="activeTab==='terms'">
					<el-card shadow="never" class="card">
						<template #header>
							<div class="card-title">
								<span>用户协议（HTML）</span>
								<span class="muted">保存后小程序会通过公开链接直接打开</span>
							</div>
						</template>

						<el-alert
							title="注意：该链接为公开页面，请不要在协议中包含任何敏感信息。"
							type="warning"
							show-icon
							:closable="false"
							class="mb"
						/>

						<div class="terms-actions">
							<el-button @click="fetchTerms" :loading="loadingTerms">拉取当前</el-button>
							<el-button @click="fillTermsTemplate" :disabled="!!termsHtml">填充模板</el-button>
							<el-button type="success" @click="openPreview">新窗口预览</el-button>
							<el-button @click="copyPublicUrl">复制公开链接</el-button>
							<div class="terms-url">
								<span class="muted">公开链接：</span>
								<a :href="termsPublicUrl" target="_blank">{{ termsPublicUrl }}</a>
							</div>
						</div>

						<el-input
							v-model="termsHtml"
							type="textarea"
							:autosize="{ minRows: 12, maxRows: 28 }"
							placeholder="<!doctype html> ... 建议包含 meta viewport 和基础样式"
						/>

						<div class="preview-wrap">
							<div class="preview-head">
								<div class="preview-title">预览</div>
								<div class="preview-tools">
									<el-button size="small" @click="refreshTermsPreview">刷新</el-button>
								</div>
							</div>
							<div class="preview-frame">
								<iframe :src="termsIframeSrc" />
							</div>
						</div>
					</el-card>
				</div>
			</div>
		</div>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { BasePage } from '@wash/shared-ui';
import {
	systemSettingControllerGetMiniappTerms,
	systemSettingControllerGetSetting,
	systemSettingControllerSaveMiniappTerms,
	systemSettingControllerSaveSetting,
} from '@wash/api-client';
import { API_BASE } from '../config';
import { ElMessage, ElMessageBox } from 'element-plus';
import { absUrl as abs } from '../utils/http';
import FileInput from './_components/FileInput.vue';
import { Check, Picture } from '@element-plus/icons-vue';

type SettingForm = {
	title: string;
	logoUrl: string | null;
	bgType: 'bing' | 'image';
	bgImageUrl: string | null;
	defaultMemberAvatarUrl: string | null;
};

const form = ref<SettingForm>({
	title: 'WashClub 管理后台',
	logoUrl: null,
	bgType: 'bing',
	bgImageUrl: null,
	defaultMemberAvatarUrl: null
});

function absUrl(u?: string | null){ return abs(u); }

function normalizeNullableUrl(v: any): string | null {
	try {
		if (v === null || v === undefined) return null;
		const s = String(v).trim();
		return s ? s : null;
	} catch { return null; }
}

function normalizeSettingPayload(raw: any): SettingForm {
	const p: any = { ...(raw || {}) };
	const normalized: SettingForm = {
		title: String(p.title ?? '').trim() || 'WashClub 管理后台',
		logoUrl: normalizeNullableUrl(p.logoUrl),
		defaultMemberAvatarUrl: normalizeNullableUrl(p.defaultMemberAvatarUrl),
		bgType: (p.bgType === 'image') ? 'image' : 'bing',
		bgImageUrl: null,
	};
	normalized.bgImageUrl = (normalized.bgType === 'image') ? normalizeNullableUrl(p.bgImageUrl) : null;
	return normalized;
}

function deepClone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v || null));
}

function formatTime(ts: number): string {
	try{
		const d = new Date(ts);
		const p = (n:number)=> String(n).padStart(2,'0');
		return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
	}catch{ return ''; }
}

const loadingSetting = ref(false);
const savingSetting = ref(false);
const lastSavedAt = ref<string>('');
const initialSetting = ref<SettingForm | null>(null);

const settingFormRef = ref();
const settingRules = {
	title: [
		{ required: true, message: '请输入系统标题', trigger: 'blur' },
		{ min: 2, max: 40, message: '标题长度建议 2-40 字', trigger: 'blur' }
	],
	bgImageUrl: [
		{
			validator: (_: any, v: any, cb: any) => {
				if (form.value.bgType !== 'image') return cb();
				if (!v) return cb(new Error('请选择背景图片'));
				return cb();
			},
			trigger: 'change'
		}
	]
};

const settingSnapshot = computed(() => JSON.stringify(normalizeSettingPayload(form.value)));
const initialSettingSnapshot = computed(() => JSON.stringify(initialSetting.value || normalizeSettingPayload(form.value)));
const isSettingDirty = computed(() => settingSnapshot.value !== initialSettingSnapshot.value);

async function fetchSetting(){
	try{
		loadingSetting.value = true;
		const s: any = (await systemSettingControllerGetSetting() as unknown) as any;
		const normalized = normalizeSettingPayload(s || {});
		form.value = normalized;
		initialSetting.value = deepClone(normalized);
	}catch(e:any){
		ElMessage.error(String(e?.message||'加载基础设置失败'));
	}finally{
		loadingSetting.value = false;
	}
}

async function saveSetting(){
	try{
		if (settingFormRef.value) await settingFormRef.value.validate();
		savingSetting.value = true;
		const payload = normalizeSettingPayload(form.value);
		await systemSettingControllerSaveSetting(payload as any);
		await fetchSetting(); // 保存后以服务端为准刷新一次，避免本地状态/默认值不一致
		lastSavedAt.value = formatTime(Date.now());
		try {
			localStorage.setItem('siteTitle', String(form.value.title || 'WashClub 管理后台'));
			localStorage.setItem('siteSetting', JSON.stringify(form.value || {}));
			window.dispatchEvent(new CustomEvent('site-setting-updated', { detail: form.value }));
			document.title = `${String(form.value.title || 'WashClub 管理后台')} - 基础设置`;
		} catch {}
		ElMessage.success('已保存');
	}catch(e:any){
		ElMessage.error(String(e?.message||'保存失败'));
	}finally{
		savingSetting.value = false;
	}
}

function resetSetting(){
	if (!initialSetting.value) return;
	form.value = deepClone(initialSetting.value);
}

// 标签页与用户协议配置
const activeTab = ref<'basic'|'terms'>('basic');
const termsHtml = ref<string>('');
const savingTerms = ref<boolean>(false);
const loadingTerms = ref<boolean>(false);
const lastSavedAtTerms = ref<string>('');
const termsPublicUrl = computed(() => `${API_BASE}/system/public/miniapp-terms`);
const termsPreviewTs = ref<number>(Date.now());
const termsIframeSrc = computed(() => `${termsPublicUrl.value}?_=${termsPreviewTs.value}`);
const initialTermsHtml = ref<string>('');
const isTermsDirty = computed(() => String(termsHtml.value || '') !== String(initialTermsHtml.value || ''));

async function fetchTerms(){
	try{
		loadingTerms.value = true;
		const res = (await systemSettingControllerGetMiniappTerms() as unknown) as any;
		termsHtml.value = String((res as any)?.html || '');
		initialTermsHtml.value = termsHtml.value;
		termsPreviewTs.value = Date.now();
		ElMessage.success('已拉取');
	}catch(e:any){
		termsHtml.value = '';
		initialTermsHtml.value = '';
		ElMessage.error(String(e?.message||'拉取失败'));
	}finally{
		loadingTerms.value = false;
	}
}

async function saveTerms(){
	try{
		if (!termsHtml.value.trim()){
			await ElMessageBox.confirm('当前协议内容为空，确认仍要保存吗？', '确认保存', { type: 'warning', confirmButtonText: '继续保存', cancelButtonText: '取消' });
		}
		savingTerms.value = true;
		await systemSettingControllerSaveMiniappTerms({ html: termsHtml.value } as any);
		initialTermsHtml.value = termsHtml.value;
		lastSavedAtTerms.value = formatTime(Date.now());
		ElMessage.success('协议已保存');
		termsPreviewTs.value = Date.now(); // 刷新 iframe 预览
	} catch(e:any){ ElMessage.error(String(e?.message||'保存失败')); }
	finally{ savingTerms.value = false; }
}

function openPreview(){ try{ window.open(termsPublicUrl.value, '_blank'); }catch{} }

function refreshTermsPreview(){ termsPreviewTs.value = Date.now(); }

function fillTermsTemplate(){
	termsHtml.value = [
		'<!doctype html>',
		'<html lang="zh-CN">',
		'<head>',
		'  <meta charset="utf-8" />',
		'  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
		'  <title>用户协议</title>',
		'  <style>',
		'    :root { color-scheme: light; }',
		'    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;',
		'           margin: 0; padding: 16px; line-height: 1.6; color: #111827; background: #ffffff; }',
		'    h1 { font-size: 18px; margin: 0 0 12px; }',
		'    h2 { font-size: 15px; margin: 18px 0 8px; }',
		'    p { margin: 8px 0; color: #374151; }',
		'    .muted { color: #6b7280; font-size: 12px; }',
		'    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background: #fff; }',
		'  </style>',
		'</head>',
		'<body>',
		'  <div class="card">',
		'    <h1>用户协议</h1>',
		'    <p class="muted">更新日期：请填写</p>',
		'    <h2>一、服务说明</h2>',
		'    <p>请在此处填写协议内容…</p>',
		'    <h2>二、隐私与数据</h2>',
		'    <p>请在此处填写协议内容…</p>',
		'    <h2>三、其他</h2>',
		'    <p>请在此处填写协议内容…</p>',
		'  </div>',
		'</body>',
		'</html>',
	].join('\n');
}

function resetTerms(){ termsHtml.value = String(initialTermsHtml.value || ''); }

function openInNewTab(u?: string | null){
	try{
		const url = absUrl(u || '');
		if (url) window.open(url, '_blank');
	}catch{}
}

async function copyPublicUrl(){
	try{
		await navigator.clipboard?.writeText(termsPublicUrl.value);
		ElMessage.success('已复制');
	}catch{
		ElMessage.error('复制失败，请手动复制');
	}
}

// bgType 切换时自动清理无效字段，避免“看似已选但实际无效”的状态
watch(()=>form.value.bgType, (t)=>{
	if (t !== 'image') form.value.bgImageUrl = null;
});

const isDirty = computed(() => (activeTab.value === 'basic' ? isSettingDirty.value : isTermsDirty.value));

// 离开拦截：路由跳转 & 刷新/关闭标签页
onBeforeRouteLeave((_to, _from, next)=>{
	if (!isDirty.value) return next();
	ElMessageBox.confirm('当前页面有未保存的修改，确定要离开吗？', '提示', {
		type: 'warning',
		confirmButtonText: '离开',
		cancelButtonText: '继续编辑'
	}).then(()=> next()).catch(()=> next(false));
});

function beforeUnloadHandler(e: BeforeUnloadEvent){
	if (!isDirty.value) return;
	e.preventDefault();
	e.returnValue = '';
}

onMounted(()=>{
	fetchSetting();
	fetchTerms();
	try{ window.addEventListener('beforeunload', beforeUnloadHandler); }catch{}
});
onBeforeUnmount(()=>{ try{ window.removeEventListener('beforeunload', beforeUnloadHandler); }catch{} });
</script>

<style scoped>
.wrap{
	height: 100%;
	min-height: 0;
	display:flex;
	flex-direction: column;
	gap: 10px;
}

/* 轻量 Tabs：线条风格，不再作为外层容器 */
.simple-tabs{
	flex: none;
	background: transparent;
}
.simple-tabs :deep(.el-tabs__header){
	margin: 0;
}
.simple-tabs :deep(.el-tabs__nav-wrap::after){
	height: 1px;
	background: var(--el-border-color-light);
}
.simple-tabs :deep(.el-tabs__item){
	height: 38px;
	line-height: 38px;
	font-weight: 700;
	color: var(--el-text-color-regular);
}
.simple-tabs :deep(.el-tabs__item:hover){
	color: var(--el-text-color-primary);
}
.simple-tabs :deep(.el-tabs__item.is-active){
	color: var(--el-color-primary);
}
.simple-tabs :deep(.el-tabs__active-bar){
	height: 3px;
	border-radius: 3px;
}
.simple-tabs :deep(.el-tabs__content){
	display:none; /* 内容区由下方自定义容器承载 */
}

/* 单一滚动区域：外观更统一、避免多层滚动 */
.scroll{
	flex: 1;
	min-height: 0;
	overflow: auto;
	padding: 2px;
	scrollbar-width: thin;
	scrollbar-color: color-mix(in oklab, var(--el-border-color), transparent 45%) transparent;
}
.scroll::-webkit-scrollbar{ width: 6px; }
.scroll::-webkit-scrollbar-track{ background: transparent; }
.scroll::-webkit-scrollbar-thumb{
	background: color-mix(in oklab, var(--el-border-color), transparent 45%);
	border-radius: 9999px;
}
.scroll::-webkit-scrollbar-thumb:hover{
	background: color-mix(in oklab, var(--el-border-color), transparent 25%);
}

.header-bar{
	width: 100%;
	display:flex;
	align-items:center;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px solid var(--el-border-color-light);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 45%);
	box-shadow:
		0 1px 2px rgba(0,0,0,.04),
		0 4px 14px rgba(15, 23, 42, .05);
}
.header-left{ display:flex; flex-direction:column; gap: 2px; min-width: 0; }
.header-right{ display:flex; align-items:center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.title{ display:flex; align-items:center; gap: 10px; font-weight: 700; color: var(--el-text-color-primary); }
.title-dot{
	width: 10px; height: 10px; border-radius: 50%;
	background: color-mix(in oklab, var(--el-text-color-placeholder), transparent 30%);
	box-shadow: 0 0 0 2px color-mix(in oklab, var(--el-border-color), transparent 40%);
}
.title-dot[data-dirty="true"]{
	background: var(--el-color-warning);
	box-shadow: 0 0 0 4px color-mix(in oklab, var(--el-color-warning), transparent 75%);
}
.sub{ color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 520px; }

.grid{
	display:grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}
@media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }

.card{
	border-radius: 12px;
	border: 1px solid var(--el-border-color-light);
}
.card-title{ display:flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.muted{ color: var(--el-text-color-secondary); font-size: 12px; }
.form{ max-width: 900px; }
.help{ margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; }

/* 卡片细节：更舒服的 header/body 间距与层级 */
.card :deep(.el-card__header){
	padding: 12px 14px;
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 30%);
	border-bottom: 1px solid var(--el-border-color-light);
}
.card :deep(.el-card__body){
	padding: 14px;
}
.form :deep(.el-form-item){
	margin-bottom: 14px;
}
.form :deep(.el-form-item__label){
	font-weight: 600;
	color: var(--el-text-color-primary);
}
.form :deep(.el-input__wrapper),
.form :deep(.el-textarea__inner){
	border-radius: 10px;
}

.asset{
	display: grid;
	grid-template-columns: 84px 1fr;
	gap: 12px;
	align-items: start;
	width: 100%;
}
.asset__preview{
	width: 84px;
	height: 84px;
	border-radius: 12px;
	overflow:hidden;
	border: 1px solid var(--el-border-color-light);
	background: var(--el-bg-color);
}
.asset__preview :deep(.el-image){ width: 100%; height: 100%; }
.asset__preview :deep(img){ width: 100%; height: 100%; object-fit: cover; display:block; }
.asset__placeholder{
	width: 100%;
	height: 100%;
	display:flex;
	flex-direction: column;
	align-items:center;
	justify-content:center;
	gap: 6px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	background: linear-gradient(
		180deg,
		color-mix(in oklab, var(--el-fill-color-light), transparent 35%),
		color-mix(in oklab, var(--el-bg-color), transparent 15%)
	);
}
.asset__placeholder :deep(.el-icon){ font-size: 18px; opacity: 0.85; }
.asset__body{ min-width: 0; }
.asset__ops{ display:flex; gap: 10px; align-items:center; margin-top: 6px; }
.asset--wide{ grid-template-columns: 220px 1fr; }
.asset__preview--wide{ width: 220px; height: 124px; }
@media (max-width: 520px){
	.asset{ grid-template-columns: 1fr; }
	.asset__preview, .asset__preview--wide{ width: 100%; height: 180px; }
}

/* 在本页的资源选择中，把 FileInput 改成“输入 + 操作按钮”同行，避免堆叠导致视觉错位 */
.asset :deep(.file-input){
	flex-direction: row;
	align-items: center;
	gap: 10px;
}
.asset :deep(.file-input .el-input){
	flex: 1;
	min-width: 0;
}
.asset :deep(.file-input .actions){
	flex: none;
	white-space: nowrap;
}
@media (max-width: 520px){
	.asset :deep(.file-input){
		flex-direction: column;
		align-items: stretch;
	}
	.asset :deep(.file-input .actions){
		justify-content: flex-start;
		flex-wrap: wrap;
	}
}

.mt{ margin-top: 10px; }
.mb{ margin-bottom: 12px; }

.terms-actions{
	display:flex;
	flex-wrap: wrap;
	align-items:center;
	gap: 8px 10px;
	margin-bottom: 10px;
}
.terms-url{
	display:flex;
	align-items:center;
	gap: 8px;
	min-width: 0;
	flex: 1;
}
.terms-url a{ color: var(--el-color-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.terms-url a:hover{ text-decoration: underline; }

.preview-wrap{
	margin-top: 12px;
	border: 1px solid var(--el-border-color-light);
	border-radius: 12px;
	overflow: hidden;
	background: var(--el-bg-color);
}
.preview-head{
	display:flex;
	align-items:center;
	justify-content: space-between;
	padding: 10px 12px;
	border-bottom: 1px solid var(--el-border-color-light);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 45%);
}
.preview-title{ font-weight: 700; color: var(--el-text-color-primary); }
.preview-frame{ height: 520px; background: #fff; }
.preview-frame iframe{ width: 100%; height: 100%; border: 0; display:block; }
</style>


