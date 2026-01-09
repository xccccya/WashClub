export function normalizeApiBase(u) {
	try {
		const s = String(u || '').trim();
		if (!s) return '';
		if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, '');
		const protocol = (typeof location !== 'undefined' ? (location.protocol || 'http:') : 'http:');
		return `${protocol}//${s}`.replace(/\/+$/, '');
	} catch {
		return '';
	}
}

export function applyApiBaseToGlobals(apiBase) {
	try {
		globalThis.__VITE_API_BASE__ = apiBase;
		globalThis.VITE_API_BASE = apiBase;
	} catch {}
}

function getIsProd() {
	try {
		const v = import.meta?.env?.PROD;
		if (typeof v === 'boolean') return v;
	} catch {}
	try {
		const nodeEnv = globalThis?.process?.env?.NODE_ENV;
		if (typeof nodeEnv === 'string') return nodeEnv.toLowerCase() === 'production';
	} catch {}
	return false;
}

function getGlobalObj() {
	try {
		if (typeof globalThis !== 'undefined') return globalThis;
		if (typeof window !== 'undefined') return window;
	} catch {}
	return {};
}

export function resolveApiBaseDetailed() {
	const isProd = getIsProd();

	// 0) global injection
	try {
		const g = getGlobalObj();
		const gb = g?.__VITE_API_BASE__ || g?.VITE_API_BASE;
		if (gb) return { apiBase: normalizeApiBase(String(gb)), source: 'global', isProd };
	} catch {}

	// 1) compile-time constant injected by vite define
	try {
		// eslint-disable-next-line no-undef
		if (typeof __APP_VITE_API_BASE__ !== 'undefined' && __APP_VITE_API_BASE__) {
			// eslint-disable-next-line no-undef
			return { apiBase: normalizeApiBase(String(__APP_VITE_API_BASE__)), source: 'const', isProd };
		}
	} catch {}

	// 2) import.meta.env
	try {
		const envBase = import.meta?.env?.VITE_API_BASE || import.meta?.env?.VITE_APP_API_BASE;
		if (envBase) return { apiBase: normalizeApiBase(String(envBase)), source: 'env', isProd };
	} catch {}

	if (isProd) return { apiBase: '', source: 'missing', isProd };

	// 3) URL query override (H5)
	try {
		if (typeof window !== 'undefined' && window.location) {
			const { search, hash } = window.location;
			if (search) {
				const sp = new URLSearchParams(search);
				const q = sp.get('api') || sp.get('apibase');
				if (q) return { apiBase: normalizeApiBase(String(q)), source: 'query', isProd };
			}
			if (typeof hash === 'string' && hash.includes('?')) {
				const qs = hash.slice(hash.indexOf('?') + 1);
				const sp2 = new URLSearchParams(qs);
				const q2 = sp2.get('api') || sp2.get('apibase');
				if (q2) return { apiBase: normalizeApiBase(String(q2)), source: 'query', isProd };
			}
		}
	} catch {}

	// 4) localStorage override
	try {
		const ls = (typeof localStorage !== 'undefined')
			? (localStorage.getItem('API_BASE') || localStorage.getItem('apiBase'))
			: '';
		if (ls) return { apiBase: normalizeApiBase(String(ls)), source: 'localStorage', isProd };
	} catch {}

	// 5) uni storage override
	try {
		// eslint-disable-next-line no-undef
		const us = (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function')
			// eslint-disable-next-line no-undef
			? (uni.getStorageSync('API_BASE') || uni.getStorageSync('apiBase'))
			: '';
		if (us) return { apiBase: normalizeApiBase(String(us)), source: 'uniStorage', isProd };
	} catch {}

	// 6) infer from host
	try {
		if (typeof location !== 'undefined' && location.hostname) {
			const protocol = location.protocol || 'http:';
			const host = location.hostname;
			return { apiBase: `${protocol}//${host}:3000`, source: 'inferred', isProd };
		}
	} catch {}

	// 7) dev fallback
	return { apiBase: 'http://127.0.0.1:3000', source: 'fallback', isProd };
}

export function resolveApiBase() {
	const r = resolveApiBaseDetailed();
	const apiBase = normalizeApiBase(r.apiBase);
	try {
		if (apiBase) applyApiBaseToGlobals(apiBase);
		if (!r.isProd) console.info?.(`[api] API_BASE=${apiBase} (source=${r.source})`);
	} catch {}
	return apiBase;
}

export function requireApiBase() {
	const r = resolveApiBaseDetailed();
	const apiBase = normalizeApiBase(r.apiBase);
	if (!apiBase) {
		throw new Error('[api] 缺少 API 基址：请在构建/部署环境变量中配置 VITE_API_BASE（生产环境已禁用运行时覆盖）');
	}
	try {
		applyApiBaseToGlobals(apiBase);
		if (!r.isProd) console.info?.(`[api] API_BASE=${apiBase} (source=${r.source})`);
	} catch {}
	return apiBase;
}

