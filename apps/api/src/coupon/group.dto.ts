import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CouponGroupCreateDto {
	@ApiProperty({ description: '分组名称', example: '新客福利' })
	@IsString()
	name!: string;

	@ApiPropertyOptional({ description: '备注/描述', example: '仅限首次到店' })
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({ description: '是否启用', example: true, default: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '排序权重（越大越靠前）', example: 0, default: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	weight?: number;
}

export class CouponGroupUpdateDto {
	@ApiPropertyOptional({ description: '分组名称', example: '新客福利' })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({ description: '备注/描述（传 null 表示清空）', example: '仅限首次到店', nullable: true })
	@IsOptional()
	@IsString()
	description?: string | null;

	@ApiPropertyOptional({ description: '是否启用', example: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '排序权重（越大越靠前）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	weight?: number;
}


