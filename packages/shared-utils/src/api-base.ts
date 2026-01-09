export type ApiBaseSource =
	| 'global'
	| 'const'
	| 'env'
	| 'query'
	| 'localStorage'
	| 'uniStorage'
	| 'inferred'
	| 'fallback'
	| 'missing';

export type ApiBaseResolveResult = {
	apiBase: string;
	source: ApiBaseSource;
	isProd: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const uni: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __APP_VITE_API_BASE__: any;

function getIsProd(): boolean {
	// Vite / uni-app(vite) build
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const v = (import.meta as any)?.env?.PROD;
		if (typeof v === 'boolean') return v;
	} catch {}
	// Node-ish fallback
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const env = (globalThis as any)?.process?.env;
		const nodeEnv = env?.NODE_ENV;
		if (typeof nodeEnv === 'string') return nodeEnv.toLowerCase() === 'production';
	} catch {}
	return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGlobalObj(): any {
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (typeof globalThis !== 'undefined') return globalThis as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (typeof window !== 'undefined') return window as any;
	} catch {}
	return {};
}

export function normalizeApiBase(u: string): string {
	try {
		const s = String(u || '').trim();
		if (!s) return '';
		// Already absolute
		if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, '');
		// Allow host:port
		const protocol = (typeof location !== 'undefined' ? (location.protocol || 'http:') : 'http:');
		return `${protocol}//${s}`.replace(/\/+$/, '');
	} catch {
		return '';
	}
}

export function applyApiBaseToGlobals(apiBase: string): void {
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).__VITE_API_BASE__ = apiBase;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any).VITE_API_BASE = apiBase;
	} catch {}
}

export function resolveApiBaseDetailed(): ApiBaseResolveResult {
	const isProd = getIsProd();
	// PROD: only allow build/deploy-time configuration (no runtime overrides)
	// DEV: allow runtime overrides for easier debugging

	// 0) global injection
	try {
		const g = getGlobalObj();
		const gb = g?.__VITE_API_BASE__ || g?.VITE_API_BASE;
		if (gb) return { apiBase: normalizeApiBase(String(gb)), source: 'global', isProd };
	} catch {}

	// 1) compile-time constant injected by vite define
	try {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		if (typeof __APP_VITE_API_BASE__ !== 'undefined' && __APP_VITE_API_BASE__) {
			return { apiBase: normalizeApiBase(String(__APP_VITE_API_BASE__)), source: 'const', isProd };
		}
	} catch {}

	// 2) import.meta.env
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const envBase = (import.meta as any)?.env?.VITE_API_BASE || (import.meta as any)?.env?.VITE_APP_API_BASE;
		if (envBase) return { apiBase: normalizeApiBase(String(envBase)), source: 'env', isProd };
	} catch {}

	if (isProd) {
		return { apiBase: '', source: 'missing', isProd };
	}

	// 3) URL query param override (H5)
	try {
		if (typeof window !== 'undefined' && window.location) {
			const { search, hash } = window.location;
			if (search) {
				const sp = new URLSearchParams(search);
				const q = sp.get('api') || sp.get('apibase');
				if (q) return { apiBase: normalizeApiBase(String(q)), source: 'query', isProd };
			}
			// Hash router: /#/path?api=...
			if (typeof hash === 'string' && hash.includes('?')) {
				const qs = hash.slice(hash.indexOf('?') + 1);
				const sp2 = new URLSearchParams(qs);
				const q2 = sp2.get('api') || sp2.get('apibase');
				if (q2) return { apiBase: normalizeApiBase(String(q2)), source: 'query', isProd };
			}
		}
	} catch {}

	// 4) localStorage override (web)
	try {
		const ls = (typeof localStorage !== 'undefined')
			? (localStorage.getItem('API_BASE') || localStorage.getItem('apiBase'))
			: '';
		if (ls) return { apiBase: normalizeApiBase(String(ls)), source: 'localStorage', isProd };
	} catch {}

	// 5) uni storage override (miniapp)
	try {
		const us = (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function')
			? (uni.getStorageSync('API_BASE') || uni.getStorageSync('apiBase'))
			: '';
		if (us) return { apiBase: normalizeApiBase(String(us)), source: 'uniStorage', isProd };
	} catch {}

	// 6) infer from current host (web dev)
	try {
		if (typeof location !== 'undefined' && location.hostname) {
			const protocol = location.protocol || 'http:';
			const host = location.hostname;
			return { apiBase: `${protocol}//${host}:3000`, source: 'inferred', isProd };
		}
	} catch {}

	// 7) fallback (dev only)
	return { apiBase: 'http://127.0.0.1:3000', source: 'fallback', isProd };
}

export function resolveApiBase(): string {
	const r = resolveApiBaseDetailed();
	const apiBase = normalizeApiBase(r.apiBase);
	try {
		// Make it visible to any consumer reading globals (best-effort)
		if (apiBase) applyApiBaseToGlobals(apiBase);
		// In dev, give a tiny hint to ease debugging
		if (!r.isProd) {
			// eslint-disable-next-line no-console
			console.info?.(`[api] API_BASE=${apiBase} (source=${r.source})`);
		}
	} catch {}
	return apiBase;
}

export function requireApiBase(): string {
	const r = resolveApiBaseDetailed();
	const apiBase = normalizeApiBase(r.apiBase);
	if (!apiBase) {
		throw new Error('[api] 缺少 API 基址：请在构建/部署环境变量中配置 VITE_API_BASE（生产环境已禁用运行时覆盖）');
	}
	try {
		applyApiBaseToGlobals(apiBase);
		if (!r.isProd) {
			// eslint-disable-next-line no-console
			console.info?.(`[api] API_BASE=${apiBase} (source=${r.source})`);
		}
	} catch {}
	return apiBase;
}

