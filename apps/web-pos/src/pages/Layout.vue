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
			<header v-if="!hideTopbar" class="topbar" :class="{ compact: isCompact }">
				<div class="topbar__left">
					<template v-if="isOrdersRoute">
						<el-tabs
							v-model="activeTab"
							class="route-tabs"
							type="card"
							@tab-remove="closeTab"
							@tab-click="onTabClick"
						>
							<el-tab-pane v-for="t in tabs" :key="t.path" :name="t.path" :label="t.title" :closable="t.closable" />
						</el-tabs>
					</template>
					<template v-else>
						<div class="crumb">
							<el-breadcrumb separator="/">
								<el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
							</el-breadcrumb>
						</div>
					</template>
				</div>

				<div class="topbar__right">
					<el-space :size="8" alignment="center">
						<!-- 营业状态 -->
						<el-popover placement="bottom-end" trigger="click" :width="320" :show-arrow="false" :teleported="true">
						<template #reference>
							<!-- 注意：Popover 的 reference 在触控设备上不要再包一层 Tooltip，否则容易拦截点击导致无法打开面板 -->
							<el-button
								class="status-btn"
								round
								plain
								:color="bizColor"
								aria-label="营业状态"
								:title="`营业状态：${businessLabel}`"
							>
								<span class="dot" :data-type="businessType"></span>
								<span v-if="!isCompact" class="status-text">{{ businessLabel }}</span>
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

						<!-- 刷新页面 -->
						<el-tooltip content="刷新页面" placement="bottom" :show-after="250" :disabled="isTouch">
							<el-button class="icon-btn" text aria-label="刷新页面" @click="reloadPage">
								<el-icon><RefreshRight /></el-icon>
							</el-button>
						</el-tooltip>

						<!-- 通知 -->
						<el-tooltip content="消息通知" placement="bottom" :show-after="250" :disabled="isTouch">
							<el-badge :value="unreadCountText" :hidden="unreadCount===0" class="bell-badge">
								<el-button class="icon-btn" text aria-label="消息通知" @click="openNotifyDrawer">
									<el-icon><Bell /></el-icon>
								</el-button>
							</el-badge>
						</el-tooltip>

						<!-- 全屏（POS 常用） -->
						<el-tooltip :content="isFullscreen ? '退出全屏' : '进入全屏'" placement="bottom" :show-after="250" :disabled="isTouch">
							<el-button class="icon-btn" text aria-label="全屏切换" @click="toggleFullscreen">
								<el-icon><FullScreen /></el-icon>
							</el-button>
						</el-tooltip>

						<el-divider direction="vertical" class="topbar__divider" />

						<!-- 用户菜单 -->
						<el-dropdown trigger="click">
							<span class="user-trigger" title="当前账号">
								<el-avatar class="user-avatar" :size="28" :src="formatAvatar(avatarUrl)" />
								<span v-if="!isCompact" class="name">{{ userName }}</span>
							</span>
						<template #dropdown>
							<el-dropdown-menu>
								<el-dropdown-item @click="toggleFullscreen">
									<el-icon><FullScreen /></el-icon>
									{{ isFullscreen ? '退出全屏' : '进入全屏' }}
								</el-dropdown-item>
								<el-dropdown-item divided @click="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
							</el-dropdown-menu>
						</template>
					</el-dropdown>
					</el-space>
				</div>
			</header>
			<section class="page-body" :class="{ 'no-padding': noPagePadding, 'overflow-hidden': pageOverflowHidden }">
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
import { HomeFilled, ShoppingCart, Tickets, SwitchButton, Bell, FullScreen, RefreshRight } from '@element-plus/icons-vue';
import {
	notificationControllerList,
	notificationControllerMarkRead,
	notificationControllerMarkReadAll,
	notificationControllerUnreadCount,
	systemSettingControllerGetPublicBusinessStatus,
	systemSettingControllerGetPublicSetting,
	systemSettingControllerSaveBusinessSetting,
} from '@wash/api-client';

const route = useRoute();
const router = useRouter();

const pageTitle = computed(()=> String((route.meta as any)?.title || ''));
const hideTopbar = computed(()=> !!(route.meta as any)?.hideTopbar);
const noPagePadding = computed(()=> !!(route.meta as any)?.noPagePadding);
const pageOverflowHidden = computed(()=> !!(route.meta as any)?.pageOverflowHidden);
const userName = computed(()=>{
	try { return JSON.parse(localStorage.getItem('user')||'{}')?.name || '用户'; } catch { return '用户'; }
});
const avatarUrl = ref<string | null>(null);
const siteSetting = ref<{ defaultMemberAvatarUrl?: string | null } | null>(null);
async function ensureSiteSetting(){
	if (siteSetting.value) return;
	try{
		siteSetting.value = (await systemSettingControllerGetPublicSetting() as any) || null;
	} catch {
		siteSetting.value = { defaultMemberAvatarUrl: null };
	}
}
const isCompact = ref(false);
const isFullscreen = ref(false);
const isTouch = ref(false);
// 营业状态
type BizStatus = 'OPEN'|'REST'|'BUSY'|'PAUSED';
const businessType = ref<BizStatus>('REST');
const businessLabel = ref<string>('休息中');
const hoursStart = ref<string>('09:00');
const hoursEnd = ref<string>('18:00');
const busyEnabled = ref<boolean>(false);
const pausedEnabled = ref<boolean>(false);
const savingBiz = ref(false);
const bizColor = computed(()=>{
	// Element Plus Button 支持 :color 自定义（更贴合 POS “一眼可辨”）
	if (businessType.value === 'OPEN') return '#22c55e';
	if (businessType.value === 'BUSY') return '#f59e0b';
	if (businessType.value === 'PAUSED') return '#ef4444';
	return '#94a3b8';
});
function onToggleBusy(){ if (busyEnabled.value) pausedEnabled.value = false; }
function onTogglePaused(){ if (pausedEnabled.value) busyEnabled.value = false; }
async function reloadBusiness(){
    try{
        const j:any = await systemSettingControllerGetPublicBusinessStatus();
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
        await systemSettingControllerSaveBusinessSetting({
			businessHoursJson: { start: hoursStart.value, end: hoursEnd.value },
			busyEnabled: busyEnabled.value,
			pausedEnabled: pausedEnabled.value,
		} as any);
        await reloadBusiness();
    }catch{}
    finally{ savingBiz.value = false; }
}

function reloadPage(){
	try{ window.location.reload(); }catch{}
}

function formatAvatar(url?: string | null){
	try{
		const s = String(url||'').trim();
		if (s) return absUrl(s);
		// 未设置头像：优先使用站点默认头像（可随后台配置变化），其次兜底内置默认图
		const d = String(siteSetting.value?.defaultMemberAvatarUrl || '').trim();
		if (d) return absUrl(d);
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

function updateCompact(){
	try{
		// 13 寸左右平板常见横向宽度：~1024~1366；这里以 1100 作为“紧凑”阈值
		isCompact.value = window.matchMedia?.('(max-width: 1100px)')?.matches ?? (window.innerWidth <= 1100);
	}catch{}
}
function updateTouch(){
	try{
		// coarse 指触控为主的输入设备（平板/手机）
		isTouch.value = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
	}catch{ isTouch.value = false; }
}
function updateFullscreen(){
	try{ isFullscreen.value = !!document.fullscreenElement; }catch{}
}
async function toggleFullscreen(){
	try{
		if (document.fullscreenElement){
			await document.exitFullscreen();
			return;
		}
		await document.documentElement.requestFullscreen({ navigationUI: 'hide' } as any);
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
        const r:any = await notificationControllerUnreadCount();
        unreadCount.value = Number(r?.count||0);
    }catch{ unreadCount.value = 0; }
}
function connectWS(){
    try{
        const url = new URL(API_BASE);
        const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = localStorage.getItem('token')||'';
        const wsUrl = `${proto}//${url.host}/ws`;
        ws = new WebSocket(wsUrl);
        ws.onopen = ()=>{
            try { ws?.send?.(JSON.stringify({ type: 'auth', token })); } catch {}
        };
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
        const list:any[] = (await notificationControllerList({} as any) as unknown) as any[];
        notifications.value = Array.isArray(list)? list: [];
    }catch{ notifications.value = []; }
    finally{ notifyLoading.value = false; }
}
async function markRead(n:N){
    try{
        await notificationControllerMarkRead({ id:n.id } as any);
        if (n.status==='UNREAD'){ n.status='READ'; unreadCount.value = Math.max(0, unreadCount.value-1); }
    }catch{}
}
async function markAllRead(){
    try{
        await notificationControllerMarkReadAll();
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
	ensureSiteSetting();
	addOrActivateCurrent();
	window.addEventListener('pos-set-tab', handleSetTab as any);
    reloadBusiness();
    refreshUnread();
    connectWS();
	updateCompact();
	updateTouch();
	updateFullscreen();
	try{
		window.addEventListener('resize', updateCompact, { passive: true } as any);
		window.addEventListener('resize', updateTouch, { passive: true } as any);
		document.addEventListener('fullscreenchange', updateFullscreen, { passive: true } as any);
	}catch{}
});
onBeforeUnmount(()=>{
	window.removeEventListener('pos-set-tab', handleSetTab as any);
    try{ ws?.close(); }catch{} ws=null;
	try{
		window.removeEventListener('resize', updateCompact as any);
		window.removeEventListener('resize', updateTouch as any);
		document.removeEventListener('fullscreenchange', updateFullscreen as any);
	}catch{}
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
.topbar{
	height:64px;
	background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
	border-bottom:1px solid #ebeef5;
	display:flex;
	align-items:center;
	justify-content:space-between;
	padding:0 14px;
	gap:10px;
	box-shadow: 0 1px 0 rgba(17,24,39,0.03);
}
.topbar__left{ flex:1; min-width:0; display:flex; align-items:center; }
.topbar__right{ flex: 0 0 auto; display:flex; align-items:center; }
.topbar__divider{ margin: 0 2px; height: 22px; }
.crumb{ min-width:0; }
.route-tabs :deep(.el-tabs__nav){ user-select:none; }
.route-tabs :deep(.el-tabs__header){ margin:0; border-bottom:0; }
.route-tabs :deep(.el-tabs__nav-wrap){ margin-bottom:0; }
.route-tabs :deep(.el-tabs__item){
	border-radius: 10px 10px 0 0;
	height: 42px;
	line-height: 42px;
	padding: 0 12px;
	font-weight: 700;
}
.route-tabs :deep(.el-tabs__item.is-active){ color: var(--el-color-primary); }
.route-tabs :deep(.el-tabs__item .is-icon-close){
	/* 触控更好点 */
	width: 22px;
	height: 22px;
	margin-left: 6px;
	border-radius: 8px;
}
.route-tabs :deep(.el-tabs__item .is-icon-close:hover){ background: #eef2f7; }
.page-body{ flex:1; overflow:auto; padding:12px; min-height:0; }
.page-body.no-padding{ padding:0; }
.page-body.overflow-hidden{ overflow:hidden; }
.user-trigger{ display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 8px; border-radius:9999px; background:#f6f8fb; border:1px solid #ebeef5; transition: background .15s ease, border-color .15s ease; }
.user-trigger:hover{ background:#f1f5ff; border-color:#e5efff; }
.user-avatar :deep(img){ border-radius:50%; }
.name{ font-size:14px; color:#303133; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; }
.icon-btn{
	width: 44px;
	height: 44px;
	border-radius: 12px;
	touch-action: manipulation;
	-webkit-tap-highlight-color: transparent;
}
.icon-btn :deep(.el-icon){ font-size:22px; color:#606266; }
.icon-btn:hover{ background:#f6f8fb; }
.icon-btn:hover :deep(.el-icon){ color:#409eff; }
.status-btn{
	min-height: 44px;
	padding: 0 12px;
	gap: 8px;
	font-weight: 800;
	border-radius: 9999px;
	touch-action: manipulation;
	-webkit-tap-highlight-color: transparent;
}
.status-btn .status-text{ font-weight:800; color:#111827; font-size:13px; letter-spacing:.2px; }
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
	.topbar{ height:56px; }
}
@media (max-width: 1100px){
	.topbar{ padding: 0 10px; gap: 8px; }
	.user-trigger{ padding: 4px 6px; }
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


