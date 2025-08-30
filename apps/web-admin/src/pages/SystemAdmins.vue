<template>
	<BasePage title="后台管理员">
		<template #actions>
			<el-button type="primary" @click="openCreate">新增管理员</el-button>
		</template>
		<el-table :data="admins" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="昵称" />
			<el-table-column prop="phone" label="手机号" />
			<el-table-column prop="roleRef.name" label="角色" />
			<el-table-column label="操作" width="260">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)" :disabled="row.id===1">编辑</el-button>
					<el-button size="small" type="danger" @click="remove(row)" :disabled="row.id===1">删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑管理员' : '新增管理员'" width="520px">
			<el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
				<el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" :disabled="!!current?.id" /></el-form-item>
				<el-form-item label="昵称" prop="name"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="角色">
					<el-select v-model="form.roleId" placeholder="请选择角色" style="width:100%">
						<el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="!current?.id" label="密码" prop="password"><el-input v-model="form.password" type="password" /></el-form-item>
				<el-form-item v-if="!current?.id" label="确认密码" prop="password2"><el-input v-model="form.password2" type="password" /></el-form-item>
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

type Role = { id: number; name: string };
type Admin = { id: number; name?: string; phone: string; roleId?: number; roleRef?: Role };
const admins = ref<Admin[]>([]);
const roles = ref<Role[]>([]);
const dialogVisible = ref(false);
const current = ref<Admin | null>(null);
const formRef = ref();
const form = ref<Partial<Admin & { password?: string; password2?: string }>>({ phone: '', name: '', roleId: undefined, password: '', password2: '' });

const rules = {
	phone: [
		{ required: true, message: '请输入手机号', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (/^1\d{10}$/.test(val) ? cb() : cb(new Error('手机号格式不正确'))), trigger: 'blur' },
	],
	name: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
	password: [
		{ required: true, message: '请输入密码', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(val) ? cb() : cb(new Error('至少8位且包含字母和数字'))), trigger: 'blur' },
	],
	password2: [
		{ required: true, message: '请再次输入密码', trigger: 'blur' },
		{ validator: (_: any, _v: string, cb: any) => (form.value.password === form.value.password2 ? cb() : cb(new Error('两次输入的密码不一致'))), trigger: 'blur' },
	],
};

async function fetchAll(){ admins.value = await http<Admin[]>('/system/admins', { method: 'GET' }); roles.value = await http<Role[]>('/system/roles', { method: 'GET' }); }

function openCreate(){ current.value = null; form.value = { phone: '', name: '', roleId: roles.value[0]?.id, password: '', password2: '' }; dialogVisible.value = true; }
function openEdit(row: Admin){ current.value = row; form.value = { id: row.id, phone: row.phone, name: row.name, roleId: row.roleId }; dialogVisible.value = true; }

async function onSave(){
	if (formRef.value) { await formRef.value.validate(); }
	if (current.value?.id) {
		await http(`/system/admins/${current.value.id}`, { method: 'PUT', body: { phone: form.value.phone, name: form.value.name, roleId: form.value.roleId } });
	} else {
		await http('/system/admins', { method: 'POST', body: { phone: form.value.phone, name: form.value.name, roleId: form.value.roleId, password: form.value.password } });
	}
	dialogVisible.value = false; ElMessage.success('已保存'); fetchAll();
}

async function remove(row: Admin){ await http(`/system/admins/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchAll(); }

onMounted(fetchAll);
</script>



