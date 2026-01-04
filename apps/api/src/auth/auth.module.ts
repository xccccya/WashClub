import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaService } from '../prisma.service.js';
import { resolveJwtExpiresInEnv, resolveJwtSecretEnv } from '../env.js';
import { SmsService } from './sms.service.js';
import { AdminRoleController } from './role.controller.js';
import { AdminRoleService } from './role.service.js';
import { SmsAdminController } from './sms.controller.js';
import { AdminGuard } from './admin.guard.js';
import { WechatTokenService } from './wechat-token.service.js';
import { MetricsController } from './metrics.controller.js';
import { FileModule } from '../file/file.module.js';

@Module({
	imports: [
		JwtModule.register({
			secret: resolveJwtSecretEnv(),
			// NestJS 11 的 jsonwebtoken 类型对 expiresIn 更严格（StringValue | number），
			// 但本项目允许通过环境变量传入 '7d'/'15m' 等字符串，这里做一次显式类型收敛。
			signOptions: { expiresIn: resolveJwtExpiresInEnv() as any },
		}),
		FileModule,
	],
	controllers: [AuthController, AdminRoleController, SmsAdminController, MetricsController],
	providers: [AuthService, AdminRoleService, PrismaService, SmsService, AdminGuard, WechatTokenService],
	exports: [AdminGuard, JwtModule, WechatTokenService],
})
export class AuthModule {}


