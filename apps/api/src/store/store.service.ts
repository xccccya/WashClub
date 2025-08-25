import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class StoreService {
    constructor(private readonly prisma: PrismaService) {}

    // 分类
    listCategories() {
        return this.prisma.productCategory.findMany({ orderBy: [{ weight: 'desc' }, { id: 'desc' }] });
    }
    createCategory(data: { name: string; imageUrl?: string | null; enabled?: boolean; weight?: number }) {
        return this.prisma.productCategory.create({ data: { name: data.name, imageUrl: data.imageUrl ?? null, enabled: data.enabled ?? true, weight: data.weight ?? 0 } });
    }
    updateCategory(id: number, data: { name?: string; imageUrl?: string | null; enabled?: boolean; weight?: number }) {
        return this.prisma.productCategory.update({ where: { id }, data });
    }
    deleteCategory(id: number) {
        return this.prisma.productCategory.delete({ where: { id } });
    }

    // 商品
    listProducts(query: { keyword?: string; categoryId?: number | null; type?: string | null; enabled?: boolean | null }) {
        const where: any = {};
        if (query.keyword) where.OR = [{ name: { contains: query.keyword } }, { barcode: { contains: query.keyword } }];
        if (query.categoryId !== undefined) where.categoryId = query.categoryId;
        if (query.type) where.type = query.type as any;
        if (query.enabled !== null && query.enabled !== undefined) where.enabled = query.enabled;
        return this.prisma.product.findMany({ where, orderBy: [{ sortWeight: 'desc' }, { id: 'desc' }], include: { skus: true, category: true } });
    }
    getProduct(id: number) {
        return this.prisma.product.findUnique({ where: { id }, include: { skus: true, category: true } });
    }
    createProduct(data: any) {
        // data 中包括 specType、单/多规格数据
        const { skus, ...rest } = data;
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({ data: rest });
            if (Array.isArray(skus) && skus.length > 0) {
                await tx.productSku.createMany({ data: skus.map((s: any) => ({ ...s, productId: product.id })) });
            }
            return product;
        });
    }
    updateProduct(id: number, data: any) {
        const { skus, ...rest } = data;
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.update({ where: { id }, data: rest });
            if (Array.isArray(skus)) {
                // 简化：先删再建
                await tx.productSku.deleteMany({ where: { productId: id } });
                if (skus.length > 0) await tx.productSku.createMany({ data: skus.map((s: any) => ({ ...s, productId: id })) });
            }
            return product;
        });
    }
    deleteProduct(id: number) {
        return this.prisma.$transaction(async (tx) => {
            await tx.productSku.deleteMany({ where: { productId: id } });
            return tx.product.delete({ where: { id } });
        });
    }

    // 库存：对 Product 或 Sku 进行出入库
    async adjustInventory(params: { productId: number; skuId?: number | null; change: number; reason: string; remark?: string | null; operatorUserId?: number | null }) {
        const { productId, skuId, change, reason, remark, operatorUserId } = params;
        // 查询当前库存
        const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
        let before = 0;
        let after = 0;
        if (skuId) {
            const sku = await this.prisma.productSku.findUniqueOrThrow({ where: { id: skuId } });
            before = sku.stockQuantity;
            after = before + change;
            if (after < 0) throw new Error('库存不足');
            await this.prisma.productSku.update({ where: { id: skuId }, data: { stockQuantity: after } });
        } else {
            before = product.stockQuantity ?? 0;
            after = before + change;
            if (after < 0) throw new Error('库存不足');
            await this.prisma.product.update({ where: { id: productId }, data: { stockQuantity: after } });
        }
        await this.prisma.inventoryLog.create({ data: { productId, skuId: skuId ?? null, change, beforeStock: before, afterStock: after, reason: reason as any, remark: remark ?? null, operatorUserId: operatorUserId ?? null } });
        return { productId, skuId: skuId ?? null, before, after };
    }
}


