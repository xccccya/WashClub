import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards, Headers } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueueService } from './queue.service.js';
import { PrismaService } from '../prisma.service.js';
import { OrderService } from '../order/order.service.js';
import { VehicleService } from '../member/vehicle.service.js';
import { GroupService } from '../group/group.service.js';
import { JwtService } from '@nestjs/jwt';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
    constructor(private service: QueueService, private prisma: PrismaService, private orders: OrderService, private vehicles: VehicleService, private groups: GroupService, private jwt: JwtService) {}

    @Get('list')
    @ApiOperation({ summary: '服务队列列表（进行中/待处理）' })
    list() { return this.service.listActive(); }

    @Get('summary')
    @ApiOperation({ summary: '队列摘要统计' })
    summary() { return this.service.summary(); }

    @Get('eta-summary')
    @ApiOperation({ summary: 'ETA 顶部汇总（按类型展示，按资源组计算）' })
    etaSummary() { return this.service.etaSummaryByType(); }

    @Post('add')
    @ApiOperation({ summary: '添加到队列（支持多种模式）' })
    add(@Body() body: any) {
        const mode = String(body?.mode || '').trim();
        if (!mode) throw new BadRequestException('缺少添加方式');
        const queueTypeId = body?.queueTypeId ? Number(body.queueTypeId) : undefined;
        if (mode === 'vehicleId') return this.service.addToQueue({ mode: 'vehicleId', vehicleId: Number(body.vehicleId), queueTypeId });
        if (mode === 'plateExisting') return this.service.addToQueue({ mode: 'plateExisting', plateNumber: String(body.plateNumber || '').trim(), queueTypeId });
        if (mode === 'guest') {
            return this.service.addToQueue({
                mode: 'guest',
                plateNumber: String(body.plateNumber || '').trim(),
                vin: body.vin,
                typeMain: body.typeMain,
                typeSub: body.typeSub,
                color: body.color,
                brand: body.brand,
                series: body.series,
                brandId: typeof body.brandId === 'number' ? body.brandId : (body.brandId ? Number(body.brandId) : undefined),
                seriesId: typeof body.seriesId === 'number' ? body.seriesId : (body.seriesId ? Number(body.seriesId) : undefined),
                queueTypeId,
            });
        }
        throw new BadRequestException('不支持的添加方式');
    }

    @Post('create-service-order-and-enqueue')
    @ApiOperation({ summary: '创建服务订单并入队（先服务后付）' })
    async createServiceOrderAndEnqueue(@Body() body: any, @Headers('authorization') authHeader?: string) {
        const queueTypeId = Number(body?.queueTypeId || 0);
        const incomingItemsRaw = Array.isArray(body?.items) ? body.items : null;
        const productIdsByLegacy = Array.isArray(body?.productIds) ? body.productIds.map((n: any)=>Number(n)).filter((n: any)=>Number.isFinite(n)) : [];
        const plateNumber = String(body?.plateNumber || '').trim();
        const vehicleId = body?.vehicleId ? Number(body.vehicleId) : null;
        if (!queueTypeId) throw new BadRequestException('缺少队列类型');
        if ((!incomingItemsRaw || incomingItemsRaw.length===0) && productIdsByLegacy.length===0) throw new BadRequestException('至少选择一个服务商品');
        if (!vehicleId && !plateNumber) throw new BadRequestException('缺少车辆标识');

        // 读取队列类型与允许商品
        const qtype: any = await (this.prisma as any).serviceQueueType.findUnique({
            where: { id: queueTypeId },
            include: { steps: { orderBy: { orderIndex: 'asc' } }, products: true }
        });
        if (!qtype || !qtype.enabled) throw new BadRequestException('队列类型无效或未启用');
        const allowed = new Set<number>((qtype.products||[]).map((p: any)=>p.productId));
        // 归一化 items：兼容旧版 productIds，仅数量=1
        const incomingItems: Array<{ productId: number; skuId?: number|null; quantity?: number }>= (incomingItemsRaw && Array.isArray(incomingItemsRaw))
            ? incomingItemsRaw.map((x:any)=>({ productId: Number(x?.productId||0), skuId: x?.skuId!=null?Number(x.skuId):undefined, quantity: Number(x?.quantity||1) }))
            : productIdsByLegacy.map((pid:number)=>({ productId: pid, skuId: undefined, quantity: 1 }));
        if (incomingItems.some(it=>!Number.isFinite(it.productId) || it.productId<=0)) throw new BadRequestException('存在无效商品');
        if (incomingItems.some(it=>!allowed.has(Number(it.productId)))) throw new BadRequestException('所选商品不在该队列类型可用范围');

        // 解析车辆/游客与归属
        let v: any = null;
        if (vehicleId) v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { member: true, group: true } });
        if (!v && plateNumber) v = await this.prisma.vehicle.findUnique({ where: { plateNumber }, include: { member: true, group: true } });

        let resolvedVehicleId: number | null = v?.id ?? null;
        let resolvedPlate = v?.plateNumber || plateNumber;
        let guest = false;
        let memberId: number | null = null;
        let groupId: number | null = null;

        if (v) {
            guest = !v.memberId;
            memberId = v.memberId ?? null;
            groupId = v.groupId ?? null;
        } else {
            // 游客车辆创建：走统一服务以便拉取品牌/车系图片并入库绑定
            const createdVehicle = await this.vehicles.createGuestVehicle({
                plateNumber: resolvedPlate,
                vin: body?.vin ?? null,
                brand: typeof body?.brand === 'string' ? body.brand : undefined,
                series: typeof body?.series === 'string' ? body.series : undefined,
                typeMain: typeof body?.typeMain === 'string' ? body.typeMain : undefined,
                typeSub: typeof body?.typeSub === 'string' ? body.typeSub : undefined,
                color: typeof body?.color === 'string' ? body.color : undefined,
                brandId: typeof body?.brandId === 'number' ? body.brandId : (body?.brandId ? Number(body.brandId) : undefined),
                seriesId: typeof body?.seriesId === 'number' ? body.seriesId : (body?.seriesId ? Number(body.seriesId) : undefined),
            });
            resolvedVehicleId = createdVehicle?.id ?? null;
            resolvedPlate = createdVehicle?.plateNumber || resolvedPlate;
            guest = true;
        }

        // 订单会员归属优先策略：若为集团车辆，订单完全归属集团名下（使用集团订单占位会员），否则回退到游客会员
        if (!memberId) {
            if (groupId) {
                try { memberId = await this.groups.ensureOrderOwnerMember(groupId); } catch {}
            }
            if (!memberId) {
                const gid = Number(process.env.GUEST_MEMBER_ID || (process.env as any).GUESS_MEMBER_ID || 0);
                if (!gid) throw new BadRequestException('系统未配置 GUEST_MEMBER_ID（游客订单所属会员）。请在环境变量中设置 GUEST_MEMBER_ID，指向一个有效会员ID。');
                // 校验 member 是否存在
                const m = await this.prisma.member.findUnique({ where: { id: gid }, select: { id: true } });
                if (!m) throw new BadRequestException('GUEST_MEMBER_ID 无效：未找到对应会员。请将 GUEST_MEMBER_ID 设置为一个有效的会员ID。');
                memberId = gid;
            }
        }

        // 读取商品&SKU快照并构造订单项（支持多规格服务商品）
        const pidSet = Array.from(new Set(incomingItems.map(it=>Number(it.productId))));
        const products = await this.prisma.product.findMany({ where: { id: { in: pidSet } }, include: { skus: true } });
        const prodMap = new Map<number, any>(products.map((p:any)=>[p.id, p]));
        const items = incomingItems.map((it)=>{
            const p = prodMap.get(Number(it.productId));
            if (!p) throw new BadRequestException(`商品不存在：${it.productId}`);
            const qty = Math.max(1, Number(it.quantity||1));
            if (String(p.specType||'') === 'MULTI') {
                const sid = Number(it.skuId||0);
                if (!Number.isFinite(sid) || sid<=0) throw new BadRequestException(`多规格商品缺少SKU：${p.name}`);
                const sku = (Array.isArray(p.skus)?p.skus:[]).find((s:any)=>Number(s.id)===sid);
                if (!sku) throw new BadRequestException(`未找到SKU：${p.name}`);
                return { productId: p.id, skuId: sku.id, name: p.name, imageUrl: sku.imageUrl || p.imageUrl || null, specsText: sku.name, barcode: sku.barcode || p.barcode || null, price: sku.price || 0, discount: 0, quantity: qty };
            } else {
                return { productId: p.id, skuId: null, name: p.name, imageUrl: p.imageUrl ?? null, specsText: null, barcode: p.barcode ?? null, price: p.price || 0, discount: 0, quantity: qty };
            }
        });

        // 创建服务订单（先服务后付）
        // 代客识别：从管理员令牌中提取操作者
        let proxyAdminUserId: number | null = null;
        let proxyAdminSnapshot: any = null;
        try{
            const m = /^Bearer\s+(.+)$/.exec(String(authHeader||''));
            const token = m?.[1];
            if (token) {
                const decoded: any = this.jwt.verify(token);
                if (decoded?.type === 'admin') {
                    const id = Number(decoded?.sub);
                    if (Number.isFinite(id) && id > 0) {
                        proxyAdminUserId = id;
                        const u = await this.prisma.user.findUnique({ where: { id }, select: { id:true, name:true, phone:true } });
                        if (u) proxyAdminSnapshot = { id: u.id, name: u.name || null, phone: u.phone || null };
                    }
                }
            }
        }catch{}

        const gidEnv = Number(process.env.GUEST_MEMBER_ID || (process.env as any).GUESS_MEMBER_ID || 0);
        const isGuestOrder = guest || (!!gidEnv && Number(memberId) === gidEnv);
        const cashierDiscountAmount = Number(body?.cashierDiscountAmount || 0);
        // 兜底：若未识别到管理员身份但确有收银立减，视为 POS 内部请求，允许手动立减
        const ord = await this.orders.createOrder({ type: 'SERVICE' as any, memberId: Number(memberId), vehicleId: resolvedVehicleId, groupId: groupId ?? null, items, payAfterService: true, userRemark: body?.userRemark, cashierDiscountAmount: Number.isFinite(cashierDiscountAmount) ? cashierDiscountAmount : 0, _isGuestOrder: isGuestOrder, _proxyAdminUserId: proxyAdminUserId, _proxyAdminSnapshot: proxyAdminSnapshot, _posInternalDiscountAllowed: (!proxyAdminUserId && Number.isFinite(cashierDiscountAmount) && cashierDiscountAmount > 0) } as any);

        // 创建队列项（使用队列类型的步骤快照）
        const created = await (this.prisma as any).$transaction(async (tx: any) => {
            // 重复检测
            const existed = await tx.serviceQueueItem.findFirst({ where: { status: { in: ['IN_QUEUE','SERVING'] }, OR: [ { plateNumber: resolvedPlate }, { vehicleId: resolvedVehicleId ?? undefined } ] } as any });
            if (existed) throw new BadRequestException('该车辆已在服务队列中');
            const orderSort = await tx.serviceQueueItem.count();
            // 统一入队为未开始，需要人工点击“开始第一步”
            const currentTaskIndex = -1;
            const item = await tx.serviceQueueItem.create({
                data: {
                    vehicleId: resolvedVehicleId ?? undefined,
                    plateNumber: resolvedPlate,
                    guest,
                    orderSort,
                    currentTaskIndex,
                    queueTypeId: qtype.id,
                    orderId: ord.id,
                    tasks: { create: (qtype.steps||[]).map((s: any)=>({ name: s.name, durationMin: s.durationMin, orderIndex: s.orderIndex })) }
                },
                include: { tasks: true }
            });
            return item;
        });

        return { order: ord, queueItem: created };
    }

    @Post(':id/set-current')
    @ApiOperation({ summary: '设置当前执行任务索引' })
    setCurrent(@Param('id') id: string, @Body() body: { taskIndex: number }) {
        if (typeof body?.taskIndex !== 'number') throw new BadRequestException('taskIndex 必须为数字');
        return this.service.setCurrentTask(Number(id), Number(body.taskIndex));
    }

    @Post(':id/finish-task')
    @ApiOperation({ summary: '完成当前任务节点' })
    finishTask(@Param('id') id: string) { return this.service.finishCurrentTask(Number(id)); }

    @Post(':id/confirm-complete')
    @ApiOperation({ summary: '确认整单已完成' })
    confirmComplete(@Param('id') id: string) { return this.service.confirmComplete(Number(id)); }

    @Post(':id/start-first')
    @ApiOperation({ summary: '开始第一步任务' })
    startFirst(@Param('id') id: string) { return this.service.startFirstTask(Number(id)); }

    @Delete(':id')
    @ApiOperation({ summary: '移出队列/取消' })
    @UseGuards(AdminGuard)
    remove(@Param('id') id: string) { return this.service.remove(Number(id)); }
}


