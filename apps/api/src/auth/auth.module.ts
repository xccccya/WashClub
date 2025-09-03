import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaService } from '../prisma.service.js';
import { SmsService } from './sms.service.js';
import { AdminRoleController } from './role.controller.js';
import { AdminRoleService } from './role.service.js';
import { SmsAdminController } from './sms.controller.js';
import { AdminGuard } from './admin.guard.js';
import { WechatTokenService } from './wechat-token.service.js';
import { MetricsController } from './metrics.controller.js';

@Module({
	imports: [
		JwtModule.register({
			secret: process.env.JWT_SECRET || 'dev_secret',
			signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
		}),
	],
	controllers: [AuthController, AdminRoleController, SmsAdminController, MetricsController],
	providers: [AuthService, AdminRoleService, PrismaService, SmsService, AdminGuard, WechatTokenService],
	exports: [AdminGuard, JwtModule, WechatTokenService],
})
export class AuthModule {}


