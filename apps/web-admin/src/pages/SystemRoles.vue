<template>
	<BasePage title="后台角色">
		<template #actions>
			<el-button type="primary" @click="openCreate">新增角色</el-button>
		</template>
		<el-table :data="roles" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="角色名称" />
			<el-table-column prop="enabled" label="状态" width="160">
				<template #default="{ row }">
					<el-switch v-model="row.enabled" :disabled="row.id===1" @change="onToggleEnabled(row)" />
					<span style="margin-left:8px;">{{ row.enabled ? '启用' : '禁用' }}</span>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="240">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)" :disabled="row.id===1">编辑</el-button>
					<el-button size="small" type="danger" @click="remove(row)" :disabled="row.id===1">删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑角色' : '新增角色'" width="560px">
			<el-form :model="form" label-width="100px">
				<el-form-item label="角色名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
				<el-form-item label="菜单权限">
					<div style="margin-bottom:8px;">
						<el-button size="small" @click="selectAll">全选</el-button>
						<el-button size="small" @click="deselectAll">全不选</el-button>
						<el-button size="small" @click="invertAll">反选</el-button>
					</div>
					<el-collapse v-model="activeGroups" class="perm-collapse">
						<el-collapse-item v-for="g in menuGroups" :key="g.key" :name="g.key">
							<template #title>
								<div class="perm-group__header">
									<el-checkbox :model-value="isGroupChecked(g)" :indeterminate="isGroupIndeterminate(g)" @change="(val:any)=>toggleGroup(g, val)">{{ g.name }}</el-checkbox>
									<div class="perm-group__tools">
										<span class="count">{{ selectedCount(g) }}/{{ g.children.length }}</span>
										<el-button text size="small" @click.stop="toggleGroup(g, true)">全选</el-button>
										<el-button text size="small" @click.stop="toggleGroup(g, false)">全不选</el-button>
										<el-button text size="small" @click.stop="invertGroup(g)">反选</el-button>
									</div>
								</div>
							</template>
							<el-checkbox-group v-model="form.permissions" class="perm-grid">
								<el-checkbox v-for="m in g.children" :key="m.key" :label="m.key">{{ m.name }}</el-checkbox>
							</el-checkbox-group>
						</el-collapse-item>
					</el-collapse>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" @click="onSave">保存</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Role = { id: number; name: string; enabled: boolean; isSystem: boolean; permissions: string[] };
type Menu = { key: string; name: string; path: string };
const roles = ref<Role[]>([]);
const menus = ref<Menu[]>([]);
const dialogVisible = ref(false);
const current = ref<Role | null>(null);
const form = ref<Partial<Role>>({ name: '', enabled: true, permissions: [] });
// 折叠面板：默认全部收起
const activeGroups = ref<string[]>([]);

async function fetchAll(){
	roles.value = await http<Role[]>('/system/roles', { method: 'GET' });
	menus.value = await http<Menu[]>('/system/menus', { method: 'GET' });
}

function openCreate(){ current.value = null; form.value = { name: '', enabled: true, permissions: [] }; dialogVisible.value = true; }
function openEdit(row: Role){ current.value = row; form.value = { id: row.id, name: row.name, enabled: row.enabled, permissions: row.permissions || [] }; dialogVisible.value = true; }

async function onSave(){
	const payload = { name: form.value.name!, enabled: !!form.value.enabled, permissions: form.value.permissions || [] } as any;
	if (current.value?.id) await http(`/system/roles/${current.value.id}`, { method: 'PUT', body: payload });
	else await http('/system/roles', { method: 'POST', body: payload });
	dialogVisible.value = false; ElMessage.success('已保存'); fetchAll();
}

async function remove(row: Role){ await http(`/system/roles/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchAll(); }

async function onToggleEnabled(row: Role){
	await http(`/system/roles/${row.id}`, { method: 'PUT', body: { enabled: row.enabled } });
	ElMessage.success(row.enabled ? '已启用' : '已禁用');
}

onMounted(fetchAll);

// 菜单分组：根据 path 前缀或业务手动分组
type MenuGroup = { key: string; name: string; children: Menu[] };
const menuGroups = computed<MenuGroup[]>(() => {
  const groups: Record<string, MenuGroup> = {
    members: { key: 'members', name: '会员管理', children: [] },
    vehicles: { key: 'vehicles', name: '车辆管理', children: [] },
    store: { key: 'store', name: '商店管理', children: [] },
    orders: { key: 'orders', name: '订单管理', children: [] },
    coupon: { key: 'coupon', name: '卡券管理', children: [] },
    content: { key: 'content', name: '内容管理', children: [] },
    system: { key: 'system', name: '系统设置', children: [] },
  };
  menus.value.forEach(m => {
    if (m.key === 'members') {
      groups.members.children.unshift(m);
    } else if (m.key.startsWith('member-') && m.key !== 'member-vehicles' && m.key !== 'member-washcards') {
      groups.members.children.push(m);
    } else if (['member-vehicles','service-queue'].includes(m.key)) {
      groups.vehicles.children.push(m);
    } else if (m.key.startsWith('store-')) {
      groups.store.children.push(m);
    } else if (['orders','after-sales'].includes(m.key)) {
      groups.orders.children.push(m);
    } else if (m.key.startsWith('coupon')) {
      groups.coupon.children.push(m);
    } else if (m.key.startsWith('content-')) {
      groups.content.children.push(m);
    } else if (m.key.startsWith('system-')) {
      groups.system.children.push(m);
    } else if (m.key === 'member-washcards') {
      groups.members.children.push(m);
    }
  });
  // 保持固定顺序
  return [groups.members, groups.vehicles, groups.store, groups.orders, groups.coupon, groups.content, groups.system];
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
.perm-group { margin-bottom: 10px; }
.perm-group__header { display:flex; align-items:center; justify-content: space-between; }
.perm-group__tools { display:flex; align-items:center; gap: 8px; }
.perm-group__tools .count { color:#999; font-size:12px; margin-right:6px; }
.perm-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px 12px; padding-top: 4px; }
@media (max-width: 520px) { .perm-grid { grid-template-columns: repeat(2, 1fr); } }
</style>