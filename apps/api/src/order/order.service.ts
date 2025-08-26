import { Injectable } from '@nestjs/common';
import { Prisma, OrderType, OrderStatus, PayMethod, PayStatus } from '@prisma/client';
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

    async createOrder(params: { type: OrderType; memberId: number; vehicleId?: number | null; items: Array<{ productId?: number | null; skuId?: number | null; name: string; imageUrl?: string | null; specsText?: string | null; barcode?: string | null; price: Prisma.Decimal | number; discount?: Prisma.Decimal | number; quantity: number }>; remark?: string | null; shippingFee?: Prisma.Decimal | number; usedPoints?: number; pointsAmount?: Prisma.Decimal | number; couponInfo?: Prisma.InputJsonValue | null; }): Promise<{ id: number; no: string }>{
        const { type, memberId, vehicleId, items, remark, shippingFee = 0, usedPoints = 0, pointsAmount = 0, couponInfo } = params;
        if (!items || items.length === 0) throw new Error('订单项不能为空');

        return this.prisma.$transaction(async (tx) => {
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

    listOrders(query: { type?: OrderType | undefined; status?: OrderStatus | undefined; payStatus?: PayStatus | undefined; memberId?: number | undefined; keyword?: string | undefined; start?: string | undefined; end?: string | undefined; }) {
        const where: Prisma.OrderWhereInput = {};
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;
        if (query.payStatus) where.payStatus = query.payStatus;
        if (query.memberId) where.memberId = query.memberId;
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
    async markPaid(params: { orderId: number; method: PayMethod; paidAt?: Date | null }) {
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
        return updated;
    }

    // 关闭/取消订单
    closeOrder(id: number, reason?: string) {
        return this.prisma.order.update({ where: { id }, data: { status: 'CLOSED', remark: reason ?? undefined } });
    }
}


