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


