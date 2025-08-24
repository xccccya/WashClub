import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueueService } from './queue.service.js';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
    constructor(private service: QueueService) {}

    @Get('list')
    list() { return this.service.listActive(); }

    @Get('summary')
    summary() { return this.service.summary(); }

    @Post('add')
    add(@Body() body: any) {
        const mode = String(body?.mode || '').trim();
        if (!mode) throw new BadRequestException('缺少添加方式');
        if (mode === 'vehicleId') return this.service.addToQueue({ mode: 'vehicleId', vehicleId: Number(body.vehicleId) });
        if (mode === 'plateExisting') return this.service.addToQueue({ mode: 'plateExisting', plateNumber: String(body.plateNumber || '').trim() });
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
            });
        }
        throw new BadRequestException('不支持的添加方式');
    }

    @Post(':id/set-current')
    setCurrent(@Param('id') id: string, @Body() body: { taskIndex: number }) {
        if (typeof body?.taskIndex !== 'number') throw new BadRequestException('taskIndex 必须为数字');
        return this.service.setCurrentTask(Number(id), Number(body.taskIndex));
    }

    @Post(':id/finish-task')
    finishTask(@Param('id') id: string) { return this.service.finishCurrentTask(Number(id)); }

    @Post(':id/confirm-complete')
    confirmComplete(@Param('id') id: string) { return this.service.confirmComplete(Number(id)); }

    @Post(':id/start-first')
    startFirst(@Param('id') id: string) { return this.service.startFirstTask(Number(id)); }

    @Delete(':id')
    remove(@Param('id') id: string) { return this.service.remove(Number(id)); }
}


