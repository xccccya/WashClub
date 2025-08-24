import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simplified: in real use, use NestFactory + SwaggerModule to emit JSON
// Here we only place a minimal OpenAPI file so that codegen works initially
const openapi = {
	openapi: '3.0.3',
	info: { title: 'Wash Club API', version: '0.1.0' },
	paths: {
		'/health': {
			get: {
				summary: 'Health check',
				responses: { '200': { description: 'ok' } },
			},
		},
		'/content/notices': {
			get: { summary: 'List notices', parameters: [{ in: 'query', name: 'type', schema: { type: 'string', enum: ['home','store'] } }], responses: { '200': { description: 'ok' } } },
			post: { summary: 'Create notice', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string' }, content: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['type','content'] } } } }, responses: { '200': { description: 'ok' } } },
		},
		'/content/notices/{id}': {
			put: { summary: 'Update notice', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { content: { type: 'string' }, enabled: { type: 'boolean' } } } } } }, responses: { '200': { description: 'ok' } } },
			delete: { summary: 'Delete notice', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'ok' } } },
		},
		'/content/notices/{id}/enable': {
			post: { summary: 'Enable notice', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'ok' } } },
		},
		'/content/notices/active': {
			get: { summary: 'Get active by type', parameters: [{ in: 'query', name: 'type', required: true, schema: { type: 'string', enum: ['home','store'] } }], responses: { '200': { description: 'ok' } } },
		},
	},
};

const out = path.resolve(__dirname, '../openapi.json');
fs.writeFileSync(out, JSON.stringify(openapi, null, 2));
console.log('OpenAPI generated at', out);


