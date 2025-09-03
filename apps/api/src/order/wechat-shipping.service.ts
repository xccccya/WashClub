import { Injectable, Logger } from '@nestjs/common';
import { WechatTokenService } from '../auth/wechat-token.service.js';
import { PrismaService } from '../prisma.service.js';

type LogisticsType = 1 | 3 | 4; // 1: 快递发货；3: 服务/虚拟等无需物流；4: 无需快递发货

@Injectable()
export class WechatShippingService {
    private readonly logger = new Logger('WechatShippingService');

    constructor(
        private readonly token: WechatTokenService,
        private readonly prisma: PrismaService,
    ) {}

    private get merchantId(): string | undefined {
        try { return process.env.WXPAY_MCH_ID || process.env.wxpay_mchid || (process.env as any)['wxpay.mchid'] || undefined; } catch { return undefined; }
    }

    private formatRfc3339WithOffset(date: Date): string {
        const pad = (n: number, w=2) => String(n).padStart(w, '0');
        const y = date.getFullYear();
        const m = pad(date.getMonth()+1);
        const d = pad(date.getDate());
        const hh = pad(date.getHours());
        const mm = pad(date.getMinutes());
        const ss = pad(date.getSeconds());
        const ms = pad(date.getMilliseconds(), 3);
        const offMin = -date.getTimezoneOffset();
        const sign = offMin >= 0 ? '+' : '-';
        const abs = Math.abs(offMin);
        const oh = pad(Math.floor(abs/60));
        const om = pad(abs % 60);
        return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}${sign}${oh}:${om}`;
    }

    private async postJson(url: string, body: any){
        try {
            const res = await fetch(url as any, { method: 'POST', headers: { 'content-type': 'application/json' } as any, body: JSON.stringify(body) });
            const data = await (res as any).json();
            return data;
        } catch (e) {
            this.logger.warn(`request failed: ${url} ${e}`);
            return { errcode: -1, errmsg: 'system error' } as any;
        }
    }

    // 获取运力/快递公司列表（使用微信“获取运力id列表 get_delivery_list”）
    async getDeliveryList(): Promise<Array<{ code: string; name: string }>> {
        try {
            const at = await this.token.getAccessToken();
            // 官方文档：/cgi-bin/express/delivery/open_msg/get_delivery_list  POST {}
            const url = `https://api.weixin.qq.com/cgi-bin/express/delivery/open_msg/get_delivery_list?access_token=${encodeURIComponent(at)}`;
            const data = await this.postJson(url, {});
            const list: any[] = Array.isArray((data as any)?.delivery_list) ? (data as any).delivery_list : [];
            return list.map((it:any)=>({ code: String(it?.delivery_id || '').trim(), name: String(it?.delivery_name || '').trim() })).filter(x=> x.code && x.name);
        } catch { return []; }
    }

    private async buildItemDesc(orderId: number): Promise<string> {
        const items = await this.prisma.orderItem.findMany({ where: { orderId } });
        if (items.length === 0) return '订单商品';
        if (items.length === 1){
            const it = items[0];
            return `${it.name}*${it.quantity}`;
        }
        const first = items[0];
        const restCount = items.slice(1).reduce((s, it)=> s + Number(it.quantity||0), 0);
        return `${first.name}*${first.quantity}等${restCount}个商品`;
    }

    private detectIsSF(deliveryId?: string, deliveryName?: string): boolean {
        const id = String(deliveryId||'').toUpperCase();
        const nm = String(deliveryName||'');
        return id === 'SF' || /顺丰/.test(nm);
    }

    private maskPhoneIfNeeded(raw?: string | null): string | undefined {
        const s = String(raw||'').trim();
        if (!s) return undefined;
        if (/\*/.test(s)) return s; // 已掩码
        // 简单判断：11位纯数字 -> 中间四位掩码
        if (/^\d{11}$/.test(s)) return s.slice(0,3) + '****' + s.slice(7);
        return s;
    }

    // 发货信息录入
    async uploadShippingInfo(params: {
        orderId: number;
        logisticsType: LogisticsType;
        deliveryId?: string | null;
        trackingNo?: string | null;
        contact?: { senderPhoneMasked?: string; receiverPhoneMasked?: string } | null;
    }): Promise<{ ok: boolean; errcode?: number; errmsg?: string }>{
        // 读取订单：用于 order_key 与描述
        const order = await this.prisma.order.findUnique({ where: { id: params.orderId } });
        if (!order) return { ok: false, errmsg: 'order not found' };

        const transactionId = String(order.wechatTransactionId||'').trim();
        const useTransaction = !!transactionId;
        const orderKey = useTransaction
            ? { order_number_type: 2, transaction_id: transactionId }
            : { order_number_type: 1, mchid: this.merchantId, out_trade_no: order.no };

        const itemDesc = await this.buildItemDesc(order.id);
        const isExpress = params.logisticsType === 1;
        const isSF = this.detectIsSF(params.deliveryId||undefined, undefined);

        const shipping: any = {
            item_desc: itemDesc,
        };
        if (isExpress) {
            if (params.deliveryId) shipping.express_company = params.deliveryId;
            if (params.trackingNo) shipping.tracking_no = params.trackingNo;
            if (isSF && params.contact){
                const sp = this.maskPhoneIfNeeded(params.contact.senderPhoneMasked);
                const rp = this.maskPhoneIfNeeded(params.contact.receiverPhoneMasked);
                const contact: any = {};
                if (sp) contact.consignor_contact = sp;
                if (rp) contact.receiver_contact = rp;
                if (Object.keys(contact).length) shipping.contact = contact;
            }
        }

        const body: any = {
            order_key: orderKey,
            logistics_type: params.logisticsType,
            delivery_mode: 1,
            shipping_list: [shipping],
            upload_time: this.formatRfc3339WithOffset(new Date()),
        };
        // 支付者 openid
        try{
            const m = await this.prisma.member.findUnique({ where: { id: order.memberId }, select: { weixinOpenId: true } });
            const openid = String(m?.weixinOpenId || '').trim();
            if (openid) body.payer = { openid };
        }catch{}

        try{
            const at = await this.token.getAccessToken();
            // 发货信息录入接口：参考文档
            const url = `https://api.weixin.qq.com/wxa/sec/order/upload_shipping_info?access_token=${encodeURIComponent(at)}`;
            const resp = await this.postJson(url, body);
            const errcode = Number((resp as any)?.errcode ?? (resp as any)?.errCode ?? 0);
            const errmsg = String((resp as any)?.errmsg ?? (resp as any)?.message ?? 'ok');
            if (errcode === 0){ return { ok: true }; }
            this.logger.warn(`upload_shipping_info failed: ${errcode} ${errmsg}`);
            return { ok: false, errcode, errmsg };
        }catch(e:any){
            this.logger.error(`upload_shipping_info exception: ${e?.message||e}`);
            return { ok: false, errmsg: 'exception' };
        }
    }
}


