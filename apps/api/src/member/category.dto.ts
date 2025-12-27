import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateMemberCategoryDto {
	@ApiProperty({ description: '分类名称' })
	@IsString()
	name!: string;

	@ApiProperty({ description: '权重（数字越大越靠前）', example: 0 })
	@Type(() => Number)
	@IsInt()
	weight!: number;
}

export class UpdateMemberCategoryDto {
	@ApiPropertyOptional({ description: '分类名称' })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({ description: '权重（数字越大越靠前）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	weight?: number;
}


