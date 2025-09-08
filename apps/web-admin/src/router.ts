import { createRouter, createWebHistory } from 'vue-router';
import Login from './pages/Login.vue';
import Home from './pages/Home.vue';
import Dashboard from './pages/Dashboard.vue';
import MemberList from './pages/MemberList.vue';
import MemberLevels from './pages/MemberLevels.vue';
import MemberCategories from './pages/MemberCategories.vue';
import MemberTags from './pages/MemberTags.vue';
import SystemRoles from './pages/SystemRoles.vue';
import SystemAdmins from './pages/SystemAdmins.vue';
import SystemFiles from './pages/SystemFiles.vue';
import SystemSms from './pages/SystemSms.vue';
import SystemBasic from './pages/SystemBasic.vue';
import ContentNotices from './pages/ContentNotices.vue';
import ContentBanners from './pages/ContentBanners.vue';
import ContentReviews from './pages/ContentReviews.vue';
import MemberVehicles from './pages/MemberVehicles.vue';
import MemberWashCards from './pages/MemberWashCards.vue';
import ServiceQueue from './pages/ServiceQueue.vue';
import StoreCategories from './pages/StoreCategories.vue';
import StoreProducts from './pages/StoreProducts.vue';
import StoreInventory from './pages/StoreInventory.vue';
import Orders from './pages/Orders.vue';
import OrderDetail from './pages/OrderDetail.vue';
import AfterSales from './pages/AfterSales.vue';
import CouponGroups from './pages/CouponGroups.vue';
import CouponList from './pages/CouponList.vue';
import MemberCoupons from './pages/MemberCoupons.vue';
import CouponLogs from './pages/CouponLogs.vue';
import MemberAddresses from './pages/MemberAddresses.vue';
import MemberSignins from './pages/MemberSignins.vue';
import MemberPoints from './pages/MemberPoints.vue';

const router = createRouter({
	history: createWebHistory('/admin'),
	routes: [
		{ path: '/login', component: Login, meta: { title: '登录' } },
		{
			path: '/',
			component: Home,
			meta: { requiresAuth: true },
			children: [
				{ path: '', redirect: '/dashboard' },
				{ path: '/dashboard', component: Dashboard, meta: { perm: '*', title: '系统首页' } },
				{ path: '/members', component: MemberList, meta: { perm: 'members', title: '会员列表' } },
				{ path: '/member-signins', component: MemberSignins, meta: { perm: 'member-signins', title: '签到管理' } },
				{ path: '/member-points', component: MemberPoints, meta: { perm: 'member-points', title: '积分管理' } },
				{ path: '/member-levels', component: MemberLevels, meta: { perm: 'member-levels', title: '会员等级' } },
				{ path: '/member-categories', component: MemberCategories, meta: { perm: 'member-categories', title: '会员分类' } },
				{ path: '/member-tags', component: MemberTags, meta: { perm: 'member-tags', title: '会员标签' } },
				{ path: '/member-vehicles', component: MemberVehicles, meta: { perm: 'member-vehicles', title: '会员车辆' } },
				{ path: '/member-washcards', component: MemberWashCards, meta: { perm: 'member-washcards', title: '洗车计次卡' } },
				{ path: '/member-addresses', component: MemberAddresses, meta: { perm: 'member-addresses', title: '收货地址' } },
				{ path: '/service-queue', component: ServiceQueue, meta: { perm: 'service-queue', title: '服务队列' } },
				{ path: '/store/categories', component: StoreCategories, meta: { perm: 'store-categories', title: '商品分类' } },
				{ path: '/store/products', component: StoreProducts, meta: { perm: 'store-products', title: '商品列表' } },
				{ path: '/store/inventory', component: StoreInventory, meta: { perm: 'store-inventory', title: '库存管理' } },
				{ path: '/orders', component: Orders, meta: { perm: 'orders', title: '订单列表' } },
				{ path: '/orders/:id', component: OrderDetail, meta: { perm: 'orders', title: '订单详情' } },
				{ path: '/orders/no/:no', component: OrderDetail, meta: { perm: 'orders', title: '订单详情' } },
				{ path: '/after-sales', component: AfterSales, meta: { perm: 'after-sales', title: '售后' } },
				{ path: '/content/notices', component: ContentNotices, meta: { perm: 'content-notices', title: '滚动通知' } },
				{ path: '/content/banners', component: ContentBanners, meta: { perm: 'content-banners', title: '广告横幅' } },
				{ path: '/content/reviews', component: ContentReviews, meta: { perm: 'content-reviews', title: '评价管理' } },
				{ path: '/coupon/groups', component: CouponGroups, meta: { perm: 'coupon-groups', title: '分组管理' } },
				{ path: '/coupon/list', component: CouponList, meta: { perm: 'coupons', title: '卡券列表' } },
				{ path: '/coupon/member-coupons', component: MemberCoupons, meta: { perm: 'member-coupons', title: '会员卡券' } },
				{ path: '/coupon/logs', component: CouponLogs, meta: { perm: 'coupon-logs', title: '卡券流水' } },
				{ path: '/system/roles', component: SystemRoles, meta: { perm: 'system-roles', title: '后台角色' } },
				{ path: '/system/admins', component: SystemAdmins, meta: { perm: 'system-admins', title: '后台管理员' } },
				{ path: '/system/basic', component: SystemBasic, meta: { perm: 'system-basic', title: '基础设置' } },
				{ path: '/system/files', component: SystemFiles, meta: { perm: 'system-files', title: '文件管理' } },
				{ path: '/system/sms', component: SystemSms, meta: { perm: 'system-sms', title: '短信管理' } },
			],
		},
	],
});

function isValidAdminToken(token?: string): boolean {
	if (!token) return false;
	try {
		const payloadRaw = (token.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/');
		const payload = JSON.parse(atob(payloadRaw)||'{}');
		const exp = Number(payload?.exp || 0);
		const type = String(payload?.type||'');
		if (type !== 'admin') return false;
		if (exp && Date.now()/1000 > exp - 5) return false;
		return true;
	} catch { return false; }
}

router.beforeEach((to, _from, next) => {
	const token = localStorage.getItem('token');
	// 已登录状态下访问登录页，自动跳首页
	if (to.path === '/login' && isValidAdminToken(token || undefined)) {
		return next('/');
	}
	if (to.meta.requiresAuth) {
		if (!token) return next('/login');
		try {
			const payloadRaw = (token.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/');
			const payload = JSON.parse(atob(payloadRaw)||'{}');
			const exp = Number(payload?.exp || 0);
			const type = String(payload?.type||'');
			if (type !== 'admin') {
				localStorage.removeItem('token');
				localStorage.removeItem('user');
				return next('/login');
			}
			if (exp && Date.now()/1000 > exp - 5) {
				localStorage.removeItem('token');
				localStorage.removeItem('user');
				return next('/login');
			}
		} catch {}
	}
	const userStr = localStorage.getItem('user') || '{}';
	let allow = true;
	try {
		const u = JSON.parse(userStr);
		const perm: string | undefined = (to.meta as any)?.perm;
		if (perm && u && u.permissions && !u.permissions.includes('*')) {
			allow = u.permissions.includes(perm);
		}
	} catch {}
	return allow ? next() : next('/');
});

router.afterEach((to) => {
	try{
		const siteTitle = localStorage.getItem('siteTitle') || 'WashClub 管理后台';
		const pageTitle = (to.meta as any)?.title || '页面';
		document.title = `${pageTitle} - ${siteTitle}`;
	}catch{}
});

export default router;

