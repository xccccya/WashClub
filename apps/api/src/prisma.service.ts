import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
	constructor() {
		// Prisma ORM v7+ 需要在构造 PrismaClient 时显式提供 adapter 或 accelerateUrl
		// 本项目使用 MySQL，因此采用官方的 MariaDB/MySQL 驱动适配器（mariadb connector）。
		const url = process.env.DATABASE_URL;
		if (!url || !url.trim()) {
			throw new Error('[env] 缺少 DATABASE_URL。请在环境变量或 apps/api/.env 中配置数据库连接串。');
		}
		super({ adapter: new PrismaMariaDb(url) });
	}

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


