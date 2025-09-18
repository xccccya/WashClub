import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { IsNotEmpty, IsString, MinLength, IsInt, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class LoginDto {
	@IsString({ message: '请输入手机号' })
	@IsNotEmpty({ message: '请输入手机号' })
	phone!: string;

	@IsString({ message: '请输入密码' })
	@MinLength(6, { message: '密码至少6位' })
	password!: string;
}

class SendCodeDto {
	@IsString()
	@IsNotEmpty()
	phone!: string;

	@IsString()
	@IsOptional()
	@IsIn(['login', 'resetPwd', 'changePhone'])
	purpose?: string; // login=登录/注册，resetPwd=重置密码，changePhone=更换手机号
}

class LoginByCodeDto {
	@IsString()
	@IsNotEmpty()
	phone!: string;

	@IsString()
	@IsNotEmpty()
	code!: string; // 短信验证码
}

class ResetPasswordDto {
	@IsString()
	@IsNotEmpty()
	phone!: string;

	@IsString()
	@IsNotEmpty()
	code!: string;

	@IsString()
	@MinLength(6)
	newPassword!: string;
}

class ChangePhoneByCodeDto {
	@IsString()
	@IsNotEmpty()
	oldPhone!: string;

	@IsString()
	@IsNotEmpty()
	newPhone!: string;

	@IsString()
	@IsNotEmpty()
	code!: string;
}

class ResolvePhoneDto {
	@IsString()
	@IsNotEmpty()
	code!: string;
}

class UpdateNicknameDto {
	@Type(() => Number)
	@IsInt()
	userId!: number;

	@IsString()
	@IsNotEmpty()
	name!: string;
}

class UpdatePasswordDto {
	@Type(() => Number)
	@IsInt()
	userId!: number;

	@IsString()
	@IsNotEmpty()
	oldPassword!: string;

	@IsString()
	@MinLength(6)
	newPassword!: string;
}

class WechatOneTapDto {
	@IsString()
	@IsNotEmpty()
	phoneCode!: string; // 微信手机号组件回调的 code

	@IsString()
	@IsNotEmpty()
	jsCode!: string; // wx.login 的 code
}

class UpdateAdminAvatarDto {
	@Type(() => Number)
	@IsInt()
	userId!: number;

	@IsOptional()
	@IsString()
	avatarUrl?: string | null;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private service: AuthService) {}

	@Post('login')
	@ApiOperation({ summary: '会员登录（账号+密码）' })
	login(@Body() dto: LoginDto) {
		return this.service.loginMemberByPassword(dto.phone, dto.password);
	}

	// 发送短信验证码（登录用途）
	@Post('send-code')
	@ApiOperation({ summary: '发送短信验证码（登录/注册/重置/换号）' })
	sendLoginCode(@Body() dto: SendCodeDto) {
		return this.service.sendLoginCode(dto.phone, dto.purpose);
	}

	// 短信验证码登录
	@Post('login/code')
	@ApiOperation({ summary: '短信验证码登录/注册' })
	loginByCode(@Body() dto: LoginByCodeDto) {
		return this.service.loginMemberByCode(dto.phone, dto.code);
	}

	// 重置会员密码（通过短信验证码）
	@Post('reset-password')
	@ApiOperation({ summary: '重置会员密码（短信验证码）' })
	resetPassword(@Body() dto: ResetPasswordDto) {
		return this.service.resetMemberPasswordByCode(dto.phone, dto.code, dto.newPassword);
	}

	// 短信验证码更换会员手机号（用途 purpose: changePhone）
	@Post('change-phone')
	@ApiOperation({ summary: '更换会员手机号（短信验证码）' })
	changePhone(@Body() dto: ChangePhoneByCodeDto) {
		return this.service.changeMemberPhoneByCode(dto.oldPhone, dto.newPhone, dto.code);
	}

	// 通过微信实时手机号能力返回的 code 获取纯手机号
	@Post('wechat/resolve-phone')
	@ApiOperation({ summary: '微信手机号组件 code 换取手机号' })
	resolvePhone(@Body() dto: ResolvePhoneDto) {
		return this.service.resolvePhoneByWechatCode(dto.code);
	}

	// 微信一键登录：手机号快速验证 + wx.login 获取 openid
	@Post('wechat/one-tap')
	@ApiOperation({ summary: '微信一键登录（手机号校验 + openid）' })
	wechatOneTap(@Body() dto: WechatOneTapDto) {
		if (!dto?.phoneCode || !dto?.jsCode) throw new BadRequestException('缺少必要参数');
		return this.service.wechatOneTapLogin({ phoneCode: dto.phoneCode, jsCode: dto.jsCode });
	}

	@Post('admin/login')
	@ApiOperation({ summary: '管理员登录（账号+密码）' })
	adminLogin(@Body() dto: LoginDto) {
		return this.service.loginAdminByPassword(dto.phone, dto.password);
	}

	@Post('admin/update-nickname')
	@ApiOperation({ summary: '管理员修改昵称' })
	updateAdminNickname(@Body() dto: UpdateNicknameDto) {
		return this.service.updateAdminNickname(Number(dto.userId), dto.name);
	}

	@Post('admin/update-password')
	@ApiOperation({ summary: '管理员修改密码' })
	updateAdminPassword(@Body() dto: UpdatePasswordDto) {
		return this.service.updateAdminPassword(Number(dto.userId), dto.oldPassword, dto.newPassword);
	}

	@Post('admin/update-avatar')
	@ApiOperation({ summary: '管理员更换头像' })
	updateAdminAvatar(@Body() dto: UpdateAdminAvatarDto) {
		return this.service.updateAdminAvatar(Number(dto.userId), dto.avatarUrl ?? null);
	}
}


