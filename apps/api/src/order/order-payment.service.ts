import { Injectable, BadRequestException } from '@nestjs/common';
import { PayMethod } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { WxpayService } from './wxpay.service.js';
import { WechatShippingService } from './wechat-shipping.service.js';
import { OrderRewardsService } from './order-rewards.service.js';

@Injectable()
export class OrderPaymentService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly wxpay: WxpayService,
        private readonly wxship?: WechatShippingService,
        private readonly rewards?: OrderRewardsService
    ) {}

    private async writeTimeline(params: { tx?: any; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }) {
        try {
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        } catch {/* ignore timeline errors */ }
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
                await this.writeTimeline({ orderId: order.id, event: 'NOTE', value: 'GROUP_RECHARGE_CREDIT', remark: `金额：${updated.payAmount}`, operatorUserId: params.operatorUserId ?? null });
            } catch { }
        } else {
            // 成长：累计支付金额与成长值入账，并尝试按成长值升级会员等级
            try {
                if (this.rewards) {
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
