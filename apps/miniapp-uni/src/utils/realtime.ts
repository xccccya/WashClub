// 统一实时连接（WS）管理：H5 使用浏览器 WebSocket，小程序使用 uni.connectSocket。
// 简单事件通过 uni.$emit/uni.$on 分发：
// - 'realtime:connected' | 'realtime:disconnected'
// - 'realtime:notification'  payload: { id, title, content, linkPath, createdAt }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const uni: any;

import { notificationControllerList, notificationControllerUnreadCount } from '@wash/api-client';

type ConnectionState = 'idle' | 'connecting' | 'open';

function buildWsUrl(apiBase: string): string {
  const normalized = String(apiBase || '').trim().replace(/\/+$/, '');
  if (!normalized) throw new Error('API 基址为空');
  try {
    const u = new URL(normalized);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${u.host}/ws`;
  } catch {
    const url = normalized.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    if (!/^wss?:\/\//i.test(url)) throw new Error('API 基址不是有效的绝对地址');
    return `${url}/ws`;
  }
}

function isBrowserWebSocketAvailable() {
  return typeof window !== 'undefined' && typeof WebSocket !== 'undefined';
}

class RealtimeClient {
  private socketTask: any | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private lastToken = '';
  private apiBase = '';
  private state: ConnectionState = 'idle';
  private generation = 0;

  start(options: { apiBase: string; token: string }) {
    const apiBase = String(options?.apiBase || this.apiBase || '').trim();
    const token = String(options?.token || '').trim();
    this.apiBase = apiBase;
    if (!token) { this.stop(); return; }
    if (token === this.lastToken && (this.state === 'connecting' || this.state === 'open')) return;

    this.lastToken = token;
    this.cancelReconnect();
    this.openConnection();
  }

  updateToken(token: string) {
    const next = String(token || '').trim();
    if (!next) { this.stop(); return; }
    if (next !== this.lastToken) this.start({ apiBase: this.apiBase, token: next });
  }

  isConnected() { return this.state === 'open'; }

  stop() {
    this.lastToken = '';
    this.reconnectAttempt = 0;
    this.cancelReconnect();
    this.generation += 1;
    this.closeTransport();
  }

  private openConnection() {
    const token = this.lastToken;
    if (!token) return;

    let url = '';
    try { url = buildWsUrl(this.apiBase); }
    catch (error) {
      console.warn('[realtime] WebSocket 地址生成失败', error);
      this.scheduleReconnect();
      return;
    }

    this.generation += 1;
    const generation = this.generation;
    this.closeTransport();
    this.state = 'connecting';

    const onOpen = () => {
      if (generation !== this.generation || !this.socketTask) return;
      try { this.send(JSON.stringify({ type: 'auth', token })); }
      catch (error) {
        console.warn('[realtime] WebSocket 鉴权消息发送失败', error);
        this.handleDisconnect(generation);
        return;
      }
    };
    const onMessage = (evt: any) => {
      if (generation !== this.generation) return;
      try {
        const data = typeof evt?.data === 'string' ? JSON.parse(evt.data) : (evt?.data || {});
        if (data?.type === 'auth:ok') {
          if (this.state !== 'open') {
            this.state = 'open';
            this.clearConnectTimer();
            this.reconnectAttempt = 0;
            console.info(`[realtime] WebSocket 已连接：${url}`);
            try { uni.$emit?.('realtime:connected'); } catch {}
            void this.syncNotificationState(token);
          }
          return;
        }
        if (data?.type === 'notification' && data?.data) {
          try { uni.$emit?.('realtime:notification', data.data); } catch {}
          try { uni.$emit?.('realtime:unread-delta', { delta: 1 }); } catch {}
        }
        if (String(data?.type || '').startsWith('ride:')) {
          try { uni.$emit?.('ride:realtime', data); } catch {}
        }
      } catch (error) {
        console.warn('[realtime] WebSocket 消息解析失败', error);
      }
    };
    const onError = (error?: unknown) => {
      if (generation !== this.generation) return;
      console.warn(`[realtime] WebSocket 连接异常：${url}`, error || 'unknown error');
      this.handleDisconnect(generation);
    };
    const onClose = () => this.handleDisconnect(generation);

    try {
      console.info(`[realtime] 正在连接 WebSocket：${url}`);
      if (isBrowserWebSocketAvailable()) {
        const socket = new WebSocket(url);
        this.socketTask = socket;
        socket.onopen = onOpen;
        socket.onmessage = onMessage;
        socket.onerror = onError;
        socket.onclose = onClose;
      } else {
        const task = uni.connectSocket({ url });
        if (!task) throw new Error('uni.connectSocket 未返回 SocketTask');
        this.socketTask = task;
        task.onOpen?.(onOpen);
        task.onMessage?.(onMessage);
        task.onError?.(onError);
        task.onClose?.(onClose);
      }
      this.connectTimer = setTimeout(() => {
        if (generation !== this.generation || this.state !== 'connecting') return;
        console.warn(`[realtime] WebSocket 连接超时：${url}`);
        this.handleDisconnect(generation);
      }, 10_000);
    } catch (error) {
      console.warn(`[realtime] WebSocket 启动失败：${url}`, error);
      this.handleDisconnect(generation);
    }
  }

  private send(data: string) {
    if (!this.socketTask) throw new Error('WebSocket 尚未创建');
    if (isBrowserWebSocketAvailable() && this.socketTask instanceof WebSocket) this.socketTask.send(data);
    else this.socketTask.send?.({ data });
  }

  private handleDisconnect(generation: number) {
    if (generation !== this.generation || this.state === 'idle') return;
    this.state = 'idle';
    this.clearConnectTimer();
    const task = this.socketTask;
    this.socketTask = null;
    try {
      if (isBrowserWebSocketAvailable() && task instanceof WebSocket) {
        task.onopen = null; task.onmessage = null; task.onerror = null; task.onclose = null; task.close();
      } else task?.close?.();
    } catch {}
    try { uni.$emit?.('realtime:disconnected'); } catch {}
    this.scheduleReconnect();
  }

  private closeTransport() {
    this.state = 'idle';
    this.clearConnectTimer();
    const task = this.socketTask;
    this.socketTask = null;
    try {
      if (isBrowserWebSocketAvailable() && task instanceof WebSocket) {
        task.onopen = null; task.onmessage = null; task.onerror = null; task.onclose = null; task.close();
      } else task?.close?.();
    } catch {}
  }

  private scheduleReconnect() {
    if (!this.lastToken || this.reconnectTimer) return;
    const delay = Math.min(30_000, 1000 * Math.pow(2, this.reconnectAttempt++));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.lastToken) this.openConnection();
    }, delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearConnectTimer() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private async syncNotificationState(token: string) {
    if (token !== this.lastToken) return;
    const auth = `Bearer ${token}`;
    try {
      const result: any = await notificationControllerUnreadCount({ headers: { Authorization: auth } } as any);
      if (token === this.lastToken) try { uni.$emit?.('realtime:unread', { count: Number(result?.count || 0) }); } catch {}
    } catch {}
    try {
      const list: any[] = (await notificationControllerList({ status: 'UNREAD', take: 20 } as any, { headers: { Authorization: auth } } as any) as any) || [];
      if (token === this.lastToken) try { uni.$emit?.('realtime:unread-list', Array.isArray(list) ? list : []); } catch {}
    } catch {}
  }
}

export const realtime = new RealtimeClient();
