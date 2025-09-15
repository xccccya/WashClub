import { Injectable, BadRequestException } from '@nestjs/common';
import { PayMethod, OrderSettlement } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { WxpayService } from './wxpay.service.js';
import { WechatShippingService } from './wechat-shipping.service.js';
import { OrderRewardsService } from './order-rewards.service.js';
import { WashCardService } from '../member/washcard.service.js';
import { GroupCardService } from '../group/card.service.js';

@Injectable()
export class OrderPaymentService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly wxpay: WxpayService,
        private readonly wxship?: WechatShippingService,
        private readonly rewards?: OrderRewardsService,
        private readonly washcards?: WashCardService,
        private readonly groupCards?: GroupCardService
    ) {}

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
            const opText = (operatorUserId ? `操作人#${operatorUserId}` : '系统');
            const remarkBase = `订单${orderNo}${plate?`/车辆${plate}`:''}，${opText}`;

            // 扣减并写日志（同一事务）
            for (const it of plan) {
                if (it.type === 'MEMBER') {
                    const card = await tx.washCard.findUnique({ where: { id: it.cardId } });
                    if (!card) throw new BadRequestException('洗车卡不存在');
                    if ((card.remainingTimes || 0) < it.used) throw new BadRequestException('洗车卡余次不足');
                    const before = Number(card.remainingTimes || 0);
                    const after = before - it.used;
                    await tx.washCard.update({ where: { id: card.id }, data: { remainingTimes: after } });
                    await tx.washCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'SERVICE_DEDUCT' as any, change: -it.used, beforeRemaining: before, afterRemaining: after, remark: `服务划扣（${remarkBase}）`, operatorUserId: operatorUserId ?? null, serviceOrderId: order.id, vehicleId: order.vehicleId ?? null, memberId: order.memberId } as any });
                } else {
                    const card = await tx.groupWashCard.findUnique({ where: { id: it.cardId } });
                    if (!card) throw new BadRequestException('集团洗车卡不存在');
                    if ((card.remainingTimes || 0) < it.used) throw new BadRequestException('集团洗车卡余次不足');
                    const before = Number(card.remainingTimes || 0);
                    const after = before - it.used;
                    await tx.groupWashCard.update({ where: { id: card.id }, data: { remainingTimes: after } });
                    await tx.groupWashCardLog.create({ data: { cardId: card.id, action: 'DEDUCT' as any, reason: 'SERVICE_DEDUCT' as any, change: -it.used, beforeRemaining: before, afterRemaining: after, remark: `服务划扣（${remarkBase}）`, operatorUserId: operatorUserId ?? null, serviceOrderId: order.id, vehicleId: order.vehicleId ?? null, memberId: order.memberId } as any });
                }
            }

            // 时间线（事务内）
            await this.writeTimeline({ tx, orderId: order.id, event: 'PAY_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ tx, orderId: order.id, event: 'ORDER_STATUS', value: 'PAID', operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ tx, orderId: order.id, event: 'BENEFITS', value: 'WASHCARD_DEDUCT', remark: `划扣次数：${timesNeeded}次`, operatorUserId: operatorUserId ?? null });

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
        
        // 元转分
        const amountYuan = Number(order.payAmount);
        if (!Number.isFinite(amountYuan) || amountYuan <= 0) throw new BadRequestException('订单金额异常');
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
        if (totalFen <= 0) throw new BadRequestException('订单金额异常');
        
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
        
        // 集团充值场景：FK + 挂载 groupId -> 入账集团余额并跳过个人奖励/卡发放
        const isGroupRecharge = updated && updated.type === 'FK' && !!updated.groupId;
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
        } else {
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
            await tx.groupBalanceLedger.create({ data: { groupId, type: 'RECHARGE' as any, amount: amount as any, orderId, operatorUserId: operatorUserId ?? null, note: '订单支付入账（集团充值）' } });
        });
    }
}
