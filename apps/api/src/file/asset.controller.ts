import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors, Res } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { AssetService } from './asset.service.js';
import { getAutoTags } from './auto-tag.config.js';
import { validateFileSecurity, validateDirectoryName, FILE_SIZE_LIMITS } from './upload.config.js';
import type { Response } from 'express';
import { AssetBindDto, AssetBulkThumbsDto, AssetCleanupDto, AssetGenThumbsDto, UpdateAssetDto } from './asset.dto.js';
import { AdminGuard } from '../auth/admin.guard.js';
import { RequirePerm } from '../auth/perm.decorator.js';
import { AdminOrMemberGuard } from '../auth/admin-or-member.guard.js';

@ApiTags('assets')
@Controller('assets')
export class AssetController {
	constructor(private service: AssetService) {}

	@Get()
	@ApiOperation({ summary: '文件资产分页查询' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	list(
		@Query('page') page?: string,
		@Query('pageSize') pageSize?: string,
		@Query('mimeType') mimeType?: string,
		@Query('q') q?: string,
		@Query('tag') tag?: string,
		@Query('tags') tags?: string | string[],
	) {
		let tagsArr: string[] | undefined = undefined;
		if (Array.isArray(tags)) tagsArr = tags.filter((s) => !!s).map((s) => String(s));
		else if (typeof tags === 'string') tagsArr = tags.includes(',') ? tags.split(',').map((s) => s.trim()).filter(Boolean) : [tags];
		return this.service.list({ page: Number(page), pageSize: Number(pageSize), mimeType, q, tag, tags: tagsArr });
	}

	@Get(':id')
	@ApiOperation({ summary: '文件详情' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	detail(@Param('id') id: string) { return this.service.detail(id); }

	@Patch(':id')
	@ApiOperation({ summary: '更新文件元数据（重命名/公开性/标签）' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	update(@Param('id') id: string, @Body() body: UpdateAssetDto) {
		return this.service.update(id, { filename: body.filename, isPublic: body.isPublic, tags: body.tags });
	}

	@Delete(':id')
	@ApiOperation({ summary: '删除文件（软删；存在引用时禁止）' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	remove(@Param('id') id: string) { return this.service.remove(id); }

	@Post('upload')
	@UseGuards(AdminOrMemberGuard)
	@UseInterceptors(FileInterceptor('file', { 
		storage: multer.memoryStorage(),
		// 允许最大（避免 multer 先于 validateFileSecurity 拦截更大的视频/图片等）
		limits: { fileSize: FILE_SIZE_LIMITS.VIDEO }
	}))
	@ApiConsumes('multipart/form-data')
	@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, dir: { type: 'string' }, tags: { type: 'string' }, source: { type: 'string' } } } })
	@ApiOperation({ summary: '上传文件（去重；返回资产；支持自动标签）' })
	upload(@UploadedFile() file: any, @Body('dir') dir?: string, @Body('tags') tagsStr?: string, @Body('source') source?: string, @Req() req?: any) {
		if (!file?.buffer || !file?.originalname) throw new BadRequestException('未接收到文件');
		
		// 安全验证：文件安全检查
		const fileValidation = validateFileSecurity(file.buffer, file.originalname, file.mimetype || '');
		if (!fileValidation.isValid) {
			throw new BadRequestException(fileValidation.error || '文件验证失败');
		}

		// 安全验证：目录名检查
		const finalDir = dir || 'public';
		const dirValidation = validateDirectoryName(finalDir);
		if (!dirValidation.isValid) {
			throw new BadRequestException(dirValidation.error || '目录名无效');
		}

		// member 目录权限：只允许白名单目录（避免 member 上传到 admin/system 等目录）
		const userKind = String(req?.user?.kind || '');
		if (userKind === 'member') {
			const allowedMemberDirs = new Set(['miniapp', 'avatar']);
			if (!allowedMemberDirs.has(finalDir)) {
				throw new ForbiddenException('无权限上传到该目录');
			}
		}
		
		// 解析手动指定的标签（保持原有逻辑）
		let manualTags: string[] = [];
		if (tagsStr) {
			try {
				// 支持JSON数组格式或逗号分隔格式
				manualTags = tagsStr.startsWith('[') ? JSON.parse(tagsStr) : tagsStr.split(',').map(s => s.trim()).filter(Boolean);
			} catch {
				// 如果解析失败，作为单个标签处理
				manualTags = [tagsStr.trim()].filter(Boolean);
			}
		}
		
		// 获取自动标签（保持原有逻辑）
		const autoTags = getAutoTags(finalDir, source);
		
		// 合并手动标签和自动标签，去重（保持原有逻辑）
		const allTags = Array.from(new Set([...manualTags, ...autoTags]));
		
		// 调用原有的上传逻辑，保持业务逻辑不变
		return this.service.upload(file.buffer, file.originalname, file.mimetype, finalDir, allTags.length > 0 ? allTags : undefined);
	}

	@Get(':id/references')
	@ApiOperation({ summary: '查看文件引用列表' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	listRef(@Param('id') id: string) { return this.service.listReferences(id); }

	@Get(':id/thumbnail')
	@ApiOperation({ summary: '获取缩略图（图片重定向）' })
	async thumb(@Param('id') id: string, @Query('size') size: string | undefined, @Res() res: Response) {
		// 注意：该接口用于 <img src="..."> 预览，浏览器无法附带 Bearer token；
		// 所以这里不做后台鉴权，但也不允许“未授权触发生成”——仅返回已存在缩略图，否则回退原图。
		const { url } = await this.service.getThumbnailUrl(id, Number(size || 240), { generateIfMissing: false });
		return res.redirect(url);
	}

	@Post(':id/thumbnails')
	@ApiOperation({ summary: '生成缩略图（占位：仅回显待生成尺寸）' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	genThumbs(@Param('id') id: string, @Body() body: AssetGenThumbsDto) {
		const sizes = body?.sizes;
		return this.service.ensureThumbnails(id, Array.isArray(sizes)&&sizes.length? sizes: [120,240,480]);
	}

	@Post('thumbnails/bulk')
	@ApiOperation({ summary: '批量预热缩略图（生成常用尺寸）' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	bulkThumbs(@Body() body: AssetBulkThumbsDto) {
		const ids = body?.ids;
		const sizes = body?.sizes;
		return this.service.bulkEnsureThumbnails(Array.isArray(ids)? ids: [], Array.isArray(sizes)&&sizes.length? sizes: [120,240,480]);
	}

	@Post('thumbnails/cleanup')
	@ApiOperation({ summary: '清理变体缩略图并重置 variants' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	cleanup(@Body() body: AssetCleanupDto) {
		const ids = body?.ids;
		return this.service.cleanupVariants(Array.isArray(ids)? ids: []);
	}

	@Post(':id/bindings')
	@ApiOperation({ summary: '绑定业务引用' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	bind(@Param('id') id: string, @Body() body: AssetBindDto) {
		if (!body?.tableName || !body?.rowId || !body?.fieldName) throw new BadRequestException('缺少必要参数');
		return this.service.bindReference(id, { tableName: body.tableName, rowId: body.rowId, fieldName: body.fieldName });
	}

	@Delete(':id/bindings/:bid')
	@ApiOperation({ summary: '解绑业务引用' })
	@UseGuards(AdminGuard)
	@RequirePerm('system-files' as any)
	unBind(@Param('id') id: string, @Param('bid') bid: string) { return this.service.unbindReference(id, bid); }

	@Get('system/status')
	@ApiOperation({ summary: '获取文件系统状态和改进清单' })
	async getSystemStatus() {
		return {
			version: '2.0.0',
			uptime: Math.floor(process.uptime()),
			uploadsPath: '/uploads',
			features: [
				'安全文件上传验证',
				'自动文件去重',
				'异步缩略图生成',
				'引用计数管理',
				'软删除保护',
				'事务一致性保证'
			],
			improvements: [
				'修复了竞态条件问题',
				'增强了错误处理机制',
				'添加了文件安全验证',
				'优化了性能和内存使用',
				'改善了类型安全'
			]
		};
	}
}


