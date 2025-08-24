<template>
	<BasePage title="会员标签">
		<template #actions>
			<el-button type="primary" @click="openCreate">新增标签</el-button>
		</template>
		<el-table :data="tags" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="标签名称" />
			<el-table-column label="操作" width="180">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-button size="small" type="danger" @click="remove(row)">删除</el-button>
				</template>
			</el-table-column>
		</el-table>

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
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });

type Tag = { id: number; name: string };
const tags = ref<Tag[]>([]);
const dialogVisible = ref(false);
const current = ref<Tag | null>(null);
const form = ref<Partial<Tag>>({ name: '' });

async function fetchTags(){ tags.value = await http<Tag[]>('/member-tag', { method: 'GET' }); }

function openCreate(){ current.value = null; form.value = { name: '' }; dialogVisible.value = true; }
function openEdit(row: Tag){ current.value = row; form.value = { ...row }; dialogVisible.value = true; }

async function onSave(){
	if (current.value?.id) await http(`/member-tag/${current.value.id}`, { method: 'PUT', body: form.value });
	else await http('/member-tag', { method: 'POST', body: form.value });
	dialogVisible.value = false; ElMessage.success('已保存'); fetchTags();
}

async function remove(row: Tag){ await http(`/member-tag/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchTags(); }

onMounted(fetchTags);
</script>



