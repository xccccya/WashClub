import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class CartService {
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

    async list(token?: string, onlyChecked?: boolean) {
        const memberId = await this.getMemberIdFromToken(token);
        const where: any = { memberId };
        if (onlyChecked) where.checked = true;
        const rows = await this.prisma.memberCartItem.findMany({
            where,
            orderBy: { id: 'desc' },
            include: {
                product: true,
                sku: true,
            },
        });
        return rows.map((r: any) => ({
            id: r.id,
            productId: r.productId,
            skuId: r.skuId,
            quantity: r.quantity,
            checked: !!r.checked,
            snapshot: this.buildSnapshot(r.product, r.sku),
        }));
    }

    async add(token: string | undefined, input: { productId: number; skuId?: number | null; quantity?: number }) {
        const memberId = await this.getMemberIdFromToken(token);
        const product = await this.prisma.product.findUnique({ where: { id: Number(input.productId) } });
        if (!product) throw new BadRequestException('商品不存在');
        const skuId = input?.skuId ? Number(input.skuId) : null;
        if (product.specType === 'SINGLE' && skuId) throw new BadRequestException('单规格商品无需选择SKU');
        if (product.specType === 'MULTI' && !skuId) throw new BadRequestException('多规格商品必须选择SKU');
        const quantity = Math.max(1, Math.min(99, Number(input?.quantity || 1)));
        // upsert：存在则数量相加（skuId 可能为 null，使用 findFirst 更通用）
        const existing = await this.prisma.memberCartItem.findFirst({ where: { memberId, productId: product.id, skuId: skuId as any } });
        let item;
        if (existing) {
            item = await this.prisma.memberCartItem.update({ where: { id: existing.id }, data: { quantity: Math.min(99, existing.quantity + quantity), checked: true } });
        } else {
            item = await this.prisma.memberCartItem.create({ data: { memberId, productId: product.id, skuId, quantity, checked: true } });
        }
        const full = await this.prisma.memberCartItem.findUnique({ where: { id: item.id }, include: { product: true, sku: true } });
        return { id: item.id, productId: item.productId, skuId: item.skuId, quantity: item.quantity, checked: item.checked, snapshot: this.buildSnapshot((full as any).product, (full as any).sku) };
    }

    async update(token: string | undefined, id: number, input: { quantity?: number; checked?: boolean; skuId?: number | null }) {
        const memberId = await this.getMemberIdFromToken(token);
        const row = await this.prisma.memberCartItem.findUnique({ where: { id }, include: { product: true } });
        if (!row || row.memberId !== memberId) throw new UnauthorizedException('无权操作');
        const data: any = {};
        if (typeof input.quantity === 'number') data.quantity = Math.max(1, Math.min(99, Number(input.quantity)));
        if (typeof input.checked === 'boolean') data.checked = input.checked;
        if (Object.prototype.hasOwnProperty.call(input, 'skuId')) {
            const skuId = input?.skuId ? Number(input.skuId) : null;
            if ((row as any).product.specType === 'SINGLE' && skuId) throw new BadRequestException('单规格商品无需选择SKU');
            if ((row as any).product.specType === 'MULTI' && !skuId) throw new BadRequestException('多规格商品必须选择SKU');
            data.skuId = skuId;
        }
        const updated = await this.prisma.memberCartItem.update({ where: { id }, data });
        const full = await this.prisma.memberCartItem.findUnique({ where: { id }, include: { product: true, sku: true } });
        return { id: updated.id, productId: updated.productId, skuId: updated.skuId, quantity: updated.quantity, checked: updated.checked, snapshot: this.buildSnapshot((full as any).product, (full as any).sku) };
    }

    async remove(token: string | undefined, id: number) {
        const memberId = await this.getMemberIdFromToken(token);
        const row = await this.prisma.memberCartItem.findUnique({ where: { id } });
        if (!row || row.memberId !== memberId) throw new UnauthorizedException('无权操作');
        await this.prisma.memberCartItem.delete({ where: { id } });
        return { ok: true };
    }

    async toggleAll(token: string | undefined, checked: boolean) {
        const memberId = await this.getMemberIdFromToken(token);
        await this.prisma.memberCartItem.updateMany({ where: { memberId }, data: { checked } });
        return { ok: true };
    }

    async clearChecked(token: string | undefined) {
        const memberId = await this.getMemberIdFromToken(token);
        await this.prisma.memberCartItem.deleteMany({ where: { memberId, checked: true } });
        return { ok: true };
    }

    private buildSnapshot(product: any, sku?: any) {
        const imageUrl = sku?.imageUrl || product?.imageUrl || (Array.isArray(product?.imagesJson) ? product.imagesJson[0] : null);
        const price = sku ? Number(sku.price || 0) : Number(product?.price || 0);
        const name = product?.name || '';
        const skuName = sku?.name || (Array.isArray(sku?.specsJson) ? sku.specsJson.map((x: any) => x?.value).filter(Boolean).join('/') : undefined);
        const type = product?.type || undefined;
        return { id: product?.id, name, imageUrl, price, skuName, type };
    }
}


