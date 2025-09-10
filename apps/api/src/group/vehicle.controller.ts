import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { GroupVehicleService } from './vehicle.service.js';

@ApiTags('GroupVehicle')
@Controller('group/:id/vehicles')
@UseGuards(AdminGuard)
export class GroupVehicleController {
  constructor(private service: GroupVehicleService) {}

  @Get('')
  @RequirePerm('group-vehicles' as any)
  list(
    @Param('id', ParseIntPipe) id: number,
    @Query('keyword') keyword?: string,
    @Query('source') source?: 'all'|'group'|'member',
    @Query('typeMain') typeMain?: string,
    @Query('sortBy') sortBy?: 'createdAt'|'updatedAt'|'plateNumber'|'brand'|'typeMain',
    @Query('sortOrder') sortOrder?: 'asc'|'desc',
  ) {
    return this.service.list(id, { keyword: keyword || undefined, source, typeMain: typeMain || undefined, sortBy, sortOrder });
  }

  @Post('')
  @RequirePerm('group-vehicles' as any)
  @ApiOperation({ summary: '为集团新增车辆（直绑集团）' })
  create(@Param('id', ParseIntPipe) id: number, @Body() body: { plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain: string; typeSub?: string | null; color?: string | null; brandId?: number | null; seriesId?: number | null }) {
    if (!body?.plateNumber) throw new BadRequestException('缺少车牌号');
    if (!body?.typeMain) throw new BadRequestException('缺少车辆主类型');
    return this.service.create(id, body);
  }

  @Delete(':vehicleId')
  @RequirePerm('group-vehicles' as any)
  remove(@Param('id', ParseIntPipe) id: number, @Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.service.remove(id, vehicleId);
  }
}
