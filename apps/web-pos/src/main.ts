import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import Login from './pages/Login.vue';
import Home from './pages/Home.vue';
import Layout from './pages/Layout.vue';

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
	const token = localStorage.getItem('token');
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
	return next();
});

const app = createApp(App);
Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
	app.component(name, component as any);
});
app.use(router).use(ElementPlus, { size: 'large', zIndex: 3000 }).mount('#app');

