// 统一 API 基址解析（与 web-pos 保持一致）：
// 优先级：全局注入/编译期常量 > 环境变量 > URL 查询参数(api/apibase) > localStorage(API_BASE) > 基于当前 host 推断 > 127.0.0.1:3000
function normalizeBase(u: string): string {
    try {
        const s = String(u || '').trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s)) return s.replace(/\/$/, '');
        return `${(typeof location!== 'undefined' ? (location.protocol || 'http:') : 'http:')}//${s}`.replace(/\/$/, '');
    } catch { return ''; }
}

// 兼容全局注入与编译期常量
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __APP_VITE_API_BASE__: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GLOBAL_OBJ: any = (typeof globalThis !== 'undefined') ? (globalThis as any) : (typeof window !== 'undefined' ? (window as any) : {});
const GLOBAL_DEFINED_BASE: string | undefined = GLOBAL_OBJ?.__VITE_API_BASE__ || GLOBAL_OBJ?.VITE_API_BASE;

export function resolveApiBase(): string {
    // 0) 全局注入/编译期常量（vite define）
    try {
        if (GLOBAL_DEFINED_BASE) return normalizeBase(String(GLOBAL_DEFINED_BASE));
        // 直接访问常量，若未定义会抛错，用 try 包裹
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        if (typeof __APP_VITE_API_BASE__ !== 'undefined' && __APP_VITE_API_BASE__) {
            return normalizeBase(String(__APP_VITE_API_BASE__));
        }
    } catch {}

    const envBase = (import.meta as any)?.env?.VITE_API_BASE || (import.meta as any)?.env?.VITE_APP_API_BASE;
    if (envBase) return normalizeBase(String(envBase));
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const sp = new URLSearchParams(window.location.search);
            const q = sp.get('api') || sp.get('apibase');
            if (q) return normalizeBase(q);
        }
    } catch {}
    try {
        const ls = (typeof localStorage !== 'undefined') ? localStorage.getItem('API_BASE') : '';
        if (ls) return normalizeBase(ls);
    } catch {}
    try {
        if (typeof location !== 'undefined' && location.hostname) {
            const protocol = location.protocol || 'http:';
            const host = location.hostname;
            const apiPort = 3000;
            return `${protocol}//${host}:${apiPort}`;
        }
    } catch {}
    return 'http://127.0.0.1:3000';
}

export const API_BASE: string = resolveApiBase();
