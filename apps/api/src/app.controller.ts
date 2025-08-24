import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
	@Get('/health')
	@ApiOkResponse({ description: 'ok' })
	health() {
		return { ok: true, service: 'api', ts: Date.now() };
	}
}


