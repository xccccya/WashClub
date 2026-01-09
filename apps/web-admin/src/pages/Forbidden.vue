<template>
	<div class="forbidden">
		<div class="card">
			<div class="code">403</div>
			<div class="title">无权限访问</div>
			<div class="desc">你的账号没有访问该功能的权限，请联系管理员为你的角色开通相应菜单权限。</div>
			<div class="actions">
				<el-button type="primary" @click="goHome">返回可用页面</el-button>
				<el-button @click="goBack">返回上一页</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function readPermissions(): string[] {
	try {
		const u = JSON.parse(localStorage.getItem('user') || '{}');
		return Array.isArray(u?.permissions) ? u.permissions : [];
	} catch {
		return [];
	}
}

function firstAllowedPath(): string {
	const perms = readPermissions();
	if (perms.includes('*')) return '/dashboard';
	// 从已注册路由中挑一个 “有 perm 且在权限列表里” 的静态页面
	const candidates = router
		.getRoutes()
		.map((r) => ({ path: r.path, perm: (r.meta as any)?.perm as string | undefined }))
		.filter((r) => !!r.path && !r.path.includes(':') && r.path !== '/login' && r.path !== '/403');
	for (const r of candidates) {
		if (!r.perm) continue;
		if (perms.includes(r.perm)) return r.path;
	}
	// 兜底：如果没有任何权限，就留在 403
	return '/403';
}

function goHome() {
	router.push(firstAllowedPath());
}
function goBack() {
	try {
		router.back();
	} catch {
		router.push(firstAllowedPath());
	}
}
</script>

<style scoped>
.forbidden{
	min-height: calc(100vh - 56px - 48px);
	display:flex;
	align-items:center;
	justify-content:center;
	padding: 24px;
}
.card{
	width: min(520px, 100%);
	background: var(--el-bg-color);
	border: 1px solid var(--el-border-color-light);
	border-radius: 14px;
	padding: 22px 22px 18px;
	box-shadow: 0 8px 24px rgba(0,0,0,.06);
	text-align: center;
}
.code{
	font-size: 56px;
	font-weight: 800;
	letter-spacing: 1px;
	line-height: 1.05;
	color: color-mix(in oklab, var(--el-color-danger), #000 10%);
}
.title{
	margin-top: 8px;
	font-size: 18px;
	font-weight: 700;
	color: var(--el-text-color-primary);
}
.desc{
	margin-top: 10px;
	font-size: 13px;
	line-height: 1.7;
	color: var(--el-text-color-regular);
}
.actions{
	margin-top: 16px;
	display:flex;
	justify-content:center;
	gap: 10px;
	flex-wrap: wrap;
}
</style>

