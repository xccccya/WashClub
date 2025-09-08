import { Controller, Get, Post, Param, ParseIntPipe, Headers, Query, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { CouponService } from './coupon.service.js';

@ApiTags('MiniappCoupons')
@Controller('coupon/miniapp')
export class MiniappCouponController {
    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
        private readonly svc: CouponService,
    ) {}

    private async getMemberIdFromToken(headers: Record<string, string>, tokenParam?: string): Promise<number> {
        const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
        const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
        const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
        const id = Number(decoded?.sub);
        if (!id || decoded?.type !== 'member') throw new Error('Token无效');
        return id;
    }

    @Get('claimable')
    @ApiOperation({ summary: '小程序可领取优惠券列表（含售罄/达上限标记）' })
    async listClaimable(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
        const memberId = await this.getMemberIdFromToken(headers, tokenParam);
        const coupons = await this.prisma.coupon.findMany({ where: { enabled: true, allowMiniappClaim: true, type: 'COUPON' }, orderBy: [{ id: 'desc' }] });
        const result: any[] = [];
        for (const c of coupons) {
            const issued = await (this.prisma as any).memberCoupon.count({ where: { couponId: c.id } });
            const owned = await (this.prisma as any).memberCoupon.count({ where: { couponId: c.id, memberId } });
            const soldOut = c.issueTotal != null ? issued >= Number(c.issueTotal) : false;
            const reachedLimit = c.perMemberLimit != null ? owned >= Number(c.perMemberLimit) : false;
            const now = new Date();
            const notStarted = c.expiryType === 'FIXED' && c.startAt ? (c.startAt > now) : false;
            const expired = c.expiryType === 'FIXED' && c.endAt ? (c.endAt < now) : false;
            const canClaim = !soldOut && !reachedLimit;
            // 规则展示字段（便于小程序端展示直减与折扣）
            let ruleKind: string | null = null;
            let rulePercent: number | null = null; // 折扣百分比（OFF 百分比，例如 20 表示 20% OFF）
            let ruleAmount: number | null = null;  // 直减金额
            let ruleCap: number | null = null;     // 折扣封顶金额（仅折扣券适用）
            let ruleMinSubtotal: number | null = null; // 最低小计门槛（规则维度）
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rule: any = (c as any)?.ruleJson || null;
                if (rule && typeof rule === 'object') {
                    ruleKind = String(rule.kind || '').toLowerCase() || null;
                    if (ruleKind === 'percent') {
                        rulePercent = Number(rule.percent ?? rule.amount ?? 0) || 0;
                        if (rule.cap != null) ruleCap = Number(rule.cap || 0) || 0;
                    } else if (ruleKind === 'direct') {
                        ruleAmount = Number(rule.amount ?? 0) || 0;
                    }
                    if (rule.minSubtotal != null) ruleMinSubtotal = Number(rule.minSubtotal || 0) || 0;
                }
            } catch {}
            result.push({
                id: c.id,
                name: c.name,
                imageUrl: c.imageUrl,
                description: c.description,
                expiryType: c.expiryType,
                startAt: c.startAt,
                endAt: c.endAt,
                validDays: c.validDays,
                faceValue: c.faceValue,
                minOrderAmount: c.minOrderAmount,
                perMemberLimit: c.perMemberLimit,
                issueTotal: c.issueTotal,
                allowMiniappClaim: c.allowMiniappClaim,
                issuedCount: issued,
                ownedCount: owned,
                soldOut,
                reachedLimit,
                notStarted,
                expired,
                canClaim: canClaim && !notStarted && !expired,
                // 新增字段：前端展示所需
                ruleKind,
                rulePercent,
                ruleAmount,
                ruleCap,
                ruleMinSubtotal,
                applyScope: c.applyScope,
                allowCombine: c.allowCombine,
                allowStackWithPoints: c.allowStackWithPoints,
                allowStackWithMemberDiscount: c.allowStackWithMemberDiscount,
            });
        }
        return { items: result };
    }

    @Get('mine')
    @ApiOperation({ summary: '小程序：我的优惠券列表' })
    async myCoupons(
        @Headers() headers: Record<string, string>,
        @Query('token') tokenParam?: string,
        @Query('used') used?: '0'|'1',
        @Query('expired') expired?: '0'|'1',
        @Query('notStarted') notStartedQ?: '0'|'1',
    ){
        const memberId = await this.getMemberIdFromToken(headers, tokenParam);
        const now = new Date();
        const where: any = { memberId };
        if (used === '0') where.usedAt = null;
        if (used === '1') where.usedAt = { not: null };
        if (expired === '0') where.OR = [{ endAt: null }, { endAt: { gt: now } }];
        if (expired === '1') where.endAt = { lte: now };
        const items = await (this.prisma as any).memberCoupon.findMany({ where, orderBy: { id: 'desc' }, include: { coupon: true } });
        // 前端需要“未生效”筛选：startAt 在未来的
        const out = Array.isArray(items) ? items.filter((mc: any) => {
            if (notStartedQ === '1') {
                if (mc.startAt && new Date(mc.startAt) > now) return true;
                if (!mc.startAt && mc.coupon?.startAt && new Date(mc.coupon.startAt) > now) return true;
                return false;
            }
            return true;
        }) : items;
        return { items: out };
    }

    @Post(':id/claim')
    @ApiOperation({ summary: '小程序领取优惠券' })
    async claim(@Param('id', ParseIntPipe) id: number, @Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
        const memberId = await this.getMemberIdFromToken(headers, tokenParam);
        const r = await this.svc.claimForMember({ couponId: id, memberId });
        return r;
    }

    // 计算当前商品/购物车可用优惠券与预计折扣
    @Post('applicable')
    async applicable(
        @Headers() headers: Record<string, string>,
        @Query('token') tokenParam?: string,
        // body: { items: Array<{ productId:number; price:number; quantity:number }> }
        // 备注：仅用于预计算，不持久化
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        @Body() body?: any,
    ){
        const memberId = await this.getMemberIdFromToken(headers, tokenParam);
        const items: Array<{ productId?: number|null; price: number; quantity: number }> = Array.isArray(body?.items) ? body.items : [];
        // 读取可用会员优惠券（未使用、未过期、已生效、启用）
        const now = new Date();
        const mcs: any[] = await (this.prisma as any).memberCoupon.findMany({ where: { memberId, usedAt: null }, include: { coupon: true } });
        const total = items.reduce((s, it)=> s + Number(it?.price||0) * Number(it?.quantity||0), 0);
        // 逐张计算
        const out: any[] = [];
        for (const mc of mcs) {
            const c = mc.coupon;
            if (!c || !c.enabled) continue;
            if (c.type !== 'COUPON') continue;
            if (mc.endAt && new Date(mc.endAt) < now) continue;
            if (mc.startAt && new Date(mc.startAt) > now) continue;
            // 计算口径
            let discountBase = total;
            if (c.applyScope === 'SPECIFIED') {
                const applicable = await this.prisma.couponApplicableProduct.findMany({ where: { couponId: c.id }, select: { productId: true } });
                const allowed = new Set(applicable.map(a=>a.productId));
                const applicableItems = items.filter(it => (it?.productId ? allowed.has(Number(it.productId)) : false));
                if (applicableItems.length === 0) continue;
                discountBase = applicableItems.reduce((s, it)=> s + Number(it.price||0) * Number(it.quantity||0), 0);
            }
            if (c.minOrderAmount != null && Number(discountBase) < Number(c.minOrderAmount)) continue;
            // 规则计算
            let calc = 0;
            const rule: any = c?.ruleJson || null;
            try{
                if (rule && typeof rule === 'object'){
                    const base = (rule.applyBase === 'order') ? total : discountBase;
                    if (rule.kind === 'percent') {
                        const pct = Number(rule.percent || rule.amount || 0) / 100;
                        if (pct > 0) calc = base * pct;
                        if (rule.cap != null) calc = Math.min(calc, Number(rule.cap||0));
                    } else if (rule.kind === 'direct') {
                        calc = Number(rule.amount||0);
                    }
                    if (rule.minSubtotal != null){ const minS = Number(rule.minSubtotal||0); const baseUse = (rule.applyBase === 'order') ? total : discountBase; if (baseUse < minS) calc = 0; }
                    calc = Math.min(calc, (rule.applyBase === 'order') ? total : discountBase);
                }
            }catch{}
            if (!(calc > 0)) calc = Math.min(Number(c.faceValue||0), discountBase);
            if (calc <= 0) continue;
            out.push({
                id: mc.id,
                couponId: c.id,
                name: mc.name || c.name,
                allowCombine: !!c.allowCombine,
                allowStackWithPoints: !!c.allowStackWithPoints,
                allowStackWithMemberDiscount: !!c.allowStackWithMemberDiscount,
                discountApplied: Number(calc.toFixed(2))
            });
        }
        // 排序：折扣高优先
        out.sort((a,b)=> Number(b.discountApplied||0) - Number(a.discountApplied||0));
        return { applicable: out };
    }
}


