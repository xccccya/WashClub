import { Body, Controller, Get, Post, Put, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { UseGuards } from '@nestjs/common';
import { RequirePerm } from '../auth/perm.decorator.js';
import { Delete } from '@nestjs/common';

@ApiTags('notification-template')
@Controller('notification/template')
@UseGuards(AdminGuard as any)
export class NotificationTemplateController {
    constructor(private prisma: PrismaService) {}

    @Get('list')
    @ApiOperation({ summary: '模板列表' })
    @RequirePerm('notification-templates' as any)
    async list(@Query('q') q?: string, @Query('channel') channel?: 'MEMBER'|'ADMIN'|'WXAPP'){
        const where: any = q ? { OR: [ { typeKey: { contains: q } }, { titleTemplate: { contains: q } }, { contentTemplate: { contains: q } } ] } : {};
        if (channel) where.channel = channel;
        return this.prisma.notificationTemplate.findMany({ where, orderBy: { id: 'asc' } });
    }

    @Post('create')
    @ApiOperation({ summary: '创建模板' })
    @RequirePerm('notification-templates' as any)
    async create(@Body() dto: { typeKey:string; titleTemplate:string; contentTemplate:string; enabled?:boolean; channel?: 'MEMBER'|'ADMIN'|'WXAPP'; uiDuration?: number|null; uiType?: string|null; uiPosition?: string|null }){
        const data = { typeKey: String(dto.typeKey||'').trim(), titleTemplate: String(dto.titleTemplate||''), contentTemplate: String(dto.contentTemplate||''), enabled: dto.enabled!==false, channel: (dto.channel||'MEMBER'), uiDuration: dto.uiDuration==null? null: Number(dto.uiDuration), uiType: dto.uiType||null, uiPosition: dto.uiPosition||null } as any;
        if (!data.typeKey) throw new Error('缺少类型');
        // 允许同一 typeKey/channel 多个模板并存；若启用则关闭其他启用模板，保持单一启用
        const created = await this.prisma.notificationTemplate.create({ data });
        if (created.enabled) {
            await this.prisma.notificationTemplate.updateMany({ where: { typeKey: created.typeKey, channel: created.channel, NOT: { id: created.id } }, data: { enabled: false } });
        }
        return created;
    }

    @Put(':id')
    @ApiOperation({ summary: '更新模板' })
    @RequirePerm('notification-templates' as any)
    async update(@Param('id') idStr: string, @Body() dto: { titleTemplate?:string; contentTemplate?:string; enabled?:boolean; uiDuration?: number|null; uiType?: string|null; uiPosition?: string|null }){
        const id = Number(idStr||0); if (!id) throw new Error('ID无效');
        const prev = await this.prisma.notificationTemplate.findUnique({ where: { id } });
        if (!prev) throw new Error('模板不存在');
        const data: any = {};
        if (dto.titleTemplate!==undefined) data.titleTemplate = String(dto.titleTemplate||'');
        if (dto.contentTemplate!==undefined) data.contentTemplate = String(dto.contentTemplate||'');
        if (dto.enabled!==undefined) data.enabled = !!dto.enabled;
        if (dto.uiDuration!==undefined) data.uiDuration = (dto.uiDuration==null? null: Number(dto.uiDuration));
        if (dto.uiType!==undefined) data.uiType = dto.uiType || null;
        if (dto.uiPosition!==undefined) data.uiPosition = dto.uiPosition || null;
        const updated = await this.prisma.notificationTemplate.update({ where: { id }, data });
        // 若启用为 true，则关闭同 typeKey 其他模板
        if (updated.enabled) {
            await this.prisma.notificationTemplate.updateMany({ where: { typeKey: updated.typeKey, channel: updated.channel, NOT: { id: updated.id } }, data: { enabled: false } });
        }
        return updated;
    }

    @Get('variables')
    @ApiOperation({ summary: '模板类型的变量清单' })
    @RequirePerm('notification-templates' as any)
    async variables(@Query('typeKey') typeKey?: string){
        const map: Record<string, { key:string; label:string }[]> = {
            ORDER_PAID: [ { key:'no', label:'订单号' }, { key:'amount', label:'支付金额(元)' }, { key:'paidAt', label:'支付时间' } ],
            SERVICE_DONE: [ { key:'no', label:'订单号' }, { key:'endAt', label:'服务完成时间' } ],
            COUPON_WILL_EXPIRE: [ { key:'couponName', label:'券名称' }, { key:'endAt', label:'到期时间' } ],
            REFUND_ARRIVED: [ { key:'no', label:'订单号' }, { key:'amount', label:'退款金额(元)' }, { key:'arrivedAt', label:'到账时间' } ],
            // 洗车卡支付划扣（用于订单支付场景）
            WASH_CARD_PAY_DEDUCT: [
                { key:'no', label:'订单号' },
                { key:'times', label:'划扣次数' },
                { key:'cardName', label:'洗车卡名称（多张以、分隔）' },
                { key:'cardNo', label:'洗车卡卡号（多张以、分隔）' },
                { key:'amount', label:'抵扣金额(元)' },
            ],
            // 洗车卡划扣（用于后台等非支付场景）
            WASH_CARD_DEDUCT: [
                { key:'cardName', label:'洗车卡名称' },
                { key:'cardNo', label:'洗车卡卡号' },
                { key:'times', label:'划扣次数' },
                { key:'reason', label:'划扣原因' },
            ],
            // 管理通知：新订单提醒
            ADMIN_NEW_ORDER: [ { key:'no', label:'订单号' }, { key:'amount', label:'订单金额(元)' }, { key:'type', label:'订单类型' } ],
        };
        if (typeKey && map[typeKey]) return map[typeKey];
        return Object.entries(map).map(([k,v])=>({ typeKey:k, variables:v }));
    }

    @Delete(':id')
    @ApiOperation({ summary: '删除模板' })
    @RequirePerm('notification-templates' as any)
    async remove(@Param('id') idStr: string){
        const id = Number(idStr||0); if (!id) throw new Error('ID无效');
        try{ await this.prisma.notificationTemplate.delete({ where: { id } }); }catch{ throw new Error('删除失败或模板不存在'); }
        return { ok: true } as any;
    }
}


