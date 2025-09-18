import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export default defineConfig(({ mode }) => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const env = loadEnv(mode, __dirname, ['VITE_']);

    return {
        plugins: [vue()],
        base: '/pos/',
        server: { port: 5174 , host: true},
        define: {
            'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
            'import.meta.env.VITE_APP_API_BASE': JSON.stringify(env.VITE_APP_API_BASE || ''),
            'globalThis.__VITE_API_BASE__': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
            __APP_VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
        },
    };
});

