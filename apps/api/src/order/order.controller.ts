import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Headers, Req, Res, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { TanshuService } from './tanshu.service.js';
import { JwtService } from '@nestjs/jwt';
import { WxpayService } from './wxpay.service.js';

@ApiTags('Order')
@Controller('orders')
export class OrderController {
    constructor(private readonly orders: OrderService, private readonly jwt: JwtService, private readonly tanshu: TanshuService, private readonly wxpay: WxpayService) {}

    @Post('')
    create(@Body() body: any) { return this.orders.createOrder(body); }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) { return this.orders.getOrder(id); }

    @Get('by-no/:no')
    getByNo(@Param('no') no: string) { return this.orders.getOrderByNo(no); }

    @Get('')
    list(
        @Query('type') type?: 'SERVICE'|'SP'|'FK',
        @Query('status') status?: 'CREATED'|'PAID'|'FULFILLED'|'CLOSED'|'CANCELLED',
        @Query('payStatus') payStatus?: 'UNPAID'|'PAID'|'REFUNDED'|'CANCELLED',
        @Query('scene') scene?: string,
        @Query('includeDeleted') includeDeletedStr?: string,
        @Query('memberId') memberIdStr?: string,
        @Query('keyword') keyword?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        const memberId = memberIdStr ? Number(memberIdStr) : undefined;
        const includeDeleted = String(includeDeletedStr||'').toLowerCase() === 'true';
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
    markPaid(@Param('id', ParseIntPipe) id: number, @Body() body: { method: 'CASH'|'SHOUQIANBA'|'OFFLINE'; paidAt?: string }, @Headers('authorization') authHeader?: string) {
        const paidAt = body.paidAt ? new Date(body.paidAt) : undefined;
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.markPaid({ orderId: id, method: body.method, paidAt, operatorUserId });
    }

    // 软删除（替换原“关闭”操作）：仅设置 deletedAt，不改其他状态
    @Post(':id/close')
    close(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.softDeleteOrder(id, operatorUserId);
    }

    // 恢复软删除
    @Post(':id/restore')
    restore(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.restoreOrder(id, operatorUserId);
    }

    @Post(':id/refund')
    refund(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.refundOrder(id, body?.reason, operatorUserId);
    }

    // 发货：无需快递或快递发货
    @Post(':id/ship')
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
    receive(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.receiveOrder(id, operatorUserId);
    }
    // 开始服务
    @Post(':id/start-service')
    startService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.startService(id, operatorUserId);
    }
    // 结束服务
    @Post(':id/finish-service')
    finishService(@Param('id', ParseIntPipe) id: number, @Headers('authorization') authHeader?: string) {
        const operatorUserId = this.extractAdminIdFromAuthHeader(authHeader);
        return this.orders.finishService(id, operatorUserId);
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


