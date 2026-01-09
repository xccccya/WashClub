import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { AssetService } from '../file/asset.service.js';
import { resolveGuestMemberIdEnv } from '../env.js';
import { hashPassword } from '../auth/password.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class MemberService {
	private syncBindings!: (tableName: string, rowId: string, fieldName: string, urls: string[]) => Promise<void>;
	constructor(private prisma: PrismaService, private jwt: JwtService, private assets?: AssetService) {}

	private parseDateParam(s?: string): Date | null {
		const raw = String(s || '').trim();
		if (!raw) return null;
		// YYYY-MM-DD：按本地 00:00:00
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
		if (m) {
			const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
			const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
			return isNaN(dt.getTime()) ? null : dt;
		}
		// ISO 或其它 Date 可解析格式
		const dt = new Date(raw);
		return isNaN(dt.getTime()) ? null : dt;
	}

	async list(query: {
		page?: number;
		pageSize?: number;
		keyword?: string;
		levelId?: number;
		categoryId?: number;
		tagId?: number;
		createdFrom?: string;
		createdTo?: string;
		activeFrom?: string;
		activeTo?: string;
		excludePlaceholders?: boolean;
		sortBy?: string;
		sortOrder?: string;
	} = {}) {
		const page = Number(query?.page || 1);
		const pageSize = Number(query?.pageSize || 20);
		const keywordRaw = String(query?.keyword || '').trim();
		const levelId = Number(query?.levelId || 0) || undefined;
		const categoryId = Number(query?.categoryId || 0) || undefined;
		const tagId = Number(query?.tagId || 0) || undefined;
		const createdFrom = this.parseDateParam(query?.createdFrom);
		const createdTo = this.parseDateParam(query?.createdTo);
		const activeFrom = this.parseDateParam(query?.activeFrom);
		const activeTo = this.parseDateParam(query?.activeTo);
		const excludePlaceholders = !!query?.excludePlaceholders;

		const where: any = {};
		if (keywordRaw) {
			// 关键词：支持姓名/手机号模糊；纯数字时额外支持 ID/UID 精确匹配
			const ors: any[] = [{ name: { contains: keywordRaw } }, { phone: { contains: keywordRaw } }];
			if (/^\d+$/.test(keywordRaw)) {
				const n = Number(keywordRaw);
				if (Number.isFinite(n)) ors.push({ id: n }, { uid: n });
			}
			where.OR = ors;
		}
		if (levelId) where.levelId = levelId;
		if (categoryId) where.categoryId = categoryId;
		if (tagId) where.tags = { some: { id: tagId } };
		if (createdFrom || createdTo) {
			where.createdAt = {};
			if (createdFrom) where.createdAt.gte = createdFrom;
			// createdTo 语义：< createdTo（与 metrics 口径对齐，便于前端传 endAt）
			if (createdTo) where.createdAt.lt = createdTo;
		}
		if (activeFrom || activeTo) {
			where.lastActiveAt = {};
			if (activeFrom) where.lastActiveAt.gte = activeFrom;
			if (activeTo) where.lastActiveAt.lt = activeTo;
		}
		if (excludePlaceholders) {
			// 排除系统占位账号（游客/集团订单占位）：通过系统标签名过滤
			where.tags = where.tags || {};
			where.tags.none = { name: { in: ['GUEST_ORDER_OWNER', 'GROUP_ORDER_OWNER'] } };
		}
		const whereFinal = Object.keys(where).length ? where : undefined;

		// 排序：
		// - 基础字段：成长值/累计支付/积分/余额/注册时间/活跃时间（正序/倒序）
		// - 派生字段：累计洗车次数/到店时间（正序/倒序，后端聚合计算以保证分页一致）
		const sortBy = String(query?.sortBy || '').trim();
		const sortOrder = String(query?.sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
		const derivedSort = sortBy === 'totalWashCount' || sortBy === 'lastVisitAt';

		// 1) 派生排序：用 SQL 聚合算出排序字段，先取当前页的 memberId，再批量查 member 详情
		//    目的：保证“排序 + 分页”一致，避免前端/后端二次排序导致错页。
		if (derivedSort) {
			const skip = (page - 1) * pageSize;
			const take = pageSize;

			// 派生字段聚合：
			// - lastVisitAt：最新 SERVICE 订单 createdAt（不要求已完成，口径与 miniapp 详情页一致）
			// - totalWashCount：已支付且完成的 SERVICE 订单累计洗车次数（按商品 isCarWash 汇总；若某服务订单无可计次商品，则按 1 次计）
			const visitAgg = Prisma.sql`
				SELECT o.memberId AS memberId, MAX(o.createdAt) AS lastVisitAt
				FROM \`Order\` o
				WHERE o.type = 'SERVICE' AND o.deletedAt IS NULL
				GROUP BY o.memberId
			`;
			const washCountAgg = Prisma.sql`
				SELECT x.memberId AS memberId,
					   SUM(CASE WHEN x.washTimes > 0 THEN x.washTimes ELSE 1 END) AS totalWashCount
				FROM (
					SELECT o.id AS orderId, o.memberId AS memberId,
						   SUM(CASE WHEN p.isCarWash = true THEN oi.quantity ELSE 0 END) AS washTimes
					FROM \`Order\` o
					LEFT JOIN \`OrderItem\` oi ON oi.orderId = o.id
					LEFT JOIN \`Product\` p ON p.id = oi.productId
					WHERE o.type = 'SERVICE'
					  AND o.deletedAt IS NULL
					  AND o.payStatus = 'PAID'
					  AND (o.status IN ('CLOSED', 'FULFILLED') OR o.fulfillmentStatus = 'DONE')
					GROUP BY o.id, o.memberId
				) x
				GROUP BY x.memberId
			`;

			const sortField = sortBy === 'lastVisitAt' ? 'lastVisitAt' : 'totalWashCount';
			const sortFieldSql = Prisma.raw(sortField);
			const sortDirSql = Prisma.raw(sortOrder === 'asc' ? 'ASC' : 'DESC');

			// WHERE 子句：与 Prisma whereFinal 尽量保持一致（用于派生排序场景）
			const like = keywordRaw ? `%${keywordRaw}%` : '';
			const numeric = keywordRaw && /^\d+$/.test(keywordRaw) ? Number(keywordRaw) : null;

			const whereSqlParts: Prisma.Sql[] = [Prisma.sql`1=1`];
			if (keywordRaw) {
				// 关键词：姓名/手机号 contains；纯数字时支持 id/uid 精确匹配
				if (numeric && Number.isFinite(numeric)) {
					whereSqlParts.push(Prisma.sql`AND (m.name LIKE ${like} OR m.phone LIKE ${like} OR m.id = ${numeric} OR m.uid = ${numeric})`);
				} else {
					whereSqlParts.push(Prisma.sql`AND (m.name LIKE ${like} OR m.phone LIKE ${like})`);
				}
			}
			if (levelId) whereSqlParts.push(Prisma.sql`AND m.levelId = ${levelId}`);
			if (categoryId) whereSqlParts.push(Prisma.sql`AND m.categoryId = ${categoryId}`);
			if (tagId) {
				whereSqlParts.push(
					Prisma.sql`AND EXISTS (SELECT 1 FROM \`_MemberToMemberTag\` mt WHERE mt.A = m.id AND mt.B = ${tagId})`,
				);
			}
			if (createdFrom) whereSqlParts.push(Prisma.sql`AND m.createdAt >= ${createdFrom}`);
			if (createdTo) whereSqlParts.push(Prisma.sql`AND m.createdAt < ${createdTo}`);
			if (activeFrom) whereSqlParts.push(Prisma.sql`AND m.lastActiveAt >= ${activeFrom}`);
			if (activeTo) whereSqlParts.push(Prisma.sql`AND m.lastActiveAt < ${activeTo}`);
			if (excludePlaceholders) {
				whereSqlParts.push(
					Prisma.sql`AND NOT EXISTS (
						SELECT 1
						FROM \`_MemberToMemberTag\` mt
						INNER JOIN \`MemberTag\` t ON t.id = mt.B
						WHERE mt.A = m.id AND t.name IN ('GUEST_ORDER_OWNER', 'GROUP_ORDER_OWNER')
					)`,
				);
			}
			const whereSql = Prisma.join(whereSqlParts, ' ');

			type SortRow = { id: number; lastVisitAt: Date | null; totalWashCount: any };
			const sortRows = await this.prisma.$queryRaw<SortRow[]>(
				Prisma.sql`
					SELECT x.id, x.lastVisitAt, x.totalWashCount
					FROM (
						SELECT m.id AS id,
							   v.lastVisitAt AS lastVisitAt,
							   COALESCE(wc.totalWashCount, 0) AS totalWashCount
						FROM \`Member\` m
						LEFT JOIN (${visitAgg}) v ON v.memberId = m.id
						LEFT JOIN (${washCountAgg}) wc ON wc.memberId = m.id
						WHERE ${whereSql}
					) x
					ORDER BY (x.${sortFieldSql} IS NULL) ASC, x.${sortFieldSql} ${sortDirSql}, x.id DESC
					LIMIT ${take} OFFSET ${skip}
				`,
			);

			const ids = (Array.isArray(sortRows) ? sortRows : []).map((r) => Number(r?.id || 0)).filter((id) => Number.isFinite(id) && id > 0);
			const [itemsRaw, total] = await Promise.all([
				ids.length
					? this.prisma.member.findMany({
							where: { id: { in: ids } },
							include: { vehicles: true, level: true, category: true, tags: true },
						})
					: Promise.resolve([] as any[]),
				this.prisma.member.count({ where: whereFinal }),
			]);

			const byId = new Map<number, any>();
			for (const m of itemsRaw) byId.set(Number(m?.id || 0), m);
			const extraById = new Map<number, SortRow>();
			for (const r of sortRows || []) extraById.set(Number(r?.id || 0), r);

			const items = ids
				.map((id) => {
					const m = byId.get(id);
					if (!m) return null;
					const extra = extraById.get(id);
					const lastVisitAtIso = extra?.lastVisitAt ? new Date(extra.lastVisitAt).toISOString() : null;
					const totalWashCountNum = Number(extra?.totalWashCount || 0) || 0;
					return {
						...m,
						balance: Number(m.balance),
						totalPaidAmount: Number((m as any).totalPaidAmount || 0),
						growthPoints: Number((m as any).growthPoints || 0),
						lastVisitAt: lastVisitAtIso,
						totalWashCount: totalWashCountNum,
					};
				})
				.filter(Boolean);

			return { items, total, page, pageSize };
		}

		// 2) 普通字段排序：走 Prisma orderBy
		const orderBy: any[] = [];
		const allowed = new Set(['growthPoints', 'totalPaidAmount', 'points', 'balance', 'createdAt', 'lastActiveAt']);
		if (sortBy && allowed.has(sortBy)) {
			orderBy.push({ [sortBy]: sortOrder });
			orderBy.push({ id: 'desc' });
		} else {
			orderBy.push({ level: { level: 'desc' } } as any, { id: 'desc' });
		}
		const [itemsRaw, total] = await Promise.all([
			this.prisma.member.findMany({
				skip: (page - 1) * pageSize,
				take: pageSize,
				where: whereFinal,
				orderBy,
				include: { vehicles: true, level: true, category: true, tags: true },
			}),
			this.prisma.member.count({ where: whereFinal }),
		]);
		const items = itemsRaw.map((m) => ({
			...m,
			balance: Number(m.balance),
			totalPaidAmount: Number((m as any).totalPaidAmount || 0),
			growthPoints: Number((m as any).growthPoints || 0),
		}));
		return { items, total, page, pageSize };
	}

	// 同步游客订单占位账号：根据 GUEST_MEMBER_ID，将系统标签 GUEST_ORDER_OWNER 切换到该会员
	async syncGuestOrderOwnerByEnv() {
		const gid = resolveGuestMemberIdEnv();
		if (!gid) throw new BadRequestException('未配置 GUEST_MEMBER_ID');
		return this.prisma.$transaction(async (tx) => {
			const m = await tx.member.findUnique({ where: { id: gid }, select: { id: true } });
			if (!m) throw new BadRequestException('GUEST_MEMBER_ID 指向的会员不存在');
			// 确保系统标签存在
			let tag = await (tx as any).memberTag.findFirst({ where: { name: 'GUEST_ORDER_OWNER' }, select: { id: true } });
			if (!tag) { tag = await (tx as any).memberTag.create({ data: { name: 'GUEST_ORDER_OWNER', isSystem: true } }); }
			// 移除所有会员上的该系统标签
			const taggedMembers: any[] = await (tx as any).member.findMany({ where: { tags: { some: { name: 'GUEST_ORDER_OWNER' } } }, select: { id: true } });
			for (const row of taggedMembers) {
				await (tx as any).member.update({ where: { id: row.id }, data: { tags: { disconnect: [{ id: tag.id }] } } });
			}
			// 将标签连接到目标会员
			await (tx as any).member.update({ where: { id: gid }, data: { tags: { connect: [{ id: tag.id }] } } });
			return { ok: true, guestMemberId: gid } as const;
		});
	}

	// 查询当前游客占位账号（从环境变量读取 ID，并返回是否已贴上系统标签）
	async getGuestOrderOwnerByEnv() {
		const gid = resolveGuestMemberIdEnv();
		if (!gid) return { guestMemberId: null, tagged: false } as const;
		const m: any = await this.prisma.member.findUnique({ where: { id: gid }, include: { tags: true } });
		if (!m) return { guestMemberId: gid, exists: false, tagged: false } as const;
		const tagged = (m?.tags || []).some((t: any) => String(t?.name || '').toUpperCase() === 'GUEST_ORDER_OWNER');
		return { guestMemberId: gid, exists: true, tagged } as const;
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
			const member: any = await this.findById(id);
			// 附加集团绑定信息（用于小程序“集团客户”入口判断）
			try {
				const gm: any = await (this.prisma as any).groupMember.findUnique({ where: { memberId: id }, include: { group: { select: { id: true, name: true, iconUrl: true, code: true } } } });
				if (gm) {
					member.groupId = gm.groupId;
					member.groupRole = gm.role;
					member.group = gm.group ? { id: gm.group.id, name: gm.group.name, iconUrl: gm.group.iconUrl, code: gm.group.code } : null;
				} else {
					member.groupId = null;
					member.groupRole = null;
					member.group = null;
				}
			} catch {}
			if (!member) throw new UnauthorizedException('Token无效');
			// 补充：是否最大等级与下一等级的成长值要求
			try {
				const growth = Number(member?.growthPoints || 0);
				const levels: any[] = await this.prisma.memberLevel.findMany({ orderBy: { /* @ts-ignore */ level: 'asc' } as any });
				let currentRequired = 0;
				let nextRequired: number | null = null;
				for (const lv of levels) {
					const req = Number(lv.requiredGrowth || 0);
					if (req <= growth) currentRequired = Math.max(currentRequired, req);
					if (nextRequired == null && req > growth) nextRequired = req;
				}
				const isMaxLevel = nextRequired == null;
				return { ...member, isMaxLevel, nextRequiredGrowth: nextRequired, currentRequiredGrowth: currentRequired };
			} catch {
				return member;
			}
		} catch {
			throw new UnauthorizedException('Token无效');
		}
	}

	// 小程序：积分统计（当前积分/本月使用/本月获得）
	async getPointsStatsByToken(token?: string){
		if (!token) throw new UnauthorizedException('缺少Token');
		let id: number | undefined;
		try{
			const decoded:any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
			if (decoded?.type !== 'member') throw 0;
			id = Number(decoded?.sub);
		}catch{ throw new UnauthorizedException('Token无效'); }
		if (!id) throw new UnauthorizedException('Token无效');
		// 当前积分
		const m = await this.prisma.member.findUnique({ where: { id }, select: { points: true } });
		const currentPoints = Math.max(0, Number(m?.points || 0));
		// 本月范围
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
		const end = new Date(now.getFullYear(), now.getMonth()+1, 1, 0, 0, 0, 0);
		// 本月使用：仅统计下单抵扣（USE）的负数，并扣除本月“退款返还”的正向REFUND（如取消订单返还的积分），避免把已退回的也计入“使用”
		// 本月获得：统计正向（PAY/ADMIN）并扣除当月退款扣减（REFUND<0），避免把已被扣回的积分计入“获得”
		const logs:any[] = await (this.prisma as any).memberPointsLog.findMany({ where: { memberId: id, createdAt: { gte: start, lt: end } }, select: { change:true, source:true } });
		let monthUsed = 0, monthGained = 0, refundReturnedPos = 0;
		for (const r of logs){
			const ch = Number(r?.change||0);
			const src = String(r?.source||'');
			if (src === 'USE' && ch < 0) monthUsed += Math.abs(ch);
			if (src === 'REFUND' && ch > 0) refundReturnedPos += ch; // 退款返还（含取消返还）
			if ((src === 'PAY' || src === 'ADMIN') && ch > 0) monthGained += ch;
			if (src === 'REFUND' && ch < 0) monthGained += ch; // 负数：从本月获得中扣除
		}
		// 从“本月使用”中扣除已返还积分
		monthUsed = Math.max(0, monthUsed - refundReturnedPos);
		if (monthGained < 0) monthGained = 0;
		return { currentPoints, monthUsed, monthGained } as any;
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
			const password = data.password ? await hashPassword(data.password) : undefined;
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
			// 头像策略：
			// - 前端/调用方传 avatarUrl=string(非空) => 视为“自定义头像”，落库
			// - 其它（undefined / null / 空串） => 视为“使用默认头像”，不写入默认头像 URL（落库为 null）
			// 这样后台更换 defaultMemberAvatarUrl 时，“未修改过头像”的用户会自动同步。
			const provided = typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() : (data.avatarUrl ?? undefined);
			const finalAvatar = provided ? String(provided) : null;
			const created = await tx.member.create({ data: { name: nameTrim, phone: data.phone, password, uid, points: data.points, balance: data.balance as any, levelId: data.levelId, categoryId: data.categoryId, avatarUrl: finalAvatar, tags: { connect: connectTags } } });
			try { await this.syncBindings('Member', String(created.id), 'avatarUrl', created.avatarUrl ? [created.avatarUrl] : []); } catch {}
			return created;
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
		if (data.password) updateData.password = await hashPassword(data.password);
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
		const updated = await this.prisma.member.update({ where: { id }, data: updateData });
		try { await this.syncBindings('Member', String(updated.id), 'avatarUrl', updated.avatarUrl ? [updated.avatarUrl] : []); } catch {}
		return updated;
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

	async setPassword(id: number, password: string) {
		const hashed = await hashPassword(password);
		return this.prisma.member.update({ where: { id }, data: { password: hashed } });
	}

	// 成长值日志（持久化）：直接读取 MemberGrowthLog
	async getGrowthLogsByToken(token?: string, limit?: number){
		if (!token) throw new UnauthorizedException('缺少Token');
		let id: number | undefined;
		try {
			const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
			if (decoded?.type !== 'member') throw 0;
			id = Number(decoded?.sub);
		} catch {
			throw new UnauthorizedException('Token无效');
		}
		if (!id) throw new UnauthorizedException('Token无效');
		const max = Math.max(1, Math.min(200, Number(limit || 50)));
		const rows: any[] = await (this.prisma as any).memberGrowthLog.findMany({ where: { memberId: id }, orderBy: { createdAt: 'desc' }, take: max, include: { order: { select: { id: true, no: true } } } });
		return (Array.isArray(rows) ? rows : []).map((r:any)=> ({ createdAt: r.createdAt, desc: r.desc || mapGrowthSourceToDesc(r.source, r?.order?.no), change: Number(r.change||0), source: r.source, orderId: r?.order?.id || null, orderNo: r?.order?.no || null }));
	}

	// 积分日志（持久化）：读取 MemberPointsLog（仅当前会员）
	async getPointsLogsByToken(token?: string, limit?: number){
		if (!token) throw new UnauthorizedException('缺少Token');
		let id: number | undefined;
		try{
			const decoded:any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
			if (decoded?.type !== 'member') throw 0;
			id = Number(decoded?.sub);
		}catch{ throw new UnauthorizedException('Token无效'); }
		if (!id) throw new UnauthorizedException('Token无效');
		const max = Math.max(1, Math.min(200, Number(limit || 50)));
		const rows:any[] = await (this.prisma as any).memberPointsLog.findMany({ where: { memberId: id }, orderBy: { createdAt: 'desc' }, take: max, include: { order: { select: { id:true, no:true } } } });
		return (Array.isArray(rows) ? rows : []).map((r:any)=> ({ createdAt: r.createdAt, desc: r.desc || mapPointsSourceToDesc(r.source, r?.order?.no), change: Number(r.change||0), source: r.source, orderId: r?.order?.id || null, orderNo: r?.order?.no || null }));
	}

	async getGrowthLogsByMemberId(memberId: number, limit?: number){
		const id = Number(memberId); if (!id) throw new BadRequestException('memberId无效');
		const max = Math.max(1, Math.min(200, Number(limit || 50)));
		const rows: any[] = await (this.prisma as any).memberGrowthLog.findMany({ where: { memberId: id }, orderBy: { createdAt: 'desc' }, take: max, include: { order: { select: { id: true, no: true } } } });
		return (Array.isArray(rows) ? rows : []).map((r:any)=> ({ createdAt: r.createdAt, desc: r.desc || mapGrowthSourceToDesc(r.source, r?.order?.no), change: Number(r.change||0), source: r.source, orderId: r?.order?.id || null, orderNo: r?.order?.no || null }));
	}

	// 管理后台：手动调整成长值（正负均可），记录备注与操作人，并根据成长值重算等级
	async adjustGrowthByAdmin(memberId: number, delta: number, remark?: string | null, operatorUserId?: number | null){
		const id = Number(memberId); if (!id) throw new BadRequestException('memberId无效');
		const change = Math.trunc(Number(delta||0));
		if (!Number.isFinite(change) || change === 0) throw new BadRequestException('变更值必须为非零整数');
		return this.prisma.$transaction(async (tx)=>{
			const m = await tx.member.findUnique({ where: { id }, select: { id: true, /* @ts-ignore */ growthPoints: true, levelId: true } as any });
			if (!m) throw new BadRequestException('会员不存在');
			// 扣减时不得使成长值为负
			const before = Number((m as any).growthPoints||0);
			const next = before + change;
			if (next < 0) throw new BadRequestException('扣减后成长值不可小于0');
			await tx.member.update({ where: { id }, data: { growthPoints: { increment: change } } as any });
			await (tx as any).memberGrowthLog.create({ data: { memberId: id, change, source: 'ADMIN', desc: remark || '后台调整', operatorUserId: operatorUserId ?? null } });
			// 重新匹配等级
			try{
				const nowRow:any = await tx.member.findUnique({ where: { id }, select: { id: true, /* @ts-ignore */ growthPoints: true, levelId: true } as any });
				const levels:any[] = await tx.memberLevel.findMany({ orderBy: { /* @ts-ignore */ level: 'desc' } as any });
				const target = levels.find(l => Number(nowRow?.growthPoints ?? 0) >= Number((l as any)?.requiredGrowth ?? 0));
				const nextLevelId = target ? target.id : null;
				if ((nowRow?.levelId || null) !== nextLevelId){ await tx.member.update({ where: { id }, data: { levelId: nextLevelId } }); }
			}catch{}
			return { ok: true } as any;
		});
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



// ========== 文件绑定辅助 ==========
function mapGrowthSourceToDesc(src?: string, orderNo?: string|null){
    const s = String(src||'').toUpperCase();
    if (s === 'SIGN') return '签到';
    if (s === 'PAY') return orderNo ? `支付订单 ${orderNo}` : '支付订单';
    if (s === 'ADMIN') return '后台调整';
    if (s === 'REFUND') return orderNo ? `退款扣减 ${orderNo}` : '退款扣减';
    return '成长值变动';
}
function mapPointsSourceToDesc(src?: string, orderNo?: string|null){
    const s = String(src||'').toUpperCase();
    if (s === 'PAY') return orderNo ? `支付订单 ${orderNo}` : '支付订单';
    if (s === 'USE') return orderNo ? `订单抵扣 ${orderNo}` : '订单抵扣';
    if (s === 'ADMIN') return '后台调整';
    if (s === 'REFUND') return orderNo ? `退款积分调整 ${orderNo}` : '退款积分调整';
    return '积分变动';
}
async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]>{
    const set = new Set<string>();
    for (const u of urls){ if(!u) continue; const s=String(u).trim(); if(!s) continue; set.add(s); try{ if(/^https?:\/\//i.test(s)){ const rel=new URL(s).pathname; if(rel) set.add(rel); } }catch{} }
    const arr = Array.from(set); if(!arr.length) return [];
    const rows = await (prisma as any).fileAsset.findMany({ where: { url: { in: arr } }, select: { id: true } });
    return Array.isArray(rows) ? rows.map((r:any)=>String(r.id)) : [];
}

MemberService.prototype['syncBindings'] = async function(this: MemberService, tableName: string, rowId: string, fieldName: string, urls: string[]){
    try{
        const desired = new Set<string>(await getAssetIdsFromUrls(this['prisma'], urls));
        const existing:any[] = await (this['prisma'] as any).fileBinding.findMany({ where: { tableName, rowId: String(rowId), fieldName } });
        for (const b of existing){ if(!desired.has(String(b.fileId))) { try{ await this['assets']?.unbindReference(String(b.fileId), String(b.id)); }catch{} } }
        for (const fid of desired){ const ok = existing.find((b:any)=> String(b.fileId)===fid); if(!ok){ try{ await this['assets']?.bindReference(String(fid), { tableName, rowId: String(rowId), fieldName }); }catch{} } }
    }catch{}
};

