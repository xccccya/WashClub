import { createApp } from 'vue';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import App from './App.vue';
import router from './router';

// 注册全局401处理器：SDK 请求返回 401 时自动清理登录态并跳转登录页
// 说明：@wash/shared-utils 的 http client 会在 401 时调用 globalThis.__ON_HTTP_401__
(function registerGlobalUnauthorizedHandler() {
	try {
		(globalThis as any).__ON_HTTP_401__ = () => {
			try {
				const current = router.currentRoute.value;
				const requiresAuth = !!(current.meta as any)?.requiresAuth;
				const path = String(current.path || '');
				if (requiresAuth && path !== '/login') {
					try {
						localStorage.removeItem('token');
						localStorage.removeItem('user');
					} catch {}
					router.push('/login');
				}
			} catch {}
		};
	} catch {}
})();

const app = createApp(App);
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
	app.component(key, component as any);
}
app
	.use(router)
	.use(ElementPlus, { locale: zhCn })
	.mount('#app');

