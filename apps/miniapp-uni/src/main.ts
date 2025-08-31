import { createSSRApp } from 'vue';
// 小程序运行时 shim（仅 MP-WEIXIN 生效），需尽早引入
import './utils/wx-shim';
import App from './App.vue';

export function createApp() {
	const app = createSSRApp(App);
	return { app };
}


