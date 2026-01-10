import UniPlugin from '@dcloudio/vite-plugin-uni';
import { marked } from 'marked';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';

export default defineConfig(({ mode }) => {
	const uni = (UniPlugin as any)?.default ? (UniPlugin as any).default : (UniPlugin as any);
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const env = loadEnv(mode, __dirname, ['VITE_']);
	const isH5 = process.env.UNI_PLATFORM === 'h5';

	// 读取小程序版本与 uni-app 依赖版本，用于页面展示
	let manifestVersion = '';
	let uniDepVersion = '';
	let marketingSystemVersion = '';
	let changelogMd = '';
	let changelogHtml = '';
	try {
		const manifestPath = resolve(__dirname, './src/manifest.json');
		const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as any;
		manifestVersion = String(m?.versionName || '');
	} catch {}
	try {
		const candidates = [
			resolve(__dirname, '../../unichlog.md'),
			resolve(__dirname, '../unichlog.md'),
			resolve(__dirname, '../../../unichlog.md')
		];
		for (const p of candidates) {
			try {
				if (fs.existsSync(p)) { changelogMd = String(fs.readFileSync(p, 'utf-8') || ''); break; }
			} catch {}
		}
	} catch {}

	// 预先在构建期将 MD 转为 HTML，确保小程序端无需运行时解析
	try {
		if (changelogMd && typeof changelogMd === 'string') {
			marked.setOptions({ gfm: true, breaks: true });
			const html = marked.parse(changelogMd);
			changelogHtml = typeof html === 'string' ? html : '';
		}
	} catch {}

	// 将生成的 HTML 输出为资源文件，便于各平台通过 raw 导入
	try {
		const assetsDir = resolve(__dirname, './src/assets');
		const outHtmlPath = resolve(assetsDir, 'changelog.html');
		const outTsPath = resolve(assetsDir, 'changelog.ts');
		if (!fs.existsSync(assetsDir)) { fs.mkdirSync(assetsDir, { recursive: true }); }
		const content = changelogHtml && changelogHtml.trim().length ? changelogHtml : '<p>暂无更新日志</p>';
		fs.writeFileSync(outHtmlPath, content, 'utf-8');
		// 生成 TS 导出，避免小程序端 define 注入异常时的兜底
		const tsExport = `// 该文件由 vite.config.ts 自动生成\nexport const CHANGELOG_HTML = ${JSON.stringify(content)};\nexport default CHANGELOG_HTML;\n`;
		fs.writeFileSync(outTsPath, tsExport, 'utf-8');
	} catch {}
	try {
		const pkgPath = resolve(__dirname, './package.json');
		const p = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as any;
		uniDepVersion = String(p?.dependencies?.['@dcloudio/uni-app'] || '');
		marketingSystemVersion = String(p?.version || '');
	} catch {}

	// 小程序端：在所有 chunk 顶部注入极简 Intl polyfill，确保 vendor 先执行也可用
	function injectIntlPolyfill() {
		const banner = `;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:(typeof wx!=='undefined'?wx:Function('return this')());if(!g.Intl||!g.Intl.NumberFormat){g.Intl=g.Intl||{};g.Intl.NumberFormat=function(l,o){o=o||{};var s=String(o.style||'decimal');var c=String(o.currency||'CNY');var m=typeof o.maximumFractionDigits==='number'?Math.max(0,Math.min(20,o.maximumFractionDigits)):2;return{format:function(v){var n=Number(v);if(!isFinite(n))return'';var sign=n<0?'-':'';var a=Math.abs(n);var f=a.toFixed(m);var p=f.split('.');var i=p[0];var frac=p[1]?'.'+p[1]:'';var w=i.replace(/\\B(?=(\\d{3})+(?!\\d))/g,',');if(s==='currency'&&String(c).toUpperCase()==='CNY'){return sign+'￥'+w+frac;}return sign+w+frac;}}};}try{(0,Function)('var g=this;try{if(typeof Intl==="undefined") Intl=g.Intl;}catch(e){}').call(g);}catch(_){} }catch(_){}})();`;
		return {
			name: 'inject-intl-polyfill',
			apply: 'build',
			enforce: 'pre' as const,
			renderChunk(code: string){ try { return { code: banner + '\n' + code, map: null }; } catch { return null; } },
		};
	}

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
		plugins: [uni(), isH5 ? fixBareSanitizedImports() : injectIntlPolyfill()].filter(Boolean) as any,
		base: isH5 ? '/h5/' : '/', // 关键：H5 走子路径
		// 重要：排除 workspace 包的依赖预构建，避免 .vite/deps 缓存导出列表导致
		// 出现 “does not provide an export named ...” 的偶发问题（尤其在改动 env/热重载后）。
		optimizeDeps: {
			exclude: ['@wash/shared-utils'],
		},
		define: {
			'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
			'import.meta.env.VITE_APP_API_BASE': JSON.stringify(env.VITE_APP_API_BASE || ''),
			// 显式注入地图与门店位置配置即可，其余全局兜底移除
			'import.meta.env.VITE_AMAP_KEY': JSON.stringify(env.VITE_AMAP_KEY || process.env.VITE_AMAP_KEY || ''),
			'import.meta.env.VITE_STORE_LOCATION': JSON.stringify(env.VITE_STORE_LOCATION || process.env.VITE_STORE_LOCATION || ''),
			'globalThis.__VITE_API_BASE__': JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
			__APP_VITE_API_BASE__: JSON.stringify(env.VITE_API_BASE || process.env.VITE_API_BASE || ''),
			// 注入版本常量，供运行时展示
			__APP_MANIFEST_VERSION__: JSON.stringify(manifestVersion),
			__UNI_APP_DEP_VERSION__: JSON.stringify(uniDepVersion),
			__MARKETING_SYSTEM_VERSION__: JSON.stringify(marketingSystemVersion),
			__APP_CHANGELOG_MD__: JSON.stringify(changelogMd),
			__APP_CHANGELOG_HTML__: JSON.stringify(changelogHtml),
			'globalThis.__APP_CHANGELOG_MD__': JSON.stringify(changelogMd),
			'globalThis.__APP_CHANGELOG_HTML__': JSON.stringify(changelogHtml),
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

