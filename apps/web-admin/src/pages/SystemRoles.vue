<template>
	<BasePage title="后台角色">
		<template #actions>
			<div class="role-actions">
				<el-input v-model="keyword" clearable placeholder="搜索角色名称" class="search" @keyup.enter="noop">
					<template #prefix><el-icon><Search /></el-icon></template>
				</el-input>
				<el-button @click="fetchAll" :loading="loading">
					<el-icon style="margin-right:6px;"><Refresh /></el-icon>
					刷新
				</el-button>
				<el-button type="primary" @click="openCreate">
					<el-icon style="margin-right:6px;"><Plus /></el-icon>
					新增角色
				</el-button>
			</div>
		</template>

		<el-alert class="role-tip" type="info" :closable="false" show-icon>
			<template #title>
				系统内置角色（标记为“系统”）不允许编辑/删除/禁用；权限变更请通过新增角色完成。
			</template>
		</el-alert>

		<el-table :data="displayRoles" stripe style="width:100%" v-loading="loading" class="role-table">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column label="角色名称" min-width="220">
				<template #default="{ row }">
					<div class="role-name">
						<span class="text">{{ row.name }}</span>
						<el-tag v-if="row.isSystem" size="small" type="warning" effect="light">系统</el-tag>
					</div>
				</template>
			</el-table-column>
			<el-table-column label="权限" width="140">
				<template #default="{ row }">
					<el-tooltip placement="top" :disabled="!row.permissions?.length">
						<template #content>
							<div style="max-width:320px; white-space:normal; line-height:1.6;">
								{{ (row.permissions || []).join('、') || '无' }}
							</div>
						</template>
						<el-tag size="small" effect="light" type="info">{{ (row.permissions || []).length }} 项</el-tag>
					</el-tooltip>
				</template>
			</el-table-column>
			<el-table-column prop="enabled" label="状态" width="160">
				<template #default="{ row }">
					<el-switch
						v-model="row.enabled"
						:disabled="row.isSystem || isToggling(row.id)"
						@change="(val:boolean)=>onToggleEnabled(row, val)"
					/>
					<span style="margin-left:8px;">{{ row.enabled ? '启用' : '禁用' }}</span>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="240">
				<template #default="{ row }">
					<el-button size="small" type="primary" plain @click="openEdit(row)" :disabled="row.isSystem">
						<el-icon><Edit /></el-icon>
						编辑
					</el-button>
					<el-button size="small" type="danger" plain @click="remove(row)" :disabled="row.isSystem">
						<el-icon><Delete /></el-icon>
						删除
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog
			v-model="dialogVisible"
			:title="current?.id ? '编辑角色' : '新增角色'"
			:width="'min(980px, calc(100vw - 32px))'"
			align-center
			destroy-on-close
			append-to-body
			class="role-dialog"
		>
			<el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="role-form">
				<el-card class="role-card" shadow="never">
					<template #header>
						<div class="card-header">
							<div class="title">基础信息</div>
							<div class="desc">设置角色名称与启用状态</div>
						</div>
					</template>
					<div class="grid2">
						<el-form-item label="角色名称" prop="name">
							<el-input v-model="form.name" maxlength="20" show-word-limit placeholder="例如：店长 / 收银员" />
						</el-form-item>
						<el-form-item label="启用" prop="enabled">
							<div class="inline">
								<el-switch v-model="form.enabled" />
								<span class="muted">禁用后该角色下的管理员将无法继续访问后台</span>
							</div>
						</el-form-item>
					</div>
				</el-card>

				<el-card class="role-card perm-card" shadow="never">
					<template #header>
						<div class="card-header">
							<div class="title req">菜单权限</div>
							<div class="desc">支持搜索与按分组快速全选/反选</div>
						</div>
					</template>

					<el-form-item label=" " required class="perm-block">
						<div class="perm-toolbar">
							<div class="left">
								<el-tag size="small" effect="light" type="info">
									已选 {{ (form.permissions || []).length }} / {{ menus.length }}
								</el-tag>
								<el-input v-model="permKeyword" clearable placeholder="搜索权限（名称/Key）" class="perm-search">
									<template #prefix><el-icon><Search /></el-icon></template>
								</el-input>
							</div>
							<div class="right">
								<el-button size="small" @click="selectAll"><el-icon><CircleCheck /></el-icon>全选</el-button>
								<el-button size="small" @click="deselectAll"><el-icon><CircleClose /></el-icon>全不选</el-button>
								<el-button size="small" @click="invertAll"><el-icon><Refresh /></el-icon>反选</el-button>
							</div>
						</div>

						<el-scrollbar class="perm-scroll">
							<el-collapse v-model="activeGroups" class="perm-collapse">
								<el-collapse-item v-for="g in filteredMenuGroups" :key="g.key" :name="g.key">
									<template #title>
										<div class="perm-group__header">
											<div class="title">
												<el-checkbox
													:model-value="isGroupChecked(g)"
													:indeterminate="isGroupIndeterminate(g)"
													@change="(val:any)=>toggleGroup(g, val)"
												>
													<span class="gname">{{ g.name }}</span>
												</el-checkbox>
											</div>
											<div class="perm-group__tools">
												<el-tag size="small" effect="light" type="info">{{ selectedCount(g) }}/{{ g.children.length }}</el-tag>
												<el-button text size="small" @click.stop="toggleGroup(g, true)">全选</el-button>
												<el-button text size="small" @click.stop="toggleGroup(g, false)">全不选</el-button>
												<el-button text size="small" @click.stop="invertGroup(g)">反选</el-button>
											</div>
										</div>
									</template>
									<el-checkbox-group v-model="form.permissions" class="perm-grid">
										<el-checkbox v-for="m in g.children" :key="m.key" :label="m.key">
											<span class="perm-item">
												<span class="name">{{ m.name }}</span>
												<span class="key">{{ m.key }}</span>
											</span>
										</el-checkbox>
									</el-checkbox-group>
								</el-collapse-item>
							</el-collapse>

							<div v-if="filteredMenuGroups.every(g=>g.children.length===0)" class="perm-empty">
								<el-empty description="没有匹配的权限项" />
							</div>
						</el-scrollbar>
					</el-form-item>
				</el-card>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false" :disabled="saving">取消</el-button>
				<el-button type="primary" @click="onSave" :loading="saving">
					<el-icon style="margin-right:6px;"><Key /></el-icon>
					保存角色
				</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { BasePage } from '@wash/shared-ui';
import {
	type AdminMenuDto,
	type AdminRoleDto,
	adminRoleControllerCreateRole,
	adminRoleControllerListMenus,
	adminRoleControllerListRoles,
	adminRoleControllerRemoveRole,
	adminRoleControllerUpdateRole,
} from '@wash/api-client';
import { ElMessage, ElMessageBox } from 'element-plus';
import { CircleCheck, CircleClose, Delete, Edit, Key, Plus, Refresh, Search } from '@element-plus/icons-vue';

type RoleForm = { id?: number; name: string; enabled: boolean; permissions: string[] };
const roles = ref<AdminRoleDto[]>([]);
const menus = ref<AdminMenuDto[]>([]);
const keyword = ref('');
const permKeyword = ref('');
const loading = ref(false);
const saving = ref(false);
const togglingIds = ref<number[]>([]);
const dialogVisible = ref(false);
const current = ref<AdminRoleDto | null>(null);
const form = ref<RoleForm>({ name: '', enabled: true, permissions: [] });
const formRef = ref();
// 折叠面板：默认全部收起
const activeGroups = ref<string[]>([]);

async function fetchAll(){
	try {
		loading.value = true;
		const [r, m] = await Promise.all([adminRoleControllerListRoles(), adminRoleControllerListMenus()]);
		roles.value = r;
		menus.value = m;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载失败'));
	} finally {
		loading.value = false;
	}
}

const rules = {
	name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
};

function noop() {}

const displayRoles = computed(() => {
	const kw = String(keyword.value || '').trim();
	if (!kw) return roles.value;
	return roles.value.filter((r) => String(r.name || '').includes(kw));
});

function openCreate(){
	current.value = null;
	form.value = { name: '', enabled: true, permissions: [] };
	permKeyword.value = '';
	// 默认展开所有有内容的分组，体验更友好
	activeGroups.value = menuGroups.value.filter((g) => g.children.length > 0).map((g) => g.key);
	dialogVisible.value = true;
}
function openEdit(row: AdminRoleDto){
	current.value = row;
	// 注意：permissions 必须拷贝，避免弹窗内勾选直接“串改”列表行数据
	form.value = { id: row.id, name: row.name, enabled: row.enabled, permissions: [...(row.permissions || [])] };
	permKeyword.value = '';
	activeGroups.value = menuGroups.value.filter((g) => g.children.length > 0).map((g) => g.key);
	dialogVisible.value = true;
}

async function onSave(){
	try {
		saving.value = true;
		if (formRef.value) await formRef.value.validate();
		const name = String(form.value.name || '').trim();
		if (!name) { ElMessage.error('请输入角色名称'); return; }
		const payload = { name, enabled: !!form.value.enabled, permissions: form.value.permissions || [] };
		if (current.value?.id) await adminRoleControllerUpdateRole(String(current.value.id), payload as any);
		else await adminRoleControllerCreateRole(payload as any);
		dialogVisible.value = false;
		ElMessage.success('已保存');
		await fetchAll();
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '保存失败'));
	} finally {
		saving.value = false;
	}
}

async function remove(row: AdminRoleDto){
	try {
		await ElMessageBox.confirm(`确定删除角色「${row.name}」吗？删除后不可恢复。`, '删除确认', { type: 'warning' });
		await adminRoleControllerRemoveRole(String(row.id));
		ElMessage.success('已删除');
		await fetchAll();
	} catch (e: any) {
		// 用户取消不提示错误
		if (String(e || '').includes('cancel')) return;
		ElMessage.error(String(e?.message || e || '删除失败'));
	}
}

function isToggling(id: number){ return togglingIds.value.includes(id); }
function startToggling(id: number){ if (!isToggling(id)) togglingIds.value = [...togglingIds.value, id]; }
function stopToggling(id: number){ togglingIds.value = togglingIds.value.filter((x) => x !== id); }

async function onToggleEnabled(row: AdminRoleDto, nextEnabled: boolean){
	if (row.isSystem) return;
	if (isToggling(row.id)) return;
	// el-switch 的 @change 触发时 row.enabled 已经是新值；回滚必须使用旧值
	const prev = !nextEnabled;
	startToggling(row.id);
	try {
		await adminRoleControllerUpdateRole(String(row.id), { enabled: row.enabled } as any);
		ElMessage.success(row.enabled ? '已启用' : '已禁用');
	} catch (e: any) {
		row.enabled = prev;
		ElMessage.error(String(e?.message || e || '更新失败'));
	} finally {
		stopToggling(row.id);
	}
}

onMounted(fetchAll);

// 菜单分组：根据 path 前缀或业务手动分组
type MenuGroup = { key: string; name: string; children: AdminMenuDto[] };
const menuGroups = computed<MenuGroup[]>(() => {
	const groups: Record<string, MenuGroup> = {
		dashboard: { key: 'dashboard', name: '系统首页', children: [] },
		members: { key: 'members', name: '会员管理', children: [] },
		groups: { key: 'groups', name: '集团管理', children: [] },
		vehicles: { key: 'vehicles', name: '车辆管理', children: [] },
		store: { key: 'store', name: '商店管理', children: [] },
		orders: { key: 'orders', name: '订单管理', children: [] },
		coupon: { key: 'coupon', name: '卡券管理', children: [] },
		content: { key: 'content', name: '内容管理', children: [] },
		notification: { key: 'notification', name: '消息通知', children: [] },
		system: { key: 'system', name: '系统设置', children: [] },
		other: { key: 'other', name: '未分类', children: [] },
	};

	const assigned = new Set<string>();
	const pushTo = (k: keyof typeof groups, m: AdminMenuDto, strategy: 'push' | 'unshift' = 'push') => {
		if (strategy === 'unshift') groups[k].children.unshift(m);
		else groups[k].children.push(m);
		assigned.add(m.key);
	};

	menus.value.forEach((m) => {
		if (m.key === 'dashboard-metrics') {
			pushTo('dashboard', m);
		} else if (m.key === 'members') {
			pushTo('members', m, 'unshift');
		} else if (m.key === 'member-coupons') {
			// 指定：会员卡券归入卡券管理
			pushTo('coupon', m);
		} else if (m.key.startsWith('member-') && m.key !== 'member-vehicles' && m.key !== 'member-washcards') {
			pushTo('members', m);
		} else if (['member-vehicles', 'service-queue'].includes(m.key)) {
			pushTo('vehicles', m);
		} else if (['group', 'group-vehicles', 'group-cards', 'group-balance'].includes(m.key)) {
			pushTo('groups', m);
		} else if (m.key.startsWith('store-')) {
			pushTo('store', m);
		} else if (['orders', 'after-sales', 'orders-writeoff'].includes(m.key)) {
			pushTo('orders', m);
		} else if (m.key.startsWith('coupon')) {
			pushTo('coupon', m);
		} else if (m.key.startsWith('content-')) {
			pushTo('content', m);
		} else if (m.key.startsWith('notification-')) {
			pushTo('notification', m);
		} else if (m.key.startsWith('system-')) {
			pushTo('system', m);
		} else if (m.key === 'member-washcards') {
			pushTo('members', m);
		}
	});

	// 兜底：后端新增菜单时，前端也必须可见/可勾选，避免“丢权限”
	menus.value.forEach((m) => {
		if (!assigned.has(m.key)) pushTo('other', m);
	});

	// 保持固定顺序，并过滤空组
	return [
		groups.dashboard,
		groups.members,
		groups.groups,
		groups.vehicles,
		groups.store,
		groups.orders,
		groups.coupon,
		groups.content,
		groups.notification,
		groups.system,
		groups.other,
	].filter((g) => g.children.length > 0);
});

const filteredMenuGroups = computed<MenuGroup[]>(() => {
	const kw = String(permKeyword.value || '').trim().toLowerCase();
	if (!kw) return menuGroups.value;
	return menuGroups.value.map((g) => ({
		...g,
		children: g.children.filter((m) => String(m.name || '').toLowerCase().includes(kw) || String(m.key || '').toLowerCase().includes(kw)),
	}));
});

function isGroupChecked(g: MenuGroup){
  const perms = new Set(form.value.permissions as string[]);
  return g.children.length>0 && g.children.every(c => perms.has(c.key));
}
function isGroupIndeterminate(g: MenuGroup){
  const perms = new Set(form.value.permissions as string[]);
  const hasAny = g.children.some(c => perms.has(c.key));
  return hasAny && !isGroupChecked(g);
}
function toggleGroup(g: MenuGroup, val: boolean){
  const currentPerms = new Set(form.value.permissions as string[]);
  g.children.forEach(c => { if (val) currentPerms.add(c.key); else currentPerms.delete(c.key); });
  form.value.permissions = Array.from(currentPerms);
}
function selectAll(){ form.value.permissions = menus.value.map(m => m.key); }
function deselectAll(){ form.value.permissions = []; }
function invertAll(){
  const all = menus.value.map(m => m.key);
  const current = new Set(form.value.permissions as string[]);
  form.value.permissions = all.filter(k => !current.has(k));
}
function invertGroup(g: MenuGroup){
  const currentPerms = new Set(form.value.permissions as string[]);
  g.children.forEach(c => { if (currentPerms.has(c.key)) currentPerms.delete(c.key); else currentPerms.add(c.key); });
  form.value.permissions = Array.from(currentPerms);
}
function selectedCount(g: MenuGroup){
  const current = new Set(form.value.permissions as string[]);
  return g.children.filter(c => current.has(c.key)).length;
}
</script>




<style scoped>
.role-actions{ display:flex; align-items:center; gap:10px; flex-wrap: wrap; }
.role-actions .search{ width: 220px; }
.role-tip{ margin-bottom: 10px; border-radius: 12px; }
.role-table :deep(.el-table__inner-wrapper){ border-radius: 12px; overflow: hidden; }
.role-name{ display:flex; align-items:center; gap:8px; }
.role-name .text{ font-weight: 650; color: var(--el-text-color-primary); }

.role-form{ width: 100%; }
.role-card{ border-radius: 14px; border: 1px solid var(--el-border-color-lighter); background: var(--el-bg-color); }
.role-card + .role-card{ margin-top: 12px; }
.role-card :deep(.el-card__header){
	padding: 12px 14px;
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 35%);
	border-bottom: 1px solid var(--el-border-color-lighter);
}
.role-card :deep(.el-card__body){ padding: 14px 14px 12px; }
.card-header{ display:flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.card-header > *{ min-width: 0; }
.card-header .title{ font-weight: 750; color: var(--el-text-color-primary); letter-spacing: .2px; }
.card-header .desc{
	color: var(--el-text-color-secondary);
	font-size: 12px;
	/* 关键：flex item 默认 min-width:auto 会导致右侧溢出被裁切 */
	flex: 1 1 320px;
	text-align: right;
	white-space: normal;
	overflow-wrap: anywhere;
}
@media (max-width: 520px){
	.card-header .desc{ text-align: left; }
}
.card-header .req{ position: relative; padding-left: 10px; }
.card-header .req::before{
	content: '*';
	position: absolute;
	left: 0;
	top: 0;
	color: var(--el-color-danger);
	font-weight: 700;
}

.grid2{ display:grid; grid-template-columns: 1.2fr 1fr; gap: 14px; }
@media (max-width: 860px){ .grid2{ grid-template-columns: 1fr; } }
.muted{ color: var(--el-text-color-secondary); font-size: 12px; }
.inline{ display:flex; align-items:center; gap: 10px; flex-wrap: wrap; min-width: 0; }

.perm-block{ margin-top: 6px; }
.perm-card :deep(.el-form-item__label){
	/* “菜单权限”放到了卡片 header 里，这里用占位 label，避免整体对齐抖动 */
	color: transparent;
}
.perm-toolbar{
	width: 100%;
	display:flex;
	align-items:center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 10px;
	flex-wrap: wrap;
}
.perm-toolbar .left{ display:flex; align-items:center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.perm-toolbar .right{ display:flex; align-items:center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.perm-search{ width: 340px; max-width: 100%; }
.perm-toolbar .left :deep(.el-input){ flex: 1 1 260px; }
.perm-toolbar .right :deep(.el-button){ border-radius: 10px; }
.perm-toolbar > *{ min-width: 0; }
.perm-scroll{
	width: 100%;
	max-height: 52vh;
	/* 容器本身不做裁切，避免“右侧被遮挡” */
}
.perm-scroll :deep(.el-scrollbar__wrap){
	/* 仅禁止横向滚动（不裁切 view 内容），纵向滚动正常 */
	overflow-x: hidden !important;
}
.perm-scroll :deep(.el-scrollbar__view){
	/* 让 view 始终以容器宽度排版，并为右侧纵向滚动条预留空间 */
	width: 100%;
	max-width: 100%;
	box-sizing: border-box;
	/* Element Plus 的 scrollbar 是 overlay：必须预留更大的安全边距 */
	padding-right: 28px;
}
.perm-scroll :deep(.el-scrollbar__bar.is-vertical){
	right: 8px;
}
.perm-collapse{
	width: 100%;
	max-width: 100%;
}
.perm-collapse :deep(.el-collapse){
	max-width: 100%;
}
.perm-collapse :deep(.el-collapse-item){
	max-width: 100%;
}
.perm-collapse :deep(.el-collapse-item__header){
	border-radius: 12px;
	padding: 10px 14px;
	/* 关键：不要固定高度，否则换行会被压缩/裁切且容易触发横向溢出 */
	min-height: 44px;
	height: auto;
	white-space: normal;
	background: color-mix(in oklab, var(--el-fill-color-light), transparent 45%);
	border: 1px solid var(--el-border-color-light);
	margin-bottom: 10px;
	box-sizing: border-box;
	/* 右侧还要额外留白，避免内容贴着滚动条或被覆盖 */
	padding-right: 34px;
}
.perm-collapse :deep(.el-collapse-item__header .el-collapse-item__arrow){
	/* 箭头对齐在中线，换行时更自然 */
	align-self: center;
}
.perm-collapse :deep(.el-collapse-item__wrap){
	border: none;
	margin: -6px 0 10px;
}
.perm-group__header {
	display:flex;
	align-items:center;
	justify-content: space-between;
	gap: 12px;
	width: 100%;
	/* 窄宽时让工具区换行，不要撑出横向滚动 */
	flex-wrap: wrap;
}
.perm-group__header .title{ min-width: 0; }
.perm-group__header .gname{ font-weight: 650; color: var(--el-text-color-primary); }
.perm-group__tools { display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }

.perm-grid {
	display:grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px 12px;
	padding: 6px 2px 14px;
}
@media (max-width: 980px) { .perm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .perm-grid { grid-template-columns: 1fr; } }

.perm-grid :deep(.el-checkbox){
	/* 让单个项在网格列内完整占宽，避免 label 以内容宽度撑破列 */
	display: flex;
	align-items: flex-start;
	width: 100%;
	min-width: 0;
	margin-right: 0;
	padding: 10px 10px;
	border-radius: 12px;
	border: 1px solid var(--el-border-color-lighter);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 25%);
	transition: transform .12s ease, border-color .12s ease, background .12s ease, box-shadow .12s ease;
}
.perm-grid :deep(.el-checkbox:hover){
	border-color: color-mix(in oklab, var(--el-color-primary), var(--el-border-color-lighter) 70%);
	box-shadow: 0 10px 24px rgba(15, 23, 42, .06);
	transform: translateY(-1px);
}
.perm-grid :deep(.el-checkbox.is-checked){
	background: color-mix(in oklab, var(--el-color-primary), var(--el-bg-color) 92%);
	border-color: color-mix(in oklab, var(--el-color-primary), var(--el-border-color-lighter) 55%);
}
.perm-grid :deep(.el-checkbox__label){
	min-width: 0;
	white-space: normal;
}
.perm-item{
	display:flex;
	flex-direction: column;
	gap: 2px;
	line-height: 1.25;
	min-width: 0;
}
.perm-item .name{ font-size: 13px; color: var(--el-text-color-primary); font-weight: 550; }
.perm-item .key{
	font-size: 11px;
	color: var(--el-text-color-secondary);
	/* key 过长时允许断行，避免撑出横向滚动 */
	overflow-wrap: anywhere;
	word-break: break-word;
}

.perm-empty{ padding: 10px 0 0; }

.role-dialog :deep(.el-dialog){
	border-radius: 16px;
	overflow: hidden;
	box-shadow: 0 18px 48px rgba(15, 23, 42, .18);
}
.role-dialog :deep(.el-dialog__header){
	padding: 14px 16px 10px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 42%);
}
.role-dialog :deep(.el-dialog__body){
	padding: 14px 16px 4px;
}
.role-dialog :deep(.el-dialog__footer){
	padding: 12px 16px 14px;
	border-top: 1px solid var(--el-border-color-lighter);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 42%);
}
</style>