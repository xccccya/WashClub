import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';

export class NotificationListQueryDto {
	@ApiPropertyOptional({ description: '状态筛选', enum: ['UNREAD', 'READ'] })
	@IsOptional()
	@IsIn(['UNREAD', 'READ'])
	status?: 'UNREAD' | 'READ';

	@ApiPropertyOptional({ description: '拉取条数，1~200', example: 50 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(200)
	take?: number;

	@ApiPropertyOptional({ description: '跳过条数', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	skip?: number;
}

export class NotificationUnreadCountResponseDto {
	@ApiProperty({ description: '未读数', example: 3 })
	@Type(() => Number)
	@IsInt()
	@Min(0)
	count!: number;
}

export class NotificationMarkReadDto {
	@ApiProperty({ description: '通知ID', example: 1 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	id!: number;
}

export class NotificationTypeSettingDefaultUiDto {
	@ApiPropertyOptional({ description: 'element-plus notification 类型', example: 'primary' })
	@IsOptional()
	@IsString()
	type?: string;

	@ApiPropertyOptional({ description: '弹出位置', example: 'top-right' })
	@IsOptional()
	@IsString()
	position?: string;

	@ApiPropertyOptional({ description: '展示时长(ms)，0 表示不自动关闭', example: 4500 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	duration?: number;
}

export class NotificationUpsertTypeSettingDto {
	@ApiProperty({ description: '类型键', example: 'ORDER_PAID' })
	@IsString()
	typeKey!: string;

	@ApiProperty({ description: '通知通道', enum: ['MEMBER', 'ADMIN', 'WXAPP'] })
	@IsIn(['MEMBER', 'ADMIN', 'WXAPP'])
	channel!: 'MEMBER' | 'ADMIN' | 'WXAPP';

	@ApiPropertyOptional({ description: '是否启用', example: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '无模板回退', example: true })
	@IsOptional()
	@IsBoolean()
	allowFallback?: boolean;

	@ApiPropertyOptional({ description: '默认 UI（仅 ADMIN 通道有意义）', type: () => NotificationTypeSettingDefaultUiDto })
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => NotificationTypeSettingDefaultUiDto)
	defaultUi?: NotificationTypeSettingDefaultUiDto;
}

export class NotificationAdminOverviewQueryDto {
	@ApiPropertyOptional({ description: '开始日期（YYYY-MM-DD 或 ISO 字符串）', example: '2026-01-01' })
	@IsOptional()
	@IsString()
	from?: string;

	@ApiPropertyOptional({ description: '结束日期（YYYY-MM-DD 或 ISO 字符串）', example: '2026-01-31' })
	@IsOptional()
	@IsString()
	to?: string;
}

export class NotificationAdminOverviewListQueryDto {
	@ApiProperty({ description: '消息通道', enum: ['ADMIN', 'MEMBER', 'WXAPP'], example: 'ADMIN' })
	@IsIn(['ADMIN', 'MEMBER', 'WXAPP'])
	channel!: 'ADMIN' | 'MEMBER' | 'WXAPP';

	@ApiPropertyOptional({ description: '站内通知状态筛选（仅 ADMIN/MEMBER）', enum: ['UNREAD', 'READ'] })
	@IsOptional()
	@IsIn(['UNREAD', 'READ'])
	status?: 'UNREAD' | 'READ';

	@ApiPropertyOptional({ description: 'WXAPP 发送结果（仅 WXAPP）', enum: ['SUCCESS', 'FAILED'] })
	@IsOptional()
	@IsIn(['SUCCESS', 'FAILED'])
	result?: 'SUCCESS' | 'FAILED';

	@ApiPropertyOptional({ description: '类型筛选：站内通知为 type；WXAPP 为 typeKey', example: 'ORDER_PAID' })
	@IsOptional()
	@IsString()
	typeKey?: string;

	@ApiPropertyOptional({ description: '关键字：标题/内容/type 等模糊匹配', example: '次卡' })
	@IsOptional()
	@IsString()
	q?: string;

	@ApiPropertyOptional({ description: '会员ID（仅 MEMBER/WXAPP）', example: 1001 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	memberId?: number;

	@ApiPropertyOptional({ description: '开始日期（YYYY-MM-DD 或 ISO 字符串）', example: '2026-01-01' })
	@IsOptional()
	@IsString()
	from?: string;

	@ApiPropertyOptional({ description: '结束日期（YYYY-MM-DD 或 ISO 字符串）', example: '2026-01-31' })
	@IsOptional()
	@IsString()
	to?: string;

	@ApiPropertyOptional({ description: '拉取条数，1~200', example: 20 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(200)
	take?: number;

	@ApiPropertyOptional({ description: '跳过条数', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	skip?: number;
}


