// 登录状态与 API 基址工具
import createHttpClient from '@wash/shared-utils/src/http';
// 对于 TS 编译环境下的全局 uni 声明
declare const uni: any;

// API 基址：
// - H5：使用当前主机 + :3000
// - 微信开发者工具（MP-微信 devtools）：优先 127.0.0.1:3000
// - 其余：回退到局域网地址
// - 允许通过本地存储覆盖：API_BASE / apiBase
function detectApiBase(): string {
  try {
    // 允许动态覆盖
    const override = uni?.getStorageSync?.('API_BASE') || uni?.getStorageSync?.('apiBase');
    if (override && typeof override === 'string') return override;

    // #ifdef H5
    if (typeof window !== 'undefined' && window.location) {
      const { protocol, hostname } = window.location;
      if (hostname) return `${protocol}//${hostname}:3000`;
    }
    // #endif

    // #ifdef MP-WEIXIN
    try {
      const sys = uni.getSystemInfoSync?.();
      const platform = sys?.platform || '';
      // 微信开发者工具内，platform 通常为 'devtools'
      if (String(platform).toLowerCase() === 'devtools') {
        return 'http://127.0.0.1:3000';
      }
    } catch {}
    // #endif
  } catch {}
  return 'http://192.168.5.2:3000';
}
export const API_BASE = detectApiBase();

// 正式过期时间：7 天
const TEST_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveAuth(token: string, user: any) {
  try {
    uni.setStorageSync('token', token);
    uni.setStorageSync('user', user || {});
    uni.setStorageSync('loginAt', Date.now());
  } catch {}
}

export function getToken(): string | null {
  try { return uni.getStorageSync('token') || null; } catch { return null; }
}

export function decodeJwtExpMs(token?: string | null): number | null {
  if (!token) return null;
  try {
    const seg = token.split('.')[1];
    const json = JSON.parse(decodeURIComponent(escape(atob(seg))));
    if (json && json.exp) return Number(json.exp) * 1000;
  } catch {}
  return null;
}

export function isExpiredNow(token?: string | null): boolean {
  const loginAt = Number(uni.getStorageSync('loginAt') || 0);
  const expMsFromJwt = decodeJwtExpMs(token || getToken());
  const hardExpire = loginAt ? loginAt + TEST_EXPIRE_MS : null;
  const now = Date.now();
  const candidates = [hardExpire, expMsFromJwt].filter((v): v is number => typeof v === 'number' && !isNaN(v));
  if (candidates.length === 0) return !token; // 没有任何信息则视为未登录
  const minExpire = Math.min(...candidates);
  return now >= minExpire;
}

export async function checkAuthAndRefresh(options: { redirectIfExpired?: boolean } = { redirectIfExpired: true }): Promise<boolean> {
  const { redirectIfExpired = true } = options || {};
  const token = getToken();
  const redirect = () => {
    if (!redirectIfExpired) return;
    uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
    setTimeout(() => {
      try { uni.navigateTo({ url: '/pages/login/index' }); } catch {}
    }, 300);
  };

  // 未登录：返回 false，不提示、不跳转；由页面自行引导登录
  if (!token) { return false; }

  const http = createHttpClient({ baseUrl: API_BASE, getToken: () => token || '' });

  // 始终以服务端验证为准：调用 profile 校验 token 是否有效
  try {
    const profile = await http<any>('/member/me/profile', { method: 'GET' });
    if (profile) { uni.setStorageSync('user', profile); uni.setStorageSync('loginAt', Date.now()); return true; }
  } catch {
    try { uni.removeStorageSync('token'); uni.removeStorageSync('user'); } catch {}
    redirect();
    return false;
  }
  // 正常返回
  return true;
}

export function createHttp() {
  return createHttpClient({ baseUrl: API_BASE, getToken: () => getToken() || '' });
}


