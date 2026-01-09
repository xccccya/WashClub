import { applyApiBaseToGlobals, requireApiBase } from '@wash/shared-utils';

export const API_BASE: string = requireApiBase();
applyApiBaseToGlobals(API_BASE);

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
