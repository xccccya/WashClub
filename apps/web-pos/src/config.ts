import { applyApiBaseToGlobals, normalizeApiBase, requireApiBase } from '@wash/shared-utils';

export const API_BASE: string = requireApiBase();
applyApiBaseToGlobals(API_BASE);

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

// 无牌车占位车牌号：优先读取环境变量 VITE_NO_PLATE_NUMBER；允许 URL/localStorage 覆盖；最后回退为“川K00000”
export const DEFAULT_NO_PLATE_NUMBER = '川K00000';
export function resolveNoPlateNumber(): string {
    try {
        const env = (import.meta as any)?.env?.VITE_NO_PLATE_NUMBER;
        if (env != null) {
            const s = String(env || '').trim();
            if (s) return s;
        }
    } catch {}
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const sp = new URLSearchParams(window.location.search);
            const q = sp.get('noPlate') || sp.get('no_plate') || sp.get('no_plate_number');
            if (q) {
                const s = String(q || '').trim();
                if (s) return s;
            }
        }
    } catch {}
    try {
        const ls = (typeof localStorage !== 'undefined') ? localStorage.getItem('NO_PLATE_NUMBER') : '';
        if (ls) {
            const s = String(ls || '').trim();
            if (s) return s;
        }
    } catch {}
    return DEFAULT_NO_PLATE_NUMBER;
}

export function setApiBaseForSession(url: string) {
    // 生产环境禁用运行时覆盖（避免误配导致打到错误环境）
    try { if ((import.meta as any)?.env?.PROD) return; } catch {}
    try { localStorage.setItem('API_BASE', normalizeApiBase(url)); } catch {}
}

