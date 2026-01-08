import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmployeeDto {
	@ApiProperty({ description: '会员ID（绑定员工档案）' })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	memberId!: number;

	@ApiPropertyOptional({ description: '员工姓名（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	name?: string | null;

	@ApiPropertyOptional({ description: '职务（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	title?: string | null;

	@ApiPropertyOptional({ description: '是否启用', default: true })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;
}

export class UpdateEmployeeDto {
	@ApiPropertyOptional({ description: '员工姓名（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	name?: string | null;

	@ApiPropertyOptional({ description: '职务（可为空）', nullable: true })
	@IsOptional()
	@IsString()
	title?: string | null;

	@ApiPropertyOptional({ description: '是否启用' })
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;
}


