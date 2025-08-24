import UniPlugin from '@dcloudio/vite-plugin-uni';
import { defineConfig } from 'vite';

export default defineConfig(() => {
	const uni = (UniPlugin as any)?.default ? (UniPlugin as any).default : (UniPlugin as any);
	return {
		plugins: [uni()],
		server: { port: 5175, host: true, strictPort: true, open: true },
	};
});

