import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { WebSocketServer } from 'ws';
import * as http from 'node:http';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';

type ClientKind = 'admin' | 'member';
type ClientInfo = { socket: any; uid: number; kind: ClientKind };

const WS_AUTH_TIMEOUT_MS = 5000;
const WS_MAX_AUTH_MESSAGE_BYTES = 10_000;

@Injectable()
export class NotificationGateway implements OnModuleDestroy {
    private wss: WebSocketServer | null = null;
    private clients: Map<any, ClientInfo> = new Map();
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    constructor(private jwt: JwtService, private prisma: PrismaService) {}

    private async verifyWsToken(token: string): Promise<{ uid: number; kind: ClientKind }> {
        const decoded: any = this.jwt.verify(token);
        const uid = Number(decoded?.sub || 0);
        if (!Number.isFinite(uid) || uid <= 0) throw new Error('invalid sub');
        const type = String(decoded?.type || '');
        if (type !== 'admin' && type !== 'member') throw new Error('invalid type');

        // 安全加固：校验账号存在与状态（避免“已删除/禁用账号”的 token 仍保持 WS 会话）
        if (type === 'admin') {
            const user: any = await this.prisma.user.findUnique({ where: { id: uid }, include: { roleRef: true } });
            if (!user) throw new Error('account not found');
            if (user.roleId && user.roleRef && !user.roleRef.enabled) throw new Error('role disabled');
        } else {
            const member = await this.prisma.member.findUnique({ where: { id: uid }, select: { id: true } });
            if (!member) throw new Error('member not found');
        }

        return { uid, kind: type as ClientKind };
    }

    attachServer(server: http.Server) {
        if (this.wss) return;
        this.wss = new WebSocketServer({ server, path: '/ws' });
        this.wss.on('connection', (ws, req) => {
            (ws as any).isAlive = true;
            ws.on('pong', () => { (ws as any).isAlive = true; });
            // 安全策略：禁止通过 query token 鉴权（避免 URL 日志泄漏）
            try {
                const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
                if (url.searchParams.get('token')) {
                    try { ws.close(1008, 'token in query not allowed'); } catch { try { ws.close(); } catch {} }
                    return;
                }
            } catch {}

            // 连接后首包鉴权：客户端在 onOpen 后立即发送 { type: 'auth', token: '...' }
            let authed = false;
            const authTimeout = setTimeout(() => {
                if (authed) return;
                try { ws.close(1008, 'auth timeout'); } catch { try { ws.close(); } catch {} }
            }, WS_AUTH_TIMEOUT_MS);

            const cleanup = () => {
                try { clearTimeout(authTimeout); } catch {}
                this.clients.delete(ws);
            };
            ws.on('close', cleanup);
            ws.on('error', cleanup);

            ws.on('message', async (raw: any) => {
                if (authed) return;
                try {
                    const text = typeof raw === 'string' ? raw : (raw?.toString?.() ?? '');
                    if (text.length > WS_MAX_AUTH_MESSAGE_BYTES) {
                        try { ws.close(1009, 'message too large'); } catch { try { ws.close(); } catch {} }
                        return;
                    }
                    const msg: any = JSON.parse(text || '{}');
                    if (msg?.type !== 'auth') {
                        try { ws.close(1008, 'auth required'); } catch { try { ws.close(); } catch {} }
                        return;
                    }
                    const token = String(msg?.token || '').trim();
                    if (!token) throw new Error('missing token');
                    const { uid, kind } = await this.verifyWsToken(token);
                    const info: ClientInfo = { socket: ws, uid, kind };
                    this.clients.set(ws, info);
                    authed = true;
                    try { clearTimeout(authTimeout); } catch {}
                    try { ws.send(JSON.stringify({ type: 'auth:ok' })); } catch {}
                } catch {
                    try { ws.close(1008, 'auth failed'); } catch { try { ws.close(); } catch {} }
                }
            });
        });
        this.heartbeatTimer = setInterval(() => {
            for (const ws of this.clients.keys()) {
                if ((ws as any).isAlive === false) {
                    this.clients.delete(ws);
                    try { ws.terminate(); } catch {}
                    continue;
                }
                (ws as any).isAlive = false;
                try { ws.ping(); } catch { this.clients.delete(ws); }
            }
        }, 30_000);
        this.heartbeatTimer.unref?.();
        // eslint-disable-next-line no-console
        console.log('[ws] 实时服务已挂载：/ws');
    }

    onModuleDestroy() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        for (const ws of this.clients.keys()) {
            try { ws.close(1001, 'server shutdown'); } catch {}
        }
        this.clients.clear();
        try { this.wss?.close(); } catch {}
        this.wss = null;
    }

    broadcastToAdmin(userId: number, payload: any) {
        for (const [ws, info] of this.clients.entries()){
            if (info.kind === 'admin' && info.uid === userId){
                try { ws.send(JSON.stringify(payload)); } catch {}
            }
        }
    }

    broadcastToMember(memberId: number, payload: any) {
        for (const [ws, info] of this.clients.entries()){
            if (info.kind === 'member' && info.uid === memberId){
                try { ws.send(JSON.stringify(payload)); } catch {}
            }
        }
    }

    // 群发到所有管理员
    broadcastToAllAdmins(payload: any){
        for (const [ws, info] of this.clients.entries()){
            if (info.kind === 'admin'){
                try { ws.send(JSON.stringify(payload)); } catch {}
            }
        }
    }
}


