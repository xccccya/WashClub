/**
 * Bearer Token helpers
 *
 * 目标：
 * - 统一大小写处理（Bearer/bearer）
 * - 避免各处重复写正则/replace 导致行为不一致
 */
export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(String(authHeader));
  return m?.[1] ? String(m[1]) : null;
}

export function extractBearerTokenFromHeaders(headers: Record<string, unknown> | undefined): string | null {
  if (!headers) return null;
  const h = (headers as any)?.authorization || (headers as any)?.Authorization;
  return extractBearerToken(typeof h === 'string' ? h : (h == null ? null : String(h)));
}

export function stripBearerPrefix(authHeader?: string | null): string {
  // 用于兼容旧代码：有些地方只想拿到“去掉 Bearer 前缀”的 token 字符串
  // - 没有 header 时返回空串
  // - 不是 Bearer 结构时也返回空串（避免把其它 scheme 当 token）
  return extractBearerToken(authHeader) || '';
}

