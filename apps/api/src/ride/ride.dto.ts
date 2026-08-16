import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsDateString,
	IsEnum,
	IsInt,
	IsLatitude,
	IsLongitude,
	IsNumber,
	IsOptional,
	IsString,
	Length,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

export class RidePointDto {
	@ApiProperty({ example: 104.6688 })
	@IsLongitude()
	longitude!: number;

	@ApiProperty({ example: 29.5274 })
	@IsLatitude()
	latitude!: number;

	@ApiProperty({ example: '四川省内江市威远县中心街' })
	@IsString()
	@Length(1, 191)
	address!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(191)
	poiId?: string;
}

export class RideAvailabilityQueryDto {
	@ApiProperty()
	@Type(() => Number)
	@IsLongitude()
	longitude!: number;

	@ApiProperty()
	@Type(() => Number)
	@IsLatitude()
	latitude!: number;
}

export class RidePlaceQueryDto {
	@ApiProperty()
	@IsString()
	@Length(1, 100)
	keywords!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	city?: string;

	@ApiPropertyOptional({ description: '当前位置经度，用于就近排序' })
	@IsOptional()
	@Type(() => Number)
	@IsLongitude()
	longitude?: number;

	@ApiPropertyOptional({ description: '当前位置纬度，用于就近排序' })
	@IsOptional()
	@Type(() => Number)
	@IsLatitude()
	latitude?: number;
}

export class RideReverseGeocodeQueryDto {
	@ApiProperty()
	@Type(() => Number)
	@IsLongitude()
	longitude!: number;

	@ApiProperty()
	@Type(() => Number)
	@IsLatitude()
	latitude!: number;
}

export class RideRoutePreviewDto {
	@ApiProperty({ type: RidePointDto })
	@ValidateNested()
	@Type(() => RidePointDto)
	origin!: RidePointDto;

	@ApiProperty({ type: RidePointDto })
	@ValidateNested()
	@Type(() => RidePointDto)
	destination!: RidePointDto;
}

export class RideCreateDto extends RideRoutePreviewDto {
	@ApiPropertyOptional({ description: '服务端候选路线索引，从 0 开始', default: 0 })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(2)
	routeIndex?: number;
}

export enum RideDriverStatusDtoValue {
	OFFLINE = 'OFFLINE',
	AVAILABLE = 'AVAILABLE',
	BUSY = 'BUSY',
}

export class RideDriverStatusDto {
	@ApiProperty({ enum: RideDriverStatusDtoValue })
	@IsEnum(RideDriverStatusDtoValue)
	status!: RideDriverStatusDtoValue;
}

export class RideDriverVehicleCreateDto {
	@ApiProperty({ example: '川K12345' })
	@IsString()
	@Length(2, 20)
	plateNumber!: string;

	@ApiProperty({ example: '轿车' })
	@IsString()
	@Length(1, 50)
	typeMain!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	brand?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	series?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	color?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(191)
	brandImage?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(191)
	seriesImage?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(80)
	displayName?: string;
}

export class RideDriverVehicleUpdateDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@Length(2, 20)
	plateNumber?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@Length(1, 50)
	typeMain?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	brand?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	series?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(50)
	color?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(191)
	brandImage?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(191)
	seriesImage?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(80)
	displayName?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	selected?: boolean;
}

export class RideLocationDto {
	@ApiProperty()
	@IsLongitude()
	longitude!: number;

	@ApiProperty()
	@IsLatitude()
	latitude!: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(360)
	heading?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	speedMetersPerSecond?: number;

	@ApiPropertyOptional({ description: '客户端采样时间，ISO 8601' })
	@IsOptional()
	@IsString()
	clientTimestamp?: string;
}

export class RideStartDto {
	@ApiProperty({ example: '1234' })
	@IsString()
	@Length(4, 4)
	phoneLastFour!: string;
}

export class RideArrivalDto {
	@ApiPropertyOptional({ description: '距离目标点超过 500 米时，司机二次确认后传 true' })
	@IsOptional()
	@IsBoolean()
	confirmFarAway?: boolean;
}

export enum RideExtraFeeDtoType {
	PARKING = 'PARKING',
	OTHER = 'OTHER',
}

export class RideExtraFeeInputDto {
	@ApiProperty({ enum: RideExtraFeeDtoType })
	@IsEnum(RideExtraFeeDtoType)
	type!: RideExtraFeeDtoType;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	@Max(999999)
	amount!: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(191)
	remark?: string;
}

export class RideFinalizeDto {
	@ApiProperty()
	@IsInt()
	@Min(0)
	finalDistanceMeters!: number;

	@ApiProperty()
	@IsInt()
	@Min(0)
	finalDurationSeconds!: number;

	@ApiPropertyOptional({ type: [RideExtraFeeInputDto] })
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => RideExtraFeeInputDto)
	extraFees?: RideExtraFeeInputDto[];
}

export class RideCancelDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(191)
	reason?: string;
}

export class RideMessageCreateDto {
	@ApiProperty()
	@IsString()
	@Length(1, 1000)
	content!: string;
}

export class RideSettingUpdateDto {
	@ApiProperty()
	@IsInt()
	@Min(100)
	@Max(100000)
	dispatchRadiusMeters!: number;

	@ApiProperty()
	@IsInt()
	@Min(10)
	@Max(1800)
	dispatchTimeoutSeconds!: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	baseFare!: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	includedDistanceKm!: number;

	@ApiProperty()
	@IsInt()
	@Min(0)
	includedDurationMinutes!: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	pricePerKm!: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	pricePerMinute!: number;

	@ApiProperty()
	@IsNumber()
	@Min(0)
	minimumFare!: number;

	@ApiProperty()
	@IsBoolean()
	allowParkingFee!: boolean;

	@ApiProperty()
	@IsBoolean()
	allowOtherFee!: boolean;

	@ApiProperty()
	@IsInt()
	@Min(1)
	@Max(3650)
	chatRetentionDays!: number;

	@ApiProperty()
	@IsInt()
	@Min(5)
	@Max(60)
	locationIntervalSeconds!: number;
}

export class RideListQueryDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	status?: string;

	@ApiPropertyOptional({ default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({ default: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	pageSize?: number;
}

export class RideAdminListQueryDto extends RideListQueryDto {
	@ApiPropertyOptional({ description: '订单号关键字' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	keyword?: string;

	@ApiPropertyOptional({ description: '乘客姓名或手机号' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	passenger?: string;

	@ApiPropertyOptional({ description: '司机姓名或手机号' })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	driver?: string;

	@ApiPropertyOptional({ description: '创建时间起点（ISO 8601）' })
	@IsOptional()
	@IsDateString()
	startAt?: string;

	@ApiPropertyOptional({ description: '创建时间终点（ISO 8601）' })
	@IsOptional()
	@IsDateString()
	endAt?: string;
}
