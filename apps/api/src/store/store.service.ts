import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class StoreService {
    constructor(private readonly prisma: PrismaService) {}

    // 分类（可按商品类型过滤）
    listCategories(query?: { type?: string | null }) {
        const where: any = {};
        if (query?.type) {
            where.products = { some: { type: query.type as any, enabled: true, deletedAt: null } };
        }
        return this.prisma.productCategory.findMany({ where, orderBy: [{ weight: 'desc' }, { id: 'desc' }] });
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
    async listProducts(query: { keyword?: string; categoryId?: number | null; type?: string | null; enabled?: boolean | null }) {
        const where: any = { deletedAt: null };
        if (query.keyword) where.OR = [{ name: { contains: query.keyword } }, { barcode: { contains: query.keyword } }];
        if (query.categoryId !== undefined) where.categoryId = query.categoryId;
        if (query.type) where.type = query.type as any;
        if (query.enabled !== null && query.enabled !== undefined) where.enabled = query.enabled;
        const list = await this.prisma.product.findMany({ where, orderBy: [{ sortWeight: 'desc' }, { id: 'desc' }], include: { skus: true, category: true, coupon: { select: { id: true, type: true, name: true } } } });
        if (!list.length) return [];
        const ids = list.map((p: any) => p.id);
        // 统计销量：仅统计已支付订单的订单项数量，并叠加 initialSales
        const group = await this.prisma.orderItem.groupBy({
            by: ['productId'],
            where: { productId: { in: ids }, order: { payStatus: 'PAID' } as any },
            _sum: { quantity: true },
        });
        const sumMap = new Map<number, number>();
        for (const g of group) sumMap.set((g as any).productId as number, Number((g as any)._sum?.quantity || 0));
        return list.map((p: any) => ({ ...p, ...this.computeDerivedFields(p), totalSales: Number(p.initialSales || 0) + (sumMap.get(p.id) || 0) }));
    }
    async getProduct(id: number) {
        const p: any = await this.prisma.product.findUnique({ where: { id }, include: { skus: true, category: true } });
        if (!p) return p as any;
        const agg = await this.prisma.orderItem.aggregate({ where: { productId: id, order: { payStatus: 'PAID' } as any }, _sum: { quantity: true } });
        const paidQty = Number((agg as any)?._sum?.quantity || 0);
        return { ...p, ...this.computeDerivedFields(p), totalSales: Number(p.initialSales || 0) + paidQty };
    }
    createProduct(data: any) {
        // data 包含 specType、imagesJson、specsDefinitionJson、以及（当 MULTI 时）skus
        const { skus, imagesJson, specsDefinitionJson, ...rest } = data;
        // 仅保留允许写入的字段，避免把 category/派生字段等传入 Prisma
        const allowedKeys = ['type','name','barcode','categoryId','imageUrl','sortWeight','enabled','description','pointsDeductible','memberDiscount','specType','price','listPrice','stockQuantity','initialSales','sellPoint','couponId'];
        const payload: any = {};
        for (const k of allowedKeys) if (k in rest) (payload as any)[k] = (rest as any)[k];
        if ('id' in payload) delete payload.id;
        if (typeof payload?.barcode === 'string') {
            const b = String(payload.barcode).trim();
            payload.barcode = b ? b : null;
        }
        // 规格校验与字段归位
        if (payload.specType === 'SINGLE') {
            if (Array.isArray(skus) && skus.length > 0) throw new Error('单规格商品不允许提交 SKU 列表');
            payload.specsDefinitionJson = null;
        } else if (payload.specType === 'MULTI') {
            if (!Array.isArray(skus) || skus.length === 0) throw new Error('多规格商品必须至少包含一个 SKU');
            payload.price = null; payload.listPrice = null; payload.stockQuantity = null;
            payload.specsDefinitionJson = Array.isArray(specsDefinitionJson) ? specsDefinitionJson : null;
            const codes = (skus as any[]).map(s => String(s.skuCode||'').trim()).filter(Boolean);
            const dup = codes.find((c, i) => codes.indexOf(c) !== i);
            if (dup) throw new Error(`SKU 编码重复: ${dup}`);
        }
        // 处理 imagesJson 与 category 连接/断开
        const images = Array.isArray(imagesJson) ? imagesJson : null;
        const categoryIdVal = Object.prototype.hasOwnProperty.call(payload, 'categoryId') ? payload.categoryId : undefined;
        if ('categoryId' in payload) delete payload.categoryId;
        const couponIdVal = Object.prototype.hasOwnProperty.call(payload, 'couponId') ? payload.couponId : undefined;
        if ('couponId' in payload) delete payload.couponId;
        const dataToCreate: any = { ...payload, imagesJson: images };
        if (categoryIdVal !== undefined) {
            dataToCreate.category = categoryIdVal === null ? { disconnect: true } : { connect: { id: Number(categoryIdVal) } };
        }
        if (couponIdVal !== undefined) {
            dataToCreate.coupon = couponIdVal === null ? { disconnect: true } : { connect: { id: Number(couponIdVal) } };
        }
        return this.prisma.$transaction(async (tx) => {
            const created = await tx.product.create({ data: dataToCreate, select: { id: true } });
            if (payload.specType === 'MULTI') {
                const now = Date.now();
                const rows = (skus as any[]).map((s, idx) => this.normalizeSkuForCreate(created.id, s, `${now}-${idx}`));
                await tx.productSku.createMany({ data: rows });
            }
            return tx.product.findUnique({ where: { id: created.id }, include: { skus: true, category: true } });
        });
    }
    updateProduct(id: number, data: any) {
        const { skus, imagesJson, specsDefinitionJson, ...rest } = data;
        const allowedKeys = ['type','name','barcode','categoryId','imageUrl','sortWeight','enabled','description','pointsDeductible','memberDiscount','specType','price','listPrice','stockQuantity','initialSales','sellPoint','couponId'];
        const payload: any = {};
        for (const k of allowedKeys) if (k in rest) (payload as any)[k] = (rest as any)[k];
        if ('id' in payload) delete payload.id;
        if (typeof payload?.barcode === 'string') {
            const b = String(payload.barcode).trim();
            payload.barcode = b ? b : null;
        }
        // 处理 images 与分类连接
        const images = Array.isArray(imagesJson) ? imagesJson : null;
        const categoryIdVal = Object.prototype.hasOwnProperty.call(payload, 'categoryId') ? payload.categoryId : undefined;
        if ('categoryId' in payload) delete payload.categoryId;
        const couponIdVal = Object.prototype.hasOwnProperty.call(payload, 'couponId') ? payload.couponId : undefined;
        if ('couponId' in payload) delete payload.couponId;
        const baseData: any = { ...payload, imagesJson: images, specsDefinitionJson: Array.isArray(specsDefinitionJson) ? specsDefinitionJson : (payload.specType==='SINGLE'? null : undefined) };
        if (categoryIdVal !== undefined) {
            baseData.category = categoryIdVal === null ? { disconnect: true } : { connect: { id: Number(categoryIdVal) } };
        }
        if (couponIdVal !== undefined) {
            baseData.coupon = couponIdVal === null ? { disconnect: true } : { connect: { id: Number(couponIdVal) } };
        }
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.update({ where: { id }, data: baseData });
            if (payload.specType === 'SINGLE') {
                await tx.productSku.updateMany({ where: { productId: id }, data: { enabled: false } });
            } else if (payload.specType === 'MULTI' && Array.isArray(skus)) {
                const codes = (skus as any[]).map(s => String(s.skuCode||'').trim()).filter(Boolean);
                const dup = codes.find((c, i) => codes.indexOf(c) !== i);
                if (dup) throw new Error(`SKU 编码重复: ${dup}`);
                const existing = await tx.productSku.findMany({ where: { productId: id } });
                const existById = new Map<number, any>(existing.map(e => [e.id, e]));
                const keepIds: number[] = [];
                for (let i = 0; i < skus.length; i++) {
                    const s = skus[i];
                    if (s && typeof s.id === 'number' && existById.has(s.id)) {
                        const dataUpdate = this.normalizeSkuForUpdate(id, s);
                        await tx.productSku.update({ where: { id: s.id }, data: dataUpdate });
                        keepIds.push(s.id);
                    } else {
                        const dataCreate = this.normalizeSkuForCreate(id, s, `${Date.now()}-${i}`);
                        const created = await tx.productSku.create({ data: dataCreate, select: { id: true } });
                        keepIds.push(created.id);
                    }
                }
                const toDisable = existing.filter(e => !keepIds.includes(e.id)).map(e => e.id);
                if (toDisable.length) await tx.productSku.updateMany({ where: { id: { in: toDisable } }, data: { enabled: false } });
            }
            return tx.product.findUnique({ where: { id }, include: { skus: true, category: true } });
        });
    }
    async deleteProduct(id: number) {
        // 引用检查：存在库存流水/订单项/优惠券适用则阻止删除，建议下架
        const hasInventory = await this.prisma.inventoryLog.count({ where: { productId: id } });
        const hasOrderItem = await this.prisma.orderItem.count({ where: { productId: id } });
        const hasCouponApplicable = await this.prisma.couponApplicableProduct.count({ where: { productId: id } });
        if (hasInventory || hasOrderItem || hasCouponApplicable) {
            throw new Error('该商品已被业务引用，建议执行“下架”而非删除');
        }
        // 软删除：标记 deletedAt，并禁用所有 SKU
        return this.prisma.$transaction(async (tx) => {
            await tx.productSku.updateMany({ where: { productId: id }, data: { enabled: false } });
            return tx.product.update({ where: { id }, data: { deletedAt: new Date(), enabled: false } });
        });
    }

    // 库存：对 Product 或 Sku 进行出入库（SERVICE 不允许；MULTI 必须带 skuId；SINGLE 禁止带 skuId）
    async adjustInventory(params: { productId: number; skuId?: number | null; change: number; reason: string; remark?: string | null; operatorUserId?: number | null }) {
        const { productId, skuId } = params;
        let { change, reason } = params as { change: number; reason: string };
        const remark = params.remark;
        const operatorUserId = params.operatorUserId;
        // 统一正负号规则：
        // INBOUND：一律使用正数；OUTBOUND：一律使用负数；ADJUSTMENT：保持原样；
        // 其他业务原因（如 ORDER_DEDUCT/ORDER_ROLLBACK/REFUND_RETURN）保持原样由业务方传入
        if (reason === 'INBOUND') {
            change = Math.abs(Number(change || 0));
        } else if (reason === 'OUTBOUND') {
            change = -Math.abs(Number(change || 0));
        } else if (reason === 'ADJUSTMENT') {
            change = Number(change || 0);
        } else {
            change = Number(change || 0);
        }
        // 查询当前库存
        const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
        if (product.type === 'SERVICE') throw new Error('服务类商品不支持库存调整');
        let before = 0;
        let after = 0;
        if (product.specType === 'MULTI') {
            if (!skuId) throw new Error('多规格商品调整库存必须传入 skuId');
            const sku = await this.prisma.productSku.findUniqueOrThrow({ where: { id: skuId } });
            before = sku.stockQuantity;
            after = before + change;
            if (after < 0) throw new Error('库存不足');
            await this.prisma.productSku.update({ where: { id: skuId }, data: { stockQuantity: after } });
        } else {
            if (skuId) throw new Error('单规格商品调整库存时不得传入 skuId');
            before = product.stockQuantity ?? 0;
            after = before + change;
            if (after < 0) throw new Error('库存不足');
            await this.prisma.product.update({ where: { id: productId }, data: { stockQuantity: after } });
        }
        await this.prisma.inventoryLog.create({ data: { productId, skuId: skuId ?? null, change, beforeStock: before, afterStock: after, reason: reason as any, remark: remark ?? null, operatorUserId: operatorUserId ?? null } });
        return { productId, skuId: skuId ?? null, before, after };
    }

    // 库存记录查询（可按商品/SKU/原因过滤，分页）
    async listInventoryLogs(query: { productId?: number; skuId?: number; reason?: string | null; page?: number; pageSize?: number }) {
        const page = Math.max(1, Number(query.page || 1));
        const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
        const where: any = {};
        if (typeof query.productId === 'number') where.productId = query.productId;
        if (typeof query.skuId === 'number') where.skuId = query.skuId;
        if (query.reason) where.reason = query.reason as any;
        const [items, total] = await Promise.all([
            this.prisma.inventoryLog.findMany({
                where,
                orderBy: { id: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    product: { select: { id: true, name: true, type: true, specType: true } },
                    sku: { select: { id: true, name: true, skuCode: true } },
                    operatorUser: { select: { id: true, name: true, phone: true } },
                },
            }),
            this.prisma.inventoryLog.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }

    // ===== 私有辅助：派生字段与 SKU 归一化 =====
    private computeDerivedFields(product: any): { minPrice?: number; maxPrice?: number; priceRange?: string | null; totalStock?: number } {
        try {
            if (product.specType === 'MULTI') {
                const skus = Array.isArray(product.skus) ? product.skus.filter((s: any) => s.enabled !== false) : [];
                if (skus.length === 0) return { minPrice: undefined, maxPrice: undefined, priceRange: null, totalStock: 0 };
                const prices = skus.map((s: any) => Number(s.price || 0));
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const totalStock = skus.reduce((sum: number, s: any) => sum + Number(s.stockQuantity || 0), 0);
                return { minPrice, maxPrice, priceRange: minPrice === maxPrice ? `${minPrice}` : `${minPrice}~${maxPrice}`, totalStock };
            } else {
                const p = Number(product.price || 0);
                const totalStock = Number(product.stockQuantity || 0);
                return { minPrice: p, maxPrice: p, priceRange: `${p}`, totalStock };
            }
        } catch {
            return {} as any;
        }
    }

    private normalizeSkuForCreate(productId: number, raw: any, seed: string) {
        const name = this.ensureSkuName(raw);
        const skuCode = String(raw?.skuCode || '').trim() || this.generateSkuCode(productId, seed);
        return {
            productId,
            name,
            specsJson: Array.isArray(raw?.specsJson) ? raw.specsJson : null,
            skuCode,
            barcode: raw?.barcode ? String(raw.barcode).trim() : null,
            imageUrl: raw?.imageUrl ? String(raw.imageUrl).trim() : null,
            price: Number(raw?.price || 0),
            listPrice: Number(raw?.listPrice || 0),
            stockQuantity: Number(raw?.stockQuantity || 0),
            enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
            // 允许 SKU 级别绑定卡券（虚拟卡券商品）
            couponId: (raw?.couponId===null || raw?.couponId===undefined || raw?.couponId==='') ? null : Number(raw?.couponId),
        };
    }

    private normalizeSkuForUpdate(productId: number, raw: any) {
        const name = this.ensureSkuName(raw);
        const data: any = {
            productId,
            name,
            specsJson: Array.isArray(raw?.specsJson) ? raw.specsJson : null,
            skuCode: String(raw?.skuCode || '').trim() || this.generateSkuCode(productId, `${Date.now()}`),
            barcode: raw?.barcode ? String(raw.barcode).trim() : null,
            imageUrl: raw?.imageUrl ? String(raw.imageUrl).trim() : null,
            price: Number(raw?.price || 0),
            listPrice: Number(raw?.listPrice || 0),
            stockQuantity: Number(raw?.stockQuantity || 0),
            enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : true,
            couponId: (raw?.couponId===null || raw?.couponId===undefined || raw?.couponId==='') ? null : Number(raw?.couponId),
        };
        return data;
    }

    private ensureSkuName(raw: any): string {
        try {
            const arr = Array.isArray(raw?.specsJson) ? raw.specsJson : null;
            if (arr && arr.length > 0) {
                const vals = arr.map((it: any) => String(it?.value ?? '').trim()).filter(Boolean);
                if (vals.length > 0) return vals.join('/');
            }
        } catch {}
        const n = String(raw?.name || '').trim();
        return n || '默认';
    }

    private generateSkuCode(productId: number, seed: string): string { return `P${productId}-S${seed}`; }
}


