import * as crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { resolveBcryptSaltRoundsEnv } from '../env.js';

function sha256Hex(raw: string): string {
	return crypto.createHash('sha256').update(raw).digest('hex');
}

export function isBcryptHash(v: string): boolean {
	// $2a$ / $2b$ / $2y$ + cost(2 digits) + $
	return typeof v === 'string' && /^\$2[aby]\$\d{2}\$/.test(v);
}

export function isLegacySha256Hash(v: string): boolean {
	return typeof v === 'string' && /^[a-f0-9]{64}$/i.test(v);
}

function bcryptHash(raw: string, saltRounds: number): Promise<string> {
	return new Promise((resolve, reject) => {
		bcrypt.hash(raw, saltRounds, (err, hash) => {
			if (err) return reject(err);
			resolve(String(hash));
		});
	});
}

function bcryptCompare(raw: string, hash: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		bcrypt.compare(raw, hash, (err, same) => {
			if (err) return reject(err);
			resolve(!!same);
		});
	});
}

export async function hashPassword(raw: string): Promise<string> {
	const rounds = resolveBcryptSaltRoundsEnv();
	return await bcryptHash(raw, rounds);
}

/**
 * 校验密码：
 * - 若存储为 bcrypt：正常 compare
 * - 若存储为旧 sha256(hex)：用 sha256 校验；成功则标记 needsUpgrade=true（建议立即升级为 bcrypt）
 */
export async function verifyPassword(raw: string, storedHash: string): Promise<{ ok: boolean; needsUpgrade: boolean }> {
	if (!raw || typeof raw !== 'string') return { ok: false, needsUpgrade: false };
	if (!storedHash || typeof storedHash !== 'string') return { ok: false, needsUpgrade: false };

	if (isBcryptHash(storedHash)) {
		const ok = await bcryptCompare(raw, storedHash);
		return { ok, needsUpgrade: false };
	}

	if (isLegacySha256Hash(storedHash)) {
		const ok = sha256Hex(raw).toLowerCase() === storedHash.toLowerCase();
		return { ok, needsUpgrade: ok };
	}

	// 未知格式：当作不匹配处理（避免意外放行）
	return { ok: false, needsUpgrade: false };
}


