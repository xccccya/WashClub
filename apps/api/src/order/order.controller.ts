import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Headers, Req, Res, BadRequestException, UseGuards, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { OrderPaymentService } from './order-payment.service.js';
import { OrderRefundService } from './order-refund.service.js';
import { OrderAfterSalesService } from './order-aftersales.service.js';
import { OrderFulfillmentService } from './order-fulfillment.service.js';
import { OrderReviewService } from './order-review.service.js';
import { TanshuService } from './tanshu.service.js';
import { WechatShippingService } from './wechat-shipping.service.js';
import { JwtService } from '@nestjs/jwt';
import { WxpayService } from './wxpay.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { resolveGuestMemberIdEnv } from '../env.js';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma.service.js';
import type { AuthJwtPayload, CreateFkBody, CreateOrderBody, ProxyAdminSnapshot } from './order.types.js';
import type { OrderType } from '@prisma/client';
import { extractBearerToken } from '../auth/bearer.js';

type CreateOrderParams = Parameters<OrderService['createOrder']>[0];

@ApiTags('Order')
@Controller('orders')
export class OrderController {
    constructor(
        private readonly orders: OrderService,
        private readonly payment: OrderPaymentService,
        private readonly refund: OrderRefundService,
        private readonly afterSales: OrderAfterSalesService,
        private readonly fulfillment: OrderFulfillmentService,
        private readonly review: OrderReviewService,
        private readonly jwt: JwtService,
        private readonly tanshu: TanshuService,
        private readonly wxpay: WxpayService,
        private readonly wxship: WechatShippingService,
        private readonly prisma: PrismaService,
    ) {}

    @Post('')
    async create(@Body() body: CreateOrderBody, @Headers('authorization') authHeader?: string) {
        // 游客兜底：若未提供有效 memberId，则回退到环境变量配置的 GUEST_MEMBER_ID
        let memberId = Number(body?.memberId ?? 0);
        let isGuestOrder = false;
        if (!Number.isFinite(memberId) || memberId <= 0) {
            const gid = resolveGuestMemberIdEnv();
            if (!gid) throw new BadRequestException('系统未配置 GUEST_MEMBER_ID（游客订单所属会员）。请在环境变量中设置 GUEST_MEMBER_ID，指向一个有效会员ID。');
            // 校验该会员是否存在
            const m = await this.prisma.member.findUnique({ where: { id: gid }, select: { id: true } });
            if (!m) throw new BadRequestException('GUEST_MEMBER_ID 无效：未找到对应会员。');
            memberId = gid;
            isGuestOrder = true;
        } else {
            const gid = resolveGuestMemberIdEnv();
            if (gid && memberId === gid) isGuestOrder = true;
        }

        // 识别代客下单管理员
        let proxyAdminUserId: number | null = null;
        let proxyAdminSnapshot: ProxyAdminSnapshot | null = null;
        try {
            const adminId = this.extractAdminIdFromAuthHeader(authHeader);
            if (adminId) {
                proxyAdminUserId = adminId;
                const u = await this.prisma.user.findUnique({ where: { id: adminId }, select: { id: true, name: true, phone: true } });
                if (u) proxyAdminSnapshot = { id: u.id, name: u.name ?? undefined, phone: u.phone ?? undefined };
            }
        } catch {}

        const payload: CreateOrderParams = {
            ...(body as CreateOrderParams),
            memberId,
            _isGuestOrder: isGuestOrder,
            _proxyAdminUserId: proxyAdminUserId,
            _proxyAdminSnapshot: proxyAdminSnapshot,
        };
        return await this.orders.createOrder(payload);
    }

    // POS/后台：创建通用付款订单（无商品收款）
    @Post('_create-fk')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async createFk(@Body() body: CreateFkBody, @Headers('authorization') authHeader?: string){
        const amount = Number(body?.amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('金额必须为正数');

        // 识别代客下单管理员
        let proxyAdminUserId: number | null = null;
        let proxyAdminSnapshot: ProxyAdminSnapshot | null = null;
        try {
            const adminId = this.extractAdminIdFromAuthHeader(authHeader);
            if (adminId) {
                proxyAdminUserId = adminId;
                const u = await this.prisma.user.findUnique({ where: { id: adminId }, select: { id: true, name: true, phone: true } });
                if (u) proxyAdminSnapshot = { id: u.id, name: u.name ?? undefined, phone: u.phone ?? undefined };
            }
        } catch {}

        // 会员归属（可选）；未提供则回退到 GUEST_MEMBER_ID
        let memberId = Number(body?.memberId || 0);
        let isGuestOrder = false;
        if (!Number.isFinite(memberId) || memberId <= 0) {
            const gid = resolveGuestMemberIdEnv();
            if (!gid) throw new BadRequestException('系统未配置 GUEST_MEMBER_ID');
            const m = await this.prisma.member.findUnique({ where: { id: gid }, select: { id: true } });
            if (!m) throw new BadRequestException('GUEST_MEMBER_ID 无效');
            memberId = gid;
            isGuestOrder = true;
        }

        // 生成 FK 订单号
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const ts = `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const rand8 = () => Array.from({ length: 8 }).map(() => charset[Math.floor(Math.random() * charset.length)]).join('');
        let no: string; let tries = 0;
        while (true) {
            no = `FK_${ts}_${rand8()}`;
            const exists = await this.prisma.order.findUnique({ where: { no } });
            if (!exists) break;
            tries++; if (tries > 50) throw new BadRequestException('订单号生成失败');
        }

        const remark = String(body?.remark || '').trim();

        // 创建订单并写入时间线
        const order = await this.prisma.order.create({
            data: ({
                no,
                type: 'FK',
                status: 'CREATED',
                fulfillmentStatus: 'NONE',
                totalAmount: amount,
                discountAmount: 0,
                memberDiscountAmount: 0,
                cashierDiscountAmount: 0,
                payAmount: amount,
                shippingFee: 0,
                payStatus: 'UNPAID',
                memberId,
                groupId: null,
                payAfterService: false,
                paymentExpireAt: new Date(Date.now() + 15 * 60 * 1000),
                userRemark: null,
                paymentNote: remark || null,
                isGuestOrder: isGuestOrder,
                isProxyOrder: !!proxyAdminUserId,
                proxyAdminUserId: proxyAdminUserId ?? null,
                proxyAdminSnapshot: proxyAdminSnapshot ?? undefined,
            })
        });
        try { await this.prisma.orderTimeline.create({ data: { orderId: order.id, event: 'ORDER_STATUS', value: 'CREATED' } }); } catch {}
        try { await this.prisma.orderTimeline.create({ data: { orderId: order.id, event: 'PAY_STATUS', value: 'UNPAID' } }); } catch {}
        try { await this.prisma.orderTimeline.create({ data: { orderId: order.id, event: 'FULFILLMENT', value: 'NONE' } }); } catch {}
        return { id: order.id, no: order.no };
    }

    @Get('by-no/:no')
    async getByNo(@Param('no') no: string, @Headers('authorization') authHeader?: string) {
        const o = await this.orders.getOrderByNo(no);
        try{
            const adminId = this.extractAdminIdFromAuthHeader(authHeader);
            if (!adminId) {
                if (o && typeof o === 'object') {
                    const r = o as Record<string, unknown>;
                    delete r.proxyAdminUser;
                    delete r.proxyAdminSnapshot;
                    // 积分日志仅后台可见（会员可通过积分明细接口查看）
                    delete r.pointsLogs;
                }
            }
        }catch{}
        return o;
    }

    @Get('')
    async list(
        @Query('type') type?: 'SERVICE'|'SP'|'FK',
        @Query('status') status?: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED',
        @Query('payStatus') payStatus?: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED',
        @Query('payMethod') payMethod?: string,
        @Query('scene') scene?: string,
        @Query('includeDeleted') includeDeletedStr?: string,
        @Query('memberId') memberIdStr?: string,
        @Query('keyword') keyword?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Headers('authorization') authHeader?: string,
    ) {
        // 统一鉴权：支持 admin 与 member
        const token = extractBearerToken(authHeader);
        if (!token) throw new UnauthorizedException('未登录');
        let decoded: AuthJwtPayload;
        try { decoded = this.jwt.verify(token) as AuthJwtPayload; } catch { throw new UnauthorizedException('登录已过期'); }
        const tokenType = String(decoded?.type||'');
        if (tokenType !== 'admin' && tokenType !== 'member') throw new UnauthorizedException('身份无效');
        let memberId: number | undefined = memberIdStr ? Number(memberIdStr) : undefined;
        let includeDeleted = String(includeDeletedStr||'').toLowerCase() === 'true';
        if (tokenType === 'member') {
            // 会员仅能查询自己的订单，且不可查看已删除
            const selfId = Number(decoded?.sub);
            memberId = Number.isFinite(selfId) ? selfId : undefined;
            includeDeleted = false;
        }
        const list = await this.orders.listOrders({ type: type as OrderType | undefined, status: status as any, payStatus: payStatus as any, payMethod, scene, includeDeleted, memberId, keyword, start, end });
        // 对会员侧列表隐藏代客管理员信息
        if (tokenType === 'member') {
            try{
                return (list || []).map((o)=>{
                    if (!o || typeof o !== 'object') return o;
                    const r = o as Record<string, unknown>;
                    delete r.proxyAdminUser;
                    delete r.proxyAdminSnapshot;
                    return o;
                });
            }catch{ return list; }            
        }
        return list;
    }

    // 微信 JSAPI 预支付下单：返回 wx.requestPayment 所需参数
    @Post(':id/pay/wechat-jsapi')
    async wechatJsapi(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        // 校验会员身份
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!memberId) throw new BadRequestException('未登录或身份无效');
        return this.payment.createWechatJsapiPayment(id, memberId);
    }

    // 微信支付回调（v3）
    @Post('_notify/wechat')
    async wechatNotify(@Req() req: Request, @Res() res: Response) {
        try {
            const result = await this.payment.handleWechatPaymentNotify(req.body);
            res.status(200).json(result);
        } catch (e) {
            res.status(500).json({ code: 'ERROR', message: (e as Error)?.message || String(e) });
        }
    }

    @Post(':id/pay/manual')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    markPaid(@Param('id', ParseIntPipe) id: number, @Body() body: { method: 'CASH'|'SHOUQIANBA'|'OFFLINE'; paidAt?: string }, @Headers('authorization') authHeader?: string) {
        const paidAt = body.paidAt ? new Date(body.paidAt) : undefined;
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.payment.markPaid({ orderId: id, method: body.method, paidAt, operatorUserId });
    }

    // 管理后台：调整未支付订单的收银立减金额（元）
    @Post(':id/adjust-cashier-discount')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async adjustCashierDiscount(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { amount: number },
        @Headers('authorization') authHeader?: string,
    ){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        const amt = Number((body as any)?.amount ?? 0);
        if (!Number.isFinite(amt) || amt < 0) throw new BadRequestException('金额需为不小于0的数值');
        return this.orders.adjustCashierDiscount(id, amt, operatorUserId);
    }

    // 管理后台：洗车卡划扣支付（自动识别集团/个人卡）
    @Post(':id/pay/wash-card')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async payByWashCard(@Param('id', ParseIntPipe) id: number, @Body() body: { prefer?: 'GROUP'|'MEMBER'; payerMemberId?: number | null; payerCardId?: number | null }, @Headers('authorization') authHeader?: string){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        // 若指定付款会员与卡，则走手动指定流程
        if (body?.payerMemberId || body?.payerCardId) {
            return (this.payment as any).markPaidByWashCardManual({ orderId: id, payerMemberId: Number((body as any)?.payerMemberId||0) || null, payerCardId: Number((body as any)?.payerCardId||0) || null, prefer: body?.prefer, operatorUserId });
        }
        return this.payment.markPaidByWashCard({ orderId: id, prefer: body?.prefer, operatorUserId });
    }

    // 管理后台：集团余额支付（仅集团服务订单）
    @Post(':id/pay/group-balance')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async payByGroupBalance(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        return this.payment.markPaidByGroupBalance({ orderId: id, operatorUserId });
    }

    // 管理后台：微信付款码支付（V2 micropay 流程）
    @Post(':id/pay/wx-micropay')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async wechatMicropay(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { authCode: string; deviceInfo?: string },
        @Headers('x-forwarded-for') xff?: string,
        @Req() req?: Request,
        @Headers('authorization') authHeader?: string,
    ) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        const ip = (String(xff || '').split(',')[0] || req?.ip || req?.socket?.remoteAddress || '127.0.0.1').trim();
        return this.payment.wechatMicropay({
            orderId: id,
            authCode: body.authCode,
            deviceInfo: body.deviceInfo,
            ip,
            operatorUserId
        });
    }

    // 软删除（替换原"关闭"操作）：仅设置 deletedAt，不改其他状态
    @Post(':id/close')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    close(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.fulfillment.softDeleteOrder(id, operatorUserId);
    }

    // 取消订单（未支付）：会员或管理员均可
    @Post(':id/cancel')
    async cancelOrder(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const adminId = this.extractAdminIdFromAuthHeader(authHeader);
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!adminId && !memberId) throw new UnauthorizedException('未登录');
        const order: any = await this.orders.getOrder(id);
        if (!order) throw new BadRequestException('订单不存在');
        if (order.payStatus !== 'UNPAID') throw new BadRequestException('仅未支付订单可取消');
        // 会员必须为本人订单
        if (memberId && order.memberId !== memberId) throw new UnauthorizedException('无权操作该订单');
        // 服务订单的额外限制：冷静期 + 服务未开始
        if (String(order.type||'').toUpperCase() === 'SERVICE') {
            // 冷静期：下单15分钟内
            try {
                const createdAt = order.createdAt ? new Date(order.createdAt) : null as any;
                const within15Min = createdAt && (Date.now() - createdAt.getTime()) <= 15 * 60 * 1000;
                if (!within15Min) {
                    // 前端统一文案：服务已开始/完成，订单不可取消，如需帮助请联系门店
                    throw new ConflictException('服务已开始/完成，订单不可取消，如需帮助请联系门店');
                }
            } catch { /* 忽略解析错误，按不可取消处理 */
                throw new ConflictException('服务已开始/完成，订单不可取消，如需帮助请联系门店');
            }
            // 校验队列状态：只允许“未开始”（无 currentTaskIndex 或 <0，且未 finished）时取消
            try {
                const qi = await (this.orders as any).prisma.serviceQueueItem.findFirst({ where: { orderId: order.id } });
                if (qi) {
                    const started = typeof qi.currentTaskIndex === 'number' && qi.currentTaskIndex >= 0;
                    const finished = !!qi.finishedAt;
                    if (started || finished || String(qi.status||'') === 'SERVING' || String(qi.status||'') === 'COMPLETED') {
                        throw new ConflictException('服务已开始/完成，订单不可取消，如需帮助请联系门店');
                    }
                }
                // 若无队列项，但订单履约已非 PENDING，也视为已开始
                const fs = String(order.fulfillmentStatus||'').toUpperCase();
                if (fs !== 'PENDING') {
                    throw new ConflictException('服务已开始/完成，订单不可取消，如需帮助请联系门店');
                }
            } catch (e) {
                if ((e as any)?.name === 'ConflictException') throw e;
                throw new ConflictException('服务已开始/完成，订单不可取消，如需帮助请联系门店');
            }
        }
        // 关单：按是否存在JSAPI预下单做兜底，这里直接调用关单接口（多次调用幂等）
        try { await this.wxpay.closeJsapi(order.no); } catch (e) { /* 忽略关单失败以避免卡住取消流程 */ }
        const userInitiated = !!memberId && order.memberId === memberId;
        return this.fulfillment.cancelOrder(id, body?.reason, adminId ?? null, { userInitiated });
    }

    // 作废/红冲：需专项权限
    @Post(':id/void')
    @UseGuards(AdminGuard)
    @RequirePerm('orders-writeoff')
    async writeoff(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        const order: any = await this.orders.getOrder(id);
        if (!order) throw new BadRequestException('订单不存在');
        if (order.payStatus === 'UNPAID') {
            return this.fulfillment.cancelOrder(id, body?.reason || '后台作废', operatorUserId, { userInitiated: false });
        }
        if (order.payStatus === 'PAID') {
            const pm = String(order.payMethod || '').toUpperCase();
            // 渠道支付：走渠道退款；洗车卡/线下/其他：走内部退款（含洗车卡次数返还/积分回退）
            if (pm === 'WECHAT_JSAPI') {
                return this.refund.createWechatRefund({ orderId: id, reason: body?.reason || '后台红冲', operatorUserId });
            }
            if (pm === 'WECHAT_MICROPAY') {
                // 付款码：统一入口会走 v2 退款
                return this.refund.createWechatRefund({ orderId: id, reason: body?.reason || '后台红冲', operatorUserId });
            }
            // 其余（含 WASH_CARD / GROUP_WASH_CARD / 线下）：内部退款，自动返还洗车卡次数与积分
            return this.refund.finalizeInternalRefund(id, body?.reason || '后台红冲', operatorUserId);
        }
        // 其它状态：按关闭处理
        return this.fulfillment.closeOrder(id, body?.reason || '后台作废', operatorUserId);
    }

    // 恢复软删除
    @Post(':id/restore')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    restore(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.fulfillment.restoreOrder(id, operatorUserId);
    }

    // ========================
    // 售后与退款接口（会员发起）
    // ========================
    @Post(':id/after-sales')
    async createAfterSales(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { type: 'REFUND'|'EXCHANGE'|'RE_SERVICE'; reasonCode?: string; reasonText?: string; description?: string; images?: unknown; exchangeAddress?: unknown; amount?: number },
        @Headers('authorization') authHeader?: string,
    ) {
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!memberId) throw new BadRequestException('未登录或身份无效');
        return this.afterSales.createAfterSalesRequest({
            orderId: id,
            memberId,
            type: body.type as any,
            reasonCode: body.reasonCode || null,
            reasonText: body.reasonText || null,
            description: body.description || null,
            imagesJson: body.images ?? undefined,
            exchangeAddressSnapshot: body.exchangeAddress ?? undefined,
            requestedAmount: (typeof body.amount==='number' && body.amount>0) ? (body.amount as any) : undefined,
        });
    }

    @Get('_after-sales')
    @UseGuards(AdminGuard)
    @RequirePerm('after-sales')
    listAfterSales(@Query('status') status?: 'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED'|'COMPLETED', @Query('memberId') memberIdStr?: string) {
        const memberId = memberIdStr ? Number(memberIdStr) : undefined;
        return this.afterSales.listAfterSales({ status: status as any, memberId });
    }

    @Post('_after-sales/:id/audit')
    @UseGuards(AdminGuard)
    @RequirePerm('after-sales')
    async auditAfterSales(@Param('id', ParseIntPipe) id: number, @Body() body: { approve: boolean; remark?: string; amount?: number }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        return this.afterSales.auditAfterSales(id, !!body.approve, body?.remark, operatorUserId, body?.amount);
    }

    // 换货售后：独立发货（不影响订单原始发货信息）
    @Post('_after-sales/:id/exchange-ship')
    @UseGuards(AdminGuard)
    @RequirePerm('after-sales')
    async shipExchange(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { noExpress?: boolean; companyCode?: string | null; companyName?: string | null; companyLogo?: string | null; trackingNo?: string | null; contactSenderPhoneMasked?: string | null; contactReceiverPhoneMasked?: string | null },
        @Headers('authorization') authHeader?: string,
    ){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        return this.afterSales.shipExchangeForAfterSales(id, operatorUserId, body);
    }

    // 微信退款：统一入口（JSAPI 走 v3，付款码走 v2）。供后台审核通过后调用或人工触发
    @Post(':id/refund')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async wechatRefund(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string; amount?: number }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        return this.refund.createWechatRefund({
            orderId: id,
            reason: body?.reason,
            amount: body?.amount,
            operatorUserId
        });
    }

    // 微信退款回调
    @Post('_notify/wechat-refund')
    async wechatRefundNotify(@Req() req: Request, @Res() res: Response) {
        try{
            const result = await this.refund.handleWechatRefundNotify(req.body);
            res.status(200).json(result);
        } catch (e) {
            res.status(500).json({ code:'ERROR', message: (e as Error)?.message || String(e) });
        }
    }

    // 微信退款回调（v2 兼容占位，无验签要求，这里仅作为将来可能的桥接；建议以查询为准）
    @Post('_notify/wechat-refund-v2')
    async wechatRefundV2Notify(@Req() req: Request, @Res() res: Response){
        try{
            // 退款结果通知（v2）：XML，字段 req_info 需解密。
            const rawBody = (req as unknown as { rawBody?: unknown })?.rawBody || req.body || '';
            const text = typeof rawBody === 'string' ? rawBody : ((rawBody as { toString?: (enc?: string)=>string })?.toString?.('utf8') || '');
            const result = await this.refund.handleWechatRefundV2Notify(text);
            res.set('Content-Type', 'text/xml');
            res.status(200).send(result);
        }catch{
            res.set('Content-Type', 'text/xml');
            res.status(200).send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
        }
    }

    // 管理后台：退款结果查询（v2，按 out_refund_no 主动查询并回写状态）
    @Post('_refunds/:outRefundNo/query-v2')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async queryRefundV2(@Param('outRefundNo') outRefundNo: string){
        return this.refund.queryRefundV2(outRefundNo);
    }

    // 退款重试接口
    @Post('_refunds/:id/retry')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async retryRefund(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        return this.refund.retryRefund(id, operatorUserId);
    }

    // 发货：无需快递或快递发货
    @Post(':id/ship')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    ship(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { noExpress?: boolean; companyCode?: string; companyName?: string; companyLogo?: string; trackingNo?: string; extra?: unknown; contactSenderPhoneMasked?: string; contactReceiverPhoneMasked?: string },
        @Headers('authorization') authHeader?: string,
    ) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.fulfillment.shipOrder(id, operatorUserId, body);
    }

    // 修改物流单号（仅一次，未收货前）
    @Post(':id/ship/edit-tracking')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    editTracking(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { trackingNo: string; companyCode?: string; companyName?: string; companyLogo?: string; contactSenderPhoneMasked?: string; contactReceiverPhoneMasked?: string },
        @Headers('authorization') authHeader?: string,
    ){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.fulfillment.editShipTrackingNo(id, body?.trackingNo, operatorUserId, { companyCode: body?.companyCode, companyName: body?.companyName, companyLogo: body?.companyLogo, contactSenderPhoneMasked: body?.contactSenderPhoneMasked, contactReceiverPhoneMasked: body?.contactReceiverPhoneMasked });
    }

    // 收货：会员本人或管理员
    @Post(':id/receive')
    async receive(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const adminId = this.extractAdminIdFromAuthHeader(authHeader);
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!adminId && !memberId) throw new UnauthorizedException('未登录');
        // 会员收货需校验归属
        if (memberId) {
            const order: any = await this.orders.getOrder(id);
            if (!order) throw new BadRequestException('订单不存在');
            if (order.memberId !== memberId) throw new UnauthorizedException('无权操作该订单');
        }
        return this.fulfillment.receiveOrder(id, adminId ?? null);
    }

    // 开始服务
    @Post(':id/start-service')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    startService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.fulfillment.startService(id, operatorUserId);
    }

    // 结束服务
    @Post(':id/finish-service')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    finishService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.fulfillment.finishService(id, operatorUserId);
    }

    // 评价接口（新增）
    @Post(':id/review')
    async createReview(@Param('id', ParseIntPipe) id: number, @Body() body: { rating: number; content?: string; images?: unknown }, @Headers('authorization') authHeader?: string) {
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!memberId) throw new BadRequestException('未登录或身份无效');
        return this.review.createOrderReview({ orderId: id, memberId, rating: body.rating, content: body.content, images: body.images });
    }

    @Get(':id/review')
    getReview(@Param('id', ParseIntPipe) id: number) {
        return this.review.getOrderReviewByOrderId(id);
    }

    @Get('_reviews')
    @UseGuards(AdminGuard)
    @RequirePerm('content-reviews')
    listReviews(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('memberId') memberIdStr?: string, @Query('orderNo') orderNo?: string, @Query('ratingMin') ratingMinStr?: string, @Query('ratingMax') ratingMaxStr?: string, @Query('start') start?: string, @Query('end') end?: string) {
        const memberId = memberIdStr ? Number(memberIdStr) : undefined;
        const ratingMin = ratingMinStr ? Number(ratingMinStr) : undefined;
        const ratingMax = ratingMaxStr ? Number(ratingMaxStr) : undefined;
        return this.review.listReviews({ page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined, memberId, orderNo, ratingMin, ratingMax, start, end });
    }

    @Post('_reviews/:id/delete')
    @UseGuards(AdminGuard)
    @RequirePerm('content-reviews')
    deleteReview(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('无权限');
        return this.review.deleteReview(id);
    }

    @Post('_reviews/:id/reply')
    @UseGuards(AdminGuard)
    @RequirePerm('content-reviews')
    replyReview(@Param('id', ParseIntPipe) id: number, @Body() body: { content: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('无权限');
        return this.review.replyReview(id, body?.content || '', operatorUserId);
    }

    // 物流公司列表（切换为微信：get_delivery_list）
    @Get('/_logistics/companies')
    async getCompanies(){
        const list = await this.wxship.getDeliveryList();
        // 兼容 Admin 下拉需要的结构
        return list.map(it=>({ code: it.code, name: it.name }));
    }

    // 物流公司列表（探数：旧数据源，非微信支付订单使用）
    @Get('/_logistics/companies/tanshu')
    async getCompaniesFromTanshu(){
        const list = await this.tanshu.getCompanies();
        return list;
    }

    // 物流查询（探数 V2）- 管理端/小程序端均可调用（需网关限制实际部署时再加）
    @Get('/_logistics/query')
    async query(@Query('com') com?: string, @Query('no') no?: string, @Query('phone') phone?: string){
        if (!no) return { code: 0, msg: 'no required' } as any;
        return await this.tanshu.queryTracking({ com, no, phone });
    }

    // NestJS 11 + path-to-regexp v8 不再支持在路由路径里写正则（如 :id(\\d+)）
    // 改为普通参数，并使用 ParseIntPipe 做数字校验
    //
    // ⚠️ 注意：本路由必须放在所有“单段静态路由”（如 /_after-sales、/_reviews 等）之后，
    // 否则会把这些路径误匹配到 :id，触发 ParseIntPipe 报错：Validation failed (numeric string is expected)
    @Get(':id')
    async get(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const o = await this.orders.getOrder(id);
        // 非管理员请求：隐藏代客下单的管理员快照信息
        try{
            const adminId = this.extractAdminIdFromAuthHeader(authHeader);
            if (!adminId) {
                if (o && typeof o === 'object') {
                    const r = o as Record<string, unknown>;
                    delete r.proxyAdminUser;
                    delete r.proxyAdminSnapshot;
                    delete r.pointsLogs;
                }
            }
        }catch{}
        return o;
    }

    private extractAdminIdFromAuthHeader(authHeader?: string): number | undefined {
        if (!authHeader) return undefined;
        const m = /^Bearer\s+(.+)$/.exec(authHeader);
        const token = m?.[1];
        if (!token) return undefined;
        try {
            const decoded = this.jwt.verify(token) as AuthJwtPayload;
            if (decoded?.type !== 'admin') return undefined;
            const id = Number(decoded?.sub);
            return Number.isFinite(id) && id > 0 ? id : undefined;
        } catch {
            return undefined;
        }
    }

    private extractMemberIdFromAuthHeader(authHeader?: string): number | undefined {
        if (!authHeader) return undefined;
        const m = /^Bearer\s+(.+)$/.exec(authHeader);
        const token = m?.[1];
        if (!token) return undefined;
        try {
            const decoded = this.jwt.verify(token) as AuthJwtPayload;
            if (decoded?.type !== 'member') return undefined;
            const id = Number(decoded?.sub);
            return Number.isFinite(id) && id > 0 ? id : undefined;
        } catch {
            return undefined;
        }
    }
}
