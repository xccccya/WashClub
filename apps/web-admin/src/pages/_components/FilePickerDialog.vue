<template>
	<el-dialog v-model="visible" :title="title || '选择文件'" width="900px">
		<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
			<el-input v-model="search" placeholder="搜索文件名" style="width:260px;" @keyup.enter="fetchList" />
			<el-select v-model="mimeFilter" placeholder="类型" clearable style="width:160px;">
				<el-option label="图片" value="image/" />
				<el-option label="视频" value="video/" />
				<el-option label="音频" value="audio/" />
				<el-option label="PDF" value="pdf" />
			</el-select>
			<el-select v-model="tagFilter" placeholder="标签" clearable filterable style="width:160px;">
				<el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
			</el-select>
			<el-button @click="fetchList">搜索</el-button>
			<el-upload :http-request="upload" :show-file-list="false" multiple>
				<el-button type="primary">上传</el-button>
			</el-upload>
			<el-button text @click="toggleView">{{ viewMode==='grid' ? '表格视图' : '网格视图' }}</el-button>
			<el-select v-model="thumbSize" style="width:120px;">
				<el-option :value="120" label="小(120)" />
				<el-option :value="240" label="中(240)" />
				<el-option :value="480" label="大(480)" />
			</el-select>
			<el-button :disabled="selectedIds.size===0" @click="openBatchTag">打标签</el-button>
			<el-popconfirm title="确认删除所选？" @confirm="batchDelete">
				<template #reference><el-button type="danger" :disabled="selectedIds.size===0">删除所选</el-button></template>
			</el-popconfirm>
		</div>
		<div class="grid" v-if="viewMode==='grid'" :style="{ '--thumb': thumbSize + 'px' }">
			<div v-for="it in items" :key="it.id" class="cell" :class="{ selected: selectedIds.has(it.id) }" @click="toggle(it)" @dblclick.stop="openDetail(it)">
				<div class="thumb">
					<img v-if="isImage(it.mimeType)" :src="thumb(it)" alt="" />
					<div v-else class="non-image">{{ it.extension?.toUpperCase() || 'FILE' }}</div>
				</div>
				<div class="meta"><span class="name" :title="it.filename">{{ it.filename }}</span><span class="size">{{ fmtSize(it.size) }}</span></div>
				<el-checkbox class="check" :model-value="selectedIds.has(it.id)" @click.stop @change="()=>toggle(it)" />
			</div>
		</div>
		<el-table v-else :data="items" size="small" border style="width:100%;">
			<el-table-column prop="filename" label="文件名" />
			<el-table-column prop="mimeType" label="类型" width="160" />
			<el-table-column prop="size" label="大小" width="120"><template #default="{ row }">{{ fmtSize(row.size) }}</template></el-table-column>
			<el-table-column label="预览" width="140"><template #default="{ row }"><img v-if="isImage(row.mimeType)" :src="thumb(row)" style="width:80px;height:60px;object-fit:cover;border:1px solid #eee;border-radius:6px;" /></template></el-table-column>
			<el-table-column label="操作" width="260"><template #default="{ row }"><el-button size="small" @click.stop="copy(abs(row.url))">复制直链</el-button><el-button size="small" @click.stop="copyMd(row)">复制Markdown</el-button><el-button size="small" @click.stop="copyHtml(row)">复制HTML</el-button></template></el-table-column>
			<el-table-column width="60"><template #default="{ row }"><el-checkbox :model-value="selectedIds.has(row.id)" @change="()=>toggle(row)" /></template></el-table-column>
		</el-table>
		<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
			<div>共 {{ total }} 项</div>
			<el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPage" />
		</div>
		<template #footer>
			<el-button @click="visible=false">取消</el-button>
			<el-button type="primary" :disabled="selectedIds.size===0" @click="confirm">确定</el-button>
		</template>
		<el-drawer v-model="detailVisible" title="文件详情" size="40%">
			<div v-if="current">
				<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
					<img v-if="isImage(current.mimeType)" :src="abs(current.url)" style="width:120px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #eee;" />
					<div>
						<div><b>{{ current.filename }}</b></div>
						<div class="muted">{{ current.mimeType }} · {{ fmtSize(current.size) }}</div>
					</div>
				</div>
				<el-form label-width="80px">
					<el-form-item label="标签">
						<el-input v-model="tagsDraft" placeholder="逗号分隔" />
						<el-button style="margin-left:8px;" @click="saveTags" :loading="savingTags">保存</el-button>
					</el-form-item>
					<el-form-item label="链接"><el-input :model-value="abs(current.url)" readonly /></el-form-item>
				</el-form>
				<div style="margin-top:12px;">
					<b>引用列表</b>
					<div v-if="!refs.length" class="muted" style="margin-top:6px;">暂无引用</div>
					<el-table v-else :data="refs" size="small" style="width:100%;margin-top:6px;">
						<el-table-column prop="tableName" label="表" width="160" />
						<el-table-column prop="fieldName" label="字段" width="140" />
						<el-table-column prop="rowId" label="行ID" />
					</el-table>
				</div>
			</div>
		</el-drawer>
		<el-dialog v-model="batchTagVisible" title="批量打标签" width="420px">
			<el-input v-model="tagsDraft" placeholder="逗号分隔" />
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

type Asset = { id: string; url: string; filename: string; extension?: string|null; mimeType: string; size: number };

const props = defineProps<{ modelValue: boolean; multiple?: boolean; title?: string }>();
const emit = defineEmits<{ (e:'update:modelValue', v:boolean):void; (e:'picked', files: Asset[]):void }>();

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const visible = computed({ get:()=>props.modelValue, set:(v:boolean)=>emit('update:modelValue', v) });
const title = computed(()=>props.title);
const multiple = computed(()=>!!props.multiple);

const page = ref(1); const pageSize = ref(18); const total = ref(0);
const search = ref(''); const mimeFilter = ref('');
const tagFilter = ref('');
const items = ref<Asset[]>([]);
const viewMode = ref<'grid'|'table'>('grid');
const thumbSize = ref(240);
const selectedIds = ref<Set<string>>(new Set());
const allTags = ref<string[]>([]);

const detailVisible = ref(false);
const current = ref<any>(null);
const tagsDraft = ref('');
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
	const res:any = await http('/assets', { method:'GET', query: { page: page.value, pageSize: pageSize.value, mimeType: mimeFilter.value || undefined, q: search.value || undefined, tag: tagFilter.value || undefined } });
	items.value = Array.isArray(res?.items) ? res.items : [];
	total.value = Number(res?.total||0);
	const set = new Set<string>();
	for(const it of items.value){ const tags = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson : []; for(const t of tags){ if (t && typeof t === 'string') set.add(t); } }
	allTags.value = Array.from(set).sort();
}
function onPage(p:number){ page.value = p; fetchList(); }

function toggle(it: Asset){ const s = selectedIds.value; if (!multiple.value) { s.clear(); s.add(it.id); } else { if (s.has(it.id)) s.delete(it.id); else s.add(it.id); } }

async function upload(options:any){
	const file = options?.file as File; if (!file) return;
	const fd = new FormData(); fd.append('file', file); fd.append('dir', 'admin');
	const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` }, body: fd });
	const j = await res.json(); if (res.ok && j?.id) { await fetchList(); }
}

function confirm(){
	const byId = new Map(items.value.map(x=>[x.id, x] as const));
	const picked = Array.from(selectedIds.value).map(id=>byId.get(id)).filter(Boolean) as Asset[];
	emit('picked', picked);
	visible.value = false; selectedIds.value.clear();
}

function openDetail(it:any){ current.value = it; tagsDraft.value = ''; detailVisible.value = true; }
async function saveTags(isBatch = false){
	try{
		savingTags.value = true;
		const tags = tagsDraft.value.split(',').map(s=>s.trim()).filter(Boolean);
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
function openBatchTag(){ tagsDraft.value=''; batchTagVisible.value = true; }
async function batchDelete(){ for(const id of selectedIds.value){ await http(`/assets/${id}`, { method:'DELETE' }); } selectedIds.value.clear(); await fetchList(); }

// 引用列表
const refs = ref<any[]>([]);
watch(detailVisible, async (v)=>{
	if (v && current.value) {
		try { refs.value = await http(`/assets/${current.value.id}/references`, { method:'GET' }); } catch { refs.value = []; }
	}
});

watch(()=>props.modelValue, (v)=>{ if(v){ page.value=1; fetchList(); } else { selectedIds.value.clear(); } });
function toggleView(){ viewMode.value = viewMode.value==='grid' ? 'table' : 'grid'; }
</script>

<style scoped>
.grid{ display:grid; grid-template-columns: repeat( auto-fill, minmax(var(--thumb, 240px), 1fr) ); gap: 12px; }
.cell{ position:relative; border:1px solid #eee; border-radius:10px; overflow:hidden; cursor:pointer; background:#fff; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.cell.selected{ outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.thumb{ width:100%; aspect-ratio: 1 / 1; display:flex; align-items:center; justify-content:center; background:#fafafa; }
.thumb img{ width:100%; height:100%; object-fit:cover; }
.thumb .non-image{ color:#666; font-size:12px; }
.meta{ padding:8px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
.name{ max-width: 70%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.size{ color:#999; font-size:12px; }
.check{ position:absolute; right:6px; top:6px; }
.muted{ color:#909399; font-size:12px; }
</style>


