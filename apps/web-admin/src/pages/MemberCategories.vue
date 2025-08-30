<template>
	<BasePage title="会员分类">
		<template #actions>
			<el-button type="primary" @click="openCreate">新增分类</el-button>
		</template>
		<el-table :data="categories" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="分类名称" />
			<el-table-column prop="weight" label="权重(数字越大越靠前)" width="220" />
			<el-table-column label="操作" width="180">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-button size="small" type="danger" @click="remove(row)">删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑分类' : '新增分类'" width="420px">
			<el-form :model="form" label-width="120px">
				<el-form-item label="分类名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="权重(大=前)"><el-input v-model.number="form.weight" /></el-form-item>
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

type Category = { id: number; name: string; weight: number };
const categories = ref<Category[]>([]);
const dialogVisible = ref(false);
const current = ref<Category | null>(null);
const form = ref<Partial<Category>>({ name: '', weight: 0 });

async function fetchCategories(){ categories.value = await http<Category[]>('/member-category', { method: 'GET' }); }

function openCreate(){ current.value = null; form.value = { name: '', weight: 0 }; dialogVisible.value = true; }
function openEdit(row: Category){ current.value = row; form.value = { ...row }; dialogVisible.value = true; }

async function onSave(){
	if (current.value?.id) await http(`/member-category/${current.value.id}`, { method: 'PUT', body: form.value });
	else await http('/member-category', { method: 'POST', body: form.value });
	dialogVisible.value = false; ElMessage.success('已保存'); fetchCategories();
}

async function remove(row: Category){ await http(`/member-category/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchCategories(); }

onMounted(fetchCategories);
</script>



