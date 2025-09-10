import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';
import { FileService } from '../file/file.service.js';
import { AssetService } from '../file/asset.service.js';

@Injectable()
export class VehicleService {
    private syncBindings!: (tableName: string, rowId: string, fieldName: string, urls: string[]) => Promise<void>;
    private syncVehicleBindings!: (vehicleId: number) => Promise<void>;
    constructor(private prisma: PrismaService, private jwt: JwtService, private fileService: FileService, private assetService: AssetService) {}

    async adminList(page = 1, pageSize = 20, keyword?: string, scope: 'member' | 'all' = 'member') {
        const where: any = {};
        if (keyword) {
            where.OR = [
                { plateNumber: { contains: keyword } },
                { brand: { contains: keyword } },
                { series: { contains: keyword } },
                { member: { OR: [{ name: { contains: keyword } }, { phone: { contains: keyword } }] } },
            ];
        }
        if (scope === 'member') {
            // 默认：仅展示属于会员的车辆，过滤掉集团直绑车辆
            where.AND = [...(where.AND || []), { groupId: null }];
        }
        const [items, total] = await Promise.all([
            this.prisma.vehicle.findMany({
                skip: (page - 1) * pageSize,
                take: pageSize,
                where: Object.keys(where).length ? where : undefined,
                orderBy: { id: 'desc' },
                include: { member: true },
            }),
            this.prisma.vehicle.count({ where: Object.keys(where).length ? where : undefined }),
        ]);
        return { items, total, page, pageSize };
    }

    private normalizeVehicleInput(input: Partial<{ plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain?: string; typeSub?: string | null; color?: string | null; isDefault?: boolean }>) {
        const data: any = { ...input };
        // 移除非表字段，避免传入 Prisma 引发 Unknown argument
        if (Object.prototype.hasOwnProperty.call(data, 'brandId')) delete data.brandId;
        if (Object.prototype.hasOwnProperty.call(data, 'seriesId')) delete data.seriesId;
        if (typeof data.brand === 'undefined' || data.brand === null || data.brand === '') data.brand = '-';
        if (typeof data.series === 'undefined' || data.series === null || data.series === '') data.series = '-';
        if (typeof data.typeMain === 'undefined' || data.typeMain === null || data.typeMain === '') data.typeMain = '-';
        if (typeof data.typeSub === 'undefined' || data.typeSub === null || data.typeSub === '') data.typeSub = '-';
        if (typeof data.color === 'undefined' || data.color === null || data.color === '') data.color = '-';
        return data;
    }

    private async downloadAndSaveImage(imageUrl?: string | null): Promise<string | null> {
        if (!imageUrl) return null;
        try {
            const resp = await this.fetchWithTimeout(imageUrl, 8000);
            if (!resp.ok) return null;
            const ab = await resp.arrayBuffer();
            if (!ab || ab.byteLength === 0) return null;
            const buf = Buffer.from(ab);
            const urlObj = new URL(imageUrl);
            const filenameRaw = urlObj.pathname.split('/').pop() || 'image.jpg';
            const contentType = resp.headers.get('content-type') || undefined;
            // 通过资产服务入库，目录 carimg，并自动添加车辆图片标签
            const created = await this.assetService.upload(buf, filenameRaw, contentType, 'carimg', ['车辆图片']);
            return created?.url || null;
        } catch {
            return null;
        }
    }

    private get apiKey(): string { return process.env.TANSHU_CAR_API_KEY || process.env.CAR_API_KEY || ''; }

    private async fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            return await fetch(url, { signal: ctrl.signal as any });
        } finally { clearTimeout(timer); }
    }

    private async resolveBrandImageByBrandId(brandId?: number | null): Promise<string | null> {
        if (!brandId) return null;
        if (!this.apiKey) return null;
        try {
            const url = `https://api.tanshuapi.com/api/car/v1/carBrand?key=${this.apiKey}`;
            const resp = await this.fetchWithTimeout(url, 8000);
            if (!resp.ok) return null;
            const json: any = await resp.json().catch(() => ({}));
            const data: any[] = Array.isArray(json?.data) ? json.data : [];
            for (const mb of data) {
                const list: any[] = Array.isArray(mb?.brand_list) ? mb.brand_list : [];
                const found = list.find((b:any) => Number(b?.brand_id) === Number(brandId));
                if (found) return found?.img || mb?.img || null;
            }
            return null;
        } catch {
            return null;
        }
    }

    private async resolveSeriesImageByBrandAndSeries(brandId?: number | null, seriesId?: number | null): Promise<string | null> {
        if (!brandId || !seriesId) return null;
        if (!this.apiKey) return null;
        try {
            const url = `https://api.tanshuapi.com/api/car/v1/carSeries?brand_id=${Number(brandId)}&key=${this.apiKey}`;
            const resp = await this.fetchWithTimeout(url, 8000);
            if (!resp.ok) return null;
            const json: any = await resp.json().catch(() => ({}));
            const data: any[] = Array.isArray(json?.data) ? json.data : [];
            const item = data.find((s:any) => Number(s?.series_id) === Number(seriesId));
            return item?.img || null;
        } catch {
            return null;
        }
    }

    private async populateVehicleImages(vehicleId: number, brandId?: number | null, seriesId?: number | null) {
        try {
            const [brandImgSrc, seriesImgSrc] = await Promise.all([
                this.resolveBrandImageByBrandId(brandId),
                this.resolveSeriesImageByBrandAndSeries(brandId, seriesId),
            ]);
            const [brandSaved, seriesSaved] = await Promise.all([
                this.downloadAndSaveImage(brandImgSrc),
                this.downloadAndSaveImage(seriesImgSrc),
            ]);
            if (brandSaved || seriesSaved) {
                await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { brandImage: brandSaved || undefined, seriesImage: seriesSaved || undefined } as any });
                try {
                    await this.syncBindings('Vehicle', String(vehicleId), 'brandImage', brandSaved ? [brandSaved] : []);
                    await this.syncBindings('Vehicle', String(vehicleId), 'seriesImage', seriesSaved ? [seriesSaved] : []);
                } catch {}
            }
        } catch {}
    }

    private assertTypeMainRequired(typeMain?: string) {
        if (!typeMain || !typeMain.trim()) throw new BadRequestException('车辆主类型为必填项');
        return true;
    }

    async createForMember(memberId: number, input: { plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain: string; typeSub?: string | null; color?: string | null; isDefault?: boolean }) {
        if (!input?.plateNumber) throw new BadRequestException('车牌号为必填项');
        this.assertTypeMainRequired(input?.typeMain);
        const payload = this.normalizeVehicleInput(input);
        const isDefault = !!payload.isDefault;
        const mid = Number.parseInt(String(memberId), 10);
        if (!Number.isFinite(mid) || mid <= 0) throw new BadRequestException('会员不存在');
        try {
            const created = await this.prisma.$transaction(async (tx) => {
                // 再次校验会员是否存在（防守式）
                const existsMember = await tx.member.findUnique({ where: { id: mid }, select: { id: true } });
                if (!existsMember) throw new BadRequestException('会员不存在');
                if (isDefault) {
                    await tx.vehicle.updateMany({ where: { memberId: mid, isDefault: true } as any, data: { isDefault: false } as any });
                }
                // 如果该会员没有任何车辆，则自动设为默认
                const count = await tx.vehicle.count({ where: { memberId: mid } });
                if (count === 0) payload.isDefault = true;
                const created = await tx.vehicle.create({ data: { ...payload, memberId: mid } });
                return created;
            });
            // 创建完成后拉取并保存图片（不阻塞主流程，但在此 await 以便更快可见）
            try {
                const bid = (input as any)?.brandId as number | undefined;
                const sid = (input as any)?.seriesId as number | undefined;
                if (bid || sid) await this.populateVehicleImages(created.id, bid, sid);
                await this.syncVehicleBindings(created.id);
            } catch {}
            return created;
        } catch (e: any) {
            // 唯一索引冲突（重复车牌）
            if (e && (e.code === 'P2002' || /Unique constraint failed/i.test(String(e?.message || '')))) {
                const existing = await this.prisma.vehicle.findUnique({ where: { plateNumber: payload.plateNumber } });
                if (!existing) throw e;
                if (existing.memberId !== mid) throw new BadRequestException('该车牌已被其他会员绑定');
                // 同一会员重复创建：改为更新现有车辆
                const updated = await this.updateVehicle(existing.id, input);
                return updated;
            }
            throw e;
        }
    }

    // 新增：创建游客车辆（不绑定会员）
    async createGuestVehicle(input: { plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; brandId?: number | null; seriesId?: number | null; typeMain?: string; typeSub?: string | null; color?: string | null }) {
        const payload = this.normalizeVehicleInput({ ...input, typeMain: input.typeMain || '-' });
        try {
            const created = await this.prisma.vehicle.create({ data: { ...payload, memberId: null as any } as any });
            // 根据品牌/车系ID尝试填充图片
            try {
                const bid = (input as any)?.brandId as number | undefined;
                const sid = (input as any)?.seriesId as number | undefined;
                if (bid || sid) await this.populateVehicleImages(created.id, bid, sid);
            } catch {}
            return created;
        } catch (e: any) {
            if (e && (e.code === 'P2002' || /Unique constraint failed/i.test(String(e?.message || '')))) {
                const existing = await this.prisma.vehicle.findUnique({ where: { plateNumber: payload.plateNumber } });
                if (existing) return existing;
            }
            throw e;
        }
    }

    // 将游客车辆绑定到会员
    async bindGuestVehicle(vehicleId: number, memberId: number) {
        const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!v) throw new BadRequestException('车辆不存在');
        if (v.memberId) throw new BadRequestException('该车辆已绑定会员');
        const member = await this.prisma.member.findUnique({ where: { id: memberId } });
        if (!member) throw new BadRequestException('会员不存在');
        return this.prisma.vehicle.update({ where: { id: vehicleId }, data: { memberId } as any });
    }

    async createForMemberByPhone(phone: string, input: { plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain: string; typeSub?: string | null; color?: string | null; isDefault?: boolean }) {
        if (!phone) throw new BadRequestException('会员手机号为必填项');
        const member = await this.prisma.member.findUnique({ where: { phone }, select: { id: true } });
        if (!member || typeof member.id !== 'number' || member.id <= 0) throw new BadRequestException('未找到该手机号对应的会员');
        const memberId = member.id;
        return this.createForMember(memberId, input);
    }

    async updateVehicle(vehicleId: number, input: Partial<{ plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain?: string; typeSub?: string | null; color?: string | null; isDefault?: boolean }>) {
        const existing = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!existing) throw new BadRequestException('车辆不存在');
        const payload = this.normalizeVehicleInput(input);
        const updated = await this.prisma.$transaction(async (tx) => {
            if (typeof payload.isDefault === 'boolean' && payload.isDefault) {
                await tx.vehicle.updateMany({ where: { memberId: existing.memberId, isDefault: true } as any, data: { isDefault: false } as any });
            }
            const updated = await tx.vehicle.update({ where: { id: vehicleId }, data: payload });
            return updated;
        });
        // 若传入了品牌/车系ID，刷新图片
        try {
            const bid = (input as any)?.brandId as number | undefined;
            const sid = (input as any)?.seriesId as number | undefined;
            if (bid || sid) await this.populateVehicleImages(vehicleId, bid, sid);
            await this.syncVehicleBindings(vehicleId);
        } catch {}
        return updated;
    }

    // 对外公开：根据品牌/车系触发图片拉取并绑定到文件库
    async populateImagesAndBindings(vehicleId: number, brandId?: number | null, seriesId?: number | null): Promise<void> {
        try {
            if (brandId || seriesId) {
                await this.populateVehicleImages(vehicleId, brandId, seriesId);
            }
            await this.syncVehicleBindings(vehicleId);
        } catch {}
    }

    async deleteVehicle(vehicleId: number) {
        return this.prisma.vehicle.delete({ where: { id: vehicleId } });
    }

    getVehicle(vehicleId: number) {
        return this.prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { member: true } });
    }

    async listByMember(memberId: number) {
        return this.prisma.vehicle.findMany({ where: { memberId }, orderBy: [{ isDefault: 'desc' } as any, { id: 'desc' }] });
    }

    async setDefault(vehicleId: number) {
        const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!v) throw new BadRequestException('车辆不存在');
        return this.prisma.$transaction(async (tx) => {
            await tx.vehicle.updateMany({ where: { memberId: v.memberId, isDefault: true } as any, data: { isDefault: false } as any });
            return tx.vehicle.update({ where: { id: vehicleId }, data: { isDefault: true } as any });
        });
    }

    async searchByPlateLike(keyword: string, limit = 15) {
        const kw = String(keyword || '').trim();
        if (!kw) return [];
        const items = await this.prisma.vehicle.findMany({
            where: { plateNumber: { contains: kw } },
            take: Math.max(1, Math.min(50, Number(limit || 15))),
            orderBy: { updatedAt: 'desc' },
            include: { member: { select: { id: true, name: true, phone: true } } },
        });
        return items.map(it => ({
            id: it.id,
            plateNumber: it.plateNumber,
            brand: it.brand || '-',
            series: it.series || '-',
            memberId: it.memberId,
            memberName: (it as any)?.member?.name || '',
            memberPhone: (it as any)?.member?.phone || '',
        }));
    }

    async getMemberIdFromToken(token?: string): Promise<number> {
        if (!token) throw new UnauthorizedException('缺少Token');
        try {
            const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
            const id = Number(decoded?.sub);
            if (!id || decoded?.type !== 'member') throw new UnauthorizedException('Token无效');
            return id;
        } catch {
            throw new UnauthorizedException('Token无效');
        }
    }
}


// ========== 文件绑定辅助 ==========
async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]>{
    const set = new Set<string>();
    for (const u of urls){ if(!u) continue; const s=String(u).trim(); if(!s) continue; set.add(s); try{ if(/^https?:\/\//i.test(s)){ const rel=new URL(s).pathname; if(rel) set.add(rel); } }catch{} }
    const arr = Array.from(set); if(!arr.length) return [];
    const rows = await (prisma as any).fileAsset.findMany({ where: { url: { in: arr } }, select: { id: true } });
    return Array.isArray(rows) ? rows.map((r:any)=>String(r.id)) : [];
}

VehicleService.prototype['syncBindings'] = async function(this: VehicleService, tableName: string, rowId: string, fieldName: string, urls: string[]){
    try{
        const desired = new Set<string>(await getAssetIdsFromUrls(this['prisma'], urls));
        const existing:any[] = await (this['prisma'] as any).fileBinding.findMany({ where: { tableName, rowId: String(rowId), fieldName } });
        for (const b of existing){ if(!desired.has(String(b.fileId))) { try{ await this['assetService']?.unbindReference(String(b.fileId), String(b.id)); }catch{} } }
        for (const fid of desired){ const ok = existing.find((b:any)=> String(b.fileId)===fid); if(!ok){ try{ await this['assetService']?.bindReference(String(fid), { tableName, rowId: String(rowId), fieldName }); }catch{} } }
    }catch{}
};

VehicleService.prototype['syncVehicleBindings'] = async function(this: VehicleService, vehicleId: number){
    try{
        const v = await this['prisma'].vehicle.findUnique({ where: { id: vehicleId }, select: { brandImage: true, seriesImage: true } });
        if (!v) return;
        const brand = typeof v.brandImage === 'string' && v.brandImage ? [v.brandImage] : [];
        const series = typeof v.seriesImage === 'string' && v.seriesImage ? [v.seriesImage] : [];
        await this['syncBindings']('Vehicle', String(vehicleId), 'brandImage', brand);
        await this['syncBindings']('Vehicle', String(vehicleId), 'seriesImage', series);
    }catch{}
};

