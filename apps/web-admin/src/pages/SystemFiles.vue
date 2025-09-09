<template>
	<BasePage title="文件管理">
		<template #actions>
			<el-upload :http-request="upload" :show-file-list="false">
				<el-button type="primary">
					<el-icon style="vertical-align: middle; margin-right:4px;"><UploadFilled /></el-icon>
					<span style="vertical-align: middle;">上传文件</span>
				</el-button>
			</el-upload>
			<el-input v-model="keyword" placeholder="搜索文件名" style="width:220px;margin-left:8px;" @keyup.enter="fetchList" />
			<el-select v-model="mimeFilter" placeholder="类型" clearable style="width:160px;margin-left:8px;">
				<el-option label="图片" value="image/" />
				<el-option label="视频" value="video/" />
				<el-option label="音频" value="audio/" />
				<el-option label="PDF" value="pdf" />
			</el-select>
			<el-select v-model="tagFilters" placeholder="标签(可多选)" clearable filterable multiple style="width:220px;margin-left:8px;" @change="onFilterChanged">
				<el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
			</el-select>
			<el-button text @click="toggleView">
				<el-icon style="vertical-align: middle; margin-right:4px;"><Grid /></el-icon>
				<span style="vertical-align: middle;">{{ viewMode==='grid' ? '表格视图' : '网格视图' }}</span>
			</el-button>
			<el-select v-model="thumbSize" style="width:120px;">
				<el-option :value="120" label="小(120)" />
				<el-option :value="240" label="中(240)" />
				<el-option :value="480" label="大(480)" />
			</el-select>
			<el-button :disabled="selected.size===0" @click="preheat">
				<el-icon style="vertical-align: middle; margin-right:4px;"><Refresh /></el-icon>
				<span style="vertical-align: middle;">预热缩略图</span>
			</el-button>
			<el-popconfirm title="确认清理所选变体？" @confirm="cleanup">
				<template #reference>
					<el-button :disabled="selected.size===0" type="warning">
						<el-icon style="vertical-align: middle; margin-right:4px;"><Delete /></el-icon>
						<span style="vertical-align: middle;">清理变体</span>
					</el-button>
				</template>
			</el-popconfirm>
		</template>

		<div v-if="viewMode==='grid'" class="grid" :style="{ '--thumb': thumbSize + 'px' }">
			<div v-for="it in files" :key="it.id" class="cell" :class="{ selected: selected.has(it.id) }" @click="toggleSel(it)" @dblclick.stop="openDetail(it)">
				<div class="thumb">
					<img v-if="it.mimeType && it.mimeType.startsWith('image/')" :src="thumb(it)" />
					<div v-else class="non-image">{{ (it as any).extension?.toUpperCase() || 'FILE' }}</div>
				</div>
				<div class="meta">
					<span class="name" :title="it.filename">{{ it.filename }}</span>
					<span class="size">{{ fmtSize(it.size) }}</span>
				</div>
				<el-checkbox class="check" :model-value="selected.has(it.id)" @click.stop @change="()=>toggleSel(it)" />
				<div class="ops">
					<el-dropdown @command="(cmd:string)=>onCmd(cmd, it)">
						<el-button size="small">操作</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item command="copy-url">复制直链</el-dropdown-item>
								<el-dropdown-item command="copy-md">复制Markdown</el-dropdown-item>
								<el-dropdown-item command="copy-html">复制HTML</el-dropdown-item>
								<el-dropdown-item divided command="delete" style="color: var(--el-color-danger);">删除</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</div>
			</div>
		</div>
		<el-table v-else :data="files" stripe style="width:100%" @selection-change="onSel" @row-dblclick="(row:any)=>openDetail(row)">
			<el-table-column type="selection" width="48" />
			<el-table-column label="预览" width="140">
				<template #default="{ row }"><img v-if="row.mimeType && row.mimeType.startsWith('image/')" :src="thumb(row)" style="width:80px;height:60px;object-fit:cover;border:1px solid #eee;border-radius:6px;" /></template>
			</el-table-column>
			<el-table-column prop="filename" label="文件名" />
			<el-table-column prop="mimeType" label="类型" width="180" />
			<el-table-column prop="size" label="大小(B)" width="120" />
			<el-table-column prop="createdAt" label="时间" width="180">
				<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column label="预览" width="120">
				<template #default="{ row }">
					<a :href="absUrl(row.url)" target="_blank">打开</a>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="160">
				<template #default="{ row }">
					<el-dropdown @command="(cmd:string)=>onCmd(cmd, row)">
						<el-button size="small">操作</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item command="copy-url">复制直链</el-dropdown-item>
								<el-dropdown-item command="copy-md">复制Markdown</el-dropdown-item>
								<el-dropdown-item command="copy-html">复制HTML</el-dropdown-item>
								<el-dropdown-item divided command="delete" style="color: var(--el-color-danger);">删除</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
			</el-table-column>
		</el-table>

		<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
			<div>共 {{ total }} 项</div>
			<div style="display:flex; gap:8px; align-items:center;">
				<el-button size="small" :disabled="selected.size===0" type="warning" @click="openBatchTag">打标签</el-button>
				<el-popconfirm title="确认删除所选？" @confirm="batchDelete">
					<template #reference><el-button size="small" :disabled="selected.size===0" type="danger">删除所选</el-button></template>
				</el-popconfirm>
				<el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPage" />
			</div>
		</div>

		<el-drawer v-model="detailVisible" title="文件详情" size="40%">
			<div v-if="current">
				<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
					<img v-if="current.mimeType && current.mimeType.startsWith('image/')" :src="absUrl(current.url)" style="width:120px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #eee;" />
					<div>
						<div><b>{{ current.filename }}</b></div>
						<div class="muted">{{ current.mimeType }} · {{ fmtSize(current.size) }}</div>
					</div>
				</div>
				<el-form label-width="80px">
					<el-form-item label="标签">
						<el-select v-model="tagsInput" multiple filterable allow-create default-first-option placeholder="输入后回车创建或选择标签" style="width:100%">
							<el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
						</el-select>
						<el-button style="margin-left:8px;" @click="saveTags(false)" :loading="savingTags">保存</el-button>
					</el-form-item>
					<el-form-item label="链接"><el-input :model-value="absUrl(current.url)" readonly /></el-form-item>
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
			<el-select v-model="tagsInput" multiple filterable allow-create default-first-option placeholder="输入后回车创建或选择标签" style="width:100%">
				<el-option v-for="t in allTags" :key="t" :label="t" :value="t" />
			</el-select>
			<template #footer>
				<el-button @click="batchTagVisible=false">取消</el-button>
				<el-button type="primary" @click="saveTags(true)" :loading="savingTags">保存</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import { ElMessage } from 'element-plus';
import { UploadFilled, Grid, Refresh, Delete } from '@element-plus/icons-vue';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type FileItem = { id: string; filename: string; url: string; size: number; mimeType: string; createdAt: string };
const files = ref<FileItem[]>([]);
const selected = ref<Set<string>>(new Set());
const keyword = ref('');
const mimeFilter = ref('');
const tagFilter = ref('');
const tagFilters = ref<string[]>([]);
const allTags = ref<string[]>([]);
const viewMode = ref<'grid'|'table'>('grid');
const thumbSize = ref(240);
const page = ref(1);
const pageSize = ref(18);
const total = ref(0);

const detailVisible = ref(false);
const current = ref<any>(null);
const tagsDraft = ref('');
const tagsInput = ref<string[]>([]);
const savingTags = ref(false);
const batchTagVisible = ref(false);
const refs = ref<any[]>([]);

function formatTime(ms: number){ const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

async function fetchList(){ const res:any = await http('/assets', { method:'GET', query: { page: page.value, pageSize: pageSize.value, q: keyword.value || undefined, mimeType: mimeFilter.value || undefined, tag: tagFilter.value || undefined, tags: tagFilters.value.length? tagFilters.value: undefined } }); files.value = Array.isArray(res?.items)? res.items : []; total.value = Number(res?.total||0); buildTags(files.value); }
function buildTags(list: any[]){ const set = new Set<string>(); for(const it of list){ const tags = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson : []; for(const t of tags){ if (t && typeof t === 'string') set.add(t); } } allTags.value = Array.from(new Set([...allTags.value, ...Array.from(set)])).sort(); }
async function upload(options:any){ const file = options?.file as File; const fd = new FormData(); fd.append('file', file); fd.append('dir','admin'); const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } }); const j = await res.json(); if (res.ok && j?.id) { ElMessage.success('上传成功'); fetchList(); } else { ElMessage.error(j?.message||'上传失败'); } }
async function remove(row: FileItem){ try { await http(`/assets/${row.id}`, { method:'DELETE' }); ElMessage.success('已删除'); fetchList(); } catch (e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }
function onSel(rows: FileItem[]){ selected.value = new Set(rows.map(r=>r.id)); }
async function preheat(){ if (selected.value.size===0) return; await http('/assets/thumbnails/bulk', { method:'POST', body:{ ids: Array.from(selected.value), sizes: [120,240,480] } }); ElMessage.success('已预热'); }
async function cleanup(){ if (selected.value.size===0) return; await http('/assets/thumbnails/cleanup', { method:'POST', body:{ ids: Array.from(selected.value) } }); ElMessage.success('已清理变体'); }
function toggleView(){ viewMode.value = viewMode.value==='grid' ? 'table' : 'grid'; }
function toggleSel(it: FileItem){ if (selected.value.has(it.id)) selected.value.delete(it.id); else selected.value.add(it.id); }
function fmtSize(n:number){ if(n<1024) return n+'B'; if(n<1024*1024) return (n/1024).toFixed(1)+'KB'; if(n<1024*1024*1024) return (n/1024/1024).toFixed(1)+'MB'; return (n/1024/1024/1024).toFixed(1)+'GB'; }
function thumb(it:any){ return `${API_BASE}/assets/${it?.id}/thumbnail?size=${thumbSize.value}`; }
function copy(text:string){ try{ navigator.clipboard?.writeText(text); ElMessage.success('已复制'); } catch {} }
function copyMd(it:any){ copy(`![${it.filename}](${absUrl(it.url)})`); }
function copyHtml(it:any){ copy(`<img src="${absUrl(it.url)}" alt="${it.filename}" />`); }

function onCmd(cmd: string, it: FileItem){
  if (cmd === 'copy-url') return copy(absUrl(it.url));
  if (cmd === 'copy-md') return copyMd(it);
  if (cmd === 'copy-html') return copyHtml(it);
  if (cmd === 'delete') return remove(it);
}

function onPage(p:number){ page.value = p; fetchList(); }

function onFilterChanged(){ page.value = 1; fetchList(); }

function openDetail(it:any){ current.value = it; tagsDraft.value = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson.join(',') : ''; detailVisible.value = true; refreshRefs(); }
// 初始化选择器
watch(detailVisible, (v)=>{ if (v && current.value) { tagsInput.value = Array.isArray((current.value as any).tagsJson) ? (current.value as any).tagsJson : []; } });
async function refreshRefs(){ if (!current.value) { refs.value = []; return; } try{ refs.value = await http(`/assets/${current.value.id}/references`, { method:'GET' }); } catch { refs.value = []; } }
function openBatchTag(){ tagsDraft.value=''; batchTagVisible.value = true; }
async function saveTags(isBatch=false){ try{ savingTags.value = true; const tags = (tagsInput.value && tagsInput.value.length) ? tagsInput.value : tagsDraft.value.split(',').map(s=>s.trim()).filter(Boolean); if (isBatch) { for (const id of selected.value){ await http(`/assets/${id}`, { method:'PATCH', body: { tags } }); } batchTagVisible.value=false; } else if (current.value) { await http(`/assets/${current.value.id}`, { method:'PATCH', body: { tags } }); detailVisible.value=false; } await fetchList(); } finally { savingTags.value=false; } }
async function batchDelete(){ for (const id of selected.value){ try{ await http(`/assets/${id}`, { method:'DELETE' }); } catch(e:any){ /* ignore single error */ } } selected.value.clear(); await fetchList(); }

onMounted(async ()=>{ await fetchList(); await fetchAllTags(); });

// 加载所有标签（分页扫描，避免依赖单页）
async function fetchAllTags(){ try { const seen = new Set<string>(); let p = 1; const ps = 100; while(true){ const r:any = await http('/assets', { method:'GET', query:{ page: p, pageSize: ps } }); const items:any[] = Array.isArray(r?.items)? r.items : []; for(const it of items){ const tags = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson : []; for(const t of tags){ if (t && typeof t === 'string') seen.add(t); } } const tot = Number(r?.total||0); if (p*ps >= tot || items.length===0) break; p++; if (p>50) break; } allTags.value = Array.from(seen).sort(); } catch { /* ignore */ } }
</script>

<style scoped>
.grid{ display:grid; grid-template-columns: repeat( auto-fill, minmax(var(--thumb, 240px), 1fr) ); gap: 12px; }
.cell{ position:relative; border:1px solid #eee; border-radius:10px; overflow:hidden; cursor:pointer; background:#fff; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.cell.selected{ outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.thumb{ width:100%; aspect-ratio: 1 / 1; display:flex; align-items:center; justify-content:center; background:#fafafa; }
.thumb img{ width:100%; height:100%; object-fit:cover; }
.non-image{ color:#666; font-size:12px; }
.meta{ padding:8px 10px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
.name{ max-width: 70%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.size{ color:#999; font-size:12px; }
.check{ position:absolute; right:6px; top:6px; }
.ops{ display:flex; gap:6px; padding:6px 8px 10px 8px; }
.muted{ color:#909399; font-size:12px; }
</style>
