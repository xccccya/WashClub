import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import Login from './pages/Login.vue';
import Home from './pages/Home.vue';
import Layout from './pages/Layout.vue';
import { API_BASE } from './config';

// 全局 passive 事件补丁：减少 Chrome 对触控滚动阻塞的告警
(function(){
	try{
		const orig = EventTarget.prototype.addEventListener;
		EventTarget.prototype.addEventListener = function(type: any, listener: any, options?: any){
			try{
				const t = String(type||'');
				if (t==='touchstart' || t==='touchmove' || t==='wheel'){
					if (options === undefined){ options = { passive: true }; }
					else if (typeof options === 'boolean'){ options = { capture: options, passive: true }; }
					else if (typeof options === 'object' && options !== null && !('passive' in options)){
						options = { ...options, passive: true };
					}
				}
			}catch{}
			return orig.call(this, type, listener, options as any);
		};
	}catch{}
})();

function isValidAdminToken(token?: string): boolean {
	return !!token;
}

type AdminMe = {
	id: number;
	role?: string;
	roleId?: number | null;
	phone?: string;
	name?: string;
	avatarUrl?: string | null;
	permissions?: string[];
};

let _lastToken = '';
let _lastOk = false;
let _lastAt = 0;
let _lastUser: AdminMe | null = null;

async function fetchAdminMe(token: string): Promise<AdminMe | null> {
	try {
		const res = await fetch(`${API_BASE}/auth/admin/me`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) return null;
		return (await res.json()) as AdminMe;
	} catch {
		return null;
	}
}

async function ensureAdminSession(token: string): Promise<AdminMe | null> {
	const now = Date.now();
	if (token === _lastToken && now - _lastAt < 30_000) return _lastOk ? _lastUser : null;
	_lastToken = token;
	_lastAt = now;
	const u = await fetchAdminMe(token);
	_lastOk = !!u;
	_lastUser = u;
	if (u) {
		try { localStorage.setItem('user', JSON.stringify(u || {})); } catch {}
	}
	return u;
}

const router = createRouter({
	history: createWebHistory('/pos'),
	routes: [
		{ path: '/login', component: Login, meta: { title: '登录' } },
		{
			path: '/',
			component: Layout,
			meta: { requiresAuth: true },
			children: [
				{ path: '', component: Home, meta: { title: '收银台首页' } },
				{ path: 'cashier', component: () => import('./pages/Cashier.vue'), meta: { title: '收银' } },
				{ path: 'service-queue', component: () => import('./pages/ServiceQueue.vue'), meta: { title: '服务队列' } },
				{ path: 'orders', component: () => import('./pages/Orders.vue'), meta: { title: '订单' } },
				{ path: 'orders/:id', component: () => import('./pages/OrderDetail.vue'), meta: { title: '订单详情' } },
				{ path: 'orders/no/:no', component: () => import('./pages/OrderDetail.vue'), meta: { title: '订单详情' } },
			],
		},
	],
});

router.beforeEach((to, _from, next) => {
	const token = localStorage.getItem('token') || '';
	if (to.path === '/login' && isValidAdminToken(token || undefined)) {
		ensureAdminSession(token).then((u) => {
			if (u) return next('/');
			return next();
		});
		return;
	}
	if (to.meta.requiresAuth) {
		if (!token) return next('/login');
		ensureAdminSession(token).then((u) => {
			if (!u) {
				try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
				return next('/login');
			}
			return next();
		});
		return;
	}
	return next();
});

const app = createApp(App);
Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
	app.component(name, component as any);
});
app.use(router).use(ElementPlus, { size: 'large', zIndex: 3000, locale: zhCn }).mount('#app');

