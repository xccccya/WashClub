import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dns from 'node:dns';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
// 不引入额外依赖：使用轻量的原始文本采集中间件处理 v2 XML 回调
import { NotificationGateway } from './notification/notification.gateway.js';
import { NotificationService } from './notification/notification.service.js';

async function bootstrap() {
	// 显式加载 .env（避免在模块导入阶段读取环境变量时，ConfigModule 尚未生效）
	// 兼容两种启动方式：
	// - cwd=/home/WashClub/apps/api（直接在 apps/api 下启动）
	// - cwd=/home/WashClub（从仓库根启动 node apps/api/dist/main.js）
	const envCandidates = [
		resolve(process.cwd(), '.env'),
		resolve(process.cwd(), 'apps/api/.env'),
		resolve(process.cwd(), 'prisma/.env'),
		resolve(process.cwd(), 'apps/api/prisma/.env'),
	];
	for (const p of envCandidates) {
		if (existsSync(p)) dotenvConfig({ path: p });
	}

	// 优先使用 IPv4，避免部分环境 IPv6 连接失败导致 fetch 错误
	try { dns.setDefaultResultOrder('ipv4first'); } catch {}
	// 注意：AppModule 里会 import AuthModule 等模块，而这些模块会在装饰器初始化时读取 env
	// 因此必须在 dotenv 加载后再导入 AppModule
	const { AppModule } = await import('./app.module.js');
	const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
	// 统一 Node 进程时区，影响 dayjs/date-fns 等默认时区行为
	if (!process.env.TZ) process.env.TZ = 'Asia/Shanghai';
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

	// 微信支付 v2 退款通知（XML）：仅对该路径采集原始文本，避免引入额外依赖
	app.use('/orders/_notify/wechat-refund-v2', (req: any, _res, next) => {
		try{
			let data = '';
			req.setEncoding && req.setEncoding('utf8');
			req.on('data', (chunk: string) => { data += chunk; });
			req.on('end', () => { req.rawBody = data; req.body = data; next(); });
		}catch{ next(); }
	});

	const config = new DocumentBuilder()
		.setTitle('Wash Club API')
		.setDescription('API for 一体化洗车门店管理平台')
		.setVersion('1.0.0')
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('/docs', app, document);

	// 静态文件目录 /uploads
	const uploadsDir = join(process.cwd(), 'uploads');
	if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
	app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

	const port = process.env.PORT ? Number(process.env.PORT) : 3000;
	const server = await app.listen(port);
	try { (app.get(NotificationGateway) as any)?.attachServer?.(server); } catch {}
	// 确保通知服务实例化：初始化 BullMQ Worker 与 Redis Pub/Sub 订阅
	try { app.get(NotificationService); } catch {}
	// eslint-disable-next-line no-console
	console.log(`系统自检成功，API 已启动，监听端口：http://localhost:${port}。欢迎使用巨科汽车美容会员系统，祝您使用愉快！`);
}

bootstrap();

