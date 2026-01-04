import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { NoticeType } from './scroll-notice.service.js';

export class CreateScrollNoticeDto {
	@ApiProperty({ description: '通知类型', enum: ['home', 'store'], example: 'home' })
	@IsString()
	@IsNotEmpty()
	@IsIn(['home', 'store'])
	type!: NoticeType;

	@ApiProperty({ description: '通知内容', example: '欢迎回到巨科汽车美容～' })
	@IsString()
	@IsNotEmpty()
	content!: string;

	@ApiPropertyOptional({ description: '是否立即启用', default: false, example: false })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	enabled?: boolean;
}

export class UpdateScrollNoticeDto {
	@ApiPropertyOptional({ description: '通知内容', example: '今日特惠：洗车立减 10 元' })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	content?: string;

	@ApiPropertyOptional({ description: '是否启用', example: true })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	enabled?: boolean;
}


