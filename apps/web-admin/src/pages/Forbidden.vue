<template>
	<div class="page403">
		<div class="bg" aria-hidden="true"></div>
		<div class="wrap">
			<div class="card">
				<el-result icon="error" title="无权限访问" sub-title="你的账号没有访问该功能的权限，请联系管理员为你的角色开通相应菜单权限。">
					<template #extra>
						<div class="extra">
							<div class="hint">
								<div class="label">当前页面</div>
								<div class="value">{{ currentPath }}</div>
							</div>
							<div class="actions">
								<el-button type="primary" @click="goHome">
									<el-icon style="margin-right:6px;"><House /></el-icon>
									返回可用页面
								</el-button>
								<el-button @click="goBack">
									<el-icon style="margin-right:6px;"><Back /></el-icon>
									返回上一页
								</el-button>
								<el-button type="danger" plain @click="relogin">
									<el-icon style="margin-right:6px;"><SwitchButton /></el-icon>
									重新登录
								</el-button>
							</div>
						</div>
					</template>
				</el-result>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Back, House, SwitchButton } from '@element-plus/icons-vue';

const router = useRouter();

const currentPath = computed(() => router.currentRoute.value?.fullPath || '');

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

function relogin() {
	try {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
	} catch {}
	router.push('/login');
}
</script>

<style scoped>
.page403{
	min-height: calc(100vh - 56px - 48px);
	display:flex;
	align-items:center;
	justify-content:center;
	padding: 24px;
	position: relative;
	overflow: hidden;
}
.bg{
	position:absolute;
	inset:-120px;
	background:
		radial-gradient(900px 420px at 20% 25%, color-mix(in oklab, var(--el-color-primary), transparent 80%), transparent 60%),
		radial-gradient(700px 360px at 85% 70%, color-mix(in oklab, var(--el-color-danger), transparent 82%), transparent 60%),
		linear-gradient(180deg, color-mix(in oklab, var(--el-bg-color), #eef2ff 40%), var(--el-bg-color));
	filter: blur(0px);
	opacity: .9;
}
.wrap{
	position: relative;
	width: min(760px, 100%);
}
.card{
	background: color-mix(in oklab, var(--el-bg-color), transparent 12%);
	border: 1px solid color-mix(in oklab, var(--el-border-color-light), transparent 10%);
	border-radius: 16px;
	box-shadow:
		0 1px 0 rgba(255,255,255,.35) inset,
		0 14px 34px rgba(15, 23, 42, .10);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	padding: 8px 10px;
}
.extra{
	display:flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
}
.hint{
	width: min(560px, 100%);
	display:flex;
	align-items:flex-start;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px dashed var(--el-border-color);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 50%);
}
.hint .label{
	font-size: 12px;
	color: var(--el-text-color-secondary);
	flex: 0 0 auto;
}
.hint .value{
	font-size: 12px;
	color: var(--el-text-color-regular);
	word-break: break-all;
	text-align: right;
}
.actions{
	display:flex;
	justify-content:center;
	gap: 10px;
	flex-wrap: wrap;
}
</style>

