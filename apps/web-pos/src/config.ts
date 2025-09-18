// 统一 API 基址解析：
// 优先级：全局注入/编译期常量 > 环境变量 > URL 查询参数(api/apibase) > localStorage(API_BASE) > 基于当前 host 推断 > 127.0.0.1:3000
function normalizeBase(u: string): string {
    try {
        const s = String(u || '').trim();
        if (!s) return '';
        // 允许不带协议的主机:端口形式
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

function resolveApiBase(): string {
    // 0) 全局注入/编译期常量
    try {
        if (GLOBAL_DEFINED_BASE) return normalizeBase(String(GLOBAL_DEFINED_BASE));
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        if (typeof __APP_VITE_API_BASE__ !== 'undefined' && __APP_VITE_API_BASE__) {
            return normalizeBase(String(__APP_VITE_API_BASE__));
        }
    } catch {}

    // 1) 环境变量（构建/启动时指定）
    const envBase = (import.meta as any)?.env?.VITE_API_BASE || (import.meta as any)?.env?.VITE_APP_API_BASE;
    if (envBase) return normalizeBase(String(envBase));

    // 2) URL 查询参数覆盖：?api= http(s)://ip:port 或 host:port
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const sp = new URLSearchParams(window.location.search);
            const q = sp.get('api') || sp.get('apibase');
            if (q) return normalizeBase(q);
        }
    } catch {}

    // 3) localStorage 覆盖
    try {
        const ls = (typeof localStorage !== 'undefined') ? localStorage.getItem('API_BASE') : '';
        if (ls) return normalizeBase(ls);
    } catch {}

    // 4) 基于当前页面 host 推断：同协议 + 当前主机 + :3000
    try {
        if (typeof location !== 'undefined' && location.hostname) {
            const protocol = location.protocol || 'http:';
            const host = location.hostname; // 可能是 192.168.x.x / 10.x / 主机名
            // 常见开发端口：5173/5174 → 推断后端默认 3000
            const apiPort = 3000;
            return `${protocol}//${host}:${apiPort}`;
        }
    } catch {}

    // 5) 兜底：本机
    return 'http://127.0.0.1:3000';
}

export const API_BASE: string = resolveApiBase();

// 固定的游客会员ID：优先读取环境变量 VITE_GUEST_MEMBER_ID；否则允许通过 localStorage/URL 覆盖；最后回退为 0（交由后端兜底）
export function resolveGuestMemberId(): number {
    try {
        const envId = (import.meta as any)?.env?.VITE_GUEST_MEMBER_ID;
        if (envId != null) {
            const n = Number(envId);
            if (Number.isFinite(n) && n > 0) return n;
        }
    } catch {}
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const sp = new URLSearchParams(window.location.search);
            const q = sp.get('guest') || sp.get('guestId') || sp.get('guest_member_id');
            if (q) {
                const n = Number(q);
                if (Number.isFinite(n) && n > 0) return n;
            }
        }
    } catch {}
    try {
        const ls = (typeof localStorage !== 'undefined') ? localStorage.getItem('GUEST_MEMBER_ID') : '';
        if (ls) {
            const n = Number(ls);
            if (Number.isFinite(n) && n > 0) return n;
        }
    } catch {}
    return 0; // 0 表示由后端 GUEST_MEMBER_ID 兜底
}

export function setApiBaseForSession(url: string) {
    try { localStorage.setItem('API_BASE', normalizeBase(url)); } catch {}
}

