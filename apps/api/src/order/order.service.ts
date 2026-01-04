import { Injectable } from '@nestjs/common';
import { Prisma, OrderType, OrderStatus, PayStatus, FulfillmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { NotificationService } from '../notification/notification.service.js';
import { CouponService } from '../coupon/coupon.service.js';
import { AssetService } from '../file/asset.service.js';
import { resolveGuestMemberIdEnv } from '../env.js';
import type { ProxyAdminSnapshot } from './order.types.js';
import { syncFileBindings } from './file-bindings.helper.js';

@Injectable()
export class OrderService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly coupons: CouponService,
        private readonly assets?: AssetService,
        private readonly notifier?: NotificationService,
    ) {}

    private async writeTimeline(params: { tx?: Prisma.TransactionClient | PrismaService; orderId: number; event: string; value?: string | null; remark?: string | null; operatorUserId?: number | null }) {
        try {
            const db = params.tx ?? this.prisma;
            await db.orderTimeline.create({ data: { orderId: params.orderId, event: params.event, value: params.value || null, remark: params.remark || null, operatorUserId: params.operatorUserId ?? null } });
        } catch {/* ignore timeline errors */ }
    }

    private async syncBindings(tableName: string, rowId: string, fieldName: string, urls: string[]): Promise<void> {
        return syncFileBindings({
            prisma: this.prisma,
            assets: this.assets,
            tableName,
            rowId,
            fieldName,
            urls,
        });
    }

    private generateOrderNo(type: 'SERVICE' | 'SP' | 'FK') {
        const now = new Date();
        const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
        const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
        return `${type}_${ts}_${rand}`;
    }

    async createOrder(params: {
        type: OrderType;
        memberId: number;
        vehicleId?: number | null;
        groupId?: number | null;
        shippingAddressId?: number | null;
        // 新增：自提/无需快递（含实体商品时允许不填地址）
        noExpress?: boolean | null;
        // 新增：收银立减（POS 手动优惠，单位元，>=0）
        cashierDiscountAmount?: Prisma.Decimal | number | null;
        items: Array<{
            productId?: number | null;
            skuId?: number | null;
            name: string;
            imageUrl?: string | null;
            specsText?: string | null;
            barcode?: string | null;
            price: Prisma.Decimal | number;
            discount?: Prisma.Decimal | number;
            quantity: number;
        }>;
        userRemark?: string | null;
        remark?: string | null;
        shippingFee?: Prisma.Decimal | number;
        usedPoints?: number;
        pointsAmount?: Prisma.Decimal | number;
        couponInfo?: Prisma.InputJsonValue | null;
        memberCouponId?: number | null;
        memberCouponIds?: number[] | null;
        disableMemberDiscount?: boolean | null;
        payAfterService?: boolean | null;
        // 控制标记（由控制器注入）：游客/代客
        _isGuestOrder?: boolean | null;
        _proxyAdminUserId?: number | null;
        _proxyAdminSnapshot?: ProxyAdminSnapshot | null;
    }): Promise<{ id: number; no: string }> {
        const {
            type, memberId, vehicleId, groupId, shippingAddressId, noExpress, items, userRemark, remark,
            shippingFee = 0, usedPoints = 0, pointsAmount = 0, couponInfo,
            memberCouponId, memberCouponIds, disableMemberDiscount, payAfterService
        } = params;
        const cashierDiscountInput = Number(params.cashierDiscountAmount ?? 0);
        const cashierDiscountManual = Number.isFinite(cashierDiscountInput) && cashierDiscountInput > 0 ? cashierDiscountInput : 0;
        const isGuestOrderFlag = !!params._isGuestOrder;
        const proxyAdminUserId = params._proxyAdminUserId ?? null;
        const proxyAdminSnapshot = params._proxyAdminSnapshot ?? null;
        
        if (!items || items.length === 0) throw new Error('订单项不能为空');

        return this.prisma.$transaction(async (tx) => {
            // 若为商品订单，检查是否包含实体商品，并结合 noExpress 与商品发货形式决定地址是否必填
            let requiresAddress = false;
            const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
            let physicalExists = false;
            let shipAllowExpressOk = true;
            let shipAllowPickupOk = true;
            if (type === 'SP' && productIds.length > 0) {
                const products = await tx.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, type: true, shipAllowExpress: true, shipAllowPickup: true }
                });
                const map = new Map(products.map(p => [p.id, p] as const));
                for (const it of items) {
                    const p = it.productId ? map.get(it.productId) : undefined;
                    if (!p) continue;
                    if (p.type === 'PHYSICAL') {
                        physicalExists = true;
                        shipAllowExpressOk = shipAllowExpressOk && (p.shipAllowExpress !== false);
                        shipAllowPickupOk = shipAllowPickupOk && (p.shipAllowPickup !== false);
                    }
                }
                // 选择自提(noExpress=true)：必须所有实物商品允许自提
                if (physicalExists && !!noExpress && !shipAllowPickupOk) throw new Error('该订单包含不支持到店自提的实物商品');
                // 选择快递(noExpress!=true)：必须所有实物商品允许快递
                if (physicalExists && !noExpress && !shipAllowExpressOk) throw new Error('该订单包含仅支持自提的实物商品');
                // 地址仅在选择快递且存在实物时必填
                requiresAddress = physicalExists && !noExpress;
            }
            
            let addressSnapshot: Prisma.InputJsonValue | undefined = undefined;
            let addressIdToSave: number | null = null;
            if (requiresAddress && !noExpress) {
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
                };
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
                    };
                }
            }
            
            // 计算金额（含优惠券折扣）
            let total = new Prisma.Decimal(0);
            let discountTotal = new Prisma.Decimal(0);
            for (const it of items) {
                const price = new Prisma.Decimal(it.price as any);
                const discount = new Prisma.Decimal((it.discount ?? 0) as any);
                total = total.plus(price.mul(it.quantity));
                discountTotal = discountTotal.plus(discount);
            }
            
            // 游客订单：禁止使用优惠券
            const guestEnvId = resolveGuestMemberIdEnv();
            const guestMode = isGuestOrderFlag === true || (Number(memberId) === guestEnvId && guestEnvId > 0);
            // 优惠券校验与折扣（兼容旧单券 memberCouponId；新增多券 memberCouponIds）
            let memberCoupon: any = null;
            // 记录单券折扣金额，便于写入订单与日志
            let singleCouponDiscountApplied: Prisma.Decimal = new Prisma.Decimal(0);
            // 记录多券下每张券的折扣金额
            const couponDiscountByMemberCouponId: Record<number, Prisma.Decimal> = {};
            const ids = Array.isArray(memberCouponIds) && memberCouponIds.length > 0 ? memberCouponIds : (memberCouponId ? [memberCouponId] : []);
            
            if (!guestMode && ids.length === 1) {
                const memberCouponId = ids[0];
                memberCoupon = await (tx as any).memberCoupon.findUnique({
                    where: { id: memberCouponId },
                    include: { coupon: true }
                });
                if (!memberCoupon || memberCoupon.memberId !== memberId) throw new Error('优惠券无效');
                if (memberCoupon.usedAt) throw new Error('优惠券已使用');
                const now = new Date();
                if (memberCoupon.endAt && new Date(memberCoupon.endAt) < now) throw new Error('优惠券已过期');
                if (memberCoupon.startAt && new Date(memberCoupon.startAt) > now) throw new Error('优惠券未到生效时间');
                if (!memberCoupon.coupon?.enabled) throw new Error('优惠券已停用');
                if (memberCoupon.coupon?.type !== 'COUPON') throw new Error('优惠券类型不支持');
                
                // 叠加策略：与积分/会员折扣
                if (!memberCoupon.coupon?.allowStackWithPoints && (Number(usedPoints || 0) > 0 || Number(pointsAmount || 0) > 0)) {
                    throw new Error('该券不可与积分同用');
                }
                if (!memberCoupon.coupon?.allowStackWithMemberDiscount && !disableMemberDiscount) {
                    // 这里以商品的 memberDiscount 作为判别（如有任一商品启用会员折扣则不允许叠加）
                    const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
                    if (productIds.length) {
                        const products = await tx.product.findMany({
                            where: { id: { in: productIds } },
                            select: { id: true, memberDiscount: true }
                        });
                        if (products.some(p => p.memberDiscount)) throw new Error('该券不可与会员折扣同用');
                    }
                }
                
                // 适用范围与门槛口径
                let discountBase = total; // 缺省按整单
                let applicableSubtotal = total;
                if (memberCoupon.coupon?.applyScope === 'SPECIFIED') {
                    const applicable = await tx.couponApplicableProduct.findMany({
                        where: { couponId: memberCoupon.couponId },
                        select: { productId: true }
                    });
                    const allowed = new Set(applicable.map(a => a.productId));
                    const applicableItems = items.filter(it => (it.productId ? allowed.has(it.productId) : false));
                    if (applicableItems.length === 0) throw new Error('订单中无可用商品');
                    applicableSubtotal = applicableItems.reduce((s, it) => s.plus(new Prisma.Decimal(it.price as any).mul(it.quantity)), new Prisma.Decimal(0));
                    discountBase = applicableSubtotal; // 优惠口径按适用品项小计
                }
                
                // 最低订单额校验（按口径）
                if (memberCoupon.coupon?.minOrderAmount != null) {
                    const minAmt = new Prisma.Decimal(memberCoupon.coupon.minOrderAmount as any);
                    if (discountBase.lessThan(minAmt)) throw new Error('未达到使用门槛');
                }
                
                // 规则JSON折扣计算（优先），否则回退到面值直减
                const rule: any = (memberCoupon.coupon as any)?.ruleJson || null;
                let couponDiscount = new Prisma.Decimal(0);
                try {
                    if (rule && typeof rule === 'object') {
                        // applyBase: 'order'|'applicableItems'，默认按当前口径（discountBase）
                        const base = (rule.applyBase === 'order') ? total : discountBase;
                        let calc = new Prisma.Decimal(0);
                        if (rule.kind === 'percent') {
                            const pct = new Prisma.Decimal(Number(rule.percent || rule.amount || 0)).div(100);
                            if (pct.greaterThan(0)) calc = new Prisma.Decimal(base as any).mul(pct);
                        } else if (rule.kind === 'direct') {
                            calc = new Prisma.Decimal(Number(rule.amount || 0));
                        }
                        // 封顶
                        if (rule.cap != null) {
                            const cap = new Prisma.Decimal(Number(rule.cap || 0));
                            if (cap.greaterThan(0) && calc.greaterThan(cap)) calc = cap;
                        }
                        // 最低小计
                        if (rule.minSubtotal != null) {
                            const minS = new Prisma.Decimal(Number(rule.minSubtotal || 0));
                            if (base.lessThan(minS)) calc = new Prisma.Decimal(0);
                        }
                        // 折扣不得超过口径金额
                        if (calc.greaterThan(base)) calc = base as any;
                        couponDiscount = calc;
                    }
                } catch { /* ignore rule errors */ }
                
                if (couponDiscount.greaterThan(0)) {
                    discountTotal = discountTotal.plus(couponDiscount);
                    singleCouponDiscountApplied = couponDiscount;
                } else {
                    // 回退面值直减，且不超过口径金额
                    const face = new Prisma.Decimal(memberCoupon.coupon?.faceValue || 0);
                    const applied = face.greaterThan(discountBase) ? (discountBase as any) : face;
                    if (face.greaterThan(0)) discountTotal = discountTotal.plus(applied);
                    singleCouponDiscountApplied = applied as any;
                }
            } else if (!guestMode && ids.length > 1) {
                const now = new Date();
                const records: any[] = await (tx as any).memberCoupon.findMany({
                    where: { id: { in: ids } },
                    include: { coupon: true }
                });
                if (records.length !== ids.length) throw new Error('部分优惠券无效');
                
                for (const mc of records) {
                    if (mc.memberId !== memberId) throw new Error('优惠券归属无效');
                    if (mc.usedAt) throw new Error('存在已使用的优惠券');
                    if (mc.endAt && new Date(mc.endAt) < now) throw new Error('存在已过期优惠券');
                    if (mc.startAt && new Date(mc.startAt) > now) throw new Error('存在未到生效时间的优惠券');
                    if (!mc.coupon?.enabled) throw new Error('存在已停用优惠券');
                    if (mc.coupon?.type !== 'COUPON') throw new Error('存在不支持的优惠券类型');
                }
                
                if (records.some((mc: any) => !mc?.coupon?.allowCombine)) throw new Error('部分优惠券不支持叠加');
                if (records.some((mc: any) => mc?.coupon && mc.coupon.allowStackWithPoints === false)) {
                    if (Number(usedPoints || 0) > 0 || Number(pointsAmount || 0) > 0) throw new Error('所选优惠券不可与积分同用');
                }
                if (records.some((mc: any) => mc?.coupon && mc.coupon.allowStackWithMemberDiscount === false) && !disableMemberDiscount) {
                    const productIds = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
                    if (productIds.length) {
                        const products = await tx.product.findMany({
                            where: { id: { in: productIds } },
                            select: { id: true, memberDiscount: true }
                        });
                        if (products.some(p => p.memberDiscount)) throw new Error('所选优惠券不可与会员折扣同用');
                    }
                }
                
                for (const mc of records) {
                    let discountBase = total;
                    if (mc.coupon?.applyScope === 'SPECIFIED') {
                        const applicable = await tx.couponApplicableProduct.findMany({
                            where: { couponId: mc.couponId },
                            select: { productId: true }
                        });
                        const allowed = new Set(applicable.map(a => a.productId));
                        const applicableItems = items.filter(it => (it.productId ? allowed.has(it.productId) : false));
                        if (applicableItems.length === 0) throw new Error('订单中无可用商品');
                        const subtotal = applicableItems.reduce((s, it) => s.plus(new Prisma.Decimal(it.price as any).mul(it.quantity)), new Prisma.Decimal(0));
                        discountBase = subtotal;
                    }
                    if (mc.coupon?.minOrderAmount != null) {
                        const minAmt = new Prisma.Decimal(mc.coupon.minOrderAmount as any);
                        if (discountBase.lessThan(minAmt)) throw new Error('未达到使用门槛');
                    }
                    
                    const rule: any = (mc.coupon as any)?.ruleJson || null;
                    let calc = new Prisma.Decimal(0);
                    try {
                        if (rule && typeof rule === 'object') {
                            const base = (rule.applyBase === 'order') ? total : discountBase;
                            if (rule.kind === 'percent') {
                                const pct = new Prisma.Decimal(Number(rule.percent || rule.amount || 0)).div(100);
                                if (pct.greaterThan(0)) calc = new Prisma.Decimal(base as any).mul(pct);
                            } else if (rule.kind === 'direct') {
                                calc = new Prisma.Decimal(Number(rule.amount || 0));
                            }
                            if (rule.cap != null) {
                                const cap = new Prisma.Decimal(Number(rule.cap || 0));
                                if (cap.greaterThan(0) && calc.greaterThan(cap)) calc = cap;
                            }
                            if (rule.minSubtotal != null) {
                                const minS = new Prisma.Decimal(Number(rule.minSubtotal || 0));
                                const baseUse = (rule.applyBase === 'order') ? total : discountBase;
                                if (baseUse.lessThan(minS)) calc = new Prisma.Decimal(0);
                            }
                            if (calc.greaterThan((rule.applyBase === 'order') ? total : discountBase)) {
                                calc = (rule.applyBase === 'order') ? (total as any) : (discountBase as any);
                            }
                        }
                    } catch { /* ignore */ }
                    
                    if (calc.lte(0)) {
                        const face = new Prisma.Decimal(mc.coupon?.faceValue || 0);
                        calc = face.greaterThan(discountBase) ? (discountBase as any) : face;
                    }
                    
                    // 记录该券实际折扣
                    couponDiscountByMemberCouponId[mc.id] = calc as any;
                    discountTotal = discountTotal.plus(calc);
                }
                
                if (discountTotal.greaterThan(total)) discountTotal = total;
                // 记录：多券不写入 couponInfo 结构（前端可从订单金额与日志侧查明细）
            }
            
            // 会员折扣（按会员等级的 payDiscountPercent，作用于商品维度开启了 memberDiscount 的小计）
            let memberDiscountAmount = new Prisma.Decimal(0);
            try {
                if (disableMemberDiscount || guestMode) { throw new Error('DISABLED_BY_REQUEST'); }
                const productIdsAll = items.map(it => it.productId).filter((v): v is number => typeof v === 'number');
                const productFlags = productIdsAll.length ? await tx.product.findMany({
                    where: { id: { in: productIdsAll } },
                    select: { id: true, memberDiscount: true, pointsDeductible: true }
                }) : [];
                const flagMap = new Map<number, { id: number; memberDiscount: boolean; pointsDeductible: boolean }>(
                    productFlags.map(p => [p.id, {
                        id: p.id,
                        memberDiscount: !!(p as any).memberDiscount,
                        pointsDeductible: !!(p as any).pointsDeductible
                    }])
                );
                
                // 会员折扣资格与比例
                let payDiscountPercent = 0;
                try {
                    const m: any = await tx.member.findUnique({
                        where: { id: memberId },
                        select: { level: { select: { payDiscountPercent: true } } }
                    });
                    payDiscountPercent = Math.max(0, Math.min(100, Math.floor(Number(m?.level?.payDiscountPercent || 0))));
                } catch { payDiscountPercent = 0; }
                
                if (payDiscountPercent > 0) {
                    let eligible = new Prisma.Decimal(0);
                    for (const it of items) {
                        const pid = it.productId as any as number | undefined;
                        const f = (pid && flagMap.get(pid)) || undefined;
                        if (f && f.memberDiscount) {
                            const price = new Prisma.Decimal(it.price as any);
                            eligible = eligible.plus(price.mul(it.quantity));
                        }
                    }
                    if (eligible.greaterThan(0)) {
                        const pct = new Prisma.Decimal(payDiscountPercent as any).div(100);
                        memberDiscountAmount = eligible.mul(pct);
                        // 折扣不应超过当前可折扣基数
                        const maxAllow = total.minus(discountTotal);
                        if (memberDiscountAmount.greaterThan(maxAllow)) memberDiscountAmount = maxAllow as any;
                        discountTotal = discountTotal.plus(memberDiscountAmount);
                    }
                }
                
                // 将积分抵扣基数限定于支持 pointsDeductible 的商品比例
                // 下面积分计算会使用该比例
                (this as any)._pointsEligibleRatio = (() => {
                    try {
                        let eligible = new Prisma.Decimal(0);
                        for (const it of items) {
                            const pid = it.productId as any as number | undefined;
                            const f = (pid && flagMap.get(pid)) || undefined;
                            if (f && f.pointsDeductible) {
                                const price = new Prisma.Decimal(it.price as any);
                                eligible = eligible.plus(price.mul(it.quantity));
                            }
                        }
                        if (total.lte(0)) return 0;
                        const ratio = Number(eligible.div(total));
                        if (!Number.isFinite(ratio) || ratio <= 0) return 0;
                        return Math.min(1, Math.max(0, ratio));
                    } catch { return 0; }
                })();
            } catch {
                // 忽略会员折扣/可抵扣比例异常
            }
            
            // 按配置与会员积分余额，核算积分可抵扣金额与实际可用积分（游客强制为0）
            let usedPointsCalc = guestMode ? 0 : Math.max(0, Math.floor(Number(usedPoints || 0)));
            let pointsAmountCalcFen = 0; // 单位：分
            try {
                if (guestMode) { throw new Error('GUEST_FORBID_POINTS'); }
                const ss: any = await tx.siteSetting.findFirst().catch(() => null);
                const fenPerPoint = Math.max(0, Number(ss?.pointsFenPerPoint || 0));
                const maxFenPerOrder = Math.max(0, Number(ss?.pointsMaxDeductFenPerOrder || 0));
                if (fenPerPoint > 0 && usedPointsCalc > 0) {
                    const m = await tx.member.findUnique({ where: { id: memberId }, select: { points: true } });
                    const balancePts = Math.max(0, Number(m?.points || 0));
                    
                    // 计算最小积分单位（必须达到能抵扣1分的积分数）
                    const minPointsUnit = Math.ceil(100 / fenPerPoint);
                    
                    // 检查用户积分是否达到最小使用单位
                    if (balancePts < minPointsUnit) {
                        usedPointsCalc = 0;
                        pointsAmountCalcFen = 0;
                    } else {
                        // 用户请求的积分数必须按最小单位对齐
                        usedPointsCalc = Math.floor(usedPointsCalc / minPointsUnit) * minPointsUnit;
                        
                        // 可用积分上限（受余额与单单封顶约束）
                        const grossFen = Number(total.minus(discountTotal).plus(new Prisma.Decimal(shippingFee as any)).mul(100).toFixed(0));
                        const ratio = Number((this as any)._pointsEligibleRatio || 0);
                        const payBeforePointsFen = Math.max(0, Math.floor(grossFen * (Number.isFinite(ratio) ? ratio : 1)));
                        
                        // fenPerPoint实际存储的是100积分对应的分值，所以每积分的分值是fenPerPoint/100
                        const actualFenPerPoint = fenPerPoint / 100;
                        
                        // 计算用户积分可抵扣的最大金额（分）
                        const balanceAligned = Math.floor(balancePts / minPointsUnit) * minPointsUnit;
                        let capFenByPoints = Math.floor(balanceAligned * actualFenPerPoint);
                        
                        // 计算用户请求积分可抵扣的金额（分）
                        let reqFenByPoints = Math.floor(usedPointsCalc * actualFenPerPoint);
                        
                        // 应用订单上限
                        if (maxFenPerOrder > 0) {
                            capFenByPoints = Math.min(capFenByPoints, maxFenPerOrder);
                            reqFenByPoints = Math.min(reqFenByPoints, maxFenPerOrder);
                        }
                        
                        // 至少保留 1 分以避免 0 元订单（后续仍有 0.01 的兜底）
                        const finalCapFen = Math.max(0, Math.min(capFenByPoints, Math.max(0, payBeforePointsFen - 1)));
                        pointsAmountCalcFen = Math.min(reqFenByPoints, finalCapFen);
                        
                        // 根据实际抵扣金额反推实际使用的积分数（按最小单位对齐）
                        if (actualFenPerPoint > 0) {
                            const calculatedPoints = Math.floor(pointsAmountCalcFen / actualFenPerPoint);
                            usedPointsCalc = Math.floor(calculatedPoints / minPointsUnit) * minPointsUnit;
                            // 重新计算抵扣金额，确保与积分数匹配
                            pointsAmountCalcFen = Math.floor(usedPointsCalc * actualFenPerPoint);
                        } else {
                            usedPointsCalc = 0;
                        }
                    }
                }
            } catch { }
            
            // 收银立减：仅由管理员代客/收银端使用；不能大于当前应付口径
            let cashierDiscountFinal = new Prisma.Decimal(0);
            if (cashierDiscountManual > 0) {
                // 仅管理员代客或后台/收银台内部允许手动优惠；普通小程序下单时忽略
                const allowManualDiscount = !!proxyAdminUserId || !!(params as any)?._posInternalDiscountAllowed; // 代客下单/后台 或 POS 内部
                if (allowManualDiscount) {
                    const beforeManual = total.minus(discountTotal);
                    const req = new Prisma.Decimal(cashierDiscountManual as any);
                    cashierDiscountFinal = req.greaterThan(beforeManual) ? (beforeManual as any) : req;
                    discountTotal = discountTotal.plus(cashierDiscountFinal);
                }
            }

            const shipping = new Prisma.Decimal(shippingFee as any);
            const payAmount = total.minus(discountTotal).plus(shipping).minus(new Prisma.Decimal((pointsAmountCalcFen / 100) as any));
            // POS 需求：若为代客下单或 POS 内部标记，允许 0 元订单（仅内部支付方式）。否则保持原 0.01 兜底。
            const allowZeroPay = !!proxyAdminUserId || !!(params as any)?._posInternalDiscountAllowed;
            const minPay = allowZeroPay ? new Prisma.Decimal(0 as any) : new Prisma.Decimal(0.01 as any);
            const payAmountAdjusted = payAmount.lessThan(minPay) ? minPay : payAmount;

            // 预生成订单号，便于库存预占日志记录
            const orderNo = this.generateOrderNo(type as any);

            // 下单即预占库存（仅实体商品 PHYSICAL 与 虚拟卡券 VIRTUAL_CARD）
            for (const it of items) {
                if (!it.productId) continue;
                const product = await tx.product.findUnique({
                    where: { id: it.productId },
                    select: { id: true, type: true, specType: true }
                });
                if (!product) continue;
                if (product.type !== 'PHYSICAL' && product.type !== 'VIRTUAL_CARD') continue;
                const qty = Math.max(1, Number(it.quantity || 0));
                
                if (product.specType === 'MULTI') {
                    if (!it.skuId) throw new Error('订单包含多规格商品但缺少 skuId');
                    // 条件扣减：避免并发超卖
                    const res = await tx.productSku.updateMany({
                        where: { id: it.skuId, stockQuantity: { gte: qty } },
                        data: { stockQuantity: { decrement: qty } }
                    });
                    if ((res as any).count !== undefined) {
                        if (Number((res as any).count || 0) !== 1) throw new Error('库存不足，无法下单');
                    } else {
                        if (Number(res || 0) !== 1) throw new Error('库存不足，无法下单');
                    }
                    const afterRow = await tx.productSku.findUnique({
                        where: { id: it.skuId },
                        select: { stockQuantity: true }
                    });
                    const after = Number(afterRow?.stockQuantity || 0);
                    const before = after + qty;
                    await tx.inventoryLog.create({
                        data: {
                            productId: product.id,
                            skuId: it.skuId,
                            change: -qty,
                            beforeStock: before,
                            afterStock: after,
                            reason: 'ORDER_DEDUCT' as any,
                            remark: `订单预占（订单号：${orderNo}）`,
                            operatorUserId: null
                        }
                    });
                } else {
                    const res = await tx.product.updateMany({
                        where: { id: product.id, stockQuantity: { gte: qty } },
                        data: { stockQuantity: { decrement: qty } }
                    });
                    if ((res as any).count !== undefined) {
                        if (Number((res as any).count || 0) !== 1) throw new Error('库存不足，无法下单');
                    } else {
                        if (Number(res || 0) !== 1) throw new Error('库存不足，无法下单');
                    }
                    const afterRow = await tx.product.findUnique({
                        where: { id: product.id },
                        select: { stockQuantity: true }
                    });
                    const after = Number(afterRow?.stockQuantity || 0);
                    const before = after + qty;
                    await tx.inventoryLog.create({
                        data: {
                            productId: product.id,
                            skuId: null,
                            change: -qty,
                            beforeStock: before,
                            afterStock: after,
                            reason: 'ORDER_DEDUCT' as any,
                            remark: `订单预占（订单号：${orderNo}）`,
                            operatorUserId: null
                        }
                    });
                }
            }

            const order = await tx.order.create({
                data: {
                    no: orderNo,
                    type,
                    status: 'CREATED' as OrderStatus,
                    fulfillmentStatus: (type === 'FK' ? 'NONE' : 'PENDING') as FulfillmentStatus,
                    totalAmount: total,
                    discountAmount: discountTotal,
                    memberDiscountAmount: memberDiscountAmount,
                    cashierDiscountAmount: cashierDiscountFinal,
                    payAmount: payAmountAdjusted,
                    shippingFee: shipping,
                    // 自提/无需快递：下单即标记，无需地址
                    shipNoExpress: !!noExpress,
                    payStatus: 'UNPAID',
                    memberId,
                    vehicleId: vehicleId ?? null,
                    groupId: groupId ?? null,
                    payAfterService: !!(payAfterService && type === 'SERVICE'),
                    paymentExpireAt: (payAfterService && type === 'SERVICE') ? null : new Date(Date.now() + 15 * 60 * 1000),
                    // 用户备注写入 userRemark；系统备注 remark 留作系统流程使用
                    userRemark: (userRemark ?? remark) ?? null,
                    usedPoints: usedPointsCalc,
                    pointsAmount: new Prisma.Decimal((pointsAmountCalcFen / 100) as any),
                    couponInfo: memberCoupon ? ({
                        id: memberCoupon.id,
                        couponId: memberCoupon.couponId,
                        faceValue: memberCoupon.coupon?.faceValue ?? null,
                        name: memberCoupon.name ?? memberCoupon.coupon?.name ?? null,
                        discountApplied: Number(singleCouponDiscountApplied || 0)
                    } as any) : (guestMode ? undefined : (couponInfo ?? undefined)),
                    shippingAddressId: addressIdToSave,
                    shippingAddressSnapshot: addressSnapshot,
                    isGuestOrder: guestMode,
                    isProxyOrder: !!proxyAdminUserId,
                    proxyAdminUserId: proxyAdminUserId ?? null,
                    proxyAdminSnapshot: proxyAdminSnapshot ?? null,
                } as any,
            });
            
            await this.writeTimeline({ tx, orderId: order.id, event: 'ORDER_STATUS', value: 'CREATED' });
            await this.writeTimeline({ tx, orderId: order.id, event: 'PAY_STATUS', value: 'UNPAID' });
            await this.writeTimeline({ tx, orderId: order.id, event: 'FULFILLMENT', value: String(order.fulfillmentStatus) });
            
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
            
            // 扣减积分余额并记账
            if (usedPointsCalc > 0) {
                await tx.member.update({ where: { id: memberId }, data: { points: { decrement: usedPointsCalc } } });
                await (tx as any).memberPointsLog.create({
                    data: {
                        memberId,
                        change: -usedPointsCalc,
                        source: 'USE',
                        desc: `订单抵扣 ${order.no}`,
                        orderId: order.id
                    }
                });
            }
            
            // 标记用券
            if (memberCoupon) {
                await (tx as any).memberCoupon.update({
                    where: { id: memberCoupon.id },
                    data: { usedAt: new Date(), orderId: order.id }
                });
                try {
                    const mc = await (tx as any).memberCoupon.findUnique({
                        where: { id: memberCoupon.id },
                        include: { coupon: true }
                    });
                    await (tx as any).couponFlowLog.create({
                        data: {
                            action: 'USE',
                            memberId,
                            orderId: order.id,
                            couponId: mc?.couponId ?? null,
                            memberCouponId: memberCoupon?.id ?? null,
                            count: 1,
                            remark: '订单使用',
                            snapshot: {
                                couponId: mc?.couponId ?? null,
                                couponName: mc?.coupon?.name ?? null,
                                memberCouponId: memberCoupon?.id ?? null,
                                memberCouponName: mc?.name ?? null,
                                discountApplied: Number(singleCouponDiscountApplied || 0)
                            }
                        }
                    });
                } catch { }
            } else if (!guestMode && Array.isArray(memberCouponIds) && memberCouponIds.length > 1) {
                for (const cid of memberCouponIds) {
                    await (tx as any).memberCoupon.update({
                        where: { id: cid },
                        data: { usedAt: new Date(), orderId: order.id }
                    });
                    try {
                        const mc = await (tx as any).memberCoupon.findUnique({
                            where: { id: cid },
                            include: { coupon: true }
                        });
                        const applied = couponDiscountByMemberCouponId[cid];
                        await (tx as any).couponFlowLog.create({
                            data: {
                                action: 'USE',
                                memberId,
                                orderId: order.id,
                                couponId: mc?.couponId ?? null,
                                memberCouponId: cid,
                                count: 1,
                                remark: '订单使用',
                                snapshot: {
                                    couponId: mc?.couponId ?? null,
                                    couponName: mc?.coupon?.name ?? null,
                                    memberCouponId: cid ?? null,
                                    memberCouponName: mc?.name ?? null,
                                    discountApplied: Number(applied || 0)
                                }
                            }
                        });
                    } catch { }
                }
            }
            
            // 计算支付超时时间（15分钟）并返回给前端用于倒计时
            try {
                const createdAt: any = (order as any)?.createdAt || new Date();
                const base = new Date(createdAt).getTime();
                const expireAt = new Date(base + 15 * 60 * 1000);
                const expireRemainSeconds = Math.max(0, Math.floor((expireAt.getTime() - Date.now()) / 1000));
                return { id: order.id, no: order.no, expireAt, expireRemainSeconds } as any;
            } catch {
                return { id: order.id, no: order.no } as any;
            }
        }).then(async (res: any) => {
            try {
                const itemsSaved: Array<{ id: number; imageUrl: string | null }> = await this.prisma.orderItem.findMany({
                    where: { orderId: res.id },
                    select: { id: true, imageUrl: true }
                });
                for (const it of itemsSaved) {
                    if (it.imageUrl) {
                        try {
                            await this.syncBindings('OrderItem', String(it.id), 'imageUrl', [it.imageUrl]);
                        } catch { }
                    }
                }
            } catch { }
            // 管理通知：新订单提醒（为每个管理员持久化并广播，按模板渲染标题/正文，携带 UI 属性）
            try{
                const ord:any = await this.prisma.order.findUnique({ where: { id: res.id }, select: { id:true, no:true, payAmount:true, type:true } });
                const link = `/orders/${ord?.id||0}`;
                const amountStr = Number(ord?.payAmount||0).toFixed(2);
                const rawType = String(ord?.type||'').toUpperCase();
                const typeText = rawType === 'SP' ? '商品' : (rawType === 'SERVICE' ? '服务' : (rawType === 'FK' ? '付款' : rawType));
                const vars = { no: ord?.no, amount: amountStr, type: typeText } as any;
                const fallback = { title: '新订单提醒', content: `订单 ${ord?.no||''} 金额￥${amountStr}，类型：${typeText}` } as any;
                const admins = await this.prisma.user.findMany({ select: { id: true } });
                for (const u of admins){
                    await this.notifier?.sendByTemplate('ADMIN_NEW_ORDER', vars, { kind:'ADMIN', userId: u.id }, fallback, link);
                }
            }catch{}
            return res;
        });
    }

    private async enrichOrderWithProductTypes(order: any) {
        try {
            if (!order) return order;
            const items = Array.isArray(order.items) ? order.items : [];
            const rawIds: number[] = items
                .map((it: any) => Number(it?.productId))
                .filter((v: number) => Number.isFinite(v));
            const productIds: number[] = Array.from(new Set(rawIds));
            if (!productIds.length) return order;
            const products = await this.prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, type: true }
            });
            const map = new Map(products.map(p => [p.id, p.type] as const));
            order.items = items.map((it: any) => ({
                ...it,
                productType: it?.productId ? (map.get(it.productId) || null) : null
            }));
        } catch { }
        return order;
    }

    async getOrder(id: number) {
        const o = await this.prisma.order.findUnique({
            where: { id },
            include: {
                items: true,
                member: true,
                vehicle: true,
                afterSalesRequests: true,
                timelines: { orderBy: { createdAt: 'asc' } },
                refundRecords: { orderBy: { id: 'desc' } },
                couponRestoreLogs: { orderBy: { id: 'desc' } },
                couponFlows: {
                    orderBy: { id: 'desc' },
                    include: { coupon: true, memberCoupon: true }
                },
                // 订单关联的积分日志（仅用于后台展示；控制器会对非管理员剔除）
                // 仅选择必要字段，避免把积分日志的其它潜在敏感信息带到响应中
                pointsLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                    select: { id: true, createdAt: true, change: true, source: true, desc: true },
                } as any,
                proxyAdminUser: { select: { id: true, name: true, phone: true } }
            }
        });
        return await this.enrichOrderWithProductTypes(o);
    }

    async getOrderByNo(no: string) {
        const o = await this.prisma.order.findUnique({
            where: { no },
            include: {
                items: true,
                member: true,
                vehicle: true,
                afterSalesRequests: true,
                timelines: { orderBy: { createdAt: 'asc' } },
                refundRecords: { orderBy: { id: 'desc' } },
                couponRestoreLogs: { orderBy: { id: 'desc' } },
                couponFlows: {
                    orderBy: { id: 'desc' },
                    include: { coupon: true, memberCoupon: true }
                },
                pointsLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 200,
                    select: { id: true, createdAt: true, change: true, source: true, desc: true },
                } as any,
                proxyAdminUser: { select: { id: true, name: true, phone: true } }
            }
        });
        return await this.enrichOrderWithProductTypes(o);
    }

    listOrders(query: {
        type?: OrderType | undefined;
        status?: OrderStatus | undefined;
        payStatus?: PayStatus | undefined;
        memberId?: number | undefined;
        keyword?: string | undefined;
        start?: string | undefined;
        end?: string | undefined;
        scene?: string | undefined;
        includeDeleted?: boolean | undefined;
    }) {
        const where: Prisma.OrderWhereInput = {};
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;
        if (query.payStatus) where.payStatus = query.payStatus;
        if (query.memberId) where.memberId = query.memberId;
        
        // 统一场景筛选（用于小程序与后台快捷筛选）
        if (query.scene) {
            const scene = String(query.scene).toUpperCase();
            if (scene === 'PENDING_PAYMENT') {
                where.payStatus = 'UNPAID';
            } else if (scene === 'REFUND_AFTERSALE') {
                where.OR = [
                    { payStatus: 'REFUNDED' },
                    { afterSalesRequests: { some: { status: { in: ['PENDING', 'APPROVED'] } } } },
                ];
            } else if (scene === 'PENDING_SERVICE') {
                where.type = 'SERVICE';
                where.payStatus = 'PAID';
                where.fulfillmentStatus = { in: ['PENDING', 'IN_SERVICE'] };
            } else if (scene === 'PENDING_DELIVERY') {
                where.type = 'SP';
                where.payStatus = 'PAID';
                where.fulfillmentStatus = 'PENDING';
            } else if (scene === 'PENDING_RECEIPT') {
                where.type = 'SP';
                where.payStatus = 'PAID';
                // 兼容旧数据
                where.OR = [
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'SHIPPED' }] },
                    { AND: [{ type: 'SP' }, { status: 'FULFILLED' }] },
                ];
            } else if (scene === 'COMPLETED') {
                const rules: Prisma.OrderWhereInput[] = [
                    { AND: [{ type: 'SERVICE' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'DONE' }] },
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'RECEIVED' }] },
                    { AND: [{ type: 'FK' }, { payStatus: 'PAID' }] },
                    { AND: [{ type: 'SERVICE' }, { status: 'FULFILLED' }] },
                    { AND: [{ type: 'SP' }, { status: 'CLOSED' }] },
                ];
                where.OR = rules;
            } else if (scene === 'CANCELLED') {
                if (query.type) {
                    where.OR = [
                        { AND: [{ type: query.type }, { status: 'CANCELLED' }] },
                        { AND: [{ type: query.type }, { payStatus: 'CANCELLED' }] },
                    ];
                } else {
                    where.OR = [
                        { status: 'CANCELLED' },
                        { payStatus: 'CANCELLED' },
                    ];
                }
            } else if (scene === 'REVIEW') {
                const rules: Prisma.OrderWhereInput[] = [
                    { AND: [{ type: 'SERVICE' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'DONE' }] },
                    { AND: [{ type: 'SP' }, { payStatus: 'PAID' }, { fulfillmentStatus: 'RECEIVED' }] },
                    { AND: [{ type: 'FK' }, { payStatus: 'PAID' }] },
                    { AND: [{ type: 'SERVICE' }, { status: 'FULFILLED' }] },
                    { AND: [{ type: 'SP' }, { status: 'CLOSED' }] },
                ];
                where.OR = rules;
            } else if (scene === 'DELETED') {
                where.deletedAt = { not: null };
            }
        }
        
        // 后台可全量查看时允许带 includeDeleted=true；小程序不会传该参数
        if (!query.includeDeleted) {
            where.deletedAt = null;
        }
        
        if (query.keyword) {
            const kw = query.keyword;
            where.OR = [
                { no: { contains: kw } },
                { remark: { contains: kw } },
                { userRemark: { contains: kw } },
                { paymentNote: { contains: kw } },
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
            if (Object.keys(createdAt).length) where.createdAt = createdAt;
        }
        
        return this.prisma.order.findMany({
            where,
            orderBy: [{ id: 'desc' }],
            include: { items: true, member: true, afterSalesRequests: true }
        });
    }

    // 管理后台：调整未支付订单的收银立减金额（单位：元，>=0）
    async adjustCashierDiscount(orderId: number, amount: number, operatorUserId?: number | null){
        const id = Number(orderId||0);
        if (!Number.isFinite(id) || id<=0) throw new Error('订单ID无效');
        const req = Math.max(0, Number(amount||0));
        const order = await this.prisma.order.findUnique({ where: { id }, select: {
            id: true,
            payStatus: true,
            totalAmount: true,
            discountAmount: true,
            memberDiscountAmount: true,
            cashierDiscountAmount: true,
            shippingFee: true,
            pointsAmount: true,
        } });
        if (!order) throw new Error('订单不存在');
        if (String(order.payStatus||'').toUpperCase() !== 'UNPAID') throw new Error('仅未支付订单可调整收银立减');
        const total = new Prisma.Decimal(order.totalAmount as any);
        const discount = new Prisma.Decimal(order.discountAmount as any);
        const cashierPrev = new Prisma.Decimal(order.cashierDiscountAmount as any);
        const shipping = new Prisma.Decimal(order.shippingFee as any);
        const pointsAmt = new Prisma.Decimal(order.pointsAmount as any);
        // 立减上限：不含收银立减的应收基数（不含运费，含券/会员等折扣）
        const discountBeforeCashier = discount.minus(cashierPrev);
        const baseBeforeCashier = total.minus(discountBeforeCashier);
        let allow = baseBeforeCashier;
        if (allow.lessThan(0)) allow = new Prisma.Decimal(0);
        const want = new Prisma.Decimal(req);
        const cashierFinal = want.greaterThan(allow) ? allow : want;
        // 新的折扣总额与应收
        const discountNew = discountBeforeCashier.plus(cashierFinal);
        let payAmount = total.minus(discountNew).plus(shipping).minus(pointsAmt);
        if (payAmount.lessThan(0)) payAmount = new Prisma.Decimal(0);
        const updated = await this.prisma.order.update({ where: { id }, data: {
            cashierDiscountAmount: cashierFinal,
            discountAmount: discountNew,
            payAmount: payAmount,
        } });
        try { await this.writeTimeline({ orderId: id, event: 'NOTE', value: 'CASHIER_DISCOUNT_ADJUST', remark: `调整为：${cashierFinal.toFixed(2)}`, operatorUserId: operatorUserId ?? null }); } catch {}
        return { ok: true, id: updated.id, cashierDiscountAmount: Number(cashierFinal), payAmount: Number(payAmount) };
    }
}
