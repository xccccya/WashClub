<template>
	<div class="layout">
		<aside class="sider">
			<div class="sider-brand">
				<img v-if="siteLogo" :src="absUrl(siteLogo)" class="sider-brand__logo" alt="logo" />
				<div class="sider-brand__title" :title="siteTitle">{{ siteTitle || '管理后台' }}</div>
			</div>
			<el-menu :default-active="active" class="menu" @select="onSelect">
				<el-menu-item v-if="can('dashboard-metrics')" index="/dashboard"><el-icon style="margin-right:6px;"><HomeFilled /></el-icon>系统首页</el-menu-item>
				<el-sub-menu index="/orders">
					<template #title><el-icon style="margin-right:6px;"><Tickets /></el-icon>订单管理</template>
					<el-menu-item v-if="can('orders')" index="/orders"><el-icon style="margin-right:6px;"><Tickets /></el-icon>订单列表</el-menu-item>
					<el-menu-item v-if="can('after-sales')" index="/after-sales"><el-icon style="margin-right:6px;"><Service /></el-icon>售后</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/members">
					<template #title><el-icon style="margin-right:6px;"><User /></el-icon>会员管理</template>
					<el-menu-item v-if="can('members')" index="/members"><el-icon style="margin-right:6px;"><User /></el-icon>会员列表</el-menu-item>
					<el-menu-item v-if="can('member-signins')" index="/member-signins"><el-icon style="margin-right:6px;"><Document /></el-icon>签到管理</el-menu-item>
					<el-menu-item v-if="can('member-points')" index="/member-points"><el-icon style="margin-right:6px;"><Coin /></el-icon>积分管理</el-menu-item>
					<el-menu-item v-if="can('member-levels')" index="/member-levels"><el-icon style="margin-right:6px;"><Medal /></el-icon>会员等级</el-menu-item>
					<el-menu-item v-if="can('member-categories')" index="/member-categories"><el-icon style="margin-right:6px;"><Collection /></el-icon>会员分类</el-menu-item>
					<el-menu-item v-if="can('member-tags')" index="/member-tags"><el-icon style="margin-right:6px;"><PriceTag /></el-icon>会员标签</el-menu-item>
					<el-menu-item v-if="can('member-washcards')" index="/member-washcards"><el-icon style="margin-right:6px;"><Ticket /></el-icon>洗车计次卡</el-menu-item>
					<el-menu-item v-if="can('member-addresses')" index="/member-addresses"><el-icon style="margin-right:6px;"><Location /></el-icon>收货地址</el-menu-item>
				</el-sub-menu>
				<!-- 新增：集团管理 -->
				<el-sub-menu index="/groups">
					<template #title><el-icon style="margin-right:6px;"><UserFilled /></el-icon>集团管理</template>
					<el-menu-item v-if="can('group')" index="/groups"><el-icon style="margin-right:6px;"><UserFilled /></el-icon>集团列表</el-menu-item>
					<el-menu-item v-if="can('group-vehicles')" index="/groups/vehicles"><el-icon style="margin-right:6px;"><Van /></el-icon>集团车辆</el-menu-item>
					<el-menu-item v-if="can('group-cards')" index="/groups/cards"><el-icon style="margin-right:6px;"><Ticket /></el-icon>集团洗车卡</el-menu-item>
					<el-menu-item v-if="can('group-balance')" index="/groups/balance"><el-icon style="margin-right:6px;"><Coin /></el-icon>集团余额</el-menu-item>
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
				<el-sub-menu index="/notification">
					<template #title><el-icon style="margin-right:6px;"><Bell /></el-icon>消息通知</template>
					<el-menu-item v-if="can('notification-overview')" index="/notification/overview"><el-icon style="margin-right:6px;"><Bell /></el-icon>消息总览</el-menu-item>
					<el-menu-item v-if="can('notification-templates')" index="/notification/templates"><el-icon style="margin-right:6px;"><Setting /></el-icon>通知配置</el-menu-item>
				</el-sub-menu>
				<el-sub-menu index="/store">
					<template #title><el-icon style="margin-right:6px;"><Goods /></el-icon>商店管理</template>
					<el-menu-item v-if="can('store-categories')" index="/store/categories"><el-icon style="margin-right:6px;"><CollectionTag /></el-icon>商品分类</el-menu-item>
					<el-menu-item v-if="can('store-products')" index="/store/products"><el-icon style="margin-right:6px;"><ShoppingBag /></el-icon>商品列表</el-menu-item>
					<el-menu-item v-if="can('store-inventory')" index="/store/inventory"><el-icon style="margin-right:6px;"><List /></el-icon>库存管理</el-menu-item>
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
					<el-menu-item v-if="can('system-basic')" index="/system/basic"><el-icon style="margin-right:6px;"><Setting /></el-icon>基础设置</el-menu-item>
					<el-menu-item v-if="can('system-roles')" index="/system/roles"><el-icon style="margin-right:6px;"><UserFilled /></el-icon>后台角色</el-menu-item>
					<el-menu-item v-if="can('system-admins')" index="/system/admins"><el-icon style="margin-right:6px;"><User /></el-icon>后台管理员</el-menu-item>
					<el-menu-item v-if="can('system-files')" index="/system/files"><el-icon style="margin-right:6px;"><Folder /></el-icon>文件管理</el-menu-item>
					<el-menu-item v-if="can('system-sms')" index="/system/sms"><el-icon style="margin-right:6px;"><Message /></el-icon>短信管理</el-menu-item>
					<el-menu-item v-if="can('system-employees')" index="/system/employees"><el-icon style="margin-right:6px;"><User /></el-icon>员工配置</el-menu-item>
				</el-sub-menu>
			</el-menu>
		</aside>
		<section class="main">
			<header class="topbar">
				<nav class="breadcrumbs" aria-label="面包屑导航">
					<el-breadcrumb :separator-icon="ArrowRight">
						<el-breadcrumb-item v-for="(crumb, idx) in breadcrumbList" :key="idx" :to="crumb.path ? crumb.path : undefined">
							<span class="crumb-content" :class="{ 'is-last': idx === breadcrumbList.length - 1, 'is-clickable': !!crumb.path }">
								<el-icon v-if="crumb.icon === 'home'" class="crumb-icon"><HomeFilled /></el-icon>
								<span class="crumb-text">{{ crumb.label }}</span>
							</span>
						</el-breadcrumb-item>
					</el-breadcrumb>
				</nav>
				<div class="actions">
					<div class="quick-actions" role="group" aria-label="快速操作">
						<el-button class="icon-btn" text circle @click="toggleFullscreen" :title="isFullscreen? '退出全屏' : '全屏'" aria-label="切换全屏">
							<el-icon><FullScreen /></el-icon>
						</el-button>
						<el-popover placement="bottom-end" trigger="click" popper-class="theme-pop" :teleported="true" :width="280" :show-arrow="false" :offset="8" :popper-options="{ strategy: 'fixed', modifiers: [{ name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } }] }">
							<template #reference>
								<el-button class="icon-btn" text circle title="主题/配色" aria-label="主题与配色">
									<el-icon><Sunny /></el-icon>
								</el-button>
							</template>
							<div class="theme-panel">
							<div class="row">
								<span>主题</span>
								<el-radio-group v-model="theme" @change="applyTheme">
									<el-radio-button value="light">亮</el-radio-button>
									<el-radio-button value="dark">暗</el-radio-button>
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
						<el-button class="icon-btn notify-bell" text circle :title="`消息通知`" aria-label="消息通知" @click="openNotifyDrawer">
							<el-badge :value="unreadCountText" :hidden="unreadCount===0" class="bell-badge">
								<el-icon><Bell /></el-icon>
							</el-badge>
						</el-button>
						<!-- 营业状态：按钮+弹出设置 -->
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
									<el-button size="small" @click="reloadBusiness">刷新</el-button>
									<el-button size="small" type="primary" :loading="savingBiz" @click="saveBusiness">保存</el-button>
								</div>
							</div>
						</el-popover>
					</div>
					<div class="user">
						<el-dropdown>
							<span class="user-trigger" title="账户设置">
								<el-avatar class="user-avatar" :size="28" :src="formatAvatar(avatarUrl)" />
								<span class="user-name">{{ nick || '管理员' }}</span>
							</span>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item @click="openChangeAvatar">更换头像</el-dropdown-item>
									<el-dropdown-item @click="openEditNick">修改昵称</el-dropdown-item>
									<el-dropdown-item @click="openEditPwd">修改密码</el-dropdown-item>
									<el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
					</div>
				</div>
			</header>
			<!-- 多标签页：从滚动区移出，避免与页面内 sticky 组件遮挡 -->
			<div class="tabs">
				<el-tabs v-model="active" type="card" @tab-remove="closeTab" @tab-click="onTabClick" closable>
					<el-tab-pane v-for="t in tabs" :key="t.path" :name="t.path" :label="t.title" :closable="t.path!=='/dashboard'" />
				</el-tabs>
			</div>
			<main class="content">
				<router-view :key="router.currentRoute.value.fullPath" />
			</main>
		</section>
	</div>

	<!-- 消息抽屉 -->
	<el-drawer v-model="notifyDrawer" :with-header="false" size="380px" append-to-body :modal-append-to-body="false">
		<div class="notify-drawer">
			<div class="notify-drawer__header">
				<div class="title">消息通知</div>
				<div class="actions">
					<el-button size="small" @click="reloadNotifications" :loading="notifyLoading">刷新</el-button>
					<el-button size="small" type="primary" plain @click="markAllRead" :disabled="!notifications.some(n=>n.status==='UNREAD')">全部已读</el-button>
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
							<el-button link size="small" type="primary" @click="markRead(n)" :disabled="n.status==='READ'">标记已读</el-button>
						</div>
					</div>
				</div>
				<div v-if="!notifications.length && !notifyLoading" class="notify-empty">暂无消息</div>
			</el-scrollbar>
		</div>
	</el-drawer>

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

	<!-- 更换头像对话框 -->
	<el-dialog v-model="showAvatar" title="更换头像" width="480px">
		<div style="display:flex;align-items:center;gap:12px;">
			<img :src="formatAvatar(avatarDraft)" style="width:84px;height:84px;border-radius:10px;border:1px solid #eee;object-fit:cover;" />
			<el-upload :http-request="uploadAvatar" :show-file-list="false" accept="image/*"><el-button>上传头像</el-button></el-upload>
			<el-button @click="openPickAvatar">从文件库选择</el-button>
			<el-button link type="danger" @click="clearAvatar">恢复默认</el-button>
		</div>
		<template #footer>
			<el-button @click="showAvatar=false">取消</el-button>
			<el-button type="primary" @click="saveAvatar">保存</el-button>
		</template>
	</el-dialog>
	<FilePickerDialog v-model="pickVisible" title="选择头像" @picked="onPicked" />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import { absUrl } from '../utils/http';
import FilePickerDialog from './_components/FilePickerDialog.vue';
import { ArrowRight, Bell, Sunny } from '@element-plus/icons-vue';
import {
	authControllerUpdateAdminAvatar,
	authControllerUpdateAdminNickname,
	authControllerUpdateAdminPassword,
	notificationControllerList,
	notificationControllerMarkRead,
	notificationControllerMarkReadAll,
	notificationControllerUnreadCount,
	systemSettingControllerGetPublicBusinessStatus,
	systemSettingControllerGetPublicSetting,
	systemSettingControllerSaveBusinessSetting,
} from '@wash/api-client';

const presetColors = [
	{ key:'default', color:'#409eff', label:'默认' },
	{ key:'green', color:'#18a058', label:'绿色' },
	{ key:'violet', color:'#7c4dff', label:'紫色' },
	{ key:'orange', color:'#ff7d00', label:'橙色' },
	// 马卡龙色系
	{ key:'macaron-pink', color:'#ff9db5', label:'马卡龙粉' },
	{ key:'macaron-blue', color:'#91c9ff', label:'马卡龙蓝' },
	{ key:'macaron-green', color:'#9fe3c0', label:'马卡龙绿' },
] as const;

function selectPreset(key: 'default'|'green'|'violet'|'orange'|'macaron-pink'|'macaron-blue'|'macaron-green'){
	colorScheme.value = key;
	applyTheme();
}

function onCustomChange(){
	// 自定义颜色走独立 custom 通道，避免覆盖默认首项
	colorScheme.value = 'custom' as any;
	applyTheme();
}

const router = useRouter();
const active = ref('/dashboard');
const tabs = ref<{ path:string; title:string }[]>([{ path:'/dashboard', title:'系统首页' }]);

// 面包屑类型：支持图标、可点击路径
type BreadcrumbItem = { label: string; path?: string; icon?: 'home' };
const breadcrumbList = ref<BreadcrumbItem[]>([{ label: '首页', icon: 'home' }]);

const siteTitle = ref<string>('');
const siteLogo = ref<string>('');
const siteSetting = ref<{ defaultMemberAvatarUrl?: string | null } | null>(null);

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
            pausedEnabled: pausedEnabled.value
        } as any);
        await reloadBusiness();
        ElMessage.success('营业设置已保存');
    }catch(e:any){ ElMessage.error(String(e?.message||'保存失败')); }
    finally{ savingBiz.value = false; }
}

const nick = ref('');
const permissions = ref<string[]>([]);
const userId = ref<number | null>(null);
const showNick = ref(false);
const nickDraft = ref('');

const showPwd = ref(false);
const pwdOld = ref('');
const pwdNew = ref('');

const avatarUrl = ref<string | null>(null);
const showAvatar = ref(false);
const avatarDraft = ref<string | null>(null);
const pickVisible = ref(false);

function formatAvatar(url?: string | null){
	try {
		const candidate = url || siteSetting.value?.defaultMemberAvatarUrl || '';
		const u = absUrl(candidate || '');
		return u || absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png');
	} catch {
		return absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png');
	}
}

function openChangeAvatar(){ avatarDraft.value = avatarUrl.value || null; showAvatar.value = true; }
function openPickAvatar(){ pickVisible.value = true; }
function onPicked(list:any[]){ const f = list?.[0]; if (f && f.url) { avatarDraft.value = f.url; ElMessage.success('已选择头像'); } pickVisible.value = false; }
async function uploadAvatar(o:any){ const fd=new FormData(); fd.append('file', o.file); fd.append('dir','public'); fd.append('source','avatar'); const res=await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } }); const j=await res.json(); avatarDraft.value = j?.url || null; ElMessage.success('头像已上传'); }
function clearAvatar(){ avatarDraft.value = null; ElMessage.success('将使用默认头像'); }
async function saveAvatar(){
	// 后端从 AdminGuard 注入的 req.user.id 识别当前管理员，不再从 body 传 userId
	await authControllerUpdateAdminAvatar({ avatarUrl: avatarDraft.value ?? null } as any);
	avatarUrl.value = avatarDraft.value ?? null;
	try {
		const u = JSON.parse(localStorage.getItem('user')||'{}');
		u.avatarUrl = avatarUrl.value;
		localStorage.setItem('user', JSON.stringify(u));
	} catch {}
	showAvatar.value=false;
	ElMessage.success('头像已更新');
}

function can(key: string){ return permissions.value.includes('*') || permissions.value.includes(key); }
function onSelect(index: string){ router.push(index); active.value = index; }

function addTabByRoute(){
	const r = router.currentRoute.value;
	const path = r.path;
	const mapTitle: Record<string,string> = {
		'/dashboard':'系统首页',
		'/403':'无权限',
		'/members':'会员列表',
		'/member-signins':'签到管理',
		'/member-points':'积分管理',
		'/member-levels':'会员等级',
		'/member-categories':'会员分类',
		'/member-tags':'会员标签',
		'/member-vehicles':'会员车辆',
		'/member-washcards':'洗车计次卡',
		'/member-addresses':'收货地址',
		'/service-queue':'服务队列',
		// 新增：集团管理
		'/groups':'集团列表',
		'/groups/vehicles':'集团车辆',
		'/groups/cards':'集团洗车卡',
		'/groups/balance':'集团余额',
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
		'/system/basic':'基础设置',
		'/system/admins':'后台管理员',
		'/system/files':'文件管理',
		'/system/sms':'短信管理',
		'/notification/overview':'消息总览',
		'/notification/templates':'通知配置'
	};
	const metaTitle = (r.meta as any)?.title as string | undefined;
	let title = mapTitle[path] || metaTitle || '页面';
	// 动态路由：订单详情，附加订单号或ID
	if (path.startsWith('/orders/')){
		const idOrNo = String((r.params as any)?.no || (r.params as any)?.id || '').trim();
		title = idOrNo ? `订单详情（${idOrNo}）` : '订单详情';
	}
	const existed = tabs.value.find(t=>t.path===path);
	if (existed) existed.title = title; else tabs.value.push({ path, title });
	active.value = path;
	// 生成面包屑：完整的路径映射
	breadcrumbList.value = generateBreadcrumbs(path, title);
}

/**
 * 生成面包屑路径
 * 返回格式：[{ label: '显示名称', path?: '可点击路径' }, ...]
 */
function generateBreadcrumbs(path: string, pageTitle: string): BreadcrumbItem[] {
	const crumbs: BreadcrumbItem[] = [];
	
	// 首页始终作为第一项
	crumbs.push({ label: '首页', path: '/dashboard', icon: 'home' });
	
	// 路由到面包屑的映射配置
	const routeConfig: Record<string, { parent: string; label: string }> = {
		// 订单管理
		'/orders': { parent: '订单管理', label: '订单列表' },
		'/after-sales': { parent: '订单管理', label: '售后' },
		// 会员管理
		'/members': { parent: '会员管理', label: '会员列表' },
		'/member-signins': { parent: '会员管理', label: '签到管理' },
		'/member-points': { parent: '会员管理', label: '积分管理' },
		'/member-levels': { parent: '会员管理', label: '会员等级' },
		'/member-categories': { parent: '会员管理', label: '会员分类' },
		'/member-tags': { parent: '会员管理', label: '会员标签' },
		'/member-washcards': { parent: '会员管理', label: '洗车计次卡' },
		'/member-addresses': { parent: '会员管理', label: '收货地址' },
		// 集团管理
		'/groups': { parent: '集团管理', label: '集团列表' },
		'/groups/vehicles': { parent: '集团管理', label: '集团车辆' },
		'/groups/cards': { parent: '集团管理', label: '集团洗车卡' },
		'/groups/balance': { parent: '集团管理', label: '集团余额' },
		// 车辆管理
		'/member-vehicles': { parent: '车辆管理', label: '会员车辆' },
		'/service-queue': { parent: '车辆管理', label: '服务队列' },
		// 内容管理
		'/content/notices': { parent: '内容管理', label: '滚动通知' },
		'/content/banners': { parent: '内容管理', label: '广告横幅' },
		'/content/reviews': { parent: '内容管理', label: '评价管理' },
		// 消息通知
		'/notification/overview': { parent: '消息通知', label: '消息总览' },
		'/notification/templates': { parent: '消息通知', label: '通知配置' },
		// 商店管理
		'/store/categories': { parent: '商店管理', label: '商品分类' },
		'/store/products': { parent: '商店管理', label: '商品列表' },
		'/store/inventory': { parent: '商店管理', label: '库存管理' },
		// 卡券管理
		'/coupon/groups': { parent: '卡券管理', label: '分组管理' },
		'/coupon/list': { parent: '卡券管理', label: '卡券列表' },
		'/coupon/member-coupons': { parent: '卡券管理', label: '会员卡券' },
		'/coupon/logs': { parent: '卡券管理', label: '卡券流水' },
		// 系统设置
		'/system/basic': { parent: '系统设置', label: '基础设置' },
		'/system/roles': { parent: '系统设置', label: '后台角色' },
		'/system/admins': { parent: '系统设置', label: '后台管理员' },
		'/system/files': { parent: '系统设置', label: '文件管理' },
		'/system/sms': { parent: '系统设置', label: '短信管理' },
		'/system/employees': { parent: '系统设置', label: '员工配置' },
		// 无权限
		'/403': { parent: '系统设置', label: '无权限' },
	};
	
	// 首页特殊处理
	if (path === '/dashboard') {
		return [{ label: '首页', icon: 'home' }];
	}
	
	// 查找精确匹配
	const config = routeConfig[path];
	if (config) {
		crumbs.push({ label: config.parent });
		crumbs.push({ label: config.label });
		return crumbs;
	}
	
	// 动态路由：订单详情
	if (path.startsWith('/orders/')) {
		crumbs.push({ label: '订单管理' });
		crumbs.push({ label: '订单列表', path: '/orders' });
		crumbs.push({ label: pageTitle });
		return crumbs;
	}
	
	// 未匹配的路径，使用页面标题
	if (pageTitle && pageTitle !== '页面') {
		crumbs.push({ label: pageTitle });
	}
	
	return crumbs;
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
	try{
		await authControllerUpdateAdminNickname({ name: nickDraft.value } as any);
		nick.value = nickDraft.value; try{ const u = JSON.parse(localStorage.getItem('user')||'{}'); u.name = nick.value; localStorage.setItem('user', JSON.stringify(u)); }catch{}
		showNick.value = false; ElMessage.success('昵称已更新');
	}catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

function openEditPwd(){ pwdOld.value=''; pwdNew.value=''; showPwd.value = true; }
async function savePwd(){
	if (!userId.value) { ElMessage.error('未获取到用户ID'); return; }
	if (pwdNew.value.length < 6) { ElMessage.error('新密码至少6位'); return; }
	try {
		await authControllerUpdateAdminPassword({ oldPassword: pwdOld.value, newPassword: pwdNew.value } as any);
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
const colorScheme = ref<'default'|'green'|'violet'|'orange'|'macaron-pink'|'macaron-blue'|'macaron-green'|'custom'>('default');
const customColor = ref<string>('#409eff');
function applyTheme(){
	try{
		const root = document.documentElement as HTMLElement;
		// 主题
		if (theme.value === 'dark') { root.setAttribute('data-theme', 'dark'); root.classList.add('dark'); }
		else { root.removeAttribute('data-theme'); root.classList.remove('dark'); }
		// 配色通道：default / 预设 / custom
		if (colorScheme.value === 'default') root.removeAttribute('data-color-scheme');
		else if (colorScheme.value === 'custom') root.setAttribute('data-color-scheme', 'default');
		else root.setAttribute('data-color-scheme', colorScheme.value);
		// 自定义主色仅在 custom 通道生效
		root.style.removeProperty('--app-primary');
		if (colorScheme.value === 'custom' && customColor.value) {
			root.style.setProperty('--app-primary', customColor.value);
		}
		// 持久化
		localStorage.setItem('theme', theme.value);
		localStorage.setItem('colorScheme', colorScheme.value);
		localStorage.setItem('customColor', customColor.value);
	}catch{}
}

// 通知
const unreadCount = ref<number>(0);
const unreadCountText = computed(()=> unreadCount.value>99 ? '99+' : String(unreadCount.value));
let ws: WebSocket | null = null;
function onSiteSettingUpdated(ev: any){
	try{
		const next = ev?.detail || null;
		siteSetting.value = next ? next : siteSetting.value;
		if (next) localStorage.setItem('siteSetting', JSON.stringify(next || {}));
	}catch{}
}

async function refreshUnread(){ try { const r:any = await notificationControllerUnreadCount(); unreadCount.value = Number(r?.count||0); } catch { unreadCount.value = 0; } }
function connectWS(){
    try{
        const token = localStorage.getItem('token'); if (!token) return;
        const url = new URL(API_BASE);
        const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${url.host}/ws`;
        ws = new WebSocket(wsUrl);
        ws.onopen = ()=>{
            try { ws?.send?.(JSON.stringify({ type: 'auth', token })); } catch {}
        };
        ws.onmessage = async (ev)=>{
            try{
                const msg = JSON.parse(ev.data||'{}');
                if (msg?.type === 'notification' && msg?.data){
                    unreadCount.value += 1;
                    const { ElNotification } = await import('element-plus');
                    const ui:any = msg?.data?.ui || {};
                    // 若后端已入库并按模板渲染，则直接使用 title/content；UI 属性来自 ADMIN 模板
                    ElNotification({ title: String(msg.data.title||'新消息'), message: String(msg.data.content||''), type: ui?.type || 'info', position: ui?.position || 'top-right', duration: typeof ui?.duration==='number' ? ui.duration : 4500 });
                }
            }catch{}
        };
        ws.onclose = ()=>{ ws = null; setTimeout(connectWS, 2000); };
    }catch{}
}
// 抽屉式消息列表
type N = { id:number; title:string; content?:string|null; linkPath?:string|null; status:'UNREAD'|'READ'; createdAt:string };
const notifyDrawer = ref(false);
const notifyLoading = ref(false);
const notifications = ref<N[]>([]);
function openNotifyDrawer(){ notifyDrawer.value = true; reloadNotifications(); }
function formatTime(t:string){ try{ const d=new Date(t); const p=(n:number)=> String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }catch{ return t; } }
async function reloadNotifications(){
    notifyLoading.value = true;
    try{ const list:any[] = (await notificationControllerList({} as any) as unknown) as any[]; notifications.value = Array.isArray(list)? list: []; }
    catch{ notifications.value = []; }
    finally{ notifyLoading.value = false; }
}
async function markRead(n:N){ try{ await notificationControllerMarkRead({ id:n.id } as any); if (n.status==='UNREAD'){ n.status='READ'; unreadCount.value = Math.max(0, unreadCount.value-1); } }catch{} }
async function markAllRead(){ try{ await notificationControllerMarkReadAll(); notifications.value.forEach(n=>{ if(n.status==='UNREAD') n.status='READ'; }); refreshUnread(); }catch{} }
function openNotification(n:N){ if (n.linkPath){ try{ router.push(n.linkPath); }catch{} } if (n.status==='UNREAD'){ markRead(n); } }

onMounted(()=>{
	active.value = router.currentRoute.value.path || '/dashboard';
	try { const tokenPayload = JSON.parse(atob((localStorage.getItem('token')||'.').split('.')[1]||'{}')); userId.value = tokenPayload?.sub || null; } catch {};
	try { const u = JSON.parse(localStorage.getItem('user') || '{}'); if (u && u.name) nick.value = u.name; if (u && u.permissions) permissions.value = u.permissions; avatarUrl.value = u?.avatarUrl ?? null; } catch {}
	addTabByRoute();
    refreshUnread();
    connectWS();
		// 读取公共站点设置 + 营业状态
		systemSettingControllerGetPublicSetting().then((s:any)=>{
			const t = s?.title || 'WashClub 管理后台';
			siteTitle.value = t;
			siteLogo.value = s?.logoUrl || '';
			siteSetting.value = (s as any) || null;
			try{ localStorage.setItem('siteTitle', t); localStorage.setItem('siteSetting', JSON.stringify(s||{})); }catch{}
		}).catch(()=>{
			// 兜底：尽量从缓存恢复，避免头像/标题闪烁
			try{
				siteSetting.value = JSON.parse(localStorage.getItem('siteSetting')||'{}') || null;
			}catch{}
		});
		reloadBusiness();
	// 初始化主题
	try {
		const t = localStorage.getItem('theme'); if (t==='dark'||t==='light') theme.value = t as any;
		const c = localStorage.getItem('colorScheme'); if (c && ['default','green','violet','orange','macaron-pink','macaron-blue','macaron-green','custom'].includes(c)) colorScheme.value = c as any;
		const cc = localStorage.getItem('customColor'); if (cc) customColor.value = cc;
		applyTheme();
	} catch {}
});
onBeforeUnmount(()=>{ try{ ws?.close(); }catch{} ws = null; try{ window.removeEventListener('site-setting-updated', onSiteSettingUpdated as any); }catch{} });

watch(()=>router.currentRoute.value.fullPath, ()=>{
	addTabByRoute();
});

try{ window.addEventListener('site-setting-updated', onSiteSettingUpdated as any); }catch{}
</script>

<style scoped>
.layout { display: flex; height: 100vh; }

/* ============================================================
   侧边栏：现代卡片风格
   - 柔和渐变背景
   - 精致的边框与阴影
   - 优雅的滚动条
   ============================================================ */
.sider {
	width: 180px;
	min-width: 180px;
	flex: 0 0 180px;
	display: flex;
	flex-direction: column;
	padding: 12px;
	background: linear-gradient(
		180deg,
		var(--el-bg-color) 0%,
		color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 50%) 100%
	);
	border-right: 1px solid var(--el-border-color-lighter);
	box-shadow: 1px 0 8px rgba(0, 0, 0, 0.03);
	overflow: hidden;
}

/* 品牌区域：logo + 标题 */
.sider-brand {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	margin: 4px 0 16px;
	padding: 12px 8px;
	border-radius: 12px;
	background: color-mix(in oklab, var(--el-bg-color), transparent 40%);
	border: 1px solid var(--el-border-color-lighter);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	transition: box-shadow 0.2s ease;
}
.sider-brand:hover {
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.sider-brand__logo {
	width: 36px;
	height: 36px;
	object-fit: cover;
	border-radius: 10px;
	box-shadow:
		0 2px 8px rgba(0, 0, 0, 0.08),
		0 0 0 3px color-mix(in oklab, var(--el-color-primary), transparent 85%);
	transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.sider-brand:hover .sider-brand__logo {
	transform: scale(1.05);
	box-shadow:
		0 4px 12px rgba(0, 0, 0, 0.12),
		0 0 0 4px color-mix(in oklab, var(--el-color-primary), transparent 75%);
}
.sider-brand__title {
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.3px;
	background: linear-gradient(135deg, var(--el-text-color-primary), var(--el-color-primary));
	background-clip: text;
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	max-width: 100%;
	text-align: center;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* 菜单容器 */
.menu {
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	border-right: none;
	background: transparent;
	/* 优雅的滚动条 */
	scrollbar-width: thin;
	scrollbar-color: color-mix(in oklab, var(--el-border-color), transparent 50%) transparent;
}
.menu::-webkit-scrollbar {
	width: 4px;
}
.menu::-webkit-scrollbar-track {
	background: transparent;
}
.menu::-webkit-scrollbar-thumb {
	background: color-mix(in oklab, var(--el-border-color), transparent 50%);
	border-radius: 9999px;
}
.menu::-webkit-scrollbar-thumb:hover {
	background: color-mix(in oklab, var(--el-border-color), transparent 30%);
}

/* ============================================================
   菜单项样式：胶囊风格 + 左侧指示条
   ============================================================ */

/* 重置 el-menu 默认样式 */
.menu :deep(.el-menu) {
	border-right: none;
	background: transparent;
}

/* 一级菜单项 & 子菜单标题 */
.menu :deep(.el-menu-item),
.menu :deep(.el-sub-menu__title) {
	height: 40px;
	line-height: 40px;
	margin: 2px 0;
	padding: 0 12px !important;
	border-radius: 10px;
	font-size: 13px;
	font-weight: 500;
	color: var(--el-text-color-regular);
	background: transparent;
	transition:
		background-color 0.18s ease,
		color 0.18s ease,
		transform 0.12s ease,
		box-shadow 0.18s ease;
	position: relative;
	overflow: hidden;
}

/* 左侧激活指示条（隐藏状态） */
.menu :deep(.el-menu-item)::before {
	content: '';
	position: absolute;
	left: 0;
	top: 50%;
	transform: translateY(-50%) scaleY(0);
	width: 3px;
	height: 18px;
	border-radius: 0 3px 3px 0;
	background: var(--el-color-primary);
	transition: transform 0.2s ease;
}

/* Hover 状态 */
.menu :deep(.el-menu-item:hover),
.menu :deep(.el-sub-menu__title:hover) {
	background: color-mix(in oklab, var(--el-fill-color), transparent 30%);
	color: var(--el-text-color-primary);
}

/* 点击反馈 */
.menu :deep(.el-menu-item:active),
.menu :deep(.el-sub-menu__title:active) {
	transform: scale(0.98);
}

/* 激活状态：一级菜单项 */
.menu :deep(.el-menu-item.is-active) {
	background: color-mix(in oklab, var(--el-color-primary), var(--el-bg-color) 88%);
	color: var(--el-color-primary);
	font-weight: 600;
	box-shadow: 0 2px 8px color-mix(in oklab, var(--el-color-primary), transparent 85%);
}
.menu :deep(.el-menu-item.is-active)::before {
	transform: translateY(-50%) scaleY(1);
}

/* 图标统一样式 */
.menu :deep(.el-menu-item .el-icon),
.menu :deep(.el-sub-menu__title .el-icon) {
	width: 18px;
	height: 18px;
	font-size: 16px;
	margin-right: 8px;
	color: inherit;
	opacity: 0.85;
	transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu :deep(.el-menu-item:hover .el-icon),
.menu :deep(.el-sub-menu__title:hover .el-icon),
.menu :deep(.el-menu-item.is-active .el-icon) {
	opacity: 1;
}

/* 子菜单展开箭头 */
.menu :deep(.el-sub-menu__icon-arrow) {
	font-size: 12px;
	color: var(--el-text-color-secondary);
	transition: transform 0.25s ease, color 0.15s ease;
}
.menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow) {
	transform: rotate(180deg);
	color: var(--el-color-primary);
}

/* 子菜单容器 */
.menu :deep(.el-sub-menu .el-menu) {
	background: transparent;
	padding: 4px 0 4px 8px;
}

/* 子菜单项：缩进 + 更小尺寸 */
.menu :deep(.el-sub-menu .el-menu .el-menu-item) {
	height: 36px;
	line-height: 36px;
	font-size: 12px;
	padding-left: 12px !important;
	margin: 1px 0;
	border-radius: 8px;
}
.menu :deep(.el-sub-menu .el-menu .el-menu-item .el-icon) {
	width: 16px;
	height: 16px;
	font-size: 14px;
	margin-right: 6px;
}

/* 展开的子菜单标题高亮 */
.menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title) {
	color: var(--el-color-primary);
	font-weight: 600;
}

/* 弹出菜单样式（如果有 popper） */
.menu :deep(.el-menu--popup) {
	min-width: 160px;
	padding: 6px;
	border-radius: 10px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
/* ============================================================
   主内容区
   ============================================================ */
.main {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-width: 0;
	background: #f8fafc;
}
/* 暗色主题适配 */
:root[data-theme='dark'] .main {
	background: #0c0d0f;
}

/* ============================================================
   顶部导航栏：现代风格
   - 柔和阴影替代硬边框
   - 毛玻璃背景效果
   - 优雅的面包屑
   ============================================================ */
.topbar {
	height: 56px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20px;
	background: color-mix(in oklab, var(--el-bg-color), transparent 20%);
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
	border-bottom: 1px solid var(--el-border-color-lighter);
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	position: relative;
	z-index: 10;
}

/* 面包屑导航 */
.breadcrumbs {
	display: flex;
	align-items: center;
}
.breadcrumbs :deep(.el-breadcrumb) {
	font-size: 14px;
}
.breadcrumbs :deep(.el-breadcrumb__item) {
	display: inline-flex;
	align-items: center;
}
.breadcrumbs :deep(.el-breadcrumb__inner) {
	display: inline-flex;
	align-items: center;
	color: var(--el-text-color-secondary);
	font-weight: 400;
	transition: color 0.15s ease;
}
.breadcrumbs :deep(.el-breadcrumb__inner a),
.breadcrumbs :deep(.el-breadcrumb__inner.is-link) {
	color: var(--el-text-color-secondary);
	font-weight: 500;
	transition: color 0.15s ease;
}
.breadcrumbs :deep(.el-breadcrumb__inner a:hover),
.breadcrumbs :deep(.el-breadcrumb__inner.is-link:hover) {
	color: var(--el-color-primary);
}
.breadcrumbs :deep(.el-breadcrumb__separator) {
	margin: 0 8px;
	color: var(--el-text-color-placeholder);
}
.breadcrumbs :deep(.el-breadcrumb__separator .el-icon) {
	font-size: 12px;
	vertical-align: middle;
}

/* 面包屑内容样式 */
.crumb-content {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 0;
	border-radius: 4px;
	transition: color 0.15s ease;
}
.crumb-content.is-clickable {
	cursor: pointer;
}
.crumb-content.is-clickable:hover {
	color: var(--el-color-primary);
}
.crumb-content.is-last {
	color: var(--el-text-color-primary);
	font-weight: 600;
}
.crumb-icon {
	font-size: 14px;
	opacity: 0.8;
}
.crumb-text {
	line-height: 1;
}
/* ============================================================
   右侧操作区
   ============================================================ */
.actions {
	display: flex;
	align-items: center;
	gap: 16px;
}

/* 快捷操作组：胶囊容器 */
.quick-actions {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	border-radius: 12px;
	border: 1px solid var(--el-border-color-light);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 50%);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.quick-actions .icon-btn,
.quick-actions .notify-bell {
	width: 32px;
	height: 32px;
}

/* 图标按钮 */
.icon-btn {
	padding: 0;
	width: 32px;
	height: 32px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border-radius: 8px !important;
	line-height: 1;
	box-sizing: border-box;
	transition:
		background-color 0.15s ease,
		transform 0.1s ease;
}
.icon-btn:hover {
	background-color: var(--el-fill-color);
}
.icon-btn:active {
	background-color: var(--el-fill-color-dark);
	transform: scale(0.95);
}
.icon-btn :deep(.el-icon) {
	font-size: 18px;
	color: var(--el-text-color-regular);
	transition: color 0.15s ease;
}
.icon-btn:hover :deep(.el-icon) {
	color: var(--el-color-primary);
}

/* 消息通知铃铛 */
.notify-bell {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	cursor: pointer;
	border-radius: 8px;
	vertical-align: middle;
	transition: background-color 0.15s ease;
}
.notify-bell:hover {
	background: var(--el-fill-color);
}
.notify-bell :deep(.el-icon) {
	font-size: 18px;
	color: var(--el-text-color-regular);
	transition: color 0.15s ease;
}
.notify-bell:hover :deep(.el-icon) {
	color: var(--el-color-primary);
}

/* 消息徽标 */
.bell-badge :deep(.el-badge__content) {
	transform: translate(4px, -4px);
	height: 12px;
	min-width: 12px;
	padding: 0 3px;
	border-radius: 9999px;
	line-height: 12px;
	font-size: 9px;
	font-weight: 600;
	box-shadow: 0 0 0 1px var(--el-bg-color);
	animation: badge-pulse 2s ease-in-out infinite;
}
@keyframes badge-pulse {
	0%, 100% { transform: translate(4px, -4px) scale(1); }
	50% { transform: translate(4px, -4px) scale(1.05); }
}

/* 营业状态按钮 */
.status-btn {
	display: inline-flex;
	align-items: center;
	gap: 12px;
	padding: 6px 16px;
	border-radius: 10px;
	border: 1px solid var(--el-border-color-light);
	background: var(--el-bg-color);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	transition:
		background-color 0.15s ease,
		border-color 0.15s ease,
		box-shadow 0.15s ease;
}
.status-btn:hover {
	background: var(--el-fill-color-light);
	border-color: var(--el-border-color);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
.status-btn .status-text {
	font-weight: 600;
	color: var(--el-text-color-primary);
	font-size: 12px;
}
.status-btn .dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	display: inline-block;
	position: relative;
}
/* 营业中状态：呼吸动画 */
.status-btn .dot[data-type="OPEN"] {
	background: #22c55e;
	box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
	animation: dot-breathe-green 2s ease-in-out infinite;
}
.status-btn .dot[data-type="REST"] {
	background: #94a3b8;
}
.status-btn .dot[data-type="BUSY"] {
	background: #f59e0b;
	box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
	animation: dot-breathe-orange 2s ease-in-out infinite;
}
.status-btn .dot[data-type="PAUSED"] {
	background: #ef4444;
}
@keyframes dot-breathe-green {
	0%, 100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); }
	50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3); }
}
@keyframes dot-breathe-orange {
	0%, 100% { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }
	50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3); }
}

/* 营业设置面板 */
.biz-panel {
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.biz-panel .row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}
.biz-panel .toggles {
	display: flex;
	align-items: center;
	gap: 16px;
}

/* ============================================================
   用户区域
   ============================================================ */
.user {
	display: flex;
	align-items: center;
	gap: 8px;
}
.user-trigger {
	display: flex;
	align-items: center;
	gap: 10px;
	cursor: pointer;
	padding: 4px 12px 4px 4px;
	border-radius: 24px;
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 50%);
	border: 1px solid var(--el-border-color-light);
	transition:
		background-color 0.15s ease,
		border-color 0.15s ease,
		box-shadow 0.15s ease,
		transform 0.12s ease;
}
.user-trigger:hover {
	background: var(--el-fill-color-light);
	border-color: var(--el-border-color);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	transform: translateY(-1px);
}
.user-trigger:active {
	transform: translateY(0);
}
.user-avatar {
	position: relative;
}
.user-avatar :deep(img) {
	border-radius: 50%;
	border: 2px solid var(--el-bg-color);
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
/* 在线状态指示器 */
.user-avatar::after {
	content: '';
	position: absolute;
	bottom: 0;
	right: 0;
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: #22c55e;
	border: 2px solid var(--el-bg-color);
}
.user-name {
	max-width: 120px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-weight: 600;
	font-size: 13px;
	color: var(--el-text-color-primary);
}
.tabs{
	margin: 12px 16px 0;
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 40%);
	border: 1px solid var(--el-border-color-light);
	border-radius: 12px;
	padding: 6px;
	box-shadow:
		0 1px 2px rgba(0,0,0,.04),
		0 4px 12px rgba(15, 23, 42, .05);
}
.content { flex:1; overflow:auto; padding: 12px 16px 16px; min-width:0; }

/* ============================================================
   页面标签卡（el-tabs card）视觉优化
   - 胶囊风格标签
   - 流畅过渡动画
   - 克制的关闭按钮
   ============================================================ */

/* 重置 el-tabs 默认样式 */
.tabs :deep(.el-tabs__header){
	margin: 0;
	border: none;
}
.tabs :deep(.el-tabs--card > .el-tabs__header){
	border-bottom: none;
	height: auto;
}
.tabs :deep(.el-tabs--card > .el-tabs__header .el-tabs__nav){
	border: none;
	border-radius: 0;
}
.tabs :deep(.el-tabs--card > .el-tabs__header .el-tabs__nav-wrap::after){
	display: none;
}

/* 滚动区域：确保标签边缘不被裁切 */
.tabs :deep(.el-tabs__nav-wrap){
	margin-bottom: 0;
	padding: 2px;
}
.tabs :deep(.el-tabs__nav-scroll){
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: thin;
	scrollbar-color: color-mix(in oklab, var(--el-border-color), transparent 40%) transparent;
	/* 确保滚动时首尾标签边缘可见 */
	padding: 2px 4px;
	margin: -2px -4px;
}
.tabs :deep(.el-tabs__nav-scroll::-webkit-scrollbar){
	height: 4px;
}
.tabs :deep(.el-tabs__nav-scroll::-webkit-scrollbar-track){
	background: transparent;
}
.tabs :deep(.el-tabs__nav-scroll::-webkit-scrollbar-thumb){
	background: color-mix(in oklab, var(--el-border-color), transparent 50%);
	border-radius: 9999px;
}
.tabs :deep(.el-tabs__nav-scroll::-webkit-scrollbar-thumb:hover){
	background: color-mix(in oklab, var(--el-border-color), transparent 30%);
}

/* 导航容器：flex 布局，确保标签排列正确 */
.tabs :deep(.el-tabs__nav){
	display: flex;
	align-items: center;
	gap: 6px;
}

/* 单个标签项：胶囊风格 */
.tabs :deep(.el-tabs__item){
	height: 32px;
	line-height: 32px;
	padding: 0 14px;
	margin: 0; /* 使用 gap 代替 margin */
	border: 1px solid transparent !important;
	border-radius: 8px;
	background: transparent;
	color: var(--el-text-color-regular);
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	transition:
		background-color .18s ease,
		border-color .18s ease,
		color .18s ease,
		box-shadow .18s ease,
		transform .12s ease;
}
.tabs :deep(.el-tabs__item:hover){
	background: color-mix(in oklab, var(--el-fill-color), transparent 30%);
	color: var(--el-text-color-primary);
}
.tabs :deep(.el-tabs__item:active){
	transform: scale(0.98);
}
.tabs :deep(.el-tabs__item.is-active){
	background: var(--el-bg-color);
	border-color: var(--el-border-color-light) !important;
	color: var(--el-color-primary);
	font-weight: 600;
	box-shadow:
		0 1px 3px rgba(0,0,0,.06),
		0 2px 8px rgba(0,0,0,.04);
}

/* 关闭按钮：默认隐藏，hover/active 再显示 */
.tabs :deep(.el-tabs__item .is-icon-close){
	width: 16px;
	height: 16px;
	margin-left: 6px;
	border-radius: 4px;
	font-size: 12px;
	opacity: 0;
	transform: scale(0.8);
	transition:
		opacity .15s ease,
		transform .15s ease,
		background-color .15s ease,
		color .15s ease;
}
.tabs :deep(.el-tabs__item.is-active .is-icon-close),
.tabs :deep(.el-tabs__item:hover .is-icon-close){
	opacity: 0.6;
	transform: scale(1);
}
.tabs :deep(.el-tabs__item .is-icon-close:hover){
	opacity: 1;
	background: color-mix(in oklab, var(--el-color-danger), transparent 85%);
	color: var(--el-color-danger);
}

/* 左右翻页按钮（标签过多时出现）*/
.tabs :deep(.el-tabs__nav-next),
.tabs :deep(.el-tabs__nav-prev){
	width: 28px;
	height: 28px;
	line-height: 28px;
	text-align: center;
	border-radius: 6px;
	color: var(--el-text-color-secondary);
	font-size: 12px;
	transition:
		background-color .15s ease,
		color .15s ease;
}
.tabs :deep(.el-tabs__nav-next:hover),
.tabs :deep(.el-tabs__nav-prev:hover){
	color: var(--el-color-primary);
	background: color-mix(in oklab, var(--el-fill-color), transparent 20%);
}
.tabs :deep(.el-tabs__nav-next){
	right: 0;
}
.tabs :deep(.el-tabs__nav-prev){
	left: 0;
}
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
/* 通知抽屉样式 */
.notify-drawer{ display:flex; flex-direction:column; height:100%; }
.notify-drawer__header{ display:flex; align-items:center; justify-content:space-between; padding:8px 8px 6px; border-bottom:1px solid #eee; }
.notify-drawer__header .title{ font-weight:700; }
.notify-list{ padding:8px; }
.notify-item{ padding:10px 10px 8px; border-radius:8px; border:1px solid var(--el-border-color-light); margin-bottom:8px; cursor: default; }
.notify-item[data-unread="true"]{ background: var(--el-fill-color-light); border-color: color-mix(in oklab, var(--el-color-primary), transparent 70%); }
.notify-item .item-title{ display:flex; align-items:center; gap:6px; font-weight:600; color: var(--el-text-color-primary); }
.notify-item .item-title .dot{ width:6px; height:6px; border-radius:50%; background: var(--el-color-danger); display:inline-block; }
.notify-item .item-content{ color: var(--el-text-color-regular); margin-top:6px; font-size:12px; }
.notify-item .item-foot{ display:flex; align-items:center; justify-content:space-between; margin-top:6px; color: var(--el-text-color-secondary); font-size:12px; }
.notify-empty{ padding: 24px 8px; text-align:center; color: var(--el-text-color-secondary); }
</style>

