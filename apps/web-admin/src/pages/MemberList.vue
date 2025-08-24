<template>
	<BasePage title="会员列表">
		<template #actions>
			<el-input v-model="keyword" placeholder="搜索姓名/手机号" style="width:240px;margin-right:8px;" />
			<el-button @click="fetchList" :loading="loading" style="margin-right:8px;">搜索</el-button>
			<el-button type="primary" @click="openCreate">新建会员</el-button>
		</template>
		<el-table :data="list" stripe style="width: 100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="uid" label="UID" width="100" />
			<el-table-column label="头像" width="90">
				<template #default="{ row }">
					<el-avatar :size="32" :src="formatAvatar(row.avatarUrl)" />
				</template>
			</el-table-column>
			<el-table-column prop="name" label="昵称" />
			<el-table-column prop="phone" label="手机号" />
			<el-table-column prop="level.name" label="等级" width="120">
				<template #default="{ row }">{{ row.level?.name || '-' }}</template>
			</el-table-column>
			<el-table-column prop="category.name" label="分类" width="120">
				<template #default="{ row }">{{ row.category?.name || '-' }}</template>
			</el-table-column>
			<el-table-column prop="createdAt" label="注册时间" width="180">
				<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column prop="lastActiveAt" label="活跃时间" width="180">
				<template #default="{ row }">{{ formatTime(row.lastActiveAt) }}</template>
			</el-table-column>
			<el-table-column prop="points" label="积分" width="100" />
			<el-table-column prop="balance" label="余额" width="120" />
			<el-table-column label="操作" width="240">
				<template #default="{ row }">
					<div class="op-btns">
						<el-button size="small" link @click="openEdit(row)">查看资料</el-button>
						<el-button size="small" link type="warning" @click="openResetPwd(row)">修改密码</el-button>
						<el-button size="small" link type="danger" @click="openDeleteDialog(row)">删除</el-button>
					</div>
				</template>
			</el-table-column>
		</el-table>
		<div style="margin-top:12px;display:flex;justify-content:flex-end;">
			<el-pagination
				background
				layout="prev, pager, next"
				:total="total"
				:page-size="pageSize"
				:current-page="page"
				@current-change="onPageChange"
			/>
		</div>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '查看/编辑会员' : '新建会员'" width="520px">
			<el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
				<el-form-item v-if="current?.id" label="ID"><el-input :model-value="current?.id" disabled /></el-form-item>
				<el-form-item v-if="current?.id" label="UID"><el-input :model-value="current?.uid" disabled /></el-form-item>
				<el-form-item label="头像">
					<div style="display:flex;align-items:center;gap:12px;">
						<img :src="formatAvatar(form.avatarUrl)" alt="avatar" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid #eee;" />
						<el-upload
							action="http://localhost:3000/file/upload"
							:name="'file'"
							:show-file-list="false"
							:headers="authHeaders"
							:data="{ dir: 'public' }"
							:accept="'image/*'"
							:on-success="onAvatarUploaded"
						>
							<el-button>上传头像</el-button>
						</el-upload>
						<el-button link type="danger" @click="onAvatarClear">恢复默认</el-button>
					</div>
				</el-form-item>
				<el-form-item label="昵称" prop="name"><el-input v-model="form.name" :maxlength="10" show-word-limit /></el-form-item>
				<el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" /></el-form-item>
				<el-form-item label="会员等级" prop="levelId">
					<el-select v-model="form.levelId" placeholder="请选择等级" style="width:100%">
						<el-option v-for="lv in levels" :key="lv.id" :label="lv.name" :value="lv.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="会员分类" prop="categoryId">
					<el-select v-model="form.categoryId" placeholder="请选择分类" style="width:100%">
 						<el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="会员标签">
					<div v-if="systemTagsRO.length" style="margin-bottom:6px;">
						<span style="margin-right:6px;color:#909399;">系统标签：</span>
						<el-tag v-for="t in systemTagsRO" :key="t.id" type="info" effect="plain" style="margin-right:6px;">{{ t.name }}</el-tag>
					</div>
					<el-select
						v-model="form.tagIds"
						multiple
						filterable
						tag-type="primary"
						allow-create
						default-first-option
						placeholder="选择或输入新标签后回车"
						style="width:100%"
					>
						<el-option v-for="t in tagOptions" :key="t.id" :label="t.name" :value="t.id" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="!current?.id" label="密码" prop="password"><el-input v-model="form.password" type="password" /></el-form-item>
				<el-form-item v-if="!current?.id" label="确认密码" prop="password2"><el-input v-model="form.password2" type="password" /></el-form-item>
				<el-form-item v-if="current?.id" label="注册时间"><el-input :model-value="formatTime(current?.createdAt as any)" disabled /></el-form-item>
				<el-form-item v-if="current?.id" label="活跃时间"><el-input :model-value="formatTime(current?.lastActiveAt as any)" disabled /></el-form-item>
				<el-form-item label="积分"><el-input v-model.number="form.points" /></el-form-item>
				<el-form-item label="余额"><el-input v-model.number="form.balance" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="pwdDialog" title="修改密码" width="420px">
			<el-form :model="pwdForm" label-width="90px">
				<el-form-item label="新密码"><el-input v-model="pwdForm.password" type="password" /></el-form-item>
				<el-form-item label="确认密码"><el-input v-model="pwdForm.password2" type="password" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="pwdDialog=false">取消</el-button>
				<el-button type="primary" @click="onResetPwdSave">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="delDialog" title="确认删除" width="420px" @closed="clearDelTimer">
			<div>确认删除该会员？将同时删除该会员的所有车辆、洗车计次卡及其共享与日志记录，此操作不可恢复。</div>
			<template #footer>
				<el-button @click="delDialog=false">取消</el-button>
				<el-button type="danger" :disabled="delCountdown>0" @click="onDeleteConfirm">
					{{ delCountdown>0 ? `确认(${delCountdown}s)` : '确认' }}
				</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const http = createHttpClient({
	baseUrl: 'http://localhost:3000',
	getToken: () => localStorage.getItem('token') || undefined,
});

type Level = { id: number; name: string; weight: number };
const levels = ref<Level[]>([]);

type Category = { id: number; name: string; weight: number };
const categories = ref<Category[]>([]);

type Tag = { id: number; name: string; isSystem?: boolean };
const tagOptions = ref<Tag[]>([]);

type Member = { id: number; uid: number; name: string; phone: string; points: number; balance: number; createdAt: string; lastActiveAt?: string | null; avatarUrl?: string | null; level?: Level; category?: Category; tags?: Tag[] };
const list = ref<Member[]>([]);
const keyword = ref('');
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const dialogVisible = ref(false);
const saving = ref(false);
const current = ref<Member | null>(null);
const formRef = ref();
const form = ref<any>({ name: '', phone: '', levelId: undefined, categoryId: undefined, tagIds: [] as Array<number|string>, password: '', password2: '', points: 0, balance: 0, avatarUrl: undefined as string | null | undefined });
const systemTagsRO = computed(() => (current.value?.tags || []).filter(t => (t as any).isSystem));

const rules = {
	name: [
		{ required: true, message: '请输入昵称', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (Array.from(String(val || '').trim()).length <= 10 ? cb() : cb(new Error('昵称最多10个字符'))), trigger: 'blur' },
	],
	phone: [
		{ required: true, message: '请输入手机号', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (/^1\d{10}$/.test(val) ? cb() : cb(new Error('手机号格式不正确'))), trigger: 'blur' },
	],
	levelId: [{ required: true, message: '请选择会员等级', trigger: 'change' }],
	categoryId: [{ required: true, message: '请选择会员分类', trigger: 'change' }],
	password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
	password2: [{ validator: (_: any, _v: string, cb: any) => (form.value.password === form.value.password2 ? cb() : cb(new Error('两次输入的密码不一致'))), trigger: 'blur' }],
};

const pwdDialog = ref(false);
const pwdForm = ref<{ id?: number; password: string; password2: string }>({ password: '', password2: '' });

const delDialog = ref(false);
const delTarget = ref<Member | null>(null);
const delCountdown = ref(0);
let delTimer: any = null;

function formatTime(v?: string | null) {
	if (!v) return '-';
	try {
		const d = new Date(v as any);
		if (isNaN(d.getTime())) return '-';
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		const hh = String(d.getHours()).padStart(2, '0');
		const mi = String(d.getMinutes()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
	} catch {
		return '-';
	}
}

async function fetchLevels(){ levels.value = await http<Level[]>('/member-level', { method: 'GET' }); }
async function fetchCategories(){ categories.value = await http<Category[]>('/member-category', { method: 'GET' }); }
async function fetchTags(){
	const all = await http<Tag[]>('/member-tag', { method: 'GET' });
	// 前端在选择时隐藏系统默认标签，避免误选
	tagOptions.value = all.filter(t => !t.isSystem);
}

async function fetchList() {
	loading.value = true;
	try {
		const res = await http<{ items: Member[]; total: number; page: number; pageSize: number }>(
			'/member/list',
			{ method: 'GET', query: { keyword: keyword.value, page: page.value, pageSize: pageSize.value } },
		);
		list.value = res.items;
		total.value = res.total;
	} finally {
		loading.value = false;
	}
}

function onPageChange(p: number) {
	page.value = p;
	fetchList();
}

function openCreate() {
	current.value = null;
	form.value = { name: '', phone: '', levelId: undefined, categoryId: undefined, tagIds: [], password: '', password2: '', points: 0, balance: 0, avatarUrl: undefined };
	dialogVisible.value = true;
}

function openEdit(item: Member) {
	current.value = item;
	const nonSystemTagIds = (item.tags||[]).filter((t: any) => !t.isSystem).map(t=>t.id);
	form.value = { ...item, levelId: item.level?.id, categoryId: item.category?.id, tagIds: nonSystemTagIds, password: '', password2: '' };
	dialogVisible.value = true;
}

function openResetPwd(item: Member){ pwdForm.value = { id: item.id, password: '', password2: '' }; pwdDialog.value = true; }

async function onResetPwdSave(){
	if (!pwdForm.value.password || pwdForm.value.password !== pwdForm.value.password2) { ElMessage.error('两次密码不一致'); return; }
	await http(`/member/${pwdForm.value.id}/password`, { method: 'PUT', body: { password: pwdForm.value.password } });
	pwdDialog.value = false; ElMessage.success('密码已更新');
}

async function onSave() {
	saving.value = true;
	try {
		if (formRef.value) { await formRef.value.validate(); }
		// 将新输入的标签名先创建，再转换为ID
		const selected = Array.isArray(form.value.tagIds) ? [...form.value.tagIds] : [];
		const tagIdsNumeric: number[] = [];
		for (const v of selected) {
			if (typeof v === 'number') { tagIdsNumeric.push(v); continue; }
			const name = String(v).trim();
			if (!name) continue;
			const exists = tagOptions.value.find(t => t.name === name);
			if (exists) { tagIdsNumeric.push(exists.id); continue; }
			const created = await http<Tag>('/member-tag', { method: 'POST', body: { name } });
			tagOptions.value.push(created);
			tagIdsNumeric.push(created.id);
		}
		const payload: any = { name: String(form.value.name || '').trim(), phone: form.value.phone, levelId: form.value.levelId, categoryId: form.value.categoryId, tagIds: tagIdsNumeric, points: form.value.points, balance: form.value.balance };
		if (form.value.avatarUrl !== undefined) payload.avatarUrl = form.value.avatarUrl;
		if (!current.value?.id && form.value.password) payload.password = form.value.password;
		if (current.value?.id) {
			await http(`/member/${current.value.id}`, { method: 'PUT', body: payload });
		} else {
			await http('/member/create', { method: 'POST', body: payload });
		}
		dialogVisible.value = false;
		fetchList();
	} finally {
		saving.value = false;
	}
}

function openDeleteDialog(item: Member){
	delTarget.value = item;
	delCountdown.value = 5;
	delDialog.value = true;
	if (delTimer) { clearInterval(delTimer); delTimer = null; }
	delTimer = setInterval(()=>{
		delCountdown.value = Math.max(0, delCountdown.value - 1);
		if (delCountdown.value === 0 && delTimer) { clearInterval(delTimer); delTimer = null; }
	}, 1000);
}

function clearDelTimer(){ if (delTimer) { clearInterval(delTimer); delTimer = null; } }

async function onDeleteConfirm(){
	if (!delTarget.value) return;
	await http(`/member/${delTarget.value.id}`, { method: 'DELETE' });
	ElMessage.success('已删除');
	delDialog.value = false; delTarget.value = null; fetchList();
}

onMounted(()=>{ fetchLevels(); fetchCategories(); fetchTags(); fetchList(); });

const defaultAvatar = 'http://localhost:3000/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png';
function toAbsUrl(path?: string | null) { if (!path) return defaultAvatar; if (/^https?:\/\//i.test(path)) return path; return `http://localhost:3000${path}`; }
function formatAvatar(url?: string | null){ return toAbsUrl(url); }
const authHeaders = computed(()=>({ Authorization: `Bearer ${localStorage.getItem('token')||''}` }));
function onAvatarUploaded(res: any){ form.value.avatarUrl = res?.url || null; ElMessage.success('头像已上传'); }
function onAvatarClear(){ form.value.avatarUrl = null; ElMessage.success('已恢复默认头像'); }
</script>

<style scoped>
.op-btns { display: inline-flex; gap: 6px; align-items: center; }
</style>

