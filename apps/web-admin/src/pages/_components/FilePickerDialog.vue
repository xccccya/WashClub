<template>
	<el-dialog v-model="visible" :title="title || '选择文件'" width="1000px" class="file-picker-dialog">
		<!-- 工具栏 -->
		<div class="picker-toolbar">
			<div class="toolbar-main">
				<el-input 
					v-model="search" 
					placeholder="搜索文件名" 
					class="search-input"
					clearable
					@keyup.enter="fetchList"
					@clear="fetchList"
				>
					<template #prefix>
						<el-icon><Search /></el-icon>
					</template>
				</el-input>
				
				<el-select v-model="mimeFilter" placeholder="文件类型" clearable class="filter-select" @change="fetchList">
					<el-option label="图片" value="image/">
						<el-icon style="margin-right: 8px;"><Picture /></el-icon>图片
					</el-option>
					<el-option label="视频" value="video/">
						<el-icon style="margin-right: 8px;"><VideoPlay /></el-icon>视频
					</el-option>
					<el-option label="音频" value="audio/">
						<el-icon style="margin-right: 8px;"><Headset /></el-icon>音频
					</el-option>
					<el-option label="PDF" value="pdf">
						<el-icon style="margin-right: 8px;"><Document /></el-icon>PDF
					</el-option>
				</el-select>
				
				<el-select 
					v-model="tagFilters" 
					placeholder="标签筛选" 
					clearable 
					filterable 
					multiple 
					class="tags-select"
					@change="fetchList"
				>
					<el-option v-for="t in allTags" :key="t" :label="t" :value="t">
						<el-tag size="small" style="margin-right: 4px;">{{ t }}</el-tag>
					</el-option>
				</el-select>
			</div>
			
			<div class="toolbar-actions">
				<el-upload :http-request="upload" :show-file-list="false" multiple>
					<el-button type="primary" size="small">
						<el-icon><UploadFilled /></el-icon>
						上传
					</el-button>
				</el-upload>
				
				<el-button-group size="small">
					<el-button :type="viewMode==='grid' ? 'primary' : ''" @click="setViewMode('grid')">
						<el-icon><Grid /></el-icon>
					</el-button>
					<el-button :type="viewMode==='table' ? 'primary' : ''" @click="setViewMode('table')">
						<el-icon><List /></el-icon>
					</el-button>
				</el-button-group>
				
				<el-select v-model="thumbSize" size="small" style="width:80px;" v-if="viewMode==='grid'">
					<el-option :value="120" label="小" />
					<el-option :value="240" label="中" />
					<el-option :value="480" label="大" />
				</el-select>
			</div>
		</div>

		<!-- 选择控制栏 -->
		<div class="picker-selection-bar" v-if="items.length > 0">
			<div class="selection-info">
				<el-checkbox 
					:model-value="isAllSelected" 
					:indeterminate="isIndeterminate" 
					@change="toggleSelectAll"
				>
					{{ selectedIds.size > 0 ? `已选择 ${selectedIds.size} 项` : '全选' }}
				</el-checkbox>
				<span class="total-info">共 {{ total }} 个文件</span>
			</div>
			
			<div class="selection-actions" v-if="selectedIds.size > 0">
				<el-button size="small" @click="selectAll" v-if="!isAllSelected">
					<el-icon><Select /></el-icon>
					全选
				</el-button>
				<el-button size="small" @click="clearSelection">
					<el-icon><Close /></el-icon>
					取消选择
				</el-button>
				<el-divider direction="vertical" />
				<el-button size="small" type="warning" @click="openBatchTag">
					<el-icon><PriceTag /></el-icon>
					批量标签
				</el-button>
				<el-popconfirm title="确认删除所选文件？" @confirm="batchDelete">
					<template #reference>
						<el-button size="small" type="danger">
							<el-icon><Delete /></el-icon>
							批量删除
						</el-button>
					</template>
				</el-popconfirm>
			</div>
		</div>
		<!-- 网格视图 -->
		<div v-if="viewMode==='grid'" class="picker-grid" :style="{ '--thumb': thumbSize + 'px' }">
			<div 
				v-for="it in items" 
				:key="it.id" 
				class="picker-card" 
				:class="{ 
					'selected': selectedIds.has(it.id),
					'is-image': isImage(it.mimeType),
					'has-tags': (it as any).tagsJson?.length > 0
				}" 
				@click="toggle(it)" 
				@dblclick.stop="openDetail(it)"
			>
				<!-- 文件缩略图/图标 -->
				<div class="picker-thumbnail">
					<img 
						v-if="isImage(it.mimeType)" 
						:src="thumb(it)" 
						:alt="it.filename"
						loading="lazy"
					/>
					<div v-else class="picker-file-icon">
						<el-icon size="28" v-if="it.mimeType?.startsWith('video/')"><VideoPlay /></el-icon>
						<el-icon size="28" v-else-if="it.mimeType?.startsWith('audio/')"><Headset /></el-icon>
						<el-icon size="28" v-else-if="it.mimeType?.includes('pdf')"><Document /></el-icon>
						<el-icon size="28" v-else><Folder /></el-icon>
						<div class="picker-extension">{{ it.extension?.toUpperCase() || 'FILE' }}</div>
					</div>
				</div>
				
				<!-- 文件信息 -->
				<div class="picker-info">
					<div class="picker-name" :title="it.filename">{{ it.filename }}</div>
					<div class="picker-size">{{ fmtSize(it.size) }}</div>
					
					<!-- 标签显示 -->
					<div class="picker-tags" v-if="(it as any).tagsJson?.length > 0">
						<el-tag 
							v-for="tag in (it as any).tagsJson.slice(0, 1)" 
							:key="tag" 
							size="small" 
							type="info"
						>
							{{ tag }}
						</el-tag>
						<el-tag 
							v-if="(it as any).tagsJson.length > 1" 
							size="small" 
							type="info"
						>
							+{{ (it as any).tagsJson.length - 1 }}
						</el-tag>
					</div>
				</div>
				
				<!-- 选中状态遮罩 -->
				<div class="picker-overlay" v-if="selectedIds.has(it.id)">
					<el-icon size="20" class="picker-check-icon"><Check /></el-icon>
				</div>
			</div>
		</div>
		<!-- 表格视图 -->
		<el-table v-else :data="items" size="small" style="width:100%;" class="picker-table">
			<el-table-column type="selection" width="48" :selectable="() => true" @selection-change="onTableSelectionChange" />
			<el-table-column label="预览" width="80">
				<template #default="{ row }">
					<div class="table-preview">
						<img v-if="isImage(row.mimeType)" :src="thumb(row)" />
						<el-icon v-else size="24" class="file-type-icon">
							<VideoPlay v-if="row.mimeType?.startsWith('video/')" />
							<Headset v-else-if="row.mimeType?.startsWith('audio/')" />
							<Document v-else-if="row.mimeType?.includes('pdf')" />
							<Folder v-else />
						</el-icon>
					</div>
				</template>
			</el-table-column>
			<el-table-column prop="filename" label="文件名" min-width="200">
				<template #default="{ row }">
					<div class="table-filename">
						<span :title="row.filename">{{ row.filename }}</span>
						<div class="table-tags" v-if="(row as any).tagsJson?.length > 0">
							<el-tag 
								v-for="tag in (row as any).tagsJson.slice(0, 2)" 
								:key="tag" 
								size="small" 
								type="info"
							>
								{{ tag }}
							</el-tag>
							<span v-if="(row as any).tagsJson.length > 2" class="more-tags">
								+{{ (row as any).tagsJson.length - 2 }}
							</span>
						</div>
					</div>
				</template>
			</el-table-column>
			<el-table-column prop="mimeType" label="类型" width="140" />
			<el-table-column prop="size" label="大小" width="100">
				<template #default="{ row }">{{ fmtSize(row.size) }}</template>
			</el-table-column>
			<el-table-column label="操作" width="180">
				<template #default="{ row }">
					<el-button size="small" text @click.stop="copy(abs(row.url))">
						<el-icon><Link /></el-icon>
						复制链接
					</el-button>
					<el-button size="small" text @click.stop="openDetail(row)">
						<el-icon><View /></el-icon>
						详情
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<!-- 分页区域 -->
		<div class="picker-pagination" v-if="items.length > 0">
			<div class="pagination-info">
				<span>显示 {{ Math.min((page - 1) * pageSize + 1, total) }}-{{ Math.min(page * pageSize, total) }} 项，共 {{ total }} 项</span>
			</div>
			<el-pagination 
				background 
				layout="prev, pager, next" 
				:total="total" 
				:page-size="pageSize" 
				:current-page="page" 
				@current-change="onPage" 
			/>
		</div>

		<!-- 空状态 -->
		<el-empty v-else-if="!loading" description="暂无文件" :image-size="100">
			<el-button type="primary" size="small">
				<el-icon><UploadFilled /></el-icon>
				上传文件
			</el-button>
		</el-empty>
		<template #footer>
			<el-button @click="visible=false">取消</el-button>
			<el-button type="primary" :disabled="selectedIds.size===0" @click="confirm">确定</el-button>
		</template>
		<el-drawer v-model="detailVisible" :title="current?.filename || '文件详情'" size="420px" class="picker-detail-drawer">
			<div v-if="current" class="picker-detail-content">
				<!-- 文件预览区域 -->
				<div class="picker-preview-section">
					<div class="picker-preview-container">
						<img 
							v-if="isImage(current.mimeType)" 
							:src="abs(current.url)" 
							:alt="current.filename"
							class="picker-preview-image"
						/>
						<div v-else class="picker-preview-placeholder">
							<el-icon size="40" class="file-type-icon">
								<VideoPlay v-if="current.mimeType?.startsWith('video/')" />
								<Headset v-else-if="current.mimeType?.startsWith('audio/')" />
								<Document v-else-if="current.mimeType?.includes('pdf')" />
								<Folder v-else />
							</el-icon>
							<div class="picker-extension-large">{{ current.extension?.toUpperCase() || 'FILE' }}</div>
						</div>
					</div>
					
					<!-- 文件基本信息 -->
					<div class="picker-basic-info">
						<h3 class="picker-file-title" :title="current.filename">{{ current.filename }}</h3>
						<div class="picker-meta-list">
							<div class="picker-meta-item">
								<span class="picker-meta-label">类型</span>
								<span class="picker-meta-value">{{ current.mimeType }}</span>
							</div>
							<div class="picker-meta-item">
								<span class="picker-meta-label">大小</span>
								<span class="picker-meta-value">{{ fmtSize(current.size) }}</span>
							</div>
							<div class="picker-meta-item" v-if="(current as any).createdAt">
								<span class="picker-meta-label">创建时间</span>
								<span class="picker-meta-value">{{ new Date((current as any).createdAt).toLocaleDateString() }}</span>
							</div>
						</div>
					</div>
				</div>

				<!-- 标签管理 -->
				<div class="picker-tags-section">
					<div class="picker-section-title">
						<el-icon><PriceTag /></el-icon>
						标签管理
					</div>
					<div class="picker-tags-input-container">
						<el-select 
							v-model="tagsInput" 
							multiple 
							filterable 
							allow-create 
							default-first-option 
							placeholder="输入标签名称，回车创建" 
							class="picker-tags-input"
						>
							<el-option v-for="t in allTags" :key="t" :label="t" :value="t">
								<el-tag size="small" type="info">{{ t }}</el-tag>
							</el-option>
						</el-select>
						<el-button 
							type="primary" 
							@click="saveTags(false)" 
							:loading="savingTags"
							size="small"
						>
							<el-icon><Check /></el-icon>
							保存
						</el-button>
					</div>
					
					<!-- 当前标签显示 -->
					<div class="picker-current-tags" v-if="(current as any).tagsJson?.length > 0">
						<div class="picker-tags-label">当前标签：</div>
						<div class="picker-tags-container">
							<el-tag 
								v-for="tag in (current as any).tagsJson" 
								:key="tag" 
								type="info" 
								size="small"
								closable
								@close="removeTag(tag)"
							>
								{{ tag }}
							</el-tag>
						</div>
					</div>
				</div>

				<!-- 链接信息 -->
				<div class="picker-url-section">
					<div class="picker-section-title">
						<el-icon><Link /></el-icon>
						访问链接
					</div>
					<el-input 
						:model-value="abs(current.url)" 
						readonly 
						class="picker-url-input"
						size="small"
					>
						<template #append>
							<el-button size="small" @click="copy(abs(current.url))">
								<el-icon><DocumentCopy /></el-icon>
							</el-button>
						</template>
					</el-input>
				</div>

				<!-- 引用列表 -->
				<div class="picker-references-section">
					<div class="picker-section-title">
						<el-icon><Connection /></el-icon>
						引用列表
						<el-badge :value="refs.length" class="picker-reference-badge" v-if="refs.length > 0" />
					</div>
					<div v-if="!refs.length" class="picker-empty-references">
						<el-icon size="24"><FolderOpened /></el-icon>
						<span>暂无引用记录</span>
					</div>
					<el-table v-else :data="refs" size="small" class="picker-references-table">
						<el-table-column prop="tableName" label="表" width="100">
							<template #default="{ row }">
								<el-tag size="small" type="success">{{ row.tableName }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="fieldName" label="字段" width="80">
							<template #default="{ row }">
								<code class="picker-field-name">{{ row.fieldName }}</code>
							</template>
						</el-table-column>
						<el-table-column prop="rowId" label="ID" min-width="80">
							<template #default="{ row }">
								<el-link type="primary" :underline="false" size="small">{{ row.rowId }}</el-link>
							</template>
						</el-table-column>
					</el-table>
				</div>
			</div>
		</el-drawer>
		<el-dialog v-model="batchTagVisible" title="批量打标签" width="420px">
			<el-select v-model="tagsInput" multiple filterable allow-create default-first-option placeholder="输入后回车创建或选择标签" style="width:100%">
				<el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
			</el-select>
			<template #footer>
				<el-button @click="batchTagVisible=false">取消</el-button>
				<el-button type="primary" @click="saveTags(true)" :loading="savingTags">保存</el-button>
			</template>
		</el-dialog>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../../config';
import { absUrl } from '../../utils/http';
import { 
	Search, Picture, VideoPlay, Headset, Document, UploadFilled, 
	Grid, List, Select, Close, PriceTag, Delete, Check, Folder, 
	Link, View, DocumentCopy, Connection, FolderOpened
} from '@element-plus/icons-vue';

type Asset = { 
	id: string; 
	url: string; 
	filename: string; 
	extension?: string | null; 
	mimeType: string; 
	size: number;
	createdAt?: string;
	tagsJson?: string[] | null;
	refCount?: number;
};

const props = defineProps<{ modelValue: boolean; multiple?: boolean; title?: string }>();
const emit = defineEmits<{ (e:'update:modelValue', v:boolean):void; (e:'picked', files: Asset[]):void }>();

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const visible = computed({ get:()=>props.modelValue, set:(v:boolean)=>emit('update:modelValue', v) });
const title = computed(()=>props.title);
const multiple = computed(()=>!!props.multiple);

const page = ref(1); const pageSize = ref(18); const total = ref(0);
const search = ref(''); const mimeFilter = ref('');
const tagFilter = ref('');
const tagFilters = ref<string[]>([]);
const items = ref<Asset[]>([]);
const viewMode = ref<'grid'|'table'>('grid');
const thumbSize = ref(240);
const selectedIds = ref<Set<string>>(new Set());
const allTags = ref<string[]>([]);
const loading = ref(false);

// 全选相关计算属性
const isAllSelected = computed(() => items.value.length > 0 && selectedIds.value.size === items.value.length);
const isIndeterminate = computed(() => selectedIds.value.size > 0 && selectedIds.value.size < items.value.length);

const detailVisible = ref(false);
const current = ref<any>(null);
const tagsDraft = ref('');
const tagsInput = ref<string[]>([]);
const savingTags = ref(false);
const batchTagVisible = ref(false);

function abs(u?: string){ return absUrl(u||''); }
function isImage(m?: string){ return /^image\//i.test(String(m||'')); }
function fmtSize(n:number){ if(n<1024) return n+'B'; if(n<1024*1024) return (n/1024).toFixed(1)+'KB'; if(n<1024*1024*1024) return (n/1024/1024).toFixed(1)+'MB'; return (n/1024/1024/1024).toFixed(1)+'GB'; }
function thumb(it:any){ return `${API_BASE}/assets/${it?.id}/thumbnail?size=${thumbSize.value}`; }
function copy(text:string){ try { navigator.clipboard?.writeText(text); } catch {} }
function copyMd(it:any){ copy(`![${it.filename}](${abs(it.url)})`); }
function copyHtml(it:any){ copy(`<img src="${abs(it.url)}" alt="${it.filename}" />`); }

async function fetchList(){
	try {
		loading.value = true;
		const res:any = await http('/assets', { method:'GET', query: { page: page.value, pageSize: pageSize.value, mimeType: mimeFilter.value || undefined, q: search.value || undefined, tag: tagFilter.value || undefined, tags: tagFilters.value.length? tagFilters.value: undefined } });
		items.value = Array.isArray(res?.items) ? res.items : [];
		total.value = Number(res?.total||0);
		const set = new Set<string>();
		for(const it of items.value){ const tags = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson : []; for(const t of tags){ if (t && typeof t === 'string') set.add(t); } }
		allTags.value = Array.from(new Set([ ...allTags.value, ...Array.from(set) ])).sort();
	} catch (e:any) {
		console.error('获取文件列表失败:', e);
		items.value = [];
		total.value = 0;
	} finally {
		loading.value = false;
	}
}
function onPage(p:number){ page.value = p; fetchList(); }

function toggle(it: Asset){ const s = selectedIds.value; if (!multiple.value) { s.clear(); s.add(it.id); } else { if (s.has(it.id)) s.delete(it.id); else s.add(it.id); } }

async function upload(options:any){
	try {
		const file = options?.file as File; 
		if (!file) return;
		const fd = new FormData(); 
		fd.append('file', file); 
		fd.append('dir', 'admin');
		// 使用admin目录自动识别为文件管理
		const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` }, body: fd });
		const j = await res.json(); 
		if (res.ok && j?.id) { 
			await fetchList(); 
		} else {
			console.error('文件上传失败:', j);
		}
	} catch (e:any) {
		console.error('文件上传异常:', e);
	}
}

function confirm(){
	const byId = new Map(items.value.map(x=>[x.id, x] as const));
	const picked = Array.from(selectedIds.value).map(id=>byId.get(id)).filter(Boolean) as Asset[];
	emit('picked', picked);
	visible.value = false; selectedIds.value.clear();
}

function openDetail(it:any){ current.value = it; tagsDraft.value = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson.join(',') : ''; tagsInput.value = Array.isArray((it as any).tagsJson)? (it as any).tagsJson : []; detailVisible.value = true; refreshRefs(); }
async function saveTags(isBatch = false){
	try{
		savingTags.value = true;
		const tags = (Array.isArray(tagsInput.value) ? tagsInput.value : String(tagsDraft.value||'').split(',')).map(s=>String(s||'').trim()).filter(Boolean);
		if (isBatch) {
			for(const id of selectedIds.value){ await http(`/assets/${id}`, { method:'PATCH', body: { tags } }); }
			batchTagVisible.value = false;
		} else if (current.value) {
			await http(`/assets/${current.value.id}`, { method:'PATCH', body: { tags } });
			detailVisible.value = false;
		}
		await fetchList();
	} finally { savingTags.value = false; }
}
function openBatchTag(){ tagsDraft.value=''; tagsInput.value = []; batchTagVisible.value = true; }
async function batchDelete(){ for(const id of selectedIds.value){ await http(`/assets/${id}`, { method:'DELETE' }); } selectedIds.value.clear(); await fetchList(); }

// 引用列表
const refs = ref<any[]>([]);
async function refreshRefs(){ if (current.value) { try { refs.value = await http(`/assets/${current.value.id}/references`, { method:'GET' }); } catch { refs.value = []; } } }
watch(detailVisible, async (v)=>{ if (v && current.value) { await refreshRefs(); } });

// 全选相关功能
function toggleSelectAll() {
	if (isAllSelected.value) {
		clearSelection();
	} else {
		selectAll();
	}
}

function selectAll() {
	selectedIds.value = new Set(items.value.map(f => f.id));
}

function clearSelection() {
	selectedIds.value.clear();
}

// 视图切换
function setViewMode(mode: 'grid' | 'table') {
	viewMode.value = mode;
}

// 表格选择变化处理
function onTableSelectionChange(selection: Asset[]) {
	selectedIds.value = new Set(selection.map(item => item.id));
}

// 移除单个标签
function removeTag(tagToRemove: string) {
	if (current.value && (current.value as any).tagsJson) {
		const updatedTags = ((current.value as any).tagsJson as string[]).filter(tag => tag !== tagToRemove);
		tagsInput.value = updatedTags;
		saveTags(false);
	}
}

watch(()=>props.modelValue, (v)=>{ if(v){ page.value=1; fetchList(); } else { selectedIds.value.clear(); } });
function toggleView(){ viewMode.value = viewMode.value==='grid' ? 'table' : 'grid'; }
</script>

<style scoped>
/* 对话框样式 */
:deep(.file-picker-dialog .el-dialog__body) {
	padding: 16px 20px 20px;
	max-height: 70vh;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

/* 工具栏 */
.picker-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 16px;
	margin-bottom: 16px;
	padding-bottom: 12px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	flex-shrink: 0;
}

.toolbar-main {
	display: flex;
	gap: 12px;
	align-items: center;
	flex: 1;
	min-width: 0;
}

.search-input {
	width: 200px;
	flex-shrink: 0;
}

.filter-select {
	width: 120px;
	flex-shrink: 0;
}

.tags-select {
	width: 160px;
	flex-shrink: 0;
}

.toolbar-actions {
	display: flex;
	gap: 8px;
	align-items: center;
	flex-shrink: 0;
}

/* 选择控制栏 */
.picker-selection-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px;
	background: var(--el-bg-color-page);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	margin-bottom: 12px;
	flex-shrink: 0;
}

.selection-info {
	display: flex;
	align-items: center;
	gap: 12px;
}

.total-info {
	color: var(--el-text-color-regular);
	font-size: 14px;
}

.selection-actions {
	display: flex;
	align-items: center;
	gap: 6px;
}

/* 网格布局 */
.picker-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(var(--thumb, 180px), 1fr));
	gap: 12px;
	padding: 4px;
	flex: 1;
	overflow-y: auto;
	max-height: 400px;
}

/* 文件卡片 */
.picker-card {
	position: relative;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 8px;
	overflow: hidden;
	cursor: pointer;
	background: #fff;
	transition: all 0.2s ease;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.picker-card:hover {
	border-color: var(--el-color-primary-light-7);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	transform: translateY(-1px);
}

.picker-card.selected {
	border-color: var(--el-color-primary);
	box-shadow: 0 0 0 1px var(--el-color-primary-light-8);
}


/* 缩略图区域 */
.picker-thumbnail {
	width: 100%;
	aspect-ratio: 1 / 1;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--el-fill-color-lighter);
	position: relative;
	overflow: hidden;
}

.picker-thumbnail img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transition: transform 0.2s ease;
}

.picker-card:hover .picker-thumbnail img {
	transform: scale(1.02);
}

/* 文件图标 */
.picker-file-icon {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	color: var(--el-text-color-regular);
}

.picker-extension {
	font-size: 11px;
	font-weight: 500;
	color: var(--el-text-color-secondary);
}

/* 文件信息 */
.picker-info {
	padding: 8px 10px;
	flex: 1;
}

.picker-name {
	font-size: 13px;
	font-weight: 500;
	color: var(--el-text-color-primary);
	margin-bottom: 4px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.picker-size {
	font-size: 11px;
	color: var(--el-text-color-secondary);
	margin-bottom: 4px;
}

/* 标签 */
.picker-tags {
	display: flex;
	gap: 2px;
	flex-wrap: wrap;
}

/* 选中状态遮罩 */
.picker-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(64, 158, 255, 0.08);
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}

.picker-check-icon {
	color: var(--el-color-primary);
	background: #fff;
	border-radius: 50%;
	padding: 3px;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

/* 表格视图 */
.picker-table {
	flex: 1;
	overflow: hidden;
}

:deep(.picker-table .el-table__body-wrapper) {
	max-height: 400px;
	overflow-y: auto;
}

.table-preview {
	width: 48px;
	height: 48px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 4px;
	overflow: hidden;
	background: var(--el-fill-color-lighter);
}

.table-preview img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.file-type-icon {
	color: var(--el-text-color-secondary);
}

.table-filename {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.table-tags {
	display: flex;
	gap: 4px;
	flex-wrap: wrap;
}

.more-tags {
	font-size: 11px;
	color: var(--el-text-color-secondary);
}

/* 分页区域 */
.picker-pagination {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 16px;
	padding-top: 12px;
	border-top: 1px solid var(--el-border-color-lighter);
	flex-shrink: 0;
}

.pagination-info {
	color: var(--el-text-color-regular);
	font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
	.picker-toolbar {
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
	}
	
	.toolbar-main {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
	}
	
	.search-input,
	.filter-select,
	.tags-select {
		width: 100%;
	}
	
	.picker-selection-bar {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
	}
	
	.selection-actions {
		justify-content: center;
		flex-wrap: wrap;
	}
	
	.picker-pagination {
		flex-direction: column;
		gap: 8px;
		text-align: center;
	}
}

/* 保留原有样式的兼容 */
.muted { 
	color: var(--el-text-color-secondary); 
	font-size: 12px; 
}

/* 文件详情抽屉样式 */
:deep(.picker-detail-drawer .el-drawer__body) {
	padding: 0;
	background: var(--el-bg-color-page);
}

.picker-detail-content {
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 0;
}

/* 文件预览区域 */
.picker-preview-section {
	background: #fff;
	padding: 20px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.picker-preview-container {
	width: 100%;
	max-width: 280px;
	margin: 0 auto 16px;
	aspect-ratio: 1 / 1;
	border-radius: 8px;
	overflow: hidden;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
	display: flex;
	align-items: center;
	justify-content: center;
}

.picker-preview-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.picker-preview-placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	color: var(--el-text-color-regular);
}

.picker-extension-large {
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-secondary);
}

.picker-basic-info {
	text-align: center;
}

.picker-file-title {
	font-size: 16px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	margin: 0 0 12px 0;
	word-break: break-all;
	line-height: 1.4;
}

.picker-meta-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.picker-meta-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 8px 12px;
	background: var(--el-bg-color-page);
	border-radius: 6px;
	border: 1px solid var(--el-border-color-lighter);
}

.picker-meta-label {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

.picker-meta-value {
	font-size: 13px;
	font-weight: 500;
	color: var(--el-text-color-primary);
	text-align: right;
	word-break: break-all;
}

/* 各个功能区域 */
.picker-tags-section,
.picker-url-section,
.picker-references-section {
	background: #fff;
	padding: 16px 20px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.picker-section-title {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 14px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	margin-bottom: 12px;
}

.picker-reference-badge {
	margin-left: 6px;
}

/* 标签管理区域 */
.picker-tags-input-container {
	display: flex;
	gap: 8px;
	margin-bottom: 12px;
}

.picker-tags-input {
	flex: 1;
}

.picker-current-tags {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.picker-tags-label {
	font-size: 13px;
	color: var(--el-text-color-regular);
	font-weight: 500;
}

.picker-tags-container {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}

/* URL输入框 */
.picker-url-input {
	font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

:deep(.picker-url-input .el-input__inner) {
	font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
	font-size: 12px;
}

/* 引用列表 */
.picker-empty-references {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 24px;
	color: var(--el-text-color-secondary);
	text-align: center;
}

.picker-references-table {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 4px;
}

.picker-field-name {
	background: var(--el-fill-color-light);
	padding: 1px 4px;
	border-radius: 2px;
	font-size: 11px;
	font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
</style>


