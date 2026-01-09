import { createSSRApp } from 'vue';
// 小程序运行时 shim（仅 MP-WEIXIN 生效），需尽早引入
import './utils/wx-shim';
// polyfill: miniapp runtime may not have URLSearchParams; SDK query builder needs it
import './utils/urlsearchparams-polyfill';
import App from './App.vue';
import { API_BASE, getToken } from './utils/auth';
import { realtime } from './utils/realtime';

// 注册全局401处理器：SDK 请求返回 401 时自动清理登录态并跳转登录页
// shared-utils 的 http client 会在 401 时调用 globalThis.__ON_HTTP_401__
try {
	(globalThis as any).__ON_HTTP_401__ = () => {
		try {
			// 统一清理登录态
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const u: any = (typeof uni !== 'undefined' ? uni : null);
			u?.removeStorageSync?.('token');
			u?.removeStorageSync?.('user');
			try { u?.$emit?.('auth:changed'); } catch {}
			// 强制回到登录页（reLaunch 避免堆栈过深）
			u?.reLaunch?.({ url: '/pages/login/index' });
		} catch {}
	};
} catch {}

export function createApp() {
	const app = createSSRApp(App);
	// 初始化实时连接（小程序端）
	try{
		const t = getToken();
		if (t) realtime.start({ apiBase: API_BASE, token: t });
		// 监听登录态变化：更新 Token 与连接
		// @ts-ignore
		uni?.$on?.('auth:changed', ()=>{ try{ const tk = getToken(); if (tk) { realtime.start({ apiBase: API_BASE, token: tk }); } else { realtime.stop(); } }catch{} });
		// 页面展示时尝试重连（防止被系统挂起后断开）
		// #ifdef MP-WEIXIN || H5
		// @ts-ignore
		import('@dcloudio/uni-app').then((m)=>{ try{ m.onShow(()=>{ try{ const tk = getToken(); if (tk) realtime.start({ apiBase: API_BASE, token: tk }); }catch{} }); }catch{} });
		// #endif
	}catch{}
	return { app };
}


