import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MemberService {
	constructor(private prisma: PrismaService, private jwt: JwtService) {}

	async list(page = 1, pageSize = 20, keyword?: string) {
		const where = keyword
			? { OR: [{ name: { contains: keyword } }, { phone: { contains: keyword } }] }
			: undefined;
		const [itemsRaw, total] = await Promise.all([
			this.prisma.member.findMany({
				skip: (page - 1) * pageSize,
				take: pageSize,
				where,
				orderBy: { id: 'desc' },
				include: { vehicles: true, level: true, category: true, tags: true },
			}),
			this.prisma.member.count({ where }),
		]);
		const items = itemsRaw.map((m) => ({
			...m,
			balance: Number(m.balance),
		}));
		return { items, total, page, pageSize };
	}

	findById(id: number) {
		return this.prisma.member.findUnique({ where: { id }, include: { level: true, category: true, vehicles: true, tags: true } });
	}

	async getProfileByToken(token?: string) {
		if (!token) throw new UnauthorizedException('缺少Token');
		try {
			const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
			const id = Number(decoded?.sub);
			if (!id || decoded?.type !== 'member') throw new UnauthorizedException('Token无效');
			// 额外的有效期限制：即使 JWT 未带 exp，也根据 iat 强制 7 天过期（可通过 env 覆盖）
			const iatSec: number | undefined = typeof decoded?.iat === 'number' ? decoded.iat : undefined;
			const maxAgeMs = process.env.MEMBER_TOKEN_MAXAGE_MS ? Number(process.env.MEMBER_TOKEN_MAXAGE_MS) : 7 * 24 * 60 * 60 * 1000;
			if (iatSec && maxAgeMs > 0) {
				const issuedAtMs = iatSec * 1000;
				if (Date.now() - issuedAtMs > maxAgeMs) throw new UnauthorizedException('Token已过期');
			}
			const member = await this.findById(id);
			if (!member) throw new UnauthorizedException('Token无效');
			return member;
		} catch {
			throw new UnauthorizedException('Token无效');
		}
	}

	create(data: { name: string; phone: string; password?: string; points?: number; balance?: number; levelId?: number; categoryId?: number; tagIds?: number[]; avatarUrl?: string | null }) {
		// 防守式校验：昵称非空且≤10字符
		const nameTrim = String(data?.name || '').trim();
		if (!nameTrim) throw new BadRequestException('昵称不能为空');
		if (Array.from(nameTrim).length > 10) throw new BadRequestException('昵称长度不可超过10个字符');
		return this.prisma.$transaction(async (tx) => {
			let uid: number;
			// 生成唯一8位数字UID
			while (true) {
				uid = Math.floor(10000000 + Math.random() * 90000000);
				const exists = await tx.member.findUnique({ where: { uid } }).catch(() => null);
				if (!exists) break;
			}
			const password = data.password ? crypto.createHash('sha256').update(data.password).digest('hex') : undefined;
			const tagsConnect = (data.tagIds || []).map((id) => ({ id }));
			return tx.member.create({ data: { name: nameTrim, phone: data.phone, password, uid, points: data.points, balance: data.balance as any, levelId: data.levelId, categoryId: data.categoryId, avatarUrl: data.avatarUrl || null, tags: { connect: tagsConnect } } });
		});
	}

	update(id: number, data: { name?: string; phone?: string; password?: string; points?: number; balance?: number; levelId?: number | null; categoryId?: number | null; tagIds?: number[]; avatarUrl?: string | null }) {
		const updateData = { ...data } as any;
		// 防守式校验：若传入 name 则校验与规范化
		if (Object.prototype.hasOwnProperty.call(data, 'name')) {
			const nameTrim = String(data?.name ?? '').trim();
			if (!nameTrim) throw new BadRequestException('昵称不能为空');
			if (Array.from(nameTrim).length > 10) throw new BadRequestException('昵称长度不可超过10个字符');
			updateData.name = nameTrim;
		}
		if (data.password) updateData.password = crypto.createHash('sha256').update(data.password).digest('hex');
		if (data.tagIds) {
			updateData.tags = { set: [], connect: data.tagIds.map((id) => ({ id })) };
			delete updateData.tagIds;
		}
		return this.prisma.member.update({ where: { id }, data: updateData });
	}

	async setActiveByToken(token?: string) {
		if (!token) throw new UnauthorizedException('缺少Token');
		try {
			const decoded: any = await this.jwt.verifyAsync(token);
			const id = Number(decoded?.sub);
			if (!id) throw new UnauthorizedException('Token无效');
			await this.prisma.member.update({ where: { id }, data: { lastActiveAt: new Date() } });
			return { ok: true };
		} catch {
			throw new UnauthorizedException('Token无效');
		}
	}

	setPassword(id: number, password: string) {
		const hashed = crypto.createHash('sha256').update(password).digest('hex');
		return this.prisma.member.update({ where: { id }, data: { password: hashed } });
	}

	remove(id: number) {
		return this.prisma.member.delete({ where: { id } });
	}
}


