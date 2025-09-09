import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { Prisma } from '@prisma/client';
import { FileService } from './file.service.js';
import { FileBindingUtil } from './file-binding.util.js';
import crypto from 'node:crypto';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { existsSync, unlinkSync } from 'node:fs';

export type UploadResult = {
	id: string;
	url: string;
	checksumSha256: string;
	filename: string;
	mimeType: string;
	size: number;
	objectKey: string;
	storage: string;
};

export type ListQuery = {
	page?: number;
	pageSize?: number;
	mimeType?: string;
	q?: string;
	tag?: string;
	tags?: string[];
};

@Injectable()
export class AssetService {
	private fileBindingUtil: FileBindingUtil;

	constructor(private prisma: PrismaService, private fileService: FileService) {
		this.fileBindingUtil = new FileBindingUtil(prisma);
	}

	private async computeSha256(buffer: Buffer) {
		return crypto.createHash('sha256').update(buffer).digest('hex');
	}

	async upload(buffer: Buffer, originalName: string, mimeType?: string, dir?: string, autoTags?: string[]): Promise<UploadResult> {
		if (!buffer?.length || !originalName) throw new BadRequestException('未接收到文件');
		const checksum = await this.computeSha256(buffer);
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const existed = await prisma.fileAsset.findUnique({ where: { checksumSha256: checksum } });
		if (existed && !existed.deletedAt) {
			return {
				id: existed.id,
				url: existed.url,
				checksumSha256: existed.checksumSha256,
				filename: existed.filename,
				mimeType: existed.mimeType,
				size: existed.size,
				objectKey: existed.objectKey,
				storage: existed.storage,
			};
		}

		const saved = this.fileService.saveFile(buffer, originalName, dir || 'public');
		const tags = Array.isArray(autoTags) && autoTags.length > 0 ? autoTags : null;
		const created = await prisma.fileAsset.create({
			data: {
				filename: originalName,
				extension: extname(originalName || '').toLowerCase().replace(/^\./, ''),
				mimeType: mimeType || 'application/octet-stream',
				size: saved.size,
				checksumSha256: checksum,
				storage: 'local',
				bucket: null,
				objectKey: saved.path,
				url: saved.url,
				isPublic: true,
				tagsJson: tags,
				variants: null,
				extra: null,
			},
		});
		return {
			id: created.id,
			url: created.url,
			checksumSha256: created.checksumSha256,
			filename: created.filename,
			mimeType: created.mimeType,
			size: created.size,
			objectKey: created.objectKey,
			storage: created.storage,
		};
	}

	async list(query: ListQuery) {
		const page = Math.max(1, Number(query.page) || 1);
		const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
		const offset = (page - 1) * pageSize;
		const conds: string[] = ['deletedAt IS NULL'];
		const vals: any[] = [];
		if (query.mimeType) { conds.push('mimeType LIKE ?'); vals.push(query.mimeType.includes('/') ? `${query.mimeType}%` : `%${query.mimeType}%`); }
		if (query.q) { conds.push('filename LIKE ?'); vals.push(`%${query.q}%`); }
		if (query.tag) { conds.push('tagsJson IS NOT NULL AND JSON_CONTAINS(tagsJson, JSON_ARRAY(?))'); vals.push(query.tag); }
		if (Array.isArray(query.tags) && query.tags.length) {
			for (const t of query.tags) { conds.push('tagsJson IS NOT NULL AND JSON_CONTAINS(tagsJson, JSON_ARRAY(?))'); vals.push(t); }
		}
		const where = conds.join(' AND ');
		const countSql = `SELECT COUNT(1) AS c FROM FileAsset WHERE ${where}`;
		const listSql = `SELECT id, filename, extension, mimeType, size, url, objectKey, storage, createdAt, refCount, tagsJson FROM FileAsset WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
		const [countRow]: any = await (this.prisma as any).$queryRawUnsafe(countSql, ...vals);
		const total = Number(countRow?.c || 0);
		const items = await (this.prisma as any).$queryRawUnsafe(listSql, ...vals, pageSize, offset);
		return { page, pageSize, total, items };
	}

	async detail(id: string) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
		if (!file) throw new NotFoundException('文件不存在');
		return file;
	}

	async update(id: string, data: { filename?: string; isPublic?: boolean; tags?: string[] }) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
		if (!file) throw new NotFoundException('文件不存在');
		return prisma.fileAsset.update({
			where: { id },
			data: {
				filename: data.filename ?? file.filename,
				isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : file.isPublic,
				tagsJson: Array.isArray(data.tags) ? data.tags : file.tagsJson,
			},
		});
	}

	async remove(id: string) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
		if (!file) throw new NotFoundException('文件不存在');
		
		// 使用绑定工具检查是否可以删除
		const canDelete = await this.fileBindingUtil.canDeleteFile(id);
		if (!canDelete) throw new ForbiddenException('文件已被引用，无法删除');
		
		return prisma.fileAsset.update({ where: { id }, data: { deletedAt: new Date() } });
	}

	async listReferences(id: string) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id } });
		if (!file) throw new NotFoundException('文件不存在');
		return this.fileBindingUtil.getFileReferences(id);
	}

	async bindReference(id: string, binding: { tableName: string; rowId: string; fieldName: string }) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
		if (!file) throw new NotFoundException('文件不存在');
		const created = await prisma.$transaction(async (txRaw) => {
			const tx = txRaw as unknown as PrismaWithAssets;
			const b = await tx.fileBinding.create({ data: { fileId: id, tableName: binding.tableName, rowId: binding.rowId, fieldName: binding.fieldName } });
			await tx.fileAsset.update({ where: { id }, data: { refCount: { increment: 1 } as any } });
			return b;
		});
		return created;
	}

	async unbindReference(id: string, bindingId: string) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
		if (!file) throw new NotFoundException('文件不存在');
		await prisma.$transaction(async (txRaw) => {
			const tx = txRaw as unknown as PrismaWithAssets;
			await tx.fileBinding.delete({ where: { id: bindingId } });
			await tx.fileAsset.update({ where: { id }, data: { refCount: { decrement: 1 } as any } });
		});
		return { ok: true };
	}

	// 缩略图生成：支持图片缩略图生成，非图片返回原图
	async getThumbnailUrl(id: string, size: number = 240) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
		if (!file) throw new NotFoundException('文件不存在');
		
		// 非图片直接返回原图
		if (!/^image\//i.test(file.mimeType)) return { url: file.url };
		
		// 检查是否已存在缓存的变体
		try { 
			const variants = (file as any).variants || null; 
			const key = String(size); 
			const url = variants?.[key]; 
			if (url) {
				// 验证文件是否还存在
				const uploadsRoot = join(process.cwd(), 'uploads');
				const variantPath = join(uploadsRoot, url.replace(/^\/uploads\//, ''));
				if (existsSync(variantPath)) {
					return { url };
				}
			}
		} catch {}
		
		// 生成新的缩略图
		const uploadsRoot = join(process.cwd(), 'uploads');
		const srcAbs = join(uploadsRoot, file.objectKey);
		
		// 检查源文件是否存在
		if (!existsSync(srcAbs)) {
			console.warn(`源文件不存在: ${srcAbs}`);
			return { url: file.url };
		}
		
		const ext = (file.extension || '').toLowerCase() || 'jpg';
		// 修复路径处理，统一使用正斜杠
		const targetKey = file.objectKey.replace(/\.(\w+)$/, (_m, g1) => `_thumb_${size}.${g1 || ext}`);
		const targetAbs = join(uploadsRoot, targetKey);
		
		try {
			// 确保目标目录存在
			const targetDir = join(targetAbs, '..');
			if (!existsSync(targetDir)) {
				require('fs').mkdirSync(targetDir, { recursive: true });
			}
			
			await sharp(srcAbs)
				.resize({ 
					width: size, 
					height: size, 
					fit: 'inside', 
					withoutEnlargement: true 
				})
				.jpeg({ quality: 85 }) // 统一输出为JPEG格式
				.toFile(targetAbs);
			
			// 统一使用正斜杠的URL
			const url = `/uploads/${targetKey.replace(/\\/g, '/')}`;
			const nextVariants = { ...((file as any).variants || {}), [String(size)]: url } as any;
			await prisma.fileAsset.update({ where: { id }, data: { variants: nextVariants } });
			return { url };
		} catch (error) {
			console.error(`缩略图生成失败 (${id}, ${size}):`, error);
			return { url: file.url };
		}
	}

	// 触发缩略图生成（占位实现）
	async ensureThumbnails(id: string, sizes: number[] = [120, 240, 480]) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const file = await prisma.fileAsset.findFirst({ where: { id, deletedAt: null } });
		if (!file) throw new NotFoundException('文件不存在');
		// 占位：后续接入队列，这里仅返回待生成尺寸列表
		return { scheduled: sizes };
	}

	async bulkEnsureThumbnails(ids: string[], sizes: number[] = [120,240,480]) {
		const ok: string[] = [];
		for (const id of ids) {
			try { await this.getThumbnailUrl(id, sizes[0] || 240); ok.push(id); } catch {}
		}
		return { okCount: ok.length };
	}

	async cleanupVariants(ids?: string[]) {
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const where: any = { deletedAt: null };
		if (Array.isArray(ids) && ids.length) where.id = { in: ids };
		const list = await prisma.fileAsset.findMany({ where });
		const uploadsRoot = join(process.cwd(), 'uploads');
		let removedFiles = 0, updatedRows = 0;
		for (const f of list) {
			try {
				const variants = (f as any).variants || {};
				for (const key of Object.keys(variants)) {
					const url: string = variants[key];
					const rel = url.replace(/^\/uploads\//, '').split('?')[0];
					const abs = join(uploadsRoot, rel);
					if (existsSync(abs)) { try { unlinkSync(abs); removedFiles++; } catch {} }
				}
				await prisma.fileAsset.update({ where: { id: f.id }, data: { variants: null } });
				updatedRows++;
			} catch {}
		}
		return { removedFiles, updatedRows };
	}
}

// 临时类型兼容：在类型生成器未即时识别新模型时，显式声明所需委托
type PrismaWithAssets = PrismaService & {
	fileAsset: any;
	fileBinding: any;
	$transaction: any;
};


