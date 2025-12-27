import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StoreCategoryCreateDto {
	@ApiProperty({ description: '分类名称', example: '洗车用品' })
	@IsString()
	name!: string;

	@ApiPropertyOptional({ description: '分类图片URL（可为相对路径）', example: '/uploads/public/xxx.png' })
	@IsOptional()
	@IsString()
	imageUrl?: string;

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

export class StoreCategoryUpdateDto {
	@ApiPropertyOptional({ description: '分类名称', example: '洗车用品' })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({ description: '分类图片URL（传 null 表示清空）', example: '/uploads/public/xxx.png', nullable: true })
	@IsOptional()
	@IsString()
	imageUrl?: string | null;

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


