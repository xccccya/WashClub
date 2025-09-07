import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AssetService } from '../file/asset.service.js';

@Injectable()
export class MemberLevelService {
  constructor(private prisma: PrismaService, private assets?: AssetService) {}

  list() { return this.prisma.memberLevel.findMany({ orderBy: [{ level: 'desc' }, { id: 'asc' }] }); }

  async create(data: { name: string; level?: number; requiredGrowth?: number; description?: string | null; iconUrl?: string | null; pointsMultiplier?: number; payDiscountPercent?: number; isDefault?: boolean }) {
    const payload: any = {
      name: String(data?.name || '').trim(),
      level: Math.max(1, Math.floor(Number(data?.level ?? 1))),
      requiredGrowth: Math.max(0, Math.floor(Number(data?.requiredGrowth ?? 0))),
      description: (data?.description ?? null) as any,
      iconUrl: (data?.iconUrl ?? null) as any,
      pointsMultiplier: Math.max(1, Math.floor(Number(data?.pointsMultiplier ?? 1))),
      payDiscountPercent: Math.max(0, Math.floor(Number(data?.payDiscountPercent ?? 0))),
      isDefault: !!data?.isDefault,
    };
    // 默认等级：强制 requiredGrowth = 0
    if (payload.isDefault) payload.requiredGrowth = 0;
    // 折扣上限 100
    if (payload.payDiscountPercent > 100) payload.payDiscountPercent = 100;
    const shouldBeDefault = !!payload.isDefault;
    return this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.memberLevel.updateMany({ data: { isDefault: false }, where: { isDefault: true } as any });
      } else {
        const existsDefault = await tx.memberLevel.count({ where: { isDefault: true } as any });
        if (existsDefault === 0) {
          // 系统必须存在唯一默认等级：如果还没有默认，则将新建的设为默认
          payload.isDefault = true;
          payload.requiredGrowth = 0;
        }
      }
      const created = await tx.memberLevel.create({ data: payload });
      // 文件引用绑定：iconUrl
      try { await this.syncBindings('MemberLevel', String(created.id), 'iconUrl', created.iconUrl ? [created.iconUrl] : []); } catch {}
      return created;
    });
  }

  async update(id: number, data: { name?: string; level?: number; requiredGrowth?: number; description?: string | null; iconUrl?: string | null; pointsMultiplier?: number; payDiscountPercent?: number; isDefault?: boolean }) {
    const wantUnsetDefault = data?.isDefault === false;
    const wantSetDefault = data?.isDefault === true;
    const payload: any = {};
    if (Object.prototype.hasOwnProperty.call(data, 'name')) payload.name = String(data?.name || '').trim();
    if (Object.prototype.hasOwnProperty.call(data, 'level')) payload.level = Math.max(1, Math.floor(Number(data?.level)) || 1);
    if (Object.prototype.hasOwnProperty.call(data, 'requiredGrowth')) payload.requiredGrowth = Math.max(0, Math.floor(Number(data?.requiredGrowth) || 0));
    if (Object.prototype.hasOwnProperty.call(data, 'description')) payload.description = (data?.description ?? null) as any;
    if (Object.prototype.hasOwnProperty.call(data, 'iconUrl')) payload.iconUrl = (data?.iconUrl ?? null) as any;
    if (Object.prototype.hasOwnProperty.call(data, 'pointsMultiplier')) payload.pointsMultiplier = Math.max(1, Math.floor(Number(data?.pointsMultiplier) || 1));
    if (Object.prototype.hasOwnProperty.call(data, 'payDiscountPercent')) payload.payDiscountPercent = Math.max(0, Math.min(100, Math.floor(Number(data?.payDiscountPercent) || 0)));
    return this.prisma.$transaction(async (tx) => {
      if (wantSetDefault) {
        // 设为默认：清除其他默认
        await tx.memberLevel.updateMany({ data: { isDefault: false }, where: { id: { not: id } } as any });
        const updated = await tx.memberLevel.update({ where: { id }, data: { ...payload, isDefault: true, requiredGrowth: 0 } });
        try { await this.syncBindings('MemberLevel', String(updated.id), 'iconUrl', updated.iconUrl ? [updated.iconUrl] : []); } catch {}
        return updated;
      }
      if (wantUnsetDefault) {
        const current = await tx.memberLevel.findUnique({ where: { id } });
        if (current?.isDefault) {
          const othersDefault = await tx.memberLevel.count({ where: { id: { not: id }, isDefault: true } as any });
          if (othersDefault === 0) {
            throw new BadRequestException('系统需要存在一个默认等级，请先将其他等级设为默认');
          }
        }
      }
      const updated = await tx.memberLevel.update({ where: { id }, data: payload });
      try { await this.syncBindings('MemberLevel', String(updated.id), 'iconUrl', updated.iconUrl ? [updated.iconUrl] : []); } catch {}
      return updated;
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const level = await tx.memberLevel.findUnique({ where: { id } });
      if (!level) return null as any;
      if (level.isDefault) {
        const otherDefault = await tx.memberLevel.count({ where: { id: { not: id }, isDefault: true } as any });
        if (otherDefault === 0) {
          throw new BadRequestException('请先将其他等级设为默认后，再删除当前默认等级');
        }
      }
      // 将该等级下的会员 levelId 置空
      await tx.member.updateMany({ where: { levelId: id } as any, data: { levelId: null } as any });
      return tx.memberLevel.delete({ where: { id } });
    });
  }

  async getGrowthConfig() {
    const ss: any = await this.prisma.siteSetting.findFirst().catch(() => null);
    return { growthPerYuan: Math.max(1, Math.floor(Number(ss?.growthPerYuan ?? 1))) };
  }

  async saveGrowthConfig(growthPerYuan: number) {
    const val = Math.max(1, Math.floor(Number(growthPerYuan || 1)));
    const exists = await this.prisma.siteSetting.findFirst().catch(() => null);
    if (exists) return this.prisma.siteSetting.update({ where: { id: exists.id }, data: { growthPerYuan: val } });
    return this.prisma.siteSetting.create({ data: { growthPerYuan: val } as any });
  }

  // ========== 文件绑定辅助 ==========
  private async getAssetIdsFromUrls(urls: string[]): Promise<string[]> {
    const set = new Set<string>();
    for (const u of urls) {
      if (!u || typeof u !== 'string') continue;
      const s = String(u).trim();
      if (!s) continue;
      set.add(s);
      try { if (/^https?:\/\//i.test(s)) { const rel = new URL(s).pathname; if (rel) set.add(rel); } } catch {}
    }
    const arr = Array.from(set);
    if (arr.length === 0) return [];
    const rows = await (this.prisma as any).fileAsset.findMany({ where: { url: { in: arr } }, select: { id: true } });
    return Array.isArray(rows) ? rows.map((r: any) => String(r.id)) : [];
  }
  private async syncBindings(tableName: string, rowId: string, fieldName: string, urls: string[]) {
    try {
      const desired = new Set<string>(await this.getAssetIdsFromUrls(urls));
      const existing: any[] = await (this.prisma as any).fileBinding.findMany({ where: { tableName, rowId: String(rowId), fieldName } });
      for (const b of existing) {
        if (!desired.has(String(b.fileId))) {
          try { await this.assets?.unbindReference(String(b.fileId), String(b.id)); } catch {}
        }
      }
      for (const fid of desired) {
        const ok = existing.find((b: any) => String(b.fileId) === fid);
        if (!ok) { try { await this.assets?.bindReference(String(fid), { tableName, rowId: String(rowId), fieldName }); } catch {} }
      }
    } catch {}
  }
}


