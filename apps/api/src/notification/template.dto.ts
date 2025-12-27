import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class NotificationTemplateListQueryDto {
	@ApiPropertyOptional({ description: '关键字（typeKey/title/content 模糊搜索）' })
	@IsOptional()
	@IsString()
	q?: string;

	@ApiPropertyOptional({ description: '通道筛选', enum: ['MEMBER', 'ADMIN', 'WXAPP'] })
	@IsOptional()
	@IsIn(['MEMBER', 'ADMIN', 'WXAPP'])
	channel?: 'MEMBER' | 'ADMIN' | 'WXAPP';
}

export class NotificationTemplateCreateDto {
	@ApiProperty({ description: '类型键', example: 'ORDER_PAID' })
	@IsString()
	typeKey!: string;

	@ApiProperty({ description: '标题模板', example: '订单{{no}}支付成功' })
	@IsString()
	titleTemplate!: string;

	@ApiProperty({ description: '正文模板', example: '您于{{paidAt}}支付{{amount}}元' })
	@IsString()
	contentTemplate!: string;

	@ApiPropertyOptional({ description: '是否启用', example: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: '通道', enum: ['MEMBER', 'ADMIN', 'WXAPP'], default: 'MEMBER' })
	@IsOptional()
	@IsIn(['MEMBER', 'ADMIN', 'WXAPP'])
	channel?: 'MEMBER' | 'ADMIN' | 'WXAPP';

	@ApiPropertyOptional({ description: 'ADMIN 通道：UI 类型', example: 'primary' })
	@IsOptional()
	@IsString()
	uiType?: string | null;

	@ApiPropertyOptional({ description: 'ADMIN 通道：UI 位置', example: 'top-right' })
	@IsOptional()
	@IsString()
	uiPosition?: string | null;

	@ApiPropertyOptional({ description: 'ADMIN 通道：展示时长(ms)', example: 4500 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	uiDuration?: number | null;
}

export class NotificationTemplateUpdateDto {
	@ApiPropertyOptional({ description: '标题模板' })
	@IsOptional()
	@IsString()
	titleTemplate?: string;

	@ApiPropertyOptional({ description: '正文模板' })
	@IsOptional()
	@IsString()
	contentTemplate?: string;

	@ApiPropertyOptional({ description: '是否启用' })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ description: 'ADMIN 通道：UI 类型', example: 'primary' })
	@IsOptional()
	@IsString()
	uiType?: string | null;

	@ApiPropertyOptional({ description: 'ADMIN 通道：UI 位置', example: 'top-right' })
	@IsOptional()
	@IsString()
	uiPosition?: string | null;

	@ApiPropertyOptional({ description: 'ADMIN 通道：展示时长(ms)', example: 4500 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	uiDuration?: number | null;
}

export class NotificationTemplateVariablesQueryDto {
	@ApiPropertyOptional({ description: '模板类型键（不传则返回全部类型变量集合）', example: 'ORDER_PAID' })
	@IsOptional()
	@IsString()
	typeKey?: string;
}


