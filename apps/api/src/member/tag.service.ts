import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MemberTagService {
	constructor(private prisma: PrismaService) {}

	list() { return this.prisma.memberTag.findMany({ orderBy: { id: 'asc' } }); }
	create(data: { name: string }) { return this.prisma.memberTag.create({ data }); }
	update(id: number, data: { name?: string }) { return this.prisma.memberTag.update({ where: { id }, data }); }
	remove(id: number) { return this.prisma.memberTag.delete({ where: { id } }); }
}


