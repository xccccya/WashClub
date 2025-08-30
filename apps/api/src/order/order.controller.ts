import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Headers, Req, Res, BadRequestException, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { TanshuService } from './tanshu.service.js';
import { JwtService } from '@nestjs/jwt';
import { WxpayService } from './wxpay.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('Order')
@Controller('orders')
export class OrderController {
    constructor(private readonly orders: OrderService, private readonly jwt: JwtService, private readonly tanshu: TanshuService, private readonly wxpay: WxpayService) {}

    @Post('')
    create(@Body() body: any) { return this.orders.createOrder(body); }

    @Get(':id(\\d+)')
    get(@Param('id', ParseIntPipe) id: number) { return this.orders.getOrder(id); }

    @Get('by-no/:no')
    getByNo(@Param('no') no: string) { return this.orders.getOrderByNo(no); }

    @Get('')
    async list(
        @Query('type') type?: 'SERVICE'|'SP'|'FK',
        @Query('status') status?: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED',
        @Query('payStatus') payStatus?: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED',
        @Query('scene') scene?: string,
        @Query('includeDeleted') includeDeletedStr?: string,
        @Query('memberId') memberIdStr?: string,
        @Query('keyword') keyword?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Headers('authorization') authHeader?: string,
    ) {
        // 统一鉴权：支持 admin 与 member
        const token = /^Bearer\s+(.+)$/.exec(String(authHeader||''))?.[1];
        if (!token) throw new UnauthorizedException('未登录');
        let decoded: any;
        try { decoded = this.jwt.verify(token); } catch { throw new UnauthorizedException('登录已过期'); }
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
        return this.orders.listOrders({ type: type as any, status: status as any, payStatus: payStatus as any, scene, includeDeleted, memberId, keyword, start, end });
    }

    // 微信 JSAPI 预支付下单：返回 wx.requestPayment 所需参数
    @Post(':id/pay/wechat-jsapi')
    async wechatJsapi(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        // 校验会员身份
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!memberId) throw new BadRequestException('未登录或身份无效');
        const order: any = await this.orders.getOrder(id);
        if (!order || order.memberId !== memberId) throw new BadRequestException('订单不存在或不属于当前用户');
        if (order.payStatus !== 'UNPAID') throw new BadRequestException('订单非待支付状态');
        // 获取 openid
        const openid = await this.orders.getMemberOpenId(memberId);
        if (!openid) throw new BadRequestException('当前账号未绑定微信openid，请使用一键登录后重试');
        // 元转分
        const amountYuan = Number(order.payAmount);
        if (!Number.isFinite(amountYuan) || amountYuan <= 0) throw new BadRequestException('订单金额异常');
        const total = Math.round(amountYuan * 100);
        const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat';
        const desc = `订单支付-${order.no}`;
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

    // 微信支付回调（v3）
    @Post('_notify/wechat')
    async wechatNotify(@Req() req: any, @Res() res: any) {
        try {
            const body = req.body || {};
            // 验证签名由网关/中间件处理，这里直接解密 resource
            const resource = body?.resource || {};
            if (!resource?.nonce || !resource?.associated_data || !resource?.ciphertext) throw new BadRequestException('非法通知');
            const decrypted = this.wxpay.decryptNotifyResource(resource.nonce, resource.associated_data, resource.ciphertext);
            // 处理状态
            if (decrypted?.trade_state === 'SUCCESS') {
                const outTradeNo = decrypted?.out_trade_no;
                const order = await this.orders.getOrderByNo(outTradeNo);
                if (order && order.payStatus === 'UNPAID') {
                    await this.orders.markPaid({ orderId: order.id, method: 'WECHAT_JSAPI' as any, paidAt: new Date() });
                }
            }
            res.status(200).json({ code: 'SUCCESS' });
        } catch (e) {
            res.status(500).json({ code: 'ERROR', message: (e as any)?.message || String(e) });
        }
    }

    @Post(':id/pay/manual')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    markPaid(@Param('id', ParseIntPipe) id: number, @Body() body: { method: 'CASH'|'SHOUQIANBA'|'OFFLINE'; paidAt?: string }, @Headers('authorization') authHeader?: string) {
        const paidAt = body.paidAt ? new Date(body.paidAt) : undefined;
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.markPaid({ orderId: id, method: body.method, paidAt, operatorUserId });
    }

    // 软删除（替换原“关闭”操作）：仅设置 deletedAt，不改其他状态
    @Post(':id/close')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    close(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.softDeleteOrder(id, operatorUserId);
    }

    // 取消订单（未支付）：若为JSAPI下单过的订单，调用微信关单
    @Post(':id/cancel')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async cancelOrder(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        const order: any = await this.orders.getOrder(id);
        if (!order) throw new BadRequestException('订单不存在');
        if (order.payStatus !== 'UNPAID') throw new BadRequestException('仅未支付订单可取消');
        // 关单：按是否存在JSAPI预下单做兜底，这里直接调用关单接口（多次调用幂等）
        try { await this.wxpay.closeJsapi(order.no); } catch (e) { /* 忽略关单失败以避免卡住取消流程 */ }
        return this.orders.cancelOrder(id, body?.reason, operatorUserId);
    }

    // 恢复软删除
    @Post(':id/restore')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    restore(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.restoreOrder(id, operatorUserId);
    }

    @Post(':id/refund')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    refund(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.refundOrder(id, body?.reason, operatorUserId);
    }

    // ========================
    // 售后与退款接口（会员发起）
    // ========================
    @Post(':id/after-sales')
    async createAfterSales(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { type: 'REFUND'|'EXCHANGE'|'RE_SERVICE'; reasonCode?: string; reasonText?: string; description?: string; images?: any; exchangeAddress?: any; amount?: number },
        @Headers('authorization') authHeader?: string,
    ) {
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!memberId) throw new BadRequestException('未登录或身份无效');
        const req = await this.orders.createAfterSalesRequest({
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
        return req;
    }

    @Get('_after-sales')
    @UseGuards(AdminGuard)
    @RequirePerm('after-sales')
    listAfterSales(@Query('status') status?: 'PENDING'|'APPROVED'|'REJECTED'|'CANCELLED'|'COMPLETED', @Query('memberId') memberIdStr?: string) {
        const memberId = memberIdStr ? Number(memberIdStr) : undefined;
        return this.orders.listAfterSales({ status: status as any, memberId });
    }

    @Post('_after-sales/:id/audit')
    @UseGuards(AdminGuard)
    @RequirePerm('after-sales')
    auditAfterSales(@Param('id', ParseIntPipe) id: number, @Body() body: { approve: boolean; remark?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        return this.orders.auditAfterSales(id, !!body.approve, body?.remark, operatorUserId);
    }

    // 微信退款：供后台审核通过后调用或自动化
    @Post(':id/refund/wechat')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async wechatRefund(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string; amount?: number }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        const order: any = await this.orders.getOrder(id);
        if (!order || order.payStatus !== 'PAID' || order.payMethod !== 'WECHAT_JSAPI') throw new BadRequestException('仅支持微信JSAPI已支付订单退款');
        const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund';
        const outRefundNo = `R_${order.no}_${Date.now()}`;
        const amountFen = Math.round(Number(order.payAmount) * 100);
        const requestedFen = Math.round(Number(body?.amount ?? order.payAmount) * 100);
        if (requestedFen <= 0) throw new BadRequestException('退款金额必须大于0');
        // 累计部分退款上限校验（SUCCESS 之和应 ≤ 实付）
        const existing:any = await this.orders.getOrder(id);
        const successSumFen = Math.round(((existing?.refundRecords||[]).filter((r:any)=>r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0)) * 100);
        const refundableFen = Math.max(0, amountFen - successSumFen);
        const refundFen = Math.min(requestedFen, refundableFen);
        if (refundFen <= 0) throw new BadRequestException('累计退款金额已达上限');
        // 校验全额退款可行性（如洗车卡剩余次数不足则阻断）
        const allowed = await this.orders.verifyRefundAllowed(order.id, refundFen / 100);
        if (!allowed) throw new BadRequestException('退款校验未通过：关联权益已部分使用，无法全额退款');
        const resp = await this.wxpay.createRefund({ outTradeNo: order.no, outRefundNo, refundAmountFen: refundFen, totalAmountFen: amountFen, reason: body?.reason, notifyUrl });
        await this.orders.createRefundRecord({ orderId: order.id, memberId: order.memberId, amount: (refundFen/100), method: 'WECHAT_JSAPI' as any, reasonCode: 'WECHAT', reasonText: body?.reason || null, outRefundNo, wechatRefundId: resp?.refund_id || null, status: 'PROCESSING' as any });
        return { ok: true, outRefundNo };
    }

    // 微信退款回调
    @Post('_notify/wechat-refund')
    async wechatRefundNotify(@Req() req: any, @Res() res: any) {
        try{
            const body = req.body || {};
            const resource = body?.resource || {};
            if (!resource?.nonce || !resource?.associated_data || !resource?.ciphertext) throw new BadRequestException('非法通知');
            const decrypted = this.wxpay.decryptNotifyResource(resource.nonce, resource.associated_data, resource.ciphertext);
            const outRefundNo = decrypted?.out_refund_no;
            const refundId = decrypted?.refund_id;
            const status = decrypted?.refund_status; // SUCCESS, ABNORMAL, CLOSED
            if (outRefundNo) {
                if (status === 'SUCCESS') {
                    const rec:any = await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'SUCCESS' as any, refundId, null);
                    if (rec?.orderId) {
                        const amt = Number(rec?.amount||0);
                        await this.orders.applyRefundSuccess({ orderId: rec.orderId, amountYuan: amt, method: 'WECHAT_JSAPI' as any, operatorUserId: undefined });
                        await this.orders.completeLatestRefundAftersalesByOrder(rec.orderId, undefined);
                    }
                } else if (status === 'ABNORMAL') {
                    await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, refundId, decrypted?.status || 'ABNORMAL');
                } else if (status === 'CLOSED') {
                    await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'CANCELLED' as any, refundId, 'CLOSED');
                }
            }
            res.status(200).json({ code:'SUCCESS' });
        } catch (e) {
            res.status(500).json({ code:'ERROR', message: (e as any)?.message || String(e) });
        }
    }

    // 发货：无需快递或快递发货
    @Post(':id/ship')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    ship(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { noExpress?: boolean; companyCode?: string; companyName?: string; companyLogo?: string; trackingNo?: string; extra?: any },
        @Headers('authorization') authHeader?: string,
    ) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.shipOrder(id, operatorUserId, body);
    }
    // 收货
    @Post(':id/receive')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    receive(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.receiveOrder(id, operatorUserId);
    }
    // 开始服务
    @Post(':id/start-service')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    startService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.startService(id, operatorUserId);
    }
    // 结束服务
    @Post(':id/finish-service')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    finishService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.finishService(id, operatorUserId);
    }

    // 评价接口（新增）
    @Post(':id/review')
    async createReview(@Param('id', ParseIntPipe) id: number, @Body() body: { rating: number; content?: string; images?: any }, @Headers('authorization') authHeader?: string) {
        const memberId = this.extractMemberIdFromAuthHeader(authHeader);
        if (!memberId) throw new BadRequestException('未登录或身份无效');
        return (this.orders as any).createOrderReview({ orderId: id, memberId, rating: body.rating, content: body.content, images: body.images });
    }

    @Get(':id/review')
    getReview(@Param('id', ParseIntPipe) id: number) {
        return (this.orders as any).getOrderReviewByOrderId(id);
    }

    @Get('_reviews')
    @UseGuards(AdminGuard)
    @RequirePerm('content-reviews')
    listReviews(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('memberId') memberIdStr?: string, @Query('orderNo') orderNo?: string, @Query('ratingMin') ratingMinStr?: string, @Query('ratingMax') ratingMaxStr?: string, @Query('start') start?: string, @Query('end') end?: string) {
        const memberId = memberIdStr ? Number(memberIdStr) : undefined;
        const ratingMin = ratingMinStr ? Number(ratingMinStr) : undefined;
        const ratingMax = ratingMaxStr ? Number(ratingMaxStr) : undefined;
        return (this.orders as any).listReviews({ page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined, memberId, orderNo, ratingMin, ratingMax, start, end });
    }

    @Post('_reviews/:id/delete')
    @UseGuards(AdminGuard)
    @RequirePerm('content-reviews')
    deleteReview(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('无权限');
        return (this.orders as any).deleteReview(id);
    }

    @Post('_reviews/:id/reply')
    @UseGuards(AdminGuard)
    @RequirePerm('content-reviews')
    replyReview(@Param('id', ParseIntPipe) id: number, @Body() body: { content: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('无权限');
        return (this.orders as any).replyReview(id, body?.content || '', operatorUserId);
    }

    // 物流公司列表（探数）
    @Get('/_logistics/companies')
    async getCompanies(){
        return await this.tanshu.getCompanies();
    }

    // 物流查询（探数 V2）- 管理端/小程序端均可调用（需网关限制实际部署时再加）
    @Get('/_logistics/query')
    async query(@Query('com') com?: string, @Query('no') no?: string, @Query('phone') phone?: string){
        if (!no) return { code: 0, msg: 'no required' } as any;
        return await this.tanshu.queryTracking({ com, no, phone });
    }

    private extractAdminIdFromAuthHeader(authHeader?: string): number | undefined {
        if (!authHeader) return undefined;
        const m = /^Bearer\s+(.+)$/.exec(authHeader);
        const token = m?.[1];
        if (!token) return undefined;
        try {
            const decoded: any = this.jwt.verify(token);
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
            const decoded: any = this.jwt.verify(token);
            if (decoded?.type !== 'member') return undefined;
            const id = Number(decoded?.sub);
            return Number.isFinite(id) && id > 0 ? id : undefined;
        } catch {
            return undefined;
        }
    }
}


