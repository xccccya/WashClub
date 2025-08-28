import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class FavoriteService {
    constructor(private prisma: PrismaService, private jwt: JwtService) {}

    private async getMemberIdFromToken(token?: string): Promise<number> {
        if (!token) throw new UnauthorizedException('缺少Token');
        try {
            const decoded: any = await this.jwt.verifyAsync(token, { ignoreExpiration: false });
            const id = Number(decoded?.sub);
            if (!id || decoded?.type !== 'member') throw new UnauthorizedException('Token无效');
            return id;
        } catch {
            throw new UnauthorizedException('Token无效');
        }
    }

    async list(token?: string) {
        const memberId = await this.getMemberIdFromToken(token);
        return this.prisma.memberFavoriteProduct.findMany({ where: { memberId }, orderBy: { id: 'desc' }, include: { product: true } });
    }

    async add(token: string | undefined, productId: number) {
        const memberId = await this.getMemberIdFromToken(token);
        const product = await this.prisma.product.findUnique({ where: { id: Number(productId) } });
        if (!product) throw new BadRequestException('商品不存在');
        await this.prisma.memberFavoriteProduct.upsert({
            where: { memberId_productId: { memberId, productId: product.id } },
            create: { memberId, productId: product.id },
            update: {},
        });
        return { ok: true };
    }

    async remove(token: string | undefined, productId: number) {
        const memberId = await this.getMemberIdFromToken(token);
        const existing = await this.prisma.memberFavoriteProduct.findUnique({ where: { memberId_productId: { memberId, productId: Number(productId) } } });
        if (!existing) return { ok: true };
        await this.prisma.memberFavoriteProduct.delete({ where: { id: existing.id } });
        return { ok: true };
    }
}


