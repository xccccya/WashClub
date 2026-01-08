import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MemberPointsService {
  constructor(private prisma: PrismaService) {}

  private normalizePointsPerYuan(ss: any): number {
    const fromYuan = Math.max(0, Math.floor(Number(ss?.pointsPerYuan ?? 0)));
    if (fromYuan > 0) return fromYuan;
    // 兜底：若新字段未配置，则按旧字段推导（pointsPerFen * 100）
    const perFen = Math.max(0, Math.floor(Number(ss?.pointsPerFen ?? 0)));
    return perFen > 0 ? perFen * 100 : 0;
  }

  async getConfig(){
    const ss:any = await this.prisma.siteSetting.findFirst().catch(()=>null);
    return {
      pointsPerYuan: this.normalizePointsPerYuan(ss),
      // 兼容旧字段回传（不建议新客户端使用）
      pointsPerFen: Math.max(0, Number(ss?.pointsPerFen ?? 1)),
      pointsFenPerPoint: Math.max(0, Number(ss?.pointsFenPerPoint ?? 0)),
      pointsMaxDeductFenPerOrder: Math.max(0, Number(ss?.pointsMaxDeductFenPerOrder ?? 0)),
    };
  }

  async saveConfig(body: { pointsPerYuan?: number; pointsPerFen?: number | null; pointsFenPerPoint: number; pointsMaxDeductFenPerOrder: number }){
    const pointsPerYuan = Math.max(0, Math.floor(Number(body?.pointsPerYuan ?? 0)));
    const legacyPerFen = Math.max(0, Math.floor(Number(body?.pointsPerFen ?? 0)));
    const finalPerYuan = pointsPerYuan > 0 ? pointsPerYuan : (legacyPerFen > 0 ? legacyPerFen * 100 : 0);
    const payload = {
      pointsPerYuan: finalPerYuan,
      pointsFenPerPoint: Math.max(0, Number(body?.pointsFenPerPoint || 0)),
      pointsMaxDeductFenPerOrder: Math.max(0, Number(body?.pointsMaxDeductFenPerOrder || 0)),
    } as const;
    const exists = await this.prisma.siteSetting.findFirst().catch(()=>null);
    if (exists) return this.prisma.siteSetting.update({ where: { id: exists.id }, data: payload });
    return this.prisma.siteSetting.create({ data: payload as any });
  }

  async listLogs(query: { memberId?: number; source?: string } = {}){
    const where:any = {};
    if (query.memberId) where.memberId = Number(query.memberId);
    if (query.source) where.source = String(query.source);
    const rows:any[] = await (this.prisma as any).memberPointsLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { order: { select: { id: true, no: true } } } });
    return (rows||[]).map(r=> ({ ...r, orderNo: r?.order?.no || null }));
  }

  async listLogsPaged(query: { page?: number; pageSize?: number; memberId?: number; source?: string; orderNo?: string; keyword?: string; from?: string; to?: string } = {}){
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize || 20)));
    const where: any = {};

    const memberId = query.memberId != null ? Number(query.memberId) : undefined;
    if (memberId && memberId > 0) where.memberId = memberId;

    if (query.source) where.source = String(query.source).toUpperCase();

    const orderNo = String(query.orderNo || '').trim();
    if (orderNo) where.order = { no: { contains: orderNo } };

    const keyword = String(query.keyword || '').trim();
    if (keyword && !where.memberId) {
      const num = Number(keyword);
      const ors: any[] = [];
      if (Number.isFinite(num) && num > 0) {
        ors.push({ id: Math.trunc(num) });
        ors.push({ uid: Math.trunc(num) });
      }
      ors.push({ name: { contains: keyword } });
      ors.push({ phone: { contains: keyword } });
      where.member = { OR: ors };
    }

    const range = parseDateRange(query.from, query.to);
    if (range?.from || range?.to) {
      where.createdAt = {};
      if (range.from) where.createdAt.gte = range.from;
      if (range.to) where.createdAt.lt = range.to;
    }

    const [total, rows] = await this.prisma.$transaction([
      (this.prisma as any).memberPointsLog.count({ where }),
      (this.prisma as any).memberPointsLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          order: { select: { id: true, no: true } },
          member: { select: { id: true, uid: true, name: true, phone: true } },
        },
      }),
    ]);

    const items = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: r.id,
      createdAt: r.createdAt,
      memberId: r.memberId,
      member: r.member ? { id: r.member.id, uid: r.member.uid, name: r.member.name, phone: r.member.phone } : null,
      change: Number(r.change || 0),
      source: r.source,
      desc: r.desc,
      orderId: r.orderId ?? null,
      orderNo: r?.order?.no || null,
      operatorUserId: r.operatorUserId ?? null,
    }));

    return { total: Number(total || 0), page, pageSize, items };
  }

  // 后台调整积分（正负均可），扣减不得使积分为负
  async adjustByAdmin(memberId: number, delta: number, remark?: string | null, operatorUserId?: number | null){
    const id = Number(memberId); if (!id) throw new BadRequestException('memberId无效');
    const change = Math.trunc(Number(delta||0));
    if (!Number.isFinite(change) || change === 0) throw new BadRequestException('变更值必须为非零整数');
    return this.prisma.$transaction(async (tx)=>{
      const m = await tx.member.findUnique({ where: { id }, select: { id: true, points: true } });
      if (!m) throw new BadRequestException('会员不存在');
      const before = Number(m.points||0);
      const next = before + change;
      if (next < 0) throw new BadRequestException('扣减后积分不可小于0');
      await tx.member.update({ where: { id }, data: { points: { increment: change } } });
      await (tx as any).memberPointsLog.create({ data: { memberId: id, change, source: (change>0?'ADMIN':'ADMIN') as any, desc: remark || '后台调整', operatorUserId: operatorUserId ?? null } });
      return { ok: true } as any;
    });
  }
}

function parseDateRange(from?: string, to?: string): { from?: Date; to?: Date } | null {
  const f = parseDateInput(from, 'start');
  const t = parseDateInput(to, 'end');
  if (!f && !t) return null;
  return { from: f || undefined, to: t || undefined };
}

function parseDateInput(input?: string, edge: 'start' | 'end' = 'start'): Date | null {
  const s = String(input || '').trim();
  if (!s) return null;
  // YYYY-MM-DD：按日边界解析；end 使用次日 00:00 作为 lt 上界
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    const dt = new Date(y, mo, d, 0, 0, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    if (edge === 'end') dt.setDate(dt.getDate() + 1);
    return dt;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}


