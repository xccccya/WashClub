import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	// Mode B: export from build output (dist) to keep runtime behavior consistent.
	const distAppModulePath = path.resolve(__dirname, '../dist/app.module.js');
	if (!fs.existsSync(distAppModulePath)) {
		throw new Error(
			`Missing build output: ${distAppModulePath}\n` +
			`Please run: pnpm -F WashClubAPI run build`,
		);
	}

	const { AppModule } = await import(pathToFileURL(distAppModulePath).href);

	// Create Nest app in-memory (no listen); generate Swagger document and write to openapi.json.
	const app = await NestFactory.create(AppModule, { logger: false });
	const config = new DocumentBuilder()
		.setTitle('Wash Club API')
		.setDescription('API for 一体化洗车门店管理平台')
		.setVersion('1.0.0')
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, config);

	const out = path.resolve(__dirname, '../openapi.json');
	fs.writeFileSync(out, JSON.stringify(document, null, 2), 'utf8');
	// eslint-disable-next-line no-console
	console.log('OpenAPI generated at', out);

	try { await app.close(); } catch {}

	// Some modules create timers/Redis connections on init which keep the event loop alive.
	// This is a build-time script; force exit to avoid hanging CI/terminals.
	setTimeout(() => process.exit(0), 0);
}

main().catch((e) => {
	// eslint-disable-next-line no-console
	console.error(e);
	process.exit(1);
});


