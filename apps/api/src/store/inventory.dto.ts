import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StoreInventoryAdjustDto {
	@ApiProperty({ description: '商品ID', example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	productId!: number;

	@ApiPropertyOptional({ description: 'SKU ID（多规格时传）', example: 10, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	skuId?: number | null;

	@ApiProperty({ description: '变更数量（入库/出库为正数，调整可正可负）', example: 5 })
	@Type(() => Number)
	@IsInt()
	change!: number;

	@ApiProperty({ description: '原因', example: 'INBOUND' })
	@IsString()
	reason!: string;

	@ApiPropertyOptional({ description: '备注', example: '盘点修正', nullable: true })
	@IsOptional()
	@IsString()
	remark?: string | null;
}


