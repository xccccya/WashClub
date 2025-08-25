import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class AppController {
	@Get('/health')
	@ApiOperation({ summary: '健康检查' })
	@ApiOkResponse({ description: 'ok' })
	health() {
		return { ok: true, service: 'api', ts: Date.now() };
	}
}


