import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class VehicleAdminListQueryDto {
	@ApiPropertyOptional({ description: '页码（从1开始）', example: 1, default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({ description: '每页条数', example: 20, default: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	pageSize?: number;

	@ApiPropertyOptional({ description: '关键词（车牌/品牌/会员）', example: '川A' })
	@IsOptional()
	@IsString()
	keyword?: string;

	@ApiPropertyOptional({ description: '范围：仅会员车辆/全部', enum: ['member', 'all'], default: 'member' })
	@IsOptional()
	@IsIn(['member', 'all'])
	scope?: 'member' | 'all';

	@ApiPropertyOptional({ description: '兼容旧参数：guest=1 时仅返回游客车辆', example: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	guest?: number;
}

export class VehicleSearchQueryDto {
	@ApiPropertyOptional({ description: '模糊搜索车牌关键字', example: '川A' })
	@IsOptional()
	@IsString()
	q?: string;

	@ApiPropertyOptional({ description: '返回条数限制', example: 15, default: 15 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit?: number;
}

export class VehicleBaseDto {
	@ApiProperty({ description: '车牌号', example: '川A12345' })
	@IsString()
	plateNumber!: string;

	@ApiPropertyOptional({ description: 'VIN（可选）', example: 'LFV2A21K9E0000001', nullable: true })
	@IsOptional()
	@IsString()
	vin?: string | null;

	@ApiPropertyOptional({ description: '品牌（中文名，可选）', example: '大众', nullable: true })
	@IsOptional()
	@IsString()
	brand?: string | null;

	@ApiPropertyOptional({ description: '车系（中文名，可选）', example: '高尔夫', nullable: true })
	@IsOptional()
	@IsString()
	series?: string | null;

	@ApiPropertyOptional({ description: '车型品牌ID（第三方库，可选）', example: 123, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	brandId?: number | null;

	@ApiPropertyOptional({ description: '车型车系ID（第三方库，可选）', example: 456, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	seriesId?: number | null;

	@ApiProperty({ description: '车辆主类', example: 'SUV' })
	@IsString()
	typeMain!: string;

	@ApiPropertyOptional({ description: '车辆子类（可选）', example: '紧凑型SUV', nullable: true })
	@IsOptional()
	@IsString()
	typeSub?: string | null;

	@ApiPropertyOptional({ description: '车辆颜色（可选）', example: '黑色', nullable: true })
	@IsOptional()
	@IsString()
	color?: string | null;

	@ApiPropertyOptional({ description: '是否设为默认车辆', example: false })
	@IsOptional()
	@IsBoolean()
	isDefault?: boolean;
}

export class VehicleCreateForMemberDto extends VehicleBaseDto {}

export class VehicleCreateForMemberByPhoneDto extends VehicleBaseDto {
	@ApiProperty({ description: '会员手机号', example: '13800138000' })
	@IsString()
	phone!: string;
}

export class VehicleUpdateDto {
	@ApiPropertyOptional({ description: '车牌号', example: '川A12345' })
	@IsOptional()
	@IsString()
	plateNumber?: string;

	@ApiPropertyOptional({ description: 'VIN（可选）', example: 'LFV2A21K9E0000001', nullable: true })
	@IsOptional()
	@IsString()
	vin?: string | null;

	@ApiPropertyOptional({ description: '品牌（中文名，可选）', example: '大众', nullable: true })
	@IsOptional()
	@IsString()
	brand?: string | null;

	@ApiPropertyOptional({ description: '车系（中文名，可选）', example: '高尔夫', nullable: true })
	@IsOptional()
	@IsString()
	series?: string | null;

	@ApiPropertyOptional({ description: '车型品牌ID（第三方库，可选）', example: 123, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	brandId?: number | null;

	@ApiPropertyOptional({ description: '车型车系ID（第三方库，可选）', example: 456, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	seriesId?: number | null;

	@ApiPropertyOptional({ description: '车辆主类', example: 'SUV' })
	@IsOptional()
	@IsString()
	typeMain?: string;

	@ApiPropertyOptional({ description: '车辆子类（可选）', example: '紧凑型SUV', nullable: true })
	@IsOptional()
	@IsString()
	typeSub?: string | null;

	@ApiPropertyOptional({ description: '车辆颜色（可选）', example: '黑色', nullable: true })
	@IsOptional()
	@IsString()
	color?: string | null;

	@ApiPropertyOptional({ description: '是否设为默认车辆', example: false })
	@IsOptional()
	@IsBoolean()
	isDefault?: boolean;
}

export class VehicleGuestCreateDto {
	@ApiProperty({ description: '车牌号', example: '川A12345' })
	@IsString()
	plateNumber!: string;

	@ApiPropertyOptional({ description: 'VIN（可选）', example: 'LFV2A21K9E0000001', nullable: true })
	@IsOptional()
	@IsString()
	vin?: string | null;

	@ApiPropertyOptional({ description: '品牌（中文名，可选）', example: '大众', nullable: true })
	@IsOptional()
	@IsString()
	brand?: string | null;

	@ApiPropertyOptional({ description: '车系（中文名，可选）', example: '高尔夫', nullable: true })
	@IsOptional()
	@IsString()
	series?: string | null;

	@ApiPropertyOptional({ description: '车辆主类（可选）', example: 'SUV' })
	@IsOptional()
	@IsString()
	typeMain?: string;

	@ApiPropertyOptional({ description: '车辆子类（可选）', example: '紧凑型SUV', nullable: true })
	@IsOptional()
	@IsString()
	typeSub?: string | null;

	@ApiPropertyOptional({ description: '车辆颜色（可选）', example: '黑色', nullable: true })
	@IsOptional()
	@IsString()
	color?: string | null;
}

export class VehicleMyCreateDto extends VehicleBaseDto {}


