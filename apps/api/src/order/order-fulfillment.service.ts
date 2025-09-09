import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { WechatShippingService } from './wechat-shipping.service.js';

@Injectable()
export class OrderFulfillmentService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly wxship?: WechatShippingService
    ) {}

    private async writeTimeline(params: { tx?: any; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }) {
        try {
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        } catch {/* ignore timeline errors */ }
    }

    // 发货（SP）：支持无需快递/快递发货并记录物流信息
    async shipOrder(id: number, operatorUserId?: number | null, payload?: {
        noExpress?: boolean;
        companyCode?: string | null;
        companyName?: string | null;
        companyLogo?: string | null;
        trackingNo?: string | null;
        extra?: any | null;
        contactSenderPhoneMasked?: string | null;
        contactReceiverPhoneMasked?: string | null;
    }) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SP') throw new Error('仅商品订单可发货');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可发货');
        
        const data = {
            fulfillmentStatus: 'SHIPPED' as any,
            shippedAt: new Date(),
            shipNoExpress: !!payload?.noExpress,
            shipExpressCompanyCode: payload?.companyCode ?? null,
            shipExpressCompanyName: payload?.companyName ?? null,
            shipExpressCompanyLogo: payload?.companyLogo ?? null,
            shipExpressTrackingNo: payload?.trackingNo ?? null,
            shipExpressExtra: payload?.extra ?? undefined,
        };
        
        const updatedShip = await this.prisma.order.update({ where: { id }, data });
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'SHIPPED', operatorUserId });
        
        const remark = [payload?.companyName || payload?.companyCode, payload?.trackingNo].filter(Boolean).join(' / ');
        if (remark) {
            await this.writeTimeline({ orderId: id, event: 'LOGISTICS', value: 'SHIPPED', remark, operatorUserId });
        }
        
        // 若为微信JSAPI支付，则上报微信发货信息管理服务
        try {
            if (order.payMethod === 'WECHAT_JSAPI' && this.wxship) {
                const logisticsType = payload?.noExpress ? 4 : 1;
                const contact = (payload?.companyName?.includes('顺丰') || (payload?.companyCode || '').toUpperCase() === 'SF') ? {
                    senderPhoneMasked: payload?.contactSenderPhoneMasked || undefined,
                    receiverPhoneMasked: payload?.contactReceiverPhoneMasked || undefined,
                } : undefined;
                await this.wxship.uploadShippingInfo({
                    orderId: order.id,
                    logisticsType: logisticsType as any,
                    deliveryId: payload?.companyCode || undefined,
                    trackingNo: payload?.trackingNo || undefined,
                    contact: contact as any,
                });
            }
        } catch {/* ignore report errors */ }
        
        // 若存在最近的"换货"售后，发货后自动完结该售后
        await this.completeLatestAftersalesByOrderAndType(id, 'EXCHANGE', operatorUserId ?? null);
        
        return updatedShip;
    }

    // 确认收货（SP）：SHIPPED -> RECEIVED，并置为完成（CLOSED）
    async receiveOrder(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SP') throw new Error('仅商品订单可收货');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可收货');
        
        // 收货不应触发"修改物流单号"校验路径，确保不调用 editShipTrackingNo
        const updatedReceive = await this.prisma.order.update({
            where: { id },
            data: { fulfillmentStatus: 'RECEIVED' as any, status: 'CLOSED' }
        });
        
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'RECEIVED', operatorUserId });
        await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'CLOSED', operatorUserId });
        
        return updatedReceive;
    }

    // 仅一次：修改物流单号（未收货前且仅能一次），记录时间线
    async editShipTrackingNo(id: number, newTrackingNo: string, operatorUserId?: number | null, payload?: {
        companyCode?: string | null;
        companyName?: string | null;
        companyLogo?: string | null;
        contactSenderPhoneMasked?: string | null;
        contactReceiverPhoneMasked?: string | null;
    }) {
        const order: any = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SP') throw new Error('仅商品订单可修改物流单号');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可修改物流单号');
        if (order.fulfillmentStatus !== 'SHIPPED') throw new Error('仅已发货且未收货订单可修改物流单号');
        
        const extra: any = order.shipExpressExtra || {};
        if (extra && typeof extra === 'object' && extra.editedOnce === true) {
            throw new Error('物流单号仅允许修改一次');
        }
        
        const prev = String(order.shipExpressTrackingNo || '');
        const next = String(newTrackingNo || '').trim();
        if (!next) throw new Error('新物流单号不能为空');
        
        const companyCode = payload?.companyCode ?? order.shipExpressCompanyCode ?? null;
        const companyName = payload?.companyName ?? order.shipExpressCompanyName ?? null;
        const companyLogo = payload?.companyLogo ?? order.shipExpressCompanyLogo ?? null;
        const newExtra = { ...(extra || {}), editedOnce: true, editAt: new Date().toISOString(), prevTrackingNo: prev };
        
        const updated = await this.prisma.order.update({
            where: { id },
            data: {
                shipExpressTrackingNo: next,
                shipExpressCompanyCode: companyCode,
                shipExpressCompanyName: companyName,
                shipExpressCompanyLogo: companyLogo,
                shipExpressExtra: newExtra
            }
        });
        
        await this.writeTimeline({ orderId: id, event: 'LOGISTICS', value: 'EDITED', remark: `${prev || '-'} -> ${next}`, operatorUserId });
        
        // 若为微信JSAPI并存在快递公司（表示快递发货），上报微信：等价于发货上报但只有单号不同
        try {
            if ((order as any).payMethod === 'WECHAT_JSAPI' && !order.shipNoExpress && this.wxship) {
                await this.wxship.uploadShippingInfo({
                    orderId: order.id,
                    logisticsType: 1,
                    deliveryId: companyCode || undefined,
                    trackingNo: next,
                    contact: {
                        senderPhoneMasked: payload?.contactSenderPhoneMasked || undefined,
                        receiverPhoneMasked: payload?.contactReceiverPhoneMasked || undefined
                    }
                });
            }
        } catch { }
        
        return updated;
    }

    // 开始服务（SERVICE）：PENDING -> IN_SERVICE
    async startService(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SERVICE') throw new Error('仅服务订单可开始服务');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可开始服务');
        
        const updatedStart = await this.prisma.order.update({
            where: { id },
            data: { fulfillmentStatus: 'IN_SERVICE' as any }
        });
        
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'IN_SERVICE', operatorUserId });
        
        return updatedStart;
    }

    // 结束服务（SERVICE）：IN_SERVICE/PENDING -> DONE，并置为已完成（FULFILLED）
    async finishService(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SERVICE') throw new Error('仅服务订单可结束服务');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可结束服务');
        
        const updatedFinish = await this.prisma.order.update({
            where: { id },
            data: { fulfillmentStatus: 'DONE' as any, status: 'FULFILLED' }
        });
        
        await this.writeTimeline({ orderId: id, event: 'FULFILLMENT', value: 'DONE', operatorUserId });
        await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'FULFILLED', operatorUserId });
        
        // 若存在最近的"重新服务"售后，服务完成后自动完结
        await this.completeLatestAftersalesByOrderAndType(id, 'RE_SERVICE', operatorUserId ?? null);
        
        // JSAPI服务订单：按要求上报发货信息（logistics_type=3）
        try {
            if (order.payMethod === 'WECHAT_JSAPI' && this.wxship) {
                await this.wxship.uploadShippingInfo({ orderId: id, logisticsType: 3 });
            }
        } catch { }
        
        return updatedFinish;
    }

    // 关闭/取消订单：如已支付且尚未退款，回滚库存并将支付状态置为 CANCELLED
    async closeOrder(id: number, reason?: string, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        
        if (order.payStatus === 'PAID') {
            const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
            for (const it of items) {
                if (!it.productId) continue;
                const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
                if (!product || (product.type !== 'PHYSICAL' && product.type !== 'VIRTUAL_CARD')) continue;
                
                if (product.specType === 'MULTI') {
                    if (!it.skuId) continue;
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
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `订单回滚（订单号：${order.no}）`,
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
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `订单回滚（订单号：${order.no}）`,
                            operatorUserId: operatorUserId ?? null,
                        },
                    });
                }
            }
            return this.prisma.order.update({
                where: { id },
                data: { status: 'CLOSED', payStatus: 'CANCELLED', remark: reason ?? undefined }
            });
        }
        
        return this.prisma.order.update({
            where: { id },
            data: { status: 'CLOSED', remark: reason ?? undefined }
        });
    }

    // 取消订单（未支付）：库存回滚并标记 CLOSED/CANCELLED（与 closeOrder 类似但保留语义）
    async cancelOrder(id: number, reason?: string, operatorUserId?: number | null, opts?: { userInitiated?: boolean }) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.payStatus !== 'UNPAID') throw new Error('仅未支付订单可取消');
        
        // 若有占用库存，回滚（下单阶段已预占）
        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!product) continue;
            
            if (product.type === 'PHYSICAL' || product.type === 'VIRTUAL_CARD') {
                if (product.specType === 'MULTI') {
                    if (!it.skuId) {
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
                                reason: 'ORDER_ROLLBACK' as any,
                                remark: `取消订单回滚（缺少SKU，订单号：${order.no}）`,
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
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `取消订单回滚（订单号：${order.no}）`,
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
                            reason: 'ORDER_ROLLBACK' as any,
                            remark: `取消订单回滚（订单号：${order.no}）`,
                            operatorUserId: operatorUserId ?? null,
                        },
                    });
                }
            }
        }
        
        // 返还下单时已扣的积分（仅限未支付取消场景）
        const updated = await this.prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.order.update({
                where: { id },
                data: { status: 'CANCELLED', payStatus: 'CANCELLED', remark: reason ?? undefined }
            });
            const usedPts = Math.max(0, Number(order.usedPoints || 0));
            if (usedPts > 0) {
                await tx.member.update({ where: { id: order.memberId }, data: { points: { increment: usedPts } } });
                try {
                    await (tx as any).memberPointsLog.create({
                        data: {
                            memberId: order.memberId,
                            change: usedPts,
                            source: 'REFUND',
                            desc: `取消订单返还积分（订单${order.no}）`,
                            orderId: order.id,
                            operatorUserId: operatorUserId ?? null
                        }
                    });
                } catch { }
            }
            return updatedOrder;
        });
        
        const cancelRemark = opts?.userInitiated ? '用户主动取消' : undefined;
        await this.writeTimeline({ orderId: id, event: 'ORDER_STATUS', value: 'CANCELLED', remark: cancelRemark, operatorUserId });
        await this.writeTimeline({ orderId: id, event: 'PAY_STATUS', value: 'CANCELLED', remark: cancelRemark, operatorUserId });
        
        return updated;
    }

    // 软删除订单：仅打标 deletedAt，不改变其他状态
    async softDeleteOrder(id: number, operatorUserId?: number | null) {
        await this.prisma.order.findUniqueOrThrow({ where: { id } });
        return this.prisma.order.update({ where: { id }, data: { deletedAt: new Date() } });
    }

    // 恢复软删除：清空 deletedAt
    async restoreOrder(id: number, operatorUserId?: number | null) {
        await this.prisma.order.findUniqueOrThrow({ where: { id } });
        return this.prisma.order.update({ where: { id }, data: { deletedAt: null } });
    }

    // 完成指定订单和类型的最新售后
    private async completeLatestAftersalesByOrderAndType(orderId: number, type: 'EXCHANGE' | 'RE_SERVICE', operatorUserId?: number | null) {
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
}
