import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { GrowthLogSource } from '@prisma/client';

@Injectable()
export class MemberSignInService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private getDateStr(d = new Date()){
    const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  async signInByToken(token?: string){
    if (!token) throw new UnauthorizedException('未登录');
    let id: number | undefined;
    try{ const decoded: any = await this.jwt.verifyAsync(token); if (decoded?.type !== 'member') throw 0; id = Number(decoded?.sub); }catch{ throw new UnauthorizedException('未登录'); }
    if (!id) throw new UnauthorizedException('未登录');
    return this.signInCore(id);
  }

  async signInByAdmin(memberId: number){
    if (!memberId) throw new BadRequestException('缺少 memberId');
    return this.signInCore(memberId);
  }

  private async signInCore(memberId: number){
    const today = this.getDateStr();
    // 幂等：每日一次
    const exists = await (this.prisma as any).memberSignInLog.findUnique({ where: { memberId_dateStr: { memberId, dateStr: today } } }).catch(()=>null);
    if (exists) return { ok: true, repeated: true } as any;
    const ss: any = await this.prisma.siteSetting.findFirst().catch(()=>null);
    const growthPerYuan = Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1)));
    // 签到成长值：默认与 growthPerYuan 相同，后续可扩展成独立配置
    const growthGain = Math.max(1, growthPerYuan);
    await this.prisma.$transaction(async (tx)=>{
      await (tx as any).memberSignInLog.create({ data: { memberId, dateStr: today, growthGranted: growthGain } });
      await tx.member.update({ where: { id: memberId }, data: { growthPoints: { increment: growthGain } } });
      // 成长值日志（持久化）
      await (tx as any).memberGrowthLog.create({ data: { memberId, change: growthGain, source: GrowthLogSource.SIGN, desc: '签到' } });
      // 升级判定
      const m = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, growthPoints: true, levelId: true } });
      const levels = await tx.memberLevel.findMany({ orderBy: { level: 'desc' } });
      const target = levels.find(l => (m?.growthPoints ?? 0) >= (l.requiredGrowth ?? 0));
      if (target && target.id !== (m?.levelId || null)) {
        await tx.member.update({ where: { id: memberId }, data: { levelId: target.id } });
      }
    });
    return { ok: true, growth: growthGain } as any;
  }

  async listLogs(memberId?: number, dateStr?: string){
    const where: any = {};
    if (memberId) where.memberId = memberId;
    if (dateStr) where.dateStr = dateStr;
    return (this.prisma as any).memberSignInLog.findMany({ where, orderBy: { id: 'desc' } });
  }
}


