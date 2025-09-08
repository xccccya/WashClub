import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MemberPointsService {
  constructor(private prisma: PrismaService) {}

  async getConfig(){
    const ss:any = await this.prisma.siteSetting.findFirst().catch(()=>null);
    return {
      pointsPerYuan: Math.max(0, Number(ss?.pointsPerYuan ?? 1)),
      pointsFenPerPoint: Math.max(0, Number(ss?.pointsFenPerPoint ?? 0)),
      pointsMaxDeductFenPerOrder: Math.max(0, Number(ss?.pointsMaxDeductFenPerOrder ?? 0)),
    };
  }

  async saveConfig(body: { pointsPerYuan: number; pointsFenPerPoint: number; pointsMaxDeductFenPerOrder: number }){
    const payload = {
      pointsPerYuan: Math.max(0, Math.floor(Number(body?.pointsPerYuan || 0))),
      pointsFenPerPoint: Math.max(0, Math.floor(Number(body?.pointsFenPerPoint || 0))),
      pointsMaxDeductFenPerOrder: Math.max(0, Math.floor(Number(body?.pointsMaxDeductFenPerOrder || 0))),
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


