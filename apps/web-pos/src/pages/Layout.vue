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
					<!-- 营业状态按钮 -->
					<el-popover placement="bottom-end" trigger="click" :width="320" :show-arrow="false" :teleported="true">
						<template #reference>
							<el-button class="status-btn" text :title="`营业状态：${businessLabel}`" aria-label="营业状态">
								<span class="dot" :data-type="businessType"></span>
								<span class="status-text">{{ businessLabel }}</span>
							</el-button>
						</template>
						<div class="biz-panel">
							<div class="row">
								<span>当前状态</span>
								<el-tag :type="businessType==='OPEN' ? 'success' : (businessType==='BUSY' ? 'warning' : businessType==='PAUSED' ? 'danger' : 'info')">{{ businessLabel }}</el-tag>
							</div>
							<div class="row">
								<span>营业时间</span>
								<div style="display:flex; align-items:center; gap:8px;">
									<el-time-select v-model="hoursStart" start="00:00" step="00:15" end="23:45" placeholder="开始" style="width:112px;" />
									<span style="color:#999;">-</span>
									<el-time-select v-model="hoursEnd" start="00:00" step="00:15" end="23:45" placeholder="结束" style="width:112px;" />
								</div>
							</div>
							<div class="row">
								<span>手动状态</span>
								<div class="toggles">
									<el-switch v-model="busyEnabled" :active-text="'忙碌'" :inactive-text="'—'" @change="onToggleBusy" />
									<el-switch v-model="pausedEnabled" :active-text="'暂停营业'" :inactive-text="'—'" @change="onTogglePaused" />
								</div>
							</div>
							<div class="row" style="justify-content:flex-end; gap:8px;">
								<el-button size="large" @click="reloadBusiness">刷新</el-button>
								<el-button size="large" type="primary" :loading="savingBiz" @click="saveBusiness">保存</el-button>
							</div>
						</div>
					</el-popover>
					<div class="notify-bell" title="消息通知" @click="openNotifyDrawer">
						<el-badge :value="unreadCountText" :hidden="unreadCount===0" class="bell-badge">
							<el-icon><Bell /></el-icon>
						</el-badge>
					</div>
					<el-dropdown>
						<span class="user-trigger" title="当前账号">
							<el-avatar class="user-avatar" :size="28" :src="formatAvatar(avatarUrl)" />
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
		<!-- 通知抽屉（POS 触屏优化） -->
		<el-drawer v-model="notifyDrawer" :with-header="false" size="420px" append-to-body :modal-append-to-body="false">
			<div class="notify-drawer">
				<div class="notify-drawer__header">
					<div class="title">消息通知</div>
					<div class="actions">
						<el-button size="large" @click="reloadNotifications" :loading="notifyLoading">刷新</el-button>
						<el-button size="large" type="primary" plain @click="markAllRead" :disabled="!notifications.some(n=>n.status==='UNREAD')">全部已读</el-button>
					</div>
				</div>
				<el-scrollbar class="notify-list">
					<div v-for="n in notifications" :key="n.id" class="notify-item" :data-unread="n.status==='UNREAD'" @click="openNotification(n)">
						<div class="item-title">
							<span class="dot" v-if="n.status==='UNREAD'"></span>
							<span class="text">{{ n.title }}</span>
						</div>
						<div class="item-content" v-if="n.content">{{ n.content }}</div>
						<div class="item-foot">
							<span class="time">{{ formatTime(n.createdAt) }}</span>
							<div class="ops" @click.stop>
								<el-button link size="large" type="primary" @click="markRead(n)" :disabled="n.status==='READ'">标记已读</el-button>
							</div>
						</div>
					</div>
					<div v-if="!notifications.length && !notifyLoading" class="notify-empty">暂无消息</div>
				</el-scrollbar>
			</div>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { absUrl } from '../utils/http';
import { API_BASE } from '../config';
import { ElMessageBox } from 'element-plus';
import { HomeFilled, ShoppingCart, Tickets, SwitchButton, Bell } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();

const pageTitle = computed(()=> String((route.meta as any)?.title || ''));
const userName = computed(()=>{
	try { return JSON.parse(localStorage.getItem('user')||'{}')?.name || '用户'; } catch { return '用户'; }
});
const avatarUrl = ref<string | null>(null);
// 营业状态
type BizStatus = 'OPEN'|'REST'|'BUSY'|'PAUSED';
const businessType = ref<BizStatus>('REST');
const businessLabel = ref<string>('休息中');
const hoursStart = ref<string>('09:00');
const hoursEnd = ref<string>('18:00');
const busyEnabled = ref<boolean>(false);
const pausedEnabled = ref<boolean>(false);
const savingBiz = ref(false);
function onToggleBusy(){ if (busyEnabled.value) pausedEnabled.value = false; }
function onTogglePaused(){ if (pausedEnabled.value) busyEnabled.value = false; }
async function reloadBusiness(){
    try{
        const res = await fetch(`${API_BASE}/system/public/business-status`);
        const j:any = await res.json();
        hoursStart.value = String(j?.hours?.start||'09:00');
        hoursEnd.value = String(j?.hours?.end||'18:00');
        busyEnabled.value = !!j?.busyEnabled;
        pausedEnabled.value = !!j?.pausedEnabled;
        businessType.value = (j?.status||'REST') as BizStatus;
        businessLabel.value = String(j?.label||'休息中');
    }catch{}
}
async function saveBusiness(){
    try{
        savingBiz.value = true;
        const token = localStorage.getItem('token')||'';
        await fetch(`${API_BASE}/system/site-setting`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ businessHoursJson: { start: hoursStart.value, end: hoursEnd.value }, busyEnabled: busyEnabled.value, pausedEnabled: pausedEnabled.value }) });
        await reloadBusiness();
    }catch{}
    finally{ savingBiz.value = false; }
}

function formatAvatar(url?: string | null){
	try{
		const s = String(url||'').trim();
		if (s) return absUrl(s);
		// 未设置头像则给一个内置默认图（走后端静态 /uploads 路径）
		return absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png');
	}catch{
		return absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png');
	}
}

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

// 通知：未读与 WS + 抽屉
const unreadCount = ref<number>(0);
const unreadCountText = computed(()=> unreadCount.value>99 ? '99+' : String(unreadCount.value));
let ws: WebSocket | null = null;
async function refreshUnread(){
    try{
        const token = localStorage.getItem('token')||'';
        const res = await fetch(`${API_BASE}/notification/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
        const j:any = await res.json();
        unreadCount.value = Number(j?.count||0);
    }catch{ unreadCount.value = 0; }
}
function connectWS(){
    try{
        const url = new URL(API_BASE);
        const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = localStorage.getItem('token')||'';
        const wsUrl = `${proto}//${url.host}/ws?token=${encodeURIComponent(token)}`;
        ws = new WebSocket(wsUrl);
        ws.onmessage = async (ev)=>{
            try{
                const msg = JSON.parse(ev.data||'{}');
                if (msg?.type === 'notification'){
                    unreadCount.value += 1;
                    const { ElNotification } = await import('element-plus');
                    const ui:any = msg?.data?.ui || {};
                    ElNotification({ title: String(msg.data?.title||'新消息'), message: String(msg.data?.content||''), position: ui?.position || 'top-right', type: ui?.type || 'info', duration: typeof ui?.duration==='number' ? ui.duration : 4500 });
                }
            }catch{}
        };
        ws.onclose = ()=>{ ws=null; setTimeout(connectWS, 2000); };
    }catch{}
}
function openNotifyDrawer(){ notifyDrawer.value = true; reloadNotifications(); }
function formatTime(t:string){ try{ const d=new Date(t); const p=(n:number)=> String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }catch{ return t; } }

type N = { id:number; title:string; content?:string|null; linkPath?:string|null; status:'UNREAD'|'READ'; createdAt:string };
const notifyDrawer = ref(false);
const notifyLoading = ref(false);
const notifications = ref<N[]>([]);
async function reloadNotifications(){
    notifyLoading.value = true;
    try{
        const token = localStorage.getItem('token')||'';
        const res = await fetch(`${API_BASE}/notification/list`, { headers: { Authorization: `Bearer ${token}` } });
        const arr:any[] = await res.json();
        notifications.value = Array.isArray(arr)? arr: [];
    }catch{ notifications.value = []; }
    finally{ notifyLoading.value = false; }
}
async function markRead(n:N){
    try{
        const token = localStorage.getItem('token')||'';
        await fetch(`${API_BASE}/notification/mark-read`, { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: n.id }) });
        if (n.status==='UNREAD'){ n.status='READ'; unreadCount.value = Math.max(0, unreadCount.value-1); }
    }catch{}
}
async function markAllRead(){
    try{
        const token = localStorage.getItem('token')||'';
        await fetch(`${API_BASE}/notification/mark-read-all`, { method:'POST', headers: { Authorization: `Bearer ${token}` } });
        notifications.value.forEach(n=>{ if(n.status==='UNREAD') n.status='READ'; });
        refreshUnread();
    }catch{}
}
function openNotification(n:N){ if (n.linkPath){ try{ router.push(n.linkPath); }catch{} } if (n.status==='UNREAD'){ markRead(n); } }

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
	try{ const u = JSON.parse(localStorage.getItem('user')||'{}'); avatarUrl.value = u?.avatarUrl ?? null; }catch{}
	addOrActivateCurrent();
	window.addEventListener('pos-set-tab', handleSetTab as any);
    reloadBusiness();
    refreshUnread();
    connectWS();
});
onBeforeUnmount(()=>{
	window.removeEventListener('pos-set-tab', handleSetTab as any);
    try{ ws?.close(); }catch{} ws=null;
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
.user-trigger{ display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 8px; border-radius:9999px; background:#f6f8fb; border:1px solid #ebeef5; transition: background .15s ease, border-color .15s ease; }
.user-trigger:hover{ background:#f1f5ff; border-color:#e5efff; }
.user-avatar :deep(img){ border-radius:50%; }
.name{ font-size:14px; color:#303133; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; }
.notify-bell{ display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; cursor:pointer; border-radius:10px; }
.notify-bell:hover{ background:#f6f8fb; }
.notify-bell :deep(.el-icon){ font-size:22px; color:#606266; }
.notify-bell:hover :deep(.el-icon){ color:#409eff; }
.status-btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 10px; border-radius:9999px; border:1px solid #ebeef5; background:#fff; }
.status-btn .status-text{ font-weight:700; color:#303133; font-size:13px; }
.status-btn .dot{ width:10px; height:10px; border-radius:50%; display:inline-block; }
.status-btn .dot[data-type="OPEN"]{ background:#22c55e; }
.status-btn .dot[data-type="REST"]{ background:#94a3b8; }
.status-btn .dot[data-type="BUSY"]{ background:#f59e0b; }
.status-btn .dot[data-type="PAUSED"]{ background:#ef4444; }
.biz-panel{ display:flex; flex-direction:column; gap:12px; }
.biz-panel .row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.biz-panel .toggles{ display:flex; align-items:center; gap:14px; }
.bell-badge :deep(.el-badge__content){
    transform: translate(9px, -9px);
    height:18px; min-width:20px; padding:0 6px;
    border-radius:9999px; line-height:18px; font-size:12px; font-weight:700;
    box-shadow: 0 0 0 2px #fff;
}
@media (max-width: 960px){
	.sidebar{ width:76px; }
	.menu-item{ padding:12px 6px; }
	.menu-item .label{ font-size:11px; }
	.topbar{ height:52px; }
}
/* 抽屉列表样式（触屏适配更大触点） */
.notify-drawer{ display:flex; flex-direction:column; height:100%; }
.notify-drawer__header{ display:flex; align-items:center; justify-content:space-between; padding:10px 12px 8px; border-bottom:1px solid #ebeef5; }
.notify-drawer__header .title{ font-weight:700; font-size:16px; }
.notify-list{ padding:10px; }
.notify-item{ padding:14px 12px 10px; border-radius:12px; border:1px solid #e5e7eb; margin-bottom:10px; }
.notify-item[data-unread="true"]{ background:#f6f8fb; border-color:#dbeafe; }
.notify-item .item-title{ display:flex; align-items:center; gap:8px; font-weight:700; color:#303133; font-size:14px; }
.notify-item .item-title .dot{ width:8px; height:8px; border-radius:50%; background:#ff4d4f; display:inline-block; }
.notify-item .item-content{ color:#606266; margin-top:8px; font-size:13px; line-height:1.5; }
.notify-item .item-foot{ display:flex; align-items:center; justify-content:space-between; margin-top:8px; color:#909399; font-size:12px; }
.notify-empty{ padding: 28px 8px; text-align:center; color:#909399; }
</style>


