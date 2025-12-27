// 统一实时连接（WS）管理：小程序使用 uni.connectSocket，H5 回退原生 WebSocket
// 简单事件通过 uni.$emit/uni.$on 分发：
// - 'realtime:connected' | 'realtime:disconnected'
// - 'realtime:notification'  payload: { id, title, content, linkPath, createdAt }

// 对于 TS 环境的全局声明
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const uni: any;

import { notificationControllerList, notificationControllerUnreadCount } from '@wash/api-client';

function buildWsUrl(apiBase: string, token: string): string {
  try {
    const u = new URL(apiBase);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = new URLSearchParams({ token });
    return `${wsProto}//${u.host}/ws?${q.toString()}`;
  } catch {
    // 退化处理（简单替换协议）
    return apiBase.replace(/^http/i, 'ws') + `/ws?token=${encodeURIComponent(token)}`;
  }
}

class RealtimeClient {
  private socketTask: any | null = null;
  private reconnectTimer: any = null;
  private reconnectAttempt = 0;
  private lastToken: string = '';
  private apiBase = '';

  start(options: { apiBase: string; token: string }){
    const { apiBase, token } = options || ({} as any);
    this.apiBase = apiBase || this.apiBase;
    if (!token) { this.stop(); return; }
    if (this.socketTask) {
      if (this.lastToken === token) return; // token 未变更，无需重连
      this.stop();
    }
    this.lastToken = token;
    const url = buildWsUrl(this.apiBase, token);
    try {
      // 小程序端：uni.connectSocket 返回 SocketTask
      this.socketTask = uni.connectSocket({ url });
      const task = this.socketTask;
      if (!task) return;
      task.onOpen?.(()=>{ this.reconnectAttempt = 0; try{ uni.$emit?.('realtime:connected'); }catch{} });
      // 连接成功后拉取未读计数与最近未读列表，提升一致性
      task.onOpen?.(async ()=>{
        try{
          const auth = `Bearer ${this.lastToken}`;
          // 未读计数
          try{
            const r:any = await notificationControllerUnreadCount({ headers: { Authorization: auth } } as any);
            const c = Number(r?.count||0);
            try{ uni.$emit?.('realtime:unread', { count: c }); }catch{}
          }catch{}
          // 最近未读列表（最多 20 条）
          try{
            const list:any[] = (await notificationControllerList({ status: 'UNREAD', take: 20 } as any, { headers: { Authorization: auth } } as any) as any) || [];
            try{ uni.$emit?.('realtime:unread-list', Array.isArray(list) ? list : []); }catch{}
          }catch{}
        }catch{}
      });
      task.onMessage?.((evt:any)=>{
        try{
          const data = typeof evt?.data === 'string' ? JSON.parse(evt.data) : (evt?.data||{});
          if (data?.type === 'notification' && data?.data){
            try{ uni.$emit?.('realtime:notification', data.data); }catch{}
            // 未读计数增量事件（供角标快速响应）
            try{ uni.$emit?.('realtime:unread-delta', { delta: 1 }); }catch{}
          }
        }catch{}
      });
      const onClose = ()=>{
        this.socketTask = null; try{ uni.$emit?.('realtime:disconnected'); }catch{}
        this.scheduleReconnect();
      };
      task.onClose?.(onClose);
      task.onError?.(onClose);
    } catch {
      this.scheduleReconnect();
    }
  }

  updateToken(token: string){
    if (!token) { this.stop(); return; }
    if (token !== this.lastToken){ this.start({ apiBase: this.apiBase, token }); }
  }

  private scheduleReconnect(){
    if (this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempt++));
    this.reconnectTimer = setTimeout(()=>{
      this.reconnectTimer = null;
      if (this.lastToken) this.start({ apiBase: this.apiBase, token: this.lastToken });
    }, delay);
  }

  stop(){
    try{ if (this.reconnectTimer) clearTimeout(this.reconnectTimer); }catch{}
    this.reconnectTimer = null;
    try{ this.socketTask?.close?.(); }catch{}
    this.socketTask = null;
  }
}

export const realtime = new RealtimeClient();


