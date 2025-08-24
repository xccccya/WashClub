<template>
	<div class="layout">
		<aside class="sider">
			<div class="logo">Wash Admin</div>
			<el-menu :default-active="active" class="menu" @select="onSelect">
				<el-sub-menu index="/members">
					<template #title>会员管理</template>
					<el-menu-item v-if="can('members')" index="/members">会员列表</el-menu-item>
					<el-menu-item v-if="can('member-levels')" index="/member-levels">会员等级</el-menu-item>
					<el-menu-item v-if="can('member-categories')" index="/member-categories">会员分类</el-menu-item>
					<el-menu-item v-if="can('member-tags')" index="/member-tags">会员标签</el-menu-item>
					<el-menu-item v-if="can('member-washcards')" index="/member-washcards">洗车计次卡</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/vehicles">
					<template #title>车辆管理</template>
					<el-menu-item v-if="can('member-vehicles')" index="/member-vehicles">会员车辆</el-menu-item>
					<el-menu-item v-if="can('service-queue')" index="/service-queue">服务队列</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/content">
					<template #title>内容管理</template>
					<el-menu-item v-if="can('content-notices')" index="/content/notices">滚动通知</el-menu-item>
					<el-menu-item v-if="can('content-banners')" index="/content/banners">广告横幅</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/system">
					<template #title>系统设置</template>
					<el-menu-item v-if="can('system-roles')" index="/system/roles">后台角色</el-menu-item>
					<el-menu-item v-if="can('system-admins')" index="/system/admins">后台管理员</el-menu-item>
					<el-menu-item v-if="can('system-files')" index="/system/files">文件管理</el-menu-item>
					<el-menu-item v-if="can('system-sms')" index="/system/sms">短信管理</el-menu-item>
				</el-sub-menu>
			</el-menu>
		</aside>
		<section class="main">
			<header class="topbar">
				<h2>管理后台</h2>
				<div class="user">
					<el-dropdown>
						<span class="user-chip">{{ nick || '管理员' }}</span>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item @click="openEditNick">修改昵称</el-dropdown-item>
								<el-dropdown-item @click="openEditPwd">修改密码</el-dropdown-item>
								<el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</div>
			</header>
			<main class="content">
				<router-view />
			</main>
		</section>
	</div>

	<!-- 修改昵称对话框 -->
	<el-dialog v-model="showNick" title="修改昵称" width="360px">
		<el-input v-model="nickDraft" placeholder="新的昵称" />
		<template #footer>
			<el-button @click="showNick=false">取消</el-button>
			<el-button type="primary" @click="saveNick">保存</el-button>
		</template>
	</el-dialog>

	<!-- 修改密码对话框 -->
	<el-dialog v-model="showPwd" title="修改密码" width="360px">
		<el-input v-model="pwdOld" type="password" placeholder="旧密码" style="margin-bottom:8px;" />
		<el-input v-model="pwdNew" type="password" placeholder="新密码(>=6位)" />
		<template #footer>
			<el-button @click="showPwd=false">取消</el-button>
			<el-button type="primary" @click="savePwd">保存</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const router = useRouter();
const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const active = ref('/members');

const nick = ref('');
const permissions = ref<string[]>([]);
const userId = ref<number | null>(null);
const showNick = ref(false);
const nickDraft = ref('');

const showPwd = ref(false);
const pwdOld = ref('');
const pwdNew = ref('');

function can(key: string){ return permissions.value.includes('*') || permissions.value.includes(key); }
function onSelect(index: string){ router.push(index); active.value = index; }

function openEditNick(){ nickDraft.value = nick.value; showNick.value = true; }
async function saveNick(){
	if (!userId.value) { ElMessage.error('未获取到用户ID'); return; }
	await http('/auth/admin/update-nickname', { method: 'POST', body: { userId: userId.value, name: nickDraft.value } });
	nick.value = nickDraft.value; showNick.value = false; ElMessage.success('昵称已更新');
}

function openEditPwd(){ pwdOld.value=''; pwdNew.value=''; showPwd.value = true; }
async function savePwd(){
	if (!userId.value) { ElMessage.error('未获取到用户ID'); return; }
	if (pwdNew.value.length < 6) { ElMessage.error('新密码至少6位'); return; }
	try {
		await http('/auth/admin/update-password', { method: 'POST', body: { userId: userId.value, oldPassword: pwdOld.value, newPassword: pwdNew.value } });
		showPwd.value = false; ElMessage.success('密码已更新');
	} catch (e:any) {
		ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '修改密码失败');
	}
}

function logout(){ localStorage.removeItem('token'); router.push('/login'); }

onMounted(()=>{ 
	active.value = router.currentRoute.value.path; 
	try { const tokenPayload = JSON.parse(atob((localStorage.getItem('token')||'.').split('.')[1]||'{}')); userId.value = tokenPayload?.sub || null; } catch {};
	try { const u = JSON.parse(localStorage.getItem('user') || '{}'); if (u && u.name) nick.value = u.name; if (u && u.permissions) permissions.value = u.permissions; } catch {}
});
</script>

<style scoped>
.layout { display:flex; height:100vh; }
.sider { width: 220px; border-right: 1px solid #eee; padding: 12px; }
.logo { font-weight: 700; margin: 8px 0 12px; }
.menu { border-right: none; }
.main { flex:1; display:flex; flex-direction: column; }
.topbar { height: 56px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content: space-between; padding: 0 16px; }
.user-chip { background:#f5f5f5; padding:6px 10px; border-radius: 999px; cursor:pointer; }
.content { flex:1; overflow:auto; padding: 16px; }
</style>

