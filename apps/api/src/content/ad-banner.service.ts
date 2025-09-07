import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AssetService } from '../file/asset.service.js';

export interface CreateBannerDto {
    title?: string | null;
    imageUrl: string;
    enabled?: boolean;
    jumpEnabled?: boolean;
    linkPath?: string | null;
    weight?: number;
}

export interface UpdateBannerDto {
    title?: string | null;
    imageUrl?: string;
    enabled?: boolean;
    jumpEnabled?: boolean;
    linkPath?: string | null;
    weight?: number;
}

@Injectable()
export class AdBannerService {
    private syncBindings!: (rowId: string, urls: string[]) => Promise<void>;
    constructor(private prisma: PrismaService, private assets: AssetService) {}

    list(enabled?: 'true' | 'false' | '') {
        const where = typeof enabled === 'string' && enabled !== '' ? { enabled: enabled === 'true' } : undefined;
        return this.prisma.adBanner.findMany({
            where,
            orderBy: [{ weight: 'desc' }, { id: 'desc' }],
        });
    }

    async create(data: CreateBannerDto) {
        const created = await this.prisma.adBanner.create({ data: {
            title: data.title ?? null,
            imageUrl: data.imageUrl,
            enabled: !!data.enabled,
            jumpEnabled: !!data.jumpEnabled,
            linkPath: data.linkPath ?? null,
            weight: Number.isFinite(data.weight as number) ? Number(data.weight) : 0,
        }});
        try{ await this.syncBindings(String(created.id), created.imageUrl ? [created.imageUrl] : []); } catch {}
        return created;
    }

    async update(id: number, data: UpdateBannerDto) {
        const exists = await this.prisma.adBanner.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('横幅不存在');
        const updated = await this.prisma.adBanner.update({ where: { id }, data: {
            title: data.title === undefined ? exists.title : (data.title ?? null),
            imageUrl: data.imageUrl ?? exists.imageUrl,
            enabled: data.enabled ?? exists.enabled,
            jumpEnabled: data.jumpEnabled ?? exists.jumpEnabled,
            linkPath: data.linkPath === undefined ? exists.linkPath : (data.linkPath ?? null),
            weight: data.weight === undefined ? exists.weight : Number(data.weight || 0),
        }});
        try{ await this.syncBindings(String(updated.id), updated.imageUrl ? [updated.imageUrl] : []); } catch {}
        return updated;
    }

    remove(id: number) {
        return this.prisma.adBanner.delete({ where: { id } });
    }

    async enable(id: number, enabled: boolean) {
        const exists = await this.prisma.adBanner.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('横幅不存在');
        if (enabled) {
            const cnt = await this.prisma.adBanner.count({ where: { enabled: true } });
            if (cnt >= 3) {
                throw new Error('最多可同时启用3条横幅');
            }
        }
        return this.prisma.adBanner.update({ where: { id }, data: { enabled } });
    }

    activeList() {
        return this.prisma.adBanner.findMany({ where: { enabled: true }, orderBy: [{ weight: 'desc' }, { id: 'desc' }], take: 3 });
    }
}

// 绑定辅助
async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]>{
    const set = new Set<string>();
    for (const u of urls){ if(!u) continue; const s=String(u).trim(); if(!s) continue; set.add(s); try{ if(/^https?:\/\//i.test(s)){ const rel=new URL(s).pathname; if(rel) set.add(rel); } }catch{} }
    const arr = Array.from(set); if(!arr.length) return [];
    const rows = await (prisma as any).fileAsset.findMany({ where: { url: { in: arr } }, select: { id: true } });
    return Array.isArray(rows) ? rows.map((r:any)=>String(r.id)) : [];
}

// 将函数定义在 class 外，避免缩进变化；通过 this 调用
AdBannerService.prototype['syncBindings'] = async function(this: AdBannerService, rowId: string, urls: string[]){
    try{
        const desired = new Set<string>(await getAssetIdsFromUrls(this['prisma'], urls));
        const existing:any[] = await (this['prisma'] as any).fileBinding.findMany({ where: { tableName: 'AdBanner', rowId, fieldName: 'imageUrl' } });
        for (const b of existing){ if(!desired.has(String(b.fileId))) { try{ await this['assets'].unbindReference(String(b.fileId), String(b.id)); }catch{} } }
        for (const fid of desired){ const has = existing.find((b:any)=> String(b.fileId)===fid); if(!has){ try{ await this['assets'].bindReference(String(fid), { tableName:'AdBanner', rowId, fieldName:'imageUrl' }); }catch{} } }
    }catch{}
};


