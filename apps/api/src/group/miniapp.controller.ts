import { BadRequestException, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';

@ApiTags('MiniappGroup')
@Controller('group/miniapp')
export class GroupMiniappController {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  private async getMemberIdFromToken(headers: Record<string, string>, tokenParam?: string): Promise<number> {
    const authHeader = (headers?.authorization || (headers as any)?.Authorization) as string | undefined;
    const token = (authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '') || tokenParam || '';
    if (!token) throw new BadRequestException('缺少Token');
    try {
      const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
      if (decoded?.type !== 'member') throw 0;
      const id = Number(decoded?.sub);
      if (!id) throw 0;
      return id;
    } catch {
      throw new BadRequestException('Token无效');
    }
  }

  @Get('me/summary')
  @ApiOperation({ summary: '我的集团概览（名称/图标/余额/卡余次等）' })
  async myGroupSummary(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId }, include: { group: { include: { balance: true } } } });
    if (!gm?.group) return { hasGroup: false } as any;
    const group = gm.group;
    const [vehicleCount, cardsAgg] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where: { groupId: group.id } }),
      this.prisma.groupWashCard.aggregate({ where: { groupId: group.id }, _sum: { remainingTimes: true } })
    ]);
    return {
      hasGroup: true,
      id: group.id,
      code: group.code,
      name: group.name,
      iconUrl: group.iconUrl,
      balance: Number(group?.balance?.balance || 0),
      vehicleCount,
      totalCardRemaining: Number(cardsAgg._sum.remainingTimes || 0),
      role: gm.role
    } as any;
  }

  @Get('me/ledger')
  @ApiOperation({ summary: '我的集团余额明细（最近 N 条）' })
  async myGroupLedger(
    @Headers() headers: Record<string, string>,
    @Query('limit') limitStr?: string,
    @Query('token') tokenParam?: string,
  ) {
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId }, select: { groupId: true } });
    if (!gm?.groupId) return [];
    const take = Math.max(1, Math.min(50, Number(limitStr || 10)));
    const rows = await this.prisma.groupBalanceLedger.findMany({ where: { groupId: gm.groupId }, orderBy: { id: 'desc' }, take });
    return rows;
  }

  @Get('me/cards')
  @ApiOperation({ summary: '我的集团洗车卡列表（只读）' })
  async myGroupCards(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId }, select: { groupId: true } });
    if (!gm?.groupId) return [];
    return this.prisma.groupWashCard.findMany({ where: { groupId: gm.groupId, status: 'ACTIVE' as any }, orderBy: { id: 'desc' } });
  }

  @Get('me/admins')
  @ApiOperation({ summary: '我的集团管理员列表（小程序展示）' })
  async myGroupAdmins(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId }, select: { groupId: true } });
    if (!gm?.groupId) return [];
    const admins = await this.prisma.groupMember.findMany({
      where: { groupId: gm.groupId, role: 'ADMIN' as any },
      include: { member: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
      orderBy: { id: 'asc' }
    });
    return admins.map((a: any) => ({
      memberId: a.member?.id,
      name: a.member?.name,
      phone: a.member?.phone,
      avatarUrl: a.member?.avatarUrl
    }));
  }

  @Post('me/recharge')
  @ApiOperation({ summary: '发起集团余额充值订单（FK），返回订单号' })
  async myGroupRecharge(
    @Headers() headers: Record<string, string>,
    @Query('token') tokenParam: string | undefined,
    @Query('amount') amountStr?: string,
    @Query('memberIdForPayment') memberIdForPaymentStr?: string,
  ) {
    // 为兼容小程序 GET/POST 习惯，这里通过 query 读取参数；同样兼容 body 的场景由前端统一用 POST+body
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId }, select: { groupId: true } });
    if (!gm?.groupId) throw new BadRequestException('未绑定集团');
    const amount = Number(amountStr || 0);
    const payer = Number(memberIdForPaymentStr || memberId);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('金额必须为正数');
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ts = `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const rand8 = () => Array.from({ length: 8 }).map(() => charset[Math.floor(Math.random() * charset.length)]).join('');
    const prefix = `FK_${ts}_`;
    let no: string; let tries = 0;
    while (true) {
      no = `${prefix}${rand8()}`;
      const exists = await this.prisma.order.findUnique({ where: { no } });
      if (!exists) break;
      tries++; if (tries > 20) throw new BadRequestException('订单号生成失败');
    }
    const admin = await this.prisma.member.findUnique({ where: { id: payer }, select: { name: true } });
    const remarkText = `集团管理员${admin?.name || ''}提交集团余额充值`;
    const order = await this.prisma.order.create({ data: ({
      no,
      type: 'FK' as any,
      status: 'CREATED' as any,
      fulfillmentStatus: 'NONE' as any,
      totalAmount: amount as any,
      discountAmount: 0 as any,
      memberDiscountAmount: 0 as any,
      payAmount: amount as any,
      shippingFee: 0 as any,
      payStatus: 'UNPAID' as any,
      memberId: payer,
      groupId: gm.groupId,
      paymentExpireAt: new Date(Date.now() + 15 * 60 * 1000),
      paymentNote: remarkText
    } as any)});
    // 时间线：创建/未支付/履约（NONE）
    try { await this.prisma.orderTimeline.create({ data: { orderId: order.id, event: 'ORDER_STATUS', value: 'CREATED' } }); } catch {}
    try { await this.prisma.orderTimeline.create({ data: { orderId: order.id, event: 'PAY_STATUS', value: 'UNPAID' } }); } catch {}
    try { await this.prisma.orderTimeline.create({ data: { orderId: order.id, event: 'FULFILLMENT', value: 'NONE' } }); } catch {}
    return { id: order.id, no: order.no } as any;
  }

  @Get('me/members')
  @ApiOperation({ summary: '我的集团成员列表（管理员可见更多操作）' })
  async myGroupMembers(@Headers() headers: Record<string, string>, @Query('token') tokenParam?: string) {
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId }, select: { groupId: true, role: true } });
    if (!gm?.groupId) return [];
    const list = await this.prisma.groupMember.findMany({
      where: { groupId: gm.groupId },
      include: { member: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
      orderBy: { id: 'asc' }
    });
    return list.map((it: any) => ({
      memberId: it.member?.id,
      name: it.member?.name,
      phone: it.member?.phone,
      avatarUrl: it.member?.avatarUrl,
      role: it.role
    }));
  }

  @Get('me/lookup-member-by-phone')
  @ApiOperation({ summary: '根据手机号查找会员（添加前预览）' })
  async lookupMemberByPhone(@Headers() headers: Record<string, string>, @Query('phone') phone?: string, @Query('token') tokenParam?: string) {
    await this.getMemberIdFromToken(headers, tokenParam);
    const p = String(phone || '').trim();
    if (!p) throw new BadRequestException('缺少手机号');
    const mem = await this.prisma.member.findUnique({ where: { phone: p }, select: { id: true, name: true, phone: true, avatarUrl: true } });
    return mem || null;
  }

  @Post('me/members')
  @ApiOperation({ summary: '按手机号添加集团成员（管理员）' })
  async addMemberByPhone(
    @Headers() headers: Record<string, string>,
    @Query('phone') phoneParam?: string,
    @Query('token') tokenParam?: string,
  ) {
    const memberId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId }, select: { groupId: true, role: true } });
    if (!gm?.groupId) throw new BadRequestException('未绑定集团');
    if (gm.role !== ('ADMIN' as any)) throw new BadRequestException('仅管理员可操作');
    const phone = String(phoneParam || '').trim();
    if (!phone) throw new BadRequestException('缺少手机号');
    const mem = await this.prisma.member.findUnique({ where: { phone }, select: { id: true } });
    if (!mem) throw new BadRequestException('手机号未绑定会员');
    const existed = await this.prisma.groupMember.findUnique({ where: { memberId: mem.id }, select: { id: true, groupId: true } });
    if (existed) throw new BadRequestException('该会员已加入其它集团或已是成员');
    await this.prisma.groupMember.create({ data: { groupId: gm.groupId, memberId: mem.id, role: 'USER' as any } });
    return { ok: true } as any;
  }

  @Post('me/members/remove')
  @ApiOperation({ summary: '移除集团成员（管理员）' })
  async removeMember(
    @Headers() headers: Record<string, string>,
    @Query('memberId') memberIdParam?: string,
    @Query('token') tokenParam?: string,
  ) {
    const myId = await this.getMemberIdFromToken(headers, tokenParam);
    const gm = await this.prisma.groupMember.findUnique({ where: { memberId: myId }, select: { groupId: true, role: true } });
    if (!gm?.groupId) throw new BadRequestException('未绑定集团');
    if (gm.role !== ('ADMIN' as any)) throw new BadRequestException('仅管理员可操作');
    const targetId = Number(memberIdParam || 0);
    if (!Number.isFinite(targetId) || targetId <= 0) throw new BadRequestException('memberId 无效');
    const target = await this.prisma.groupMember.findUnique({ where: { memberId: targetId }, select: { groupId: true, role: true } });
    if (!target || target.groupId !== gm.groupId) throw new BadRequestException('成员不存在');
    if (target.role === ('ADMIN' as any)) throw new BadRequestException('不可移除管理员');
    await this.prisma.groupMember.delete({ where: { memberId: targetId } });
    return { ok: true } as any;
  }
}


