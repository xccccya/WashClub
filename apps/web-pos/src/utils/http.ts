import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';

export const http = createHttpClient({
	baseUrl: API_BASE,
	getToken: () => localStorage.getItem('token') || undefined,
	onUnauthorized: () => { try { (window as any).__HAS_SHOWN_401__ = true; } catch {} },
});

export async function httpWrap<T>(url: string, options: any = {}): Promise<T> {
	try{
		const raw = localStorage.getItem('token') || '';
		const payload = JSON.parse(atob((raw.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'))||'{}');
		const exp = Number(payload?.exp || 0);
		if (exp && Date.now()/1000 > exp - 10) {
			localStorage.removeItem('token');
			localStorage.removeItem('user');
			if (typeof window !== 'undefined') {
				try {
					if (!(window as any).__HAS_SHOWN_401__) {
						(window as any).__HAS_SHOWN_401__ = true;
						const { ElMessage } = await import('element-plus');
						ElMessage.error('登录已过期，请重新登录');
					}
				} catch {}
				window.location.href = '/pos/login';
			}
			throw new Error('登录已过期');
		}
	}catch{}
	try {
		return await http<T>(url, options);
	} catch (e:any) {
		const msg = String(e?.message||'');
		if (/^HTTP\s*401/.test(msg) || /unauthorized/i.test(msg)){
			try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
			if (typeof window !== 'undefined') {
				try {
					if (!(window as any).__HAS_SHOWN_401__) {
						(window as any).__HAS_SHOWN_401__ = true;
						const { ElMessage } = await import('element-plus');
						ElMessage.error('登录已过期，请重新登录');
					}
				} catch {}
				window.location.href = '/pos/login';
			}
		}
		throw e;
	}
}

export function absUrl(u?: string | null): string {
	if (!u) return '';
	const s = String(u);
	if (/^https?:\/\//i.test(s)) return s;
	if (s.startsWith('/')) return `${API_BASE}${s}`;
	if (s.startsWith('uploads/')) return `${API_BASE}/${s}`;
	return `${API_BASE}/${s}`;
}


