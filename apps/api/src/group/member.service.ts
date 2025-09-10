import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class GroupMemberService {
  constructor(private prisma: PrismaService) {}

  async list(groupId: number) {
    return this.prisma.groupMember.findMany({ where: { groupId }, include: { member: true } });
  }

  async addMembers(groupId: number, memberIds: number[]) {
    if (!Array.isArray(memberIds) || memberIds.length === 0) throw new BadRequestException('缺少成员');
    return this.prisma.$transaction(async (tx) => {
      for (const mid of memberIds) {
        const exists = await tx.member.findUnique({ where: { id: mid }, select: { id: true } });
        if (!exists) throw new BadRequestException(`会员不存在：${mid}`);
        const bound = await tx.groupMember.findUnique({ where: { memberId: mid } });
        if (bound) throw new BadRequestException(`会员已归属其他集团：${mid}`);
        await tx.groupMember.create({ data: { groupId, memberId: mid, role: 'USER' as any } });
      }
      return { ok: true } as any;
    });
  }

  async removeMember(groupId: number, memberId: number) {
    return this.prisma.$transaction(async (tx) => {
      const gm = await tx.groupMember.findFirst({ where: { groupId, memberId } });
      if (!gm) throw new BadRequestException('成员不存在');
      if (gm.role === 'ADMIN') throw new BadRequestException('管理员不可直接移除，请先转移管理员');
      await tx.groupMember.delete({ where: { id: gm.id } });
      return { ok: true } as any;
    });
  }

  async setAdmin(groupId: number, memberId: number, isAdmin: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const gm = await tx.groupMember.findFirst({ where: { groupId, memberId } });
      if (!gm) throw new BadRequestException('成员不存在');
      if (!isAdmin) {
        // 取消管理员时需保证至少保留一名管理员
        const adminCount = await tx.groupMember.count({ where: { groupId, role: 'ADMIN' as any } });
        if (adminCount <= 1) throw new BadRequestException('至少保留一名管理员');
        await tx.groupMember.update({ where: { id: gm.id }, data: { role: 'USER' as any } });
      } else {
        await tx.groupMember.update({ where: { id: gm.id }, data: { role: 'ADMIN' as any } });
      }
      return { ok: true } as any;
    });
  }
}
