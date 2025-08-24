import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class MemberCategoryService {
	constructor(private prisma: PrismaService) {}

	list() {
		return this.prisma.memberCategory.findMany({ orderBy: [{ weight: 'desc' }, { id: 'asc' }] });
	}

	create(data: { name: string; weight: number }) {
		return this.prisma.memberCategory.create({ data });
	}

	update(id: number, data: { name?: string; weight?: number }) {
		return this.prisma.memberCategory.update({ where: { id }, data });
	}

	remove(id: number) {
		return this.prisma.memberCategory.delete({ where: { id } });
	}
}



