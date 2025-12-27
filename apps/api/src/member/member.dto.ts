import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, NotEquals } from 'class-validator';

export class CreateMemberDto {
	@ApiProperty({ description: '昵称（≤10字符）' })
	@IsString()
	name!: string;

	@ApiProperty({ description: '手机号', example: '13800138000' })
	@IsString()
	phone!: string;

	@ApiPropertyOptional({ description: '初始密码（可选）' })
	@IsOptional()
	@IsString()
	password?: string;

	@ApiPropertyOptional({ description: '积分（可选）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	points?: number;

	@ApiPropertyOptional({ description: '余额（可选）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	balance?: number;

	@ApiProperty({ description: '会员等级ID' })
	@Type(() => Number)
	@IsInt()
	levelId!: number;

	@ApiProperty({ description: '会员分类ID' })
	@Type(() => Number)
	@IsInt()
	categoryId!: number;

	@ApiPropertyOptional({ description: '标签ID列表（可选）', type: [Number] })
	@IsOptional()
	@IsArray()
	@Type(() => Number)
	tagIds?: number[];

	@ApiPropertyOptional({ description: '头像URL（可选）', nullable: true })
	@IsOptional()
	@IsString()
	avatarUrl?: string | null;
}

export class UpdateMemberDto {
	@ApiPropertyOptional({ description: '昵称（≤10字符）' })
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({ description: '手机号', example: '13800138000' })
	@IsOptional()
	@IsString()
	phone?: string;

	@ApiPropertyOptional({ description: '密码（可选）' })
	@IsOptional()
	@IsString()
	password?: string;

	@ApiPropertyOptional({ description: '积分（可选）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	points?: number;

	@ApiPropertyOptional({ description: '余额（可选）', example: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	balance?: number;

	@ApiPropertyOptional({ description: '会员等级ID（可选）', nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	levelId?: number | null;

	@ApiPropertyOptional({ description: '会员分类ID（可选）', nullable: true })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	categoryId?: number | null;

	@ApiPropertyOptional({ description: '标签ID列表（可选）', type: [Number] })
	@IsOptional()
	@IsArray()
	@Type(() => Number)
	tagIds?: number[];

	@ApiPropertyOptional({ description: '头像URL（可选）', nullable: true })
	@IsOptional()
	@IsString()
	avatarUrl?: string | null;
}

export class SetMemberPasswordDto {
	@ApiProperty({ description: '新密码' })
	@IsString()
	password!: string;
}

export class AdjustMemberGrowthDto {
	@ApiProperty({ description: '变更值（可正可负，非0）', example: 10 })
	@Type(() => Number)
	@IsInt()
	@NotEquals(0)
	delta!: number;

	@ApiPropertyOptional({ description: '备注（必填，前端会校验）', nullable: true })
	@IsOptional()
	@IsString()
	remark?: string | null;
}


