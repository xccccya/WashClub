import { Injectable } from '@nestjs/common';
import { Prisma, OrderType, OrderStatus, PayMethod, PayStatus, FulfillmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class OrderService {
    constructor(private readonly prisma: PrismaService) {}

    private generateOrderNo(type: 'SERVICE' | 'SP' | 'FK') {
        const now = new Date();
        const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
        const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
        return `${type}_${ts}_${rand}`;
    }

    async createOrder(params: { type: OrderType; memberId: number; vehicleId?: number | null; shippingAddressId?: number | null; items: Array<{ productId?: number | null; skuId?: number | null; name: string; imageUrl?: string | null; specsText?: string | null; barcode?: string | null; price: Prisma.Decimal | number; discount?: Prisma.Decimal | number; quantity: number }>; remark?: string | null; shippingFee?: Prisma.Decimal | number; usedPoints?: number; pointsAmount?: Prisma.Decimal | number; couponInfo?: Prisma.InputJsonValue | null; }): Promise<{ id: number; no: string }>{
        const { type, memberId, vehicleId, shippingAddressId, items, remark, shippingFee = 0, usedPoints = 0, pointsAmount = 0, couponInfo } = params;
        if (!items || items.length === 0) throw new Error('订单项不能为空');

        return this.prisma.$transaction(async (tx) => {
            // 若为商品订单，检查是否包含实体商品，实体商品必须提供收货地址
            let requiresAddress = false;
            const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
            if (type === 'SP' && productIds.length > 0) {
                const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, type: true } });
                const map = new Map(products.map(p => [p.id, p.type] as const));
                requiresAddress = items.some(it => (it.productId ? map.get(it.productId) === 'PHYSICAL' : false));
            }
            let addressSnapshot: Prisma.InputJsonValue | undefined = undefined;
            let addressIdToSave: number | null = null;
            if (requiresAddress) {
                if (!shippingAddressId) throw new Error('实体商品订单必须选择收货地址');
                const addr = await tx.memberAddress.findUnique({ where: { id: shippingAddressId } });
                if (!addr || addr.memberId !== memberId) throw new Error('收货地址无效');
                addressIdToSave = addr.id;
                addressSnapshot = {
                    id: addr.id,
                    province: addr.province,
                    city: addr.city,
                    district: addr.district,
                    street: addr.street,
                    detail: addr.detail,
                    phone: addr.phone,
                    label: addr.label ?? null,
                } as any;
            } else if (shippingAddressId) {
                // 非必填但传入时亦进行记录
                const addr = await tx.memberAddress.findUnique({ where: { id: shippingAddressId } });
                if (addr && addr.memberId === memberId) {
                    addressIdToSave = addr.id;
                    addressSnapshot = {
                        id: addr.id,
                        province: addr.province,
                        city: addr.city,
                        district: addr.district,
                        street: addr.street,
                        detail: addr.detail,
                        phone: addr.phone,
                        label: addr.label ?? null,
                    } as any;
                }
            }
            // 计算金额
            let total = new Prisma.Decimal(0);
            let discountTotal = new Prisma.Decimal(0);
            for (const it of items) {
                const price = new Prisma.Decimal(it.price as any);
                const discount = new Prisma.Decimal((it.discount ?? 0) as any);
                total = total.plus(price.mul(it.quantity));
                discountTotal = discountTotal.plus(discount);
            }
            const shipping = new Prisma.Decimal(shippingFee as any);
            const payAmount = total.minus(discountTotal).plus(shipping).minus(new Prisma.Decimal(pointsAmount as any));

            const order = await tx.order.create({
                data: {
                    no: this.generateOrderNo(type as any),
                    type,
                    status: 'CREATED' as OrderStatus,
                    fulfillmentStatus: (type === 'FK' ? 'NONE' : 'PENDING') as FulfillmentStatus,
                    totalAmount: total,
                    discountAmount: discountTotal,
                    payAmount,
                    shippingFee: shipping,
                    payStatus: 'UNPAID',
                    memberId,
                    vehicleId: vehicleId ?? null,
                    remark: remark ?? null,
                    usedPoints: usedPoints || 0,
                    pointsAmount: new Prisma.Decimal(pointsAmount as any),
                    couponInfo: couponInfo ?? undefined,
                    shippingAddressId: addressIdToSave,
                    shippingAddressSnapshot: addressSnapshot,
                },
            });
            for (const it of items) {
                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: it.productId ?? null,
                        skuId: it.skuId ?? null,
                        name: it.name,
                        imageUrl: it.imageUrl ?? null,
                        specsText: it.specsText ?? null,
                        barcode: it.barcode ?? null,
                        price: new Prisma.Decimal(it.price as any),
                        discount: new Prisma.Decimal((it.discount ?? 0) as any),
                        quantity: it.quantity,
                    },
                });
            }
            return { id: order.id, no: order.no };
        });
    }

    getOrder(id: number) {
        return this.prisma.order.findUnique({ where: { id }, include: { items: true, member: true, vehicle: true } });
    }

    getOrderByNo(no: string) {
        return this.prisma.order.findUnique({ where: { no }, include: { items: true, member: true, vehicle: true } });
    }

    async getMemberOpenId(memberId: number): Promise<string | null> {
        const m = await this.prisma.member.findUnique({ where: { id: memberId }, select: { weixinOpenId: true } });
        return m?.weixinOpenId ?? null;
    }

    listOrders(query: { type?: OrderType | undefined; status?: OrderStatus | undefined; payStatus?: PayStatus | undefined; memberId?: number | undefined; keyword?: string | undefined; start?: string | undefined; end?: string | undefined; scene?: string | undefined; includeDeleted?: boolean | undefined; }) {
        const where: Prisma.OrderWhereInput = {};
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;
        if (query.payStatus) where.payStatus = query.payStatus;
        if (query.memberId) where.memberId = query.memberId;
        // 统一场景筛选（用于小程序与后台快捷筛选）
        if (query.scene) {
            const scene = String(query.scene).toUpperCase();
            if (scene === 'PENDING_PAYMENT') {
                (where as any).payStatus = 'UNPAID';
            } else if (scene === 'REFUND_AFTERSALE') {
                (where as any).payStatus = 'REFUNDED';
            } else if (scene === 'PENDING_SERVICE') {
                (where as any).type = 'SERVICE';
                (where as any).payStatus = 'PAID';
                (where as any).fulfillmentStatus = { in: ['PENDING','IN_SERVICE'] } as any;
            } else if (scene === 'PENDING_DELIVERY') {
                (where as any).type = 'SP';
                (where as any).payStatus = 'PAID';
                (where as any).fulfillmentStatus = 'PENDING' as any;
            } else if (scene === 'PENDING_RECEIPT') {
                (where as any).type = 'SP';
                (where as any).payStatus = 'PAID';
                // 兼容旧数据
                (where as any).OR = [
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'SHIPPED' }] },
                    { AND: [{ type: 'SP' }, { status: 'FULFILLED' }] },
                ];
            } else if (scene === 'COMPLETED') {
                const rules: any[] = [
                    { AND: [{ type: 'SERVICE' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'DONE' }] },
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'RECEIVED' }] },
                    { AND: [{ type: 'FK' }, { payStatus: 'PAID' }] },
                    { AND: [{ type: 'SERVICE' }, { status: 'FULFILLED' }] },
                    { AND: [{ type: 'SP' }, { status: 'CLOSED' }] },
                ];
                (where as any).OR = rules;
            } else if (scene === 'CANCELLED') {
                if (query.type) {
                    (where as any).OR = [
                        { AND: [{ type: query.type }, { status: 'CANCELLED' }] },
                        { AND: [{ type: query.type }, { payStatus: 'CANCELLED' }] },
                    ];
                } else {
                    (where as any).OR = [
                        { status: 'CANCELLED' },
                        { payStatus: 'CANCELLED' },
                    ];
                }
            } else if (scene === 'DELETED') {
                (where as any).deletedAt = { not: null } as any;
            }
        }
        // 后台可全量查看时允许带 includeDeleted=true；小程序不会传该参数
        if (!query.includeDeleted) {
            (where as any).deletedAt = null as any;
        }
        if (query.keyword) {
            const kw = query.keyword;
            where.OR = [
                { no: { contains: kw } },
                { remark: { contains: kw } },
                { member: { phone: { contains: kw } } },
            ];
        }
        if (query.start || query.end) {
            const createdAt: Prisma.DateTimeFilter = {};
            if (query.start) {
                const s = new Date(query.start);
                if (!isNaN(s.getTime())) createdAt.gte = s;
            }
            if (query.end) {
                const e = new Date(query.end);
                if (!isNaN(e.getTime())) createdAt.lte = e;
            }
            if (Object.keys(createdAt).length) (where as any).createdAt = createdAt;
        }
        return this.prisma.order.findMany({ where, orderBy: [{ id: 'desc' }], include: { items: true, member: true } });
    }

    // 支付（手动确认）：现金/收钱吧/线下
    async markPaid(params: { orderId: number; method: PayMethod; paidAt?: Date | null; operatorUserId?: number | null }) {
        // 仅未支付订单可标记
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id: params.orderId } });
        if (order.payStatus !== 'UNPAID') throw new Error('仅未支付订单可标记支付');
        const paidAt = params.paidAt ?? new Date();
        const updated = await this.prisma.order.update({ where: { id: order.id }, data: { payStatus: 'PAID', status: 'PAID', payMethod: params.method, paidAt } });
        // 支付成功后，若订单包含绑定洗车计次卡的商品，则为会员发放洗车卡，并记录购买日志（含订单号）
        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const prod = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!prod || prod.type !== 'VIRTUAL_CARD' || !prod.couponId) continue;
            const coupon = await this.prisma.coupon.findUnique({ where: { id: prod.couponId } });
            if (!coupon || coupon.type !== 'WASH_CARD') continue;
            const times = coupon.totalTimes || 0;
            if (times <= 0) continue;
            const change = times * it.quantity;
            const remark = `购买入账（订单号：${order.no}）`;
            // 为会员发放洗车卡，按数量叠加，并写 WashCardLog
            const existing = await this.prisma.washCard.findFirst({ where: { ownerMemberId: order.memberId, name: coupon.name } });
            if (existing) {
                const before = existing.remainingTimes;
                const afterRemaining = before + change;
                await this.prisma.washCard.update({ where: { id: existing.id }, data: { totalTimes: existing.totalTimes + change, remainingTimes: afterRemaining } });
                await this.prisma.washCardLog.create({
                    data: {
                        cardId: existing.id,
                        action: 'ADD' as any,
                        reason: 'PURCHASE_ADD' as any,
                        change,
                        beforeRemaining: before,
                        afterRemaining,
                        remark,
                        purchaseOrderId: order.id,
                    },
                });
            } else {
                // 生成唯一8位卡号
                async function gen(tx: PrismaService){
                    for (let i=0;i<20;i++){
                        const n = Math.floor(Math.random()*100000000);
                        const candidate = String(n).padStart(8,'0');
                        const exists = await tx.washCard.findUnique({ where: { cardNo: candidate } }).catch(()=>null);
                        if (!exists) return candidate;
                    }
                    return String(Date.now()).slice(-8);
                }
                const cardNo = await gen(this.prisma);
                const created = await this.prisma.washCard.create({ data: { ownerMemberId: order.memberId, name: coupon.name, totalTimes: change, remainingTimes: change, cardNo } });
                await this.prisma.washCardLog.create({
                    data: {
                        cardId: created.id,
                        action: 'ADD' as any,
                        reason: 'PURCHASE_ADD' as any,
                        change,
                        beforeRemaining: 0,
                        afterRemaining: change,
                        remark,
                        purchaseOrderId: order.id,
                    },
                });
            }
        }
        // 扣减库存（仅实体商品 PHYSICAL）并写入库存流水：ORDER_DEDUCT
        for (const it of items) {
            if (!it.productId) continue;
            const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!product || product.type !== 'PHYSICAL') continue;
            if (product.specType === 'MULTI') {
                if (!it.skuId) throw new Error('订单包含多规格商品但缺少 skuId');
                const sku = await this.prisma.productSku.findUniqueOrThrow({ where: { id: it.skuId } });
                const before = sku.stockQuantity;
                const change = -Math.abs(it.quantity);
                const after = before + change;
                if (after < 0) throw new Error('库存不足，无法扣减');
                await this.prisma.productSku.update({ where: { id: sku.id }, data: { stockQuantity: after } });
                await this.prisma.inventoryLog.create({
                    data: {
                        productId: product.id,
                        skuId: sku.id,
                        change,
                        beforeStock: before,
                        afterStock: after,
                        reason: 'ORDER_DEDUCT' as any,
                        remark: `订单扣减（订单号：${updated.no}）`,
                        operatorUserId: params.operatorUserId ?? null,
                    },
                });
            } else {
                const before = product.stockQuantity ?? 0;
                const change = -Math.abs(it.quantity);
                const after = before + change;
                if (after < 0) throw new Error('库存不足，无法扣减');
                await this.prisma.product.update({ where: { id: product.id }, data: { stockQuantity: after } });
                await this.prisma.inventoryLog.create({
                    data: {
                        productId: product.id,
                        skuId: null,
                        change,
                        beforeStock: before,
                        afterStock: after,
                        reason: 'ORDER_DEDUCT' as any,
                        remark: `订单扣减（订单号：${updated.no}）`,
                        operatorUserId: params.operatorUserId ?? null,
                    },
                });
            }
        }
        // 若为商品订单（SP）且所有订单项均为虚拟卡券商品，则发放完成后直接将订单置为已完成
        if (order.type === 'SP') {
            const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
            if (productIds.length > 0) {
                const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
                const idToType = new Map(products.map(p => [p.id, p.type] as const));
                const allVirtual = items.every(it => (it.productId ? idToType.get(it.productId) === 'VIRTUAL_CARD' : false));
                if (allVirtual) {
                    const closed = await this.prisma.order.update({ where: { id: order.id }, data: { status: 'CLOSED', fulfillmentStatus: 'RECEIVED' as any } });
                    return closed;
                }
            }
        }
        return updated;
    }

    // 关闭/取消订单：如已支付且尚未退款，回滚库存并将支付状态置为 CANCELLED
    async closeOrder(id: number, reason?: string, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.payStatus === 'PAID') {
            const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
            for (const it of items) {
                if (!it.productId) continue;
                const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
                if (!product || product.type !== 'PHYSICAL') continue;
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
                            remark: `订单回滚（订单号：${order.no}）` ,
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
                            remark: `订单回滚（订单号：${order.no}）` ,
                            operatorUserId: operatorUserId ?? null,
                        },
                    });
                }
            }
            return this.prisma.order.update({ where: { id }, data: { status: 'CLOSED', payStatus: 'CANCELLED', remark: reason ?? undefined } });
        }
        return this.prisma.order.update({ where: { id }, data: { status: 'CLOSED', remark: reason ?? undefined } });
    }

    // 退款：仅已支付订单可退款，回仓并标记为 REFUNDED + CANCELLED
    async refundOrder(id: number, reason?: string, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可退款');
        const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
            if (!it.productId) continue;
            const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
            if (!product || product.type !== 'PHYSICAL') continue;
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
                        reason: 'REFUND_RETURN' as any,
                        remark: `退款回仓（订单号：${order.no}）` ,
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
                        remark: `退款回仓（订单号：${order.no}）` ,
                        operatorUserId: operatorUserId ?? null,
                    },
                });
            }
        }
        return this.prisma.order.update({ where: { id }, data: { status: 'CANCELLED', payStatus: 'REFUNDED', remark: reason ?? undefined } });
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

    // 发货（SP）：支持无需快递/快递发货并记录物流信息
    async shipOrder(id: number, operatorUserId?: number | null, payload?: { noExpress?: boolean; companyCode?: string | null; companyName?: string | null; companyLogo?: string | null; trackingNo?: string | null; extra?: any | null }) {
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
        return this.prisma.order.update({ where: { id }, data });
    }

    // 确认收货（SP）：SHIPPED -> RECEIVED，并置为完成（CLOSED）
    async receiveOrder(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SP') throw new Error('仅商品订单可收货');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可收货');
        return this.prisma.order.update({ where: { id }, data: { fulfillmentStatus: 'RECEIVED' as any, status: 'CLOSED' } });
    }

    // 开始服务（SERVICE）：PENDING -> IN_SERVICE
    async startService(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SERVICE') throw new Error('仅服务订单可开始服务');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可开始服务');
        return this.prisma.order.update({ where: { id }, data: { fulfillmentStatus: 'IN_SERVICE' as any } });
    }

    // 结束服务（SERVICE）：IN_SERVICE/PENDING -> DONE，并置为已完成（FULFILLED）
    async finishService(id: number, operatorUserId?: number | null) {
        const order = await this.prisma.order.findUniqueOrThrow({ where: { id } });
        if (order.type !== 'SERVICE') throw new Error('仅服务订单可结束服务');
        if (order.payStatus !== 'PAID') throw new Error('仅已支付订单可结束服务');
        return this.prisma.order.update({ where: { id }, data: { fulfillmentStatus: 'DONE' as any, status: 'FULFILLED' } });
    }
}


