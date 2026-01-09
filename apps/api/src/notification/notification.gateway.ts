import { Injectable } from '@nestjs/common';
import { WebSocketServer } from 'ws';
import * as http from 'node:http';
import { JwtService } from '@nestjs/jwt';

type ClientInfo = { socket: any; uid: number; kind: 'admin'|'member' };

@Injectable()
export class NotificationGateway {
    private wss: WebSocketServer | null = null;
    private clients: Map<any, ClientInfo> = new Map();

    constructor(private jwt: JwtService) {}

    attachServer(server: http.Server) {
        if (this.wss) return;
        this.wss = new WebSocketServer({ server, path: '/ws' });
        this.wss.on('connection', (ws, req) => {
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
            }, 5000);

            const cleanup = () => {
                try { clearTimeout(authTimeout); } catch {}
                this.clients.delete(ws);
            };
            ws.on('close', cleanup);

            ws.on('message', (raw: any) => {
                if (authed) return;
                try {
                    const text = typeof raw === 'string' ? raw : (raw?.toString?.() ?? '');
                    const msg: any = JSON.parse(text || '{}');
                    if (msg?.type !== 'auth') {
                        try { ws.close(1008, 'auth required'); } catch { try { ws.close(); } catch {} }
                        return;
                    }
                    const token = String(msg?.token || '').trim();
                    if (!token) throw new Error('missing token');
                    const decoded: any = this.jwt.verify(token);
                    const uid = Number(decoded?.sub || 0);
                    const kind: 'admin'|'member' = decoded?.type === 'admin' ? 'admin' : 'member';
                    if (!uid) throw new Error('invalid sub');
                    const info: ClientInfo = { socket: ws, uid, kind };
                    this.clients.set(ws, info);
                    authed = true;
                    try { clearTimeout(authTimeout); } catch {}
                } catch {
                    try { ws.close(1008, 'auth failed'); } catch { try { ws.close(); } catch {} }
                }
            });
        });
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


