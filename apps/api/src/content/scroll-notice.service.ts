import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

export type NoticeType = 'home' | 'store';

@Injectable()
export class ScrollNoticeService {
    constructor(private prisma: PrismaService) {}

    list(type?: NoticeType) {
        return this.prisma.scrollNotice.findMany({
            where: type ? { type } : undefined,
            orderBy: [{ type: 'asc' }, { id: 'asc' }],
        });
    }

    async create(data: { type: NoticeType; content: string; enabled?: boolean }) {
        const enabled = !!data.enabled;
        return this.prisma.$transaction(async (tx) => {
            if (enabled) {
                await tx.scrollNotice.updateMany({ where: { type: data.type, enabled: true }, data: { enabled: false } });
            }
            return tx.scrollNotice.create({ data: { type: data.type, content: data.content, enabled } });
        });
    }

    async update(id: number, data: { content?: string; enabled?: boolean }) {
        const notice = await this.prisma.scrollNotice.findUnique({ where: { id } });
        if (!notice) throw new NotFoundException('通知不存在');
        return this.prisma.$transaction(async (tx) => {
            if (data.enabled === true) {
                await tx.scrollNotice.updateMany({ where: { type: notice.type, enabled: true }, data: { enabled: false } });
            }
            return tx.scrollNotice.update({ where: { id }, data });
        });
    }

    remove(id: number) {
        return this.prisma.scrollNotice.delete({ where: { id } });
    }

    async enable(id: number) {
        const notice = await this.prisma.scrollNotice.findUnique({ where: { id } });
        if (!notice) throw new NotFoundException('通知不存在');
        return this.prisma.$transaction(async (tx) => {
            await tx.scrollNotice.updateMany({ where: { type: notice.type, enabled: true }, data: { enabled: false } });
            return tx.scrollNotice.update({ where: { id }, data: { enabled: true } });
        });
    }

    async getActive(type: NoticeType) {
        return this.prisma.scrollNotice.findFirst({ where: { type, enabled: true }, orderBy: { id: 'desc' } });
    }
}


