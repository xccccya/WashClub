import { API_BASE } from './auth';

export function resolveImageUrl(input?: string | null): string {
  try {
    const s = String(input || '').trim();
    if (!s) return '';
    // 本地静态/临时资源：保持原样（不拼接 API_BASE）
    if (/^\/(static|uni_modules|pages)\//.test(s)) return s;
    if (/^(data:|blob:|wxfile:|file:\/\/)/i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return `${API_BASE}${s}`;
    if (s.startsWith('uploads/')) return `${API_BASE}/${s}`;
    return s;
  } catch {
    return '';
  }
}


