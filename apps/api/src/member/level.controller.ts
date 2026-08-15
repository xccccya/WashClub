import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberLevelService } from './level.service.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('member-level')
@Controller('member-level')
export class MemberLevelController {
  constructor(private service: MemberLevelService) {}

  @Get()
  @ApiOperation({ summary: '会员等级列表' })
  list() { return this.service.list(); }

  @Post()
	@UseGuards(AdminGuard)
	@RequirePerm('member-levels')
	@ApiBearerAuth()
  @ApiOperation({ summary: '创建会员等级' })
  create(@Body() body: { name: string; level?: number; requiredGrowth?: number; description?: string | null; iconUrl?: string | null; pointsMultiplier?: number; payDiscountPercent?: number; isDefault?: boolean }) { return this.service.create(body); }

  @Put(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('member-levels')
	@ApiBearerAuth()
  @ApiOperation({ summary: '更新会员等级' })
  update(@Param('id') id: string, @Body() body: { name?: string; level?: number; requiredGrowth?: number; description?: string | null; iconUrl?: string | null; pointsMultiplier?: number; payDiscountPercent?: number; isDefault?: boolean }) {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
	@UseGuards(AdminGuard)
	@RequirePerm('member-levels')
	@ApiBearerAuth()
  @ApiOperation({ summary: '删除会员等级' })
  remove(@Param('id') id: string) { return this.service.remove(Number(id)); }

  // 成长值换算配置：每元=多少成长值
  @Get('_growth-config')
	@UseGuards(AdminGuard)
	@RequirePerm('member-levels')
	@ApiBearerAuth()
  @ApiOperation({ summary: '获取成长值换算配置' })
  getGrowthConfig() { return this.service.getGrowthConfig(); }

  @Post('_growth-config')
	@UseGuards(AdminGuard)
	@RequirePerm('member-levels')
	@ApiBearerAuth()
  @ApiOperation({ summary: '保存成长值换算配置' })
  saveGrowthConfig(@Body() body: { growthPerYuan: number }) { return this.service.saveGrowthConfig(Number(body?.growthPerYuan||1)); }
}


