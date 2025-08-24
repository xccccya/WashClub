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
			// 禁止手动添加系统标签；仅允许非系统标签通过手动方式添加
			const inputTagIds = Array.isArray(data.tagIds) ? data.tagIds : [];
			const systemTags = await tx.memberTag.findMany({ where: { id: { in: inputTagIds }, isSystem: true }, select: { id: true } });
			if (systemTags.length > 0) {
				throw new BadRequestException('不可手动为用户添加系统默认标签');
			}
			// 后台手动创建会员，自动打上“后台手动注册账号”（id=1，若存在）
			const sysTag1 = await tx.memberTag.findUnique({ where: { id: 1 }, select: { id: true } });
			const autoTagIds = sysTag1 ? [1] : [];
			const connectTags = [...new Set([...autoTagIds, ...inputTagIds])].map((id) => ({ id }));
			return tx.member.create({ data: { name: nameTrim, phone: data.phone, password, uid, points: data.points, balance: data.balance as any, levelId: data.levelId, categoryId: data.categoryId, avatarUrl: data.avatarUrl || null, tags: { connect: connectTags } } });
		});
	}

	async update(id: number, data: { name?: string; phone?: string; password?: string; points?: number; balance?: number; levelId?: number | null; categoryId?: number | null; tagIds?: number[]; avatarUrl?: string | null }) {
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
			const desiredTagIds: number[] = Array.isArray(data.tagIds) ? data.tagIds : [];
			// 拦截系统标签：不允许手动传入系统标签
			const sys = await this.prisma.memberTag.findMany({ where: { id: { in: desiredTagIds }, isSystem: true }, select: { id: true } });
			if (sys.length > 0) throw new BadRequestException('不可手动为用户添加系统默认标签');
			// 保留当前系统标签，不被 set 覆盖
			const current = await this.prisma.member.findUnique({ where: { id }, include: { tags: true } });
			const currentSystemTagIds = (current?.tags || []).filter((t: any) => (t as any).isSystem).map((t) => t.id);
			const finalSetIds = Array.from(new Set([...currentSystemTagIds, ...desiredTagIds]));
			updateData.tags = { set: finalSetIds.map((tid) => ({ id: tid })) };
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

	async remove(id: number) {
		// 统一使用事务，确保相关资源清理
		return this.prisma.$transaction(async (tx) => {
			const m = await tx.member.findUnique({ where: { id } });
			if (!m) throw new BadRequestException('会员不存在');
			// 1) 清理该会员持有的洗车卡：先删共享与日志，再删卡
			await tx.washCardShare.deleteMany({ where: { card: { ownerMemberId: id } } });
			await tx.washCardLog.deleteMany({ where: { card: { ownerMemberId: id } } });
			await tx.washCard.deleteMany({ where: { ownerMemberId: id } });
			// 2) 清理该会员作为被共享者的记录
			await tx.washCardShare.deleteMany({ where: { memberId: id } });
			// 3) 清理涉及该会员的日志外键（置空），避免外键约束
			await tx.washCardLog.updateMany({ where: { memberId: id }, data: { memberId: null } });
			// 4) 解除会员与标签的关联（防御性处理）
			await tx.member.update({ where: { id }, data: { tags: { set: [] } } });
			// 5) 删除会员（其车辆通过 Vehicle.member 关系 onDelete: Cascade 自动删除）
			// 先处理该会员的车辆及其引用，再删会员，避免外键约束问题
			const vehicles = await tx.vehicle.findMany({ where: { memberId: id }, select: { id: true } });
			const vehicleIds = vehicles.map((v) => v.id);
			if (vehicleIds.length > 0) {
				await tx.washCardLog.updateMany({ where: { vehicleId: { in: vehicleIds } }, data: { vehicleId: null } });
				await tx.serviceQueueItem.updateMany({ where: { vehicleId: { in: vehicleIds } }, data: { vehicleId: null } });
				await tx.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
			}
			await tx.member.delete({ where: { id } });
			return { ok: true };
		});
	}
}


