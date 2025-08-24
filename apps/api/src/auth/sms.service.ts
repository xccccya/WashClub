import { Injectable, BadRequestException } from '@nestjs/common';
import { createRequire } from 'node:module';

type Nullable<T> = T | null | undefined;

@Injectable()
export class SmsService {
	private get secretId(): string {
		const v = process.env.TENCENTCLOUD_SECRET_ID;
		if (!v) throw new BadRequestException('未配置 TENCENTCLOUD_SECRET_ID');
		return v;
	}

	private get secretKey(): string {
		const v = process.env.TENCENTCLOUD_SECRET_KEY;
		if (!v) throw new BadRequestException('未配置 TENCENTCLOUD_SECRET_KEY');
		return v;
	}

	private get region(): string {
		return process.env.SMS_REGION || 'ap-nanjing';
	}

	private get appId(): string {
		const v = process.env.SMS_SDK_APP_ID;
		if (!v) throw new BadRequestException('未配置 SMS_SDK_APP_ID');
		return v;
	}

	private get signName(): string {
		const v = process.env.SMS_SIGN_NAME;
		if (!v) throw new BadRequestException('未配置 SMS_SIGN_NAME');
		return v;
	}

	private get templateId(): string {
		const v = process.env.SMS_TEMPLATE_ID;
		if (!v) throw new BadRequestException('未配置 SMS_TEMPLATE_ID');
		return v;
	}

	/** 发送登录验证码 */
	async sendLoginCode(phone: string, code: string, minutes: number): Promise<void> {
		const e164Phone = this.toE164(phone);
		const require = createRequire(import.meta.url);
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const tencentcloud = require('tencentcloud-sdk-nodejs');
		const SmsClient = tencentcloud.sms.v20210111.Client;
		const client = new SmsClient({
			credential: { secretId: this.secretId, secretKey: this.secretKey },
			region: this.region,
			profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com', reqMethod: 'POST', reqTimeout: 10 } },
		});
		const params = {
			SmsSdkAppId: this.appId,
			SignName: this.signName,
			TemplateId: this.templateId,
			TemplateParamSet: [code, String(minutes)],
			PhoneNumberSet: [e164Phone],
		};
		try {
			await client.SendSms(params);
		} catch (e: any) {
			throw new BadRequestException(`短信发送失败: ${e?.message || e}`);
		}
	}

	private toE164(phone: string): string {
		const p = String(phone).trim();
		if (!/^1\d{10}$/.test(p)) throw new BadRequestException('手机号格式不正确');
		return `+86${p}`;
	}
}


