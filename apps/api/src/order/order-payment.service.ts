import { Injectable, BadRequestException } from '@nestjs/common';
import { PayMethod, OrderSettlement } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { WxpayService } from './wxpay.service.js';
import { WechatShippingService } from './wechat-shipping.service.js';
import { OrderRewardsService } from './order-rewards.service.js';
import { WashCardService } from '../member/washcard.service.js';
import { GroupCardService } from '../group/card.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { NotificationGateway } from '../notification/notification.gateway.js';

@Injectable()
export class OrderPaymentService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly wxpay: WxpayService,
        private readonly wxship: WechatShippingService,
        private readonly rewards: OrderRewardsService,
        private readonly washcards: WashCardService,
        private readonly groupCards: GroupCardService,
        private readonly notifier: NotificationService,
        private readonly gateway: NotificationGateway
    ) {}

    private last4(v?: string | null): string {
        try{
            const s = String(v ?? '').trim();
            if (!s) return '';
            return s.slice(-4);
        }catch{ return ''; }
    }
    private maskPhoneTail(v?: string | null): string {
        const t = this.last4(v);
        return t ? `****${t}` : '-';
    }
    private maskCardTail(v?: string | null): string {
        const t = this.last4(v);
        return t ? `****${t}` : '-';
    }
    private formatYmd(val: any): string | null {
        try{
            if (!val) return null;
            const d = new Date(val);
            if (isNaN(d.getTime())) return null;
            const y = d.getFullYear();
            const m = String(d.getMonth()+1).padStart(2,'0');
            const dd = String(d.getDate()).padStart(2,'0');
            return `${y}-${m}-${dd}`;
        }catch{ return null; }
    }
    private async buildWashProject(orderId: number, fallbackNo?: string | null): Promise<string> {
        // 消费项目：优先拼接洗车项目名称
        try{
            const items:any[] = await this.prisma.orderItem.findMany({ where: { orderId }, select: { productId:true, name:true, quantity:true } as any });
            const productIds = (items||[]).map(it=>it.productId).filter((v:any)=> typeof v === 'number');
            const products:any[] = productIds.length ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id:true, isCarWash:true } as any }) : [];
            const flag = new Map<number, boolean>(products.map(p=> [Number(p.id), !!(p as any).isCarWash]));
            const parts: string[] = [];
            for (const it of (items||[])){
                const pid = Number(it.productId||0);
                if (pid && flag.get(pid)) {
                    const q = Math.max(1, Number(it.quantity||1));
                    const nm = String(it.name||'').trim();
                    if (nm) parts.push(q>1 ? `${nm}×${q}` : nm);
                }
            }
            const project = parts.join('、');
            if (project) return project;
        }catch{}
        const no = String(fallbackNo || '').trim();
        return no ? `订单${no}次卡消费` : '次卡消费';
    }

    private async writeTimeline(params: { tx?: any; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }) {
        try {
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        } catch {/* ignore timeline errors */ }
    }

    // 统计订单中的洗车项目总次数（按商品 isCarWash 与数量汇总）
    private async computeWashTimes(orderId: number): Promise<number> {
        const items = await this.prisma.orderItem.findMany({ where: { orderId } });
        if (!items.length) return 0;
        const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
        if (!productIds.length) return 0;
        const products = await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, isCarWash: true } });
        const flag = new Map<number, boolean>(products.map(p => [p.id, !!(p as any).isCarWash]));
        let times = 0;
        for (const it of items) {
            const pid = it.productId as any as number | null;
            if (pid && flag.get(pid)) times += Math.max(1, Number(it.quantity || 0));
        }
        return times;
    }

    // 集团余额支付（仅服务订单且挂载了 groupId）。不计入订单 payAmount（保持为0），仅做集团余额扣减与流水日志，订单标记为已支付。
    async markPaidByGroupBalance(params: { orderId: number; operatorUserId?: number | null }) {
        const { orderId, operatorUserId } = params;
        const basic: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!basic) throw new BadRequestException('订单不存在');
        if (basic.type !== 'SERVICE') throw new BadRequestException('仅服务订单支持集团余额支付');
        if (!basic.groupId) throw new BadRequestException('非集团订单，不能使用集团余额支付');
        if (basic.payStatus !== 'UNPAID') throw new BadRequestException('仅未支付订单可支付');

        // 以订单当前应付金额为准进行集团余额扣减，避免与各种折扣/运费口径不一致
        const amount = Math.max(0, Number(basic.payAmount || 0));
        // 余额扣减仅作为内部记账（不计入 Order.payAmount），但必须确保集团余额充足
        await this.prisma.$transaction(async (tx) => {
            // 幂等：仅当仍为 UNPAID 时更新
            const upd = await tx.order.updateMany({ where: { id: basic.id, payStatus: 'UNPAID' as any }, data: { payStatus: 'PAID' as any, status: 'PAID' as any, payMethod: 'GROUP_BALANCE' as any, settlement: 'NORMAL' as any, paidAt: new Date(), payAmount: 0 as any } as any });
            if (!upd || (upd as any).count === 0) throw new BadRequestException('该订单已被处理');

            // 扣减集团余额（乐观锁）
            let acc0 = await tx.groupBalanceAccount.findUnique({ where: { groupId: basic.groupId } });
            if (!acc0) {
                await tx.groupBalanceAccount.create({ data: { groupId: basic.groupId, balance: 0 as any, version: 0 } });
                acc0 = await tx.groupBalanceAccount.findUnique({ where: { groupId: basic.groupId } });
            }
            const currentAcc = await tx.groupBalanceAccount.findUnique({ where: { groupId: basic.groupId } });
            const before = Number((currentAcc as any)?.balance || 0);
            if (before < amount) throw new BadRequestException('集团余额不足');
            const version = (currentAcc as any)?.version ?? 0;
            const ok = await tx.groupBalanceAccount.updateMany({ where: { groupId: basic.groupId, version }, data: { balance: (before - amount) as any, version: { increment: 1 } as any } as any });
            if (!ok || (ok as any).count === 0) throw new BadRequestException('集团余额并发更新失败，请重试');

            await tx.groupBalanceLedger.create({ data: ({ groupId: basic.groupId, type: 'DEDUCT' as any, amount: (-amount) as any, orderId: basic.id, orderNo: basic.no, operatorUserId: operatorUserId ?? null, note: '集团余额支付扣减' } as any) });

            await this.writeTimeline({ tx, orderId: basic.id, event: 'PAY_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ tx, orderId: basic.id, event: 'ORDER_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ tx, orderId: basic.id, event: 'NOTE', value: 'GROUP_BALANCE_PAY', remark: `金额：${amount.toFixed(2)}`, operatorUserId: operatorUserId ?? null });
        });

        // 服务订单支付后，若队列中存在则移除（与其他支付方式保持一致）
        try {
            const it = await this.prisma.serviceQueueItem.findFirst({ where: { orderId } } as any);
            if (it) {
                await this.prisma.$transaction(async (tx) => {
                    await tx.serviceTask.deleteMany({ where: { queueItemId: it.id } });
                    await tx.serviceQueueItem.delete({ where: { id: it.id } });
                });
            }
        } catch {}

        // 集团余额支付不发放成长值与积分，也不计入 member.totalPaidAmount
        return { ok: true } as any;
    }

    // 使用洗车卡划扣并标记订单支付成功（支持个人/集团卡，自动选择），含并发幂等与多卡分摊
    async markPaidByWashCard(params: { orderId: number; prefer?: 'GROUP'|'MEMBER'; operatorUserId?: number | null }) {
        const { orderId, prefer, operatorUserId } = params;
        const basic: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!basic) throw new BadRequestException('订单不存在');
        if (basic.type !== 'SERVICE') throw new BadRequestException('仅服务订单支持洗车卡划扣');
        if (basic.payStatus !== 'UNPAID') throw new BadRequestException('仅未支付订单可划扣');
        if (!basic.vehicleId) throw new BadRequestException('订单缺少服务车辆信息');

        const timesNeeded = await this.computeWashTimes(basic.id);
        if (timesNeeded <= 0) throw new BadRequestException('该订单无洗车项目，无需划扣');

        const res = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({ where: { id: orderId } });
            if (!order || order.payStatus !== 'UNPAID') throw new BadRequestException('订单状态已变更');

            const vehicle = await tx.vehicle.findUnique({ where: { id: order.vehicleId! } });

            // 先原子标记支付（幂等）：仅当仍为 UNPAID 才更新，行级锁避免并发重复
            const payAmountOld = Number(order.payAmount || 0);
            const settlementAuto = (() => {
                if (prefer === 'GROUP') return 'GROUP_WASH_CARD';
                if (prefer === 'MEMBER') return 'WASH_CARD';
                return vehicle?.groupId ? 'GROUP_WASH_CARD' : 'WASH_CARD';
            })();

            const upd = await tx.order.updateMany({
                where: { id: order.id, payStatus: 'UNPAID' as any },
                data: {
                    payStatus: 'PAID' as any,
                    status: 'PAID' as any,
                    payMethod: 'WASH_CARD' as any,
                    paidAt: new Date(),
                    settlement: settlementAuto as any,
                    washCardDeductAmount: payAmountOld as any,
                    payAmount: 0 as any,
                } as any
            });
            if (!upd || (upd as any).count === 0) {
                // 已被他人处理
                throw new BadRequestException('该订单已被处理');
            }

            // 准备候选卡片（带排序）：
            const groupCards = vehicle?.groupId
                ? await tx.groupWashCard.findMany({ where: { groupId: vehicle.groupId, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } })
                : [];
            const owned = await tx.washCard.findMany({ where: { ownerMemberId: order.memberId, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } });
            const sharedLinks = await tx.washCardShare.findMany({ where: { memberId: order.memberId }, select: { cardId: true } });
            const sharedIds = Array.from(new Set(sharedLinks.map(x => x.cardId)));
            const shared = sharedIds.length ? await tx.washCard.findMany({ where: { id: { in: sharedIds }, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } }) : [];
            const memberCards = [...owned, ...shared];

            const preferGroup = prefer === 'GROUP' || (!prefer && !!vehicle?.groupId);
            const candidate: Array<{ type: 'GROUP'|'MEMBER'; id: number; remain: number }>
                = [ ...(preferGroup ? groupCards.map(c=>({ type:'GROUP' as const, id:c.id, remain:Number(c.remainingTimes||0) })) : []),
                    ...memberCards.map(c=>({ type:'MEMBER' as const, id:c.id, remain:Number(c.remainingTimes||0) })),
                    ...(!preferGroup ? groupCards.map(c=>({ type:'GROUP' as const, id:c.id, remain:Number(c.remainingTimes||0) })) : []) ];

            const totalRemain = candidate.reduce((s,c)=> s + c.remain, 0);
            if (totalRemain < timesNeeded) throw new BadRequestException('可用洗车卡余次不足');

            // 分摊计划
            let left = timesNeeded;
            const plan: Array<{ type:'GROUP'|'MEMBER'; cardId:number; used:number }> = [];
            for (const c of candidate) {
                if (left <= 0) break;
                const take = Math.min(c.remain, left);
                if (take > 0) { plan.push({ type: c.type, cardId: c.id, used: take }); left -= take; }
            }

            // 审计信息
            const orderNo = order.no;
            let plate = '';
            try { const v = await tx.vehicle.findUnique({ where: { id: order.vehicleId! }, select: { plateNumber: true } }); plate = v?.plateNumber || ''; } catch {}
            let opText = '系统';
            if (operatorUserId) {
                try{
                    const u:any = await tx.user.findUnique({ where: { id: operatorUserId }, select: { id:true, name:true, phone:true } as any });
                    const tail = this.last4(u?.phone);
                    const nick = tail ? `****${tail}` : '';
                    opText = nick ? `操作人：${nick}` : `操作人：#${operatorUserId}`;
                }catch{
                    opText = `操作人：#${operatorUserId}`;
                }
            }
            // 使用人（订单会员）手机号后四位
            let userTail = '';
            try{
                const m:any = await tx.member.findUnique({ where: { id: order.memberId }, select: { phone: true } as any });
                userTail = this.last4(m?.phone);
            }catch{}

            // 预取卡片信息与卡主手机号后四位（用于日志/时间线）
            const memberCardIds = Array.from(new Set(plan.filter(p=>p.type==='MEMBER').map(p=>p.cardId)));
            const groupCardIds = Array.from(new Set(plan.filter(p=>p.type==='GROUP').map(p=>p.cardId)));
            const memberCardsInfo:any[] = memberCardIds.length ? await tx.washCard.findMany({ where: { id: { in: memberCardIds } }, select: { id:true, cardNo:true, ownerMemberId:true } as any }) : [];
            const groupCardsInfo:any[] = groupCardIds.length ? await tx.groupWashCard.findMany({ where: { id: { in: groupCardIds } }, select: { id:true, cardNo:true } as any }) : [];
            const ownerIds = Array.from(new Set(memberCardsInfo.map(c=> Number(c.ownerMemberId||0)).filter(Boolean)));
            const owners:any[] = ownerIds.length ? await tx.member.findMany({ where: { id: { in: ownerIds } }, select: { id:true, phone:true } as any }) : [];
            const ownerTailById = new Map<number,string>(owners.map(o=>[Number(o.id||0), this.last4(o.phone)]));
            const memberCardNoTailById = new Map<number,string>(memberCardsInfo.map(c=>[Number(c.id||0), this.last4(c.cardNo)]));
            const groupCardNoTailById = new Map<number,string>(groupCardsInfo.map(c=>[Number(c.id||0), this.last4(c.cardNo)]));
            const memberCardOwnerIdByCardId = new Map<number,number>(memberCardsInfo.map(c=>[Number(c.id||0), Number(c.ownerMemberId||0)]));

            const remarkBase = `订单${orderNo}${plate?`/车辆${plate}`:''}，使用人${userTail?`****${userTail}`:'-' }，${opText}`;

            // 扣减并写日志（同一事务）
            for (const it of plan) {
                if (it.type === 'MEMBER') {
                    const card = await tx.washCard.findUnique({ where: { id: it.cardId } });
                    if (!card) throw new BadRequestException('洗车卡不存在');
                    if ((card.remainingTimes || 0) < it.used) throw new BadRequestException('洗车卡余次不足');
                    const before = Number(card.remainingTimes || 0);
                    const after = before - it.used;
                    await tx.washCard.update({ where: { id: card.id }, data: { remainingTimes: after } });
                    // 若为他人卡，补充卡主手机号后四位
                    const ownerId = Number(card.ownerMemberId||0);
                    const ownerTail = ownerTailById.get(ownerId) || '';
                    const extra = (ownerId && ownerId !== Number(order.memberId||0) && ownerTail)
                        ? `，卡主****${ownerTail}`
                        : '';
                    await tx.washCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'SERVICE_DEDUCT' as any, change: -it.used, beforeRemaining: before, afterRemaining: after, remark: `服务划扣（${remarkBase}${extra}）`, operatorUserId: operatorUserId ?? null, serviceOrderId: order.id, vehicleId: order.vehicleId ?? null, memberId: order.memberId } as any });
                } else {
                    const card = await tx.groupWashCard.findUnique({ where: { id: it.cardId } });
                    if (!card) throw new BadRequestException('集团洗车卡不存在');
                    if ((card.remainingTimes || 0) < it.used) throw new BadRequestException('集团洗车卡余次不足');
                    const before = Number(card.remainingTimes || 0);
                    const after = before - it.used;
                    await tx.groupWashCard.update({ where: { id: card.id }, data: { remainingTimes: after } });
                    await tx.groupWashCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'SERVICE_DEDUCT' as any, change: -it.used, beforeRemaining: before, afterRemaining: after, remark: `服务划扣（${remarkBase}）`, operatorUserId: operatorUserId ?? null, serviceOrderId: order.id, serviceOrderNo: order.no, vehicleId: order.vehicleId ?? null, memberId: order.memberId } as any });
                }
            }

            // 时间线（事务内）
            await this.writeTimeline({ tx, orderId: order.id, event: 'PAY_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ tx, orderId: order.id, event: 'ORDER_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            try{
                const cardParts: string[] = [];
                for (const p of plan) {
                    const tail = p.type==='MEMBER' ? (memberCardNoTailById.get(Number(p.cardId||0))||'') : (groupCardNoTailById.get(Number(p.cardId||0))||'');
                    const tag = p.type==='MEMBER' ? `洗车卡${tail?`****${tail}`:'-'}` : `集团卡${tail?`****${tail}`:'-'}`;
                    cardParts.push(`${tag}×${p.used}`);
                }
                const ownersTail = Array.from(new Set(
                    memberCardIds
                        .map(cid=> ownerTailById.get(memberCardOwnerIdByCardId.get(cid) || 0) || '')
                        .filter(t=>!!t && t !== userTail)
                ));
                const ownersText = ownersTail.length ? `；卡主${ownersTail.map(t=>`****${t}`).join('、')}` : '';
                // 自用（无他人卡主）不显示“使用人”，他人卡场景才展示使用人后四位
                const usedByText = ownersTail.length ? `；使用人${userTail?`****${userTail}`:'-'}` : '';
                const remark = `划扣${timesNeeded}次；卡：${cardParts.join('、') || '-'}${usedByText}${ownersText}`;
                await this.writeTimeline({ tx, orderId: order.id, event: 'BENEFITS', value: 'WASHCARD_DEDUCT', remark, operatorUserId: operatorUserId ?? null });
            }catch{
                await this.writeTimeline({ tx, orderId: order.id, event: 'BENEFITS', value: 'WASHCARD_DEDUCT', remark: `划扣次数：${timesNeeded}次`, operatorUserId: operatorUserId ?? null });
            }

            // 服务订单支付后自动移出队列
            try {
                const it = await tx.serviceQueueItem.findFirst({ where: { orderId: order.id } } as any);
                if (it) {
                    await tx.serviceTask.deleteMany({ where: { queueItemId: it.id } });
                    await tx.serviceQueueItem.delete({ where: { id: it.id } });
                }
            } catch {}

            const usedCardType = preferGroup ? (plan.some(p=>p.type==='GROUP') ? 'GROUP' : 'MEMBER') : (plan.some(p=>p.type==='MEMBER') ? 'MEMBER' : 'GROUP');
            return { ok: true, settlement: settlementAuto, usedCardType, requiredTimes: timesNeeded, deducted: payAmountOld, plan } as any;
        });

        // 通知（站内）：下单人收到“支付成功”；卡主收到“卡被使用”
        try{
            const ord:any = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id:true, no:true, memberId:true } });
            const plan = Array.isArray((res as any)?.plan) ? (res as any).plan as Array<{ type:'GROUP'|'MEMBER'; cardId:number; used:number }> : [];
            const memberCardIds = Array.from(new Set(plan.filter(p=>p.type==='MEMBER').map(p=>p.cardId)));
            const groupCardIds = plan.filter(p=>p.type==='GROUP').map(p=>p.cardId);
            const [memberCards, groupCards, orderMember, vehicle] = await Promise.all([
                memberCardIds.length ? this.prisma.washCard.findMany({ where: { id: { in: memberCardIds } }, select: { id:true, name:true, cardNo:true, ownerMemberId:true, remainingTimes:true, expiryAt:true } as any }) : Promise.resolve([]),
                groupCardIds.length ? this.prisma.groupWashCard.findMany({ where: { id: { in: groupCardIds } }, select: { id:true, name:true, cardNo:true } }) : Promise.resolve([]),
                this.prisma.member.findUnique({ where: { id: Number(ord?.memberId||0) }, select: { phone:true } as any }).catch(()=>null),
                this.prisma.vehicle.findUnique({ where: { id: Number((await this.prisma.order.findUnique({ where: { id: orderId }, select: { vehicleId:true } } as any))?.vehicleId||0) }, select: { plateNumber:true } as any }).catch(()=>null),
            ]);
            const allCards = [...memberCards, ...groupCards];
            const cardNames = allCards.map(c=>c.name || '').filter(Boolean).join('、');
            const cardNos = allCards.map(c=>c.cardNo || '').filter(Boolean).join('、');
            const times = Number(((res as any)?.requiredTimes)||0);
            const amount = Number(((res as any)?.deducted)||0);
            const amountStr = amount.toFixed(2);

            // 判断是否使用了“他人卡”（仅会员卡有卡主）
            const ownerIds = Array.from(new Set((memberCards as any[]).map(c=> Number((c as any)?.ownerMemberId||0)).filter(Boolean)));
            const owners:any[] = ownerIds.length ? await this.prisma.member.findMany({ where: { id: { in: ownerIds } }, select: { id:true, phone:true } as any }).catch(()=>[]) : [];
            const orderTail = this.last4((orderMember as any)?.phone);
            const otherOwnerTails = Array.from(new Set(owners.map(o=> this.last4(o?.phone)).filter(t=>!!t && t !== orderTail)));
            const otherHint = otherOwnerTails.length ? `（含他人卡：${otherOwnerTails.map(t=>`****${t}`).join('、')}）` : '';

            await this.notifier.sendByTemplate(
                'WASH_CARD_PAY_DEDUCT',
                { no: ord?.no, times, cardName: cardNames, cardNo: cardNos, amount: amountStr, otherOwners: otherOwnerTails.map(t=>`****${t}`).join('、') },
                { kind:'MEMBER', memberId: Number(ord?.memberId||0) },
                { title:'订单已使用洗车卡支付', content:`订单 ${ord?.no||''} 使用洗车卡划扣 ${times} 次，抵扣￥${amountStr}${otherHint}` },
                `/pages/order/detail?id=${ord?.id||0}`
            );

            // 卡主站内通知（仅会员洗车卡）：按“卡”发送，说明被谁用（手机号后四位）
            try{
                const orderUserTail = orderTail;
                const usedByCardId = new Map<number, number>();
                for (const p of plan.filter(p=>p.type==='MEMBER')) {
                    usedByCardId.set(p.cardId, (usedByCardId.get(p.cardId)||0) + Math.max(0, Number(p.used||0)));
                }
                for (const c of (memberCards as any[])) {
                    const used = usedByCardId.get(Number(c.id||0)) || 0;
                    if (!used) continue;
                    const ownerId = Number(c.ownerMemberId||0);
                    if (!ownerId) continue;
                    // 自己用自己卡：不发“洗车卡被使用”站内通知
                    if (Number(ownerId) === Number(ord?.memberId||0)) continue;
                    const cardNoTail = this.last4(c.cardNo);
                    const byText = orderUserTail ? `****${orderUserTail}` : '-';
                    const plate = String((vehicle as any)?.plateNumber || '').trim();
                    const plateText = plate ? `车辆${plate}` : '';
                    const midText = [plateText, `订单${ord?.no||''}`].filter(Boolean).join('，');
                    await this.notifier.sendByTemplate(
                        'WASH_CARD_DEDUCT',
                        { cardName: c.name, cardNo: c.cardNo, times: used, reason: `服务划扣（被${byText}使用）`, orderNo: ord?.no, plateNumber: plate || '', usedBy: byText },
                        { kind:'MEMBER', memberId: ownerId },
                        { title:'洗车卡被使用', content:`您的洗车卡（${cardNoTail?`****${cardNoTail}`:'-'}）被${byText}使用，${midText}划扣${used}次。` },
                        `/pages/washcard/detail?id=${Number(c.id||0)}`
                    );
                }
            }catch{}

            // 微信小程序订阅消息：次卡消费通知（仅会员卡，发给卡主；集团卡不发）
            try{
                const project = await this.buildWashProject(orderId, ord?.no || null);
                const memberPlan = plan.filter(p=>p.type==='MEMBER');
                const byOwner = new Map<number, { cardIds: number[]; times: number }>();
                for (const p of memberPlan) {
                    const card = (memberCards as any[]).find(x=> Number(x.id||0)===Number(p.cardId||0));
                    const ownerId = Number(card?.ownerMemberId||0);
                    if (!ownerId) continue;
                    const cur = byOwner.get(ownerId) || { cardIds: [], times: 0 };
                    cur.times += Math.max(0, Number(p.used||0));
                    cur.cardIds.push(Number(p.cardId||0));
                    byOwner.set(ownerId, cur);
                }
                for (const [ownerId, info] of byOwner.entries()) {
                    const uniqCardIds = Array.from(new Set(info.cardIds.filter(Boolean)));
                    let remainingText = '多卡';
                    let expiryAtText: string | null = null;
                    const pageVars: any = {};
                    if (uniqCardIds.length === 1) {
                        const c:any = (memberCards as any[]).find(x=> Number(x.id||0)===uniqCardIds[0]);
                        if (c) {
                            remainingText = `${Math.max(0, Number(c.remainingTimes||0))}次`;
                            expiryAtText = this.formatYmd(c.expiryAt) || null;
                            pageVars.cardId = Number(c.id||0);
                        }
                    }
                    await this.notifier.sendWxappWashCardConsume({
                        memberId: Number(ownerId||0),
                        typeKey: 'WASH_CARD_CONSUME',
                        project,
                        timesText: `${Math.max(0, Number(info.times||0))}次`,
                        consumeAt: new Date(),
                        expiryAtText,
                        remainingText,
                        pageVars,
                    } as any);
                }
            }catch{}
        }catch{}

        return res;
    }

    // 手动指定付款会员/卡进行划扣（越权允许，不需 PIN，无额度阈值），保留 prefer 以决定分摊顺序
    async markPaidByWashCardManual(params: { orderId: number; payerMemberId?: number | null; payerCardId?: number | null; prefer?: 'GROUP'|'MEMBER'; operatorUserId?: number | null }){
        const { orderId, payerMemberId, payerCardId, prefer, operatorUserId } = params;
        const basic: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!basic) throw new BadRequestException('订单不存在');
        if (basic.type !== 'SERVICE') throw new BadRequestException('仅服务订单支持洗车卡划扣');
        if (basic.payStatus !== 'UNPAID') throw new BadRequestException('仅未支付订单可划扣');

        const timesNeeded = await this.computeWashTimes(basic.id);
        if (timesNeeded <= 0) throw new BadRequestException('该订单无洗车项目，无需划扣');

        // 付款主体集合：若指定 payerMemberId，则仅在其名下（含共享）找卡；否则按自动（集团优先）规则
        const res = await this.prisma.$transaction(async (tx)=>{
            const order = await tx.order.findUnique({ where: { id: orderId } });
            if (!order || order.payStatus !== 'UNPAID') throw new BadRequestException('订单状态已变更');

            // 原子标记支付
            const payAmountOld = Number(order.payAmount || 0);
            const settlementAuto = (() => {
                if (prefer === 'GROUP') return 'GROUP_WASH_CARD';
                if (prefer === 'MEMBER') return 'WASH_CARD';
                return order?.groupId ? 'GROUP_WASH_CARD' : 'WASH_CARD';
            })();
            const upd = await tx.order.updateMany({ where: { id: order.id, payStatus: 'UNPAID' as any }, data: { payStatus: 'PAID' as any, status: 'PAID' as any, payMethod: 'WASH_CARD' as any, paidAt: new Date(), settlement: settlementAuto as any, washCardDeductAmount: payAmountOld as any, payAmount: 0 as any } as any });
            if (!upd || (upd as any).count === 0) throw new BadRequestException('该订单已被处理');

            // 候选卡来源
            let groupCards: any[] = [];
            let memberCards: any[] = [];
            if (payerMemberId) {
                // 仅在指定会员名下/共享查找卡
                const owned = await tx.washCard.findMany({ where: { ownerMemberId: payerMemberId, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } });
                const sharedLinks = await tx.washCardShare.findMany({ where: { memberId: payerMemberId }, select: { cardId: true } });
                const sharedIds = Array.from(new Set(sharedLinks.map(x => x.cardId)));
                const shared = sharedIds.length ? await tx.washCard.findMany({ where: { id: { in: sharedIds }, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } }) : [];
                memberCards = [...owned, ...shared];
            } else {
                // 自动：按集团优先 or 会员
                if (order.groupId) {
                    groupCards = await tx.groupWashCard.findMany({ where: { groupId: order.groupId, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } });
                }
                const owned = await tx.washCard.findMany({ where: { ownerMemberId: order.memberId, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } });
                const sharedLinks = await tx.washCardShare.findMany({ where: { memberId: order.memberId }, select: { cardId: true } });
                const sharedIds = Array.from(new Set(sharedLinks.map(x => x.cardId)));
                const shared = sharedIds.length ? await tx.washCard.findMany({ where: { id: { in: sharedIds }, status: 'ACTIVE' as any }, orderBy: { id: 'asc' } }) : [];
                memberCards = [...owned, ...shared];
            }

            // 若指定具体卡，直接单卡扣减；否则按 prefer 组建候选并分摊
            let plan: Array<{ type:'GROUP'|'MEMBER'; cardId:number; used:number }> = [];
            if (payerCardId) {
                // 优先判断是集团卡还是会员卡
                let card: any = await tx.groupWashCard.findUnique({ where: { id: payerCardId } });
                if (card) {
                    if ((card.remainingTimes || 0) < timesNeeded) throw new BadRequestException('集团洗车卡余次不足');
                    plan = [{ type:'GROUP', cardId: card.id, used: timesNeeded }];
                } else {
                    card = await tx.washCard.findUnique({ where: { id: payerCardId } });
                    if (!card) throw new BadRequestException('指定卡不存在');
                    if ((card.remainingTimes || 0) < timesNeeded) throw new BadRequestException('洗车卡余次不足');
                    plan = [{ type:'MEMBER', cardId: card.id, used: timesNeeded }];
                }
            } else {
                const preferGroup = prefer === 'GROUP' || (!prefer && groupCards.length > 0);
                const candidate: Array<{ type: 'GROUP'|'MEMBER'; id: number; remain: number }>
                    = [ ...(preferGroup ? groupCards.map(c=>({ type:'GROUP' as const, id:c.id, remain:Number(c.remainingTimes||0) })) : []),
                        ...memberCards.map(c=>({ type:'MEMBER' as const, id:c.id, remain:Number(c.remainingTimes||0) })),
                        ...(!preferGroup ? groupCards.map(c=>({ type:'GROUP' as const, id:c.id, remain:Number(c.remainingTimes||0) })) : []) ];
                const totalRemain = candidate.reduce((s,c)=> s + c.remain, 0);
                if (totalRemain < timesNeeded) throw new BadRequestException('可用洗车卡余次不足');
                let left = timesNeeded;
                for (const c of candidate) {
                    if (left <= 0) break;
                    const take = Math.min(c.remain, left);
                    if (take > 0) { plan.push({ type: c.type, cardId: c.id, used: take }); left -= take; }
                }
            }

            // 扣减与日志
            const ordNo = order.no;
            let plate = '';
            try { const v = await tx.vehicle.findUnique({ where: { id: order.vehicleId! }, select: { plateNumber: true } }); plate = v?.plateNumber || ''; } catch {}
            let opText = '系统';
            if (operatorUserId) {
                try{
                    const u:any = await tx.user.findUnique({ where: { id: operatorUserId }, select: { id:true, name:true, phone:true } as any });
                    const tail = this.last4(u?.phone);
                    const nick = tail ? `****${tail}` : '';
                    opText = nick ? `操作人：${nick}` : `操作人：#${operatorUserId}`;
                }catch{
                    opText = `操作人：#${operatorUserId}`;
                }
            }
            // 使用人（订单会员）手机号后四位
            let userTail = '';
            try{
                const m:any = await tx.member.findUnique({ where: { id: order.memberId }, select: { phone: true } as any });
                userTail = this.last4(m?.phone);
            }catch{}

            // 预取卡片信息与卡主手机号后四位（用于日志/时间线）
            const memberCardIds = Array.from(new Set(plan.filter(p=>p.type==='MEMBER').map(p=>p.cardId)));
            const groupCardIds = Array.from(new Set(plan.filter(p=>p.type==='GROUP').map(p=>p.cardId)));
            const memberCardsInfo:any[] = memberCardIds.length ? await tx.washCard.findMany({ where: { id: { in: memberCardIds } }, select: { id:true, cardNo:true, ownerMemberId:true } as any }) : [];
            const groupCardsInfo:any[] = groupCardIds.length ? await tx.groupWashCard.findMany({ where: { id: { in: groupCardIds } }, select: { id:true, cardNo:true } as any }) : [];
            const ownerIds = Array.from(new Set(memberCardsInfo.map(c=> Number(c.ownerMemberId||0)).filter(Boolean)));
            const owners:any[] = ownerIds.length ? await tx.member.findMany({ where: { id: { in: ownerIds } }, select: { id:true, phone:true } as any }) : [];
            const ownerTailById = new Map<number,string>(owners.map(o=>[Number(o.id||0), this.last4(o.phone)]));
            const memberCardNoTailById = new Map<number,string>(memberCardsInfo.map(c=>[Number(c.id||0), this.last4(c.cardNo)]));
            const groupCardNoTailById = new Map<number,string>(groupCardsInfo.map(c=>[Number(c.id||0), this.last4(c.cardNo)]));
            const memberCardOwnerIdByCardId = new Map<number,number>(memberCardsInfo.map(c=>[Number(c.id||0), Number(c.ownerMemberId||0)]));

            const remarkBase = `订单${ordNo}${plate?`/车辆${plate}`:''}，使用人${userTail?`****${userTail}`:'-'}，${opText}`;
            for (const it of plan) {
                if (it.type === 'MEMBER') {
                    const card = await tx.washCard.findUnique({ where: { id: it.cardId } });
                    if (!card) throw new BadRequestException('洗车卡不存在');
                    if ((card.remainingTimes || 0) < it.used) throw new BadRequestException('洗车卡余次不足');
                    const before = Number(card.remainingTimes || 0);
                    const after = before - it.used;
                    await tx.washCard.update({ where: { id: card.id }, data: { remainingTimes: after } });
                    // 若为他人卡，补充卡主手机号后四位
                    const ownerId = Number(card.ownerMemberId||0);
                    const ownerTail = ownerTailById.get(ownerId) || '';
                    const extra = (ownerId && ownerId !== Number(order.memberId||0) && ownerTail)
                        ? `，卡主****${ownerTail}`
                        : '';
                    await tx.washCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'SERVICE_DEDUCT' as any, change: -it.used, beforeRemaining: before, afterRemaining: after, remark: `服务划扣（${remarkBase}${extra}）`, operatorUserId: operatorUserId ?? null, serviceOrderId: order.id, vehicleId: order.vehicleId ?? null, memberId: order.memberId } as any });
                } else {
                    const card = await tx.groupWashCard.findUnique({ where: { id: it.cardId } });
                    if (!card) throw new BadRequestException('集团洗车卡不存在');
                    if ((card.remainingTimes || 0) < it.used) throw new BadRequestException('集团洗车卡余次不足');
                    const before = Number(card.remainingTimes || 0);
                    const after = before - it.used;
                    await tx.groupWashCard.update({ where: { id: card.id }, data: { remainingTimes: after } });
                    await tx.groupWashCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'SERVICE_DEDUCT' as any, change: -it.used, beforeRemaining: before, afterRemaining: after, remark: `服务划扣（${remarkBase}）`, operatorUserId: operatorUserId ?? null, serviceOrderId: order.id, serviceOrderNo: order.no, vehicleId: order.vehicleId ?? null, memberId: order.memberId } as any });
                }
            }

            await this.writeTimeline({ tx, orderId: order.id, event: 'PAY_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ tx, orderId: order.id, event: 'ORDER_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            try{
                const cardParts: string[] = [];
                for (const p of plan) {
                    const tail = p.type==='MEMBER' ? (memberCardNoTailById.get(Number(p.cardId||0))||'') : (groupCardNoTailById.get(Number(p.cardId||0))||'');
                    const tag = p.type==='MEMBER' ? `洗车卡${tail?`****${tail}`:'-'}` : `集团卡${tail?`****${tail}`:'-'}`;
                    cardParts.push(`${tag}×${p.used}`);
                }
                const ownersTail = Array.from(new Set(
                    memberCardIds
                        .map(cid=> ownerTailById.get(memberCardOwnerIdByCardId.get(cid) || 0) || '')
                        .filter(t=>!!t && t !== userTail)
                ));
                const ownersText = ownersTail.length ? `；卡主${ownersTail.map(t=>`****${t}`).join('、')}` : '';
                const usedByText = ownersTail.length ? `；使用人${userTail?`****${userTail}`:'-'}` : '';
                const remark = `划扣${timesNeeded}次；卡：${cardParts.join('、') || '-'}${usedByText}${ownersText}（手动指定）`;
                await this.writeTimeline({ tx, orderId: order.id, event: 'BENEFITS', value: 'WASHCARD_DEDUCT', remark, operatorUserId: operatorUserId ?? null });
            }catch{
                await this.writeTimeline({ tx, orderId: order.id, event: 'BENEFITS', value: 'WASHCARD_DEDUCT', remark: `划扣次数：${timesNeeded}次（手动指定）`, operatorUserId: operatorUserId ?? null });
            }

            // 自动移出队列
            try {
                const it = await tx.serviceQueueItem.findFirst({ where: { orderId: order.id } } as any);
                if (it) {
                    await tx.serviceTask.deleteMany({ where: { queueItemId: it.id } });
                    await tx.serviceQueueItem.delete({ where: { id: it.id } });
                }
            } catch {}

            return { ok: true, settlement: settlementAuto, requiredTimes: timesNeeded, deducted: payAmountOld, plan } as any;
        });

        // 通知：与自动路径对齐（下单人 + 卡主；订阅消息仅会员卡卡主）
        try{
            const ord:any = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id:true, no:true, memberId:true } });
            const plan = Array.isArray((res as any)?.plan) ? (res as any).plan as Array<{ type:'GROUP'|'MEMBER'; cardId:number; used:number }> : [];
            const times = Number(((res as any)?.requiredTimes)||timesNeeded||0);
            const amount = Number(((res as any)?.deducted)||0);
            const amountStr = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';

            const memberCardIds = Array.from(new Set(plan.filter(p=>p.type==='MEMBER').map(p=>p.cardId)));
            const groupCardIds = Array.from(new Set(plan.filter(p=>p.type==='GROUP').map(p=>p.cardId)));
            const [memberCards, groupCards, orderMember, vehicle] = await Promise.all([
                memberCardIds.length ? this.prisma.washCard.findMany({ where: { id: { in: memberCardIds } }, select: { id:true, name:true, cardNo:true, ownerMemberId:true, remainingTimes:true, expiryAt:true } as any }) : Promise.resolve([]),
                groupCardIds.length ? this.prisma.groupWashCard.findMany({ where: { id: { in: groupCardIds } }, select: { id:true, name:true, cardNo:true } }) : Promise.resolve([]),
                this.prisma.member.findUnique({ where: { id: Number(ord?.memberId||0) }, select: { phone:true } as any }).catch(()=>null),
                this.prisma.vehicle.findUnique({ where: { id: Number((await this.prisma.order.findUnique({ where: { id: orderId }, select: { vehicleId:true } } as any))?.vehicleId||0) }, select: { plateNumber:true } as any }).catch(()=>null),
            ]);

            const allCards = [...(memberCards as any[]), ...(groupCards as any[])];
            const cardNames = allCards.map(c=>c.name || '').filter(Boolean).join('、');
            const cardNos = allCards.map(c=>c.cardNo || '').filter(Boolean).join('、');

            const ownerIds = Array.from(new Set((memberCards as any[]).map(c=> Number((c as any)?.ownerMemberId||0)).filter(Boolean)));
            const owners:any[] = ownerIds.length ? await this.prisma.member.findMany({ where: { id: { in: ownerIds } }, select: { id:true, phone:true } as any }).catch(()=>[]) : [];
            const orderTail = this.last4((orderMember as any)?.phone);
            const otherOwnerTails = Array.from(new Set(owners.map(o=> this.last4(o?.phone)).filter(t=>!!t && t !== orderTail)));
            const otherHint = otherOwnerTails.length ? `（含他人卡：${otherOwnerTails.map(t=>`****${t}`).join('、')}）` : '';

            // 1) 下单人站内通知：支付成功（保留 WASH_CARD_PAY_DEDUCT）
            await this.notifier.sendByTemplate(
                'WASH_CARD_PAY_DEDUCT',
                { no: ord?.no, times, cardName: cardNames, cardNo: cardNos, amount: amountStr, otherOwners: otherOwnerTails.map(t=>`****${t}`).join('、') },
                { kind:'MEMBER', memberId: Number(ord?.memberId||0) },
                { title:'订单已使用洗车卡支付', content:`订单 ${ord?.no||''} 使用洗车卡划扣 ${times} 次，抵扣￥${amountStr}${otherHint}` },
                `/pages/order/detail?id=${ord?.id||0}`
            );

            // 2) 卡主站内通知（仅会员卡）
            try{
                const byText = orderTail ? `****${orderTail}` : '-';
                const usedByCardId = new Map<number, number>();
                for (const p of plan.filter(p=>p.type==='MEMBER')) {
                    usedByCardId.set(p.cardId, (usedByCardId.get(p.cardId)||0) + Math.max(0, Number(p.used||0)));
                }
                for (const c of (memberCards as any[])) {
                    const used = usedByCardId.get(Number(c.id||0)) || 0;
                    if (!used) continue;
                    const ownerId = Number(c.ownerMemberId||0);
                    if (!ownerId) continue;
                    // 自己用自己卡：不发“洗车卡被使用”站内通知
                    if (Number(ownerId) === Number(ord?.memberId||0)) continue;
                    const cardNoTail = this.last4(c.cardNo);
                    const plate = String((vehicle as any)?.plateNumber || '').trim();
                    const plateText = plate ? `车辆${plate}` : '';
                    const midText = [plateText, `订单${ord?.no||''}`].filter(Boolean).join('，');
                    await this.notifier.sendByTemplate(
                        'WASH_CARD_DEDUCT',
                        { cardName: c.name, cardNo: c.cardNo, times: used, reason: `服务划扣（被${byText}使用）`, orderNo: ord?.no, plateNumber: plate || '', usedBy: byText },
                        { kind:'MEMBER', memberId: ownerId },
                        { title:'洗车卡被使用', content:`您的洗车卡（${cardNoTail?`****${cardNoTail}`:'-'}）被${byText}使用，${midText}划扣${used}次。` },
                        `/pages/washcard/detail?id=${Number(c.id||0)}`
                    );
                }
            }catch{}

            // 3) 订阅消息：仅发给“会员卡卡主”；集团卡不发
            try{
                const project = await this.buildWashProject(orderId, ord?.no || null);
                const memberPlan = plan.filter(p=>p.type==='MEMBER');
                const byOwner = new Map<number, { cardIds: number[]; times: number }>();
                for (const p of memberPlan) {
                    const card = (memberCards as any[]).find(x=> Number(x.id||0)===Number(p.cardId||0));
                    const ownerId = Number(card?.ownerMemberId||0);
                    if (!ownerId) continue;
                    const cur = byOwner.get(ownerId) || { cardIds: [], times: 0 };
                    cur.times += Math.max(0, Number(p.used||0));
                    cur.cardIds.push(Number(p.cardId||0));
                    byOwner.set(ownerId, cur);
                }
                for (const [ownerId, info] of byOwner.entries()) {
                    const uniqCardIds = Array.from(new Set(info.cardIds.filter(Boolean)));
                    let remainingText = '多卡';
                    let expiryAtText: string | null = null;
                    const pageVars: any = {};
                    if (uniqCardIds.length === 1) {
                        const c:any = (memberCards as any[]).find(x=> Number(x.id||0)===uniqCardIds[0]);
                        if (c) {
                            remainingText = `${Math.max(0, Number(c.remainingTimes||0))}次`;
                            expiryAtText = this.formatYmd(c.expiryAt) || null;
                            pageVars.cardId = Number(c.id||0);
                        }
                    }
                    await this.notifier.sendWxappWashCardConsume({
                        memberId: Number(ownerId||0),
                        typeKey: 'WASH_CARD_CONSUME',
                        project,
                        timesText: `${Math.max(0, Number(info.times||0))}次`,
                        consumeAt: new Date(),
                        expiryAtText,
                        remainingText,
                        pageVars,
                    } as any);
                }
            }catch{}

        }catch{}

        return res;
    }

    // 获取会员微信openid
    async getMemberOpenId(memberId: number): Promise<string | null> {
        const m = await this.prisma.member.findUnique({ where: { id: memberId }, select: { weixinOpenId: true } });
        return m?.weixinOpenId ?? null;
    }

    // 微信 JSAPI 预支付下单：返回 wx.requestPayment 所需参数
    async createWechatJsapiPayment(orderId: number, memberId: number) {
        const order: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order || order.memberId !== memberId) throw new BadRequestException('订单不存在或不属于当前用户');
        if (order.payStatus !== 'UNPAID') throw new BadRequestException('订单非待支付状态');
        // 先服务后付：服务未完成前不允许拉起支付
        if (String(order.type||'').toUpperCase() === 'SERVICE' && order.payAfterService === true) {
            const fs = String(order.fulfillmentStatus||'').toUpperCase();
            if (fs !== 'DONE') throw new BadRequestException('服务尚未完成，完成后请支付');
        }
        
        // 若已过期，阻止拉起支付
        try {
            const expireAt = (order as any).paymentExpireAt ? new Date((order as any).paymentExpireAt) : null;
            if (expireAt && expireAt.getTime() <= Date.now()) throw new BadRequestException('订单已超时，请重新下单');
        } catch { }
        
        // 获取 openid
        const openid = await this.getMemberOpenId(memberId);
        if (!openid) throw new BadRequestException('当前账号未绑定微信openid，请使用一键登录后重试');
        
        // 禁止 0 元订单唤起 JSAPI
        const amountYuan = Number(order.payAmount);
        if (!Number.isFinite(amountYuan) || amountYuan <= 0) throw new BadRequestException('零元订单不支持微信支付');
        const total = Math.round(amountYuan * 100);
        const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat';
        const desc = `巨科汽车美容(威远店)-订单支付-${order.no}`;
        
        const { prepay_id } = await this.wxpay.createJsapi({
            appid: '', // 由服务内部覆盖为小程序 appid
            mchid: '', // 由服务内部覆盖为商户号
            description: desc,
            out_trade_no: order.no,
            notify_url: notifyUrl || 'https://example.com/orders/_notify/wechat',
            amount: { total },
            payer: { openid },
            attach: JSON.stringify({ orderId: order.id })
        } as any);
        
        const clientParams = this.wxpay.buildJsapiClientPayParams(prepay_id);
        return { ...clientParams };
    }

    // 处理微信支付回调
    async handleWechatPaymentNotify(body: any) {
        const resource = body?.resource || {};
        if (!resource?.nonce || !resource?.associated_data || !resource?.ciphertext) {
            throw new BadRequestException('非法通知');
        }
        
        const decrypted = this.wxpay.decryptNotifyResource(resource.nonce, resource.associated_data, resource.ciphertext);
        
        // 处理状态
        if (decrypted?.trade_state === 'SUCCESS') {
            const outTradeNo = decrypted?.out_trade_no;
            const transactionId = decrypted?.transaction_id;
            const order = await this.prisma.order.findFirst({ where: { no: outTradeNo } });
            
            if (order && order.payStatus === 'UNPAID') {
                await this.markPaid({
                    orderId: order.id,
                    method: 'WECHAT_JSAPI' as any,
                    paidAt: new Date(),
                    wechatTransactionId: transactionId
                });
            }
            
            // 若已标记过支付，但缺少交易单号，则补写入（容错）
            if (order && order.payStatus !== 'UNPAID' && transactionId && !(order as any).wechatTransactionId) {
                await this.saveWechatTransactionId(order.id, transactionId);
            }
        }
        
        return { code: 'SUCCESS' };
    }

    // 管理后台：微信付款码支付（V2 micropay 流程）
    async wechatMicropay(params: {
        orderId: number;
        authCode: string;
        deviceInfo?: string;
        ip: string;
        operatorUserId?: number | null;
    }) {
        const { orderId, authCode, deviceInfo, ip, operatorUserId } = params;
        
        const order: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new BadRequestException('订单不存在');
        if (order.payStatus !== 'UNPAID') throw new BadRequestException('仅未支付订单可发起付款码支付');
        
        const totalFen = Math.round(Number(order.payAmount) * 100);
        if (totalFen <= 0) throw new BadRequestException('零元订单不支持微信支付');
        
        const desc = `巨科汽车美容(威远店)-订单支付-${order.no}`;
        if (!authCode) throw new BadRequestException('缺少付款码');
        
        // 发起 V2 付款码支付：内含轮询查询与必要时撤销
        const flow = await this.wxpay.micropayFlow({
            outTradeNo: order.no,
            totalFeeFen: totalFen,
            body: desc,
            authCode: authCode,
            spbillCreateIp: ip,
            attach: JSON.stringify({ orderId: order.id }),
            deviceInfo: deviceInfo || 'WEB_ADMIN',
        });
        
        if (flow.status === 'SUCCESS') {
            await this.markPaid({
                orderId: order.id,
                method: 'WECHAT_MICROPAY' as any,
                paidAt: new Date(),
                operatorUserId,
                wechatTransactionId: flow.transactionId || undefined
            });
            
            try {
                await this.writeTimeline({
                    orderId: order.id,
                    event: 'NOTE',
                    value: 'WECHAT_MICROPAY',
                    remark: `交易成功；银行：${flow.bankType || '-'}；完成时间：${flow.timeEnd || '-'}`,
                    operatorUserId
                });
            } catch { }
            
            return { ok: true, trade_state: 'SUCCESS', transaction_id: flow.transactionId };
        }
        
        if (flow.status === 'REVERSED') {
            try {
                await this.writeTimeline({
                    orderId: order.id,
                    event: 'PAY_STATUS',
                    value: 'CANCELLED',
                    remark: '付款码支付未确定，已撤销',
                    operatorUserId
                });
            } catch { }
            throw new BadRequestException(`付款未完成，已撤销：${flow.errCodeDes || flow.errCode || 'UNKNOWN'}`);
        }
        
        throw new BadRequestException(`付款失败：${flow.errCodeDes || flow.errCode || 'UNKNOWN'}`);
    }

    // 支付（手动确认）：现金/收钱吧/线下
    async markPaid(params: {
        orderId: number;
        method: PayMethod;
        paidAt?: Date | null;
        operatorUserId?: number | null;
        wechatTransactionId?: string | null;
    }) {
        // 仅未支付订单可标记
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: params.orderId } });
        if (order.payStatus !== 'UNPAID') throw new Error('仅未支付订单可标记支付');
        
        const paidAt = params.paidAt ?? new Date();
        
        // 防并发：仅当仍为 UNPAID 时才更新为 PAID，避免多通道/多回调重复入账
        const upd = await this.prisma.order.updateMany({
            where: { id: order.id, payStatus: 'UNPAID' },
            data: {
                payStatus: 'PAID',
                status: 'PAID',
                payMethod: params.method,
                paidAt,
                wechatTransactionId: params.wechatTransactionId ?? undefined
            }
        });
        
        if (!upd || (upd as any).count === 0) {
            // 已有其他并发流程完成了标记支付，这里不再重复入账；仅补写交易单号（若需要）
            try {
                if (params.wechatTransactionId) {
                    await this.saveWechatTransactionId(order.id, params.wechatTransactionId);
                }
            } catch { }
            return await this.prisma.order.findUnique({ where: { id: order.id } });
        }
        
        const updated: any = await this.prisma.order.findUnique({ where: { id: order.id } });
        await this.writeTimeline({ orderId: order.id, event: 'PAY_STATUS', value: 'PAID', operatorUserId: params.operatorUserId ?? null });
        await this.writeTimeline({ orderId: order.id, event: 'ORDER_STATUS', value: 'PAID', operatorUserId: params.operatorUserId ?? null });

		// 行程订单：主单支付后开始派单；补款单支付后完成行程。全部使用条件更新保证回调幂等。
		if (updated?.type === 'RIDE') {
			await this.handleRidePayment(updated.id);
		}

        // 通知：订单支付成功（会员）
        try{
            const title = `订单已支付`; const content = `您的订单 ${updated?.no||''} 支付成功。`;
            const amount = Number(updated?.payAmount || 0).toFixed(2);
            const paidAtStr = (()=>{ try{ const d = updated?.paidAt ? new Date(updated.paidAt as any) : new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; }catch{return '';} })();
            await this.notifier.sendByTemplate('ORDER_PAID', { no: updated?.no, id: updated?.id, amount, paidAt: paidAtStr }, { kind: 'MEMBER', memberId: Number(updated?.memberId||0) }, { title, content }, `/pages/order/detail?id=${updated?.id||0}`);
        }catch{}
        
        // 集团充值场景：FK + 挂载 groupId -> 入账集团余额并跳过个人奖励/卡发放
        const isGroupRecharge = updated && updated.type === 'FK' && !!updated.groupId;
		const isRide = updated && updated.type === 'RIDE';
        if (isGroupRecharge) {
            try {
                await this.creditGroupRechargeBalance({
                    orderId: updated.id,
                    groupId: Number(updated.groupId),
                    amount: Number(updated.payAmount || 0),
                    operatorUserId: params.operatorUserId ?? null,
                });
                // 记录集团充值入账成功
                await this.writeTimeline({ orderId: order.id, event: 'NOTE', value: 'GROUP_RECHARGE_CREDIT', remark: `金额：${updated.payAmount}`, operatorUserId: params.operatorUserId ?? null });
                // 付款订单：支付成功即视为完成
                try {
                    await this.prisma.order.update({ where: { id: updated.id }, data: { status: 'CLOSED' } });
                    await this.writeTimeline({ orderId: order.id, event: 'ORDER_STATUS', value: 'CLOSED', operatorUserId: params.operatorUserId ?? null });
                } catch { }
                // JSAPI：按虚拟发货上报微信发货信息（logistics_type=3，item_desc 使用付款说明）
                try {
                    if ((params as any)?.method === 'WECHAT_JSAPI' && this.wxship) {
                        await this.wxship.uploadShippingInfo({ orderId: order.id, logisticsType: 3 });
                    }
                } catch { }
            } catch { }
        } else if (!isRide) {
            // 游客订单：累计支付金额仍需入账；但不发成长/积分，也不发放虚拟卡
            const isGuest = !!(updated as any)?.isGuestOrder;
            try {
                if (isGuest) {
                    try {
                        const amt = Math.max(0, Number((updated as any)?.payAmount || 0));
                        if (amt > 0) {
                            await this.prisma.member.update({ where: { id: (updated as any).memberId }, data: { totalPaidAmount: { increment: amt as any } } as any });
                        }
                    } catch { }
                } else if (this.rewards) {
                    await this.rewards.grantRewardsForPayment(order.id);
                    await this.rewards.grantWashCardsForPayment(order.id);
                }
            } catch { }
        }
        
        // 注意：库存已在"下单"阶段预占，此处不再扣减库存，避免重复扣减
        // 若为商品订单（SP）且所有订单项均为虚拟卡券商品，则发放完成后直接将订单置为已完成，并记录时间线
        if (order.type === 'SP') {
            const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
            const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
            if (productIds.length > 0) {
                const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
                const idToType = new Map(products.map(p => [p.id, p.type] as const));
                const allVirtual = items.every(it => (it.productId ? idToType.get(it.productId) === 'VIRTUAL_CARD' : false));
                if (allVirtual) {
                    const closed = await this.prisma.order.update({ where: { id: order.id }, data: { status: 'CLOSED', fulfillmentStatus: 'RECEIVED' as any } });
                    try {
                        await this.writeTimeline({ orderId: order.id, event: 'FULFILLMENT', value: 'RECEIVED', operatorUserId: params.operatorUserId ?? null });
                        await this.writeTimeline({ orderId: order.id, event: 'ORDER_STATUS', value: 'CLOSED', operatorUserId: params.operatorUserId ?? null });
                        await this.writeTimeline({ orderId: order.id, event: 'NOTE', value: 'VIRTUAL_CARD_ISSUED', remark: 'SYS_AUTO', operatorUserId: params.operatorUserId ?? null });
                        // JSAPI虚拟商品订单：卡券发放后按要求上报发货信息（logistics_type=3）
                        try {
                            if ((params as any)?.method === 'WECHAT_JSAPI' && this.wxship) {
                                await this.wxship.uploadShippingInfo({ orderId: order.id, logisticsType: 3 });
                            }
                        } catch { }
                    } catch { }
                    return closed;
                }
            }
        }
        
        // 若为服务订单：仅当服务已完成（队列 COMPLETED 或订单履约 DONE）时才自动从队列移除
        try {
            if (updated && (updated as any).type === 'SERVICE') {
                const it = await this.prisma.serviceQueueItem.findFirst({ where: { orderId: updated.id } } as any);
                const fulfillDone = String((updated as any)?.fulfillmentStatus || '').toUpperCase() === 'DONE';
                const queueCompleted = !!it && (String((it as any)?.status||'').toUpperCase() === 'COMPLETED' || !!(it as any)?.finishedAt);
                if (it && (fulfillDone || queueCompleted)) {
                    await this.prisma.$transaction(async (tx) => {
                        await tx.serviceTask.deleteMany({ where: { queueItemId: it.id } });
                        await tx.serviceQueueItem.delete({ where: { id: it.id } });
                    });
                }
            }
        } catch { }
        return updated;
    }

	private async handleRidePayment(orderId: number) {
		const supplementTrip = await this.prisma.rideTrip.findUnique({ where: { supplementOrderId: orderId }, include: { order: true } });
		if (supplementTrip) {
			const moved = await this.prisma.rideTrip.updateMany({
				where: { id: supplementTrip.id, status: 'SUPPLEMENT_PENDING' },
				data: { status: 'COMPLETED', completedAt: new Date(), version: { increment: 1 } },
			});
			if (!moved.count) return;
			await this.prisma.order.update({ where: { id: supplementTrip.orderId }, data: { status: 'FULFILLED', fulfillmentStatus: 'DONE' } });
			await this.prisma.orderTimeline.createMany({ data: [
				{ orderId: supplementTrip.orderId, event: 'RIDE_STATUS', value: 'COMPLETED', remark: '补款支付成功' },
				{ orderId: supplementTrip.orderId, event: 'FULFILLMENT', value: 'DONE' },
			] });
			if (supplementTrip.driverMemberId) {
				const profile = await this.prisma.rideDriverProfile.findUnique({ where: { memberId: supplementTrip.driverMemberId } });
				if (profile?.busyReason === 'ORDER') {
					const next = profile.previousManualStatus === 'BUSY' ? 'BUSY' : 'AVAILABLE';
					await this.prisma.rideDriverProfile.update({ where: { id: profile.id }, data: { availabilityStatus: next, busyReason: next === 'BUSY' ? 'MANUAL' : null } });
				}
			}
			const event = { type: 'ride:status', data: { id: supplementTrip.id, status: 'COMPLETED' } };
			this.gateway.broadcastToMember(supplementTrip.passengerMemberId, event);
			if (supplementTrip.driverMemberId) this.gateway.broadcastToMember(supplementTrip.driverMemberId, event);
			this.gateway.broadcastToAllAdmins(event);
			return;
		}

		const trip = await this.prisma.rideTrip.findUnique({ where: { orderId } });
		if (!trip) return;
		const setting = await this.prisma.rideSetting.findUnique({ where: { id: 1 } });
		const timeoutSeconds = Number(setting?.dispatchTimeoutSeconds || 90);
		const moved = await this.prisma.rideTrip.updateMany({
			where: { id: trip.id, status: 'PREPAY_PENDING' },
			data: { status: 'DISPATCHING', dispatchExpireAt: new Date(Date.now() + timeoutSeconds * 1000), version: { increment: 1 } },
		});
		if (!moved.count) return;
		await this.prisma.orderTimeline.create({ data: { orderId, event: 'RIDE_STATUS', value: 'DISPATCHING', remark: `派单超时${timeoutSeconds}秒` } });
		const intervalSeconds = Math.max(5, Number(setting?.locationIntervalSeconds || 5));
		const drivers = await this.prisma.rideDriverProfile.findMany({
			where: {
				availabilityStatus: 'AVAILABLE',
				lastLocationAt: { gte: new Date(Date.now() - intervalSeconds * 1000) },
				longitude: { not: null }, latitude: { not: null },
				employee: { enabled: true }, currentVehicle: { is: { enabled: true } },
			},
		});
		const radius = Number(setting?.dispatchRadiusMeters || 3000);
		const targets = drivers.filter((driver) => this.rideDistance(
			Number(trip.originLatitude), Number(trip.originLongitude), Number(driver.latitude), Number(driver.longitude),
		) <= radius);
		const event = { type: 'ride:dispatch:new', data: { id: trip.id, orderId, status: 'DISPATCHING' } };
		for (const driver of targets) this.gateway.broadcastToMember(driver.memberId, event);
		this.gateway.broadcastToMember(trip.passengerMemberId, { type: 'ride:status', data: event.data });
		this.gateway.broadcastToAllAdmins({ type: 'ride:status', data: event.data });
	}

	private rideDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
		const rad = (value: number) => (value * Math.PI) / 180;
		const dLat = rad(lat2 - lat1);
		const dLng = rad(lng2 - lng1);
		const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
		return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}

    // 容错：单独补写微信交易单号
    async saveWechatTransactionId(orderId: number, transactionId: string) {
        if (!transactionId) return;
        await this.prisma.order.update({ where: { id: orderId }, data: { wechatTransactionId: transactionId } });
    }

    // ============ 集团充值入账 ============
    private async creditGroupRechargeBalance(params: { orderId: number; groupId: number; amount: number; operatorUserId?: number | null }) {
        const { orderId, groupId, amount, operatorUserId } = params;
        if (!Number.isFinite(amount) || amount <= 0) return;
        await this.prisma.$transaction(async (tx) => {
            const acc = await tx.groupBalanceAccount.findUnique({ where: { groupId } });
            if (!acc) {
                await tx.groupBalanceAccount.create({ data: { groupId, balance: 0 as any, version: 0 } });
            }
            const current = await tx.groupBalanceAccount.findUnique({ where: { groupId } });
            const before = Number(current?.balance || 0);
            const version = current?.version ?? 0;
            const upd = await tx.groupBalanceAccount.updateMany({ where: { groupId, version }, data: { balance: (before + amount) as any, version: { increment: 1 } as any } as any });
            if (!upd || (upd as any).count === 0) {
                // 乐观锁失败则抛错交由上层忽略（不影响支付成功），后续可通过对账修复
                throw new Error('Group balance concurrent update failed');
            }
            // 获取订单号用于流水关联
            let ordNo: string | null = null;
            try { const ord:any = await tx.order.findUnique({ where: { id: orderId }, select: { no: true } }); ordNo = ord?.no || null; } catch {}
            await tx.groupBalanceLedger.create({ data: ({ groupId, type: 'RECHARGE' as any, amount: amount as any, orderId, orderNo: ordNo, operatorUserId: operatorUserId ?? null, note: '订单支付入账（集团充值）' } as any) });
        });
    }
}
