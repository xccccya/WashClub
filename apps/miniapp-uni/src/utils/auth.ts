// 登录状态与 API 基址工具
import { memberControllerMe } from '@wash/api-client';
import { applyApiBaseToGlobals, requireApiBase } from '@wash/shared-utils';
// 对于 TS 编译环境下的全局 uni 声明
declare const uni: any;
// API 基址（统一由 @wash/shared-utils 解析）：
// - 生产环境：仅允许构建/部署期注入（VITE_API_BASE / __APP_VITE_API_BASE__ / globalThis.__VITE_API_BASE__）
// - 开发环境：允许 URL 参数 / storage 覆盖，便于联调
export const API_BASE = requireApiBase();
applyApiBaseToGlobals(API_BASE);

export function saveAuth(token: string, user: any) {
  try {
    uni.setStorageSync('token', token);
    uni.setStorageSync('user', user || {});
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
  // 安全一致性：会员端 token 的过期只以 JWT 的 exp 为准；
  // 不再使用本地 loginAt + 固定 maxAge 的“二次过期”逻辑（会与服务端配置不一致）。
  const t = token || getToken();
  if (!t) return true;
  const expMsFromJwt = decodeJwtExpMs(t);
  // 无法解析 exp 时，不在本地强行判过期；交给服务端 401 + 全局 401 hook 处理
  if (!expMsFromJwt) return false;
  return Date.now() >= expMsFromJwt;
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

  // 始终以服务端验证为准：调用 profile 校验 token 是否有效
  try {
    // SDK 底层会自动从 uni storage 读取 token 并加 Authorization 头，这里无需再拼 query token
    const profile = await (memberControllerMe() as any);
    if (profile) { uni.setStorageSync('user', profile); return true; }
  } catch {
    try { uni.removeStorageSync('token'); uni.removeStorageSync('user'); } catch {}
    redirect();
    return false;
  }
  // 正常返回
  return true;
}
