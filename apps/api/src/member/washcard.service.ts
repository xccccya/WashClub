import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from '../notification/notification.service.js';

@Injectable()
export class WashCardService {
    constructor(private prisma: PrismaService, private jwt: JwtService, private notifier: NotificationService) {}

    private async generateUniqueCardNo(tx: PrismaService | any): Promise<string> {
        // 生成8位数字卡号，确保唯一
        for (let i = 0; i < 20; i++) {
            const n = Math.floor(Math.random() * 100000000);
            const candidate = String(n).padStart(8, '0');
            const exists = await tx.washCard.findUnique({ where: { cardNo: candidate } }).catch(()=>null);
            if (!exists) return candidate;
        }
        // 退化策略：使用时间戳后8位，极低概率冲突
        const fallback = String(Date.now()).slice(-8);
        return fallback;
    }

    async getMemberIdFromToken(token?: string): Promise<number> {
        if (!token) throw new UnauthorizedException('缺少Token');
        try {
            const decoded: any = await this.jwt.verifyAsync(token);
            const id = Number(decoded?.sub);
            if (!id || decoded?.type !== 'member') throw new UnauthorizedException('Token无效');
            return id;
        } catch {
            throw new UnauthorizedException('Token无效');
        }
    }

    // 创建/后台加卡
    async createCard(params: { ownerMemberId: number; name?: string | null; totalTimes?: number; remainingTimes?: number; expiryAt?: string | Date | null; isDefault?: boolean }) {
        const { ownerMemberId } = params;
        const owner = await this.prisma.member.findUnique({ where: { id: ownerMemberId }, select: { id: true } });
        if (!owner) throw new BadRequestException('会员不存在');
        const total = Number(params.totalTimes ?? 0);
        const remain = Number(params.remainingTimes ?? total);
        const created = await this.prisma.$transaction(async (tx)=>{
            if (params.isDefault) {
                await tx.washCard.updateMany({ where: { ownerMemberId }, data: { isDefault: false } });
            }
            const countOwned = await tx.washCard.count({ where: { ownerMemberId } });
            const cardNo = await this.generateUniqueCardNo(tx);
            const created = await tx.washCard.create({
                data: {
                    ownerMemberId,
                    name: (params.name || '洗车计次卡') as any,
                    totalTimes: Math.max(0, total),
                    remainingTimes: Math.max(0, remain),
                    expiryAt: params.expiryAt ? new Date(params.expiryAt) : null,
                    isDefault: params.isDefault || countOwned === 0,
                    cardNo,
                } as any,
            });
            return created;
        });
        if (remain > 0) {
            await this.addLog(created.id, {
                action: 'ADD',
                reason: 'BACKEND_ADD',
                change: remain,
                remark: '后台创建卡并设置初始次数',
                operatorUserId: undefined,
                beforeRemaining: 0,
                afterRemaining: remain,
            });
        }
        return created;
    }

    listAdmin(page = 1, pageSize = 20, keyword?: string, memberId?: number) {
        const where: any = {};
        if (keyword) {
            where.OR = [
                { name: { contains: keyword } },
                { owner: { OR: [ { name: { contains: keyword } }, { phone: { contains: keyword } } ] } },
            ];
        }
        if (memberId && Number.isFinite(memberId)) {
            // 支持按会员筛选：持有人或被共享者
            where.AND = where.AND || [];
            where.AND.push({ OR: [ { ownerMemberId: memberId }, { shares: { some: { memberId } } } ] });
        }
        return Promise.all([
            this.prisma.washCard.findMany({ skip: (page - 1) * pageSize, take: pageSize, where: Object.keys(where).length ? where : undefined, orderBy: [{ isDefault: 'desc' } as any, { id: 'desc' }], include: { owner: true, shares: { include: { member: true } } } }),
            this.prisma.washCard.count({ where: Object.keys(where).length ? where : undefined }),
        ]).then(([items, total]) => ({ items, total, page, pageSize }));
    }

    getAdmin(id: number) { return this.prisma.washCard.findUnique({ where: { id }, include: { owner: true, shares: { include: { member: true } } } }); }

    async addTimes(cardId: number, count: number, operatorUserId?: number, remark?: string, purchaseOrderId?: number) {
        if (!Number.isFinite(count) || count <= 0) throw new BadRequestException('增加次数必须为正整数');
        return this.prisma.$transaction(async (tx) => {
            const card = await tx.washCard.findUnique({ where: { id: cardId } });
            if (!card) throw new BadRequestException('洗车卡不存在');
            const before = card.remainingTimes;
            const after = before + count;
            const updated = await tx.washCard.update({ where: { id: cardId }, data: { remainingTimes: after, totalTimes: Math.max(card.totalTimes, after) } });
            await tx.washCardLog.create({
                data: {
                    cardId,
                    action: 'ADD' as any,
                    reason: (purchaseOrderId ? 'PURCHASE_ADD' : 'BACKEND_ADD') as any,
                    change: count,
                    beforeRemaining: before,
                    afterRemaining: after,
                    remark: remark || undefined,
                    operatorUserId: operatorUserId || null,
                    purchaseOrderId: purchaseOrderId || null,
                },
            });
            return updated;
        });
    }

    async deductTimes(cardId: number, count: number, reason: 'SERVICE_DEDUCT' | 'REFUND_DEDUCT' | 'BACKEND_DEDUCT', opts?: { vehicleId?: number | null; operatorUserId?: number | null; serviceOrderId?: number | null; refundRecordId?: number | null; remark?: string | null }) {
        if (!Number.isFinite(count) || count <= 0) throw new BadRequestException('划扣次数必须为正整数');
        const updated = await this.prisma.$transaction(async (tx) => {
            const card = await tx.washCard.findUnique({ where: { id: cardId } });
            if (!card) throw new BadRequestException('洗车卡不存在');
            if (card.remainingTimes < count) throw new BadRequestException('剩余次数不足');
            const before = card.remainingTimes;
            const after = before - count;
            const updated = await tx.washCard.update({ where: { id: cardId }, data: { remainingTimes: after } });
            await tx.washCardLog.create({
                data: {
                    cardId,
                    action: 'DEDUCT' as any,
                    reason: reason as any,
                    change: -count,
                    beforeRemaining: before,
                    afterRemaining: after,
                    remark: opts?.remark || undefined,
                    operatorUserId: opts?.operatorUserId || null,
                    serviceOrderId: opts?.serviceOrderId || null,
                    refundRecordId: opts?.refundRecordId || null,
                    vehicleId: opts?.vehicleId || null,
                },
            });
            return updated;
        });

        // 发送洗车卡划扣通知（非支付场景：后台划扣/服务划扣/退款回收）
        try{
            const card = await this.prisma.washCard.findUnique({ where: { id: cardId }, select: { ownerMemberId: true, name: true, cardNo: true, id: true } });
            if (card) {
                if (reason === 'BACKEND_DEDUCT') {
                    await this.notifier.sendByTemplate(
                        'WASH_CARD_DEDUCT',
                        { cardName: card.name, cardNo: card.cardNo, times: count, reason: '后台划扣' },
                        { kind:'MEMBER', memberId: card.ownerMemberId },
                        { title:'洗车卡划扣通知', content:`您的洗车卡 ${card.name||''}（${card.cardNo||''}）已被后台划扣 ${count} 次。` },
                        `/pages/washcard/detail?id=${card.id}`
                    );
                } else if (reason === 'SERVICE_DEDUCT') {
                    await this.notifier.sendByTemplate(
                        'WASH_CARD_DEDUCT',
                        { cardName: card.name, cardNo: card.cardNo, times: count, reason: '服务划扣' },
                        { kind:'MEMBER', memberId: card.ownerMemberId },
                        { title:'洗车卡服务划扣', content:`您的洗车卡 ${card.name||''}（${card.cardNo||''}）服务划扣 ${count} 次。` },
                        `/pages/washcard/detail?id=${card.id}`
                    );
                } else if (reason === 'REFUND_DEDUCT') {
                    await this.notifier.sendByTemplate(
                        'WASH_CARD_DEDUCT',
                        { cardName: card.name, cardNo: card.cardNo, times: count, reason: '退款回收' },
                        { kind:'MEMBER', memberId: card.ownerMemberId },
                        { title:'洗车卡退款回收', content:`您的洗车卡 ${card.name||''}（${card.cardNo||''}）因退款回收 ${count} 次。` },
                        `/pages/washcard/detail?id=${card.id}`
                    );
                }
            }
        }catch{}

        return updated;
    }

    // 共享管理
    listShares(cardId: number) { return this.prisma.washCardShare.findMany({ where: { cardId }, include: { member: true } }); }
    async addShare(cardId: number, memberId: number) {
        const card = await this.prisma.washCard.findUnique({ where: { id: cardId } });
        if (!card) throw new BadRequestException('洗车卡不存在');
        const member = await this.prisma.member.findUnique({ where: { id: memberId } });
        if (!member) throw new BadRequestException('共享目标会员不存在');
        if (memberId === card.ownerMemberId) throw new BadRequestException('无需共享给持有人');
        const created = await this.prisma.washCardShare.create({ data: { cardId, memberId } });
        // 写共享日志：不改变次数，记录被共享人
        await this.prisma.washCardLog.create({
            data: {
                cardId,
                action: 'SHARE' as any,
                reason: 'SHARE_ADD' as any,
                change: 0,
                beforeRemaining: (await this.prisma.washCard.findUnique({ where: { id: cardId }, select: { remainingTimes: true } }))!.remainingTimes,
                afterRemaining: (await this.prisma.washCard.findUnique({ where: { id: cardId }, select: { remainingTimes: true } }))!.remainingTimes,
                memberId,
                remark: `共享给会员(${member.phone})`,
            },
        });
        return created;
    }
    async removeShare(cardId: number, memberId: number) {
        const member = await this.prisma.member.findUnique({ where: { id: memberId } });
        const removed = await this.prisma.washCardShare.delete({ where: { cardId_memberId: { cardId, memberId } } });
        await this.prisma.washCardLog.create({
            data: {
                cardId,
                action: 'SHARE' as any,
                reason: 'SHARE_REMOVE' as any,
                change: 0,
                beforeRemaining: (await this.prisma.washCard.findUnique({ where: { id: cardId }, select: { remainingTimes: true } }))!.remainingTimes,
                afterRemaining: (await this.prisma.washCard.findUnique({ where: { id: cardId }, select: { remainingTimes: true } }))!.remainingTimes,
                memberId,
                remark: `移除共享(${member?.phone || memberId})`,
            },
        });
        return removed;
    }

    // 日志
    listLogs(cardId: number, page = 1, pageSize = 20) {
        return Promise.all([
            this.prisma.washCardLog.findMany({ skip: (page - 1) * pageSize, take: pageSize, where: { cardId }, orderBy: { id: 'desc' }, include: { operatorUser: true, vehicle: true, member: { select: { id: true, name: true, phone: true } } } }),
            this.prisma.washCardLog.count({ where: { cardId } }),
        ]).then(([items, total]) => ({ items, total, page, pageSize }));
    }

    private async addLog(cardId: number, log: { action: 'ADD' | 'DEDUCT'; reason: 'BACKEND_ADD' | 'PURCHASE_ADD' | 'SERVICE_DEDUCT' | 'REFUND_DEDUCT' | 'BACKEND_DEDUCT'; change: number; remark?: string | null; operatorUserId?: number | null; beforeRemaining?: number | null; afterRemaining?: number | null }) {
        const card = await this.prisma.washCard.findUnique({ where: { id: cardId } });
        if (!card) throw new BadRequestException('洗车卡不存在');
        const before = (typeof log.beforeRemaining === 'number') ? log.beforeRemaining : card.remainingTimes;
        const after = (typeof log.afterRemaining === 'number') ? log.afterRemaining : (card.remainingTimes + log.change);
        await this.prisma.washCardLog.create({
            data: {
                cardId,
                action: log.action as any,
                reason: log.reason as any,
                change: log.change,
                beforeRemaining: before,
                afterRemaining: after,
                remark: log.remark || undefined,
                operatorUserId: log.operatorUserId || null,
            },
        });
    }

    // 会员端：我的卡摘要
    async myCards(memberId: number) {
        const owned = await this.prisma.washCard.findMany({ where: { ownerMemberId: memberId }, orderBy: [{ isDefault: 'desc' } as any, { id: 'desc' }] });
        const sharedRefs = await this.prisma.washCardShare.findMany({ where: { memberId }, include: { card: true } });
        const shared = sharedRefs.map(x => ({ ...x.card, _shared: true } as any));
        return [...owned, ...shared].sort((a:any,b:any)=> (Number(b.isDefault||0) - Number(a.isDefault||0)) || (b.id-a.id));
    }

    async getCardForMember(memberId: number, cardId: number) {
        // 校验访问权限：持有者或被共享者
        const card = await this.prisma.washCard.findUnique({ where: { id: cardId }, include: { shares: true, owner: { select: { id: true, name: true, phone: true } } } });
        if (!card) throw new BadRequestException('洗车卡不存在');
        const allowed = card.ownerMemberId === memberId || card.shares.some(s => s.memberId === memberId);
        if (!allowed) throw new UnauthorizedException('无权访问该洗车卡');
        const isShared = card.ownerMemberId !== memberId && card.shares.some(s => s.memberId === memberId);
        return { ...card, _shared: isShared } as any;
    }

    async setDefault(cardId: number) {
        const card = await this.prisma.washCard.findUnique({ where: { id: cardId } });
        if (!card) throw new BadRequestException('洗车卡不存在');
        return this.prisma.$transaction(async (tx)=>{
            await tx.washCard.updateMany({ where: { ownerMemberId: card.ownerMemberId, isDefault: true }, data: { isDefault: false } });
            return tx.washCard.update({ where: { id: cardId }, data: { isDefault: true } });
        });
    }
    
    // 仅持有人可设置默认；共享者不可更改持有人默认
    async setDefaultForOwner(requestMemberId: number, cardId: number) {
        const card = await this.prisma.washCard.findUnique({ where: { id: cardId } });
        if (!card) throw new BadRequestException('洗车卡不存在');
        if (card.ownerMemberId !== requestMemberId) throw new UnauthorizedException('仅持有人可设置默认');
        return this.prisma.$transaction(async (tx)=>{
            await tx.washCard.updateMany({ where: { ownerMemberId: requestMemberId, isDefault: true }, data: { isDefault: false } });
            return tx.washCard.update({ where: { id: cardId }, data: { isDefault: true } });
        });
    }

    // 会员端获取日志（校验权限）
    async listLogsForMember(requestMemberId: number, cardId: number, page = 1, pageSize = 20){
        const card = await this.prisma.washCard.findUnique({ where: { id: cardId }, include: { shares: true } });
        if (!card) throw new BadRequestException('洗车卡不存在');
        const allowed = card.ownerMemberId === requestMemberId || card.shares.some(s => s.memberId === requestMemberId);
        if (!allowed) throw new UnauthorizedException('无权访问该洗车卡');
        return this.listLogs(cardId, page, pageSize);
    }

    // 删除计次卡：同时删除共享与相关日志
    async deleteCard(cardId: number){
        const card = await this.prisma.washCard.findUnique({ where: { id: cardId } });
        if (!card) throw new BadRequestException('洗车卡不存在');
        await this.prisma.$transaction(async (tx) => {
            await tx.washCardShare.deleteMany({ where: { cardId } });
            await tx.washCardLog.deleteMany({ where: { cardId } });
            await tx.washCard.delete({ where: { id: cardId } });
        });
        return { ok: true };
    }
}


