<template>
	<div>
		<h3>卡券分组</h3>
		<div style="margin:12px 0;">
			<el-button type="primary" @click="openCreate">新增分组</el-button>
		</div>
		<el-table :data="list" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="name" label="名称" />
			<el-table-column prop="enabled" label="启用" width="80">
				<template #default="{ row }"> <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag> </template>
			</el-table-column>
			<el-table-column prop="weight" label="排序" width="100" />
			<el-table-column label="操作" width="200">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-popconfirm title="确认删除？" @confirm="remove(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="show" :title="form.id ? '编辑分组' : '新增分组'" width="520px">
			<el-form label-width="80">
				<el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
				<el-form-item label="排序"><el-input-number v-model="form.weight" :min="0" /></el-form-item>
				<el-form-item label="备注"><el-input v-model="form.description" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="show=false">取消</el-button>
				<el-button type="primary" @click="save">保存</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const list = ref<any[]>([]);
async function fetchList(){ list.value = await http('/coupon/groups'); }

const show = ref(false);
const form = ref<any>({ id: 0, name: '', enabled: true, weight: 0, description: '' });
function openCreate(){ form.value = { id: 0, name: '', enabled: true, weight: 0, description: '' }; show.value = true; }
function openEdit(row:any){ form.value = { id: row.id, name: row.name, enabled: row.enabled, weight: row.weight, description: row.description||'' }; show.value = true; }

async function save(){
	if (!form.value.name) { ElMessage.error('请输入名称'); return; }
	if (form.value.id) await http(`/coupon/groups/${form.value.id}`, { method:'PUT', body: { name: form.value.name, enabled: form.value.enabled, weight: form.value.weight, description: form.value.description } });
	else await http('/coupon/groups', { method:'POST', body: { name: form.value.name, enabled: form.value.enabled, weight: form.value.weight, description: form.value.description } });
	show.value = false; ElMessage.success('已保存'); await fetchList();
}
async function remove(id:number){ await http(`/coupon/groups/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await fetchList(); }

onMounted(fetchList);
</script>

<style scoped>
</style>


