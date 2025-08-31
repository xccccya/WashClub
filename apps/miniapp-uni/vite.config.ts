import UniPlugin from '@dcloudio/vite-plugin-uni';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export default defineConfig(({ mode }) => {
	const uni = (UniPlugin as any)?.default ? (UniPlugin as any).default : (UniPlugin as any);
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const env = loadEnv(mode, __dirname, ['VITE_']);
	const isH5 = process.env.UNI_PLATFORM === 'h5';

	return {
		plugins: [uni()],
		base: isH5 ? '/h5/' : '/', // 关键：H5 走子路径
		define: {
			'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
			'import.meta.env.VITE_APP_API_BASE': JSON.stringify(env.VITE_APP_API_BASE || ''),
			// 显式注入地图与门店位置配置即可，其余全局兜底移除
			'import.meta.env.VITE_AMAP_KEY': JSON.stringify(env.VITE_AMAP_KEY || process.env.VITE_AMAP_KEY || ''),
			'import.meta.env.VITE_STORE_LOCATION': JSON.stringify(env.VITE_STORE_LOCATION || process.env.VITE_STORE_LOCATION || ''),
			'globalThis.__VITE_API_BASE__': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
			__APP_VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
		},
		server: { port: 5175, host: true, strictPort: true, open: true },
	};
});

