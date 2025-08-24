import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
	async onModuleInit() {
		await this.$connect();
		// 统一数据库会话的时区为 UTC+8（Asia/Shanghai）
		try {
			// 会话级别设置，避免依赖数据库全局配置
			await this.$executeRawUnsafe("SET time_zone = '+08:00'");
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn('[Prisma] SET time_zone +08:00 失败：', error);
		}
	}

	async enableShutdownHooks(app: INestApplication) {
		// @ts-expect-error Prisma types
		this.$on('beforeExit', async () => {
			await app.close();
		});
	}
}


