import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { bindFileReferences } from '../file/file-binding.util.js';

@Injectable()
export class GroupService {
  constructor(private prisma: PrismaService) {}
  // 确保集团订单占位会员存在（懒创建），返回其 memberId
  async ensureOrderOwnerMember(groupId: number) {
    const gid = Number(groupId);
    if (!gid) throw new BadRequestException('groupId 无效');
    return this.prisma.$transaction(async (tx)=>{
      const g:any = await tx.group.findUnique({ where: { id: gid }, select: { id: true, name: true, orderOwnerMemberId: true } });
      if (!g) throw new NotFoundException('集团不存在');
      if (g.orderOwnerMemberId) return Number(g.orderOwnerMemberId);
      // 创建虚拟会员（不可登录，仅占位）：phone 使用保留号段避免冲突；name 明确标识
      // 生成唯一 phone（199 + groupId + 随机3位），仅占位
      let phone = '';
      for (let i=0;i<10;i++){
        const rnd = Math.floor(100 + Math.random()*900);
        phone = `199${gid}${rnd}`.slice(0,11);
        const exists = await tx.member.findUnique({ where: { phone } }).catch(()=>null);
        if (!exists) break;
      }
      if (!phone) phone = `199${gid}`.padEnd(11,'0');
      const name = `${g.name}（集团订单）`;
      // 生成唯一8位 uid（与普通会员规则一致）
      let uid:number;
      while (true) {
        uid = Math.floor(10000000 + Math.random() * 90000000);
        const exists = await tx.member.findUnique({ where: { uid } }).catch(()=>null);
        if (!exists) break;
      }
      const created = await tx.member.create({ data: { name, phone, uid } });
      await tx.group.update({ where: { id: gid }, data: { orderOwnerMemberId: created.id } });
      // 打系统标签：GROUP_ORDER_OWNER（若不存在则创建）
      try {
        let tag = await (tx as any).memberTag.findFirst({ where: { name: 'GROUP_ORDER_OWNER' }, select: { id: true } });
        if (!tag) {
          tag = await (tx as any).memberTag.create({ data: { name: 'GROUP_ORDER_OWNER', isSystem: true } });
        }
        await (tx as any).member.update({ where: { id: created.id }, data: { tags: { connect: [{ id: tag.id }] } } });
      } catch {}
      return created.id as number;
    });
  }

  async generateGroupCode(tx: PrismaClient | Prisma.TransactionClient) {
    // 按“会员号生成规则一致 + 前缀 G”：随机生成唯一的8位数字，并在前面加 'G'
    while (true) {
      const num = Math.floor(10000000 + Math.random() * 90000000);
      const code = `G${num}`;
      const exists = await tx.group.findUnique({ where: { code } });
      if (!exists) return code;
    }
  }

  async create(params: { name: string; iconUrl?: string | null; firstAdminMemberId: number; remark?: string | null }) {
    const { name, iconUrl, firstAdminMemberId, remark } = params;
    if (!name) throw new BadRequestException('集团名称为必填');
    const mid = Number(firstAdminMemberId);
    if (!Number.isFinite(mid) || mid <= 0) throw new BadRequestException('管理员会员无效');

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: mid }, select: { id: true } });
      if (!member) throw new BadRequestException('管理员会员不存在');
      // 单会员仅一个集团
      const existedBind = await tx.groupMember.findUnique({ where: { memberId: mid } });
      if (existedBind) throw new BadRequestException('该会员已归属其他集团');

      const code = await this.generateGroupCode(tx);
      const group = await tx.group.create({ data: { code, name, iconUrl: iconUrl || null, remark: remark || null } });
      await tx.groupMember.create({ data: { groupId: group.id, memberId: mid, role: 'ADMIN' as any } });
      await tx.groupBalanceAccount.create({ data: { groupId: group.id, balance: new Prisma.Decimal(0), version: 0 } });
      // 绑定文件引用（icon）
      try { if (iconUrl) await bindFileReferences(this.prisma, [iconUrl], 'Group', String(group.id), 'iconUrl'); } catch {}
      return group;
    });
  }

  async list(page = 1, pageSize = 20, keyword?: string | null, sortBy?: 'createdAt'|'name'|'balance', sortOrder?: 'asc'|'desc') {
    const where: any = keyword ? { name: { contains: keyword } } : {};
    const orderBy = (() => {
      const dir = (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder : 'desc';
      if (sortBy === 'name') return { name: dir } as any;
      // balance 排序在 SQL 层不易直接做（Decimal 存子表），先按时间/名称，再在内存排序
      return { id: 'desc' } as any; // 默认按 id 倒序≈创建时间倒序
    })();
    const [total, groups] = await this.prisma.$transaction([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({ where, include: { balance: true }, orderBy, skip: (page - 1) * pageSize, take: pageSize })
    ]);
    // 追加统计字段：车辆数、卡总余次、成员数
    let items = await Promise.all(groups.map(async (g) => {
      const [vehicleCount, cardSum, memberCount] = await this.prisma.$transaction([
        this.prisma.vehicle.count({ where: { groupId: g.id } }),
        this.prisma.groupWashCard.aggregate({ where: { groupId: g.id }, _sum: { remainingTimes: true } }),
        this.prisma.groupMember.count({ where: { groupId: g.id } }),
      ]);
      return {
        ...g,
        vehicleCount,
        totalCardRemaining: Number(cardSum._sum.remainingTimes || 0),
        memberCount,
      } as any;
    }));
    if (sortBy === 'balance') {
      const dir = (sortOrder === 'asc' || sortOrder === 'desc') ? sortOrder : 'desc';
      items = items.sort((a:any,b:any)=>{
        const av = Number(a?.balance?.balance ?? 0);
        const bv = Number(b?.balance?.balance ?? 0);
        return dir === 'asc' ? av - bv : bv - av;
      });
    }
    return { total, page, pageSize, items };
  }

  async detail(id: number) {
    const group = await this.prisma.group.findUnique({ where: { id }, include: {
      balance: true,
      members: { include: { member: true } },
      washCards: true
    } });
    if (!group) throw new NotFoundException('集团不存在');
    // 统计
    const [vehicleCount, totalCardRemaining] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where: { groupId: id } }),
      this.prisma.groupWashCard.aggregate({ where: { groupId: id }, _sum: { remainingTimes: true } })
    ]);
    return { ...group, vehicleCount, totalCardRemaining: group ? Number(totalCardRemaining._sum.remainingTimes || 0) : 0 } as any;
  }

  async updateBasic(id: number, data: { name?: string | null; iconUrl?: string | null; remark?: string | null }) {
    const upd = await this.prisma.group.update({
      where: { id },
      data: {
        // name 为非空字段：不允许写入 null
        name: data.name == null ? undefined : data.name,
        iconUrl: data.iconUrl === undefined ? undefined : data.iconUrl,
        remark: data.remark === undefined ? undefined : data.remark,
      },
    });
    // 更新文件绑定
    try {
      const url = upd.iconUrl ? [upd.iconUrl] : [];
      await bindFileReferences(this.prisma, url, 'Group', String(id), 'iconUrl');
    } catch {}
    return upd;
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const g = await tx.group.findUnique({ where: { id } });
      if (!g) throw new NotFoundException('集团不存在');
      // 安全校验
      const [memberCount, vehicleCount, activeCards, balanceAcc] = await Promise.all([
        tx.groupMember.count({ where: { groupId: id } }),
        tx.vehicle.count({ where: { groupId: id } }),
        tx.groupWashCard.count({ where: { groupId: id, status: 'ACTIVE' as any } }),
        tx.groupBalanceAccount.findUnique({ where: { groupId: id } })
      ]);
      const balance = Number(balanceAcc?.balance || 0);
      if (memberCount > 0) throw new BadRequestException('请先移除所有成员');
      if (vehicleCount > 0) throw new BadRequestException('请先解绑所有车辆');
      if (activeCards > 0) throw new BadRequestException('存在在用洗车卡');
      if (balance !== 0) throw new BadRequestException('余额非零，不可删除');
      await tx.group.update({ where: { id }, data: { deletedAt: new Date() } });
      return { ok: true } as any;
    });
  }
}
