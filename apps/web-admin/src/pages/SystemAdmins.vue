<template>
	<BasePage title="后台管理员">
		<template #actions>
			<el-button type="primary" @click="openCreate">
				<el-icon style="vertical-align: middle; margin-right:4px;"><UserFilled /></el-icon>
				<span style="vertical-align: middle;">新增管理员</span>
			</el-button>
		</template>
		<el-table :data="admins" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column label="头像" width="90">
				<template #default="{ row }">
					<el-avatar :size="32" :src="formatAvatar(row.avatarUrl)" />
				</template>
			</el-table-column>
			<el-table-column prop="name" label="昵称" />
			<el-table-column prop="phone" label="手机号" />
			<el-table-column prop="roleRef.name" label="角色" />
			<el-table-column label="操作" width="260">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)" :disabled="row.id===1">
						<el-icon><Edit /></el-icon>
						<span>编辑</span>
					</el-button>
					<el-button size="small" type="danger" @click="remove(row)" :disabled="row.id===1">
						<el-icon><Delete /></el-icon>
						<span>删除</span>
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑管理员' : '新增管理员'" width="520px">
			<el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
				<el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" :disabled="!!current?.id" /></el-form-item>
				<el-form-item label="头像">
					<div style="display:flex;align-items:center;gap:12px;">
						<img :src="formatAvatar(form.avatarUrl)" alt="avatar" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid #eee;" />
						<el-upload :http-request="uploadAvatar" :show-file-list="false" accept="image/*"><el-button>上传头像</el-button></el-upload>
						<el-button @click="openPickAvatar">从文件库选择</el-button>
						<el-button link type="danger" @click="onAvatarClear">恢复默认</el-button>
					</div>
				</el-form-item>
				<el-form-item label="昵称" prop="name"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="角色">
					<el-select v-model="form.roleId" placeholder="请选择角色" style="width:100%">
						<el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="!current?.id" label="密码" prop="密码"><el-input v-model="form.password" type="password" /></el-form-item>
				<el-form-item v-if="!current?.id" label="确认密码" prop="password2"><el-input v-model="form.password2" type="password" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" @click="onSave">保存</el-button>
			</template>
		</el-dialog>

		<FilePickerDialog v-model="pickVisible" title="选择头像" @picked="onPicked" />
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import { Edit, Delete, UserFilled } from '@element-plus/icons-vue';
import FilePickerDialog from './_components/FilePickerDialog.vue';
import { absUrl } from '../utils/http';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Role = { id: number; name: string };
type Admin = { id: number; name?: string; phone: string; roleId?: number; roleRef?: Role; avatarUrl?: string | null };
const admins = ref<Admin[]>([]);
const roles = ref<Role[]>([]);
const dialogVisible = ref(false);
const current = ref<Admin | null>(null);
const formRef = ref();
const form = ref<Partial<Admin & { password?: string; password2?: string }>>({ phone: '', name: '', roleId: undefined, password: '', password2: '', avatarUrl: undefined });

const rules = {
	phone: [ { required: true, message: '请输入手机号', trigger: 'blur' } ],
	name: [ { required: true, message: '请输入昵称', trigger: 'blur' } ],
	password: [ { required: false, min: 6, message: '密码至少6位', trigger: 'blur' } ]
};

function toAbsUrl(path?: string | null) { if (!path) return ''; if (/^https?:\/\//i.test(path)) return path; return absUrl(path||''); }
function formatAvatar(url?: string | null){ try { const site = JSON.parse(localStorage.getItem('siteSetting')||'{}'); const candidate = url || site?.defaultMemberAvatarUrl || ''; const u = toAbsUrl(candidate); return u || absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png'); } catch { return absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png'); } }
const authHeaders = computed(()=>({ Authorization: `Bearer ${localStorage.getItem('token')||''}` }));
async function uploadAvatar(o:any){ const fd=new FormData(); fd.append('file', o.file); fd.append('dir','public'); fd.append('source','avatar'); const res=await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } }); const j=await res.json(); form.value.avatarUrl = j?.url || null; ElMessage.success('头像已上传'); }
function onAvatarClear(){ form.value.avatarUrl = null; ElMessage.success('已恢复默认头像'); }
const pickVisible = ref(false);
function openPickAvatar(){ pickVisible.value = true; }
function onPicked(list:any[]){ const f = list?.[0]; if (f && f.url) { form.value.avatarUrl = f.url; ElMessage.success('已选择头像'); } pickVisible.value=false; }

async function fetchAdmins(){ const list = await http<Admin[]>('/system/admins', { method:'GET' }); admins.value = list; }
async function fetchRoles(){ roles.value = await http<Role[]>('/system/roles', { method:'GET' }); }

function openCreate(){ current.value = null; form.value = { phone: '', name: '', roleId: undefined, password: '', password2: '', avatarUrl: undefined }; dialogVisible.value = true; }
function openEdit(row: Admin){ current.value = row; form.value = { id: row.id, phone: row.phone, name: row.name, roleId: row.roleId, avatarUrl: row.avatarUrl, password: '', password2: '' }; dialogVisible.value = true; }

async function onSave(){
	try {
		if (formRef.value) await formRef.value.validate();
		if (!current.value?.id) {
			if (!form.value?.password || form.value.password.length < 6) { ElMessage.error('请填写至少6位密码'); return; }
			const payload:any = { phone: form.value.phone, name: form.value.name, password: form.value.password, roleId: form.value.roleId, avatarUrl: form.value.avatarUrl };
			await http('/system/admins', { method:'POST', body: payload });
		} else {
			const payload:any = { phone: form.value.phone, name: form.value.name, roleId: form.value.roleId };
			if (form.value.password) payload.password = form.value.password;
			if (form.value.avatarUrl !== undefined) payload.avatarUrl = form.value.avatarUrl;
			await http(`/system/admins/${current.value.id}`, { method:'PUT', body: payload });
		}
		ElMessage.success('已保存'); dialogVisible.value=false; fetchAdmins();
	} catch (e:any) { ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function remove(row: Admin){ if (row.id===1) return; await http(`/system/admins/${row.id}`, { method:'DELETE' }); ElMessage.success('已删除'); fetchAdmins(); }

onMounted(()=>{ fetchRoles(); fetchAdmins(); try{ http('/system/public/site-setting', { method:'GET' }).then(s=>{ try{ localStorage.setItem('siteSetting', JSON.stringify(s||{})); }catch{} }); }catch{} });
</script>



