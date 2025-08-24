import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

export interface CreateBannerDto {
    title?: string | null;
    imageUrl: string;
    enabled?: boolean;
    jumpEnabled?: boolean;
    linkPath?: string | null;
    weight?: number;
}

export interface UpdateBannerDto {
    title?: string | null;
    imageUrl?: string;
    enabled?: boolean;
    jumpEnabled?: boolean;
    linkPath?: string | null;
    weight?: number;
}

@Injectable()
export class AdBannerService {
    constructor(private prisma: PrismaService) {}

    list(enabled?: 'true' | 'false' | '') {
        const where = typeof enabled === 'string' && enabled !== '' ? { enabled: enabled === 'true' } : undefined;
        return this.prisma.adBanner.findMany({
            where,
            orderBy: [{ weight: 'desc' }, { id: 'desc' }],
        });
    }

    create(data: CreateBannerDto) {
        return this.prisma.adBanner.create({ data: {
            title: data.title ?? null,
            imageUrl: data.imageUrl,
            enabled: !!data.enabled,
            jumpEnabled: !!data.jumpEnabled,
            linkPath: data.linkPath ?? null,
            weight: Number.isFinite(data.weight as number) ? Number(data.weight) : 0,
        }});
    }

    async update(id: number, data: UpdateBannerDto) {
        const exists = await this.prisma.adBanner.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('横幅不存在');
        return this.prisma.adBanner.update({ where: { id }, data: {
            title: data.title === undefined ? exists.title : (data.title ?? null),
            imageUrl: data.imageUrl ?? exists.imageUrl,
            enabled: data.enabled ?? exists.enabled,
            jumpEnabled: data.jumpEnabled ?? exists.jumpEnabled,
            linkPath: data.linkPath === undefined ? exists.linkPath : (data.linkPath ?? null),
            weight: data.weight === undefined ? exists.weight : Number(data.weight || 0),
        }});
    }

    remove(id: number) {
        return this.prisma.adBanner.delete({ where: { id } });
    }

    async enable(id: number, enabled: boolean) {
        const exists = await this.prisma.adBanner.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('横幅不存在');
        if (enabled) {
            const cnt = await this.prisma.adBanner.count({ where: { enabled: true } });
            if (cnt >= 3) {
                throw new Error('最多可同时启用3条横幅');
            }
        }
        return this.prisma.adBanner.update({ where: { id }, data: { enabled } });
    }

    activeList() {
        return this.prisma.adBanner.findMany({ where: { enabled: true }, orderBy: [{ weight: 'desc' }, { id: 'desc' }], take: 3 });
    }
}


