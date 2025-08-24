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
				{ path: '/service-queue', component: ServiceQueue, meta: { perm: 'service-queue' } },
				{ path: '/content/notices', component: ContentNotices, meta: { perm: 'content-notices' } },
				{ path: '/content/banners', component: ContentBanners, meta: { perm: 'content-banners' } },
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

