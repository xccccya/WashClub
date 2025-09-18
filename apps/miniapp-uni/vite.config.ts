import UniPlugin from '@dcloudio/vite-plugin-uni';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

export default defineConfig(({ mode }) => {
	const uni = (UniPlugin as any)?.default ? (UniPlugin as any).default : (UniPlugin as any);
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const env = loadEnv(mode, __dirname, ['VITE_']);
	const isH5 = process.env.UNI_PLATFORM === 'h5';

	// 修复部分构建产物里出现的无效裸模块路径（例如 "..-..-..-node_modules-xxx.js" 未以 ./ 开头）
	function fixBareSanitizedImports() {
		const rewrite = (code: string): string => {
			let out = code;
			// 1) 静态导入: from "..-..." 或 from '..-...'
			out = out.replace(/from\s+\"(\.\.-)/g, 'from "./..-').replace(/from\s+\'(\.\.-)/g, "from './..-");
			// 2) 动态导入: import("..-...") 或 import('..-...')
			out = out.replace(/import\(\"(\.\.-)/g, 'import("./..-').replace(/import\(\'(\.\.-)/g, "import('./..-");
			// 3) 普通字符串字面量 URL（某些运行时代码会拼接再 import）
			out = out.replace(/(\"|\')(\.\.-)/g, (m, q) => q + './..-');
			return out;
		};
		return {
			name: 'fix-bare-sanitized-imports',
			apply: 'build',
			renderChunk(code: string) {
				try { return { code: rewrite(code), map: null }; } catch { return null; }
			},
			generateBundle(_: any, bundle: any) {
				try {
					for (const [, chunk] of Object.entries<any>(bundle)) {
						if (chunk && chunk.type === 'chunk' && typeof chunk.code === 'string') {
							chunk.code = rewrite(chunk.code);
						}
					}
				} catch {}
			},
			writeBundle(_: any, bundle: any) {
				try {
					// 1) 重命名以 ".." 开头的文件（仅最后一段），避免服务器/浏览器解析异常
					const renameMap: Record<string,string> = {};
					for (const [fileName, asset] of Object.entries<any>(bundle)) {
						const parts = String(fileName).split('/');
						const base = parts.pop() || '';
						if (base.startsWith('..')) {
							const newBase = base.replace(/^\.+/, 'm');
							const newName = (parts.length ? parts.join('/') + '/' : '') + newBase;
							renameMap[fileName] = newName;
							bundle[newName] = asset;
							delete bundle[fileName];
						}
					}
					// 2) 同步替换其它 chunk/asset 的引用
					if (Object.keys(renameMap).length) {
						const replaceRefs = (content: string) => {
							let out = content;
							for (const [oldName, newName] of Object.entries(renameMap)) {
								const re = new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g');
								out = out.replace(re, newName);
							}
							return out;
						};
						for (const [, item] of Object.entries<any>(bundle)) {
							if (item && typeof item.source === 'string') item.source = replaceRefs(item.source);
							if (item && typeof item.code === 'string') item.code = replaceRefs(item.code);
						}
					}
				} catch {}
			},
		};
	}

	return {
		plugins: [uni(), isH5 ? fixBareSanitizedImports() : undefined].filter(Boolean) as any,
		base: isH5 ? '/h5/' : '/', // 关键：H5 走子路径
		define: {
			'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || process.env.PUBLIC_API_BASE || ''),
			'import.meta.env.VITE_APP_API_BASE': JSON.stringify(env.VITE_APP_API_BASE || ''),
			// 显式注入地图与门店位置配置即可，其余全局兜底移除
			'import.meta.env.VITE_AMAP_KEY': JSON.stringify(env.VITE_AMAP_KEY || process.env.VITE_AMAP_KEY || ''),
			'import.meta.env.VITE_STORE_LOCATION': JSON.stringify(env.VITE_STORE_LOCATION || process.env.VITE_STORE_LOCATION || ''),
			'globalThis.__VITE_API_BASE__': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || process.env.PUBLIC_API_BASE || ''),
			__APP_VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || process.env.PUBLIC_API_BASE || ''),
		},
		server: { port: 5175, host: true, strictPort: true, open: true },
		build: isH5 ? {
			rollupOptions: {
				output: {
					// 确保产物文件名不以 '.' 开头，避免生成 "..-..-..-node_modules-..." 前缀
					sanitizeFileName(name: string) {
						let s = name.replace(/[^a-zA-Z0-9_.-]/g, '-');
						// 仅处理最后一段
						const parts = s.split('/');
						const base = parts.pop() || '';
						let fixed = base;
						if (fixed.startsWith('..')) fixed = fixed.replace(/^\.+/, 'm');
						if (fixed.startsWith('.')) fixed = 'm' + fixed;
						parts.push(fixed);
						return parts.join('/');
					},
				},
			},
		} : undefined,
	};
});

