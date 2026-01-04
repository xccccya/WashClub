import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBannerDto {
	@ApiPropertyOptional({ description: '可选标题', nullable: true, example: '春节活动' })
	@IsOptional()
	@ValidateIf((_, v) => v !== null)
	@IsString()
	title?: string | null;

	@ApiProperty({ description: '图片 URL（/uploads/...）', example: '/uploads/admin/2026/01/xxx.jpg' })
	@IsString()
	@IsNotEmpty()
	imageUrl!: string;

	@ApiPropertyOptional({ description: '是否启用', default: false, example: false })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '是否开启跳转', default: false, example: false })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	jumpEnabled?: boolean;

	@ApiPropertyOptional({ description: '跳转路径（小程序页面路径）', nullable: true, example: '/pages/washcard/index' })
	@IsOptional()
	@ValidateIf((_, v) => v !== null)
	@IsString()
	linkPath?: string | null;

	@ApiPropertyOptional({ description: '排序权重（越大越靠前）', default: 0, example: 10, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	weight?: number;
}

export class UpdateBannerDto {
	@ApiPropertyOptional({ description: '可选标题', nullable: true, example: '春节活动' })
	@IsOptional()
	@ValidateIf((_, v) => v !== null)
	@IsString()
	title?: string | null;

	@ApiPropertyOptional({ description: '图片 URL（/uploads/...）', example: '/uploads/admin/2026/01/xxx.jpg' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	imageUrl?: string;

	@ApiPropertyOptional({ description: '是否启用', example: true })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '是否开启跳转', example: true })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	jumpEnabled?: boolean;

	@ApiPropertyOptional({ description: '跳转路径（小程序页面路径）', nullable: true, example: '/pages/washcard/index' })
	@IsOptional()
	@ValidateIf((_, v) => v !== null)
	@IsString()
	linkPath?: string | null;

	@ApiPropertyOptional({ description: '排序权重（越大越靠前）', example: 10, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	weight?: number;
}

export class SetBannerEnableDto {
	@ApiPropertyOptional({ description: '是否启用（不传则视为 true，兼容旧行为）', example: true })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	enabled?: boolean;
}


