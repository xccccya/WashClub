import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { SmsService } from './sms.service.js';
import { WechatTokenService } from './wechat-token.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { resolveAdminJwtExpiresInEnv, resolveJwtSecretEnv, resolveMemberJwtExpiresInEnv } from '../env.js';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

type ChangePhoneStage = 'old' | 'new';

type StoredChangePhoneCode = {
	version: 'v1';
	attempts: number;
	salt: string;
	digest: string;
};

const CHANGE_PHONE_MAX_ATTEMPTS = 5;
const CHANGE_PHONE_CODE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
	constructor(private prisma: PrismaService, private jwt: JwtService, private sms: SmsService, private wechatToken: WechatTokenService) {}

	// ====== WeChat MiniApp One-Tap Login Support ======

	private get wechatAppId(): string {
		const v = process.env.WECHAT_MINIAPP_APPID || process.env.WECHAT_APPID;
		if (!v) throw new BadRequestException('后台未配置 WECHAT_MINIAPP_APPID');
		return v;
	}

	private get wechatSecret(): string {
		const v = process.env.WECHAT_MINIAPP_SECRET || process.env.WECHAT_SECRET;
		if (!v) throw new BadRequestException('后台未配置 WECHAT_MINIAPP_SECRET');
		return v;
	}

	private async getWechatAccessToken(): Promise<string> { return this.wechatToken.getAccessToken(); }

	private async exchangeWechatPhoneNumberByCode(code: string): Promise<string> {
		if (!code) throw new BadRequestException('缺少手机号动态令牌code');
		const accessToken = await this.getWechatAccessToken();
		const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`;
		let data: any;
		{
			let lastErr: any = null;
			for (let attempt = 0; attempt < 2; attempt++) {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 12000);
				try {
					const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), signal: controller.signal });
					clearTimeout(timeout);
					if (!resp.ok) { lastErr = new Error(`${resp.status} ${resp.statusText}`); }
					else { data = await resp.json(); break; }
				} catch (e: any) { clearTimeout(timeout); lastErr = e; }
				await new Promise((r)=>setTimeout(r, 300 * (attempt + 1)));
			}
			if (!data) throw new BadRequestException(`获取手机号网络失败: ${lastErr?.message || lastErr}`);
		}
		// 期望结构: { errcode:0, errmsg:'ok', phone_info: { phoneNumber: '1xxxxxxxxxx', purePhoneNumber: '1xxxxxxxxxx' } }
		if (data?.errcode !== 0 || !data?.phone_info?.purePhoneNumber) {
			throw new BadRequestException(`获取手机号失败: ${JSON.stringify(data)}`);
		}
		return String(data.phone_info.purePhoneNumber);
	}

	// 暴露给外部调用：通过微信实时手机号 code 换取手机号
	async resolvePhoneByWechatCode(code: string): Promise<{ phone: string }>{
		const phone = await this.exchangeWechatPhoneNumberByCode(code);
		return { phone };
	}

	private async exchangeWechatOpenIdByJsCode(jsCode: string): Promise<{ openid: string; unionid?: string }>{
		if (!jsCode) throw new BadRequestException('缺少wx.login返回的jsCode');
		const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(this.wechatAppId)}&secret=${encodeURIComponent(this.wechatSecret)}&js_code=${encodeURIComponent(jsCode)}&grant_type=authorization_code`;
		let data: any;
		{
			let lastErr: any = null;
			for (let attempt = 0; attempt < 2; attempt++) {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 12000);
				try {
					const resp = await fetch(url, { signal: controller.signal });
					clearTimeout(timeout);
					if (!resp.ok) { lastErr = new Error(`${resp.status} ${resp.statusText}`); }
					else { data = await resp.json(); break; }
				} catch (e: any) { clearTimeout(timeout); lastErr = e; }
				await new Promise((r)=>setTimeout(r, 300 * (attempt + 1)));
			}
			if (!data) throw new BadRequestException(`换取openid网络失败: ${lastErr?.message || lastErr}`);
		}
		if (!data?.openid) throw new BadRequestException(`换取openid失败: ${JSON.stringify(data)}`);
		return { openid: String(data.openid), unionid: data?.unionid ? String(data.unionid) : undefined };
	}

	private maskPhone(phone: string): string {
		return String(phone).replace(/^(\d{3})\d+(\d{4})$/, '$1****$2');
	}

	private generateRandomName(): string {
		// 生成5位由数字与大小写字母组成的随机串
		const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
		let suffix = '';
		for (let i = 0; i < 4; i++) {
			const idx = Math.floor(Math.random() * alphabet.length);
			suffix += alphabet[idx];
		}
		return `用户${suffix}`;
	}

	private changePhonePurpose(memberId: number, stage: ChangePhoneStage): string {
		return `changePhone:v2:${memberId}:${stage}`;
	}

	private hashChangePhoneCode(salt: string, code: string): string {
		return createHmac('sha256', resolveJwtSecretEnv())
			.update(`change-phone:v1:${salt}:${code}`, 'utf8')
			.digest('hex');
	}

	private encodeChangePhoneCode(code: string, attempts = 0): string {
		const salt = randomBytes(16).toString('hex');
		const digest = this.hashChangePhoneCode(salt, code);
		return `v1$${attempts}$${salt}$${digest}`;
	}

	private encodeStoredChangePhoneCode(record: StoredChangePhoneCode): string {
		return `${record.version}$${record.attempts}$${record.salt}$${record.digest}`;
	}

	private parseStoredChangePhoneCode(value: string): StoredChangePhoneCode | null {
		const [version, attemptsRaw, salt, digest, extra] = String(value || '').split('$');
		const attempts = Number(attemptsRaw);
		if (extra !== undefined || version !== 'v1' || !Number.isInteger(attempts) || attempts < 0) return null;
		if (!/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{64}$/i.test(digest || '')) return null;
		return { version: 'v1', attempts, salt, digest };
	}

	private matchesStoredChangePhoneCode(record: StoredChangePhoneCode, submittedCode: string): boolean {
		const expected = Buffer.from(record.digest, 'hex');
		const actual = Buffer.from(this.hashChangePhoneCode(record.salt, submittedCode), 'hex');
		return expected.length === actual.length && timingSafeEqual(expected, actual);
	}

	private async generateUniqueMemberUid(): Promise<number> {
		// 生成唯一8位数字UID，最多尝试若干次
		for (let i = 0; i < 20; i++) {
			const uid = Math.floor(10000000 + Math.random() * 90000000);
			const exists = await this.prisma.member.findUnique({ where: { uid }, select: { id: true } }).catch(() => null);
			if (!exists) return uid;
		}
		// 极端情况下仍冲突，退化到时间 + 随机的取模
		return Number(String(Date.now()).slice(-8));
	}

	async wechatOneTapLogin(params: { phoneCode: string; jsCode: string }): Promise<
		| { ok: true; token: string; user: { id: number; name: string; role: 'member'; phone: string }; createdNew: boolean; justBoundOpenId: boolean }
		| { ok: false; code: 'OPENID_BOUND_CONFLICT'; maskedPhone: string; message: string }
	> {
		const { phoneCode, jsCode } = params;
		// Step1: 获取手机号
		const phone = await this.exchangeWechatPhoneNumberByCode(phoneCode);
		// Step2: 获取 openid
		const { openid } = await this.exchangeWechatOpenIdByJsCode(jsCode);

		// Step3: 查询该 openid 是否已绑定到其他手机号
		const openIdOwner = await this.prisma.member.findFirst({ where: { weixinOpenId: openid }, select: { id: true, phone: true } });
		if (openIdOwner && openIdOwner.phone !== phone) {
			return { ok: false, code: 'OPENID_BOUND_CONFLICT', maskedPhone: this.maskPhone(openIdOwner.phone), message: `该微信号已绑定手机号：${this.maskPhone(openIdOwner.phone)}` };
		}

		// Step4: 查找/创建手机号会员
		let member = await this.prisma.member.findUnique({ where: { phone }, include: { tags: true } });
		let createdNew = false;
		if (!member) {
			const uid = await this.generateUniqueMemberUid();
			// 注册新会员时，必须分配“默认等级”（成长值要求应为0）
			const defaultLevel = await this.prisma.memberLevel.findFirst({ where: { isDefault: true } as any });
			if (!defaultLevel) {
				throw new BadRequestException('系统未配置默认会员等级，请先在管理后台设置');
			}
			// 头像策略：未自定义头像的用户不写入默认头像 URL（保持为 null），
			// 展示层/客户端根据站点设置 defaultMemberAvatarUrl 动态回退，保证更换默认头像可同步生效。
			member = await this.prisma.member.create({ data: { uid, name: this.generateRandomName(), phone, levelId: defaultLevel.id, avatarUrl: null }, include: { tags: true } });
			createdNew = true;
		}
		if (!member) throw new BadRequestException('登录失败，请重试');

		// Step5: 如未绑定 openid 则绑定
		let justBoundOpenId = false;
		if (!member.weixinOpenId) {
			justBoundOpenId = true;
			await this.prisma.member.update({ where: { id: member.id }, data: { weixinOpenId: openid } });
		}

		// Step6: 为不同场景自动打系统标签
		try {
			// id=3: 微信一键登录自动创建账号（仅新建时）
			if (createdNew) {
				const has3 = (member.tags || []).some((t: any) => t.id === 3);
				if (!has3) {
					await this.prisma.member.update({ where: { id: member.id }, data: { tags: { connect: [{ id: 3 }] } } });
				}
			}
			// id=4: 微信一键登录绑定已有账号（仅非新建账号且本次完成绑定时）
			if (!createdNew && justBoundOpenId) {
				const refreshed = await this.prisma.member.findUnique({ where: { id: member.id }, include: { tags: true } });
				const has4 = (refreshed?.tags || []).some((t: any) => t.id === 4);
				if (!has4) {
					await this.prisma.member.update({ where: { id: member.id }, data: { tags: { connect: [{ id: 4 }] } } });
				}
			}
		} catch {}

		// Step7: 发放登录 token
		const token = await this.jwt.signAsync(
			{ sub: member.id, type: 'member', phone: member.phone },
			// NestJS 11 的 jsonwebtoken 类型对 expiresIn 更严格（StringValue | number），
			// 但本项目允许通过环境变量传入 '7d'/'15m' 等字符串，这里做一次显式类型收敛。
			{ expiresIn: resolveMemberJwtExpiresInEnv() as any },
		);
		return { ok: true, token, user: { id: member.id, name: member.name, role: 'member', phone: member.phone }, createdNew, justBoundOpenId };
	}

	// 管理后台用户登录（保留）
	async loginAdminByPassword(phone: string, password: string) {
		const invalidMsg = '账号或密码错误，请检查后重试';
		const user = await this.prisma.user.findUnique({ where: { phone }, include: { roleRef: true } });
		if (!user) throw new UnauthorizedException(invalidMsg);
		const { ok, needsUpgrade } = await verifyPassword(password, user.password);
		if (!ok) throw new UnauthorizedException(invalidMsg);
		// 旧 sha256 登录成功后自动升级为 bcrypt（不影响用户体验）
		if (needsUpgrade) {
			try {
				const upgraded = await hashPassword(password);
				await this.prisma.user.update({ where: { id: user.id }, data: { password: upgraded } });
			} catch {}
		}
		if (user.roleId && user.roleRef && !user.roleRef.enabled) throw new ForbiddenException('该角色已被禁用');
		const permissions = Array.isArray(user.roleRef?.permissions) ? (user.roleRef?.permissions as any) : [];
		const expiresIn = resolveAdminJwtExpiresInEnv() as any;
		const token = await this.jwt.signAsync(
			{ sub: user.id, type: 'admin', role: user.role, roleId: user.roleId, phone: user.phone },
			{ expiresIn },
		);
		let expiresAt: number | undefined = undefined;
		try { const decoded: any = this.jwt.decode(token); const exp = Number(decoded?.exp||0); if (exp) expiresAt = exp * 1000; } catch {}
		return { token, expiresAt, user: { id: user.id, name: user.name ?? '', role: user.role, phone: user.phone, roleId: user.roleId ?? null, permissions, avatarUrl: (user as any).avatarUrl ?? null } };
	}

	// 小程序会员登录
	async loginMemberByPassword(phone: string, password: string) {
		const member = await this.prisma.member.findUnique({ where: { phone } });
		if (!member || !member.password) throw new UnauthorizedException('会员账号不存在或未设置密码');
		const { ok, needsUpgrade } = await verifyPassword(password, member.password);
		if (!ok) throw new UnauthorizedException('密码错误');
		if (needsUpgrade) {
			try {
				const upgraded = await hashPassword(password);
				await this.prisma.member.update({ where: { id: member.id }, data: { password: upgraded } });
			} catch {}
		}
		// 正式：令牌 7 天过期
		const token = await this.jwt.signAsync(
			{ sub: member.id, type: 'member', phone: member.phone },
			{ expiresIn: resolveMemberJwtExpiresInEnv() as any },
		);
		return { token, user: { id: member.id, name: member.name, role: 'member', phone: member.phone } };
	}

	// 发送短信验证码（5分钟有效，含频控：60秒内同一手机号不重复发送；每日最多10条）
	async sendLoginCode(rawPhone: string, rawPurpose?: 'login' | 'resetPwd') {
		const phone = String(rawPhone || '').trim();
		if (!/^1\d{10}$/.test(phone)) throw new BadRequestException('手机号格式不正确');
		const purpose = rawPurpose === 'resetPwd' ? 'resetPwd' : 'login';
		const now = new Date();
		const fiveMinLater = new Date(Date.now() + 5 * 60 * 1000);
		// 频控：60秒内不重复发
		const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
		const recent = await this.prisma.smsCode.findFirst({ where: { phone, createdAt: { gt: oneMinuteAgo }, purpose }, orderBy: { id: 'desc' } });
		if (recent) throw new BadRequestException('发送太频繁，请稍后再试');
		// 当日最多 10 条
		const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
		const countToday = await this.prisma.smsCode.count({ where: { phone, createdAt: { gte: startOfDay }, purpose } });
		if (countToday >= 10) throw new BadRequestException('当日发送次数过多，请明日再试');
		// 生成 6 位数字验证码
		const code = randomInt(100000, 1000000).toString();
		// 发送短信
		await this.sms.sendLoginCode(phone, code, 5);
		// 存库
		await this.prisma.smsCode.create({ data: { phone, code, purpose, expiresAt: fiveMinLater } });
		return { ok: true };
	}

	async sendChangePhoneCode(memberId: number, stage: ChangePhoneStage, rawNewPhone?: string) {
		const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { id: true, phone: true } });
		if (!member) throw new UnauthorizedException('会员账号不存在');

		let phone = member.phone;
		if (stage === 'new') {
			phone = String(rawNewPhone || '').trim();
			if (!/^1\d{10}$/.test(phone)) throw new BadRequestException('手机号格式不正确');
			if (phone === member.phone) throw new BadRequestException('新旧手机号一致');
			const occupied = await this.prisma.member.findUnique({ where: { phone }, select: { id: true } });
			if (occupied && occupied.id !== memberId) throw new BadRequestException('该手机号已被其他账号绑定');
		}

		const purpose = this.changePhonePurpose(memberId, stage);
		const now = new Date();
		const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
		const [recentForBinding, recentForPhone] = await Promise.all([
			this.prisma.smsCode.findFirst({ where: { purpose, createdAt: { gt: oneMinuteAgo } }, orderBy: { id: 'desc' } }),
			this.prisma.smsCode.findFirst({
				where: {
					phone,
					purpose: { startsWith: 'changePhone:v2:' },
					createdAt: { gt: oneMinuteAgo },
				},
				orderBy: { id: 'desc' },
			}),
		]);
		if (recentForBinding || recentForPhone) throw new BadRequestException('发送太频繁，请稍后再试');

		const startOfDay = new Date(now);
		startOfDay.setHours(0, 0, 0, 0);
		const [countForBinding, countForPhone] = await Promise.all([
			this.prisma.smsCode.count({ where: { purpose, createdAt: { gte: startOfDay } } }),
			this.prisma.smsCode.count({
				where: {
					phone,
					purpose: { startsWith: 'changePhone:v2:' },
					createdAt: { gte: startOfDay },
				},
			}),
		]);
		if (countForBinding >= 10 || countForPhone >= 10) throw new BadRequestException('当日发送次数过多，请明日再试');

		const code = randomInt(100000, 1000000).toString();
		await this.sms.sendLoginCode(phone, code, 5);
		const expiresAt = new Date(now.getTime() + CHANGE_PHONE_CODE_TTL_MS);
		const storedCode = this.encodeChangePhoneCode(code);
		await this.prisma.$transaction([
			this.prisma.smsCode.updateMany({ where: { purpose, usedAt: null }, data: { usedAt: now } }),
			this.prisma.smsCode.create({ data: { phone, code: storedCode, purpose, expiresAt } }),
		]);
		return { ok: true };
	}

	// 短信验证码登录：自动注册、签发 token，并使验证码失效
	async loginMemberByCode(rawPhone: string, rawCode: string) {
		const phone = String(rawPhone || '').trim();
		const code = String(rawCode || '').trim();
		if (!/^1\d{10}$/.test(phone)) throw new BadRequestException('手机号格式不正确');
		if (!/^\d{6}$/.test(code)) throw new BadRequestException('验证码格式不正确');
		const now = new Date();
		const record = await this.prisma.smsCode.findFirst({ where: { phone, code, purpose: 'login', usedAt: null }, orderBy: { id: 'desc' } });
		if (!record) throw new UnauthorizedException('验证码错误');
		if (record.expiresAt < now) throw new UnauthorizedException('验证码已过期');
		// 标记为已使用
		await this.prisma.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
		// 查找/自动注册会员
		let member = await this.prisma.member.findUnique({ where: { phone }, include: { tags: true } });
		let createdNew = false;
		if (!member) {
			const uid = await this.generateUniqueMemberUid();
			const defaultLevel = await this.prisma.memberLevel.findFirst({ where: { isDefault: true } as any });
			if (!defaultLevel) throw new BadRequestException('系统未配置默认会员等级，请先在管理后台设置');
			// 头像策略：同上，默认头像不落库（保持 null）
			member = await this.prisma.member.create({ data: { uid, name: this.generateRandomName(), phone, levelId: defaultLevel.id, avatarUrl: null }, include: { tags: true } });
			createdNew = true;
		}
		if (!member) throw new BadRequestException('登录失败，请重试');
		// 新注册（短信验证码登录自动创建账号）：id=2 标签
		if (createdNew) {
			try {
				const has2 = (member.tags || []).some((t: any) => t.id === 2);
				if (!has2) {
					await this.prisma.member.update({ where: { id: member.id }, data: { tags: { connect: [{ id: 2 }] } } });
				}
			} catch {}
		}
		const token = await this.jwt.signAsync(
			{ sub: member.id, type: 'member', phone: member.phone },
			{ expiresIn: resolveMemberJwtExpiresInEnv() as any },
		);
		return { token, user: { id: member.id, name: member.name, role: 'member', phone: member.phone } };
	}

	// 重置会员密码（校验短信验证码 purpose: 'resetPwd'，设置新密码）
	async resetMemberPasswordByCode(rawPhone: string, rawCode: string, newPassword: string) {
		const phone = String(rawPhone || '').trim();
		const code = String(rawCode || '').trim();
		if (!/^1\d{10}$/.test(phone)) throw new BadRequestException('手机号格式不正确');
		if (!/^\d{6}$/.test(code)) throw new BadRequestException('验证码格式不正确');
		if (!newPassword || newPassword.length < 6) throw new BadRequestException('新密码至少6位');
		const now = new Date();
		const record = await this.prisma.smsCode.findFirst({ where: { phone, code, purpose: 'resetPwd', usedAt: null }, orderBy: { id: 'desc' } });
		if (!record) throw new UnauthorizedException('验证码错误');
		if (record.expiresAt < now) throw new UnauthorizedException('验证码已过期');
		// 标记验证码已使用
		await this.prisma.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
		// 查找会员并更新密码
		const member = await this.prisma.member.findUnique({ where: { phone } });
		if (!member) throw new UnauthorizedException('会员账号不存在');
		const hashed = await hashPassword(newPassword);
		await this.prisma.member.update({ where: { id: member.id }, data: { password: hashed } });
		return { ok: true };
	}

	private async verifyChangePhoneCode(memberId: number, stage: ChangePhoneStage, phone: string, rawCode: string) {
		const code = String(rawCode || '').trim();
		if (!/^\d{6}$/.test(code)) throw new BadRequestException('验证码格式不正确');
		const purpose = this.changePhonePurpose(memberId, stage);

		// attempts 编码在现有 SmsCode.code 字段中。通过 code 作为 CAS 条件，避免并发错误
		// 请求相互覆盖计数；若竞争失败则重新读取最新值继续判断。
		for (let retry = 0; retry <= CHANGE_PHONE_MAX_ATTEMPTS; retry++) {
			const record = await this.prisma.smsCode.findFirst({
				where: { phone, purpose, usedAt: null },
				orderBy: { id: 'desc' },
			});
			if (!record) throw new UnauthorizedException('验证码错误或已使用');

			const now = new Date();
			const stored = this.parseStoredChangePhoneCode(record.code);
			if (record.expiresAt <= now || !stored) {
				await this.prisma.smsCode.updateMany({
					where: { id: record.id, code: record.code, usedAt: null },
					data: { usedAt: now },
				});
				throw new UnauthorizedException(record.expiresAt <= now ? '验证码已过期' : '验证码错误或已失效');
			}
			if (stored.attempts >= CHANGE_PHONE_MAX_ATTEMPTS) {
				throw new UnauthorizedException('验证码已被验证或错误次数过多');
			}

			const matched = this.matchesStoredChangePhoneCode(stored, code);
			const attempts = matched ? CHANGE_PHONE_MAX_ATTEMPTS : stored.attempts + 1;
			const exhausted = !matched && attempts >= CHANGE_PHONE_MAX_ATTEMPTS;
			// 正确请求同样必须先赢得一次 CAS：将 attempts 置满并重新加盐，锁定该码，
			// 防止大量并发猜测都基于同一旧值完成比较后绕过尝试次数限制。
			const nextStoredCode = matched
				? this.encodeChangePhoneCode(code, attempts)
				: this.encodeStoredChangePhoneCode({ ...stored, attempts });
			const updated = await this.prisma.smsCode.updateMany({
				where: { id: record.id, code: record.code, usedAt: null, expiresAt: { gt: now } },
				data: {
					code: nextStoredCode,
					...(exhausted ? { usedAt: now } : {}),
				},
			});
			if (updated.count === 1) {
				if (matched) return { id: record.id, storedCode: nextStoredCode, purpose };
				throw new UnauthorizedException(exhausted ? '验证码错误次数过多，请重新获取' : '验证码错误');
			}
		}

		throw new UnauthorizedException('验证码错误或已使用');
	}

	// 会员身份来自 token；当前手机号与新手机号验证码分别绑定 member、手机号和阶段。
	async changeMemberPhoneByCode(memberId: number, rawNewPhone: string, rawOldPhoneCode: string, rawNewPhoneCode: string) {
		const newPhone = String(rawNewPhone || '').trim();
		if (!/^1\d{10}$/.test(newPhone)) throw new BadRequestException('手机号格式不正确');
		const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { id: true, phone: true } });
		if (!member) throw new UnauthorizedException('会员账号不存在');
		if (member.phone === newPhone) throw new BadRequestException('新旧手机号一致');

		const occupied = await this.prisma.member.findUnique({ where: { phone: newPhone }, select: { id: true } });
		if (occupied && occupied.id !== memberId) throw new BadRequestException('该手机号已被其他账号绑定');

		const oldVerification = await this.verifyChangePhoneCode(memberId, 'old', member.phone, rawOldPhoneCode);
		const newVerification = await this.verifyChangePhoneCode(memberId, 'new', newPhone, rawNewPhoneCode);

		try {
			await this.prisma.$transaction(async (tx) => {
				const current = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, phone: true } });
				if (!current || current.phone !== member.phone) throw new UnauthorizedException('会员手机号已变化，请重新验证');
				const conflict = await tx.member.findUnique({ where: { phone: newPhone }, select: { id: true } });
				if (conflict && conflict.id !== memberId) throw new BadRequestException('该手机号已被其他账号绑定');
				const now = new Date();

				const oldConsumed = await tx.smsCode.updateMany({
					where: { id: oldVerification.id, code: oldVerification.storedCode, usedAt: null, expiresAt: { gt: now } },
					data: { usedAt: now },
				});
				const newConsumed = await tx.smsCode.updateMany({
					where: { id: newVerification.id, code: newVerification.storedCode, usedAt: null, expiresAt: { gt: now } },
					data: { usedAt: now },
				});
				if (oldConsumed.count !== 1 || newConsumed.count !== 1) throw new UnauthorizedException('验证码已使用或已过期');

				await tx.member.update({ where: { id: memberId }, data: { phone: newPhone } });
				await tx.smsCode.updateMany({
					where: { purpose: { in: [oldVerification.purpose, newVerification.purpose] }, usedAt: null },
					data: { usedAt: now },
				});
			}, { timeout: 10_000 });
		} catch (error: unknown) {
			const errorCode = error && typeof error === 'object' && 'code' in error
				? String(error.code)
				: '';
			if (errorCode === 'P2002') throw new BadRequestException('该手机号已被其他账号绑定');
			throw error;
		}
		return { ok: true };
	}

	async updateAdminNickname(userId: number, name: string) {
		const updated = await this.prisma.user.update({ where: { id: userId }, data: { name } });
		return { id: updated.id, name: updated.name };
	}

	async updateAdminPassword(userId: number, oldPassword: string, newPassword: string) {
		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!user) throw new UnauthorizedException('账户不存在');
		if (!newPassword || String(newPassword).length < 6) throw new BadRequestException('新密码至少6位');
		const { ok } = await verifyPassword(oldPassword, user.password);
		if (!ok) throw new UnauthorizedException('旧密码不正确');
		const newHashed = await hashPassword(newPassword);
		await this.prisma.user.update({ where: { id: userId }, data: { password: newHashed } });
		return { ok: true };
	}

	// 新增：更新管理员头像
	async updateAdminAvatar(userId: number, avatarUrl: string | null) {
		const updated = await (this.prisma.user.update({ where: { id: userId }, data: ({ avatarUrl: avatarUrl ?? null } as any) }) as any);
		return { id: updated.id, avatarUrl: (updated as any).avatarUrl ?? null };
	}
}


