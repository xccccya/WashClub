import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { AssetService } from './asset.service.js';
import { getAutoTags } from './auto-tag.config.js';
import type { Response } from 'express';

@ApiTags('assets')
@Controller('assets')
export class AssetController {
	constructor(private service: AssetService) {}

	@Get()
	@ApiOperation({ summary: '文件资产分页查询' })
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
	detail(@Param('id') id: string) { return this.service.detail(id); }

	@Patch(':id')
	@ApiOperation({ summary: '更新文件元数据（重命名/公开性/标签）' })
	update(@Param('id') id: string, @Body() body: any) {
		return this.service.update(id, { filename: body.filename, isPublic: body.isPublic, tags: body.tags });
	}

	@Delete(':id')
	@ApiOperation({ summary: '删除文件（软删；存在引用时禁止）' })
	remove(@Param('id') id: string) { return this.service.remove(id); }

	@Post('upload')
	@UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
	@ApiConsumes('multipart/form-data')
	@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, dir: { type: 'string' }, tags: { type: 'string' }, source: { type: 'string' } } } })
	@ApiOperation({ summary: '上传文件（去重；返回资产；支持自动标签）' })
	upload(@UploadedFile() file: any, @Body('dir') dir?: string, @Body('tags') tagsStr?: string, @Body('source') source?: string) {
		if (!file?.buffer || !file?.originalname) throw new BadRequestException('未接收到文件');
		
		// 解析手动指定的标签
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
		
		// 获取自动标签
		const autoTags = getAutoTags(dir, source);
		
		// 合并手动标签和自动标签，去重
		const allTags = Array.from(new Set([...manualTags, ...autoTags]));
		
		return this.service.upload(file.buffer, file.originalname, file.mimetype, dir || 'public', allTags.length > 0 ? allTags : undefined);
	}

	@Get(':id/references')
	@ApiOperation({ summary: '查看文件引用列表' })
	listRef(@Param('id') id: string) { return this.service.listReferences(id); }

	@Get(':id/thumbnail')
	@ApiOperation({ summary: '获取缩略图（图片重定向）' })
	async thumb(@Param('id') id: string, @Query('size') size: string | undefined, @Res() res: Response) { const { url } = await this.service.getThumbnailUrl(id, Number(size||240)); return res.redirect(url); }

	@Post(':id/thumbnails')
	@ApiOperation({ summary: '生成缩略图（占位：仅回显待生成尺寸）' })
	genThumbs(@Param('id') id: string, @Body('sizes') sizes?: number[]) { return this.service.ensureThumbnails(id, Array.isArray(sizes)&&sizes.length? sizes: [120,240,480]); }

	@Post('thumbnails/bulk')
	@ApiOperation({ summary: '批量预热缩略图（生成常用尺寸）' })
	bulkThumbs(@Body('ids') ids: string[], @Body('sizes') sizes?: number[]) { return this.service.bulkEnsureThumbnails(Array.isArray(ids)? ids: [], Array.isArray(sizes)&&sizes.length? sizes: [120,240,480]); }

	@Post('thumbnails/cleanup')
	@ApiOperation({ summary: '清理变体缩略图并重置 variants' })
	cleanup(@Body('ids') ids?: string[]) { return this.service.cleanupVariants(Array.isArray(ids)? ids: []); }

	@Post(':id/bindings')
	@ApiOperation({ summary: '绑定业务引用' })
	bind(@Param('id') id: string, @Body() body: any) {
		if (!body?.tableName || !body?.rowId || !body?.fieldName) throw new BadRequestException('缺少必要参数');
		return this.service.bindReference(id, { tableName: body.tableName, rowId: body.rowId, fieldName: body.fieldName });
	}

	@Delete(':id/bindings/:bid')
	@ApiOperation({ summary: '解绑业务引用' })
	unBind(@Param('id') id: string, @Param('bid') bid: string) { return this.service.unbindReference(id, bid); }
}


