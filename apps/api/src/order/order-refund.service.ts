import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, PayMethod, RefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { WxpayService } from './wxpay.service.js';
import { OrderRewardsService } from './order-rewards.service.js';

@Injectable()
export class OrderRefundService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly wxpay: WxpayService,
        private readonly rewards?: OrderRewardsService
    ) {}

    private async writeTimeline(params: { tx?: any; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }) {
        try {
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        } catch {/* ignore timeline errors */ }
    }

    // ============ 集团充值退款：扣减集团余额（幂等，部分退款可多次调用） ============
    private async adjustGroupBalanceForRefund(params: { orderId: number; outRefundNo?: string | null; operatorUserId?: number | null }) {
        const { orderId, outRefundNo, operatorUserId } = params;
        const ord: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!ord || ord.type !== 'FK' || !ord.groupId) return; // 非集团充值订单跳过
        await this.prisma.$transaction(async (tx) => {
            const fresh = await tx.order.findUnique({ where: { id: orderId } });
            if (!fresh || fresh.type !== 'FK' || !fresh.groupId) return;
            const groupId = Number(fresh.groupId);
            const refunded = Number(fresh.refundedAmount || 0);
            if (!(refunded > 0)) return;
            // 已记账的退款累计（负数存储，取绝对值求和）
            const agg = await tx.groupBalanceLedger.aggregate({
                where: { groupId, orderId: orderId, type: 'REFUND' as any },
                _sum: { amount: true }
            });
            const appliedAbs = Math.abs(Number(agg?._sum?.amount || 0));
            const delta = Math.max(0, refunded - appliedAbs);
            if (delta <= 0) return; // 幂等：无差额则不处理

            // 确保账户存在
            const acc = await tx.groupBalanceAccount.findUnique({ where: { groupId } });
            if (!acc) {
                await tx.groupBalanceAccount.create({ data: { groupId, balance: 0 as any, version: 0 } });
            }
            const current = await tx.groupBalanceAccount.findUnique({ where: { groupId } });
            const before = Number(current?.balance || 0);
            const version = current?.version ?? 0;
            const upd = await tx.groupBalanceAccount.updateMany({ where: { groupId, version }, data: { balance: (before - delta) as any, version: { increment: 1 } as any } as any });
            if (!upd || (upd as any).count === 0) {
                throw new Error('Group balance concurrent update failed (refund)');
            }
            await tx.groupBalanceLedger.create({
                data: {
                    groupId,
                    type: 'REFUND' as any,
                    amount: (-delta) as any,
                    orderId: orderId,
                    operatorUserId: operatorUserId ?? null,
                    note: outRefundNo ? `渠道退款出账（${outRefundNo}）` : '退款出账'
                }
            });
            try { await this.writeTimeline({ tx, orderId, event: 'NOTE', value: 'GROUP_RECHARGE_REFUND_DEBIT', remark: `金额：${delta.toFixed(2)}`, operatorUserId: operatorUserId ?? null }); } catch {}
        });
    }

    // 验证退款是否允许
    async verifyRefundAllowed(orderId: number, amountYuan?: number | null) {
        if (this.rewards) {
            return await this.rewards.verifyRefundAllowed(orderId, amountYuan);
        }
        return true;
    }

    // 应用退款成功的业务逻辑
    async applyRefundSuccess(params: {
        orderId: number;
        amountYuan: number;
        method?: PayMethod | null;
        operatorUserId?: number | null;
        outRefundNo?: string | null;
        wechatRefundId?: string | null;
    }) {
        const { orderId, amountYuan, operatorUserId } = params;
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        const payAmountYuan = Number(order.payAmount);
        const currentRefundedYuan = Number(order.refundedAmount || 0);
        const nextRefundedYuan = Math.min(payAmountYuan, currentRefundedYuan + Number(amountYuan || 0));
        const isAllRefunded = Math.abs(payAmountYuan - nextRefundedYuan) < 0.000001;

        if (isAllRefunded) {
            // 全额退款达成（可能由多次部分退款累计触达）：回滚库存、更新订单状态、回退权益
            const updated = await this.refundOrder(orderId, '渠道退款成功', operatorUserId ?? null);
            
            if (this.rewards) {
                await this.rewards.rollbackWashCardForRefund(orderId, operatorUserId ?? null, {
                    outRefundNo: params.outRefundNo ?? null,
                    wechatRefundId: params.wechatRefundId ?? null
                });
                await this.rewards.rollbackPointsForRefund(orderId, operatorUserId ?? null);
                try { await this.rewards.deductPointsForRefund(orderId, operatorUserId ?? null, { finalizeAll: true }); } catch { }
            }
            
            // 先将累计退款额置为全额，再进行成长值累计扣减计算
            await this.prisma.order.update({ where: { id: orderId }, data: { refundedAmount: order.payAmount } });

            // 集团充值退款：同步扣减集团余额（幂等）
            try { await this.adjustGroupBalanceForRefund({ orderId, outRefundNo: params.outRefundNo || null, operatorUserId: operatorUserId ?? null }); } catch { }
            
            // 成长值扣减（累计口径，避免多次部分退款的取整误差）：finalizeAll=true 按剩余一次扣完
            if (this.rewards) {
                try { await this.rewards.deductGrowthForRefund(orderId, Number(amountYuan || 0), operatorUserId ?? null, { finalizeAll: true }); } catch { }
            }
            
            return updated;
        }
        
        // 非全额：部分退款累计并记录时间线
        await this.prisma.order.update({ where: { id: orderId }, data: { refundedAmount: new Prisma.Decimal(nextRefundedYuan as any) } });
        // 集团充值退款（部分）：按差额扣减集团余额（幂等）
        try { await this.adjustGroupBalanceForRefund({ orderId, outRefundNo: params.outRefundNo || null, operatorUserId: operatorUserId ?? null }); } catch { }
        await this.writeTimeline({ orderId, event: 'PAY_STATUS', value: 'PARTIAL_REFUND', remark: `¥${amountYuan.toFixed(2)}`, operatorUserId: operatorUserId ?? null });
        
        // 成长值扣减（部分退款）
        if (this.rewards) {
            try { await this.rewards.deductGrowthForRefund(orderId, Number(amountYuan || 0), operatorUserId ?? null); } catch { }
            try { await this.rewards.deductPointsForRefund(orderId, operatorUserId ?? null); } catch { }
        }
        
        return order;
    }

    // 内部退款（非渠道）统一收尾：执行退款、回收权益（洗车卡、积分）
    async finalizeInternalRefund(orderId: number, reason?: string, operatorUserId?: number | null) {
        const updated = await this.refundOrder(orderId, reason, operatorUserId ?? null);
        
        if (this.rewards) {
            try { await this.rewards.rollbackWashCardForRefund(orderId, operatorUserId ?? null); } catch { }
            try { await this.rewards.rollbackPointsForRefund(orderId, operatorUserId ?? null); } catch { }
            // 扣减因支付发放的积分：内部退款同样需要按该订单入账的 PAY 积分进行等额/等比扣减
            try { await this.rewards.deductPointsForRefund(orderId, operatorUserId ?? null, { finalizeAll: true }); } catch { }
            // 成长值扣减：内部全额退款
            try { await this.rewards.deductGrowthForRefund(orderId, Number((updated as any)?.payAmount || 0), operatorUserId ?? null); } catch { }
        }
        
        // 内部退款：若为集团充值单，同步扣减集团余额（幂等）
        try { await this.adjustGroupBalanceForRefund({ orderId, outRefundNo: null, operatorUserId: operatorUserId ?? null }); } catch { }
        return updated;
    }

    // 退款：仅已支付订单可退款，回仓并标记为 REFUNDED + CANCELLED
    async refundOrder(id: number, reason?: string, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可退款');
        
        // 创建/补充 RefundRecord（内部退款，默认全额，部分退款调用方应传渠道接口）
        try {
            const pm = String(order.payMethod || '').toUpperCase();
            if (pm !== 'WECHAT_JSAPI' && pm !== 'WECHAT_MICROPAY') {
                await this.createRefundRecord({
                    orderId: id,
                    memberId: order.memberId,
                    amount: order.payAmount as any,
                    method: order.payMethod ?? null,
                    reasonCode: 'INTERNAL',
                    reasonText: reason || null,
                    status: 'SUCCESS' as any
                });
            }
        } catch { }
        
        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!product || (product.type !== 'PHYSICAL' && product.type !== 'VIRTUAL_CARD')) continue;
            
            if (product.specType === 'MULTI') {
                if (!it.skuId) {
                    // 兜底：缺失 skuId 时回补到商品总库存并写异常备注
                    const before = product.stockQuantity ?? 0;
                    const change = Math.abs(it.quantity);
                    const after = before + change;
                    await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                    await this.prisma.inventoryLog.create({
                        data: {
                            productId: product.id,
                            skuId: null,
                            change,
                            beforeStock: before,
                            afterStock: after,
                            reason: 'REFUND_RETURN' as any,
                            remark: `退款回仓（缺少SKU，订单号：${order.no}）`,
                            operatorUserId: operatorUserId ?? null
                        }
                    });
                    continue;
                }
                const sku = await this.prisma.productSku.findUniqueOrThrow({ where: { id: it.skuId } });
                const before = sku.stockQuantity;
                const change = Math.abs(it.quantity);
                const after = before + change;
                await this.prisma.productSku.update({ where: { id: sku.id }, data: { stockQuantity: after } });
                await this.prisma.inventoryLog.create({
                    data: {
                        productId: product.id,
                        skuId: sku.id,
                        change,
                        beforeStock: before,
                        afterStock: after,
                        reason: 'REFUND_RETURN' as any,
                        remark: `退款回仓（订单号：${order.no}）`,
                        operatorUserId: operatorUserId ?? null,
                    },
                });
            } else {
                const before = product.stockQuantity ?? 0;
                const change = Math.abs(it.quantity);
                const after = before + change;
                await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                await this.prisma.inventoryLog.create({
                    data: {
                        productId: product.id,
                        skuId: null,
                        change,
                        beforeStock: before,
                        afterStock: after,
                        reason: 'REFUND_RETURN' as any,
                        remark: `退款回仓（订单号：${order.no}）`,
                        operatorUserId: operatorUserId ?? null,
                    },
                });
            }
        }
        
        const updated = await this.prisma.order.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                payStatus: 'REFUNDED',
                refundedAmount: order.payAmount,
                remark: reason ?? undefined
            }
        });
        
        try {
            await this.writeTimeline({ orderId: id, event: 'PAY_STATUS', value: 'REFUNDED', remark: reason || undefined, operatorUserId: operatorUserId ?? null });
            await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'CANCELLED', remark: reason || undefined, operatorUserId: operatorUserId ?? null });
        } catch { }
        
        return updated;
    }

    // 微信退款：统一入口（JSAPI 走 v3，付款码走 v2）
    async createWechatRefund(params: {
        orderId: number;
        reason?: string;
        amount?: number;
        operatorUserId?: number | null;
    }) {
        const { orderId, reason, amount, operatorUserId } = params;
        const order: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        
        if (!order || order.payStatus !== 'PAID') throw new BadRequestException('仅已支付订单可退款');
        
        if (order.payMethod === 'WECHAT_JSAPI') {
            return await this.createJsapiRefund({ orderId, reason, amount, operatorUserId });
        }
        
        // 非 JSAPI：走通用退款逻辑（内部或 v2 付款码）
        return await this.createGenericRefund({ orderId, reason, amount, operatorUserId });
    }

    // JSAPI 退款
    private async createJsapiRefund(params: {
        orderId: number;
        reason?: string;
        amount?: number;
        operatorUserId?: number | null;
    }) {
        const { orderId, reason, amount, operatorUserId } = params;
        const order: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        
        // 幂等校验（窗口 60s）
        try {
            const amtYuan = (amount == null) ? Number(order.payAmount || 0) : Number(amount || 0);
            if (amtYuan > 0) {
                const recent = await this.findRecentRefundRecord({
                    orderId: order.id,
                    amountYuan: amtYuan,
                    windowMs: 60_000
                });
                if (recent) {
                    return { ok: true, outRefundNo: recent.outRefundNo || undefined } as any;
                }
            }
        } catch { }
        
        const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund';
        const outRefundNo = `R_${order.no}_${Date.now()}`;
        const amountFen = Math.round(Number(order.payAmount) * 100);
        const requestedFen = Math.round(Number(amount ?? order.payAmount) * 100);
        const isFullRequest = amount == null || Math.abs(Number(amount) - Number(order.payAmount)) < 0.000001;
        
        if (requestedFen < 1) throw new BadRequestException('退款金额必须≥0.01元');
        
        // 累计部分退款上限校验（SUCCESS 之和应 ≤ 实付）
        const existing: any = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { refundRecords: true }
        });
        const successSumFen = Math.round(((existing?.refundRecords || [])
            .filter((r: any) => r.status === 'SUCCESS')
            .reduce((s: number, r: any) => s + Number(r.amount || 0), 0)) * 100);
        const refundableFen = Math.max(0, amountFen - successSumFen);
        const refundFen = Math.min(requestedFen, refundableFen);
        
        if (isFullRequest && successSumFen > 0) throw new BadRequestException('已发生部分退款，不能再使用全额退款，请输入剩余可退金额');
        if (refundFen <= 0) throw new BadRequestException('累计退款金额已达上限');
        
        // 校验全额退款可行性（如洗车卡剩余次数不足则阻断）
        const allowed = await this.verifyRefundAllowed(order.id, refundFen / 100);
        if (!allowed) throw new BadRequestException('退款校验未通过：关联权益已部分使用，无法全额退款');
        
        await this.createRefundRecord({
            orderId: order.id,
            memberId: order.memberId,
            amount: (refundFen / 100),
            method: 'WECHAT_JSAPI' as any,
            reasonCode: 'WECHAT',
            reasonText: reason || null,
            outRefundNo,
            status: 'PENDING' as any
        });
        
        try {
            const resp = await this.wxpay.createRefund({
                outTradeNo: order.no,
                outRefundNo,
                refundAmountFen: refundFen,
                totalAmountFen: amountFen,
                reason: reason,
                notifyUrl
            });
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, resp?.refund_id || null, null);
            try { await this.saveRefundWechatResp(outRefundNo, resp); } catch { }
            return { ok: true, outRefundNo };
        } catch (e) {
            const msg = (e as any)?.message || String(e);
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, msg);
            return { ok: false, outRefundNo, error: msg } as any;
        }
    }

    // 通用退款（付款码或内部）
    private async createGenericRefund(params: {
        orderId: number;
        reason?: string;
        amount?: number;
        operatorUserId?: number | null;
    }) {
        const { orderId, reason, amount, operatorUserId } = params;
        const order: any = await this.prisma.order.findUnique({ where: { id: orderId } });
        
        // 付款码支付订单（或识别为付款码支付）的退款：走 v2
        if ((order.payMethod === 'WECHAT_MICROPAY' || 
             (!order.payMethod && order.wechatTransactionId) || 
             String(order.remark || '').includes('WECHAT_MICROPAY') || 
             (Array.isArray((order as any).timelines) && (order as any).timelines.some((t: any) => t.value === 'WECHAT_MICROPAY')))) {
            
            const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund-v2';
            const outRefundNo = `R_${order.no}_${Date.now()}`;
            const amountFen = Math.round(Number(order.payAmount) * 100);
            const requestedFen = Math.round(Number(amount ?? order.payAmount) * 100);
            const isFullRequest = amount == null || Math.abs(Number(amount) - Number(order.payAmount)) < 0.000001;
            
            if (requestedFen < 1) throw new BadRequestException('退款金额必须≥0.01元');
            
            const existing: any = await this.prisma.order.findUnique({
                where: { id: orderId },
                include: { refundRecords: true }
            });
            const rr = Array.isArray(existing?.refundRecords) ? existing.refundRecords : [];
            const successSumFen = Math.round(rr.filter((r: any) => r.status === 'SUCCESS')
                .reduce((s: number, r: any) => s + Number(r.amount || 0), 0) * 100);
            const refundableFen = Math.max(0, amountFen - successSumFen);
            const refundFen = Math.min(requestedFen, refundableFen);
            
            if (isFullRequest && successSumFen > 0) throw new BadRequestException('已发生部分退款，不能再使用全额退款，请输入剩余可退金额');
            if (refundFen <= 0) throw new BadRequestException('累计退款金额已达上限');
            
            const allowed = await this.verifyRefundAllowed(order.id, refundFen / 100);
            if (!allowed) throw new BadRequestException('退款校验未通过：关联权益已部分使用，无法全额退款');
            
            await this.createRefundRecord({
                orderId: order.id,
                memberId: order.memberId,
                amount: (refundFen / 100),
                method: 'WECHAT_MICROPAY' as any,
                reasonCode: 'WECHAT_MICROPAY',
                reasonText: reason || null,
                outRefundNo,
                status: 'PENDING' as any
            });
            
            try {
                const resp = await this.wxpay.createRefundV2({
                    outTradeNo: order.no,
                    outRefundNo,
                    totalFeeFen: amountFen,
                    refundFeeFen: refundFen,
                    refundDesc: reason,
                    notifyUrl
                });
                await this.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, resp?.refund_id || undefined, null);
                try { await this.saveRefundWechatResp(outRefundNo, resp); } catch { }
                return { ok: true, outRefundNo } as any;
            } catch (e) {
                const msg = (e as any)?.message || String(e);
                await this.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, msg);
                return { ok: false, outRefundNo, error: msg } as any;
            }
        }
        
        // 线下/其他渠道：内部退款并回收权益
        const updated = await this.finalizeInternalRefund(orderId, reason, operatorUserId);
        try {
            await this.writeTimeline({
                orderId: orderId,
                event: 'PAY_STATUS',
                value: 'REFUNDED',
                remark: reason || undefined,
                operatorUserId: operatorUserId ?? null
            });
        } catch { }
        return updated;
    }

    // 处理微信退款回调
    async handleWechatRefundNotify(body: any) {
        const resource = body?.resource || {};
        if (!resource?.nonce || !resource?.associated_data || !resource?.ciphertext) {
            throw new BadRequestException('非法通知');
        }
        
        const decrypted = this.wxpay.decryptNotifyResource(resource.nonce, resource.associated_data, resource.ciphertext);
        const outRefundNo = decrypted?.out_refund_no;
        const refundId = decrypted?.refund_id;
        const status = decrypted?.refund_status; // SUCCESS, ABNORMAL, CLOSED
        
        if (outRefundNo) {
            if (status === 'SUCCESS') {
                const rec: any = await this.updateRefundStatusByOutRefundNo(outRefundNo, 'SUCCESS' as any, refundId, null);
                if (rec?.orderId) {
                    const amt = Number(rec?.amount || 0);
                    await this.applyRefundSuccess({
                        orderId: rec.orderId,
                        amountYuan: amt,
                        method: 'WECHAT_JSAPI' as any,
                        operatorUserId: undefined,
                        outRefundNo,
                        wechatRefundId: refundId
                    });
                    await this.completeLatestRefundAftersalesByOrder(rec.orderId, undefined);
                }
            } else if (status === 'ABNORMAL') {
                await this.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, refundId, decrypted?.status || 'ABNORMAL');
            } else if (status === 'CLOSED') {
                await this.updateRefundStatusByOutRefundNo(outRefundNo, 'CANCELLED' as any, refundId, 'CLOSED');
            }
        }
        
        return { code: 'SUCCESS' };
    }

    // 处理微信退款回调（v2）
    async handleWechatRefundV2Notify(rawBody: string) {
        // 解析 return_code 与 req_info
        const parsed = this.wxpay['parseXml'] ? (this.wxpay as any)['parseXml'](rawBody) : {};
        if (String(parsed?.return_code || '').toUpperCase() !== 'SUCCESS') {
            return 'SUCCESS';
        }
        
        const reqInfo = String(parsed?.req_info || '');
        if (!reqInfo) {
            return 'SUCCESS';
        }
        
        const dec = (this.wxpay as any).decryptRefundReqInfo(reqInfo) || {};
        const outRefundNo = dec?.out_refund_no || '';
        const refundId = dec?.refund_id || '';
        const refundStatus = String(dec?.refund_status || '').toUpperCase();
        const refundFeeFen = Number(dec?.refund_fee || 0);
        const amountYuan = Math.max(0, Math.round(refundFeeFen) / 100);
        
        if (!outRefundNo) {
            return 'SUCCESS';
        }
        
        if (refundStatus === 'SUCCESS') {
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'SUCCESS' as any, refundId, null);
            const rec: any = await this.getRefundRecordByOutRefundNo(outRefundNo);
            if (rec) {
                const amt = amountYuan || Number(rec.amount || 0);
                await this.applyRefundSuccess({
                    orderId: rec.orderId,
                    amountYuan: amt,
                    method: rec.method as any,
                    operatorUserId: undefined,
                    outRefundNo,
                    wechatRefundId: refundId
                });
                await this.completeLatestRefundAftersalesByOrder(rec.orderId, undefined);
            }
        } else if (refundStatus === 'CHANGE' || refundStatus === 'ABNORMAL') {
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, refundId, refundStatus);
        } else if (refundStatus === 'REFUNDCLOSE' || refundStatus === 'CLOSED') {
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'CANCELLED' as any, refundId, 'CLOSED');
        }
        
        return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
    }

    // 查询退款结果（v2）
    async queryRefundV2(outRefundNo: string) {
        if (!outRefundNo) throw new BadRequestException('缺少 outRefundNo');
        
        const resp = await this.wxpay.queryRefundV2({ outRefundNo });
        const rc = String(resp.return_code || '');
        if (rc !== 'SUCCESS') throw new BadRequestException(`查询失败：${resp.return_msg || 'UNKNOWN'}`);
        
        const rcode = String(resp.result_code || '');
        if (rcode !== 'SUCCESS') throw new BadRequestException(`查询失败：${resp.err_code_des || resp.err_code || 'UNKNOWN'}`);
        
        // 解析退款状态与金额（单位：分）
        const refundStatus = (resp as any).refund_status_0 || (resp as any).refund_status || '';
        const refundFeeFenStr = (resp as any).refund_fee_0 || (resp as any).refund_fee || '0';
        const refundId = (resp as any).refund_id_0 || (resp as any).refund_id || null;
        const refundFeeFen = Number(refundFeeFenStr || 0);
        const amountYuan = Math.max(0, Math.round(refundFeeFen) / 100);
        
        if (String(refundStatus).toUpperCase() === 'SUCCESS') {
            const rec: any = await this.getRefundRecordByOutRefundNo(outRefundNo);
            if (rec) {
                await this.updateRefundStatusByOutRefundNo(outRefundNo, 'SUCCESS' as any, refundId, null);
                // 回写订单维度累计退款，并触发售后收尾
                await this.applyRefundSuccess({
                    orderId: rec.orderId,
                    amountYuan: amountYuan || Number(rec.amount || 0),
                    method: rec.method as any,
                    operatorUserId: undefined,
                    outRefundNo,
                    wechatRefundId: refundId
                });
                await this.completeLatestRefundAftersalesByOrder(rec.orderId, undefined);
            }
            return { ok: true, status: 'SUCCESS', refundId, amount: amountYuan };
        }
        
        if (String(refundStatus).toUpperCase() === 'CLOSED') {
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'CANCELLED' as any, refundId, 'CLOSED_BY_QUERY');
            return { ok: true, status: 'CANCELLED' };
        }
        
        if (String(refundStatus).toUpperCase() === 'ABNORMAL') {
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, refundId, 'ABNORMAL');
            return { ok: true, status: 'FAILED' };
        }
        
        // 其他状态（如 PROCESSING）：标记处理中
        await this.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, refundId, null);
        return { ok: true, status: 'PROCESSING' };
    }

    // 退款重试
    async retryRefund(id: number, operatorUserId?: number | null) {
        const rec: any = await this.getRefundRecordById(id);
        if (!rec) throw new BadRequestException('退款记录不存在');
        if (rec.method !== 'WECHAT_JSAPI') throw new BadRequestException('仅支持微信渠道退款重试');
        if (rec.status === 'SUCCESS') throw new BadRequestException('该退款已成功，无需重试');
        
        const ord: any = rec.order;
        if (!ord || ord.payStatus !== 'PAID') throw new BadRequestException('订单状态不支持重试');
        
        const outRefundNo = rec.outRefundNo || `R_${ord.no}_${Date.now()}`;
        if (!rec.outRefundNo) {
            await this.setRefundOutRefundNo(rec.id, outRefundNo);
        }
        
        const amountFen = Math.round(Number(ord.payAmount) * 100);
        const requestedFen = Math.round(Number(rec.amount) * 100);
        if (requestedFen <= 0) throw new BadRequestException('退款金额必须大于0');
        
        const existing: any = await this.prisma.order.findUnique({
            where: { id: ord.id },
            include: { refundRecords: true }
        });
        const successSumFen = Math.round(((existing?.refundRecords || [])
            .filter((r: any) => r.status === 'SUCCESS')
            .reduce((s: number, r: any) => s + Number(r.amount || 0), 0)) * 100);
        const refundableFen = Math.max(0, amountFen - successSumFen);
        
        if (requestedFen > refundableFen) throw new BadRequestException('可退余额不足，请调整金额后新建退款');
        
        const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund';
        
        try {
            const resp = await this.wxpay.createRefund({
                outTradeNo: ord.no,
                outRefundNo,
                refundAmountFen: requestedFen,
                totalAmountFen: amountFen,
                reason: rec.reasonText || undefined,
                notifyUrl
            });
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, resp?.refund_id || null, null);
            try { await this.saveRefundWechatResp(outRefundNo, resp); } catch { }
            return { ok: true, outRefundNo } as any;
        } catch (e) {
            const msg = (e as any)?.message || String(e);
            await this.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, msg);
            return { ok: false, outRefundNo, error: msg } as any;
        }
    }

    // 幂等：查找近窗口期内相同金额的退款记录（PENDING/PROCESSING）
    async findRecentRefundRecord(params: {
        orderId: number;
        amountYuan: number;
        statuses?: RefundStatus[];
        windowMs?: number;
    }) {
        const { orderId, amountYuan } = params;
        const statuses = (params.statuses && params.statuses.length) ? params.statuses : (['PENDING', 'PROCESSING'] as any);
        const windowMs = Number.isFinite(params.windowMs as any) ? Number(params.windowMs) : 60_000;
        
        const rec = await this.prisma.refundRecord.findFirst({
            where: {
                orderId,
                status: { in: statuses as any },
                amount: new Prisma.Decimal(amountYuan as any)
            },
            orderBy: { id: 'desc' }
        });
        
        if (!rec) return null;
        
        try {
            const createdAt: any = (rec as any).createdAt;
            if (!createdAt) return rec;
            const ts = new Date(createdAt).getTime();
            if (Date.now() - ts <= windowMs) return rec;
            return null;
        } catch {
            return rec;
        }
    }

    async createRefundRecord(params: {
        orderId: number;
        memberId: number;
        amount: Prisma.Decimal | number;
        method?: PayMethod | null;
        reasonCode?: string | null;
        reasonText?: string | null;
        outRefundNo?: string | null;
        wechatRefundId?: string | null;
        status?: RefundStatus;
    }) {
        const rec = await this.prisma.refundRecord.create({
            data: {
                orderId: params.orderId,
                memberId: params.memberId,
                amount: new Prisma.Decimal(params.amount as any),
                method: params.method ?? null,
                reasonCode: params.reasonCode || null,
                reasonText: params.reasonText || null,
                outRefundNo: params.outRefundNo || null,
                wechatRefundId: params.wechatRefundId || null,
                status: (params.status || 'PENDING') as any,
            },
        });
        
        try {
            await this.writeTimeline({
                orderId: params.orderId,
                event: 'PAY_STATUS',
                value: 'REFUND_REQUESTED',
                remark: `¥${Number(params.amount || 0).toFixed(2)}`
            });
        } catch { }
        
        return rec;
    }

    async updateRefundStatusByOutRefundNo(outRefundNo: string, status: RefundStatus, wechatRefundId?: string | null, failedReason?: string | null) {
        const rec = await this.prisma.refundRecord.findFirst({ where: { outRefundNo } });
        if (!rec) return null;
        
        // 幂等：若已是目标状态，直接返回当前记录
        if (rec.status === status) return rec;
        
        return this.prisma.refundRecord.update({
            where: { id: rec.id },
            data: {
                status: status as any,
                wechatRefundId: wechatRefundId || undefined,
                failedReason: failedReason || undefined
            }
        });
    }

    // 完成指定订单的最新退款型售后（用于渠道退款回调）
    async completeLatestRefundAftersalesByOrder(orderId: number, operatorUserId?: number | null) {
        const afr = await this.prisma.afterSalesRequest.findFirst({
            where: { orderId, type: 'REFUND' as any, status: { in: ['PENDING', 'APPROVED'] as any } },
            orderBy: { id: 'desc' }
        });
        if (!afr) return null;
        
        await this.prisma.afterSalesRequest.update({
            where: { id: afr.id },
            data: { status: 'COMPLETED' as any, completedAt: new Date() }
        });
        await this.writeTimeline({
            orderId,
            event: 'AFTERSALES',
            value: 'COMPLETED',
            remark: 'REFUND',
            operatorUserId: operatorUserId ?? null
        });
        return afr.id;
    }

    // 记录微信退款原始响应（用于排障与重试判定）
    async saveRefundWechatResp(outRefundNo: string, resp: any) {
        const rec = await this.prisma.refundRecord.findFirst({ where: { outRefundNo } });
        if (!rec) return null;
        return this.prisma.refundRecord.update({
            where: { id: rec.id },
            data: { wechatResp: resp as any }
        });
    }

    // 查询退款记录
    async getRefundRecordById(id: number) {
        return this.prisma.refundRecord.findUnique({
            where: { id },
            include: { order: true, member: true }
        });
    }

    async getRefundRecordByOutRefundNo(outRefundNo: string) {
        return this.prisma.refundRecord.findFirst({ where: { outRefundNo } });
    }

    // 若退款记录缺少 outRefundNo，设置一个（用于重试）
    async setRefundOutRefundNo(id: number, outRefundNo: string) {
        return this.prisma.refundRecord.update({
            where: { id },
            data: { outRefundNo }
        });
    }
}
