<template>
	<BasePage title="文件管理">
		<template #actions>
			<!-- 主要操作区域 -->
			<div class="file-actions-container">
				<div class="file-actions-primary">
					<el-upload :http-request="upload" :show-file-list="false">
						<el-button type="primary" size="default">
							<el-icon><UploadFilled /></el-icon>
							上传文件
						</el-button>
					</el-upload>
				</div>

				<!-- 搜索和筛选区域 -->
				<div class="file-actions-filters">
					<el-input 
						v-model="keyword" 
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
					
					<el-select v-model="mimeFilter" placeholder="文件类型" clearable class="filter-select" @change="onFilterChanged">
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
						@change="onFilterChanged"
					>
						<el-option v-for="t in allTags" :key="t" :label="t" :value="t">
							<el-tag size="small" style="margin-right: 4px;">{{ t }}</el-tag>
						</el-option>
					</el-select>

					<el-button v-if="hasFilters" class="reset-btn" @click="resetFilters">
						<el-icon><RefreshLeft /></el-icon>
						重置
					</el-button>
				</div>

				<!-- 视图控制区域 -->
				<div class="file-actions-view">
					<el-tooltip content="刷新列表" placement="bottom">
						<el-button @click="fetchList" circle>
							<el-icon><Refresh /></el-icon>
						</el-button>
					</el-tooltip>

					<el-button-group>
						<el-button :type="viewMode==='grid' ? 'primary' : ''" @click="setViewMode('grid')">
							<el-icon><Grid /></el-icon>
							网格
						</el-button>
						<el-button :type="viewMode==='table' ? 'primary' : ''" @click="setViewMode('table')">
							<el-icon><List /></el-icon>
							表格
						</el-button>
					</el-button-group>
					
					<el-select v-model="thumbSize" class="thumb-size-select" v-if="viewMode==='grid'">
						<el-option :value="120" label="小图">
							<span style="font-size: 12px;">120px</span>
						</el-option>
						<el-option :value="240" label="中图">
							<span style="font-size: 14px;">240px</span>
						</el-option>
						<el-option :value="480" label="大图">
							<span style="font-size: 16px;">480px</span>
						</el-option>
					</el-select>
				</div>
			</div>

			<!-- 当前筛选条件（可视化，便于快速清理） -->
			<div v-if="hasFilters" class="active-filters">
				<div class="active-filters__label">当前筛选：</div>
				<div class="active-filters__tags">
					<el-tag v-if="keyword" closable @close="keyword=''; fetchList()" type="info">
						关键词：{{ keyword }}
					</el-tag>
					<el-tag v-if="mimeFilter" closable @close="mimeFilter=''; onFilterChanged()" type="info">
						类型：{{ mimeFilterLabel }}
					</el-tag>
					<el-tag
						v-for="t in tagFilters"
						:key="t"
						closable
						@close="removeTagFilter(t)"
						type="info"
					>
						标签：{{ t }}
					</el-tag>
				</div>
			</div>
		</template>

		<!-- BasePage 内容区默认 overflow:hidden，这里提供可滚动容器 -->
		<div class="files-scroll">
		<!-- 选择控制栏 -->
		<div class="file-selection-bar" v-if="files.length > 0">
			<div class="selection-info">
				<el-checkbox 
					:model-value="isAllSelected" 
					:indeterminate="isIndeterminate" 
					@change="toggleSelectAll"
				>
					{{ selected.size > 0 ? `已选择 ${selected.size} 项` : '全选' }}
				</el-checkbox>
				<span class="total-info">共 {{ total }} 个文件</span>
			</div>
			
			<div class="selection-actions" v-if="selected.size > 0">
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
				<el-button size="small" @click="preheat">
					<el-icon><Refresh /></el-icon>
					预热缩略图
				</el-button>
				<el-popconfirm title="确认清理所选文件的缩略图变体？" @confirm="cleanup">
					<template #reference>
						<el-button size="small" type="warning">
							<el-icon><Delete /></el-icon>
							清理变体
						</el-button>
					</template>
				</el-popconfirm>
				<el-popconfirm title="确认删除所选文件？此操作不可恢复！" @confirm="batchDelete">
					<template #reference>
						<el-button size="small" type="danger">
							<el-icon><Delete /></el-icon>
							批量删除
						</el-button>
					</template>
				</el-popconfirm>
			</div>
		</div>

		<!-- 内容区域（统一 loading overlay / 空态） -->
		<div class="files-content" v-loading="loading">
		<!-- 网格视图 -->
		<div v-if="viewMode==='grid'" class="files-grid" :style="{ '--thumb': thumbSize + 'px' }">
			<div 
				v-for="it in files" 
				:key="it.id" 
				class="file-card" 
				:class="{ 
					'selected': selected.has(it.id),
					'is-image': it.mimeType?.startsWith('image/'),
					'has-tags': (it as any).tagsJson?.length > 0
				}" 
				@click="toggleSel(it)" 
				@dblclick.stop="openDetail(it)"
			>
				<!-- 文件缩略图/图标 -->
				<div class="file-thumbnail">
					<img 
						v-if="it.mimeType && it.mimeType.startsWith('image/')" 
						:src="thumb(it)" 
						:alt="it.filename"
						@error="onImageError"
						loading="lazy"
					/>
					<div v-else class="file-icon">
						<el-icon size="32" v-if="it.mimeType?.startsWith('video/')"><VideoPlay /></el-icon>
						<el-icon size="32" v-else-if="it.mimeType?.startsWith('audio/')"><Headset /></el-icon>
						<el-icon size="32" v-else-if="it.mimeType?.includes('pdf')"><Document /></el-icon>
						<el-icon size="32" v-else><Folder /></el-icon>
						<div class="file-extension">{{ (it as any).extension?.toUpperCase() || 'FILE' }}</div>
					</div>
				</div>
				
				<!-- 文件信息 -->
				<div class="file-info">
					<div class="file-name" :title="it.filename">{{ it.filename }}</div>
					<div class="file-meta">
						<span class="file-size">{{ fmtSize(it.size) }}</span>
						<span class="file-date">{{ formatTime(it.createdAt) }}</span>
					</div>
					
					<!-- 标签显示 -->
					<div class="file-tags" v-if="(it as any).tagsJson?.length > 0">
						<el-tag 
							v-for="tag in (it as any).tagsJson.slice(0, 2)" 
							:key="tag" 
							size="small" 
							type="info"
						>
							{{ tag }}
						</el-tag>
						<el-tag 
							v-if="(it as any).tagsJson.length > 2" 
							size="small" 
							type="info"
						>
							+{{ (it as any).tagsJson.length - 2 }}
						</el-tag>
					</div>
				</div>
				
				<!-- 操作按钮 -->
				<div class="file-actions" @click.stop>
					<el-dropdown @command="(cmd:string)=>onCmd(cmd, it)" trigger="click" placement="bottom-end">
						<el-button size="small" text class="action-btn">
							<el-icon><MoreFilled /></el-icon>
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item command="copy-url">
									<el-icon><Link /></el-icon>
									复制直链
								</el-dropdown-item>
								<el-dropdown-item command="copy-md">
									<el-icon><Document /></el-icon>
									复制Markdown
								</el-dropdown-item>
								<el-dropdown-item command="copy-html">
									<el-icon><EditPen /></el-icon>
									复制HTML
								</el-dropdown-item>
								<el-dropdown-item divided command="delete" class="danger-item">
									<el-icon><Delete /></el-icon>
									删除文件
								</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
					
					<el-button size="small" text class="action-btn" @click.stop="openDetail(it)">
						<el-icon><View /></el-icon>
					</el-button>
				</div>
				
				<!-- 选中状态遮罩 -->
				<div class="selection-overlay" v-if="selected.has(it.id)">
					<el-icon size="24" class="check-icon"><Check /></el-icon>
				</div>
			</div>
		</div>
		<el-table
			v-else
			:data="files"
			stripe
			style="width:100%"
			class="files-table"
			@selection-change="onSel"
			@row-dblclick="(row:any)=>openDetail(row)"
		>
			<el-table-column type="selection" width="48" />
			<el-table-column label="预览" width="120">
				<template #default="{ row }">
					<div class="table-preview">
						<img v-if="row.mimeType && row.mimeType.startsWith('image/')" :src="thumb(row)" :alt="row.filename" />
						<el-icon v-else size="22" class="table-file-icon">
							<VideoPlay v-if="row.mimeType?.startsWith('video/')" />
							<Headset v-else-if="row.mimeType?.startsWith('audio/')" />
							<Document v-else-if="row.mimeType?.includes('pdf')" />
							<Folder v-else />
						</el-icon>
					</div>
				</template>
			</el-table-column>
			<el-table-column prop="filename" label="文件名" min-width="260">
				<template #default="{ row }">
					<div class="table-filename">
						<div class="table-filename__main" :title="row.filename">{{ row.filename }}</div>
						<div class="table-filename__tags" v-if="(row as any).tagsJson?.length > 0">
							<el-tag v-for="t in (row as any).tagsJson.slice(0, 2)" :key="t" size="small" type="info">{{ t }}</el-tag>
							<span v-if="(row as any).tagsJson.length > 2" class="table-filename__more">+{{ (row as any).tagsJson.length - 2 }}</span>
						</div>
					</div>
				</template>
			</el-table-column>
			<el-table-column prop="mimeType" label="类型" width="180" />
			<el-table-column prop="size" label="大小" width="120">
				<template #default="{ row }">{{ fmtSize(row.size) }}</template>
			</el-table-column>
			<el-table-column prop="createdAt" label="时间" width="180">
				<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column label="操作" width="220">
				<template #default="{ row }">
					<el-button text size="small" @click.stop="copy(absUrl(row.url))">
						<el-icon><Link /></el-icon>
						复制
					</el-button>
					<el-button text size="small" @click.stop="openDetail(row)">
						<el-icon><View /></el-icon>
						详情
					</el-button>
					<el-link class="table-open-link" :href="absUrl(row.url)" target="_blank" :underline="false" @click.stop>
						打开
					</el-link>
					<el-dropdown @command="(cmd:string)=>onCmd(cmd, row)" trigger="click">
						<el-button size="small">
							更多
							<el-icon class="el-icon--right"><MoreFilled /></el-icon>
						</el-button>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item command="copy-md">复制Markdown</el-dropdown-item>
								<el-dropdown-item command="copy-html">复制HTML</el-dropdown-item>
								<el-dropdown-item divided command="delete" style="color: var(--el-color-danger);">删除</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</template>
			</el-table-column>
		</el-table>

		<!-- 分页区域 -->
		<div class="files-pagination" v-if="files.length > 0">
			<div class="pagination-info">
				<span class="result-count">显示 {{ Math.min((page - 1) * pageSize + 1, total) }}-{{ Math.min(page * pageSize, total) }} 项，共 {{ total }} 项</span>
			</div>
			<el-pagination 
				background 
				layout="sizes, prev, pager, next, jumper" 
				:total="total" 
				:page-size="pageSize" 
				:current-page="page" 
				:page-sizes="[12, 18, 24, 36, 48]"
				@current-change="onPage" 
				@size-change="onPageSizeChange"
			/>
		</div>

		<!-- 空状态 -->
		<el-empty v-else-if="!loading" description="暂无文件" :image-size="120">
			<el-upload :http-request="upload" :show-file-list="false">
				<el-button type="primary">
					<el-icon><UploadFilled /></el-icon>
					上传第一个文件
				</el-button>
			</el-upload>
			<el-button v-if="hasFilters" style="margin-left: 8px;" @click="resetFilters">
				<el-icon><RefreshLeft /></el-icon>
				清空筛选
			</el-button>
		</el-empty>
		</div>
		</div>

		<el-drawer v-model="detailVisible" :title="current?.filename || '文件详情'" size="480px" class="file-detail-drawer">
			<div v-if="current" class="file-detail-content">
				<!-- 文件预览区域 -->
				<div class="file-preview-section">
					<div class="file-preview-container">
						<img 
							v-if="current.mimeType && current.mimeType.startsWith('image/')" 
							:src="absUrl(current.url)" 
							:alt="current.filename"
							class="file-preview-image"
							@error="onImageError"
						/>
						<div v-else class="file-preview-placeholder">
							<el-icon size="48" class="file-type-icon">
								<VideoPlay v-if="current.mimeType?.startsWith('video/')" />
								<Headset v-else-if="current.mimeType?.startsWith('audio/')" />
								<Document v-else-if="current.mimeType?.includes('pdf')" />
								<Folder v-else />
							</el-icon>
							<div class="file-extension-large">{{ (current as any).extension?.toUpperCase() || 'FILE' }}</div>
						</div>
					</div>
					
					<!-- 文件基本信息 -->
					<div class="file-basic-info">
						<h3 class="file-title" :title="current.filename">{{ current.filename }}</h3>
						<div class="file-meta-grid">
							<div class="meta-item">
								<span class="meta-label">文件类型</span>
								<span class="meta-value">{{ current.mimeType }}</span>
							</div>
							<div class="meta-item">
								<span class="meta-label">文件大小</span>
								<span class="meta-value">{{ fmtSize(current.size) }}</span>
							</div>
							<div class="meta-item">
								<span class="meta-label">创建时间</span>
								<span class="meta-value">{{ formatTime(current.createdAt) }}</span>
							</div>
							<div class="meta-item" v-if="(current as any).refCount !== undefined">
								<span class="meta-label">引用次数</span>
								<span class="meta-value">{{ (current as any).refCount || 0 }} 次</span>
							</div>
						</div>
					</div>
				</div>

				<!-- 操作区域 -->
				<div class="file-actions-section">
					<el-button type="primary" @click="copy(absUrl(current.url))" class="action-button">
						<el-icon><Link /></el-icon>
						<span class="button-text">复制链接</span>
					</el-button>
					<el-button @click="copyMd(current)" class="action-button">
						<el-icon><Document /></el-icon>
						<span class="button-text">Markdown</span>
					</el-button>
					<el-button @click="copyHtml(current)" class="action-button">
						<el-icon><EditPen /></el-icon>
						<span class="button-text">HTML</span>
					</el-button>
					<el-popconfirm title="确认删除此文件？此操作不可恢复！" @confirm="remove(current)">
						<template #reference>
							<el-button type="danger" class="action-button">
								<el-icon><Delete /></el-icon>
								<span class="button-text">删除</span>
							</el-button>
						</template>
					</el-popconfirm>
				</div>

				<!-- 标签管理 -->
				<div class="file-tags-section">
					<div class="section-title">
						<el-icon><PriceTag /></el-icon>
						标签管理
					</div>
					<div class="tags-input-container">
						<el-select 
							v-model="tagsInput" 
							multiple 
							filterable 
							allow-create 
							default-first-option 
							placeholder="输入标签名称，回车创建新标签" 
							class="tags-input"
							size="large"
						>
							<el-option v-for="t in allTags" :key="t" :label="t" :value="t">
								<el-tag size="small" type="info">{{ t }}</el-tag>
							</el-option>
						</el-select>
						<el-button 
							type="primary" 
							@click="saveTags(false)" 
							:loading="savingTags"
							size="large"
						>
							<el-icon><Check /></el-icon>
							保存标签
						</el-button>
					</div>
					
					<!-- 当前标签显示 -->
					<div class="current-tags" v-if="(current as any).tagsJson?.length > 0">
						<div class="tags-label">当前标签：</div>
						<div class="tags-container">
							<el-tag 
								v-for="tag in (current as any).tagsJson" 
								:key="tag" 
								type="info" 
								closable
								@close="removeTag(tag)"
							>
								{{ tag }}
							</el-tag>
						</div>
					</div>
				</div>

				<!-- 链接信息 -->
				<div class="file-url-section">
					<div class="section-title">
						<el-icon><Link /></el-icon>
						访问链接
					</div>
					<el-input 
						:model-value="absUrl(current.url)" 
						readonly 
						class="url-input"
					>
						<template #append>
							<el-button @click="copy(absUrl(current.url))">
								<el-icon><DocumentCopy /></el-icon>
							</el-button>
						</template>
					</el-input>
				</div>

				<!-- 引用列表 -->
				<div class="file-references-section">
					<div class="section-title">
						<el-icon><Connection /></el-icon>
						引用列表
						<el-badge :value="refs.length" class="reference-badge" v-if="refs.length > 0" />
					</div>
					<div v-if="!refs.length" class="empty-references">
						<el-icon size="32"><FolderOpened /></el-icon>
						<span>暂无引用此文件的记录</span>
					</div>
					<el-table v-else :data="refs" size="small" class="references-table">
						<el-table-column prop="tableName" label="数据表" width="120">
							<template #default="{ row }">
								<el-tag size="small" type="success">{{ row.tableName }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="fieldName" label="字段名" width="100">
							<template #default="{ row }">
								<code class="field-name">{{ row.fieldName }}</code>
							</template>
						</el-table-column>
						<el-table-column prop="rowId" label="记录ID" min-width="100">
							<template #default="{ row }">
								<el-link type="primary" :underline="false">{{ row.rowId }}</el-link>
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
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { BasePage } from '@wash/shared-ui';
import {
	assetControllerBulkThumbs,
	assetControllerCleanup,
	assetControllerList,
	assetControllerListRef,
	assetControllerRemove,
	assetControllerUpdate,
} from '@wash/api-client';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import { ElMessage } from 'element-plus';
import { 
	UploadFilled, Grid, Refresh, Delete, Search, Picture, VideoPlay, 
	Headset, Document, List, Select, Close, PriceTag, MoreFilled, 
	Link, EditPen, View, Check, Folder, DocumentCopy, Connection,
	FolderOpened, RefreshLeft
} from '@element-plus/icons-vue';

type FileItem = { 
	id: string; 
	filename: string; 
	extension?: string | null;
	url: string; 
	size: number; 
	mimeType: string; 
	createdAt: string;
	tagsJson?: string[] | null;
	refCount?: number;
};
const files = ref<FileItem[]>([]);
const selected = ref<Set<string>>(new Set());
const keyword = ref('');
const mimeFilter = ref('');
const tagFilters = ref<string[]>([]);
const allTags = ref<string[]>([]);
const viewMode = ref<'grid'|'table'>('grid');
const thumbSize = ref(240);
const page = ref(1);
const pageSize = ref(18);
const total = ref(0);
const loading = ref(false);

// 全选相关计算属性
const isAllSelected = computed(() => files.value.length > 0 && selected.value.size === files.value.length);
const isIndeterminate = computed(() => selected.value.size > 0 && selected.value.size < files.value.length);

const detailVisible = ref(false);
const current = ref<any>(null);
const tagsDraft = ref('');
const tagsInput = ref<string[]>([]);
const savingTags = ref(false);
const batchTagVisible = ref(false);
const refs = ref<any[]>([]);

const hasFilters = computed(() => !!keyword.value || !!mimeFilter.value || tagFilters.value.length > 0);
const mimeFilterLabel = computed(() => {
	if (!mimeFilter.value) return '';
	if (mimeFilter.value === 'image/') return '图片';
	if (mimeFilter.value === 'video/') return '视频';
	if (mimeFilter.value === 'audio/') return '音频';
	if (mimeFilter.value === 'pdf') return 'PDF';
	return mimeFilter.value;
});

function formatTime(dateInput: string | number){ 
	const d = new Date(dateInput); 
	if (isNaN(d.getTime())) return '无效日期';
	return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; 
}

async function fetchList(){ 
	try {
		loading.value = true;
		// 注意：返回体类型在 openapi 中可能仍不完整，这里按实际后端返回（对象含 items/total）使用
		const res:any = (await assetControllerList({
			page: page.value,
			pageSize: pageSize.value,
			q: keyword.value || undefined,
			mimeType: mimeFilter.value || undefined,
			tags: tagFilters.value.length ? tagFilters.value : undefined,
		} as any) as unknown) as any;
		files.value = Array.isArray(res?.items)? res.items : []; 
		total.value = Number(res?.total||0); 
		buildTags(files.value); 
	} catch (e:any) {
		ElMessage.error(`加载文件列表失败: ${e?.message || e || '未知错误'}`);
		files.value = [];
		total.value = 0;
	} finally {
		loading.value = false;
	}
}

function buildTags(list: any[]) {
	const set = new Set<string>();
	for (const it of list) {
		const tags = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson : [];
		for (const t of tags) {
			if (t && typeof t === 'string') set.add(t);
		}
	}
	allTags.value = Array.from(new Set([...allTags.value, ...Array.from(set)])).sort();
}
async function upload(options:any){ 
	try {
		const file = options?.file as File; 
		if (!file) {
			ElMessage.error('未选择文件');
			return;
		}
		const fd = new FormData(); 
		fd.append('file', file); 
		fd.append('dir','admin');
		// 使用admin目录自动识别为文件管理 
		const res = await fetch(`${API_BASE}/assets/upload`, { 
			method:'POST', 
			body: fd, 
			headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } 
		}); 
		const j = await res.json(); 
		if (res.ok && j?.id) { 
			ElMessage.success('上传成功'); 
			await fetchList(); 
		} else { 
			ElMessage.error(j?.message||'上传失败'); 
		} 
	} catch (e:any) {
		ElMessage.error(`上传失败: ${e?.message || e || '网络错误'}`);
	}
}
async function remove(row: FileItem) {
	try {
		await assetControllerRemove(String(row.id));
		ElMessage.success('已删除');
		fetchList();
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '删除失败'));
	}
}
function onSel(rows: FileItem[]){ selected.value = new Set(rows.map(r=>r.id)); }
async function preheat(){ 
	if (selected.value.size===0) return; 
	try {
		await assetControllerBulkThumbs({ ids: Array.from(selected.value), sizes: [120,240,480] } as any);
		ElMessage.success('已预热'); 
	} catch (e:any) {
		ElMessage.error(`预热失败: ${e?.message || e || '未知错误'}`);
	}
}
async function cleanup(){ 
	if (selected.value.size===0) return; 
	try {
		await assetControllerCleanup({ ids: Array.from(selected.value) } as any);
		ElMessage.success('已清理变体'); 
	} catch (e:any) {
		ElMessage.error(`清理失败: ${e?.message || e || '未知错误'}`);
	}
}

function toggleSel(it: FileItem) {
	if (selected.value.has(it.id)) selected.value.delete(it.id);
	else selected.value.add(it.id);
}
function fmtSize(n:number){
	if (n < 1024) return `${n}B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(1)}GB`;
}
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

function removeTagFilter(t: string) {
	tagFilters.value = tagFilters.value.filter(x => x !== t);
	onFilterChanged();
}

function resetFilters() {
	keyword.value = '';
	mimeFilter.value = '';
	tagFilters.value = [];
	page.value = 1;
	fetchList();
}

function openDetail(it:any){ current.value = it; tagsDraft.value = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson.join(',') : ''; detailVisible.value = true; refreshRefs(); }
// 初始化选择器
watch(detailVisible, (v)=>{ if (v && current.value) { tagsInput.value = Array.isArray((current.value as any).tagsJson) ? (current.value as any).tagsJson : []; } });
async function refreshRefs(){
	if (!current.value) { refs.value = []; return; }
	try{
		refs.value = (await assetControllerListRef(String(current.value.id)) as unknown) as any[];
	} catch {
		refs.value = [];
	}
}
function openBatchTag(){ tagsDraft.value=''; batchTagVisible.value = true; }
async function saveTags(isBatch=false){
	try{
		savingTags.value = true;
		const tags = (tagsInput.value && tagsInput.value.length) ? tagsInput.value : tagsDraft.value.split(',').map(s=>s.trim()).filter(Boolean);
		if (isBatch) {
			for (const id of selected.value){
				await assetControllerUpdate(String(id), { tags } as any);
			}
			batchTagVisible.value=false;
		} else if (current.value) {
			await assetControllerUpdate(String(current.value.id), { tags } as any);
			detailVisible.value=false;
		}
		await fetchList();
	} finally { savingTags.value=false; }
}
async function batchDelete(){
	for (const id of selected.value){
		try{ await assetControllerRemove(String(id)); } catch(e:any){ /* ignore single error */ }
	}
	selected.value.clear();
	await fetchList();
}

// 全选相关功能
function toggleSelectAll() {
	if (isAllSelected.value) {
		clearSelection();
	} else {
		selectAll();
	}
}

function selectAll() {
	selected.value = new Set(files.value.map(f => f.id));
	ElMessage.success(`已选择 ${files.value.length} 个文件`);
}

function clearSelection() {
	selected.value.clear();
}

// 视图切换
function setViewMode(mode: 'grid' | 'table') {
	viewMode.value = mode;
}

// 分页大小变化
function onPageSizeChange(size: number) {
	pageSize.value = size;
	page.value = 1;
	fetchList();
}

// 图片加载错误处理
function onImageError(event: Event) {
	const img = event.target as HTMLImageElement;
	img.style.display = 'none';
}

// 移除单个标签
function removeTag(tagToRemove: string) {
	if (current.value && (current.value as any).tagsJson) {
		const updatedTags = ((current.value as any).tagsJson as string[]).filter(tag => tag !== tagToRemove);
		tagsInput.value = updatedTags;
		saveTags(false);
	}
}

onMounted(async ()=>{ await fetchList(); await fetchAllTags(); });

// 加载所有标签（分页扫描，避免依赖单页）
async function fetchAllTags(){
	try {
		const seen = new Set<string>();
		let p = 1;
		const ps = 100;
		while(true){
			const r:any = (await assetControllerList({ page: p, pageSize: ps } as any) as unknown) as any;
			const items:any[] = Array.isArray(r?.items)? r.items : [];
			for(const it of items){
				const tags = Array.isArray((it as any).tagsJson) ? (it as any).tagsJson : [];
				for(const t of tags){ if (t && typeof t === 'string') seen.add(t); }
			}
			const tot = Number(r?.total||0);
			if (p*ps >= tot || items.length===0) break;
			p++;
			if (p>50) break;
		}
		allTags.value = Array.from(seen).sort();
	} catch { /* ignore */ }
}
</script>

<style scoped>
/* 操作栏布局 */
.file-actions-container {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	align-items: center;
	padding: 16px 0;
	border-bottom: 1px solid var(--el-border-color-lighter);
	margin-bottom: 16px;
}

.file-actions-primary {
	flex-shrink: 0;
}

.file-actions-filters {
	display: flex;
	flex: 1;
	gap: 12px;
	align-items: center;
	min-width: 0;
}

.search-input {
	width: 240px;
	flex-shrink: 0;
}

.filter-select {
	width: 140px;
	flex-shrink: 0;
}

.tags-select {
	width: 200px;
	flex-shrink: 0;
}

.file-actions-view {
	display: flex;
	gap: 12px;
	align-items: center;
	flex-shrink: 0;
}

.thumb-size-select {
	width: 100px;
}

/* 当前筛选条件 */
.active-filters {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 0 0 14px;
	margin-top: -8px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	margin-bottom: 16px;
}
.active-filters__label {
	color: var(--el-text-color-secondary);
	font-size: 13px;
	white-space: nowrap;
}
.active-filters__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	min-width: 0;
}

.reset-btn {
	flex-shrink: 0;
}

/* BasePage 内容区默认 overflow:hidden，滚动由页面自行接管 */
.files-scroll {
	height: 100%;
	min-height: 0;
	overflow: auto;
	padding-right: 2px; /* 给滚动条留一点呼吸 */
}

/* 内容区域：统一 loading overlay */
.files-content {
	min-height: 200px;
}

/* 选择控制栏 */
.file-selection-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 16px;
	background: var(--el-bg-color-page);
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
	margin-bottom: 16px;
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
	gap: 8px;
}

/* 网格布局 */
.files-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(var(--thumb, 240px), 1fr));
	gap: 16px;
	padding: 4px;
}

/* 文件卡片 */
.file-card {
	position: relative;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	overflow: hidden;
	cursor: pointer;
	background: var(--el-bg-color);
	transition: all 0.3s ease;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.file-card:hover {
	border-color: var(--el-color-primary-light-7);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	transform: translateY(-2px);
}

.file-card.selected {
	border-color: var(--el-color-primary);
	box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.file-card.is-image .file-thumbnail {
	background: var(--el-bg-color);
}


/* 缩略图区域 */
.file-thumbnail {
	width: 100%;
	aspect-ratio: 1 / 1;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--el-fill-color-lighter);
	position: relative;
	overflow: hidden;
}

.file-thumbnail img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transition: transform 0.3s ease;
}

.file-card:hover .file-thumbnail img {
	transform: scale(1.05);
}

/* 文件图标 */
.file-icon {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	color: var(--el-text-color-regular);
}

.file-extension {
	font-size: 12px;
	font-weight: 500;
	color: var(--el-text-color-secondary);
}

/* 文件信息 */
.file-info {
	padding: 12px;
	flex: 1;
}

.file-name {
	font-size: 14px;
	font-weight: 500;
	color: var(--el-text-color-primary);
	margin-bottom: 6px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.file-meta {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8px;
}

.file-size,
.file-date {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}

/* 标签 */
.file-tags {
	display: flex;
	gap: 4px;
	flex-wrap: wrap;
	margin-top: 6px;
}

/* 操作按钮 */
.file-actions {
	position: absolute;
	top: 8px;
	right: 8px;
	display: flex;
	gap: 4px;
	opacity: 0;
	transition: opacity 0.3s ease;
}

.file-card:hover .file-actions {
	opacity: 1;
}

.action-btn {
	background: color-mix(in oklab, var(--el-bg-color), transparent 10%) !important;
	backdrop-filter: blur(4px);
	border: 1px solid var(--el-border-color-lighter) !important;
	width: 28px;
	height: 28px;
	padding: 0;
}

/* 选中状态遮罩 */
.selection-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(64, 158, 255, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}

.check-icon {
	color: var(--el-color-primary);
	background: var(--el-bg-color);
	border-radius: 50%;
	padding: 4px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 分页区域 */
.files-pagination {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 24px;
	padding-top: 16px;
	border-top: 1px solid var(--el-border-color-lighter);
}

.pagination-info {
	color: var(--el-text-color-regular);
	font-size: 14px;
}

/* 下拉菜单样式 */
:deep(.el-dropdown-menu__item.danger-item) {
	color: var(--el-color-danger);
}

:deep(.el-dropdown-menu__item.danger-item:hover) {
	background-color: var(--el-color-danger-light-9);
	color: var(--el-color-danger);
}

/* 响应式设计 */
@media (max-width: 768px) {
	.file-actions-container {
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
	}
	
	.file-actions-filters {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
	}
	
	.search-input,
	.filter-select,
	.tags-select {
		width: 100%;
	}
	
	.file-selection-bar {
		flex-direction: column;
		align-items: stretch;
		gap: 12px;
	}
	
	.selection-actions {
		justify-content: center;
		flex-wrap: wrap;
	}
	
	.files-pagination {
		flex-direction: column;
		gap: 12px;
		text-align: center;
	}
}

/* 表格视图 */
.files-table .table-preview {
	width: 72px;
	height: 54px;
	border-radius: 8px;
	overflow: hidden;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
	display: flex;
	align-items: center;
	justify-content: center;
}
.files-table .table-preview img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.files-table .table-file-icon {
	color: var(--el-text-color-secondary);
}
.table-filename {
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-width: 0;
}
.table-filename__main {
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.table-filename__tags {
	display: flex;
	gap: 6px;
	flex-wrap: wrap;
}
.table-filename__more {
	font-size: 12px;
	color: var(--el-text-color-secondary);
}
.table-open-link {
	margin: 0 8px;
	font-size: 12px;
	vertical-align: middle;
}

/* 保留原有样式的兼容 */
.muted { 
	color: var(--el-text-color-secondary); 
	font-size: 12px; 
}

/* 文件详情抽屉样式 */
:deep(.file-detail-drawer .el-drawer__body) {
	padding: 0;
	background: var(--el-bg-color-page);
}

.file-detail-content {
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 0;
}

/* 文件预览区域 */
.file-preview-section {
	background: var(--el-bg-color);
	padding: 24px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.file-preview-container {
	width: 100%;
	max-width: 320px;
	margin: 0 auto 20px;
	aspect-ratio: 1 / 1;
	border-radius: 12px;
	overflow: hidden;
	border: 1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
	display: flex;
	align-items: center;
	justify-content: center;
}

.file-preview-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.file-preview-placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	color: var(--el-text-color-regular);
}

.file-extension-large {
	font-size: 16px;
	font-weight: 600;
	color: var(--el-text-color-secondary);
}

.file-basic-info {
	text-align: center;
}

.file-title {
	font-size: 18px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	margin: 0 0 16px 0;
	word-break: break-all;
	line-height: 1.4;
}

.file-meta-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.meta-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12px;
	background: var(--el-bg-color-page);
	border-radius: 8px;
	border: 1px solid var(--el-border-color-lighter);
}

.meta-label {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	margin-bottom: 4px;
}

.meta-value {
	font-size: 14px;
	font-weight: 500;
	color: var(--el-text-color-primary);
	text-align: center;
	word-break: break-all;
}

/* 操作区域 */
.file-actions-section {
	background: var(--el-bg-color);
	padding: 20px 24px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
	gap: 12px;
}

.action-button {
	display: flex !important;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-width: 100px;
	white-space: nowrap;
}

.button-text {
	font-size: 14px;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* 各个功能区域 */
.file-tags-section,
.file-url-section,
.file-references-section {
	background: var(--el-bg-color);
	padding: 20px 24px;
	border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-title {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 16px;
	font-weight: 600;
	color: var(--el-text-color-primary);
	margin-bottom: 16px;
	position: relative;
}

.reference-badge {
	margin-left: 8px;
}

/* 标签管理区域 */
.tags-input-container {
	display: flex;
	gap: 12px;
	margin-bottom: 16px;
}

.tags-input {
	flex: 1;
}

.current-tags {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.tags-label {
	font-size: 14px;
	color: var(--el-text-color-regular);
	font-weight: 500;
}

.tags-container {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
}

/* URL输入框 */
.url-input {
	font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

:deep(.url-input .el-input__inner) {
	font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
	font-size: 13px;
}

/* 引用列表 */
.empty-references {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 32px;
	color: var(--el-text-color-secondary);
	text-align: center;
}

.references-table {
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 6px;
}

.field-name {
	background: var(--el-fill-color-light);
	padding: 2px 6px;
	border-radius: 3px;
	font-size: 12px;
	font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* 响应式设计 */
@media (max-width: 768px) {
	.file-meta-grid {
		grid-template-columns: 1fr;
	}
	
	.file-actions-section {
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}
	
	.tags-input-container {
		flex-direction: column;
	}
}
</style>
