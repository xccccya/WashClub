import { Body, Controller, Post, BadRequestException, ForbiddenException, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { AdminGuard } from './admin.guard.js';
import { AdminMeDto } from './role.dto.js';
import { RequirePerm } from './perm.decorator.js';
import { AdminOrMemberGuard } from './admin-or-member.guard.js';
import { AuthOkResponseDto, ChangePhoneDto, ChangePhoneSendCodeDto, SendCodeDto } from './auth.dto.js';

class LoginDto {
	@ApiProperty({ description: '手机号', example: '13800138000' })
	@IsString({ message: '请输入手机号' })
	@IsNotEmpty({ message: '请输入手机号' })
	phone!: string;

	@ApiProperty({ description: '密码（至少6位）', example: '123456' })
	@IsString({ message: '请输入密码' })
	@MinLength(6, { message: '密码至少6位' })
	password!: string;
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

class ResolvePhoneDto {
	@IsString()
	@IsNotEmpty()
	code!: string;
}

class UpdateNicknameDto {
	@IsString()
	@IsNotEmpty()
	name!: string;
}

class UpdatePasswordDto {
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
	@IsOptional()
	@IsString()
	avatarUrl?: string | null;
}

interface MemberAuthenticatedRequest {
	user?: {
		kind?: string;
		id?: number | string;
		memberId?: number | string;
	};
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(private service: AuthService) {}

	private requireMemberId(req: MemberAuthenticatedRequest): number {
		if (req?.user?.kind !== 'member') throw new ForbiddenException('仅会员可操作');
		const memberId = Number(req.user.memberId);
		if (!Number.isFinite(memberId) || memberId <= 0) throw new ForbiddenException('会员身份无效');
		return memberId;
	}

	@Post('login')
	@ApiOperation({ summary: '会员登录（账号+密码）' })
	login(@Body() dto: LoginDto) {
		return this.service.loginMemberByPassword(dto.phone, dto.password);
	}

	// 发送短信验证码（登录用途）
	@Post('send-code')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: '发送短信验证码（登录/注册/重置密码）' })
	@ApiOkResponse({ type: AuthOkResponseDto })
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

	@Post('change-phone/send-code')
	@HttpCode(HttpStatus.OK)
	@UseGuards(AdminOrMemberGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: '发送更换手机号验证码（当前手机号或新手机号）' })
	@ApiOkResponse({ type: AuthOkResponseDto })
	@ApiUnauthorizedResponse({ description: '未登录或登录已过期' })
	@ApiForbiddenResponse({ description: '当前身份不是会员' })
	sendChangePhoneCode(@Req() req: MemberAuthenticatedRequest, @Body() dto: ChangePhoneSendCodeDto) {
		return this.service.sendChangePhoneCode(this.requireMemberId(req), dto.stage, dto.newPhone);
	}

	// 必须同时验证当前手机号和新手机号；会员身份只从 Bearer token 推导。
	@Post('change-phone')
	@HttpCode(HttpStatus.OK)
	@UseGuards(AdminOrMemberGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: '更换会员手机号（双短信验证码）' })
	@ApiOkResponse({ type: AuthOkResponseDto })
	@ApiUnauthorizedResponse({ description: '登录或验证码无效' })
	@ApiForbiddenResponse({ description: '当前身份不是会员' })
	changePhone(@Req() req: MemberAuthenticatedRequest, @Body() dto: ChangePhoneDto) {
		return this.service.changeMemberPhoneByCode(this.requireMemberId(req), dto.newPhone, dto.oldPhoneCode, dto.newPhoneCode);
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
	@UseGuards(AdminGuard)
	@RequirePerm('admin-self')
	updateAdminNickname(@Req() req: any, @Body() dto: UpdateNicknameDto) {
		const userId = Number(req?.user?.id || 0);
		if (!userId) throw new BadRequestException('未登录');
		return this.service.updateAdminNickname(userId, dto.name);
	}

	@Post('admin/update-password')
	@ApiOperation({ summary: '管理员修改密码' })
	@UseGuards(AdminGuard)
	@RequirePerm('admin-self')
	updateAdminPassword(@Req() req: any, @Body() dto: UpdatePasswordDto) {
		const userId = Number(req?.user?.id || 0);
		if (!userId) throw new BadRequestException('未登录');
		return this.service.updateAdminPassword(userId, dto.oldPassword, dto.newPassword);
	}

	@Post('admin/update-avatar')
	@ApiOperation({ summary: '管理员更换头像' })
	@UseGuards(AdminGuard)
	@RequirePerm('admin-self')
	updateAdminAvatar(@Req() req: any, @Body() dto: UpdateAdminAvatarDto) {
		const userId = Number(req?.user?.id || 0);
		if (!userId) throw new BadRequestException('未登录');
		return this.service.updateAdminAvatar(userId, dto.avatarUrl ?? null);
	}

	@Get('admin/me')
	@UseGuards(AdminGuard)
	@ApiOperation({ summary: '管理员登录态校验（验签）' })
	@ApiOkResponse({ type: AdminMeDto })
	@RequirePerm('admin-self')
	adminMe(@Req() req: any) {
		return req.user || null;
	}
}


