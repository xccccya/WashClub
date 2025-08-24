import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors, Query } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service.js';
import multer from 'multer';

@ApiTags('file')
@Controller('file')
export class FileController {
	constructor(private service: FileService) {}

	@Get('list')
	list(@Query('dir') dir?: string) { return this.service.list(dir || 'public'); }

	@Post('upload')
	@UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
	@ApiConsumes('multipart/form-data')
	@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, dir: { type: 'string' } } } })
	upload(@UploadedFile() file: any, @Body('dir') dir?: string) {
		if (!file?.buffer || !file?.originalname) throw new BadRequestException('未接收到文件');
		const saved = this.service.saveFile(file.buffer, file.originalname, dir || 'public');
		return saved;
	}

	@Delete(':path')
	remove(@Param('path') path: string) { return this.service.remove(decodeURIComponent(path)); }
}


