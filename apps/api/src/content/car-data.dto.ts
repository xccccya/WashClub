import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CarBrandDto {
	@ApiProperty({ example: 1 })
	brand_id!: number;

	@ApiProperty({ example: '示例品牌' })
	brand_name!: string;

	@ApiPropertyOptional({ description: '品牌图片 URL' })
	img?: string;
}

export class CarBrandGroupDto {
	@ApiProperty({ example: 1 })
	main_brand_id!: number;

	@ApiProperty({ example: '示例品牌集团' })
	main_brand_name!: string;

	@ApiProperty({ example: 'S' })
	letter!: string;

	@ApiPropertyOptional({ description: '品牌集团图片 URL' })
	img?: string;

	@ApiProperty({ type: () => [CarBrandDto] })
	brand_list!: CarBrandDto[];
}

export class CarSeriesDto {
	@ApiProperty({ example: 1001 })
	series_id!: number;

	@ApiProperty({ example: '示例车系' })
	series_name!: string;

	@ApiPropertyOptional({ description: '车型级别，例如紧凑型车' })
	scale?: string;

	@ApiPropertyOptional({ description: '车系图片 URL' })
	img?: string;
}

export class CarSeriesQueryDto {
	@ApiProperty({ description: '车型品牌 ID', minimum: 1, example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	brandId!: number;
}
