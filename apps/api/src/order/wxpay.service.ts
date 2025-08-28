import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

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


