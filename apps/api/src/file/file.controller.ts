import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors, Query } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service.js';
import multer from 'multer';
import { validateFileSecurity, validateDirectoryName, FILE_SIZE_LIMITS } from './upload.config.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';

@ApiTags('file')
@Controller('file')
export class FileController {
	constructor(private service: FileService) {}

	@Get('list')
	@ApiOperation({ summary: '列出指定目录下的文件（默认public）' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	list(@Query('dir') dir?: string) { return this.service.list(dir || 'public'); }

	@Post('upload')
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	@UseInterceptors(FileInterceptor('file', { 
		storage: multer.memoryStorage(),
		// 允许最大（避免 multer 先于 validateFileSecurity 拦截更大的视频/图片等）
		limits: { fileSize: FILE_SIZE_LIMITS.VIDEO }
	}))
	@ApiConsumes('multipart/form-data')
	@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, dir: { type: 'string' } } } })
	@ApiOperation({ summary: '上传文件到指定目录（默认public）' })
	upload(@UploadedFile() file: any, @Body('dir') dir?: string) {
		if (!file?.buffer || !file?.originalname) throw new BadRequestException('未接收到文件');
		
		// 安全验证：文件安全检查
		const fileValidation = validateFileSecurity(file.buffer, file.originalname, file.mimetype || '');
		if (!fileValidation.isValid) {
			throw new BadRequestException(fileValidation.error || '文件验证失败');
		}

		// 安全验证：目录名检查
		const dirValidation = validateDirectoryName(dir || 'public');
		if (!dirValidation.isValid) {
			throw new BadRequestException(dirValidation.error || '目录名无效');
		}
		
		// 调用原有的文件保存逻辑，保持业务逻辑不变
		const saved = this.service.saveFile(file.buffer, file.originalname, dir || 'public');
		return saved;
	}

	@Delete(':path')
	@ApiOperation({ summary: '删除指定路径文件' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	remove(@Param('path') path: string) { return this.service.remove(decodeURIComponent(path)); }
}


