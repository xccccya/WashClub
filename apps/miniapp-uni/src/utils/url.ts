import { API_BASE } from './auth';

export function resolveImageUrl(input?: string | null): string {
  try {
    const s = String(input || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return `${API_BASE}${s}`;
    if (s.startsWith('uploads/')) return `${API_BASE}/${s}`;
    return s;
  } catch {
    return '';
  }
}


