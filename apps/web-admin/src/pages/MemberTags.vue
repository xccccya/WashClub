<template>
	<BasePage title="会员标签">
		<template #actions>
			<el-button type="primary" @click="openCreate">
				<el-icon style="vertical-align: middle; margin-right:4px;"><CirclePlus /></el-icon>
				<span style="vertical-align: middle;">新增标签</span>
			</el-button>
		</template>
		<el-table :data="tags" stripe style="width:100%" @row-dblclick="openDetail">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="标签名称" />
			<el-table-column prop="memberCount" label="绑定人数" width="120" />
			<el-table-column label="系统默认" width="120">
				<template #default="{ row }">
					<el-tag :type="row.isSystem ? 'info' : 'success'">{{ row.isSystem ? '是' : '否' }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="220" fixed="right">
				<template #default="{ row }">
					<el-button size="small" :disabled="row.isSystem" @click="openEdit(row)">
						<el-icon><Edit /></el-icon>
						<span>编辑</span>
					</el-button>
					<el-button size="small" type="danger" :disabled="row.isSystem" @click="remove(row)">
						<el-icon><Delete /></el-icon>
						<span>删除</span>
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="detailVisible" :title="detailTitle" width="700px">
			<div style="margin-bottom:8px;display:flex;gap:8px;align-items:center;">
				<el-input v-model="detailKeyword" placeholder="搜索姓名/手机号" style="width:240px;" />
				<el-button @click="fetchDetail"><el-icon style="vertical-align: middle; margin-right:4px;"><Search /></el-icon><span style="vertical-align: middle;">搜索</span></el-button>
			</div>
			<el-table :data="detailList" stripe style="width:100%">
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column prop="name" label="昵称" />
				<el-table-column prop="phone" label="手机号" width="160" show-overflow-tooltip>
					<template #default="{ row }"><span style="white-space:nowrap;">{{ row.phone }}</span></template>
				</el-table-column>
				<el-table-column label="等级" width="160">
					<template #default="{ row }">{{ row.level?.name || '-' }}</template>
				</el-table-column>
				<el-table-column label="分类" width="160">
					<template #default="{ row }">{{ row.category?.name || '-' }}</template>
				</el-table-column>
				<el-table-column prop="createdAt" label="注册时间" width="180">
					<template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
				</el-table-column>
			</el-table>
			<div style="margin-top:12px;display:flex;justify-content:flex-end;">
				<el-pagination background layout="prev, pager, next" :total="detailTotal" :page-size="detailPageSize" :current-page="detailPage" @current-change="onDetailPageChange" />
			</div>
			<template #footer>
				<el-button @click="detailVisible=false">关闭</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑标签' : '新增标签'" width="420px">
			<el-form :model="form" label-width="120px">
				<el-form-item label="标签名称"><el-input v-model="form.name" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" @click="onSave">保存</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import { ElIcon } from 'element-plus';
import { CirclePlus, Edit, Delete, Search } from '@element-plus/icons-vue';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Tag = { id: number; name: string; isSystem: boolean; memberCount?: number };
const tags = ref<Tag[]>([]);
const dialogVisible = ref(false);
const current = ref<Tag | null>(null);
const form = ref<Partial<Tag>>({ name: '' });

async function fetchTags(){ tags.value = await http<Tag[]>('/member-tag', { method: 'GET' }); }

function openCreate(){ current.value = null; form.value = { name: '' }; dialogVisible.value = true; }
function openEdit(row: Tag){ if (row.isSystem) { ElMessage.error('系统默认标签不可编辑'); return; } current.value = row; form.value = { ...row }; dialogVisible.value = true; }

async function onSave(){
	try{
		if (current.value?.id) await http(`/member-tag/${current.value.id}`, { method: 'PUT', body: form.value });
		else await http('/member-tag', { method: 'POST', body: form.value });
		dialogVisible.value = false; ElMessage.success('已保存'); fetchTags();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function remove(row: Tag){ if (row.isSystem) { ElMessage.error('系统默认标签不可删除'); return; } try { await http(`/member-tag/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchTags(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

// 查看详情（双击标签名称列）
async function openDetail(row: Tag){
	if (!row?.id) return;
	detailTitle.value = `标签：${row.name}`;
	detailTagId.value = row.id;
	detailPage.value = 1;
	await fetchDetail();
	detailVisible.value = true;
}

async function fetchDetail(){
	const res = await http<{ items: Array<{ id:number; name:string; phone:string; createdAt:string; level?: { id:number; name:string }; category?: { id:number; name:string } }>; total: number }>(
		`/member-tag/${detailTagId.value}/members`, { method: 'GET', query: { page: detailPage.value, pageSize: detailPageSize.value, keyword: detailKeyword.value } }
	);
	detailList.value = res.items || [];
	detailTotal.value = res.total || 0;
}

function onDetailPageChange(p: number){ detailPage.value = p; fetchDetail(); }

const detailVisible = ref(false);
const detailTitle = ref('标签详情');
const detailTagId = ref<number | null>(null);
const detailKeyword = ref('');
const detailList = ref<any[]>([]);
const detailPage = ref(1);
const detailPageSize = ref(10);
const detailTotal = ref(0);

onMounted(fetchTags);

function formatDateTime(input?: string){
	if (!input) return '';
	try {
		const d = new Date(input);
		if (isNaN(d.getTime())) return input as any;
		const y = d.getFullYear();
		const m = String(d.getMonth()+1).padStart(2,'0');
		const day = String(d.getDate()).padStart(2,'0');
		const hh = String(d.getHours()).padStart(2,'0');
		const mm = String(d.getMinutes()).padStart(2,'0');
		const ss = String(d.getSeconds()).padStart(2,'0');
		return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
	} catch { return String(input||''); }
}
</script>



