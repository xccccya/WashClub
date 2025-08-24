import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import Home from './pages/Home.vue';

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/', component: Home },
	],
});

createApp(App).use(router).use(ElementPlus).mount('#app');

