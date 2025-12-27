import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

export class StoreProductSpecPairDto {
	@ApiPropertyOptional({ description: '规格名', example: '颜色' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	name?: string;

	@ApiPropertyOptional({ description: '规格值', example: '黑色' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	value?: string;
}

export class StoreProductSkuUpsertDto {
	@ApiPropertyOptional({ description: 'SKU ID（更新时传；创建时不传）', example: 10 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	id?: number;

	@ApiPropertyOptional({ description: 'SKU 名称（可不传，服务端会根据 specsJson 生成默认名）', example: '黑色/大号' })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;

	@ApiPropertyOptional({ description: 'SKU 编码（可不传，服务端会生成）', example: 'P1-Sxxx' })
	@IsOptional()
	@IsString()
	@MaxLength(80)
	skuCode?: string;

	@ApiPropertyOptional({ description: '条码（可为空）', nullable: true, example: '6901234567890' })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	barcode?: string | null;

	@ApiPropertyOptional({ description: 'SKU 图片 URL/相对路径（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	imageUrl?: string | null;

	@ApiPropertyOptional({ description: '价格', example: 19.9 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	price?: number;

	@ApiPropertyOptional({ description: '划线价', example: 29.9 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	listPrice?: number;

	@ApiPropertyOptional({ description: '库存（服务商品会被服务端归零）', example: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	stockQuantity?: number;

	@ApiPropertyOptional({ description: '是否启用', example: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '绑定卡券ID（虚拟卡券商品用，可为空）', nullable: true, example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	couponId?: number | null;

	@ApiPropertyOptional({ description: 'SKU 规格值列表', type: () => [StoreProductSpecPairDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StoreProductSpecPairDto)
	specsJson?: StoreProductSpecPairDto[] | null;
}

export class StoreProductSpecsDefinitionItemDto {
	@ApiProperty({ description: '规格项名称', example: '颜色' })
	@IsString()
	@MaxLength(50)
	name!: string;

	@ApiProperty({ description: '规格值列表', example: ['黑色', '白色'] })
	@IsArray()
	@IsString({ each: true })
	values!: string[];
}

export class StoreProductCreateDto {
	@ApiProperty({ description: '商品类型', enum: ['SERVICE', 'PHYSICAL', 'VIRTUAL_CARD'] })
	@IsIn(['SERVICE', 'PHYSICAL', 'VIRTUAL_CARD'])
	type!: 'SERVICE' | 'PHYSICAL' | 'VIRTUAL_CARD';

	@ApiProperty({ description: '商品名称', example: '精洗' })
	@IsString()
	@MaxLength(120)
	name!: string;

	@ApiPropertyOptional({ description: '条码（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	barcode?: string | null;

	@ApiPropertyOptional({ description: '分类ID（可为空）', nullable: true, example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	categoryId?: number | null;

	@ApiPropertyOptional({ description: '主图 URL/相对路径', nullable: true })
	@IsOptional()
	@IsString()
	imageUrl?: string | null;

	@ApiPropertyOptional({ description: '商品图片列表（首张建议与 imageUrl 一致）', type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	imagesJson?: string[] | null;

	@ApiPropertyOptional({ description: '排序权重（越大越靠前）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	sortWeight?: number;

	@ApiPropertyOptional({ description: '是否上架', example: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '商品介绍 HTML', nullable: true })
	@IsOptional()
	@IsString()
	description?: string | null;

	@ApiPropertyOptional({ description: '是否允许积分抵扣', example: false })
	@IsOptional()
	@IsBoolean()
	pointsDeductible?: boolean;

	@ApiPropertyOptional({ description: '是否参与会员折扣', example: false })
	@IsOptional()
	@IsBoolean()
	memberDiscount?: boolean;

	@ApiProperty({ description: '规格类型', enum: ['SINGLE', 'MULTI'] })
	@IsIn(['SINGLE', 'MULTI'])
	specType!: 'SINGLE' | 'MULTI';

	@ApiPropertyOptional({ description: '单规格价格（specType=SINGLE 时）', example: 19.9, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	price?: number | null;

	@ApiPropertyOptional({ description: '单规格划线价（specType=SINGLE 时）', example: 29.9, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	listPrice?: number | null;

	@ApiPropertyOptional({ description: '单规格库存（specType=SINGLE 且 type!=SERVICE 时）', example: 100, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	stockQuantity?: number | null;

	@ApiPropertyOptional({ description: '初始销量（用于展示叠加）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	initialSales?: number;

	@ApiPropertyOptional({ description: '卖点', example: '到店即洗' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	sellPoint?: string;

	@ApiPropertyOptional({ description: '绑定卡券ID（虚拟卡券商品用）', nullable: true, example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	couponId?: number | null;

	@ApiPropertyOptional({ description: '是否计为洗车（次）（服务商品用）', example: false })
	@IsOptional()
	@IsBoolean()
	isCarWash?: boolean;

	@ApiPropertyOptional({ description: '允许快递（实物商品用）', example: true })
	@IsOptional()
	@IsBoolean()
	shipAllowExpress?: boolean;

	@ApiPropertyOptional({ description: '允许到店自提（实物商品用）', example: true })
	@IsOptional()
	@IsBoolean()
	shipAllowPickup?: boolean;

	@ApiPropertyOptional({ description: '多规格：规格项定义', type: () => [StoreProductSpecsDefinitionItemDto], nullable: true })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StoreProductSpecsDefinitionItemDto)
	specsDefinitionJson?: StoreProductSpecsDefinitionItemDto[] | null;

	@ApiPropertyOptional({ description: '多规格：SKU 列表', type: () => [StoreProductSkuUpsertDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StoreProductSkuUpsertDto)
	skus?: StoreProductSkuUpsertDto[];
}

export class StoreProductUpdateDto {
	@ApiPropertyOptional({ description: '商品类型（一般不建议修改）', enum: ['SERVICE', 'PHYSICAL', 'VIRTUAL_CARD'] })
	@IsOptional()
	@IsIn(['SERVICE', 'PHYSICAL', 'VIRTUAL_CARD'])
	type?: 'SERVICE' | 'PHYSICAL' | 'VIRTUAL_CARD';

	@ApiPropertyOptional({ description: '商品名称', example: '精洗' })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	name?: string;

	@ApiPropertyOptional({ description: '条码（传空字符串会被服务端归一化为 null）', nullable: true })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	barcode?: string | null;

	@ApiPropertyOptional({ description: '分类ID（传 null 断开）', nullable: true, example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	categoryId?: number | null;

	@ApiPropertyOptional({ description: '主图 URL/相对路径（传 null 清空）', nullable: true })
	@IsOptional()
	@IsString()
	imageUrl?: string | null;

	@ApiPropertyOptional({ description: '商品图片列表（传 null 清空）', type: () => [String], nullable: true })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	imagesJson?: string[] | null;

	@ApiPropertyOptional({ description: '排序权重', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	sortWeight?: number;

	@ApiPropertyOptional({ description: '是否上架', example: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '商品介绍 HTML', nullable: true })
	@IsOptional()
	@IsString()
	description?: string | null;

	@ApiPropertyOptional({ description: '是否允许积分抵扣', example: false })
	@IsOptional()
	@IsBoolean()
	pointsDeductible?: boolean;

	@ApiPropertyOptional({ description: '是否参与会员折扣', example: false })
	@IsOptional()
	@IsBoolean()
	memberDiscount?: boolean;

	@ApiPropertyOptional({ description: '规格类型', enum: ['SINGLE', 'MULTI'] })
	@IsOptional()
	@IsIn(['SINGLE', 'MULTI'])
	specType?: 'SINGLE' | 'MULTI';

	@ApiPropertyOptional({ description: '单规格价格', example: 19.9, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	price?: number | null;

	@ApiPropertyOptional({ description: '单规格划线价', example: 29.9, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	listPrice?: number | null;

	@ApiPropertyOptional({ description: '单规格库存', example: 100, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	stockQuantity?: number | null;

	@ApiPropertyOptional({ description: '初始销量', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	initialSales?: number;

	@ApiPropertyOptional({ description: '卖点', example: '到店即洗' })
	@IsOptional()
	@IsString()
	@MaxLength(200)
	sellPoint?: string;

	@ApiPropertyOptional({ description: '绑定卡券ID（传 null 断开）', nullable: true, example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	couponId?: number | null;

	@ApiPropertyOptional({ description: '是否计为洗车（次）', example: false })
	@IsOptional()
	@IsBoolean()
	isCarWash?: boolean;

	@ApiPropertyOptional({ description: '允许快递（实物商品）', example: true })
	@IsOptional()
	@IsBoolean()
	shipAllowExpress?: boolean;

	@ApiPropertyOptional({ description: '允许到店自提（实物商品）', example: true })
	@IsOptional()
	@IsBoolean()
	shipAllowPickup?: boolean;

	@ApiPropertyOptional({ description: '多规格：规格项定义（传 null 清空）', type: () => [StoreProductSpecsDefinitionItemDto], nullable: true })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StoreProductSpecsDefinitionItemDto)
	specsDefinitionJson?: StoreProductSpecsDefinitionItemDto[] | null;

	@ApiPropertyOptional({ description: '多规格：SKU 列表（用于新增/修改/下架；不传则不改 SKU）', type: () => [StoreProductSkuUpsertDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => StoreProductSkuUpsertDto)
	skus?: StoreProductSkuUpsertDto[];
}


