import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddressInputDto {
    @ApiProperty({ description: '省' })
    @IsString()
    @IsNotEmpty()
    province!: string;

    @ApiProperty({ description: '市' })
    @IsString()
    @IsNotEmpty()
    city!: string;

    @ApiProperty({ description: '区' })
    @IsString()
    @IsNotEmpty()
    district!: string;

    @ApiProperty({ description: '街道' })
    @IsString()
    @IsNotEmpty()
    street!: string;

    @ApiProperty({ description: '详细地址' })
    @IsString()
    @IsNotEmpty()
    detail!: string;

    @ApiProperty({ description: '手机号（11位）', example: '13800000000' })
    @IsString()
    @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
    phone!: string;

    @ApiPropertyOptional({ description: '标签（最多4个字）', maxLength: 4, example: '家' })
    @IsOptional()
    @IsString()
    @MaxLength(4)
    label?: string | null;
}

export class AddressMyCreateDto extends AddressInputDto {}

export class AddressMyUpdateDto extends PartialType(AddressInputDto) {}

export class AddressAdminCreateDto {
    @ApiPropertyOptional({ description: '会员ID（不传则需 useGuest=true）' })
    @IsOptional()
    memberId?: number | null;

    @ApiPropertyOptional({ description: '是否使用游客会员' })
    @IsOptional()
    @IsBoolean()
    useGuest?: boolean;

    @ApiProperty({ description: '收货地址输入' })
    @ValidateNested()
    @Type(() => AddressInputDto)
    input!: AddressInputDto;
}

export class AddressAdminUpdateDto extends PartialType(AddressInputDto) {}


