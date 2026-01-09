/**
 * 统一的环境变量读取工具（apps/api）
 *
 * 约定：
 * - `GUEST_MEMBER_ID` 为标准变量名：用于“游客订单/游客车辆”等场景的兜底会员归属。
 * - 兼容历史拼写：`GUESS_MEMBER_ID`（仅作为 fallback）。
 */

const ENV_GUEST_MEMBER_ID = 'GUEST_MEMBER_ID' as const;
const ENV_GUEST_MEMBER_ID_LEGACY = 'GUESS_MEMBER_ID' as const;
const ENV_NO_PLATE_NUMBER = 'NO_PLATE_NUMBER' as const;
const ENV_JWT_SECRET = 'JWT_SECRET' as const;
const ENV_JWT_EXPIRES_IN = 'JWT_EXPIRES_IN' as const;
const ENV_BCRYPT_SALT_ROUNDS = 'BCRYPT_SALT_ROUNDS' as const;

export const DEFAULT_NO_PLATE_NUMBER = '川K00000' as const;

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
	// 避免在高频请求路径里刷屏
	if (warned.has(key)) return;
	warned.add(key);
	// eslint-disable-next-line no-console
	console.warn(message);
}

function getEnvTrimmed(name: string): string | undefined {
	const v = process.env[name];
	if (typeof v !== 'string') return undefined;
	const t = v.trim();
	return t ? t : undefined;
}

/**
 * 读取 JWT_SECRET（强制）。
 *
 * 安全约束：
 * - 不允许默认回退到弱 secret（例如 dev_secret）。
 * - 未配置将直接抛错并阻止服务启动，避免生产环境漏配导致 Token 可被伪造。
 */
export function resolveJwtSecretEnv(): string {
	const v = getEnvTrimmed(ENV_JWT_SECRET);
	if (!v) {
		throw new Error(
			`[env] 缺少 ${ENV_JWT_SECRET}。出于安全原因不再提供默认值，请在环境变量或 .env 中设置一个强随机字符串（建议 >= 32 字符）。`,
		);
	}
	if (v === 'dev_secret') {
		throw new Error(
			`[env] ${ENV_JWT_SECRET} 不允许配置为 "dev_secret"（弱 secret）。请替换为强随机字符串（建议 >= 32 字符）。`,
		);
	}
	return v;
}

/**
 * JWT 过期时间（可选），默认 7d。
 * 支持 Nest JWT 的 expiresIn 格式，如：60s、15m、7d。
 */
export function resolveJwtExpiresInEnv(): string {
	return getEnvTrimmed(ENV_JWT_EXPIRES_IN) ?? '7d';
}

/**
 * bcrypt cost factor（可选），默认 10。
 * - 数值越大越安全但越耗时；建议 10~12
 */
export function resolveBcryptSaltRoundsEnv(): number {
	const raw = getEnvTrimmed(ENV_BCRYPT_SALT_ROUNDS);
	if (!raw) return 10;
	const n = Number(raw);
	// bcryptjs 支持 4~31，但实际线上不建议过大；这里做一个温和约束避免误配导致 CPU 打满
	if (!Number.isFinite(n) || !Number.isInteger(n)) {
		throw new Error(`[env] ${ENV_BCRYPT_SALT_ROUNDS} 必须为整数（例如 10）`);
	}
	if (n < 8 || n > 15) {
		throw new Error(`[env] ${ENV_BCRYPT_SALT_ROUNDS} 建议配置在 8~15 之间（当前=${raw}）`);
	}
	return n;
}

/**
 * 读取游客兜底会员ID。
 *
 * 读取顺序：
 * 1) `GUEST_MEMBER_ID`
 * 2) `GUESS_MEMBER_ID`（兼容旧拼写）
 *
 * 返回值：
 * - 正常：>0 的数字
 * - 未配置/非法：0
 */
export function resolveGuestMemberIdEnv(): number {
	const primary = getEnvTrimmed(ENV_GUEST_MEMBER_ID);
	const legacy = getEnvTrimmed(ENV_GUEST_MEMBER_ID_LEGACY);

	if (primary && legacy && primary !== legacy) {
		warnOnce(
			`${ENV_GUEST_MEMBER_ID}_CONFLICT`,
			`[env] 同时配置了 ${ENV_GUEST_MEMBER_ID}=${primary} 与 ${ENV_GUEST_MEMBER_ID_LEGACY}=${legacy}，将优先使用 ${ENV_GUEST_MEMBER_ID}。请清理旧变量避免歧义。`,
		);
	}

	const raw = primary ?? legacy;
	if (!raw) return 0;
	const n = Number(raw);
	return Number.isFinite(n) ? n : 0;
}

/**
 * 读取“无牌车”占位车牌号（可选），默认：川K00000。
 *
 * 用途：
 * - 收银端/队列端一键选择“无牌车”
 * - 兼容历史生产环境一直使用的占位车牌
 */
export function resolveNoPlateNumberEnv(): string {
	return getEnvTrimmed(ENV_NO_PLATE_NUMBER) ?? DEFAULT_NO_PLATE_NUMBER;
}

/**
 * 判断给定车牌是否为“无牌车”占位车牌（大小写不敏感）。
 */
export function isNoPlateNumber(plateNumber: string): boolean {
	const p = String(plateNumber || '').trim().toUpperCase();
	if (!p) return false;
	const target = resolveNoPlateNumberEnv().trim().toUpperCase();
	return p === target;
}


