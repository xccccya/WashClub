import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { Prisma } from '@prisma/client';
import { FileService } from './file.service.js';
import { FileBindingUtil } from './file-binding.util.js';
import { ThumbnailService } from './thumbnail.service.js';
import { UploadResult, ListQuery, ListResult, FileAsset, isImageFile } from './file.types.js';
import crypto from 'node:crypto';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { existsSync, unlinkSync } from 'node:fs';

// 类型定义已移至 file.types.ts

@Injectable()
export class AssetService {
	private fileBindingUtil: FileBindingUtil;

	constructor(
		private prisma: PrismaService, 
		private fileService: FileService,
		private thumbnailService: ThumbnailService
	) {
		this.fileBindingUtil = new FileBindingUtil(prisma);
	}

	private async computeSha256(buffer: Buffer) {
		return crypto.createHash('sha256').update(buffer).digest('hex');
	}

	async upload(buffer: Buffer, originalName: string, mimeType?: string, dir?: string, autoTags?: string[]): Promise<UploadResult> {
		if (!buffer?.length || !originalName) throw new BadRequestException('未接收到文件');
		const checksum = await this.computeSha256(buffer);
		const prisma = this.prisma as unknown as PrismaWithAssets;
		const tags = Array.isArray(autoTags) && autoTags.length > 0 ? autoTags : null;
		
		// 使用事务来确保数据一致性，避免竞态条件
		let savedFilePath: string | null = null;
		try {
			const result = await prisma.$transaction(async (tx) => {
				// 先检查文件是否已存在
				let existingFile = await tx.fileAsset.findFirst({
					where: { checksumSha256: checksum }
				});
				
				if (existingFile) {
					// 文件已存在，更新记录（恢复软删除、合并标签）
					const updatedFile = await tx.fileAsset.update({
						where: { id: existingFile.id },
						data: {
							deletedAt: null,
							// 可选：合并标签，保持原有标签不丢失
							...(tags ? { 
								tagsJson: tags.length > 0 ? Array.from(new Set([
									...(Array.isArray(existingFile.tagsJson) ? existingFile.tagsJson : []),
									...tags
								])) : existingFile.tagsJson 
							} : {})
						}
					});
					
					return updatedFile;
				} else {
					// 文件不存在，需要保存新文件
					// 先保存文件到磁盘
					const saved = this.fileService.saveFile(buffer, originalName, dir || 'public');
					savedFilePath = saved.path; // 记录文件路径，用于错误回滚
					
					try {
						// 创建新的文件记录
						const newFile = await tx.fileAsset.create({
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
							}
						});
						
						return newFile;
					} catch (dbError) {
						// 数据库操作失败，清理已保存的文件
						try {
							this.fileService.remove(saved.path);
						} catch (cleanupError) {
							console.error('清理临时文件失败:', saved.path, cleanupError);
						}
						throw dbError;
					}
				}
			});
			
			const uploadResult = {
				id: result.id,
				url: result.url,
				checksumSha256: result.checksumSha256,
				filename: result.filename,
				mimeType: result.mimeType,
				size: result.size,
				objectKey: result.objectKey,
				storage: result.storage,
			};
			
			// 异步生成缩略图（不阻塞响应）
			if (isImageFile(result.mimeType)) {
				setImmediate(() => {
					this.thumbnailService.generateThumbnailAsync(result.id, 240).catch(error => {
						console.error('异步缩略图生成失败:', error);
					});
				});
			}
			
			return uploadResult;
		} catch (error: any) {
			// 如果事务失败且保存了新文件，尝试清理
			if (savedFilePath) {
				try {
					this.fileService.remove(savedFilePath);
				} catch (cleanupError) {
					console.error('清理失败文件失败:', savedFilePath, cleanupError);
				}
			}
			
			console.error('文件上传失败:', {
				filename: originalName,
				checksum,
				error: error.message || error
			});
			throw error;
		}
	}

	async list(query: ListQuery) {
		const page = Math.max(1, Number(query.page) || 1);
		const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
		const offset = (page - 1) * pageSize;
		const prisma = this.prisma as unknown as PrismaWithAssets;
		
		// 构建类型安全的 Prisma 查询条件
		const where: any = {
			deletedAt: null
		};
		
		// MIME类型筛选
		if (query.mimeType) {
			if (query.mimeType.includes('/')) {
				where.mimeType = { startsWith: query.mimeType };
			} else {
				where.mimeType = { contains: query.mimeType };
			}
		}
		
		// 文件名搜索
		if (query.q) {
			where.filename = { contains: query.q };
		}
		
		// 标签筛选 - 对于JSON字段，仍需要使用原始查询
		let useRawQuery = false;
		const rawConditions: string[] = [];
		const rawValues: any[] = [];
		
		if (query.tag) {
			useRawQuery = true;
			rawConditions.push('JSON_CONTAINS(tagsJson, JSON_ARRAY(?))');
			rawValues.push(query.tag);
		}
		
		if (Array.isArray(query.tags) && query.tags.length) {
			useRawQuery = true;
			for (const tag of query.tags) {
				rawConditions.push('JSON_CONTAINS(tagsJson, JSON_ARRAY(?))');
				rawValues.push(tag);
			}
		}
		
		try {
			if (useRawQuery) {
				// 如果有标签查询，使用原始SQL（但更安全）
				const baseConds = ['deletedAt IS NULL'];
				const baseVals: any[] = [];
				
				if (query.mimeType) {
					baseConds.push('mimeType LIKE ?');
					baseVals.push(query.mimeType.includes('/') ? `${query.mimeType}%` : `%${query.mimeType}%`);
				}
				if (query.q) {
					baseConds.push('filename LIKE ?');
					baseVals.push(`%${query.q}%`);
				}
				
				const allConds = [...baseConds, ...rawConditions];
				const allVals = [...baseVals, ...rawValues];
				const whereClause = allConds.join(' AND ');
				
				const countSql = `SELECT COUNT(1) AS c FROM FileAsset WHERE ${whereClause}`;
				const listSql = `SELECT id, filename, extension, mimeType, size, url, objectKey, storage, createdAt, refCount, tagsJson FROM FileAsset WHERE ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
				
				const [countRow]: any = await prisma.$queryRawUnsafe(countSql, ...allVals);
				const total = Number(countRow?.c || 0);
				const items = await prisma.$queryRawUnsafe(listSql, ...allVals, pageSize, offset);
				
				return { page, pageSize, total, items };
			} else {
				// 使用类型安全的 Prisma 查询
				const [total, items] = await Promise.all([
					prisma.fileAsset.count({ where }),
					prisma.fileAsset.findMany({
						where,
						select: {
							id: true,
							filename: true,
							extension: true,
							mimeType: true,
							size: true,
							url: true,
							objectKey: true,
							storage: true,
							createdAt: true,
							refCount: true,
							tagsJson: true
						},
						orderBy: { createdAt: 'desc' },
						skip: offset,
						take: pageSize
					})
				]);
				
				return { page, pageSize, total, items };
			}
		} catch (error) {
			console.error('文件列表查询失败:', error);
			throw new Error('查询文件列表失败');
		}
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
			
			// 检查是否已存在相同的绑定，避免重复
			const existingBinding = await tx.fileBinding.findFirst({
				where: { 
					fileId: id, 
					tableName: binding.tableName, 
					rowId: binding.rowId, 
					fieldName: binding.fieldName 
				}
			});
			
			if (existingBinding) {
				return existingBinding; // 返回已存在的绑定，不重复创建
			}
			
			const b = await tx.fileBinding.create({ 
				data: { 
					fileId: id, 
					tableName: binding.tableName, 
					rowId: binding.rowId, 
					fieldName: binding.fieldName 
				} 
			});
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
			
			// 使用 Sharp 生成缩略图，添加更详细的错误处理
			await sharp(srcAbs)
				.resize({ 
					width: size, 
					height: size, 
					fit: 'inside', 
					withoutEnlargement: true 
				})
				.jpeg({ quality: 85 }) // 统一输出为JPEG格式
				.toFile(targetAbs);
			
			// 验证生成的文件确实存在
			if (!existsSync(targetAbs)) {
				throw new Error('缩略图文件生成后不存在');
			}
			
			// 使用事务更新变体信息，确保原子性
			const url = `/uploads/${targetKey.replace(/\\/g, '/')}`;
			await prisma.$transaction(async (tx) => {
				const currentFile = await tx.fileAsset.findFirst({ where: { id, deletedAt: null } });
				if (!currentFile) {
					throw new Error('原文件在缩略图生成过程中被删除');
				}
				
				const nextVariants = { ...((currentFile as any).variants || {}), [String(size)]: url } as any;
				await tx.fileAsset.update({ where: { id }, data: { variants: nextVariants } });
			});
			
			return { url };
		} catch (error) {
			console.error(`缩略图生成失败 (${id}, ${size}):`, {
				srcPath: srcAbs,
				targetPath: targetAbs,
				error: error instanceof Error ? error.message : error
			});
			
			// 清理可能部分生成的文件
			if (existsSync(targetAbs)) {
				try {
					unlinkSync(targetAbs);
				} catch (cleanupError) {
					console.error('清理失败的缩略图文件失败:', targetAbs, cleanupError);
				}
			}
			
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
		
		try {
			const list = await prisma.fileAsset.findMany({ where });
			const uploadsRoot = join(process.cwd(), 'uploads');
			let removedFiles = 0, updatedRows = 0;
			
			// 分批处理，避免长时间锁定
			const batchSize = 10;
			for (let i = 0; i < list.length; i += batchSize) {
				const batch = list.slice(i, i + batchSize);
				
				await prisma.$transaction(async (tx) => {
					for (const f of batch) {
						try {
							const variants = (f as any).variants || {};
							const filesToRemove: string[] = [];
							
							// 收集需要删除的文件路径
							for (const key of Object.keys(variants)) {
								const url: string = variants[key];
								if (typeof url === 'string') {
									const rel = url.replace(/^\/uploads\//, '').split('?')[0];
									const abs = join(uploadsRoot, rel);
									if (existsSync(abs)) {
										filesToRemove.push(abs);
									}
								}
							}
							
							// 先更新数据库记录
							await tx.fileAsset.update({ 
								where: { id: f.id }, 
								data: { variants: null } 
							});
							
							// 然后删除物理文件
							for (const filePath of filesToRemove) {
								try {
									unlinkSync(filePath);
									removedFiles++;
								} catch (fileError) {
									console.error('删除变体文件失败:', filePath, fileError);
									// 继续处理其他文件，不中断整个过程
								}
							}
							
							updatedRows++;
						} catch (error) {
							console.error('清理文件变体失败:', f.id, error);
							// 记录错误但继续处理其他文件
						}
					}
				});
			}
			
			return { removedFiles, updatedRows };
		} catch (error) {
			console.error('批量清理变体失败:', error);
			throw new Error('清理操作失败');
		}
	}
}

// 临时类型兼容：在类型生成器未即时识别新模型时，显式声明所需委托
type PrismaWithAssets = PrismaService & {
	fileAsset: any;
	fileBinding: any;
	$transaction: any;
};


