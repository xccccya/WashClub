import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueueTypeService } from './queue-type.service.js';

@ApiTags('queue-types')
@Controller('queue-types')
export class QueueTypeController {
    constructor(private service: QueueTypeService) {}

    @Get()
    @ApiOperation({ summary: '队列类型列表（含步骤与可用商品）' })
    list() { return this.service.list(); }

    @Post()
    @ApiOperation({ summary: '创建队列类型' })
    create(@Body() body: { name: string; enabled?: boolean; sortWeight?: number; remark?: string | null; participateInEta?: boolean | null; etaParallelSlots?: number | null; etaGroupKey?: string | null; displayColor?: string | null }) {
        return this.service.create(body);
    }

    @Put(':id')
    @ApiOperation({ summary: '更新队列类型' })
    update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; enabled?: boolean; sortWeight?: number; remark?: string | null; participateInEta?: boolean | null; etaParallelSlots?: number | null; etaGroupKey?: string | null; displayColor?: string | null }) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    @ApiOperation({ summary: '删除队列类型（若已被使用则拒绝）' })
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }

    @Put(':id/steps')
    @ApiOperation({ summary: '设置队列类型的步骤（覆盖式）' })
    setSteps(@Param('id', ParseIntPipe) id: number, @Body() body: { steps: Array<{ orderIndex?: number; name: string; durationMin: number; isEta?: boolean | null }> }) {
        const steps = (body?.steps || []).map((s, i) => ({ orderIndex: typeof s.orderIndex === 'number' ? s.orderIndex : i, name: s.name, durationMin: s.durationMin, isEta: typeof s.isEta === 'boolean' ? !!s.isEta : null }));
        return this.service.setSteps(id, steps);
    }

    @Put(':id/products')
    @ApiOperation({ summary: '设置队列类型的可用服务商品（覆盖式）' })
    setProducts(@Param('id', ParseIntPipe) id: number, @Body() body: { productIds: number[] }) {
        if (!Array.isArray(body?.productIds)) throw new BadRequestException('productIds 必须为数组');
        return this.service.setProducts(id, body.productIds);
    }
}


