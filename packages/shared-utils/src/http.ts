export type HttpClientConfig = {
	baseUrl?: string;
	getToken?: () => string | undefined;
	onUnauthorized?: () => void;
};

// 覆盖 RequestInit 的 body 类型，允许直接传入对象
export type HttpRequestOptions = Omit<RequestInit, 'body'> & {
    // 允许任意可序列化对象或原有的 BodyInit 类型
    // 使用 unknown 以便调用侧可直接传入 { ... }
    body?: unknown;
    query?: Record<string, unknown>;
};

// 声明以便小程序端类型通过；在非小程序端不会产生实际影响
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const uni: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __APP_VITE_API_BASE__: any;

function normalizeBase(u: string): string {
	try {
		const s = String(u || '').trim();
		if (!s) return '';
		if (/^https?:\/\//i.test(s)) return s.replace(/\/$/, '');
		// 允许传 host:port
		const protocol = (typeof location !== 'undefined' ? (location.protocol || 'http:') : 'http:');
		return `${protocol}//${s}`.replace(/\/$/, '');
	} catch {
		return '';
	}
}

function isAbsoluteUrl(u: string): boolean {
	return /^https?:\/\//i.test(String(u || ''));
}

function resolveDefaultBaseUrl(): string {
	// 优先级：全局注入/编译期常量 > import.meta.env > URL 查询参数 > localStorage/uni storage > 基于 host 推断 > 127.0.0.1:3000
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const g: any = (typeof globalThis !== 'undefined') ? (globalThis as any) : (typeof window !== 'undefined' ? (window as any) : {});
	try {
		const gb = g?.__VITE_API_BASE__ || g?.VITE_API_BASE;
		if (gb) return normalizeBase(String(gb));
	} catch {}
	try {
		// 直接访问常量，若未定义会抛错
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		if (typeof __APP_VITE_API_BASE__ !== 'undefined' && __APP_VITE_API_BASE__) return normalizeBase(String(__APP_VITE_API_BASE__));
	} catch {}
	try {
		const envBase = (import.meta as any)?.env?.VITE_API_BASE || (import.meta as any)?.env?.VITE_APP_API_BASE;
		if (envBase) return normalizeBase(String(envBase));
	} catch {}
	try {
		if (typeof window !== 'undefined' && window.location && window.location.search) {
			const sp = new URLSearchParams(window.location.search);
			const q = sp.get('api') || sp.get('apibase');
			if (q) return normalizeBase(String(q));
		}
	} catch {}
	try {
		// H5/localStorage
		const ls = (typeof localStorage !== 'undefined') ? (localStorage.getItem('API_BASE') || localStorage.getItem('apiBase')) : '';
		if (ls) return normalizeBase(String(ls));
	} catch {}
	try {
		// 小程序 storage
		const us = (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') ? (uni.getStorageSync('API_BASE') || uni.getStorageSync('apiBase')) : '';
		if (us) return normalizeBase(String(us));
	} catch {}
	try {
		if (typeof location !== 'undefined' && location.hostname) {
			const protocol = location.protocol || 'http:';
			const host = location.hostname;
			return `${protocol}//${host}:3000`;
		}
	} catch {}
	return 'http://127.0.0.1:3000';
}

function resolveDefaultToken(): string | undefined {
	// 小程序优先
	try {
		if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
			const t = uni.getStorageSync('token');
			if (t) return String(t);
		}
	} catch {}
	// Web
	try {
		const t = (typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null;
		return t || undefined;
	} catch {
		return undefined;
	}
}

function callGlobalUnauthorizedHook() {
	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(globalThis as any)?.__ON_HTTP_401__?.();
	} catch {}
}

function createHttpClientFactory(config: HttpClientConfig = {}) {
	const { baseUrl = '', getToken, onUnauthorized } = config;
	return async function request<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
			...(options.headers || {}),
		};
		const token = getToken?.();
		if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
		let fullUrl = isAbsoluteUrl(url) ? url : (baseUrl + url);
		if (options.query) {
			const pairs: string[] = [];
			Object.entries(options.query).forEach(([k, v]) => {
				if (v === undefined || v === null) return;
				if (Array.isArray(v)) {
					v.forEach((item) => {
						if (item === undefined || item === null) return;
						pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
					});
				} else {
					pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
				}
			});
			if (pairs.length > 0) fullUrl += (fullUrl.includes('?') ? '&' : '?') + pairs.join('&');
		}

		// 小程序端优先使用 uni.request；其余环境使用 fetch
		const canUseUni = typeof uni !== 'undefined' && typeof uni.request === 'function';
		if (canUseUni) {
			return await new Promise<T>((resolve, reject) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const method: any = (options.method || 'GET').toString().toUpperCase();
				const data = options.body && typeof options.body !== 'string' ? options.body : options.body;
				uni.request({
					url: fullUrl,
					method,
					// 小程序端 dataType 默认按 content-type 解析；指定为 json 更稳妥
					data,
					header: headers as Record<string, string>,
					dataType: 'json',
					success: (resp: { statusCode: number; data: unknown; header: Record<string, string> }) => {
						if (resp.statusCode >= 200 && resp.statusCode < 300) {
							resolve(resp.data as T);
						} else {
							if (resp.statusCode === 401) { try { onUnauthorized?.(); } catch {} callGlobalUnauthorizedHook(); }
							// 友好提取 message 字段
							const raw = resp.data;
							const msg = (raw && typeof raw === 'object' && (raw as any).message) ? String((raw as any).message) :
								(typeof raw === 'string' ? raw : undefined);
							reject(new Error(msg || `HTTP ${resp.statusCode}`));
						}
					},
					fail: (err: { errMsg?: string }) => {
						reject(new Error(err?.errMsg || 'Network Error'));
					},
				});
			});
		}

		// 解构移除未知类型的 body，避免传播到 fetch init
		const { body: rawBody, ...restOptions } = options;
		const res = await fetch(fullUrl, {
			...restOptions,
			headers,
			body: rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string' ? JSON.stringify(rawBody) : (rawBody as any),
		});
		if (!res.ok) {
			if (res.status === 401) { try { onUnauthorized?.(); } catch {} callGlobalUnauthorizedHook(); }
			const contentType = res.headers.get('content-type') || '';
			if (contentType.includes('application/json')) {
				let messageFromJson: string | undefined;
				try {
					const j = await res.json();
					const raw = (j as any)?.message;
					if (Array.isArray(raw)) messageFromJson = raw.map((x: unknown) => String(x)).join('；');
					else if (raw !== undefined && raw !== null) messageFromJson = String(raw);
				} catch {}
				throw new Error(messageFromJson || `HTTP ${res.status} ${res.statusText}`);
			}
			const text = await res.text();
			throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
		}
		const contentType = res.headers.get('content-type') || '';
		if (contentType.includes('application/json')) return (await res.json()) as T;
		const text = await res.text();
		return text as unknown as T;
	};
}

export function createHttpClient(config?: HttpClientConfig): <T>(url: string, options?: HttpRequestOptions) => Promise<T>;
export function createHttpClient<T>(url: string, options?: HttpRequestOptions): Promise<T>;
export function createHttpClient<T>(arg1?: unknown, arg2?: unknown): any {
	if (typeof arg1 === 'string') {
		// 直接调用：createHttpClient(url, options)
		const client = createHttpClientFactory({
			baseUrl: resolveDefaultBaseUrl(),
			getToken: resolveDefaultToken,
			onUnauthorized: callGlobalUnauthorizedHook,
		});
		return client<T>(arg1 as string, (arg2 as HttpRequestOptions) || {});
	}
	// 工厂用法：createHttpClient(config)
	return createHttpClientFactory((arg1 as HttpClientConfig) || {});
}

export default createHttpClient;

