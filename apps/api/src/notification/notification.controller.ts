import { Controller, Get, Post, Body, Query, Param, Headers, BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service.js';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { WxappSubscribeService } from './wxapp-subscribe.service.js';
import { extractBearerToken } from '../auth/bearer.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import {
	NotificationListQueryDto,
	NotificationAdminOverviewListQueryDto,
	NotificationAdminOverviewQueryDto,
	NotificationMarkReadDto,
	NotificationUnreadCountResponseDto,
	NotificationUpsertTypeSettingDto,
} from './notification.dto.js';

@ApiTags('notification')
@Controller('notification')
export class NotificationController {
    constructor(private service: NotificationService, private jwt: JwtService, private prisma: PrismaService, private wxapp: WxappSubscribeService) {}

	private parseDateStart(input?: string | null): Date | null {
		try{
			const s = String(input || '').trim();
			if (!s) return null;
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
			if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
			const d = new Date(s);
			return isNaN(d.getTime()) ? null : d;
		}catch{ return null; }
	}

	private parseDateEnd(input?: string | null): Date | null {
		try{
			const s = String(input || '').trim();
			if (!s) return null;
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
			if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
			const d = new Date(s);
			return isNaN(d.getTime()) ? null : d;
		}catch{ return null; }
	}

    private async parseAuth(authHeader?: string): Promise<{ type: 'admin'|'member'; sub: number; permissions?: string[] }> {
        const token = extractBearerToken(authHeader);
        if (!token) throw new BadRequestException('未登录');
        let decoded: any; try { decoded = this.jwt.verify(token); } catch { throw new BadRequestException('登录已过期'); }
        const sub = Number(decoded?.sub||0); if (!sub) throw new BadRequestException('身份无效');
        const type: 'admin'|'member' = decoded?.type === 'admin' ? 'admin' : 'member';
        // 安全加固：校验账号/会员存在与状态
        if (type==='admin'){
            const user = await this.prisma.user.findUnique({ where: { id: sub }, include: { roleRef: true } });
            if (!user) throw new BadRequestException('账号不存在');
            if (user.roleId && user.roleRef && !user.roleRef.enabled) throw new BadRequestException('角色已被禁用');
			const permissions: string[] = Array.isArray((user as any).roleRef?.permissions) ? (((user as any).roleRef?.permissions) as any) : [];
			return { type, sub, permissions };
        } else {
            const member = await this.prisma.member.findUnique({ where: { id: sub } });
            if (!member) throw new BadRequestException('会员不存在');
        }
        return { type, sub };
    }

    @Get('list')
    @ApiOperation({ summary: '拉取我的通知列表（管理员或会员）' })
    @ApiOkResponse({ description: '通知列表' })
    async list(@Headers('authorization') authHeader?: string, @Query() query?: NotificationListQueryDto) {
        const { type, sub } = await this.parseAuth(authHeader);
        const take = Math.max(1, Math.min(200, Number((query as any)?.take ?? 50)));
        const skip = Math.max(0, Number((query as any)?.skip ?? 0));
        const status = (query as any)?.status as ('UNREAD'|'READ'|undefined);
        if (type === 'admin') return this.service.listForAdmin(sub, { status, take, skip });
        return this.service.listForMember(sub, { status, take, skip });
    }

    @Get('unread-count')
    @ApiOperation({ summary: '获取未读数' })
    @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
    async unreadCount(@Headers('authorization') authHeader?: string){
        const { type, sub } = await this.parseAuth(authHeader);
        if (type === 'admin') return { count: await this.service.unreadCountForAdmin(sub) };
        return { count: await this.service.unreadCountForMember(sub) };
    }

    @Post('mark-read')
    @ApiOperation({ summary: '标记为已读' })
    async markRead(@Headers('authorization') authHeader: string, @Body() dto: NotificationMarkReadDto){
        const { type, sub } = await this.parseAuth(authHeader);
        const id = Number((dto as any)?.id||0); if (!id) throw new BadRequestException('缺少通知ID');
        if (type === 'admin') return this.service.markRead(id, { kind: 'ADMIN', userId: sub });
        return this.service.markRead(id, { kind: 'MEMBER', memberId: sub });
    }

    @Get('by-id/:id')
    @ApiOperation({ summary: '获取单条通知详情（管理员或会员）' })
    async detail(@Headers('authorization') authHeader: string, @Param('id') idParam: string){
        const { type, sub } = await this.parseAuth(authHeader);
        const id = Number(idParam||0); if (!id) throw new BadRequestException('缺少通知ID');
        const item = type==='admin' ? await this.service.getByIdForAdmin(id, sub) : await this.service.getByIdForMember(id, sub);
        if (!item) throw new NotFoundException('消息不存在');
        return item;
    }

    @Post('mark-read-all')
    @ApiOperation({ summary: '全部标记已读' })
    async markReadAll(@Headers('authorization') authHeader: string){
        const { type, sub } = await this.parseAuth(authHeader);
        if (type==='admin') return this.service.markReadAll({ kind:'ADMIN', userId: sub });
        return this.service.markReadAll({ kind:'MEMBER', memberId: sub });
    }

	// ============ 管理后台：消息总览 ============
	@Get('admin/overview')
	@ApiOperation({ summary: '消息总览：三通道发送量统计（管理员）' })
	@UseGuards(AdminGuard)
	@RequirePerm('notification-overview')
	async adminOverview(@Query() query?: NotificationAdminOverviewQueryDto){
		const from = this.parseDateStart((query as any)?.from);
		const to = this.parseDateEnd((query as any)?.to);
		return this.service.adminOverview({ from, to });
	}

	@Get('admin/overview/list')
	@ApiOperation({ summary: '消息总览：详情列表（管理员）' })
	@UseGuards(AdminGuard)
	@RequirePerm('notification-overview')
	async adminOverviewList(@Query() query?: NotificationAdminOverviewListQueryDto){
		const from = this.parseDateStart((query as any)?.from);
		const to = this.parseDateEnd((query as any)?.to);
		const take = Math.max(1, Math.min(200, Number((query as any)?.take ?? 20)));
		const skip = Math.max(0, Number((query as any)?.skip ?? 0));
		const channel = String((query as any)?.channel || '').trim() as any;
		if (!['ADMIN','MEMBER','WXAPP'].includes(channel)) throw new BadRequestException('channel无效');
		return this.service.adminOverviewList({
			channel,
			status: (query as any)?.status as any,
			result: (query as any)?.result as any,
			typeKey: String((query as any)?.typeKey || '').trim() || undefined,
			q: String((query as any)?.q || '').trim() || undefined,
			memberId: (query as any)?.memberId ? Number((query as any)?.memberId) : undefined,
			from,
			to,
			take,
			skip,
		});
	}

    // ============ 类型设置管理（管理员） ============
    @Get('type-settings')
    @ApiOperation({ summary: '通知类型设置列表（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('notification-templates')
    async listTypeSettings(@Query('channel') channel?: 'MEMBER'|'ADMIN'|'WXAPP'){
        const where:any = channel ? { channel } : {};
        return this.prisma.notificationTypeSetting.findMany({ where, orderBy: { id: 'asc' } });
    }

    @Post('type-settings/upsert')
    @ApiOperation({ summary: '创建或更新通知类型设置（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('notification-templates')
    async upsertTypeSetting(@Body() dto: NotificationUpsertTypeSettingDto){
        const key = String(dto?.typeKey||'').trim(); const ch = String(dto?.channel||'');
        if (!key || !['MEMBER','ADMIN','WXAPP'].includes(ch)) throw new BadRequestException('参数无效');
        const existing = await this.prisma.notificationTypeSetting.findFirst({ where: { typeKey: key, channel: ch } });
        if (existing){
            return this.prisma.notificationTypeSetting.update({ where: { id: existing.id }, data: { enabled: dto.enabled!==undefined?!!dto.enabled:existing.enabled, allowFallback: dto.allowFallback!==undefined?!!dto.allowFallback:existing.allowFallback, defaultUi: dto.defaultUi!==undefined ? (dto.defaultUi as any) : existing.defaultUi } });
        }
        return this.prisma.notificationTypeSetting.create({ data: { typeKey: key, channel: ch, enabled: dto.enabled!==false, allowFallback: dto.allowFallback!==false, defaultUi: dto.defaultUi!==undefined ? (dto.defaultUi as any) : null } });
    }

    // 批量初始化常见通知类型（幂等）：仅管理员
    @Post('type-settings/init')
    @ApiOperation({ summary: '初始化常见通知类型设置（管理员）' })
    @UseGuards(AdminGuard)
    @RequirePerm('notification-templates')
    async initTypeSettings(){
        const types = [
            { typeKey:'ORDER_PAID', channel:'MEMBER' },
            { typeKey:'SERVICE_DONE', channel:'MEMBER' },
            { typeKey:'COUPON_WILL_EXPIRE', channel:'MEMBER' },
            { typeKey:'REFUND_ARRIVED', channel:'MEMBER' },
            { typeKey:'WASH_CARD_PAY_DEDUCT', channel:'MEMBER' },
            { typeKey:'WASH_CARD_DEDUCT', channel:'MEMBER' },
            { typeKey:'ADMIN_NEW_ORDER', channel:'ADMIN' },
            // 订阅消息：次卡消费通知（39297）
            { typeKey:'WASH_CARD_CONSUME', channel:'WXAPP' },
        ] as Array<{ typeKey:string; channel:'MEMBER'|'ADMIN'|'WXAPP' }>;
        const created: any[] = [];
        for (const it of types){
            const exists = await this.prisma.notificationTypeSetting.findFirst({ where: { typeKey: it.typeKey, channel: it.channel } });
            if (!exists){
                created.push(await this.prisma.notificationTypeSetting.create({ data: { typeKey: it.typeKey, channel: it.channel, enabled: true, allowFallback: true, defaultUi: it.channel==='ADMIN'? ({ type:'primary', position:'top-right', duration:4500 } as any) : null } }));
            }
        }
        return { ok: true, created: created.length };
    }

    // ============ WXAPP：订阅消息（会员端） ============
    @Get('wxapp/template')
    @ApiOperation({ summary: '获取某个订阅消息模板信息（会员端）' })
    async getWxappTemplate(@Headers('authorization') authHeader?: string, @Query('typeKey') typeKey?: string){
        const { type, sub } = await this.parseAuth(authHeader);
        // 允许管理员调试，但主要给会员端使用
        if (type !== 'member' && type !== 'admin') throw new BadRequestException('无权限');
        const key = String(typeKey||'').trim() || 'WASH_CARD_CONSUME';
        return this.wxapp.getWxappTemplateInfoForMember(key, type === 'member' ? sub : undefined);
    }

    @Post('wxapp/subscribe-report')
    @ApiOperation({ summary: '上报用户订阅结果（会员端）' })
    async reportWxappSubscribe(@Headers('authorization') authHeader: string, @Body() body: { templateId: string; status: string }){
        const { type, sub } = await this.parseAuth(authHeader);
        if (type !== 'member') throw new BadRequestException('无权限');
        const templateId = String((body as any)?.templateId||'').trim();
        const status = String((body as any)?.status||'').trim();
        if (!templateId || !status) throw new BadRequestException('参数无效');
        return this.wxapp.reportSubscribeStatus(sub, templateId, status);
    }

}


