import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMemberCouponExpiryDto {
	@ApiPropertyOptional({ description: '开始时间（ISO字符串）', nullable: true })
	@IsOptional()
	@IsString()
	startAt?: string | null;

	@ApiPropertyOptional({ description: '结束时间（ISO字符串）', nullable: true })
	@IsOptional()
	@IsString()
	endAt?: string | null;
}


