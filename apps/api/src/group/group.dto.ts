import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GroupCreateDto {
  @ApiProperty({ description: '集团名称' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '集团图标 URL（可为 null）' })
  @IsOptional()
  @IsString()
  iconUrl?: string | null;

  @ApiProperty({ description: '首位管理员会员ID' })
  @Type(() => Number)
  @IsInt()
  firstAdminMemberId!: number;

  @ApiPropertyOptional({ description: '备注（可为 null）' })
  @IsOptional()
  @IsString()
  remark?: string | null;
}

export class GroupUpdateDto {
  @ApiPropertyOptional({ description: '集团名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '集团图标 URL（传 null 表示清空）' })
  @IsOptional()
  @IsString()
  iconUrl?: string | null;

  @ApiPropertyOptional({ description: '备注（可为 null）' })
  @IsOptional()
  @IsString()
  remark?: string | null;
}

export class GroupAddMembersDto {
  @ApiProperty({ type: [Number], description: '成员会员ID列表' })
  @Type(() => Number)
  @IsArray()
  @IsInt({ each: true })
  memberIds!: number[];
}

export class GroupSetAdminDto {
  @ApiProperty({ description: '是否设为管理员' })
  @IsBoolean()
  isAdmin!: boolean;
}

export class GroupBalanceAdjustDto {
  @ApiProperty({ description: '调账金额（元，可为负）' })
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ description: '备注（可为 null）' })
  @IsOptional()
  @IsString()
  note?: string | null;
}

export class GroupBalanceRechargeDto {
  @ApiProperty({ description: '充值金额（元）' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ description: '备注（可为 null）' })
  @IsOptional()
  @IsString()
  remark?: string | null;

  @ApiProperty({ description: '付款会员ID（集团管理员）' })
  @Type(() => Number)
  @IsInt()
  memberIdForPayment!: number;
}

export class GroupVehicleCreateDto {
  @ApiProperty({ description: '车牌号' })
  @IsString()
  plateNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vin?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  series?: string | null;

  @ApiProperty({ description: '车辆主类型' })
  @IsString()
  typeMain!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typeSub?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brandId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seriesId?: number | null;
}

export class GroupCardCreateDto {
  @ApiPropertyOptional({ description: '卡名称' })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiProperty({ description: '总次数' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalTimes!: number;

  @ApiPropertyOptional({ description: '初始剩余次数（默认等于 totalTimes）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  remainingTimes?: number | null;

  @ApiPropertyOptional({ description: '有效期（ISO 字符串；null/不传 表示永久）' })
  @IsOptional()
  @IsString()
  expiryAt?: string | null;

  @ApiPropertyOptional({ description: '卡号（可选）' })
  @IsOptional()
  @IsString()
  cardNo?: string | null;
}

export class GroupCardAddDto {
  @ApiProperty({ description: '增加次数' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count!: number;

  @ApiPropertyOptional({ description: '备注（可为 null）' })
  @IsOptional()
  @IsString()
  remark?: string | null;
}

export enum GroupCardConsumeReason {
  SERVICE_DEDUCT = 'SERVICE_DEDUCT',
  REFUND_DEDUCT = 'REFUND_DEDUCT',
  BACKEND_DEDUCT = 'BACKEND_DEDUCT',
}

export class GroupCardConsumeDto {
  @ApiProperty({ description: '扣减次数' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  times!: number;

  @ApiPropertyOptional({ enum: GroupCardConsumeReason })
  @IsOptional()
  @IsEnum(GroupCardConsumeReason)
  reason?: GroupCardConsumeReason;

  @ApiPropertyOptional({ description: '服务车辆ID（可为 null）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vehicleId?: number | null;

  @ApiPropertyOptional({ description: '会员ID（可为 null）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  memberId?: number | null;

  @ApiPropertyOptional({ description: '备注（可为 null）' })
  @IsOptional()
  @IsString()
  remark?: string | null;

  @ApiPropertyOptional({ description: '服务订单ID（可为 null）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceOrderId?: number | null;

  @ApiPropertyOptional({ description: '退款记录ID（可为 null）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  refundRecordId?: number | null;

  @ApiPropertyOptional({ description: '购卡订单ID（可为 null）' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  purchaseOrderId?: number | null;
}


