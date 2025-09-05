import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Headers, Req, Res, BadRequestException, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { TanshuService } from './tanshu.service.js';
import { WechatShippingService } from './wechat-shipping.service.js';
import { JwtService } from '@nestjs/jwt';
import { WxpayService } from './wxpay.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('Order')
@Controller('orders')
export class OrderController {
    constructor(private readonly orders: OrderService, private readonly jwt: JwtService, private readonly tanshu: TanshuService, private readonly wxpay: WxpayService, private readonly wxship: WechatShippingService) {}

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
        const desc = `巨科汽车美容（威远店）-订单支付-${order.no}`;
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
                const transactionId = decrypted?.transaction_id;
                const order = await this.orders.getOrderByNo(outTradeNo);
                if (order && order.payStatus === 'UNPAID') {
                    await this.orders.markPaid({ orderId: order.id, method: 'WECHAT_JSAPI' as any, paidAt: new Date(), wechatTransactionId: transactionId });
                }
                // 若已标记过支付，但缺少交易单号，则补写入（容错）
                if (order && order.payStatus !== 'UNPAID' && transactionId && !(order as any).wechatTransactionId) {
                    await (this.orders as any).saveWechatTransactionId(order.id, transactionId);
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

    // 管理后台：微信付款码支付（V2 micropay 流程）
    @Post(':id/pay/wx-micropay')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async wechatMicropay(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { authCode: string; deviceInfo?: string },
        @Headers('x-forwarded-for') xff?: string,
        @Req() req?: any,
        @Headers('authorization') authHeader?: string,
    ){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        const order: any = await this.orders.getOrder(id);
        if (!order) throw new BadRequestException('订单不存在');
        if (order.payStatus !== 'UNPAID') throw new BadRequestException('仅未支付订单可发起付款码支付');
        const totalFen = Math.round(Number(order.payAmount) * 100);
        if (totalFen <= 0) throw new BadRequestException('订单金额异常');
        const desc = `巨科汽车美容（威远店）-订单支付-${order.no}`;
        const ip = (String(xff||'').split(',')[0] || req?.ip || req?.socket?.remoteAddress || '127.0.0.1').trim();
        if (!body?.authCode) throw new BadRequestException('缺少付款码');
        // 发起 V2 付款码支付：内含轮询查询与必要时撤销
        const flow = await this.wxpay.micropayFlow({
            outTradeNo: order.no,
            totalFeeFen: totalFen,
            body: desc,
            authCode: body.authCode,
            spbillCreateIp: ip,
            attach: JSON.stringify({ orderId: order.id }),
            deviceInfo: body.deviceInfo || 'WEB_ADMIN',
        });
        if (flow.status === 'SUCCESS'){
            await this.orders.markPaid({ orderId: order.id, method: 'WECHAT_MICROPAY' as any, paidAt: new Date(), operatorUserId, wechatTransactionId: flow.transactionId || undefined });
            try{ await (this.orders as any).writeTimeline({ orderId: order.id, event: 'NOTE', value: 'WECHAT_MICROPAY', remark: `交易成功；银行：${flow.bankType||'-'}；完成时间：${flow.timeEnd||'-'}`, operatorUserId }); }catch{}
            return { ok: true, trade_state: 'SUCCESS', transaction_id: flow.transactionId };
        }
        if (flow.status === 'REVERSED'){
            try{ await (this.orders as any).writeTimeline({ orderId: order.id, event: 'PAY_STATUS', value: 'CANCELLED', remark: '付款码支付未确定，已撤销', operatorUserId }); }catch{}
            throw new BadRequestException(`付款未完成，已撤销：${flow.errCodeDes || flow.errCode || 'UNKNOWN'}`);
        }
        throw new BadRequestException(`付款失败：${flow.errCodeDes || flow.errCode || 'UNKNOWN'}`);
    }

    // 软删除（替换原“关闭”操作）：仅设置 deletedAt，不改其他状态
    @Post(':id/close')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    close(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.softDeleteOrder(id, operatorUserId);
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
        // 关单：按是否存在JSAPI预下单做兜底，这里直接调用关单接口（多次调用幂等）
        try { await this.wxpay.closeJsapi(order.no); } catch (e) { /* 忽略关单失败以避免卡住取消流程 */ }
        const userInitiated = !!memberId && order.memberId === memberId;
        return this.orders.cancelOrder(id, body?.reason, adminId ?? null, { userInitiated });
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
    async refund(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string; amount?: number }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        const order: any = await this.orders.getOrder(id);
        if (!order) throw new BadRequestException('订单不存在');
        if (order.payStatus !== 'PAID') throw new BadRequestException('仅已支付订单可退款');
        if (order.payMethod === 'WECHAT_JSAPI') {
            // 走渠道退款
            const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund';
            const outRefundNo = `R_${order.no}_${Date.now()}`;
            const amountFen = Math.round(Number(order.payAmount) * 100);
            const requestedFen = Math.round(Number(body?.amount ?? order.payAmount) * 100);
            const isFullRequest = body?.amount == null || Math.abs(Number(body?.amount) - Number(order.payAmount)) < 0.000001;
            if (requestedFen < 1) throw new BadRequestException('退款金额必须≥0.01元');
            const existing:any = await this.orders.getOrder(id);
            const successSumFen = Math.round(((existing?.refundRecords||[]).filter((r:any)=>r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0)) * 100);
            const refundableFen = Math.max(0, amountFen - successSumFen);
            const refundFen = Math.min(requestedFen, refundableFen);
            if (isFullRequest && successSumFen > 0) throw new BadRequestException('已发生部分退款，不能再使用全额退款，请输入剩余可退金额');
            if (refundFen <= 0) throw new BadRequestException('累计退款金额已达上限');
            const allowed = await this.orders.verifyRefundAllowed(order.id, refundFen / 100);
            if (!allowed) throw new BadRequestException('退款校验未通过：关联权益已部分使用，无法全额退款');
            await this.orders.createRefundRecord({ orderId: order.id, memberId: order.memberId, amount: (refundFen/100), method: 'WECHAT_JSAPI' as any, reasonCode: 'WECHAT', reasonText: body?.reason || null, outRefundNo, status: 'PENDING' as any });
            try{
                const resp = await this.wxpay.createRefund({ outTradeNo: order.no, outRefundNo, refundAmountFen: refundFen, totalAmountFen: amountFen, reason: body?.reason, notifyUrl });
                await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, resp?.refund_id || null, null);
                try{ await (this.orders as any).saveRefundWechatResp(outRefundNo, resp); }catch{}
                return { ok: true, outRefundNo } as any;
            }catch(e){
                const msg = (e as any)?.message || String(e);
                await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, msg);
                return { ok: false, outRefundNo, error: msg } as any;
            }
        }
        // 若订单为线下方式但备注/时间线显示使用微信付款码（或存在 wechatTransactionId），则尝试走 v2 退款
        if ((order.payMethod === 'WECHAT_MICROPAY' || order.wechatTransactionId || String(order.remark||'').includes('WECHAT_MICROPAY') || (Array.isArray((order as any).timelines) && (order as any).timelines.some((t:any)=> t.value==='WECHAT_MICROPAY')))){
            const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund-v2';
            const outRefundNo = `R_${order.no}_${Date.now()}`;
            const amountFen = Math.round(Number(order.payAmount) * 100);
            const requestedFen = Math.round(Number(body?.amount ?? order.payAmount) * 100);
            const isFullRequest = body?.amount == null || Math.abs(Number(body?.amount) - Number(order.payAmount)) < 0.000001;
            if (requestedFen < 1) throw new BadRequestException('退款金额必须≥0.01元');
            const existing:any = await this.orders.getOrder(id);
            const rr = Array.isArray(existing?.refundRecords) ? existing.refundRecords : [];
            const successSumFen = Math.round(rr.filter((r:any)=>r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0) * 100);
            const refundableFen = Math.max(0, amountFen - successSumFen);
            const refundFen = Math.min(requestedFen, refundableFen);
            if (isFullRequest && successSumFen > 0) throw new BadRequestException('已发生部分退款，不能再使用全额退款，请输入剩余可退金额');
            if (refundFen <= 0) throw new BadRequestException('累计退款金额已达上限');
            const allowed = await this.orders.verifyRefundAllowed(order.id, refundFen / 100);
            if (!allowed) throw new BadRequestException('退款校验未通过：关联权益已部分使用，无法全额退款');
            await this.orders.createRefundRecord({ orderId: order.id, memberId: order.memberId, amount: (refundFen/100), method: 'OFFLINE' as any, reasonCode: 'WECHAT_MICROPAY', reasonText: body?.reason || null, outRefundNo, status: 'PENDING' as any });
            try{
                const resp = await this.wxpay.createRefundV2({ outTradeNo: order.no, outRefundNo, totalFeeFen: amountFen, refundFeeFen: refundFen, refundDesc: body?.reason, notifyUrl });
                // v2 同步返回不代表最终态，按需查询；此处标记 PROCESSING 交由人工/定时任务查询
                await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, resp?.refund_id || undefined, null);
                try{ await (this.orders as any).saveRefundWechatResp(outRefundNo, resp); }catch{}
                return { ok: true, outRefundNo } as any;
            }catch(e){
                const msg = (e as any)?.message || String(e);
                await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, msg);
                return { ok: false, outRefundNo, error: msg } as any;
            }
        }
        // 线下/其他渠道：内部退款并回收权益
        const updated = await this.orders.finalizeInternalRefund(id, body?.reason, operatorUserId);
        try{ await (this.orders as any).writeTimeline({ orderId: id, event: 'PAY_STATUS', value: 'REFUNDED', remark: body?.reason || undefined, operatorUserId: operatorUserId ?? null }); }catch{}
        return updated;
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
    async auditAfterSales(@Param('id', ParseIntPipe) id: number, @Body() body: { approve: boolean; remark?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        const result:any = await this.orders.auditAfterSales(id, !!body.approve, body?.remark, operatorUserId);
        // 审核通过后不自动发起退款，由前端确认卡片决定是否调用退款接口（仅退款类型才允许触发退款流程）
        return result;
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
        return await (this.orders as any).shipExchangeForAfterSales(id, operatorUserId, body);
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
        const isFullRequest = body?.amount == null || Math.abs(Number(body?.amount) - Number(order.payAmount)) < 0.000001;
        if (requestedFen < 1) throw new BadRequestException('退款金额必须≥0.01元');
        // 累计部分退款上限校验（SUCCESS 之和应 ≤ 实付）
        const existing:any = await this.orders.getOrder(id);
        const successSumFen = Math.round(((existing?.refundRecords||[]).filter((r:any)=>r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0)) * 100);
        const refundableFen = Math.max(0, amountFen - successSumFen);
        const refundFen = Math.min(requestedFen, refundableFen);
        if (isFullRequest && successSumFen > 0) throw new BadRequestException('已发生部分退款，不能再使用全额退款，请输入剩余可退金额');
        if (refundFen <= 0) throw new BadRequestException('累计退款金额已达上限');
        // 校验全额退款可行性（如洗车卡剩余次数不足则阻断）
        const allowed = await this.orders.verifyRefundAllowed(order.id, refundFen / 100);
        if (!allowed) throw new BadRequestException('退款校验未通过：关联权益已部分使用，无法全额退款');
        await this.orders.createRefundRecord({ orderId: order.id, memberId: order.memberId, amount: (refundFen/100), method: 'WECHAT_JSAPI' as any, reasonCode: 'WECHAT', reasonText: body?.reason || null, outRefundNo, status: 'PENDING' as any });
        try{
            const resp = await this.wxpay.createRefund({ outTradeNo: order.no, outRefundNo, refundAmountFen: refundFen, totalAmountFen: amountFen, reason: body?.reason, notifyUrl });
            await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, resp?.refund_id || null, null);
            try{ await (this.orders as any).saveRefundWechatResp(outRefundNo, resp); }catch{}
            return { ok: true, outRefundNo };
        }catch(e){
            const msg = (e as any)?.message || String(e);
            await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, msg);
            return { ok: false, outRefundNo, error: msg } as any;
        }
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
                        await this.orders.applyRefundSuccess({ orderId: rec.orderId, amountYuan: amt, method: 'WECHAT_JSAPI' as any, operatorUserId: undefined, outRefundNo, wechatRefundId: refundId });
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

    // 微信退款回调（v2 兼容占位，无验签要求，这里仅作为将来可能的桥接；建议以查询为准）
    @Post('_notify/wechat-refund-v2')
    async wechatRefundV2Notify(@Req() req: any, @Res() res: any){
        try{
            // v2 通知为 XML，当前项目默认 JSON 解析中间件，实际生产建议做原始体解析与验签；
            // 这里先直接返回成功，退款最终态以查询或运营确认为准。
            res.status(200).send('SUCCESS');
        }catch{
            res.status(200).send('SUCCESS');
        }
    }

    // 退款重试接口
    @Post('_refunds/:id/retry')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    async retryRefund(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string){
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        if (!operatorUserId) throw new BadRequestException('缺少管理员身份');
        const rec:any = await (this.orders as any).getRefundRecordById(id);
        if (!rec) throw new BadRequestException('退款记录不存在');
        if (rec.method !== 'WECHAT_JSAPI') throw new BadRequestException('仅支持微信渠道退款重试');
        if (rec.status === 'SUCCESS') throw new BadRequestException('该退款已成功，无需重试');
        const ord:any = rec.order;
        if (!ord || ord.payStatus !== 'PAID') throw new BadRequestException('订单状态不支持重试');
        const outRefundNo = rec.outRefundNo || `R_${ord.no}_${Date.now()}`;
        if (!rec.outRefundNo){ await (this.orders as any).setRefundOutRefundNo(rec.id, outRefundNo); }
        const amountFen = Math.round(Number(ord.payAmount) * 100);
        const requestedFen = Math.round(Number(rec.amount) * 100);
        if (requestedFen <= 0) throw new BadRequestException('退款金额必须大于0');
        const existing:any = await this.orders.getOrder(ord.id);
        const successSumFen = Math.round(((existing?.refundRecords||[]).filter((r:any)=>r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0)) * 100);
        const refundableFen = Math.max(0, amountFen - successSumFen);
        if (requestedFen > refundableFen) throw new BadRequestException('可退余额不足，请调整金额后新建退款');
        const notifyUrl = (process.env.PUBLIC_API_BASE || '').replace(/\/$/, '') + '/orders/_notify/wechat-refund';
        try{
            const resp = await this.wxpay.createRefund({ outTradeNo: ord.no, outRefundNo, refundAmountFen: requestedFen, totalAmountFen: amountFen, reason: rec.reasonText || undefined, notifyUrl });
            await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'PROCESSING' as any, resp?.refund_id || null, null);
            try{ await (this.orders as any).saveRefundWechatResp(outRefundNo, resp); }catch{}
            return { ok: true, outRefundNo } as any;
        }catch(e){
            const msg = (e as any)?.message || String(e);
            await this.orders.updateRefundStatusByOutRefundNo(outRefundNo, 'FAILED' as any, null, msg);
            return { ok: false, outRefundNo, error: msg } as any;
        }
    }

    // 发货：无需快递或快递发货
    @Post(':id/ship')
    @UseGuards(AdminGuard)
    @RequirePerm('orders')
    ship(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { noExpress?: boolean; companyCode?: string; companyName?: string; companyLogo?: string; trackingNo?: string; extra?: any; contactSenderPhoneMasked?: string; contactReceiverPhoneMasked?: string },
        @Headers('authorization') authHeader?: string,
    ) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.shipOrder(id, operatorUserId, body);
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
        return this.orders.editShipTrackingNo(id, body?.trackingNo, operatorUserId, { companyCode: body?.companyCode, companyName: body?.companyName, companyLogo: body?.companyLogo, contactSenderPhoneMasked: body?.contactSenderPhoneMasked, contactReceiverPhoneMasked: body?.contactReceiverPhoneMasked });
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
        const res = await this.orders.receiveOrder(id, adminId ?? null);
        // 若为会员主动确认收货，补充一条时间线记录以便前台/后台展示
        if (memberId) {
            try { await (this.orders as any).writeTimeline({ orderId: id, event: 'NOTE', value: 'RECEIVED', remark: 'USER_CONFIRMED' }); } catch {}
        }
        return res;
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


