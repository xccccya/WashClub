import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { NotificationGateway } from './notification.gateway.js';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { WxappSubscribeService } from './wxapp-subscribe.service.js';

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

    private notifyDbSchedulerTimer?: any;
    

    constructor(private prisma: PrismaService, private gateway: NotificationGateway, private wxapp: WxappSubscribeService) {
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
                            await this.processCouponWillExpireFromQueue(memberId, memberCouponId, d?.payload);
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

        // DB 兜底调度：无论 Redis/BullMQ 是否可用，都启动（通过任务状态 claim 避免重复处理）
        try{
            this.startDbScheduler();
        }catch{}
    }

    private startDbScheduler(){
        if (this.notifyDbSchedulerTimer) return;
        const intervalMs = process.env.NOTIFY_DB_SCHEDULER_INTERVAL_MS ? Number(process.env.NOTIFY_DB_SCHEDULER_INTERVAL_MS) : 30000;
        const safeInterval = Number.isFinite(intervalMs) && intervalMs > 5000 ? intervalMs : 30000;
        this.notifyDbSchedulerTimer = setInterval(() => {
            this.processDueNotificationJobs().catch(()=>{});
        }, safeInterval);
    }

    private async processDueNotificationJobs(){
        const now = new Date();

        // 释放卡死的 PROCESSING（进程崩溃/异常退出等导致的锁遗留）
        try{
            const staleMs = process.env.NOTIFY_DB_SCHEDULER_STALE_LOCK_MS ? Number(process.env.NOTIFY_DB_SCHEDULER_STALE_LOCK_MS) : 10 * 60 * 1000;
            const safeStale = Number.isFinite(staleMs) && staleMs > 60000 ? staleMs : 10 * 60 * 1000;
            const staleAt = new Date(Date.now() - safeStale);
            await (this.prisma as any).notificationJob.updateMany({
                where: { status: 'PROCESSING', lockedAt: { lt: staleAt } },
                data: { status: 'PENDING', lockedAt: null, lastError: 'stale lock released' }
            });
        }catch{}

        // 拉取即将到期任务
        let jobs: any[] = [];
        try{
            jobs = await (this.prisma as any).notificationJob.findMany({
                where: { status: 'PENDING', runAt: { lte: now } },
                orderBy: { runAt: 'asc' },
                take: 50,
            });
        }catch{
            return;
        }
        if (!jobs || jobs.length === 0) return;

        for (const job of jobs){
            const id = Number(job?.id||0);
            if (!id) continue;
            const type = String(job?.type||'');
            const claimAt = new Date();
            let claimed = false;
            try{
                const res = await (this.prisma as any).notificationJob.updateMany({
                    where: { id, status: 'PENDING' },
                    data: { status: 'PROCESSING', lockedAt: claimAt, attempts: { increment: 1 } }
                });
                claimed = (res?.count || 0) === 1;
            }catch{ claimed = false; }
            if (!claimed) continue;

            try{
                if (type === 'COUPON_WILL_EXPIRE'){
                    const memberCouponId = Number(job?.memberCouponId||0);
                    let memberId = Number(job?.memberId||0);
                    if (!memberId && memberCouponId>0){
                        try{
                            const mc = await (this.prisma as any).memberCoupon.findUnique({ where: { id: memberCouponId }, select: { memberId: true } });
                            memberId = Number(mc?.memberId||0);
                        }catch{}
                    }
                    if (memberId>0 && memberCouponId>0){
                        await this.handleCouponWillExpire(memberId, memberCouponId, job?.payload);
                    }
                }
                await (this.prisma as any).notificationJob.update({
                    where: { id },
                    data: { status: 'DONE', processedAt: new Date(), lockedAt: null, lastError: null }
                });
            }catch(e:any){
                const prevAttempts = Number(job?.attempts || 0);
                const nextAttempts = prevAttempts + 1;
                const maxAttempts = Number(job?.maxAttempts || 20);
                const errMsg = (()=>{ try{ return String(e?.message || e || 'unknown'); }catch{ return 'unknown'; } })();
                try{
                    if (nextAttempts >= maxAttempts){
                        await (this.prisma as any).notificationJob.update({
                            where: { id },
                            data: { status: 'FAILED', lockedAt: null, lastError: errMsg }
                        });
                    } else {
                        const backoffMs = Math.min(60_000 * Math.max(1, nextAttempts), 15 * 60_000);
                        await (this.prisma as any).notificationJob.update({
                            where: { id },
                            data: { status: 'PENDING', lockedAt: null, lastError: errMsg, runAt: new Date(Date.now() + backoffMs) }
                        });
                    }
                }catch{}
            }
        }
    }

    private async upsertCouponWillExpireJob(params: { memberId: number; memberCouponId: number; runAt: Date; payload: any }){
        const { memberId, memberCouponId, runAt, payload } = params;
        if (!memberId || !memberCouponId) return null as any;
        try{
            const existing = await (this.prisma as any).notificationJob.findFirst({
                where: { type: 'COUPON_WILL_EXPIRE', memberCouponId }
            });
            if (existing){
                return (this.prisma as any).notificationJob.update({
                    where: { id: existing.id },
                    data: { status: 'PENDING', runAt, memberId, payload, lastError: null, lockedAt: null }
                });
            }
            return await (this.prisma as any).notificationJob.create({
                data: { type: 'COUPON_WILL_EXPIRE', status: 'PENDING', runAt, memberId, memberCouponId, payload, maxAttempts: 20 }
            });
        }catch{
            // 并发下可能触发唯一键冲突：回退为 update
            try{
                const existing2 = await (this.prisma as any).notificationJob.findFirst({
                    where: { type: 'COUPON_WILL_EXPIRE', memberCouponId }
                });
                if (existing2){
                    return (this.prisma as any).notificationJob.update({
                        where: { id: existing2.id },
                        data: { status: 'PENDING', runAt, memberId, payload, lastError: null, lockedAt: null }
                    });
                }
            }catch{}
            return null as any;
        }
    }

    private async processCouponWillExpireFromQueue(memberId: number, memberCouponId: number, payload: any){
        // 若存在 DB 任务，先 claim 再处理，避免与 DB scheduler 重复发送
        try{
            const existing = await (this.prisma as any).notificationJob.findFirst({
                where: { type: 'COUPON_WILL_EXPIRE', memberCouponId }
            });
            if (existing){
                const claimAt = new Date();
                const res = await (this.prisma as any).notificationJob.updateMany({
                    where: { id: existing.id, status: 'PENDING' },
                    data: { status: 'PROCESSING', lockedAt: claimAt, attempts: { increment: 1 } }
                });
                if ((res?.count || 0) !== 1) return;
                try{
                    await this.handleCouponWillExpire(memberId, memberCouponId, payload);
                    await (this.prisma as any).notificationJob.update({
                        where: { id: existing.id },
                        data: { status: 'DONE', processedAt: new Date(), lockedAt: null, lastError: null }
                    });
                }catch(e:any){
                    const errMsg = (()=>{ try{ return String(e?.message || e || 'unknown'); }catch{ return 'unknown'; } })();
                    try{
                        await (this.prisma as any).notificationJob.update({
                            where: { id: existing.id },
                            data: { status: 'PENDING', lockedAt: null, lastError: errMsg, runAt: new Date(Date.now() + 60_000) }
                        });
                    }catch{}
                }
                return;
            }
        }catch{}
        // 兼容历史：若没有 DB 任务，照旧处理
        await this.handleCouponWillExpire(memberId, memberCouponId, payload);
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
        const runAt = new Date(Date.now() + Math.max(0, delay));
        
        // 延迟为0或负数时立即处理（优惠券24小时内到期）
        if (delay <= 0) {
            try { await this.handleCouponWillExpire(memberId, memberCouponId, payload); } catch {}
            try{
                // 记录为已完成（用于幂等与观测）
                await (this.prisma as any).notificationJob.create({
                    data: { type:'COUPON_WILL_EXPIRE', status:'DONE', runAt: new Date(), memberId, memberCouponId, payload, processedAt: new Date() }
                });
            }catch{}
            return { ok: true, immediate: true } as any;
        }

        // 先落库任务：Redis/BullMQ 不可用时由 DB scheduler 兜底处理
        try{
            await this.upsertCouponWillExpireJob({ memberId, memberCouponId, runAt, payload });
        }catch{}
        
        // 有正延迟时，加入队列调度（优惠券超过24小时到期）
        try{
            if (this.notifyQueue) {
                await this.notifyQueue.add('coupon-will-expire', { target: { kind:'MEMBER', memberId }, memberId, memberCouponId, payload }, { delay, removeOnComplete: true, removeOnFail: 20 } as any);
                return { ok: true, scheduled: true, via: 'bullmq' } as any;
            }
        }catch{}
        // BullMQ 不可用也算调度成功：由 DB scheduler 执行
        return { ok: true, scheduled: true, via: 'db' } as any;
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

    // ============ WXAPP：微信小程序订阅消息 ============
    async sendWxappWashCardConsume(params: {
        memberId: number;
        typeKey?: string; // 默认 WASH_CARD_CONSUME
        project: string;
        timesText: string; // 例如 "2次"
        consumeAt?: Date;
        expiryAtText?: string | null;
        remainingText: string; // 短字段，例如 "8次" 或 "多卡"
        pageVars?: Record<string, any>;
    }){
        try{
            const typeKey = String(params.typeKey || 'WASH_CARD_CONSUME').trim();
            const memberId = Number(params.memberId||0);
            if (!memberId) return { ok:false, skipped:true } as any;
            return await this.wxapp.sendWashCardConsume({
                memberId,
                typeKey,
                vars: {
                    project: params.project,
                    times: params.timesText,
                    consumeAt: params.consumeAt || new Date(),
                    expiryAtText: params.expiryAtText ?? null,
                    remainingText: params.remainingText,
                    pageVars: params.pageVars || {},
                }
            });
        }catch{
            return { ok:false } as any;
        }
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

    // ============ 管理后台：消息总览（跨用户/跨会员） ============
    async adminOverview(params?: { from?: Date | null; to?: Date | null }) {
        const createdAt: any = {};
        if (params?.from) createdAt.gte = params.from;
        if (params?.to) createdAt.lte = params.to;
        const hasRange = !!params?.from || !!params?.to;
        const createdAtWhere = hasRange ? { createdAt } : undefined;

        const notifAdminWhere: any = { targetType: 'ADMIN' as any, ...(createdAtWhere || {}) };
        const notifMemberWhere: any = { targetType: 'MEMBER' as any, ...(createdAtWhere || {}) };
        const wxappWhere: any = { ...(createdAtWhere || {}) };

        const [
            adminTotal, adminUnread, adminRead,
            memberTotal, memberUnread, memberRead,
            wxTotal, wxSuccess,
        ] = await Promise.all([
            this.prisma.notification.count({ where: notifAdminWhere }),
            this.prisma.notification.count({ where: { ...notifAdminWhere, status: 'UNREAD' as any } }),
            this.prisma.notification.count({ where: { ...notifAdminWhere, status: 'READ' as any } }),

            this.prisma.notification.count({ where: notifMemberWhere }),
            this.prisma.notification.count({ where: { ...notifMemberWhere, status: 'UNREAD' as any } }),
            this.prisma.notification.count({ where: { ...notifMemberWhere, status: 'READ' as any } }),

            (this.prisma as any).wxappSubscribeSendLog.count({ where: wxappWhere }),
            (this.prisma as any).wxappSubscribeSendLog.count({ where: { ...wxappWhere, errcode: 0 } }),
        ]);

        const wxFailed = Math.max(0, Number(wxTotal || 0) - Number(wxSuccess || 0));

        return {
            ok: true,
            admin: { total: adminTotal, unread: adminUnread, read: adminRead },
            member: { total: memberTotal, unread: memberUnread, read: memberRead },
            wxapp: { total: wxTotal, success: wxSuccess, failed: wxFailed },
        };
    }

    async adminOverviewList(params: {
        channel: 'ADMIN' | 'MEMBER' | 'WXAPP';
        status?: 'UNREAD' | 'READ';
        result?: 'SUCCESS' | 'FAILED';
        typeKey?: string;
        q?: string;
        memberId?: number;
        from?: Date | null;
        to?: Date | null;
        take: number;
        skip: number;
    }) {
        const take = Math.max(1, Math.min(200, Number(params.take || 20)));
        const skip = Math.max(0, Number(params.skip || 0));

        const createdAt: any = {};
        if (params?.from) createdAt.gte = params.from;
        if (params?.to) createdAt.lte = params.to;
        const hasRange = !!params?.from || !!params?.to;
        const createdAtWhere = hasRange ? { createdAt } : undefined;

        const q = String(params.q || '').trim();
        const typeKey = String(params.typeKey || '').trim();

        if (params.channel === 'WXAPP') {
            const where: any = { ...(createdAtWhere || {}) };
            if (typeKey) where.typeKey = typeKey;
            if (params.memberId) where.memberId = Number(params.memberId);
            if (q) {
                where.OR = [
                    { typeKey: { contains: q } },
                    { templateId: { contains: q } },
                    { page: { contains: q } },
                    { errmsg: { contains: q } },
                    { msgid: { contains: q } },
                ];
            }
            if (params.result === 'SUCCESS') where.errcode = 0;
            if (params.result === 'FAILED') where.NOT = [{ errcode: 0 }];

            const [total, list] = await Promise.all([
                (this.prisma as any).wxappSubscribeSendLog.count({ where }),
                (this.prisma as any).wxappSubscribeSendLog.findMany({
                    where,
                    orderBy: { id: 'desc' },
                    take,
                    skip,
                }),
            ]);
            return { ok: true, total, list };
        }

        // ADMIN / MEMBER 站内通知
        const where: any = { targetType: params.channel as any, ...(createdAtWhere || {}) };
        if (params.status) where.status = params.status as any;
        if (typeKey) where.type = typeKey;
        if (params.channel === 'MEMBER' && params.memberId) where.targetMemberId = Number(params.memberId);
        if (q) {
            where.OR = [
                { title: { contains: q } },
                { content: { contains: q } },
                { type: { contains: q } },
                { linkPath: { contains: q } },
            ];
        }

        const [total, list] = await Promise.all([
            this.prisma.notification.count({ where }),
            this.prisma.notification.findMany({
                where,
                orderBy: { id: 'desc' },
                take,
                skip,
            }),
        ]);
        return { ok: true, total, list };
    }
}


