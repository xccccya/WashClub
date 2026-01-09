import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	Matches,
	ValidateNested,
} from 'class-validator';

export class SystemBusinessHoursDto {
	@ApiPropertyOptional({ description: '营业开始时间（HH:mm）', example: '09:00' })
	@IsOptional()
	@IsString()
	@Matches(/^\d{2}:\d{2}$/)
	start?: string;

	@ApiPropertyOptional({ description: '营业结束时间（HH:mm）', example: '18:00' })
	@IsOptional()
	@IsString()
	@Matches(/^\d{2}:\d{2}$/)
	end?: string;
}

export class SystemSiteSettingSaveDto {
	@ApiPropertyOptional({ description: '站点标题', example: 'WashClub 管理后台' })
	@IsOptional()
	@IsString()
	@MaxLength(60)
	title?: string;

	@ApiPropertyOptional({ type: String, description: '站点Logo URL/相对路径', nullable: true, example: '/uploads/public/logo.png' })
	@IsOptional()
	@IsString()
	logoUrl?: string | null;

	@ApiPropertyOptional({ description: '背景类型', enum: ['bing', 'image'], example: 'bing' })
	@IsOptional()
	@IsIn(['bing', 'image'])
	bgType?: 'bing' | 'image';

	@ApiPropertyOptional({ type: String, description: '背景图片 URL/相对路径（bgType=image 时）', nullable: true, example: '/uploads/public/bg.png' })
	@IsOptional()
	@IsString()
	bgImageUrl?: string | null;

	@ApiPropertyOptional({ type: String, description: '默认会员头像 URL/相对路径', nullable: true, example: '/uploads/public/default-avatar.png' })
	@IsOptional()
	@IsString()
	defaultMemberAvatarUrl?: string | null;

	@ApiPropertyOptional({ description: '每消费 1 元获得的成长值（>=1）', example: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	growthPerYuan?: number;

	@ApiPropertyOptional({ description: '营业时间配置', type: () => SystemBusinessHoursDto, nullable: true })
	@IsOptional()
	@ValidateNested()
	@Type(() => SystemBusinessHoursDto)
	businessHoursJson?: SystemBusinessHoursDto | null;

	@ApiPropertyOptional({ description: '是否手动设置为忙碌', example: false })
	@IsOptional()
	@IsBoolean()
	busyEnabled?: boolean;

	@ApiPropertyOptional({ description: '是否手动暂停营业', example: false })
	@IsOptional()
	@IsBoolean()
	pausedEnabled?: boolean;
}

export class SystemBusinessSettingSaveDto {
	@ApiPropertyOptional({ description: '营业时间配置', type: () => SystemBusinessHoursDto, nullable: true })
	@IsOptional()
	@ValidateNested()
	@Type(() => SystemBusinessHoursDto)
	businessHoursJson?: SystemBusinessHoursDto | null;

	@ApiPropertyOptional({ description: '是否手动设置为忙碌', example: false })
	@IsOptional()
	@IsBoolean()
	busyEnabled?: boolean;

	@ApiPropertyOptional({ description: '是否手动暂停营业', example: false })
	@IsOptional()
	@IsBoolean()
	pausedEnabled?: boolean;
}

export class SystemMiniappTermsSaveDto {
	@ApiPropertyOptional({ type: String, description: '小程序用户协议 HTML（完整文本）', nullable: true, example: '<!doctype html><html>...</html>' })
	@IsOptional()
	@IsString()
	html?: string | null;
}


