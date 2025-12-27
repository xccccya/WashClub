import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { AssetService } from '../file/asset.service.js';
import { resolveGuestMemberIdEnv } from '../env.js';

@Injectable()
export class MemberService {
	private syncBindings!: (tableName: string, rowId: string, fieldName: string, urls: string[]) => Promise<void>;
	constructor(private prisma: PrismaService, private jwt: JwtService, private assets?: AssetService) {}

	async list(page = 1, pageSize = 20, keyword?: string) {
		const where = keyword
			? { OR: [{ name: { contains: keyword } }, { phone: { contains: keyword } }] }
			: undefined;
		const [itemsRaw, total] = await Promise.all([
			this.prisma.member.findMany({
				skip: (page - 1) * pageSize,
				take: pageSize,
				where,
				orderBy: [{ level: { level: 'desc' } } as any, { id: 'desc' }],
				include: { vehicles: true, level: true, category: true, tags: true },
			}),
			this.prisma.member.count({ where }),
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
			// 额外的有效期限制：即使 JWT 未带 exp，也根据 iat 强制 7 天过期（可通过 env 覆盖）
			const iatSec: number | undefined = typeof decoded?.iat === 'number' ? decoded.iat : undefined;
			const maxAgeMs = process.env.MEMBER_TOKEN_MAXAGE_MS ? Number(process.env.MEMBER_TOKEN_MAXAGE_MS) : 7 * 24 * 60 * 60 * 1000;
			if (iatSec && maxAgeMs > 0) {
				const issuedAtMs = iatSec * 1000;
				if (Date.now() - issuedAtMs > maxAgeMs) throw new UnauthorizedException('Token已过期');
			}
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
			// 从站点设置读取默认头像（用于创建时未提供头像或显式为 null 时）
			const siteSetting = await tx.siteSetting.findFirst().catch(() => null);
			const defaultAvatarFromSetting = siteSetting?.defaultMemberAvatarUrl || null;
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
			// 创建时：若未提供或显式为 null/空串，则使用站点默认头像
			const provided = typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() : (data.avatarUrl ?? undefined);
			const finalAvatar = provided ? String(provided) : defaultAvatarFromSetting;
			const created = await tx.member.create({ data: { name: nameTrim, phone: data.phone, password, uid, points: data.points, balance: data.balance as any, levelId: data.levelId, categoryId: data.categoryId, avatarUrl: finalAvatar ?? null, tags: { connect: connectTags } } });
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

	setPassword(id: number, password: string) {
		const hashed = crypto.createHash('sha256').update(password).digest('hex');
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

