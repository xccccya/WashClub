import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VehicleService } from '../member/vehicle.service.js';

@Injectable()
export class GroupVehicleService {
  constructor(private prisma: PrismaService, private vehicleService: VehicleService) {}

  async list(groupId: number, opts?: { keyword?: string | null; source?: 'all'|'group'|'member'; typeMain?: string | null; sortBy?: 'createdAt'|'updatedAt'|'plateNumber'|'brand'|'typeMain'; sortOrder?: 'asc'|'desc' }) {
    const keyword = (opts?.keyword || '').trim();
    const source = (opts?.source === 'group' || opts?.source === 'member') ? opts?.source : 'all';
    const typeMain = (opts?.typeMain || '').trim();
    const sortBy = (opts?.sortBy && ['createdAt','updatedAt','plateNumber','brand','typeMain'].includes(opts.sortBy)) ? opts.sortBy : 'updatedAt';
    const sortOrder = (opts?.sortOrder === 'asc' || opts?.sortOrder === 'desc') ? opts.sortOrder : 'desc';

    const orConds: any[] = [];
    if (source === 'group' || source === 'all') {
      orConds.push({ groupId });
    }
    if (source === 'member' || source === 'all') {
      orConds.push({ member: { groupMembership: { groupId } } });
    }
    const where: any = { OR: orConds };
    if (keyword) {
      where.AND = where.AND || [];
      where.AND.push({ OR: [
        { plateNumber: { contains: keyword } },
        { brand: { contains: keyword } },
        { series: { contains: keyword } },
        { color: { contains: keyword } },
        { typeMain: { contains: keyword } },
        { member: { OR: [{ name: { contains: keyword } }, { phone: { contains: keyword } }] } },
      ]});
    }
    if (typeMain) {
      where.AND = where.AND || [];
      where.AND.push({ typeMain: { contains: typeMain } });
    }

    const items = await this.prisma.vehicle.findMany({
      where,
      orderBy: { [sortBy]: sortOrder } as any,
      include: { member: { select: { id: true, name: true, phone: true } } },
    });
    return items.map((it: any) => ({ ...it, isMemberVehicle: !!it.memberId }));
  }

  private normalizeVehicleInput(input: Partial<{ plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain?: string; typeSub?: string | null; color?: string | null }>) {
    const data: any = { ...input };
    if (typeof data.brand === 'undefined' || data.brand === null || data.brand === '') data.brand = '-';
    if (typeof data.series === 'undefined' || data.series === null || data.series === '') data.series = '-';
    if (typeof data.typeMain === 'undefined' || data.typeMain === null || data.typeMain === '') data.typeMain = '-';
    if (typeof data.typeSub === 'undefined' || data.typeSub === null || data.typeSub === '') data.typeSub = '-';
    if (typeof data.color === 'undefined' || data.color === null || data.color === '') data.color = '-';
    return data;
  }

  async create(groupId: number, input: { plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain: string; typeSub?: string | null; color?: string | null; brandId?: number | null; seriesId?: number | null }) {
    if (!input?.plateNumber) throw new BadRequestException('车牌号为必填');
    if (!input?.typeMain) throw new BadRequestException('车辆主类型为必填');
    const payload = this.normalizeVehicleInput(input);
    return this.prisma.$transaction(async (tx) => {
      const existsGroup = await tx.group.findUnique({ where: { id: groupId } });
      if (!existsGroup) throw new BadRequestException('集团不存在');
      try {
        const created = await tx.vehicle.create({ data: { plateNumber: String(payload.plateNumber), vin: payload.vin ?? null, brand: payload.brand, series: payload.series, typeMain: payload.typeMain, typeSub: payload.typeSub, color: payload.color, isDefault: false, groupId } });
        // 异步图片拉取与文件绑定
        const bid = (input as any)?.brandId as number | undefined;
        const sid = (input as any)?.seriesId as number | undefined;
        try { await this.vehicleService.populateImagesAndBindings(created.id, bid, sid); } catch {}
        return created;
      } catch (e: any) {
        if (e && (e.code === 'P2002' || /Unique constraint failed/i.test(String(e?.message || '')))) {
          const existing = await tx.vehicle.findUnique({ where: { plateNumber: String(payload.plateNumber) } });
          if (!existing) throw e;
          if (existing.groupId === groupId) {
            // 同一集团重复创建：更新车辆信息
            const updated = await tx.vehicle.update({ where: { id: existing.id }, data: { vin: payload.vin ?? null, brand: payload.brand, series: payload.series, typeMain: payload.typeMain, typeSub: payload.typeSub, color: payload.color } });
            const bid = (input as any)?.brandId as number | undefined;
            const sid = (input as any)?.seriesId as number | undefined;
            try { await this.vehicleService.populateImagesAndBindings(updated.id, bid, sid); } catch {}
            return updated;
          }
          throw new BadRequestException('该车牌已绑定到其他主体');
        }
        throw e;
      }
    });
  }

  async remove(groupId: number, vehicleId: number) {
    return this.prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.findFirst({ where: { id: vehicleId, groupId } });
      if (!v) throw new BadRequestException('车辆不存在');
      // 解绑（删除或转移后续扩展）
      await tx.vehicle.update({ where: { id: v.id }, data: { groupId: null } });
      return { ok: true } as any;
    });
  }
}
