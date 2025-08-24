import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MemberTagService {
	constructor(private prisma: PrismaService) {}

	async list() {
		const rows = await this.prisma.memberTag.findMany({ orderBy: { id: 'asc' }, include: { _count: { select: { members: true } } } as any });
		return rows.map((r: any) => ({ id: r.id, name: r.name, isSystem: !!(r as any).isSystem, memberCount: Number((r as any)?._count?.members || 0) }));
	}
	create(data: { name: string }) { return this.prisma.memberTag.create({ data }); }
	async update(id: number, data: { name?: string }) {
		const tag = await this.prisma.memberTag.findUnique({ where: { id } });
		if (!tag) throw new BadRequestException('标签不存在');
		if ((tag as any).isSystem) throw new BadRequestException('系统默认标签不可编辑');
		return this.prisma.memberTag.update({ where: { id }, data });
	}
	async remove(id: number) {
		const tag = await this.prisma.memberTag.findUnique({ where: { id } });
		if (!tag) throw new BadRequestException('标签不存在');
		if ((tag as any).isSystem) throw new BadRequestException('系统默认标签不可删除');
		return this.prisma.memberTag.delete({ where: { id } });
	}

	async listMembers(tagId: number, page = 1, pageSize = 20, keyword?: string) {
		if (!tagId) throw new BadRequestException('标签ID无效');
		const where: any = {
			tags: { some: { id: tagId } },
			...(keyword ? { OR: [{ name: { contains: keyword } }, { phone: { contains: keyword } }] } : {}),
		};
		const [itemsRaw, total] = await Promise.all([
			this.prisma.member.findMany({
				skip: (page - 1) * pageSize,
				take: pageSize,
				where,
				orderBy: { id: 'desc' },
				select: { id: true, name: true, phone: true, createdAt: true, level: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } },
			}),
			this.prisma.member.count({ where }),
		]);
		return { items: itemsRaw, total, page, pageSize };
	}
}


