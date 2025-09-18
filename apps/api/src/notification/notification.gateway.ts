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
            try {
                const url = new URL(req.url || '', `http://${req.headers.host}`);
                const token = url.searchParams.get('token') || '';
                const decoded: any = this.jwt.verify(token);
                const uid = Number(decoded?.sub||0);
                const kind: 'admin'|'member' = decoded?.type==='admin' ? 'admin' : 'member';
                if (!uid) { ws.close(); return; }
                const info: ClientInfo = { socket: ws, uid, kind };
                this.clients.set(ws, info);
                ws.on('close', () => { this.clients.delete(ws); });
            } catch { try { ws.close(); } catch {} }
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


