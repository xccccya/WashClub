import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MemberLevelService {
  constructor(private prisma: PrismaService) {}

  list() { return this.prisma.memberLevel.findMany({ orderBy: [{ weight: 'desc' }, { id: 'asc' }] }); }

  async create(data: { name: string; weight: number; isDefault?: boolean }) {
    const shouldBeDefault = !!data?.isDefault;
    return this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.memberLevel.updateMany({ data: { isDefault: false }, where: { isDefault: true } as any });
      } else {
        const existsDefault = await tx.memberLevel.count({ where: { isDefault: true } as any });
        if (existsDefault === 0) {
          // 系统必须存在唯一默认等级：如果还没有默认，则将新建的设为默认
          data.isDefault = true;
        }
      }
      return tx.memberLevel.create({ data });
    });
  }

  async update(id: number, data: { name?: string; weight?: number; isDefault?: boolean }) {
    const wantUnsetDefault = data?.isDefault === false;
    const wantSetDefault = data?.isDefault === true;
    return this.prisma.$transaction(async (tx) => {
      if (wantSetDefault) {
        // 设为默认：清除其他默认
        await tx.memberLevel.updateMany({ data: { isDefault: false }, where: { id: { not: id } } as any });
        return tx.memberLevel.update({ where: { id }, data: { ...data, isDefault: true } });
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
      return tx.memberLevel.update({ where: { id }, data });
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
}


