// 登录状态与 API 基址工具
import createHttpClient from '@wash/shared-utils/src/http';
// 对于 TS 编译环境下的全局 uni 声明
declare const uni: any;
// 对于 TS 编译环境下的全局 wx 声明（MP-微信）
declare const wx: any;

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
      // 仅在非生产构建的 devtools 下回退到 127.0.0.1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isProd = !!((import.meta as any)?.env?.PROD);
      if (!isProd && String(platform).toLowerCase() === 'devtools') return 'http://127.0.0.1:3000';
    } catch {}
    // #endif
  } catch {}
  return 'http://192.168.5.2:3000';
}
// 原：export const API_BASE = detectApiBase();
// 新优先级（更稳健）：
// - 生产环境：优先使用构建期环境变量（VITE_API_BASE / VITE_APP_API_BASE / __APP_VITE_API_BASE__）；
//   若无，则仅在非本地地址的情况下使用本地存储覆盖；否则回退自动探测
// - 开发环境：保持原有逻辑（本地存储 > 环境变量 > 自动探测）
function isLocalHostBase(s?: string | null): boolean {
  if (!s) return false;
  try {
    const u = String(s).trim();
    return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(u);
  } catch { return false; }
}
function stripTrailingSlash(s?: string | null): string {
  const v = (s || '').toString();
  return v.replace(/\/+$/, '');
}

// 读取全局注入（vite.config.ts 里 define 了 globalThis.__VITE_API_BASE__ 与编译期常量）
// 兼容不同运行环境，安全获取全局对象
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GLOBAL_OBJ: any = (typeof globalThis !== 'undefined') ? (globalThis as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : (typeof wx !== 'undefined' ? (wx as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : (typeof uni !== 'undefined' ? (uni as any) : {}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GLOBAL_DEFINED_BASE: string | undefined = GLOBAL_OBJ?.__VITE_API_BASE__ || GLOBAL_OBJ?.VITE_API_BASE;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV_BASE_1: string | undefined = (import.meta as any)?.env?.VITE_API_BASE;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV_BASE_2: string | undefined = (import.meta as any)?.env?.VITE_APP_API_BASE;
// 编译期常量兜底（由 vite.config.ts define 注入）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const __APP_VITE_API_BASE__: any;
let CONST_BASE: string | undefined;
try { if (typeof __APP_VITE_API_BASE__ !== 'undefined') CONST_BASE = String(__APP_VITE_API_BASE__ || ''); } catch {}

let STORAGE_BASE: string | undefined;
try { STORAGE_BASE = uni?.getStorageSync?.('API_BASE') || uni?.getStorageSync?.('apiBase'); } catch {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_PROD: boolean = !!((import.meta as any)?.env?.PROD);

let decidedBase: string | undefined;
if (IS_PROD) {
  decidedBase = GLOBAL_DEFINED_BASE || ENV_BASE_1 || ENV_BASE_2 || CONST_BASE || (!isLocalHostBase(STORAGE_BASE) ? STORAGE_BASE : undefined) || detectApiBase();
} else {
  decidedBase = GLOBAL_DEFINED_BASE || STORAGE_BASE || ENV_BASE_1 || ENV_BASE_2 || CONST_BASE || detectApiBase();
}

export const API_BASE = stripTrailingSlash(decidedBase);

// 正式过期时间：7 天
const TEST_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveAuth(token: string, user: any) {
  try {
    uni.setStorageSync('token', token);
    uni.setStorageSync('user', user || {});
    uni.setStorageSync('loginAt', Date.now());
    // 通知应用登录态已变更：用于驱动实时连接等
    try { uni.$emit?.('auth:changed'); } catch {}
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


