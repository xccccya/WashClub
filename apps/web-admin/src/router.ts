import { createRouter, createWebHistory } from 'vue-router';
import Login from './pages/Login.vue';
import Home from './pages/Home.vue';
import MemberList from './pages/MemberList.vue';
import MemberLevels from './pages/MemberLevels.vue';
import MemberCategories from './pages/MemberCategories.vue';
import MemberTags from './pages/MemberTags.vue';
import SystemRoles from './pages/SystemRoles.vue';
import SystemAdmins from './pages/SystemAdmins.vue';
import SystemFiles from './pages/SystemFiles.vue';
import SystemSms from './pages/SystemSms.vue';
import ContentNotices from './pages/ContentNotices.vue';
import ContentBanners from './pages/ContentBanners.vue';
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
import MemberAddresses from './pages/MemberAddresses.vue';

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/login', component: Login },
		{
			path: '/',
			component: Home,
			meta: { requiresAuth: true },
			children: [
				{ path: '', redirect: '/members' },
				{ path: '/members', component: MemberList, meta: { perm: 'members' } },
				{ path: '/member-levels', component: MemberLevels, meta: { perm: 'member-levels' } },
				{ path: '/member-categories', component: MemberCategories, meta: { perm: 'member-categories' } },
				{ path: '/member-tags', component: MemberTags, meta: { perm: 'member-tags' } },
				{ path: '/member-vehicles', component: MemberVehicles, meta: { perm: 'member-vehicles' } },
				{ path: '/member-washcards', component: MemberWashCards, meta: { perm: 'member-washcards' } },
				{ path: '/member-addresses', component: MemberAddresses, meta: { perm: 'member-addresses' } },
				{ path: '/service-queue', component: ServiceQueue, meta: { perm: 'service-queue' } },
				{ path: '/store/categories', component: StoreCategories, meta: { perm: 'store-categories' } },
				{ path: '/store/products', component: StoreProducts, meta: { perm: 'store-products' } },
				{ path: '/store/inventory', component: StoreInventory, meta: { perm: 'store-inventory' } },
				{ path: '/orders', component: Orders, meta: { perm: 'orders' } },
				{ path: '/orders/:id', component: OrderDetail, meta: { perm: 'orders' } },
				{ path: '/orders/no/:no', component: OrderDetail, meta: { perm: 'orders' } },
				{ path: '/after-sales', component: AfterSales, meta: { perm: 'after-sales' } },
				{ path: '/content/notices', component: ContentNotices, meta: { perm: 'content-notices' } },
				{ path: '/content/banners', component: ContentBanners, meta: { perm: 'content-banners' } },
				{ path: '/coupon/groups', component: CouponGroups, meta: { perm: 'coupon-groups' } },
				{ path: '/coupon/list', component: CouponList, meta: { perm: 'coupons' } },
				{ path: '/system/roles', component: SystemRoles, meta: { perm: 'system-roles' } },
				{ path: '/system/admins', component: SystemAdmins, meta: { perm: 'system-admins' } },
				{ path: '/system/files', component: SystemFiles, meta: { perm: 'system-files' } },
				{ path: '/system/sms', component: SystemSms, meta: { perm: 'system-sms' } },
			],
		},
	],
});

router.beforeEach((to, _from, next) => {
	const token = localStorage.getItem('token');
	if (to.meta.requiresAuth && !token) {
		return next('/login');
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

export default router;

