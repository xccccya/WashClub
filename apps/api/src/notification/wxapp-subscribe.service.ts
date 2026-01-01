import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { WechatTokenService } from '../auth/wechat-token.service.js';

function formatDateTime(d: Date): string {
	try{
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${y}-${m}-${dd} ${hh}:${mm}`;
	}catch{ return ''; }
}

function parseYmdOrYmdHm(input?: string | null): Date | null {
	try{
		const s = String(input || '').trim();
		if (!s) return null;
		// 支持：YYYY-MM-DD 或 YYYY-MM-DD HH:mm
		const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
		if (m1) {
			const y = Number(m1[1]); const mo = Number(m1[2]); const d = Number(m1[3]);
			if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
			// 默认给到 23:59，避免 time 字段不接受纯日期的情况
			return new Date(y, mo - 1, d, 23, 59, 0);
		}
		const m2 = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(s);
		if (m2) {
			const y = Number(m2[1]); const mo = Number(m2[2]); const d = Number(m2[3]);
			const hh = Number(m2[4]); const mm = Number(m2[5]);
			if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
			if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
			return new Date(y, mo - 1, d, hh, mm, 0);
		}
		// 兜底：尝试 Date.parse
		const d2 = new Date(s);
		if (!isNaN(d2.getTime())) return d2;
		return null;
	}catch{ return null; }
}

function renderTemplate(tmpl: string, vars: Record<string, any>): string {
	return String(tmpl || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k)=>{
		const v = vars?.[String(k)];
		return (v === undefined || v === null) ? '' : String(v);
	});
}

function sanitizeMiniappPagePath(raw?: string | null): string | undefined {
	try{
		let s = String(raw || '').trim();
		if (!s) return undefined;
		// 微信订阅消息 page 一般要求不带前导斜杠：pages/xxx/xxx?id=1
		s = s.replace(/^\/+/, '');
		return s || undefined;
	}catch{ return undefined; }
}

function buildWxTimeFieldValue(input?: string | null): string {
	// 微信 time* 字段非常严格：必须是合法时间文本。
	// 若无有效期（永久有效/未知），使用远期兜底时间，保证发送不失败。
	const d = parseYmdOrYmdHm(input);
	if (d) return formatDateTime(d);
	// 兜底：2099-12-31 23:59
	return '2099-12-31 23:59';
}

type SendResult = { ok: true; msgid?: string | null } | { ok: false; skipped?: boolean; errcode?: number | null; errmsg?: string | null };

@Injectable()
export class WxappSubscribeService {
	constructor(private prisma: PrismaService, private wechatToken: WechatTokenService) {}

	/**
	 * 获取某个 typeKey 在 WXAPP 频道的启用模板（单一启用）
	 */
	private async getEnabledWxappTemplate(typeKey: string): Promise<any | null> {
		const key = String(typeKey || '').trim();
		if (!key) return null;
		try{
			const tpl: any = await this.prisma.notificationTemplate.findFirst({
				where: { typeKey: key, channel: 'WXAPP' as any, enabled: true } as any,
				orderBy: { id: 'desc' } as any,
			});
			return tpl || null;
		}catch{
			return null;
		}
	}

	private async isTypeEnabled(typeKey: string): Promise<boolean> {
		try{
			const st: any = await (this.prisma as any).notificationTypeSetting.findFirst({ where: { typeKey, channel: 'WXAPP' } });
			if (st && st.enabled === false) return false;
		}catch{}
		return true;
	}

	private async getMemberSubscribeStatus(memberId: number, templateId: string): Promise<string | null> {
		const mid = Number(memberId || 0);
		const tpl = String(templateId || '').trim();
		if (!mid || !tpl) return null;
		try{
			const pref: any = await (this.prisma as any).wxappSubscribePreference.findFirst({
				where: { memberId: mid, templateId: tpl },
				orderBy: { id: 'desc' } as any,
			});
			const st = String(pref?.status || '').trim();
			return st || null;
		}catch{
			return null;
		}
	}

	async getWxappTemplateInfoForMember(typeKey: string, memberId?: number){
		const key = String(typeKey || '').trim();
		if (!key) return { ok: false, enabled: false, typeKey: key, templateId: null as any };
		// 两层开关：类型 + 模板
		const typeEnabled = await this.isTypeEnabled(key);
		const tpl = await this.getEnabledWxappTemplate(key);
		const enabled = !!typeEnabled && !!tpl && !!String(tpl?.wxTemplateId || '').trim();
		const templateId = enabled ? String(tpl.wxTemplateId) : null;
		const serverKnownStatus = (enabled && memberId) ? await this.getMemberSubscribeStatus(Number(memberId||0), String(templateId||'')) : null;
		return { ok: true, enabled, typeKey: key, templateId, serverKnownStatus };
	}

	/**
	 * 上报用户对某个 templateId 的订阅结果（accept/reject/ban/acceptWithAudio/acceptWithAlert 等）
	 */
	async reportSubscribeStatus(memberId: number, templateId: string, status: string){
		const mid = Number(memberId||0);
		const tpl = String(templateId||'').trim();
		const st = String(status||'').trim();
		if (!mid) return { ok:false, message:'memberId无效' } as any;
		if (!tpl) return { ok:false, message:'templateId必填' } as any;
		if (!st) return { ok:false, message:'status必填' } as any;
		try{
			const existing = await (this.prisma as any).wxappSubscribePreference.findFirst({ where: { memberId: mid, templateId: tpl } });
			if (existing){
				await (this.prisma as any).wxappSubscribePreference.update({ where: { id: existing.id }, data: { status: st } });
			} else {
				await (this.prisma as any).wxappSubscribePreference.create({ data: { memberId: mid, templateId: tpl, status: st } });
			}
		}catch{}
		return { ok: true } as any;
	}

	private async shouldSkipByUserPreference(memberId: number, templateId: string): Promise<boolean> {
		try{
			const pref: any = await (this.prisma as any).wxappSubscribePreference.findFirst({ where: { memberId, templateId } });
			const st = String(pref?.status || '').trim();
			if (!st) return false;
			// 明确拒绝/封禁则跳过；accept* 不跳过
			if (st === 'reject' || st === 'ban' || st === 'deny') return true;
		}catch{}
		return false;
	}

	/**
	 * 发送“次卡消费通知”（39297）对应的数据结构
	 *
	 * 模板字段（微信）：thing2 / short_thing3 / time4 / time5 / short_thing6
	 */
	async sendWashCardConsume(params: {
		memberId: number;
		typeKey: string; // 例如 WASH_CARD_CONSUME
		vars: {
			project: string;
			times: string;
			consumeAt: Date;
			expiryAtText?: string | null;
			remainingText: string;
			pageVars?: Record<string, any>;
		};
	}): Promise<SendResult> {
		const memberId = Number(params.memberId||0);
		const typeKey = String(params.typeKey||'').trim();
		if (!memberId || !typeKey) return { ok:false, skipped:true };

		// 类型层开关
		if (!(await this.isTypeEnabled(typeKey))) return { ok:false, skipped:true };

		// 模板层开关
		const tpl = await this.getEnabledWxappTemplate(typeKey);
		const templateId = String(tpl?.wxTemplateId || '').trim();
		if (!tpl || !templateId) return { ok:false, skipped:true };

		// openid
		const m = await this.prisma.member.findUnique({ where: { id: memberId }, select: { weixinOpenId: true } }).catch(()=>null);
		const openid = String(m?.weixinOpenId || '').trim();
		if (!openid) return { ok:false, skipped:true, errmsg:'no_openid' };

		// 用户偏好：明确拒绝则不发（减少无意义请求）
		if (await this.shouldSkipByUserPreference(memberId, templateId)) return { ok:false, skipped:true };

		// page 渲染（可选）
		let page: string | undefined;
		try{
			const raw = String(tpl?.wxPagePathTemplate || '').trim();
			if (raw) {
				page = renderTemplate(raw, params.vars.pageVars || {});
				page = sanitizeMiniappPagePath(page);
			}
		}catch{}

		const miniprogram_state = (String(tpl?.wxMiniprogramState || '').trim() || undefined) as any;
		const lang = (String(tpl?.wxLang || '').trim() || undefined) as any;

		const data = {
			thing2: { value: String(params.vars.project || '').slice(0, 20) }, // thing* 有长度限制，做保守截断
			short_thing3: { value: String(params.vars.times || '').slice(0, 10) },
			time4: { value: formatDateTime(params.vars.consumeAt || new Date()) },
			time5: { value: buildWxTimeFieldValue(params.vars.expiryAtText) },
			short_thing6: { value: String(params.vars.remainingText || '').slice(0, 10) },
		} as any;

		const payload = {
			touser: openid,
			template_id: templateId,
			page: page || undefined,
			miniprogram_state,
			lang,
			data,
		} as any;

		let errcode: number | null = null;
		let errmsg: string | null = null;
		let msgid: string | null = null;
		try{
			const accessToken = await this.wechatToken.getAccessToken();
			const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`;
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 12000);
			const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
			clearTimeout(timeout);
			const json: any = await resp.json().catch(()=>null);
			errcode = (json && typeof json.errcode === 'number') ? Number(json.errcode) : null;
			errmsg = (json && json.errmsg) ? String(json.errmsg) : (resp.ok ? null : `${resp.status} ${resp.statusText}`);
			msgid = json?.msgid ? String(json.msgid) : null;
			if (errcode !== 0) {
				// 常见：用户拒绝/无权限/订阅失效等；统一记录后返回失败
				return { ok:false, errcode, errmsg };
			}
			return { ok:true, msgid };
		}catch(e:any){
			errmsg = String(e?.message || e || 'network_error');
			return { ok:false, errmsg };
		} finally {
			// 发送日志（尽力而为，不影响主流程）
			try{
				await (this.prisma as any).wxappSubscribeSendLog.create({
					data: {
						typeKey,
						memberId,
						openid,
						templateId,
						page: page || null,
						payload: payload as any,
						errcode: errcode == null ? null : Number(errcode),
						errmsg: errmsg || null,
						msgid: msgid || null,
					}
				});
			}catch{}
		}
	}
}


