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

    const cfg = await this.getSignInConfig();
    // 计算连签天数（截至昨天）
    const now = new Date();
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate()-1);
    const yestStr = this.getDateStr(yest);
    // 限定最近60天内检查连续性，足够覆盖大多数场景
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate()-60);
    const sinceStr = this.getDateStr(since);
    const recent: Array<{ dateStr: string }>= await (this.prisma as any).memberSignInLog.findMany({ where: { memberId, dateStr: { gte: sinceStr, lte: yestStr } }, select: { dateStr: true } });
    const set = new Set(recent.map(r=>r.dateStr));
    let streakUntilYesterday = 0;
    for (let i=1; i<=60; i++){
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()-i);
      const s = this.getDateStr(d);
      if (set.has(s)) streakUntilYesterday++;
      else break;
    }
    const todayIndex = streakUntilYesterday + 1; // 今天签完的连续天数
    const growthGain = this.computeReward(cfg, todayIndex);

    await this.prisma.$transaction(async (tx)=>{
      await (tx as any).memberSignInLog.create({ data: { memberId, dateStr: today, growthGranted: growthGain } });
      await tx.member.update({ where: { id: memberId }, data: { growthPoints: { increment: growthGain } } });
      // 成长值日志（持久化）
      await (tx as any).memberGrowthLog.create({ data: { memberId, change: growthGain, source: GrowthLogSource.SIGN, desc: `签到（连续第${todayIndex}天）` } });
      // 升级判定
      const m = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, growthPoints: true, levelId: true } });
      const levels = await tx.memberLevel.findMany({ orderBy: { level: 'desc' } });
      const target = levels.find(l => (m?.growthPoints ?? 0) >= (l.requiredGrowth ?? 0));
      if (target && target.id !== (m?.levelId || null)) {
        await tx.member.update({ where: { id: memberId }, data: { levelId: target.id } });
      }
    });
    return { ok: true, growth: growthGain, streakDays: todayIndex } as any;
  }

  private normalizeConfig(raw: any, fallback: number){
    const dayRewardsRaw = Array.isArray(raw?.dayRewards) ? raw.dayRewards : [];
    const dayRewards: number[] = new Array(7).fill(0).map((_, i)=>{
      const v = Number(dayRewardsRaw[i] ?? fallback);
      return Math.max(1, Math.floor(isFinite(v)?v:fallback));
    });
    const after7v = Number(raw?.after7 ?? dayRewards[6] ?? fallback);
    const after7 = Math.max(1, Math.floor(isFinite(after7v)?after7v:fallback));
    return { dayRewards, after7 } as { dayRewards: number[]; after7: number };
  }

  private async getSignInConfig(){
    const ss: any = await this.prisma.siteSetting.findFirst().catch(()=>null);
    const base = Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1)));
    const cfg = this.normalizeConfig(ss?.signInConfigJson || null, base);
    return cfg;
  }

  private computeReward(cfg: { dayRewards: number[]; after7: number }, index: number){
    if (index <= 0) return cfg.dayRewards[0] || cfg.after7 || 1;
    if (index <= 7) return cfg.dayRewards[index-1] ?? cfg.dayRewards[6] ?? cfg.after7;
    return cfg.after7;
  }

  async listLogs(memberId?: number, dateStr?: string){
    const where: any = {};
    if (memberId) where.memberId = memberId;
    if (dateStr) where.dateStr = dateStr;
    return (this.prisma as any).memberSignInLog.findMany({ where, orderBy: { id: 'desc' } });
  }

  // 会员：获取签到状态与统计（用于小程序）
  async getStatusByToken(token?: string){
    if (!token) throw new UnauthorizedException('未登录');
    let id: number | undefined;
    try{ const decoded: any = await this.jwt.verifyAsync(token); if (decoded?.type !== 'member') throw 0; id = Number(decoded?.sub); }catch{ throw new UnauthorizedException('未登录'); }
    if (!id) throw new UnauthorizedException('未登录');
    return this.getStatusByMember(id);
  }

  async getStatusByMember(memberId: number){
    const today = this.getDateStr();
    const now = new Date();
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate()-1);
    const yestStr = this.getDateStr(yest);
    const cfg = await this.getSignInConfig();
    const todayRow = await (this.prisma as any).memberSignInLog.findUnique({ where: { memberId_dateStr: { memberId, dateStr: today } } }).catch(()=>null);
    // 最近60天内的记录用于计算连续
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate()-60);
    const sinceStr = this.getDateStr(since);
    const recent: Array<{ dateStr: string; growthGranted: number }>= await (this.prisma as any).memberSignInLog.findMany({ where: { memberId, dateStr: { gte: sinceStr, lte: today } }, select: { dateStr: true, growthGranted: true } });
    const set = new Set(recent.map(r=>r.dateStr));
    let streakUntilYesterday = 0;
    for (let i=1; i<=60; i++){
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()-i);
      const s = this.getDateStr(d);
      if (set.has(s)) streakUntilYesterday++;
      else break;
    }
    const todaySigned = !!todayRow;
    const streakDays = todaySigned ? (streakUntilYesterday + 1) : streakUntilYesterday;
    const totalDays = await (this.prisma as any).memberSignInLog.count({ where: { memberId } });
    const totalGrowthAgg: any[] = await (this.prisma as any).memberSignInLog.aggregate({ _sum: { growthGranted: true }, where: { memberId } }) as any;
    const totalGrowth = Number((totalGrowthAgg as any)?._sum?.growthGranted || 0);
    const last = await (this.prisma as any).memberSignInLog.findFirst({ where: { memberId }, orderBy: { dateStr: 'desc' } }).catch(()=>null);
    const nextIndex = todaySigned ? (streakDays + 1) : (streakDays + 1); // 明日或今日应得的index用于前端展示奖励刻度
    const todayIndex = streakUntilYesterday + 1;
    const todayReward = this.computeReward(cfg, todayIndex);
    const maxStreak = await this.computeMaxStreak(memberId);
    return { todaySigned, streakDays, maxStreak, totalDays, totalGrowth, lastSignDate: last?.dateStr || null, rewardConfig: cfg, todayReward } as any;
  }

  private async computeMaxStreak(memberId: number): Promise<number> {
    const rows: Array<{ dateStr: string }> = await (this.prisma as any).memberSignInLog.findMany({ where: { memberId }, select: { dateStr: true }, orderBy: { dateStr: 'asc' } });
    let max = 0; let cur = 0; let prev: string | null = null;
    for (const r of rows){
      const ds = String(r.dateStr);
      if (!prev) { cur = 1; max = Math.max(max, cur); prev = ds; continue; }
      // 判断是否相邻1天
      const [py, pm, pd] = prev.split('-').map(n=>Number(n));
      const [y, m, d] = ds.split('-').map(n=>Number(n));
      const prevDate = new Date(py, pm-1, pd);
      const thisDate = new Date(y, m-1, d);
      const diff = Math.round((thisDate.getTime() - prevDate.getTime()) / (24*3600*1000));
      if (diff === 1) { cur += 1; } else if (diff === 0) { /* 同日重复不会出现，因唯一约束 */ } else { cur = 1; }
      if (cur > max) max = cur;
      prev = ds;
    }
    return max;
  }

  // 会员：按月查询签到日历（YYYY-MM）
  async getMonthByToken(token?: string, ym?: string){
    if (!token) throw new UnauthorizedException('未登录');
    let id: number | undefined;
    try{ const decoded: any = await this.jwt.verifyAsync(token); if (decoded?.type !== 'member') throw 0; id = Number(decoded?.sub); }catch{ throw new UnauthorizedException('未登录'); }
    if (!id) throw new UnauthorizedException('未登录');
    return this.getMonthByMember(id, ym);
  }

  async getMonthByMember(memberId: number, ym?: string){
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const reqYm = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : curYm;
    // 不允许查询未来月份
    if (reqYm > curYm) throw new BadRequestException('不支持查询未来月份');
    const [y, m] = reqYm.split('-').map(s=>Number(s));
    const start = new Date(y, m-1, 1);
    const end = new Date(y, m, 0);
    const startStr = this.getDateStr(start);
    const endStr = this.getDateStr(end);
    const rows: Array<{ dateStr: string }>= await (this.prisma as any).memberSignInLog.findMany({ where: { memberId, dateStr: { gte: startStr, lte: endStr } }, select: { dateStr: true } });
    const days = rows.map(r=> Number(r.dateStr.slice(-2)) ).filter(n => Number.isFinite(n));
    return { ym: reqYm, signedDays: days } as any;
  }

  // 管理后台：读取/保存签到配置
  async getConfigForAdmin(){ return this.getSignInConfig(); }
  async saveConfigForAdmin(body: { dayRewards: number[]; after7: number }){
    const dayRewards = Array.isArray(body?.dayRewards) ? body.dayRewards : [];
    if (dayRewards.length !== 7) throw new BadRequestException('应提供连续7天奖励数组');
    const normalized = this.normalizeConfig({ dayRewards, after7: body?.after7 }, 1);
    const exists = await this.prisma.siteSetting.findFirst().catch(()=>null);
    if (exists) return this.prisma.siteSetting.update({ where: { id: exists.id }, data: { signInConfigJson: normalized } as any });
    return this.prisma.siteSetting.create({ data: { signInConfigJson: normalized } as any });
  }
}


