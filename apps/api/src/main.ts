import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dns from 'node:dns';

async function bootstrap() {
	// 优先使用 IPv4，避免部分环境 IPv6 连接失败导致 fetch 错误
	try { dns.setDefaultResultOrder('ipv4first'); } catch {}
	const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
	// 统一 Node 进程时区，影响 dayjs/date-fns 等默认时区行为
	if (!process.env.TZ) process.env.TZ = 'Asia/Shanghai';
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

	const config = new DocumentBuilder()
		.setTitle('Wash Club API')
		.setDescription('API for 一体化洗车门店管理平台')
		.setVersion('0.1.0')
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('/docs', app, document);

	// 静态文件目录 /uploads
	const uploadsDir = join(process.cwd(), 'uploads');
	if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
	app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

	const port = process.env.PORT ? Number(process.env.PORT) : 3000;
	await app.listen(port);
	// eslint-disable-next-line no-console
	console.log(`API listening on http://localhost:${port}`);
}

bootstrap();

