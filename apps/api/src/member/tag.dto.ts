import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateMemberTagDto {
	@ApiProperty({ description: '标签名称' })
	@IsString()
	name!: string;
}

export class UpdateMemberTagDto {
	@ApiPropertyOptional({ description: '标签名称' })
	@IsOptional()
	@IsString()
	name?: string;
}


