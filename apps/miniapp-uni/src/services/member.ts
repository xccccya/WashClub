import { memberControllerGet, memberControllerList, orderControllerList, washCardControllerAdminMemberStats } from '@wash/api-client';
import { createHttpClient } from '@wash/shared-utils';

declare const uni: any;

export type MemberLite = {
  id?: number;
  uid?: number;
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
  level?: { id?: number; name?: string } | null;
  category?: { id?: number; name?: string } | null;
  tags?: Array<{ id?: number; name?: string }> | null;
  points?: number;
  balance?: number;
  totalPaidAmount?: number;
  growthPoints?: number;
  createdAt?: string | null;
  lastActiveAt?: string | null;
  // 派生字段：当后端使用对应排序时会附带（用于前端展示排序依据）
  lastVisitAt?: string | null;
  totalWashCount?: number;
};

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type MemberSortBy = 'createdAt' | 'totalPaidAmount' | 'totalWashCount' | 'lastVisitAt' | 'lastActiveAt';
export type SortOrder = 'asc' | 'desc';

export async function listMembers(options: {
  page: number;
  pageSize: number;
  keyword?: string;
  hasRemainingWashCard?: boolean;
  sortBy?: MemberSortBy | '' | null;
  sortOrder?: SortOrder | '' | null;
}): Promise<PagedResult<MemberLite>> {
  const page = Math.max(1, Number(options?.page || 1) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(options?.pageSize || 20) || 20));
  const keyword = String(options?.keyword || '').trim();
  const hasRemainingWashCard = !!options?.hasRemainingWashCard;
  const sortBy = String(options?.sortBy || '').trim();
  const sortOrder = sortBy ? (String(options?.sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc') : '';
  try {
    // OpenAPI 参数被定义为 string，这里保持一致，避免 url 参数格式异常
    const res: any = await memberControllerList(
      {
        page: String(page),
        pageSize: String(pageSize),
        keyword,
        ...(hasRemainingWashCard ? { hasRemainingWashCard: '1' } : {}),
        ...(sortBy ? { sortBy } : {}),
        ...(sortOrder ? { sortOrder } : {}),
      } as any,
    );
    const items: MemberLite[] = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    return {
      items,
      total: Number(res?.total || items.length || 0),
      page: Number(res?.page || page),
      pageSize: Number(res?.pageSize || pageSize),
    };
  } catch (e: any) {
    // 避免“静默空列表”导致误判：给出提示，但仍返回空结构以保持页面逻辑稳定
    try {
      const msg = String(e?.message || '').trim();
      // 简单分类：权限/登录问题优先提示
      if (msg.includes('401') || msg.includes('未登录') || msg.includes('登录已过期')) {
        uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      } else if (msg.includes('403') || msg.includes('无权限') || msg.includes('Forbidden')) {
        uni.showToast({ title: '无权限访问用户列表', icon: 'none' });
      } else {
        uni.showToast({ title: msg ? `加载失败：${msg}` : '加载失败', icon: 'none' });
      }
    } catch {}
    return { items: [], total: 0, page, pageSize };
  }
}

export async function getMemberDetail(id: number | string): Promise<MemberLite | null> {
  const sid = String(id || '').trim();
  if (!sid) return null;
  try {
    const res: any = await memberControllerGet(sid);
    return (res as any) || null;
  } catch {
    return null;
  }
}

export type MemberWashCardStats = {
  memberId: number;
  deductTimes: number;
  remainingTimes: number;
};

export async function getMemberWashCardStatsBatch(memberIds: number[]): Promise<Record<string, MemberWashCardStats | null>> {
  const ids = Array.from(new Set((Array.isArray(memberIds) ? memberIds : []).map((x) => Number(x || 0)).filter((n) => Number.isFinite(n) && n > 0)));
  if (!ids.length) return {};
  try {
    const res: any = await createHttpClient(`/wash-card/member-stats/batch`, {
      method: 'POST',
      body: { memberIds: ids },
    } as any);
    const items: any[] = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    const out: Record<string, MemberWashCardStats | null> = {};
    for (const it of items) {
      const id = Number(it?.memberId || 0);
      if (!id) continue;
      out[String(id)] = {
        memberId: id,
        deductTimes: Number(it?.deductTimes || 0) || 0,
        remainingTimes: Number(it?.remainingTimes || 0) || 0,
      };
    }
    // 对于未返回的 id，显式置为 0，避免前端反复请求
    for (const id of ids) {
      const k = String(id);
      if (out[k] === undefined) out[k] = { memberId: id, deductTimes: 0, remainingTimes: 0 };
    }
    return out;
  } catch {
    return {};
  }
}

export async function getMemberWashCardStats(memberId: number): Promise<MemberWashCardStats | null> {
  const id = Number(memberId || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const r: any = await washCardControllerAdminMemberStats({ memberId: id } as any);
    return {
      memberId: Number(r?.memberId || id),
      deductTimes: Number(r?.deductTimes || 0) || 0,
      remainingTimes: Number(r?.remainingTimes || 0) || 0,
    };
  } catch {
    return null;
  }
}

export type MemberOrderStats = {
  totalPaidAmount: number;
  totalWashCount: number;
  lastVisitAt: string | null;
};

function isPaidCompletedOrder(o: any): boolean {
  const payOk = String(o?.payStatus || '').toUpperCase() === 'PAID';
  const status = String(o?.status || '').toUpperCase();
  const fs = String(o?.fulfillmentStatus || '').toUpperCase();
  const statusOk = status === 'CLOSED' || status === 'FULFILLED' || fs === 'DONE';
  return payOk && statusOk && !o?.deletedAt;
}

function washTimesOfOrder(o: any): number {
  if (String(o?.type || '').toUpperCase() !== 'SERVICE') return 0;
  const n = Number(o?.washTimes);
  if (Number.isFinite(n) && n >= 0) return n;
  return 1;
}

export async function getMemberOrderStats(memberId: number): Promise<MemberOrderStats> {
  const id = Number(memberId || 0);
  if (!Number.isFinite(id) || id <= 0) return { totalPaidAmount: 0, totalWashCount: 0, lastVisitAt: null };
  try {
    const res: any = await orderControllerList({ memberId: String(id), includeDeleted: false } as any);
    const rows: any[] = Array.isArray(res) ? res : (Array.isArray(res?.items) ? res.items : (Array.isArray(res?.data?.items) ? res.data.items : []));
    const orders = Array.isArray(rows) ? rows : [];

    // 上次到店：取 SERVICE 订单最大 createdAt（不强制已完成，保持与后台抽屉口径一致）
    let lastVisitAt: string | null = null;
    try {
      const times = orders
        .filter((o: any) => String(o?.type || '').toUpperCase() === 'SERVICE')
        .map((o: any) => new Date(o?.createdAt || 0).getTime())
        .filter((t: number) => Number.isFinite(t) && t > 0);
      if (times.length) lastVisitAt = new Date(Math.max(...times)).toISOString();
    } catch {}

    const paidCompleted = orders.filter(isPaidCompletedOrder);
    const totalPaidAmount = paidCompleted.reduce((acc: number, o: any) => acc + Number(o?.payAmount || 0), 0);
    const totalWashCount = paidCompleted.reduce((acc: number, o: any) => acc + washTimesOfOrder(o), 0);

    return {
      totalPaidAmount: Number.isFinite(totalPaidAmount) ? totalPaidAmount : 0,
      totalWashCount: Number.isFinite(totalWashCount) ? totalWashCount : 0,
      lastVisitAt,
    };
  } catch {
    return { totalPaidAmount: 0, totalWashCount: 0, lastVisitAt: null };
  }
}

