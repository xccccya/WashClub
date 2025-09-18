import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { NotificationGateway } from './notification.gateway.js';
import { Queue, Worker, JobsOptions } from 'bullmq';
import Redis from 'ioredis';

type CreateNotificationInput = {
    title: string;
    content?: string | null;
    type?: string | null;
    linkPath?: string | null;
    target: { kind: 'ADMIN'; userId: number } | { kind: 'MEMBER'; memberId: number };
};

@Injectable()
export class NotificationService {
    private redis?: any;
    private notifyQueue?: Queue;
    private redisPub?: any;
    private redisSub?: any;
    private redisWorker?: any;
    

    constructor(private prisma: PrismaService, private gateway: NotificationGateway) {
        try{
            const url = process.env.REDIS_URL || '';
            const host = process.env.REDIS_HOST || '127.0.0.1';
            const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
            const password = process.env.REDIS_PASSWORD || undefined;
            const baseOpts: any = { host, port, password, maxRetriesPerRequest: null as any, enableReadyCheck: false };
            const mkRedis = () => url
                ? new (Redis as any)(url as any, { maxRetriesPerRequest: null as any, enableReadyCheck: false } as any)
                : new (Redis as any)(baseOpts as any);
            this.redis = mkRedis();
            this.redisPub = mkRedis();
            this.redisSub = mkRedis();
            this.redisWorker = mkRedis();
            this.notifyQueue = new Queue('notify', { connection: this.redis as any, prefix: 'bull' } as any);
            // 订阅广播通道：跨实例转发到本实例的 WS 连接
            try{
                (this.redisSub as any).subscribe('notify:broadcast');
                (this.redisSub as any).subscribe('notify:broadcast-all-admins');
                (this.redisSub as any).on('message', (channel: string, message: string)=>{
                    try{
                        const d:any = JSON.parse(message||'{}');
                        if (channel === 'notify:broadcast-all-admins') {
                            this.gateway.broadcastToAllAdmins(d?.payload);
                            return;
                        }
                        if (d?.target?.kind==='ADMIN') this.gateway.broadcastToAdmin(Number(d.target.userId||0), d.payload);
                        else if (d?.target?.kind==='MEMBER') this.gateway.broadcastToMember(Number(d.target.memberId||0), d.payload);
                    }catch{}
                });
            }catch{}
            // Worker 处理：广播通知/延时入库（用于跨实例）
            const worker = new Worker('notify', async (job)=>{
                const d:any = job.data || {};
                if (job.name === 'coupon-will-expire'){
                    try{
                        const memberId = Number(d?.target?.memberId||d?.memberId||0);
                        const memberCouponId = Number(d?.memberCouponId||0);
                        if (memberId>0 && memberCouponId>0){
                            await this.handleCouponWillExpire(memberId, memberCouponId, d?.payload);
                        }
                    }catch{}
                    return;
                }
                // 其余即时广播任务已改为 Pub/Sub，不再通过队列传递
                if (d?.target?.kind==='ADMIN') this.gateway.broadcastToAdmin(Number(d.target.userId||0), d.payload);
                else if (d?.target?.kind==='MEMBER') this.gateway.broadcastToMember(Number(d.target.memberId||0), d.payload);
            }, { connection: this.redisWorker as any, prefix: 'bull' } as any);
            try{ (worker as any).on?.('error', (_e:any)=>{}); }catch{}
            try{ (worker as any).on?.('failed', (_j:any,_e:any)=>{}); }catch{}
            try{ (worker as any).on?.('completed', (_j:any)=>{}); }catch{}

            // 智能促动：只促动真正到期的任务，不影响优惠券到期通知的精确调度
            try{
                const smartPromote = async ()=>{ 
                    try{ 
                        if (!this.notifyQueue) return;
                        
                        // 获取延时任务列表
                        const delayedJobs = await this.notifyQueue.getDelayed();
                        let promotedCount = 0;
                        
                        for (const job of delayedJobs) {
                            // 检查任务是否真的到期了
                            const jobDelay = job.opts?.delay || 0;
                            const jobCreatedAt = job.timestamp;
                            const shouldProcessAt = jobCreatedAt + jobDelay;
                            const now = Date.now();
                            
                            // 只有当任务真正到期时才促动（允许30秒误差）
                            if (now >= shouldProcessAt - 30000) {
                                // 对于优惠券到期通知，额外检查是否应该现在处理
                                if (job.name === 'coupon-will-expire') {
                                    const data = job.data as any;
                                    const memberCouponId = Number(data?.memberCouponId || 0);
                                    if (memberCouponId > 0) {
                                        // 检查优惠券当前状态
                                        const mc = await this.prisma.memberCoupon.findUnique({ 
                                            where: { id: memberCouponId }, 
                                            select: { endAt: true, usedAt: true } 
                                        });
                                        if (mc && !mc.usedAt && mc.endAt) {
                                            const timeUntilExpiry = new Date(mc.endAt).getTime() - now;
                                            const hours24 = 24 * 60 * 60 * 1000;
                                            // 只有当优惠券确实在24小时内到期时才促动
                                            if (timeUntilExpiry <= hours24 + 5 * 60 * 1000) { // 24小时+5分钟容差
                                                await job.promote();
                                                promotedCount++;
                                            }
                                        }
                                    }
                                } else {
                                    // 非优惠券到期任务，正常促动
                                    await job.promote();
                                    promotedCount++;
                                }
                            }
                        }
                        
                    }catch{} 
                };
                setInterval(smartPromote, 30000); // 改为30秒检查一次，降低频率
            }catch{}
        }catch(error){
            console.error('[NotificationService] 队列初始化失败:', error);
            this.notifyQueue = undefined;
        }
    }

    async create(input: CreateNotificationInput) {
        const data: any = {
            title: input.title,
            content: input.content ?? null,
            type: input.type ?? null,
            linkPath: input.linkPath ?? null,
            targetType: input.target.kind,
            targetUserId: input.target.kind === 'ADMIN' ? (input.target as any).userId : null,
            targetMemberId: input.target.kind === 'MEMBER' ? (input.target as any).memberId : null,
        };
        return this.prisma.notification.create({ data });
    }

    async notifyAndBroadcast(input: CreateNotificationInput) {
        const item = await this.create(input);
        // 附带管理频道 UI 配置（模板优先，其次类型默认UI）
        let ui: any = null;
        try{
            if (item.type) {
                const tpl:any = await this.prisma.notificationTemplate.findFirst({ where: { typeKey: item.type, /* @ts-ignore */ channel: 'ADMIN', enabled: true } } as any);
                if (tpl) ui = { duration: (tpl as any).uiDuration ?? undefined, type: (tpl as any).uiType ?? undefined, position: (tpl as any).uiPosition ?? undefined };
                if (!ui) {
                    try{ const st:any = await (this.prisma as any).notificationTypeSetting.findFirst({ where: { typeKey: item.type, /* @ts-ignore */ channel: 'ADMIN' } } as any); ui = st?.defaultUi || null; }catch{}
                }
            }
        }catch{}
        const payload = { type: 'notification', data: { id: item.id, title: item.title, content: item.content, type: item.type, linkPath: item.linkPath, createdAt: item.createdAt, ui } };
        // 首选：通过 Redis Pub/Sub 跨实例广播
        try{
            const msg:any = input.target.kind === 'ADMIN'
                ? { target: { kind:'ADMIN', userId: (input.target as any).userId }, payload }
                : { target: { kind:'MEMBER', memberId: (input.target as any).memberId }, payload };
            if (this.redisPub) await (this.redisPub as any).publish('notify:broadcast', JSON.stringify(msg));
            else throw new Error('pub-not-ready');
        }catch{
            // 兜底：本实例直接广播，避免消息丢失
            try{
                if (input.target.kind === 'ADMIN') this.gateway.broadcastToAdmin((input.target as any).userId, payload);
                else this.gateway.broadcastToMember((input.target as any).memberId, payload);
            }catch{}
        }
        return item;
    }

    // 管理端群发：向所有管理员（在线）广播一条通知（不入库）。用于即时提醒，如新订单提醒。
    async broadcastAdminRealtime(payloadData: { title: string; content?: string|null; typeKey?: string|null; linkPath?: string|null }){
        const { title, content, typeKey, linkPath } = payloadData;
        let ui: any = null;
        try{
            if (typeKey) {
                const tpl:any = await this.prisma.notificationTemplate.findFirst({ where: { typeKey, /* @ts-ignore */ channel: 'ADMIN', enabled: true } } as any);
                if (tpl) ui = { duration: (tpl as any).uiDuration ?? undefined, type: (tpl as any).uiType ?? undefined, position: (tpl as any).uiPosition ?? undefined };
            }
        }catch{}
        const payload = { type: 'notification', data: { id: 0, title, content: content ?? null, type: typeKey ?? null, linkPath: linkPath ?? null, createdAt: new Date(), ui } } as any;
        try{
            // 通过 Redis 广播一个特殊消息：target=ADMIN, userId=0 代表群发；各实例由 gateway 群发到所有 admin 客户端
            const msg:any = { target: { kind:'ADMIN', userId: 0 }, payload };
            if (this.redisPub) await (this.redisPub as any).publish('notify:broadcast-all-admins', JSON.stringify(msg));
        }catch{
            // 本实例直接群发：遍历 gateway 内存客户端
            try{ (this.gateway as any).broadcastToAllAdmins?.(payload); }catch{}
        }
        return { ok: true } as any;
    }

    // 券将过期：延时任务调度（T-24h）——到时入库并广播（仅基于队列）
    async scheduleCouponWillExpire(memberId: number, memberCouponId: number, title: string, content: string, linkPath?: string | null, delayMs?: number) {
        const payload = { type:'notification', data: { title, content, type: 'COUPON_WILL_EXPIRE', linkPath: linkPath ?? null } } as any;
        const delay = Number(delayMs||0);
        
        // 延迟为0或负数时立即处理（优惠券24小时内到期）
        if (delay <= 0) {
            try { await this.handleCouponWillExpire(memberId, memberCouponId, payload); } catch {}
            return { ok: true, immediate: true } as any;
        }
        
        // 队列未配置时，对于超过24小时到期的优惠券，跳过调度（不处理）
        if (!this.notifyQueue) {
            return { ok: false, error: 'Queue not available' } as any;
        }
        
        // 有正延迟时，加入队列调度（优惠券超过24小时到期）
        await this.notifyQueue.add('coupon-will-expire', { target: { kind:'MEMBER', memberId }, memberId, memberCouponId, payload }, { delay, removeOnComplete: true, removeOnFail: 20 } as any);
        return { ok: true, scheduled: true } as any;
    }


    private async handleCouponWillExpire(memberId: number, memberCouponId: number, payload: any){
        try{
            const linkPath = payload?.data?.linkPath ?? payload?.linkPath ?? '/pages/coupon/mine';
            const mc:any = await (this.prisma as any).memberCoupon.findUnique({ where: { id: memberCouponId }, select: { id:true, name:true, endAt:true, usedAt:true, memberId:true } });
            if (!mc) return;
            if (mc.usedAt) return;
            const endAt = mc.endAt ? new Date(mc.endAt as any) : null;
            if (!endAt) return;
            if (endAt.getTime() <= Date.now()) return; // 已过期，不发送
            
            // 关键检查：如果距离到期还有超过24小时，也不应该发送通知
            const timeUntilExpiry = endAt.getTime() - Date.now();
            const hours24 = 24 * 60 * 60 * 1000;
            
            // 允许一些时间误差（比如5分钟），因为队列调度可能不是完全精确的
            const tolerance = 5 * 60 * 1000; // 5分钟容差
            if (timeUntilExpiry > hours24 + tolerance) {
                return;
            }
            
            const endAtStr = (()=>{ try{ const d2 = endAt; const y=d2.getFullYear(); const m=String(d2.getMonth()+1).padStart(2,'0'); const dd=String(d2.getDate()).padStart(2,'0'); const hh=String(d2.getHours()).padStart(2,'0'); const mm=String(d2.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; }catch{return '';} })();
            const vars = { couponName: mc.name || '', endAt: endAtStr } as any;
            const fallback = { title: '优惠券即将到期', content: `您有优惠券即将到期：${mc.name||''}` } as any;
            await this.sendByTemplate('COUPON_WILL_EXPIRE', vars, { kind:'MEMBER', memberId }, fallback, linkPath);
        }catch{}
    }

    // 详情（鉴权由调用方控制 where 条件）
    async getByIdForAdmin(id: number, userId: number){
        return this.prisma.notification.findFirst({ where: { id, targetType: 'ADMIN' as any, targetUserId: userId } });
    }
    async getByIdForMember(id: number, memberId: number){
        return this.prisma.notification.findFirst({ where: { id, targetType: 'MEMBER' as any, targetMemberId: memberId } });
    }

    // 批量已读
    async markReadAll(target: { kind: 'ADMIN'; userId: number } | { kind: 'MEMBER'; memberId: number }){
        const where:any = { status: 'UNREAD' as any };
        if (target.kind==='ADMIN') where.targetUserId = target.userId; else where.targetMemberId = target.memberId;
        const res = await this.prisma.notification.updateMany({ where, data: { status: 'READ' as any, readAt: new Date() } });
        return { ok: true, count: res.count } as any;
    }

    // 模板渲染并发送（若未配置模板可按类型设置决定是否使用回退文案）
    async sendByTemplate(typeKey: string, vars: Record<string, any>, target: { kind: 'ADMIN'; userId: number } | { kind: 'MEMBER'; memberId: number }, fallback: { title: string; content?: string|null }, linkPath?: string | null){
        // 类型设置检查
        const channel = target.kind === 'ADMIN' ? 'ADMIN' : 'MEMBER';
        try{
            const st:any = await (this.prisma as any).notificationTypeSetting.findFirst({ where: { typeKey, channel } });
            if (st && st.enabled === false) { return { ok:false, skipped:true } as any; }
        }catch{}
        let title = fallback.title;
        let content = fallback.content ?? null;
        try{
            const tpl = await this.prisma.notificationTemplate.findFirst({ where: { typeKey, /* @ts-ignore */ channel, enabled: true } } as any);
            if (tpl){
                const render = (tmpl:string)=> tmpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k)=>{
                    const v = vars?.[String(k)] ;
                    return v===undefined||v===null ? '' : String(v);
                });
                title = render(tpl.titleTemplate||title);
                content = render(tpl.contentTemplate||content||'');
            } else {
                // 无模板：按 allowFallback 决定是否发送
                try{
                    const st:any = await (this.prisma as any).notificationTypeSetting.findFirst({ where: { typeKey, channel } });
                    if (st && st.allowFallback === false) return { ok:false, skipped:true } as any;
                }catch{}
            }
        }catch{}
        return this.notifyAndBroadcast({ title, content, type: typeKey, linkPath: linkPath ?? null, target });
    }

    async listForAdmin(userId: number, params?: { status?: 'UNREAD' | 'READ'; take?: number; skip?: number }) {
        return this.prisma.notification.findMany({
            where: { targetType: 'ADMIN' as any, targetUserId: userId, status: params?.status as any },
            orderBy: { id: 'desc' },
            take: params?.take ?? 50,
            skip: params?.skip ?? 0,
        });
    }

    async listForMember(memberId: number, params?: { status?: 'UNREAD' | 'READ'; take?: number; skip?: number }) {
        return this.prisma.notification.findMany({
            where: { targetType: 'MEMBER' as any, targetMemberId: memberId, status: params?.status as any },
            orderBy: { id: 'desc' },
            take: params?.take ?? 50,
            skip: params?.skip ?? 0,
        });
    }

    async unreadCountForAdmin(userId: number) {
        return this.prisma.notification.count({ where: { targetType: 'ADMIN' as any, targetUserId: userId, status: 'UNREAD' as any } });
    }

    async unreadCountForMember(memberId: number) {
        return this.prisma.notification.count({ where: { targetType: 'MEMBER' as any, targetMemberId: memberId, status: 'UNREAD' as any } });
    }

    async markRead(id: number, target: { kind: 'ADMIN'; userId: number } | { kind: 'MEMBER'; memberId: number }) {
        const where: any = { id };
        if (target.kind === 'ADMIN') { where.targetUserId = target.userId; }
        else { where.targetMemberId = target.memberId; }
        const item = await this.prisma.notification.findFirst({ where });
        if (!item) return { ok: false };
        if (item.status === 'READ') return { ok: true };
        await this.prisma.notification.update({ where: { id: item.id }, data: { status: 'READ' as any, readAt: new Date() } });
        return { ok: true };
    }
}


