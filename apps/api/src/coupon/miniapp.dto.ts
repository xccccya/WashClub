import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';

export class MiniappCouponApplicableItemDto {
	@ApiProperty({ description: '商品ID', example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	productId!: number;

	@ApiProperty({ description: '单价（元）', example: 19.9 })
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	price!: number;

	@ApiProperty({ description: '数量', example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	quantity!: number;
}

export class MiniappCouponApplicableDto {
	@ApiProperty({ description: '用于预计算的商品列表', type: [MiniappCouponApplicableItemDto] })
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => MiniappCouponApplicableItemDto)
	items!: MiniappCouponApplicableItemDto[];
}


