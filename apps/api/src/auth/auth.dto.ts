import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

const PHONE_PATTERN = /^1\d{10}$/;
const SMS_CODE_PATTERN = /^\d{6}$/;

export class SendCodeDto {
	@ApiProperty({ description: '接收短信的手机号', example: '13800138000' })
	@IsString()
	@Matches(PHONE_PATTERN, { message: '手机号格式不正确' })
	phone!: string;

	@ApiPropertyOptional({ description: '验证码用途', enum: ['login', 'resetPwd'], default: 'login' })
	@IsOptional()
	@IsIn(['login', 'resetPwd'])
	purpose?: 'login' | 'resetPwd';
}

export class ChangePhoneSendCodeDto {
	@ApiProperty({ description: '换号验证阶段', enum: ['old', 'new'] })
	@IsIn(['old', 'new'])
	stage!: 'old' | 'new';

	@ApiPropertyOptional({ description: '新手机号；stage=new 时必填', example: '13900139000' })
	@ValidateIf((dto: ChangePhoneSendCodeDto) => dto.stage === 'new')
	@IsString()
	@IsNotEmpty()
	@Matches(PHONE_PATTERN, { message: '手机号格式不正确' })
	newPhone?: string;
}

export class ChangePhoneDto {
	@ApiProperty({ description: '新手机号', example: '13900139000' })
	@IsString()
	@Matches(PHONE_PATTERN, { message: '手机号格式不正确' })
	newPhone!: string;

	@ApiProperty({ description: '发送到当前手机号的验证码', example: '123456' })
	@IsString()
	@Matches(SMS_CODE_PATTERN, { message: '验证码格式不正确' })
	oldPhoneCode!: string;

	@ApiProperty({ description: '发送到新手机号的验证码', example: '654321' })
	@IsString()
	@Matches(SMS_CODE_PATTERN, { message: '验证码格式不正确' })
	newPhoneCode!: string;
}

export class AuthOkResponseDto {
	@ApiProperty({ example: true })
	ok!: boolean;
}
