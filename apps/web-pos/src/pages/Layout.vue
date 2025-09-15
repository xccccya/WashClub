<template>
	<div class="layout">
		<aside class="sidebar">
			<nav class="menu">
				<button class="menu-item" :class="{ active: isActive('/') }" @click="go('/')">
					<el-icon size="22"><HomeFilled /></el-icon>
					<span class="label">首页</span>
				</button>
				<button class="menu-item" :class="{ active: isActive('/cashier') }" @click="go('/cashier')">
					<el-icon size="22"><ShoppingCart /></el-icon>
					<span class="label">收银</span>
				</button>
				<button class="menu-item" :class="{ active: isActive('/service-queue') }" @click="go('/service-queue')">
					<el-icon size="22"><Tickets /></el-icon>
					<span class="label">服务队列</span>
				</button>
				<button class="menu-item" :class="{ active: isActive('/orders') }" @click="go('/orders')">
					<el-icon size="22"><Tickets /></el-icon>
					<span class="label">订单</span>
				</button>
			</nav>
		</aside>
		<main class="content">
			<header class="topbar">
				<div class="tabs">
					<template v-if="isOrdersRoute">
						<el-tabs v-model="activeTab" @tab-remove="closeTab" @tab-click="onTabClick" class="route-tabs">
							<el-tab-pane v-for="t in tabs" :key="t.path" :name="t.path" :label="t.title" :closable="t.closable" />
						</el-tabs>
					</template>
					<template v-else>
						<el-breadcrumb separator="/">
							<el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
						</el-breadcrumb>
					</template>
				</div>
				<div class="user">
					<el-dropdown>
						<span class="user-trigger">
							<el-icon><UserFilled /></el-icon>
							<span class="name">{{ userName }}</span>
						</span>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item @click="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
				</div>
			</header>
			<section class="page-body">
				<router-view v-slot="{ Component, route }">
					<transition name="fade" mode="out-in">
						<keep-alive :include="['Orders','OrderDetail']">
							<component :is="Component" :key="route.fullPath" />
						</keep-alive>
					</transition>
				</router-view>
			</section>
		</main>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { absUrl } from '../utils/http';
import { ElMessageBox } from 'element-plus';
import { HomeFilled, ShoppingCart, Tickets, UserFilled, SwitchButton } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();

const pageTitle = computed(()=> String((route.meta as any)?.title || ''));
const userName = computed(()=>{
	try { return JSON.parse(localStorage.getItem('user')||'{}')?.name || '用户'; } catch { return '用户'; }
});

function isActive(path: string){
	if (path === '/orders') return route.path.startsWith('/orders');
	return route.path === path;
}
function go(path: string){
	if (route.path !== path) router.push(path);
}
async function logout(){
	try{
		await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' });
		localStorage.removeItem('token');
		localStorage.removeItem('user');
		router.push('/login');
	}catch{}
}

// 订单多标签逻辑
type OrderTab = { path:string; title:string; closable:boolean };
const tabs = ref<OrderTab[]>([]);
const activeTab = ref<string>('');
const isOrdersRoute = computed(()=> route.path.startsWith('/orders'));

function ensureOrdersListTab(){
	const exists = tabs.value.some(t=> t.path==='/orders');
	if (!exists) tabs.value.unshift({ path:'/orders', title:'订单列表', closable:false });
}
function addOrActivateCurrent(){
	if (!isOrdersRoute.value){ return; }
	ensureOrdersListTab();
	const p = route.fullPath;
	const isList = route.path === '/orders';
	const exists = tabs.value.find(t=> t.path===p);
	if (!exists){
		const title = isList ? '订单列表' : guessTitleFromRoute(route.path);
		tabs.value.push({ path: p, title, closable: !isList });
	}
	activeTab.value = p;
}
function guessTitleFromRoute(path:string){
	try{
		if (/^\/orders\/no\//.test(path)) return '订单(按单号)';
		const m = path.match(/^\/orders\/(\d+)/); if (m) return `订单 #${m[1]}`;
		return '订单';
	}catch{ return '订单'; }
}
function onTabClick(pane:any){
	const name = String(pane.paneName||pane.props?.name||'');
	if (name && name!==route.fullPath){ router.push(name); }
}
function closeTab(name:string){
	const idx = tabs.value.findIndex(t=> t.path===name);
	if (idx<0) return;
	const removingActive = (tabs.value[idx]?.path===activeTab.value);
	tabs.value.splice(idx,1);
	if (removingActive){
		const fallback = tabs.value[idx-1] || tabs.value[idx] || tabs.value.find(t=> t.path==='/orders');
		if (fallback) router.push(fallback.path);
	}
}

function handleSetTab(ev: any){
	try{
		const d = ev?.detail || {};
		const path = String(d.path||'');
		const title = String(d.title||'');
		if (!path || !title) return;
		const t = tabs.value.find(x=> x.path===path);
		if (t){ t.title = title; }
	}catch{}
}
onMounted(()=>{
	addOrActivateCurrent();
	window.addEventListener('pos-set-tab', handleSetTab as any);
});
onBeforeUnmount(()=>{
	window.removeEventListener('pos-set-tab', handleSetTab as any);
});
watch(()=> route.fullPath, ()=> addOrActivateCurrent());
</script>

<style scoped>
.layout{ position:fixed; inset:0; display:flex; background:#f5f7fa; }
.sidebar{ width:92px; background:#fff; border-right:1px solid #ebeef5; display:flex; flex-direction:column; align-items:center; padding:10px 0; }
.menu{ display:flex; flex-direction:column; gap:8px; width:100%; align-items:stretch; }
.menu-item{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:12px 10px; color:#606266; background:transparent; border:none; cursor:pointer; user-select:none; border-radius:10px; margin:0 6px; }
.menu-item .label{ font-size:12px; line-height:1; }
.menu-item.active, .menu-item:hover{ color:#409eff; background: #ecf5ff; }
.content{ flex:1; display:flex; flex-direction:column; min-width:0; }
.topbar{ height:60px; background:#fff; border-bottom:1px solid #ebeef5; display:flex; align-items:center; justify-content:space-between; padding:0 14px; }
.topbar .tabs{ flex:1; min-width:0; }
.route-tabs :deep(.el-tabs__nav){ user-select:none; }
.page-body{ flex:1; overflow:auto; padding:12px; }
.user{ display:flex; align-items:center; gap:8px; }
.user-trigger{ display:flex; align-items:center; gap:6px; cursor:pointer; }
.name{ font-size:14px; color:#303133; }
@media (max-width: 960px){
	.sidebar{ width:76px; }
	.menu-item{ padding:12px 6px; }
	.menu-item .label{ font-size:11px; }
	.topbar{ height:52px; }
}
</style>


