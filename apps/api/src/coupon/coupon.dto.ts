import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum CouponType {
  COUPON = 'COUPON',
  WASH_CARD = 'WASH_CARD',
  GROUP_WASH_CARD = 'GROUP_WASH_CARD',
}

export enum CouponExpiryType {
  FIXED = 'FIXED',
  AFTER_RECEIVE = 'AFTER_RECEIVE',
  PERMANENT = 'PERMANENT',
}

export enum CouponApplyScope {
  ALL = 'ALL',
  SPECIFIED = 'SPECIFIED',
}

export class CouponUpsertDto {
  @ApiProperty({ enum: CouponType })
  @IsEnum(CouponType)
  type!: CouponType;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '分组ID；不分组可传 null' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: CouponExpiryType })
  @IsOptional()
  @IsEnum(CouponExpiryType)
  expiryType?: CouponExpiryType;

  @ApiPropertyOptional({ description: '固定时间：开始时间（ISO 字符串）' })
  @IsOptional()
  @IsString()
  startAt?: string | null;

  @ApiPropertyOptional({ description: '固定时间：结束时间（ISO 字符串）' })
  @IsOptional()
  @IsString()
  endAt?: string | null;

  @ApiPropertyOptional({ description: '领取后生效：有效天数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  validDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminRemark?: string | null;

  // ========= COUPON 专属 =========

  @ApiPropertyOptional({ description: '券面值（元）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  faceValue?: number | null;

  @ApiPropertyOptional({ description: '最低订单额（元）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minOrderAmount?: number | null;

  @ApiPropertyOptional({ description: '发行总数（null 不限）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  issueTotal?: number | null;

  @ApiPropertyOptional({ description: '每人限领（null 不限）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  perMemberLimit?: number | null;

  @ApiPropertyOptional({ enum: CouponApplyScope })
  @IsOptional()
  @IsEnum(CouponApplyScope)
  applyScope?: CouponApplyScope;

  @ApiPropertyOptional({ type: [Number], description: '指定商品ID列表（applyScope=SPECIFIED 时使用）' })
  @IsOptional()
  @Type(() => Number)
  @IsArray()
  @IsInt({ each: true })
  applicableProductIds?: number[];

  @ApiPropertyOptional({ type: Object, description: '规则 JSON（高级）。如 { kind: \"direct\", amount: 5 }' })
  @IsOptional()
  @IsObject()
  ruleJson?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowMiniappClaim?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowCombine?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowStackWithPoints?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowStackWithMemberDiscount?: boolean;

  // ========= WASH_CARD / GROUP_WASH_CARD =========

  @ApiPropertyOptional({ description: '计次卡总次数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalTimes?: number;
}

export class CouponCreateDto extends CouponUpsertDto {}

export class CouponUpdateDto extends CouponUpsertDto {}

export class CouponIssueDto {
  @ApiProperty({ description: '会员ID' })
  @Type(() => Number)
  @IsInt()
  memberId!: number;

  @ApiPropertyOptional({ description: '发放张数，默认 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count?: number;
}


