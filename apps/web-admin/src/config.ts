// 统一 API 基址解析（与 web-pos 保持一致）：
// 优先级：环境变量 > URL 查询参数(api/apibase) > localStorage(API_BASE) > 基于当前 host 推断 > 127.0.0.1:3000
function normalizeBase(u: string): string {
    try {
        const s = String(u || '').trim();
        if (!s) return '';
        if (/^https?:\/\//i.test(s)) return s.replace(/\/$/, '');
        return `${(typeof location!== 'undefined' ? (location.protocol || 'http:') : 'http:')}//${s}`.replace(/\/$/, '');
    } catch { return ''; }
}

export function resolveApiBase(): string {
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
