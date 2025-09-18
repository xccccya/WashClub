<template>
	<div>
		<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
			<el-button @click="load">刷新</el-button>
			<el-button @click="markAllRead">全部标记已读</el-button>
		</div>
		<el-table :data="list" style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="title" label="标题" />
			<el-table-column prop="content" label="内容" />
			<el-table-column prop="createdAt" label="时间" width="180" />
			<el-table-column prop="status" label="状态" width="100">
				<template #default="{ row }">
					<el-tag :type="row.status==='UNREAD'?'danger':'success'">{{ row.status==='UNREAD'?'未读':'已读' }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="120">
				<template #default="{ row }">
					<el-button size="small" @click="markRead(row)" :disabled="row.status!=='UNREAD'">设为已读</el-button>
				</template>
			</el-table-column>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';

type N = { id:number; title:string; content?:string; status:'UNREAD'|'READ'; createdAt:string };
const list = ref<N[]>([]);

async function load(){
    try{
        const token = localStorage.getItem('token')||'';
        const res = await fetch(`${API_BASE}/notification/list`, { headers: { Authorization: `Bearer ${token}` } });
        const arr:any[] = await res.json();
        list.value = Array.isArray(arr)? arr: [];
    }catch{ list.value = []; }
}
async function markRead(row:N){ try{ const token=localStorage.getItem('token')||''; await fetch(`${API_BASE}/notification/mark-read`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, body: JSON.stringify({ id: row.id }) }); row.status='READ'; ElMessage.success('已标记'); }catch{ ElMessage.error('失败'); } }
async function markAllRead(){ const unread = list.value.filter(x=>x.status==='UNREAD'); for (const n of unread){ await markRead(n); } }

onMounted(()=>{ load(); });
</script>

<style scoped>
</style>


