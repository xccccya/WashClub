import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, AfterSalesStatus, AfterSalesType } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { OrderRefundService } from './order-refund.service.js';
import { WxpayService } from './wxpay.service.js';
import { AssetService } from '../file/asset.service.js';

@Injectable()
export class OrderAfterSalesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly refundService?: OrderRefundService,
        private readonly wxpay?: WxpayService,
        private readonly assets?: AssetService
    ) {}

    private syncBindings!: (tableName: string, rowId: string, fieldName: string, urls: string[]) => Promise<void>;

    private async writeTimeline(params: { tx?: any; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }) {
        try {
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        } catch {/* ignore timeline errors */ }
    }

    // 创建售后申请
    async createAfterSalesRequest(params: {
        orderId: number;
        memberId: number;
        type: AfterSalesType;
        reasonCode?: string | null;
        reasonText?: string | null;
        description?: string | null;
        imagesJson?: any;
        exchangeAddressSnapshot?: any;
        requestedAmount?: Prisma.Decimal | number | null;
    }) {
        // 校验订单归属
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: params.orderId } });
        if (order.memberId !== params.memberId) throw new Error('订单不属于当前用户');
        
        // 并发防护：存在进行中售后则拒绝
        const exists = await this.prisma.afterSalesRequest.findFirst({
            where: {
                orderId: params.orderId,
                status: { in: ['PENDING', 'APPROVED'] as any }
            }
        }).catch(() => null);
        if (exists) throw new Error('该订单已有进行中的售后处理');
        
        const created = await this.prisma.afterSalesRequest.create({
            data: {
                orderId: params.orderId,
                memberId: params.memberId,
                type: params.type,
                reasonCode: params.reasonCode || null,
                reasonText: params.reasonText || null,
                description: params.description || null,
                imagesJson: params.imagesJson ?? undefined,
                exchangeAddressSnapshot: params.exchangeAddressSnapshot ?? undefined,
                status: 'PENDING' as any,
                requestedAmount: params.requestedAmount != null ? new Prisma.Decimal(params.requestedAmount as any) : undefined,
            },
        });
        
        try {
            await this.syncBindings('AfterSalesRequest', String(created.id), 'imagesJson', Array.isArray(params.imagesJson) ? params.imagesJson : []);
        } catch { }
        
        try {
            await this.writeTimeline({
                orderId: params.orderId,
                event: 'AFTERSALES',
                value: 'PENDING',
                remark: String(params.type || '')
            });
        } catch { }
        
        return created;
    }

    // 查询售后列表
    async listAfterSales(query: { status?: AfterSalesStatus | undefined; memberId?: number | undefined }) {
        const where: any = {};
        if (query.status) where.status = query.status;
        if (query.memberId) where.memberId = query.memberId;
        
        return this.prisma.afterSalesRequest.findMany({
            where,
            orderBy: { id: 'desc' },
            include: { order: true, member: true, auditUser: true }
        });
    }

    // 获取售后详情
    async getAfterSales(id: number) {
        return this.prisma.afterSalesRequest.findUnique({
            where: { id },
            include: { order: true, member: true, auditUser: true }
        });
    }

    // 审核售后申请
    async auditAfterSales(id: number, approve: boolean, auditRemark?: string | null, auditUserId?: number | null, requestedAmountOverride?: number | null) {
        const req = await this.prisma.afterSalesRequest.findUnique({
            where: { id },
            include: { order: true }
        });
        if (!req) throw new Error('售后申请不存在');
        
        const nextStatus: AfterSalesStatus = approve ? 'APPROVED' : 'REJECTED';
        
        // 先更新审核结果
        const updated = await this.prisma.afterSalesRequest.update({
            where: { id },
            data: {
                status: nextStatus,
                auditRemark: auditRemark || null,
                auditUserId: auditUserId ?? null,
                auditedAt: new Date()
            }
        });
        
        await this.writeTimeline({
            orderId: req.orderId,
            event: 'AFTERSALES',
            value: String(nextStatus),
            remark: req.type,
            operatorUserId: auditUserId ?? null
        });

        if (!approve) {
            return updated;
        }

        // 审核通过后的联动处理
        if (req.type === 'REFUND') {
            if (req.order?.payStatus === 'PAID') {
                const pm = String((req.order as any)?.payMethod || '').toUpperCase();
                
                if (pm === 'WECHAT_JSAPI') {
                    // JSAPI 渠道退款：标记审核通过，等待渠道回调（由回调完成售后与订单状态）
                    return await this.prisma.afterSalesRequest.update({
                        where: { id },
                        data: { status: 'APPROVED' as any }
                    });
                }
                
                if (pm === 'WECHAT_MICROPAY') {
                    // 付款码支付：发起 v2 渠道退款，等待通知/查询回写
                    const order = req.order as any;
                    const amountFen = Math.round(Number(order.payAmount) * 100);
                    const requestedYuan = (requestedAmountOverride != null ? requestedAmountOverride : req.requestedAmount);
                    const requestedFen = Math.round(Number((requestedYuan != null ? requestedYuan : order.payAmount)) * 100);
                    const isFullRequest = (requestedAmountOverride != null)
                        ? Math.abs(Number(requestedAmountOverride) - Number(order.payAmount)) < 0.000001
                        : (req.requestedAmount == null || Math.abs(Number(req.requestedAmount) - Number(order.payAmount)) < 0.000001);
                    
                    const existing: any = await this.prisma.order.findUnique({
                        where: { id: order.id },
                        include: { refundRecords: true }
                    });
                    const successSumFen = Math.round(((existing?.refundRecords || [])
                        .filter((r: any) => r.status === 'SUCCESS')
                        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0)) * 100);
                    const refundableFen = Math.max(0, amountFen - successSumFen);
                    const refundFen = Math.min(requestedFen, refundableFen);
                    
                    if (isFullRequest && successSumFen > 0) throw new Error('已发生部分退款，不能再使用全额退款');
                    if (refundFen <= 0) throw new Error('累计退款金额已达上限');
                    
                    const allowed = await (this.refundService?.verifyRefundAllowed(order.id, refundFen / 100) ?? true);
                    if (!allowed) throw new Error('退款校验未通过：关联权益已部分使用');
                    
                    const outRefundNo = `R_${order.no}_${Date.now()}`;
                    
                    // 避免重复提交：检查近1分钟内是否已存在相同金额的 PENDING/PROCESSING 记录
                    try {
                        const recent = await this.prisma.refundRecord.findFirst({
                            where: {
                                orderId: order.id,
                                status: { in: ['PENDING', 'PROCESSING'] as any },
                                amount: new Prisma.Decimal(refundFen / 100 as any)
                            },
                            orderBy: { id: 'desc' }
                        });
                        if (recent && (Date.now() - new Date((recent as any).createdAt || 0).getTime()) < 60_000) {
                            return await this.prisma.afterSalesRequest.update({
                                where: { id },
                                data: { status: 'APPROVED' as any }
                            });
                        }
                    } catch { }
                    
                    if (this.refundService) {
                        await this.refundService.createRefundRecord({
                            orderId: order.id,
                            memberId: order.memberId,
                            amount: (refundFen / 100),
                            method: 'WECHAT_MICROPAY' as any,
                            reasonCode: 'WECHAT',
                            reasonText: '售后退款',
                            outRefundNo,
                            status: 'PENDING' as any
                        });
                    }
                    
                    const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund-v2';
                    
                    try {
                        if (this.wxpay) {
                            await this.wxpay.createRefundV2({
                                outTradeNo: order.no,
                                outRefundNo,
                                totalFeeFen: amountFen,
                                refundFeeFen: refundFen,
                                refundDesc: '售后退款',
                                notifyUrl
                            });
                        }
                        if (this.refundService) {
                            await this.refundService.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, null, null);
                        }
                    } catch (e: any) {
                        if (this.refundService) {
                            await this.refundService.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, String(e?.message || e || 'FAIL'));
                        }
                    }
                    
                    // 审核通过但等待渠道回调/查询，不立即完结售后
                    return await this.prisma.afterSalesRequest.update({
                        where: { id },
                        data: { status: 'APPROVED' as any }
                    });
                }
                
                // 其它渠道：内部退款并回收权益
                if (this.refundService) {
                    await this.refundService.finalizeInternalRefund(req.orderId, '售后退款', auditUserId ?? null);
                }
                await this.prisma.afterSalesRequest.update({
                    where: { id },
                    data: { status: 'COMPLETED' as any, completedAt: new Date() }
                });
                await this.writeTimeline({
                    orderId: req.orderId,
                    event: 'AFTERSALES',
                    value: 'COMPLETED',
                    remark: req.type,
                    operatorUserId: auditUserId ?? null
                });
                return await this.prisma.afterSalesRequest.findUnique({
                    where: { id },
                    include: { order: true, member: true, auditUser: true }
                });
            } else {
                // 未支付：等同取消
                await this.cancelUnpaidOrder(req.orderId, '售后取消（未支付）', auditUserId ?? null);
                await this.prisma.afterSalesRequest.update({
                    where: { id },
                    data: { status: 'COMPLETED' as any, completedAt: new Date() }
                });
                await this.writeTimeline({
                    orderId: req.orderId,
                    event: 'AFTERSALES',
                    value: 'COMPLETED',
                    remark: req.type,
                    operatorUserId: auditUserId ?? null
                });
                return await this.prisma.afterSalesRequest.findUnique({
                    where: { id },
                    include: { order: true, member: true, auditUser: true }
                });
            }
        } else if (req.type === 'EXCHANGE') {
            // 换货：商品订单且已支付
            const ord = await this.prisma.order.findUnique({ where: { id: req.orderId } });
            if (ord && ord.type === 'SP' && ord.payStatus === 'PAID') {
                await this.prisma.order.update({
                    where: { id: ord.id },
                    data: { fulfillmentStatus: 'PENDING' as any, status: 'PAID' }
                });
            } else {
                return await this.prisma.afterSalesRequest.update({
                    where: { id },
                    data: { status: 'REJECTED' as any, auditRemark: '未支付不可换货' }
                });
            }
            
            await this.prisma.afterSalesRequest.update({
                where: { id },
                data: { status: 'COMPLETED' as any, completedAt: new Date() }
            });
            await this.writeTimeline({
                orderId: req.orderId,
                event: 'FULFILLMENT',
                value: 'PENDING',
                remark: 'EXCHANGE_RESET',
                operatorUserId: auditUserId ?? null
            });
            await this.writeTimeline({
                orderId: req.orderId,
                event: 'AFTERSALES',
                value: 'COMPLETED',
                remark: 'EXCHANGE',
                operatorUserId: auditUserId ?? null
            });
        } else if (req.type === 'RE_SERVICE') {
            // 重新服务：服务订单且已支付
            const ord = await this.prisma.order.findUnique({ where: { id: req.orderId } });
            if (ord && ord.type === 'SERVICE' && ord.payStatus === 'PAID') {
                await this.prisma.order.update({
                    where: { id: ord.id },
                    data: { fulfillmentStatus: 'PENDING' as any, status: 'PAID' }
                });
            } else {
                return await this.prisma.afterSalesRequest.update({
                    where: { id },
                    data: { status: 'REJECTED' as any, auditRemark: '未支付不可重新服务' }
                });
            }
            
            await this.prisma.afterSalesRequest.update({
                where: { id },
                data: { status: 'COMPLETED' as any, completedAt: new Date() }
            });
            await this.writeTimeline({
                orderId: req.orderId,
                event: 'FULFILLMENT',
                value: 'PENDING',
                remark: 'RE_SERVICE_RESET',
                operatorUserId: auditUserId ?? null
            });
            await this.writeTimeline({
                orderId: req.orderId,
                event: 'AFTERSALES',
                value: 'COMPLETED',
                remark: 'RE_SERVICE',
                operatorUserId: auditUserId ?? null
            });
        }
        
        return this.prisma.afterSalesRequest.findUnique({
            where: { id },
            include: { order: true, member: true, auditUser: true }
        });
    }

    // 完成售后
    async completeAfterSales(id: number) {
        return this.prisma.afterSalesRequest.update({
            where: { id },
            data: { status: 'COMPLETED' as any, completedAt: new Date() }
        });
    }

    // 完成指定订单和类型的最新售后
    async completeLatestAftersalesByOrderAndType(orderId: number, type: 'EXCHANGE' | 'RE_SERVICE', operatorUserId?: number | null) {
        const afr = await this.prisma.afterSalesRequest.findFirst({
            where: { orderId, type: type as any, status: { in: ['PENDING', 'APPROVED'] as any } },
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
            remark: type,
            operatorUserId: operatorUserId ?? null
        });
        return afr.id;
    }

    // 换货售后：独立发货（不改动订单主发货字段，只写入扩展JSON与时间线）
    async shipExchangeForAfterSales(afrId: number, operatorUserId?: number | null, payload?: {
        noExpress?: boolean;
        companyCode?: string | null;
        companyName?: string | null;
        companyLogo?: string | null;
        trackingNo?: string | null;
        contactSenderPhoneMasked?: string | null;
        contactReceiverPhoneMasked?: string | null;
    }) {
        const afr = await this.prisma.afterSalesRequest.findUnique({
            where: { id: afrId },
            include: { order: true }
        });
        if (!afr) throw new Error('售后申请不存在');
        if (afr.type !== 'EXCHANGE') throw new Error('仅换货售后可使用该接口');
        
        const ord = afr.order as any;
        if (!ord) throw new Error('关联订单不存在');
        if (ord.type !== 'SP') throw new Error('仅商品订单支持换货发货');
        if (ord.payStatus !== 'PAID') throw new Error('仅已支付订单可换货发货');

        // 写入到订单扩展JSON中，独立记录换货发货
        const extra: any = ord.shipExpressExtra || {};
        const list: any[] = Array.isArray(extra.exchangeShipments) ? extra.exchangeShipments : [];
        const entry = {
            noExpress: !!payload?.noExpress,
            companyCode: payload?.companyCode || null,
            companyName: payload?.companyName || null,
            companyLogo: payload?.companyLogo || null,
            trackingNo: payload?.trackingNo || null,
            contact: {
                senderPhoneMasked: payload?.contactSenderPhoneMasked || null,
                receiverPhoneMasked: payload?.contactReceiverPhoneMasked || null,
            },
            operatorUserId: operatorUserId ?? null,
            createdAt: new Date().toISOString(),
        };
        list.push(entry);
        const newExtra = { ...(extra || {}), exchangeShipments: list };
        await this.prisma.order.update({ where: { id: ord.id }, data: { shipExpressExtra: newExtra } });

        // 时间线：换货已发货
        const remark = [payload?.companyName || payload?.companyCode, payload?.trackingNo].filter(Boolean).join(' / ');
        await this.writeTimeline({
            orderId: ord.id,
            event: 'LOGISTICS',
            value: 'EXCHANGE_SHIPPED',
            remark,
            operatorUserId
        });

        // 更新履约状态：置为已发货（不覆盖主物流字段，仅用于状态与列表展示）
        try {
            const cur = await this.prisma.order.findUnique({
                where: { id: ord.id },
                select: { fulfillmentStatus: true }
            });
            if (cur && (cur.fulfillmentStatus as any) === 'PENDING') {
                await this.prisma.order.update({
                    where: { id: ord.id },
                    data: { fulfillmentStatus: 'SHIPPED' as any }
                });
                await this.writeTimeline({
                    orderId: ord.id,
                    event: 'FULFILLMENT',
                    value: 'SHIPPED',
                    remark: 'EXCHANGE',
                    operatorUserId
                });
            }
        } catch {/* ignore */ }

        return await this.prisma.order.findUnique({ where: { id: ord.id } });
    }

    // 取消未支付订单（售后流程中使用）
    private async cancelUnpaidOrder(orderId: number, reason?: string, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        if (order.payStatus !== 'UNPAID') throw new Error('仅未支付订单可取消');
        
        // 库存回滚逻辑（简化版，实际应该调用订单服务的取消方法）
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
                payStatus: 'CANCELLED',
                remark: reason ?? undefined
            }
        });
        
        await this.writeTimeline({
            orderId,
            event: 'ORDER_STATUS',
            value: 'CANCELLED',
            remark: reason,
            operatorUserId
        });
        await this.writeTimeline({
            orderId,
            event: 'PAY_STATUS',
            value: 'CANCELLED',
            remark: reason,
            operatorUserId
        });
        
        return updated;
    }
}

// ========== 文件绑定辅助 ==========
async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]> {
    const set = new Set<string>();
    for (const u of urls) {
        if (!u) continue;
        const s = String(u).trim();
        if (!s) continue;
        set.add(s);
        try {
            if (/^https?:\/\//i.test(s)) {
                const rel = new URL(s).pathname;
                if (rel) set.add(rel);
            }
        } catch { }
    }
    const arr = Array.from(set);
    if (!arr.length) return [];
    const rows = await (prisma as any).fileAsset.findMany({
        where: { url: { in: arr } },
        select: { id: true }
    });
    return Array.isArray(rows) ? rows.map((r: any) => String(r.id)) : [];
}

OrderAfterSalesService.prototype['syncBindings'] = async function (this: OrderAfterSalesService, tableName: string, rowId: string, fieldName: string, urls: string[]) {
    try {
        const desired = new Set<string>(await getAssetIdsFromUrls(this['prisma'], urls));
        const existing: any[] = await (this['prisma'] as any).fileBinding.findMany({
            where: { tableName, rowId: String(rowId), fieldName }
        });
        for (const b of existing) {
            if (!desired.has(String(b.fileId))) {
                try {
                    await this['assets']?.unbindReference(String(b.fileId), String(b.id));
                } catch { }
            }
        }
        for (const fid of desired) {
            const ok = existing.find((b: any) => String(b.fileId) === fid);
            if (!ok) {
                try {
                    await this['assets']?.bindReference(String(fid), {
                        tableName,
                        rowId: String(rowId),
                        fieldName
                    });
                } catch { }
            }
        }
    } catch { }
};
