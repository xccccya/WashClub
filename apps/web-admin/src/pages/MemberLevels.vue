<template>
	<BasePage title="会员等级">
		<template #actions>
			<el-button type="primary" @click="openCreate">新增等级</el-button>
		</template>
		<el-table :data="levels" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="等级名称" />
			<el-table-column prop="weight" label="权重(数字越大等级越高)" width="220" />
			<el-table-column label="默认" width="100">
				<template #default="{ row }">
					<el-tag v-if="row.isDefault" type="success">默认</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="180">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-button size="small" type="danger" @click="remove(row)">删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑等级' : '新增等级'" width="420px">
			<el-form :model="form" label-width="120px">
				<el-form-item label="等级名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="权重(大=高)"><el-input v-model.number="form.weight" /></el-form-item>
				<el-form-item label="设为默认"><el-switch v-model="form.isDefault" /></el-form-item>
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

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Level = { id: number; name: string; weight: number; isDefault?: boolean };
const levels = ref<Level[]>([]);
const dialogVisible = ref(false);
const current = ref<Level | null>(null);
const form = ref<Partial<Level>>({ name: '', weight: 0 });

async function fetchLevels(){ levels.value = await http<Level[]>('/member-level', { method: 'GET' }); }

function openCreate(){ current.value = null; form.value = { name: '', weight: 0, isDefault: false }; dialogVisible.value = true; }
function openEdit(row: Level){ current.value = row; form.value = { ...row }; dialogVisible.value = true; }

async function onSave(){
	try {
		if (current.value?.id) await http(`/member-level/${current.value.id}`, { method: 'PUT', body: form.value });
		else await http('/member-level', { method: 'POST', body: form.value });
		dialogVisible.value = false; ElMessage.success('已保存'); fetchLevels();
	} catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function remove(row: Level){ try { await http(`/member-level/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchLevels(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

onMounted(fetchLevels);
</script>


