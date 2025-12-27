import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MemberPointsSaveConfigDto {
	@ApiProperty({ description: '每 1 分(分)获取积分（整数）', example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	pointsPerFen!: number;

	@ApiProperty({ description: '每 1 积分可抵扣金额（分）', example: 50 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	pointsFenPerPoint!: number;

	@ApiProperty({ description: '单笔订单最多抵扣金额（分），0 表示不限', example: 0 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	pointsMaxDeductFenPerOrder!: number;
}

export class MemberPointsAdjustDto {
	@ApiProperty({ description: '会员ID', example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	memberId!: number;

	@ApiProperty({ description: '增减值（可正可负），单位：积分', example: -10 })
	@Type(() => Number)
	@IsInt()
	delta!: number;

	@ApiPropertyOptional({ description: '备注', example: '后台手动调整', nullable: true })
	@IsOptional()
	@IsString()
	remark?: string | null;

	// 兼容历史：如果有客户端传 operatorUserId，仍允许（后端 service 会兜底）
	@ApiPropertyOptional({ description: '操作人管理员ID（可选）', example: 1, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	operatorUserId?: number | null;
}


