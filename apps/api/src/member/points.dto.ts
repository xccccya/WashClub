import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class MemberPointsSaveConfigDto {
	@ApiProperty({ description: '每 1 元获取积分（整数）', example: 10 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	pointsPerYuan!: number;

	// 兼容旧字段：历史上用 pointsPerFen（每 1 分获取积分）
	// 仍允许客户端提交，但后端会忽略该字段（或仅作为 pointsPerYuan 的兜底来源）。
	@ApiPropertyOptional({ description: '【兼容】每 1 分获取积分（整数，旧字段）', example: 1, nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	pointsPerFen?: number | null;

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

export class MemberPointsAdminLogsPagedQueryDto {
	@ApiPropertyOptional({ description: '页码（从1开始）', example: 1, default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({ description: '每页条数（1~100）', example: 20, default: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	pageSize?: number;

	@ApiPropertyOptional({ description: '会员ID（精确）', example: 1001 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	memberId?: number;

	@ApiPropertyOptional({ description: '来源筛选', enum: ['PAY', 'ADMIN', 'REFUND', 'USE'] })
	@IsOptional()
	@IsIn(['PAY', 'ADMIN', 'REFUND', 'USE'])
	source?: 'PAY' | 'ADMIN' | 'REFUND' | 'USE';

	@ApiPropertyOptional({ description: '订单号（模糊匹配）', example: 'WC202601' })
	@IsOptional()
	@IsString()
	orderNo?: string;

	@ApiPropertyOptional({ description: '关键词（会员ID/UID/昵称/手机号模糊匹配）', example: '13800138000' })
	@IsOptional()
	@IsString()
	keyword?: string;

	@ApiPropertyOptional({ description: '开始时间（ISO 或 YYYY-MM-DD）', example: '2026-01-01' })
	@IsOptional()
	@IsString()
	from?: string;

	@ApiPropertyOptional({ description: '结束时间（ISO 或 YYYY-MM-DD）', example: '2026-01-31' })
	@IsOptional()
	@IsString()
	to?: string;
}


