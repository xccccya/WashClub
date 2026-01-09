import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { SmsService } from './sms.service.js';
import { WechatTokenService } from './wechat-token.service.js';
import { hashPassword, verifyPassword } from './password.js';

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
			{ expiresIn: '7d' },
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
		const expiresIn = '1d';
		const token = await this.jwt.signAsync({ sub: user.id, type: 'admin', role: user.role, roleId: user.roleId, phone: user.phone }, { expiresIn });
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
			{ expiresIn: '7d' },
		);
		return { token, user: { id: member.id, name: member.name, role: 'member', phone: member.phone } };
	}

	// 发送短信验证码（5分钟有效，含频控：60秒内同一手机号不重复发送；每日最多10条）
	async sendLoginCode(rawPhone: string, rawPurpose?: string) {
		const phone = String(rawPhone || '').trim();
		if (!/^1\d{10}$/.test(phone)) throw new BadRequestException('手机号格式不正确');
		const purpose = rawPurpose === 'resetPwd' ? 'resetPwd' : (rawPurpose === 'changePhone' ? 'changePhone' : 'login');
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
		const code = Math.floor(100000 + Math.random() * 900000).toString();
		// 发送短信
		await this.sms.sendLoginCode(phone, code, 5);
		// 存库
		await this.prisma.smsCode.create({ data: { phone, code, purpose, expiresAt: fiveMinLater } });
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
		const token = await this.jwt.signAsync({ sub: member.id, type: 'member', phone: member.phone }, { expiresIn: '7d' });
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

	// 更换会员手机号（校验 purpose: 'changePhone' 验证码），若通过则更新会员手机号
	async changeMemberPhoneByCode(rawOldPhone: string, rawNewPhone: string, rawCode: string) {
		const oldPhone = String(rawOldPhone || '').trim();
		const newPhone = String(rawNewPhone || '').trim();
		const code = String(rawCode || '').trim();
		if (!/^1\d{10}$/.test(oldPhone) || !/^1\d{10}$/.test(newPhone)) throw new BadRequestException('手机号格式不正确');
		if (oldPhone === newPhone) throw new BadRequestException('新旧手机号一致');
		if (!/^\d{6}$/.test(code)) throw new BadRequestException('验证码格式不正确');
		// 校验验证码（下发给新手机号）
		const now = new Date();
		const record = await this.prisma.smsCode.findFirst({ where: { phone: newPhone, code, purpose: 'changePhone', usedAt: null }, orderBy: { id: 'desc' } });
		if (!record) throw new UnauthorizedException('验证码错误');
		if (record.expiresAt < now) throw new UnauthorizedException('验证码已过期');
		// 查找旧手机号会员
		const member = await this.prisma.member.findUnique({ where: { phone: oldPhone } });
		if (!member) throw new UnauthorizedException('会员账号不存在');
		// 检查新手机号是否被占用
		const exists = await this.prisma.member.findUnique({ where: { phone: newPhone } }).catch(()=>null);
		if (exists) throw new BadRequestException('该手机号已被其他账号绑定');
		// 更新手机号，并使验证码失效
		await this.prisma.$transaction([
			this.prisma.member.update({ where: { id: member.id }, data: { phone: newPhone } }),
			this.prisma.smsCode.update({ where: { id: record.id }, data: { usedAt: new Date() } })
		]);
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


