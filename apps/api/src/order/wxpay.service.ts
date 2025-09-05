import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as https from 'node:https';

type JsapiPayParams = {
    appid: string;
    mchid: string;
    description: string;
    out_trade_no: string;
    notify_url: string;
    amount: { total: number; currency?: string };
    payer: { openid: string };
    attach?: string;
};

@Injectable()
export class WxpayService {
    private readonly apiV3Key: string;
    private readonly apiV2Key: string;
    private readonly merchantId: string;
    private readonly appId: string;
    private mchCertSerialNo: string;
    private merchantPrivateKeyPem: string;
    private merchantCertPem?: string;
    private readonly platformCertPem?: string; // 可选：用于主动验签

    constructor() {
        this.apiV3Key = process.env.WXPAY_API_V3
            || process.env.wxpay_apiV3
            || process.env['wxpay.apiV3' as any]
            || process.env['wxpay.apiV3Key' as any]
            || '';
        this.apiV2Key = process.env.WXPAY_API_V2
            || process.env.wxpay_apiV2
            || process.env['wxpay.apiV2' as any]
            || '';
        this.merchantId = process.env.WXPAY_MCH_ID
            || process.env.wxpay_mchid
            || process.env['wxpay.mchid' as any]
            || process.env['wxpay.mchId' as any]
            || '';
        this.appId = process.env.WECHAT_MINIAPP_APPID || process.env.WECHAT_APPID || '';
        const certPathOrKeyPath = process.env.WXPAY_MCH_PRIVATE_KEY
            || process.env.wxpay_keyPath
            || process.env['wxpay.keyPath' as any]
            || process.env.wxpay_certPath
            || process.env['wxpay.certPath' as any]
            || '';
        const ptcertPath = process.env.WXPAY_PLATFORM_CERT
            || process.env.wxpay_ptcertPath
            || process.env['wxpay.ptcertPath' as any]
            || '';
        const mchCertSn = process.env.WXPAY_MCH_CERT_SERIAL || '';

        if (!this.apiV3Key || !this.merchantId || !this.appId || !certPathOrKeyPath || !mchCertSn) {
            // 仅在调用时抛错，便于本地未配置也能启动
        }
        this.mchCertSerialNo = mchCertSn;
        // 解析证书/私钥路径：兼容目录（包含 apiclient_key.pem / apiclient_cert.pem）或单文件
        this.merchantPrivateKeyPem = '';
        this.merchantCertPem = undefined;
        if (certPathOrKeyPath) {
            const p = path.resolve(certPathOrKeyPath);
            if (fs.existsSync(p)) {
                const stat = fs.statSync(p);
                if (stat.isDirectory()) {
                    const keyFile = path.join(p, 'apiclient_key.pem');
                    const certFile = path.join(p, 'apiclient_cert.pem');
                    if (fs.existsSync(keyFile)) this.merchantPrivateKeyPem = fs.readFileSync(keyFile, 'utf8');
                    if (fs.existsSync(certFile)) this.merchantCertPem = fs.readFileSync(certFile, 'utf8');
                } else {
                    const content = fs.readFileSync(p, 'utf8');
                    if (/BEGIN PRIVATE KEY/.test(content)) this.merchantPrivateKeyPem = content;
                    else this.merchantCertPem = content;
                }
            }
        }
        this.platformCertPem = ptcertPath && fs.existsSync(ptcertPath) ? fs.readFileSync(path.resolve(ptcertPath), 'utf8') : undefined;
        // 自动推导证书序列号（若未配置）
        if (!this.mchCertSerialNo && this.merchantCertPem) {
            try {
                // Node 16+/18+：X509Certificate
                // @ts-ignore
                const X509 = (crypto as any).X509Certificate;
                if (typeof X509 === 'function') {
                    // @ts-ignore
                    const x = new X509(this.merchantCertPem);
                    const sn = String(x.serialNumber || '').trim();
                    if (sn) this.mchCertSerialNo = sn;
                }
            } catch {}
        }
    }

    private assertConfig() {
        if (!this.apiV3Key) throw new BadRequestException('未配置微信支付 APIv3 密钥（WXPAY_API_V3 / wxpay.apiV3）');
        if (!this.merchantId) throw new BadRequestException('未配置微信支付商户号（WXPAY_MCH_ID / wxpay.mchid）');
        if (!this.appId) throw new BadRequestException('未配置小程序 appid');
        if (!this.merchantPrivateKeyPem) throw new BadRequestException('未找到商户私钥（WXPAY_MCH_PRIVATE_KEY 或 wxpay.keyPath，或 wxpay.certPath 目录下 apiclient_key.pem）');
        if (!this.mchCertSerialNo) throw new BadRequestException('缺少商户证书序列号（WXPAY_MCH_CERT_SERIAL 或提供 apiclient_cert.pem 自动识别）');
    }

    // ============ API v2 (XML) 工具 ============
    private buildV2Sign(params: Record<string, string | number | undefined>, signType: 'HMAC-SHA256' | 'MD5' = 'HMAC-SHA256'){
        if (!this.apiV2Key) throw new BadRequestException('未配置微信支付 APIv2 密钥（WXPAY_API_V2 / wxpay.apiV2）');
        const data: Record<string,string> = {};
        Object.keys(params).sort().forEach(k=>{
            const v = params[k];
            if (v !== undefined && v !== null && v !== '' && k !== 'sign') data[k] = String(v);
        });
        const query = Object.keys(data).map(k=> `${k}=${data[k]}`).join('&') + `&key=${this.apiV2Key}`;
        if (signType === 'HMAC-SHA256'){
            return crypto.createHmac('sha256', this.apiV2Key).update(query, 'utf8').digest('hex').toUpperCase();
        }
        return crypto.createHash('md5').update(query, 'utf8').digest('hex').toUpperCase();
    }

    private buildXml(obj: Record<string, any>): string {
        const esc = (s: string)=> s.replace(/]]>/g, '');
        const parts = ['<xml>'];
        for (const k of Object.keys(obj)){
            const v = obj[k];
            if (v === undefined || v === null) continue;
            if (typeof v === 'number' || (/^\d+$/.test(String(v)))){
                parts.push(`<${k}>${v}</${k}>`);
            } else {
                parts.push(`<${k}><![CDATA[${esc(String(v))}]]></${k}>`);
            }
        }
        parts.push('</xml>');
        return parts.join('');
    }

    private parseXml(xml: string): Record<string,string>{
        const map: Record<string,string> = {};
        const tagRe = /<([a-zA-Z0-9_]+)>(?:<!\[CDATA\[(.*?)\]\]>|([^<]*))<\/\1>/gms;
        let m: RegExpExecArray | null;
        while ((m = tagRe.exec(xml))){
            const key = m[1];
            const val = (m[2] ?? m[3] ?? '').trim();
            map[key] = val;
        }
        return map;
    }

    // v2 退款通知 req_info 解密（AES-256-ECB / PKCS7Padding，key 为 apiV2Key 的 MD5 小写）
    decryptRefundReqInfo(reqInfoBase64: string): Record<string,string> {
        if (!this.apiV2Key) throw new BadRequestException('未配置微信支付 APIv2 密钥');
        const b64 = Buffer.from(reqInfoBase64 || '', 'base64');
        const md5 = crypto.createHash('md5').update(this.apiV2Key, 'utf8').digest('hex'); // 小写32位
        const key = Buffer.from(md5, 'utf8');
        const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
        decipher.setAutoPadding(true);
        const decrypted = Buffer.concat([decipher.update(b64), decipher.final()]);
        const xml = decrypted.toString('utf8');
        return this.parseXml(xml);
    }

    private async v2Request(pathname: string, bodyXml: string, useMutualTLS = false): Promise<{ status: number; body: string }>{
        const options: https.RequestOptions = {
            method: 'POST',
            hostname: 'api.mch.weixin.qq.com',
            path: pathname,
            headers: { 'Content-Type': 'text/xml', 'Accept': 'text/xml', 'Content-Length': Buffer.byteLength(bodyXml) },
        };
        if (useMutualTLS) {
            options.cert = this.merchantCertPem;
            options.key = this.merchantPrivateKeyPem;
        }
        const resBody = await new Promise<{ status:number; body:string }>((resolve, reject)=>{
            const req = https.request(options, (res)=>{
                const chunks: Buffer[] = [];
                res.on('data', (c)=> chunks.push(Buffer.isBuffer(c)? c : Buffer.from(c)));
                res.on('end', ()=> resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
            });
            req.on('error', reject);
            req.write(bodyXml);
            req.end();
        });
        return resBody;
    }

    // 付款码支付（micropay）
    async createMicropay(params: { outTradeNo: string; totalFeeFen: number; body: string; authCode: string; spbillCreateIp: string; attach?: string; deviceInfo?: string; signType?: 'HMAC-SHA256'|'MD5' }){
        if (!this.appId || !this.merchantId) this.assertConfig();
        if (!this.apiV2Key) throw new BadRequestException('未配置微信支付 APIv2 密钥');
        const urlPath = '/pay/micropay';
        const payload: Record<string, any> = {
            appid: this.appId,
            mch_id: this.merchantId,
            device_info: params.deviceInfo || undefined,
            nonce_str: crypto.randomBytes(16).toString('hex'),
            sign_type: params.signType || 'HMAC-SHA256',
            body: params.body,
            attach: params.attach || undefined,
            out_trade_no: params.outTradeNo,
            total_fee: params.totalFeeFen,
            spbill_create_ip: params.spbillCreateIp,
            auth_code: params.authCode,
        };
        const sign = this.buildV2Sign(payload, payload.sign_type);
        const xml = this.buildXml({ ...payload, sign });
        const resp = await this.v2Request(urlPath, xml, false);
        if (resp.status !== 200) throw new BadRequestException(`微信付款码支付请求失败: HTTP ${resp.status}`);
        const data = this.parseXml(resp.body);
        return data;
    }

    // 查询订单（v2）
    async queryOrderV2(params: { outTradeNo?: string; transactionId?: string }): Promise<Record<string,string>>{
        if (!params.outTradeNo && !params.transactionId) throw new BadRequestException('缺少 outTradeNo 或 transactionId');
        const urlPath = '/pay/orderquery';
        const payload: Record<string, any> = {
            appid: this.appId,
            mch_id: this.merchantId,
            nonce_str: crypto.randomBytes(16).toString('hex'),
            out_trade_no: params.outTradeNo,
            transaction_id: params.transactionId,
        };
        const sign = this.buildV2Sign(payload, 'HMAC-SHA256');
        const xml = this.buildXml({ ...payload, sign, sign_type: 'HMAC-SHA256' });
        const resp = await this.v2Request(urlPath, xml, false);
        if (resp.status !== 200) throw new BadRequestException(`查询订单失败: HTTP ${resp.status}`);
        return this.parseXml(resp.body);
    }

    // 撤销订单（v2，双向证书）
    async reverseOrderV2(params: { outTradeNo?: string; transactionId?: string }): Promise<Record<string,string>>{
        if (!params.outTradeNo && !params.transactionId) throw new BadRequestException('缺少 outTradeNo 或 transactionId');
        const urlPath = '/secapi/pay/reverse';
        const payload: Record<string, any> = {
            appid: this.appId,
            mch_id: this.merchantId,
            nonce_str: crypto.randomBytes(16).toString('hex'),
            out_trade_no: params.outTradeNo,
            transaction_id: params.transactionId,
            sign_type: 'HMAC-SHA256',
        };
        const sign = this.buildV2Sign(payload, 'HMAC-SHA256');
        const xml = this.buildXml({ ...payload, sign });
        const resp = await this.v2Request(urlPath, xml, true);
        if (resp.status !== 200) throw new BadRequestException(`撤销订单失败: HTTP ${resp.status}`);
        return this.parseXml(resp.body);
    }

    // 付款码支付容错流程：直连 -> USERPAYING/SYSTEMERROR 时轮询查询，超时则撤销
    async micropayFlow(params: { outTradeNo: string; totalFeeFen: number; body: string; authCode: string; spbillCreateIp: string; attach?: string; deviceInfo?: string }): Promise<{ status: 'SUCCESS'|'REVERSED'|'FAILED'; resp?: any; transactionId?: string; timeEnd?: string; bankType?: string; errCode?: string; errCodeDes?: string }>{
        const payResp = await this.createMicropay({ ...params });
        const rc = payResp.return_code;
        const rmsg = payResp.return_msg;
        if (rc !== 'SUCCESS'){
            return { status: 'FAILED', resp: payResp, errCode: rc, errCodeDes: rmsg };
        }
        if (payResp.result_code === 'SUCCESS'){
            return { status: 'SUCCESS', resp: payResp, transactionId: payResp.transaction_id, timeEnd: payResp.time_end, bankType: payResp.bank_type };
        }
        const errCode = String(payResp.err_code || '').toUpperCase();
        if (errCode === 'USERPAYING' || errCode === 'SYSTEMERROR' || errCode === 'BANKERROR'){
            // 轮询查询：每5s一次，最多45s
            const maxMs = 45000;
            const start = Date.now();
            while (Date.now() - start < maxMs){
                await new Promise(r=> setTimeout(r, 5000));
                const q = await this.queryOrderV2({ outTradeNo: params.outTradeNo });
                if (q.return_code === 'SUCCESS' && q.result_code === 'SUCCESS' && q.trade_state === 'SUCCESS'){
                    return { status: 'SUCCESS', resp: q, transactionId: q.transaction_id, timeEnd: q.time_end, bankType: q.bank_type };
                }
                // 若明确失败，跳出
                if (q.trade_state && q.trade_state !== 'USERPAYING') break;
            }
            // 超时未定：执行撤销（建议至少15秒后），此处已超过15s
            try{ const rv = await this.reverseOrderV2({ outTradeNo: params.outTradeNo }); return { status: 'REVERSED', resp: rv, errCode: rv.err_code, errCodeDes: rv.err_code_des }; }catch(e:any){ return { status: 'FAILED', resp: e?.message || e } as any; }
        }
        return { status: 'FAILED', resp: payResp, errCode, errCodeDes: payResp.err_code_des };
    }

    // 申请退款（v2，双向证书）
    async createRefundV2(params: { outTradeNo?: string; transactionId?: string; outRefundNo: string; totalFeeFen: number; refundFeeFen: number; refundDesc?: string; notifyUrl?: string }): Promise<Record<string,string>>{
        const urlPath = '/secapi/pay/refund';
        const payload: Record<string, any> = {
            appid: this.appId,
            mch_id: this.merchantId,
            nonce_str: crypto.randomBytes(16).toString('hex'),
            out_trade_no: params.outTradeNo,
            transaction_id: params.transactionId,
            out_refund_no: params.outRefundNo,
            total_fee: params.totalFeeFen,
            refund_fee: params.refundFeeFen,
            refund_desc: params.refundDesc || undefined,
            notify_url: params.notifyUrl || undefined,
            sign_type: 'HMAC-SHA256',
        };
        const sign = this.buildV2Sign(payload, 'HMAC-SHA256');
        const xml = this.buildXml({ ...payload, sign });
        const resp = await this.v2Request(urlPath, xml, true);
        if (resp.status !== 200) throw new BadRequestException(`微信退款申请失败: HTTP ${resp.status}`);
        return this.parseXml(resp.body);
    }

    // 查询退款（v2）
    async queryRefundV2(params: { outRefundNo?: string; outTradeNo?: string; transactionId?: string; refundId?: string }): Promise<Record<string,string>>{
        const urlPath = '/pay/refundquery';
        const payload: Record<string, any> = {
            appid: this.appId,
            mch_id: this.merchantId,
            nonce_str: crypto.randomBytes(16).toString('hex'),
            out_refund_no: params.outRefundNo,
            out_trade_no: params.outTradeNo,
            transaction_id: params.transactionId,
            refund_id: params.refundId,
            sign_type: 'HMAC-SHA256',
        };
        const sign = this.buildV2Sign(payload, 'HMAC-SHA256');
        const xml = this.buildXml({ ...payload, sign });
        const resp = await this.v2Request(urlPath, xml, false);
        if (resp.status !== 200) throw new BadRequestException(`查询退款失败: HTTP ${resp.status}`);
        return this.parseXml(resp.body);
    }

    private buildAuthorization(method: string, url: string, body: string): string {
        const nonceStr = crypto.randomBytes(12).toString('hex');
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(message);
        signer.end();
        const signature = signer.sign(this.merchantPrivateKeyPem, 'base64');
        const token = `mchid="${this.merchantId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.mchCertSerialNo}",signature="${signature}"`;
        return `WECHATPAY2-SHA256-RSA2048 ${token}`;
    }

    async closeJsapi(outTradeNo: string): Promise<void> {
        this.assertConfig();
        const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`;
        const bodyObj = { mchid: this.merchantId } as any;
        const body = JSON.stringify(bodyObj);
        const auth = this.buildAuthorization('POST', path, body);
        const resp = await fetch(`https://api.mch.weixin.qq.com${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'Accept': 'application/json' },
            body,
        });
        if (!resp.ok && resp.status !== 204) {
            let errText = await resp.text().catch(()=> '');
            try { const j = JSON.parse(errText); errText = JSON.stringify(j); } catch {}
            throw new BadRequestException(`微信关单失败: ${resp.status} ${resp.statusText} ${errText}`);
        }
    }

    async createRefund(params: { outTradeNo: string; outRefundNo: string; refundAmountFen: number; totalAmountFen: number; reason?: string; notifyUrl?: string }) {
        this.assertConfig();
        const urlPath = '/v3/refund/domestic/refunds';
        const bodyObj: any = {
            out_trade_no: params.outTradeNo,
            out_refund_no: params.outRefundNo,
            reason: params.reason || undefined,
            notify_url: params.notifyUrl || undefined,
            amount: { refund: params.refundAmountFen, total: params.totalAmountFen, currency: 'CNY' },
        };
        const body = JSON.stringify(bodyObj);
        const auth = this.buildAuthorization('POST', urlPath, body);
        const resp = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'Accept': 'application/json' },
            body,
        });
        if (!resp.ok) {
            let errText = await resp.text().catch(()=> '');
            try { const j = JSON.parse(errText); errText = JSON.stringify(j); } catch {}
            throw new BadRequestException(`微信退款申请失败: ${resp.status} ${resp.statusText} ${errText}`);
        }
        const data = await resp.json();
        return data;
    }
    async createJsapi(params: JsapiPayParams): Promise<any> {
        this.assertConfig();
        const urlPath = '/v3/pay/transactions/jsapi';
        const body = JSON.stringify({ ...params, appid: this.appId, mchid: this.merchantId });
        const auth = this.buildAuthorization('POST', urlPath, body);
        const resp = await fetch(`https://api.mch.weixin.qq.com${urlPath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': auth, 'Accept': 'application/json' },
            body,
        });
        if (!resp.ok) {
            let errText = await resp.text().catch(()=> '');
            try { const j = JSON.parse(errText); errText = JSON.stringify(j); } catch {}
            throw new BadRequestException(`微信下单失败: ${resp.status} ${resp.statusText} ${errText}`);
        }
        const data = await resp.json();
        // 期望 data: { prepay_id: '...' }
        if (!data?.prepay_id) throw new BadRequestException(`微信下单响应异常: ${JSON.stringify(data)}`);
        return data;
    }

    buildJsapiClientPayParams(prepayId: string) {
        // 生成给 wx.requestPayment 所需的签名参数
        const timeStamp = String(Math.floor(Date.now() / 1000));
        const nonceStr = crypto.randomBytes(12).toString('hex');
        const packageStr = `prepay_id=${prepayId}`;
        const signType = 'RSA';
        const message = `${this.appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(message);
        signer.end();
        const paySign = signer.sign(this.merchantPrivateKeyPem, 'base64');
        return { appId: this.appId, timeStamp, nonceStr, package: packageStr, signType, paySign };
    }

    // 解密回调资源
    decryptNotifyResource(nonce: string, associatedData: string, ciphertext: string) {
        const key = Buffer.from(this.apiV3Key, 'utf8');
        const iv = Buffer.from(nonce, 'utf8');
        const aad = Buffer.from(associatedData, 'utf8');
        const data = Buffer.from(ciphertext, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(data.subarray(data.length - 16));
        decipher.setAAD(aad);
        const decrypted = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    }
}


