import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('system')
@Controller('system/employees')
@UseGuards(AdminGuard)
export class SystemEmployeeController {
  constructor(private prisma: PrismaService) {}

  @Get('list')
  @ApiOperation({ summary: '员工列表（分页/关键词）' })
  @RequirePerm('system-employees')
  async list(
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
    @Query('keyword') keyword?: string,
    @Query('enabled') enabledStr?: string,
  ) {
    const page = Math.max(1, Number(pageStr || 1));
    const pageSize = Math.max(1, Math.min(100, Number(pageSizeStr || 20)));
    const kw = (keyword || '').trim();
    const enabled = enabledStr == null ? undefined : (enabledStr === 'true');
    const where: any = {};
    if (kw) {
      where.OR = [
        { name: { contains: kw } },
        { title: { contains: kw } },
        { member: { OR: [{ name: { contains: kw } }, { phone: { contains: kw } }] } },
      ];
    }
    if (typeof enabled === 'boolean') where.enabled = enabled;
    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        orderBy: { id: 'desc' },
        include: { member: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, total, page, pageSize } as any;
  }

  @Post()
  @ApiOperation({ summary: '新增员工：从现有会员绑定' })
  @RequirePerm('system-employees')
  async create(@Body() body: { memberId?: number; name?: string|null; title?: string|null; enabled?: boolean }) {
    const memberId = Number(body?.memberId || 0);
    if (!Number.isFinite(memberId) || memberId <= 0) throw new BadRequestException('memberId 无效');
    const mem = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!mem) throw new BadRequestException('会员不存在');
    const existed = await this.prisma.employee.findUnique({ where: { memberId } }).catch(()=>null);
    if (existed) throw new BadRequestException('该会员已是员工');
    const created = await this.prisma.employee.create({ data: { memberId, name: (body?.name ?? null) as any, title: (body?.title ?? null) as any, enabled: body?.enabled ?? true } });
    return created;
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑员工：姓名/职务/启用状态' })
  @RequirePerm('system-employees')
  async update(@Param('id') id: string, @Body() body: { name?: string|null; title?: string|null; enabled?: boolean }) {
    const eid = Number(id || 0);
    if (!Number.isFinite(eid) || eid <= 0) throw new BadRequestException('ID 无效');
    const updated = await this.prisma.employee.update({ where: { id: eid }, data: { name: (body?.name ?? undefined) as any, title: (body?.title ?? undefined) as any, enabled: body?.enabled ?? undefined } });
    return updated;
  }

  @Get('lookup-member-by-phone')
  @ApiOperation({ summary: '根据手机号查找会员（用于新增员工前预览）' })
  @RequirePerm('system-employees')
  async lookupMember(@Query('phone') phone?: string){
    const p = String(phone || '').trim();
    if (!p) throw new BadRequestException('缺少手机号');
    const mem = await this.prisma.member.findUnique({ where: { phone: p }, select: { id: true, name: true, phone: true, avatarUrl: true } });
    return mem || null;
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除员工' })
  @RequirePerm('system-employees')
  async remove(@Param('id') id: string) {
    const eid = Number(id || 0);
    if (!Number.isFinite(eid) || eid <= 0) throw new BadRequestException('ID 无效');
    await this.prisma.employee.delete({ where: { id: eid } });
    return { ok: true } as any;
  }
}


