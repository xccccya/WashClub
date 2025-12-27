import { API_BASE } from '../config';

export function absUrl(u?: string | null): string {
	if (!u) return '';
	const s = String(u);
	if (/^https?:\/\//i.test(s)) return s;
	if (s.startsWith('/')) return `${API_BASE}${s}`;
	if (s.startsWith('uploads/')) return `${API_BASE}/${s}`;
	return `${API_BASE}/${s}`;
}


