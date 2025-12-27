import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
	@ApiProperty({ description: '会员ID（绑定员工档案）' })
	memberId!: number;

	@ApiPropertyOptional({ description: '员工姓名（可为空）', nullable: true })
	name?: string | null;

	@ApiPropertyOptional({ description: '职务（可为空）', nullable: true })
	title?: string | null;

	@ApiPropertyOptional({ description: '是否启用', default: true })
	enabled?: boolean;
}

export class UpdateEmployeeDto {
	@ApiPropertyOptional({ description: '员工姓名（可为空）', nullable: true })
	name?: string | null;

	@ApiPropertyOptional({ description: '职务（可为空）', nullable: true })
	title?: string | null;

	@ApiPropertyOptional({ description: '是否启用' })
	enabled?: boolean;
}


