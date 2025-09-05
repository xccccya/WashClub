<template>
	<div class="layout">
		<aside class="sider">
			<div class="logo">WashClubAdmin</div>
			<el-menu :default-active="active" class="menu" @select="onSelect">
				<el-menu-item index="/dashboard"><el-icon style="margin-right:6px;"><HomeFilled /></el-icon>系统首页</el-menu-item>
				<el-sub-menu index="/members">
					<template #title><el-icon style="margin-right:6px;"><User /></el-icon>会员管理</template>
					<el-menu-item v-if="can('members')" index="/members"><el-icon style="margin-right:6px;"><User /></el-icon>会员列表</el-menu-item>
					<el-menu-item v-if="can('member-levels')" index="/member-levels"><el-icon style="margin-right:6px;"><Medal /></el-icon>会员等级</el-menu-item>
					<el-menu-item v-if="can('member-categories')" index="/member-categories"><el-icon style="margin-right:6px;"><Collection /></el-icon>会员分类</el-menu-item>
					<el-menu-item v-if="can('member-tags')" index="/member-tags"><el-icon style="margin-right:6px;"><PriceTag /></el-icon>会员标签</el-menu-item>
					<el-menu-item v-if="can('member-washcards')" index="/member-washcards"><el-icon style="margin-right:6px;"><Ticket /></el-icon>洗车计次卡</el-menu-item>
					<el-menu-item v-if="can('member-addresses')" index="/member-addresses"><el-icon style="margin-right:6px;"><Location /></el-icon>收货地址</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/vehicles">
					<template #title><el-icon style="margin-right:6px;"><Van /></el-icon>车辆管理</template>
					<el-menu-item v-if="can('member-vehicles')" index="/member-vehicles"><el-icon style="margin-right:6px;"><Van /></el-icon>会员车辆</el-menu-item>
					<el-menu-item v-if="can('service-queue')" index="/service-queue"><el-icon style="margin-right:6px;"><Timer /></el-icon>服务队列</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/content">
					<template #title><el-icon style="margin-right:6px;"><Document /></el-icon>内容管理</template>
					<el-menu-item v-if="can('content-notices')" index="/content/notices"><el-icon style="margin-right:6px;"><Bell /></el-icon>滚动通知</el-menu-item>
					<el-menu-item v-if="can('content-banners')" index="/content/banners"><el-icon style="margin-right:6px;"><Picture /></el-icon>广告横幅</el-menu-item>
					<el-menu-item v-if="can('content-reviews')" index="/content/reviews"><el-icon style="margin-right:6px;"><ChatDotRound /></el-icon>评价管理</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/store">
					<template #title><el-icon style="margin-right:6px;"><Goods /></el-icon>商店管理</template>
					<el-menu-item v-if="can('store-categories')" index="/store/categories"><el-icon style="margin-right:6px;"><CollectionTag /></el-icon>商品分类</el-menu-item>
					<el-menu-item v-if="can('store-products')" index="/store/products"><el-icon style="margin-right:6px;"><ShoppingBag /></el-icon>商品列表</el-menu-item>
					<el-menu-item v-if="can('store-inventory')" index="/store/inventory"><el-icon style="margin-right:6px;"><List /></el-icon>库存管理</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/orders">
					<template #title><el-icon style="margin-right:6px;"><Tickets /></el-icon>订单管理</template>
					<el-menu-item v-if="can('orders')" index="/orders"><el-icon style="margin-right:6px;"><Tickets /></el-icon>订单列表</el-menu-item>
					<el-menu-item v-if="can('after-sales')" index="/after-sales"><el-icon style="margin-right:6px;"><Service /></el-icon>售后</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/coupon">
					<template #title><el-icon style="margin-right:6px;"><Ticket /></el-icon>卡券管理</template>
					<el-menu-item v-if="can('coupon-groups')" index="/coupon/groups"><el-icon style="margin-right:6px;"><Collection /></el-icon>分组管理</el-menu-item>
					<el-menu-item v-if="can('coupons')" index="/coupon/list"><el-icon style="margin-right:6px;"><PriceTag /></el-icon>卡券列表</el-menu-item>
					<el-menu-item v-if="can('member-coupons')" index="/coupon/member-coupons"><el-icon style="margin-right:6px;"><Ticket /></el-icon>会员卡券</el-menu-item>
					<el-menu-item v-if="can('coupon-logs')" index="/coupon/logs"><el-icon style="margin-right:6px;"><Document /></el-icon>卡券流水</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/system">
					<template #title><el-icon style="margin-right:6px;"><Setting /></el-icon>系统设置</template>
					<el-menu-item v-if="can('system-roles')" index="/system/roles"><el-icon style="margin-right:6px;"><UserFilled /></el-icon>后台角色</el-menu-item>
					<el-menu-item v-if="can('system-admins')" index="/system/admins"><el-icon style="margin-right:6px;"><User /></el-icon>后台管理员</el-menu-item>
					<el-menu-item v-if="can('system-files')" index="/system/files"><el-icon style="margin-right:6px;"><Folder /></el-icon>文件管理</el-menu-item>
					<el-menu-item v-if="can('system-sms')" index="/system/sms"><el-icon style="margin-right:6px;"><Message /></el-icon>短信管理</el-menu-item>
				</el-sub-menu>
			</el-menu>
		</aside>
		<section class="main">
			<header class="topbar">
				<div class="breadcrumbs">
					<el-breadcrumb separator="/">
						<el-breadcrumb-item v-for="(c,idx) in breadcrumbList" :key="idx">{{ c }}</el-breadcrumb-item>
					</el-breadcrumb>
				</div>
				<div class="actions">
					<el-button class="icon-btn" text circle @click="toggleFullscreen" :title="isFullscreen? '退出全屏' : '全屏'">
						<el-icon><FullScreen /></el-icon>
					</el-button>
					<el-popover placement="bottom-end" trigger="click" popper-class="theme-pop" :teleported="true" :width="280" :show-arrow="false" :offset="8" :popper-options="{ strategy: 'fixed', modifiers: [{ name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } }] }">
						<template #reference>
							<el-button class="icon-btn" text circle title="主题/配色"><img :src="themeIcon" class="icon" alt="主题" /></el-button>
						</template>
						<div class="theme-panel">
							<div class="row">
								<span>主题</span>
								<el-radio-group v-model="theme" @change="applyTheme">
									<el-radio-button label="light">亮</el-radio-button>
									<el-radio-button label="dark">暗</el-radio-button>
								</el-radio-group>
							</div>
							<div class="row">
								<span>配色</span>
								<div class="color-grid">
									<button v-for="p in presetColors" :key="p.key" class="swatch" :title="p.label" type="button" @click="selectPreset(p.key)" :data-active="colorScheme===p.key" :style="{ backgroundColor: p.color }"></button>
								</div>
							</div>
							<div class="row">
								<span>自定义</span>
								<div class="color-grid">
									<div class="swatch custom" :data-active="colorScheme==='default'" :style="{ backgroundColor: customColor }">
										<input class="color-input" type="color" v-model="customColor" @change="onCustomChange" aria-label="选择自定义颜色" />
									</div>
								</div>
							</div>
						</div>
					</el-popover>
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
				</div>
			</header>
			<main class="content">
				<!-- 多标签页 -->
				<div class="tabs">
					<el-tabs v-model="active" type="card" @tab-remove="closeTab" @tab-click="onTabClick" closable>
						<el-tab-pane v-for="t in tabs" :key="t.path" :name="t.path" :label="t.title" :closable="t.path!=='/dashboard'" />
					</el-tabs>
				</div>
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
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import themeIcon from '../static/icons/zt.png';

const presetColors = [
	{ key:'default', color:'#409eff', label:'默认' },
	{ key:'green', color:'#18a058', label:'绿色' },
	{ key:'violet', color:'#7c4dff', label:'紫色' },
	{ key:'orange', color:'#ff7d00', label:'橙色' },
] as const;

function selectPreset(key: 'default'|'green'|'violet'|'orange'){
	colorScheme.value = key;
	applyTheme();
}

function onCustomChange(){
	// 自定义颜色使用默认配色通道以便变量覆盖生效
	colorScheme.value = 'default';
	applyTheme();
}

const router = useRouter();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const active = ref('/dashboard');
const tabs = ref<{ path:string; title:string }[]>([{ path:'/dashboard', title:'系统首页' }]);
const breadcrumbList = ref<string[]>(['首页']);

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

function addTabByRoute(){
	const r = router.currentRoute.value;
	const path = r.path;
	const mapTitle: Record<string,string> = {
		'/dashboard':'系统首页',
		'/members':'会员列表',
		'/member-levels':'会员等级',
		'/member-categories':'会员分类',
		'/member-tags':'会员标签',
		'/member-vehicles':'会员车辆',
		'/member-washcards':'洗车计次卡',
		'/member-addresses':'收货地址',
		'/service-queue':'服务队列',
		'/store/categories':'商品分类',
		'/store/products':'商品列表',
		'/store/inventory':'库存管理',
		'/orders':'订单列表',
		'/after-sales':'售后',
		'/content/notices':'滚动通知',
		'/content/banners':'广告横幅',
		'/content/reviews':'评价管理',
		'/coupon/groups':'分组管理',
		'/coupon/list':'卡券列表',
		'/coupon/member-coupons':'会员卡券',
		'/coupon/logs':'卡券流水',
		'/system/roles':'后台角色',
		'/system/admins':'后台管理员',
		'/system/files':'文件管理',
		'/system/sms':'短信管理'
	};
	const title = mapTitle[path] || '页面';
	if (!tabs.value.find(t=>t.path===path)) tabs.value.push({ path, title });
	active.value = path;
	// 生成面包屑
	const crumbs: string[] = [];
	if (path.startsWith('/dashboard')) crumbs.push('首页');
	if (path.startsWith('/members') || path.startsWith('/member-')) crumbs.push('会员管理');
	if (path.startsWith('/member-levels')) crumbs.push('会员等级');
	if (path.startsWith('/member-categories')) crumbs.push('会员分类');
	if (path.startsWith('/member-tags')) crumbs.push('会员标签');
	if (path.startsWith('/member-vehicles')) crumbs.push('会员车辆');
	if (path.startsWith('/member-washcards')) crumbs.push('洗车计次卡');
	if (path.startsWith('/member-addresses')) crumbs.push('收货地址');
	if (path.startsWith('/service-queue')) crumbs.push('服务队列');
	if (path.startsWith('/content/')) { crumbs.push('内容管理'); if (path.includes('/notices')) crumbs.push('滚动通知'); if (path.includes('/banners')) crumbs.push('广告横幅'); if (path.includes('/reviews')) crumbs.push('评价管理'); }
	if (path.startsWith('/store/')) { crumbs.push('商店管理'); if (path.includes('/categories')) crumbs.push('商品分类'); if (path.includes('/products')) crumbs.push('商品列表'); if (path.includes('/inventory')) crumbs.push('库存管理'); }
	if (path.startsWith('/orders')) crumbs.push('订单管理');
	if (path.startsWith('/after-sales')) crumbs.push('售后');
	if (path.startsWith('/coupon/')) { crumbs.push('卡券管理'); if (path.includes('/groups')) crumbs.push('分组管理'); if (path.includes('/list')) crumbs.push('卡券列表'); if (path.includes('/member-coupons')) crumbs.push('会员卡券'); }
	if (path.startsWith('/coupon/logs')) { crumbs.push('卡券管理'); crumbs.push('卡券流水'); }
	if (path.startsWith('/system/')) { crumbs.push('系统设置'); if (path.includes('/roles')) crumbs.push('后台角色'); if (path.includes('/admins')) crumbs.push('后台管理员'); if (path.includes('/files')) crumbs.push('文件管理'); if (path.includes('/sms')) crumbs.push('短信管理'); }
	if (crumbs.length===0) crumbs.push('首页');
	breadcrumbList.value = crumbs;
}

function closeTab(name: string){
	const idx = tabs.value.findIndex(t=>t.path===name);
	if (idx> -1) {
		const closedActive = tabs.value[idx].path === active.value;
		tabs.value.splice(idx,1);
		if (closedActive) {
			const next = tabs.value[idx-1] || tabs.value[0] || { path:'/dashboard' };
			router.push(next.path);
		}
	}
}

function onTabClick(pane:any){
	const target = String(pane.paneName||'');
	if (target && target!==router.currentRoute.value.path) router.push(target);
}

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

// 全屏控制
const isFullscreen = ref(false);
function toggleFullscreen(){
	try{
		const elem = document.documentElement as any;
		if (!document.fullscreenElement && (elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen)){
			(elem.requestFullscreen||elem.webkitRequestFullscreen||elem.msRequestFullscreen).call(elem);
			isFullscreen.value = true;
		}else if (document.exitFullscreen || (document as any).webkitExitFullscreen || (document as any).msExitFullscreen){
			(document.exitFullscreen||(document as any).webkitExitFullscreen||(document as any).msExitFullscreen).call(document);
			isFullscreen.value = false;
		}
	}catch{}
}

// 主题与配色
const theme = ref<'light'|'dark'>('light');
const colorScheme = ref<'default'|'green'|'violet'|'orange'>('default');
const customColor = ref<string>('#409eff');
function applyTheme(){
	try{
		const root = document.documentElement as HTMLElement;
		// 主题
		if (theme.value === 'dark') { root.setAttribute('data-theme', 'dark'); root.classList.add('dark'); }
		else { root.removeAttribute('data-theme'); root.classList.remove('dark'); }
		// 预设配色
		if (colorScheme.value === 'default') root.removeAttribute('data-color-scheme');
		else root.setAttribute('data-color-scheme', colorScheme.value);
		// 自定义主色仅在默认配色下生效；否则移除覆盖以便预设配色发挥作用
		root.style.removeProperty('--app-primary');
		if (colorScheme.value === 'default' && customColor.value) {
			root.style.setProperty('--app-primary', customColor.value);
		}
		// 持久化
		localStorage.setItem('theme', theme.value);
		localStorage.setItem('colorScheme', colorScheme.value);
		localStorage.setItem('customColor', customColor.value);
	}catch{}
}

onMounted(()=>{
	active.value = router.currentRoute.value.path || '/dashboard';
	try { const tokenPayload = JSON.parse(atob((localStorage.getItem('token')||'.').split('.')[1]||'{}')); userId.value = tokenPayload?.sub || null; } catch {};
	try { const u = JSON.parse(localStorage.getItem('user') || '{}'); if (u && u.name) nick.value = u.name; if (u && u.permissions) permissions.value = u.permissions; } catch {}
	addTabByRoute();
	// 初始化主题
	try {
		const t = localStorage.getItem('theme'); if (t==='dark'||t==='light') theme.value = t as any;
		const c = localStorage.getItem('colorScheme'); if (c==='default'||c==='green'||c==='violet'||c==='orange') colorScheme.value = c as any;
		const cc = localStorage.getItem('customColor'); if (cc) customColor.value = cc;
		applyTheme();
	} catch {}
});

watch(()=>router.currentRoute.value.path, ()=>{
	addTabByRoute();
});
</script>

<style scoped>
.layout { display:flex; height:100vh; }
.sider { width: 160px; min-width:160px; flex: 0 0 160px; border-right: 1px solid #eee; padding: 12px; }
.logo { font-weight: 700; margin: 8px 0 12px; font-size:16px; letter-spacing:0.3px; }
.menu { border-right: none; }
.main { flex:1; display:flex; flex-direction: column; min-width:0; }
.topbar { height: 56px; border-bottom:1px solid #eee; display:flex; align-items:center; justify-content: space-between; padding: 0 16px; }
.breadcrumbs :deep(.el-breadcrumb__item) { font-size: 14px; }
.actions { display:flex; align-items:center; gap:10px; }
.icon-btn { padding:0; width: 32px; height: 32px; display:inline-flex; align-items:center; justify-content:center; }
.icon-btn:hover { background-color: var(--el-fill-color-light); }
.icon-btn:active { background-color: var(--el-fill-color); }
.icon { width: 18px; height: 18px; display:block; }
.user-chip { background:#f5f5f5; padding:6px 10px; border-radius: 999px; cursor:pointer; }
.content { flex:1; overflow:auto; padding: 8px 16px 16px; min-width:0; }
.tabs { background: var(--el-bg-color); padding:8px 8px 0; border-bottom:1px solid #eee; margin-bottom:8px; }
.theme-panel{ width: 280px; display:flex; flex-direction:column; gap:4px; }
.theme-panel .row{ display:flex; align-items:center; gap:8px; margin:4px 0; }
.theme-panel .row span{ display:inline-block; min-width:42px; color: var(--el-text-color-regular); font-size: 12px; }
.theme-panel .row :deep(.el-radio-group){ flex:1; min-width:0; }
.theme-panel :deep(.el-radio-button__inner){ padding: 4px 10px; font-size: 12px; }
.color-grid{ display:flex; gap:6px; flex-wrap:wrap; }
.swatch{ width:22px; height:22px; border-radius:6px; border:1px solid var(--el-border-color); cursor:pointer; padding:0; outline:none; }
.swatch[data-active="true"]{ border-color: var(--el-color-primary); box-shadow: 0 0 0 2px color-mix(in oklab, var(--el-color-primary), transparent 70%); }
.swatch.custom{ position: relative; overflow: hidden; }
.color-input{ position:absolute; inset:0; opacity:0; cursor:pointer; }
</style>

