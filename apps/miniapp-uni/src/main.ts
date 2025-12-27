import { createSSRApp } from 'vue';
// 小程序运行时 shim（仅 MP-WEIXIN 生效），需尽早引入
import './utils/wx-shim';
// polyfill: miniapp runtime may not have URLSearchParams; SDK query builder needs it
import './utils/urlsearchparams-polyfill';
import App from './App.vue';
import { API_BASE, getToken } from './utils/auth';
import { realtime } from './utils/realtime';

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


