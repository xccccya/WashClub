import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class CartMyAddDto {
	@ApiProperty({ description: '商品ID', example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	productId!: number;

	@ApiPropertyOptional({ description: 'SKU ID（单规格可不传；多规格必传）', nullable: true, example: 10 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	skuId?: number | null;

	@ApiPropertyOptional({ description: '数量（默认 1）', example: 1, default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity?: number;
}

export class CartMyUpdateDto {
	@ApiPropertyOptional({ description: '数量（1-99）', example: 2 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity?: number;

	@ApiPropertyOptional({ description: '是否勾选', example: true })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	checked?: boolean;

	@ApiPropertyOptional({ description: 'SKU ID（传 null 表示清空；仅单规格可清空）', nullable: true, example: 10 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	skuId?: number | null;
}

export class CartToggleAllDto {
	@ApiProperty({ description: '是否全选', example: true })
	@Type(() => Boolean)
	@IsBoolean()
	checked!: boolean;
}


