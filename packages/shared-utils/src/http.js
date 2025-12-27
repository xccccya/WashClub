// eslint-disable-next-line no-undef
function normalizeBase(u) {
    try {
        const s = String(u || '').trim();
        if (!s)
            return '';
        if (/^https?:\/\//i.test(s))
            return s.replace(/\/$/, '');
        const protocol = (typeof location !== 'undefined' ? (location.protocol || 'http:') : 'http:');
        return `${protocol}//${s}`.replace(/\/$/, '');
    }
    catch {
        return '';
    }
}
function isAbsoluteUrl(u) {
    return /^https?:\/\//i.test(String(u || ''));
}
function resolveDefaultBaseUrl() {
    // eslint-disable-next-line no-undef
    const g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {});
    try {
        const gb = g?.__VITE_API_BASE__ || g?.VITE_API_BASE;
        if (gb)
            return normalizeBase(String(gb));
    }
    catch { }
    try {
        // eslint-disable-next-line no-undef
        if (typeof __APP_VITE_API_BASE__ !== 'undefined' && __APP_VITE_API_BASE__)
            return normalizeBase(String(__APP_VITE_API_BASE__));
    }
    catch { }
    try {
        const envBase = import.meta?.env?.VITE_API_BASE || import.meta?.env?.VITE_APP_API_BASE;
        if (envBase)
            return normalizeBase(String(envBase));
    }
    catch { }
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const sp = new URLSearchParams(window.location.search);
            const q = sp.get('api') || sp.get('apibase');
            if (q)
                return normalizeBase(String(q));
        }
    }
    catch { }
    try {
        const ls = (typeof localStorage !== 'undefined') ? (localStorage.getItem('API_BASE') || localStorage.getItem('apiBase')) : '';
        if (ls)
            return normalizeBase(String(ls));
    }
    catch { }
    try {
        // eslint-disable-next-line no-undef
        const us = (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') ? (uni.getStorageSync('API_BASE') || uni.getStorageSync('apiBase')) : '';
        if (us)
            return normalizeBase(String(us));
    }
    catch { }
    try {
        if (typeof location !== 'undefined' && location.hostname) {
            const protocol = location.protocol || 'http:';
            const host = location.hostname;
            return `${protocol}//${host}:3000`;
        }
    }
    catch { }
    return 'http://127.0.0.1:3000';
}
function resolveDefaultToken() {
    try {
        // eslint-disable-next-line no-undef
        if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
            const t = uni.getStorageSync('token');
            if (t)
                return String(t);
        }
    }
    catch { }
    try {
        const t = (typeof localStorage !== 'undefined') ? localStorage.getItem('token') : null;
        return t || undefined;
    }
    catch {
        return undefined;
    }
}
function callGlobalUnauthorizedHook() {
    try {
        globalThis?.__ON_HTTP_401__?.();
    }
    catch { }
}
function createHttpClientFactory(config = {}) {
    const { baseUrl = '', getToken, onUnauthorized } = config;
    return async function request(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        const token = getToken?.();
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        let fullUrl = isAbsoluteUrl(url) ? url : (baseUrl + url);
        if (options.query) {
            const pairs = [];
            Object.entries(options.query).forEach(([k, v]) => {
                if (v === undefined || v === null)
                    return;
                if (Array.isArray(v)) {
                    v.forEach((item) => {
                        if (item === undefined || item === null)
                            return;
                        pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
                    });
                }
                else {
                    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                }
            });
            if (pairs.length > 0)
                fullUrl += (fullUrl.includes('?') ? '&' : '?') + pairs.join('&');
        }
        // 小程序端优先使用 uni.request；其余环境使用 fetch
        const canUseUni = typeof uni !== 'undefined' && typeof uni.request === 'function';
        if (canUseUni) {
            return await new Promise((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const method = (options.method || 'GET').toString().toUpperCase();
                const data = options.body && typeof options.body !== 'string' ? options.body : options.body;
                uni.request({
                    url: fullUrl,
                    method,
                    // 小程序端 dataType 默认按 content-type 解析；指定为 json 更稳妥
                    data,
                    header: headers,
                    dataType: 'json',
                    success: (resp) => {
                        if (resp.statusCode >= 200 && resp.statusCode < 300) {
                            resolve(resp.data);
                        }
                        else {
                            if (resp.statusCode === 401) {
                                try {
                                    onUnauthorized?.();
                                }
                                catch { }
                                callGlobalUnauthorizedHook();
                            }
                            // 友好提取 message 字段
                            const raw = resp.data;
                            const msg = (raw && typeof raw === 'object' && raw.message) ? String(raw.message) :
                                (typeof raw === 'string' ? raw : undefined);
                            reject(new Error(msg || `HTTP ${resp.statusCode}`));
                        }
                    },
                    fail: (err) => {
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
            body: rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string' ? JSON.stringify(rawBody) : rawBody,
        });
        if (!res.ok) {
            if (res.status === 401) {
                try {
                    onUnauthorized?.();
                }
                catch { }
                callGlobalUnauthorizedHook();
            }
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                let messageFromJson;
                try {
                    const j = await res.json();
                    const raw = j?.message;
                    if (Array.isArray(raw))
                        messageFromJson = String(raw[0]);
                    else if (raw !== undefined && raw !== null)
                        messageFromJson = String(raw);
                }
                catch { }
                throw new Error(messageFromJson || `HTTP ${res.status} ${res.statusText}`);
            }
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json'))
            return (await res.json());
        const text = await res.text();
        return text;
    };
}
export function createHttpClient(arg1, arg2) {
    if (typeof arg1 === 'string') {
        // 直接调用：createHttpClient(url, options)
        const client = createHttpClientFactory({
            baseUrl: resolveDefaultBaseUrl(),
            getToken: resolveDefaultToken,
            onUnauthorized: callGlobalUnauthorizedHook,
        });
        return client(arg1, arg2 || {});
    }
    // 工厂用法：createHttpClient(config)
    return createHttpClientFactory(arg1 || {});
}
export default createHttpClient;
