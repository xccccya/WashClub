import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import sharp from 'sharp';
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 缩略图服务 - 异步处理缩略图生成，避免阻塞主请求
 * 这是一个性能优化的新服务，不改变现有业务逻辑
 */
@Injectable()
export class ThumbnailService {
	private processingQueue = new Set<string>(); // 防止重复处理
	
	constructor(private prisma: PrismaService) {}

	/**
	 * 异步生成缩略图（后台处理）
	 */
	async generateThumbnailAsync(fileId: string, size: number = 240): Promise<void> {
		const queueKey = `${fileId}_${size}`;
		
		// 防止重复处理
		if (this.processingQueue.has(queueKey)) {
			return;
		}
		
		this.processingQueue.add(queueKey);
		
		try {
			const prisma = this.prisma as any;
			const file = await prisma.fileAsset.findFirst({ 
				where: { id: fileId, deletedAt: null } 
			});
			
			if (!file) {
				console.warn(`缩略图异步处理：文件不存在 ${fileId}`);
				return;
			}
			
			// 非图片文件跳过
			if (!/^image\//i.test(file.mimeType)) {
				return;
			}
			
			// 检查是否已存在
			const variants = (file as any).variants || {};
			if (variants[String(size)]) {
				return; // 已存在，跳过
			}
			
			const uploadsRoot = join(process.cwd(), 'uploads');
			const srcAbs = join(uploadsRoot, file.objectKey);
			
			if (!existsSync(srcAbs)) {
				console.warn(`缩略图异步处理：源文件不存在 ${srcAbs}`);
				return;
			}
			
			const ext = (file.extension || '').toLowerCase() || 'jpg';
			const targetKey = file.objectKey.replace(/\.(\w+)$/, (_m, g1) => `_thumb_${size}.${g1 || ext}`);
			const targetAbs = join(uploadsRoot, targetKey);
			
			// 确保目标目录存在
			const targetDir = join(targetAbs, '..');
			if (!existsSync(targetDir)) {
				mkdirSync(targetDir, { recursive: true });
			}
			
			// 生成缩略图
			await sharp(srcAbs)
				.resize({ 
					width: size, 
					height: size, 
					fit: 'inside', 
					withoutEnlargement: true 
				})
				.jpeg({ quality: 85 })
				.toFile(targetAbs);
			
			// 验证文件生成成功
			if (!existsSync(targetAbs)) {
				throw new Error('缩略图文件生成后不存在');
			}
			
			// 更新数据库
			const url = `/uploads/${targetKey.replace(/\\/g, '/')}`;
			await prisma.$transaction(async (tx: any) => {
				const currentFile = await tx.fileAsset.findFirst({ 
					where: { id: fileId, deletedAt: null } 
				});
				
				if (currentFile) {
					const nextVariants = { 
						...((currentFile as any).variants || {}), 
						[String(size)]: url 
					};
					await tx.fileAsset.update({ 
						where: { id: fileId }, 
						data: { variants: nextVariants } 
					});
				}
			});
			
		} catch (error) {
			console.error(`缩略图异步生成失败 (${fileId}, ${size}):`, error);
		} finally {
			this.processingQueue.delete(queueKey);
		}
	}

	/**
	 * 批量预生成缩略图
	 */
	async batchGenerateThumbnails(fileIds: string[], sizes: number[] = [120, 240, 480]): Promise<void> {
		const promises: Promise<void>[] = [];
		
		for (const fileId of fileIds) {
			for (const size of sizes) {
				// 使用 setTimeout 延迟执行，避免同时启动太多任务
				promises.push(
					new Promise<void>((resolve) => {
						setTimeout(() => {
							this.generateThumbnailAsync(fileId, size).finally(resolve);
						}, Math.random() * 1000); // 随机延迟 0-1秒
					})
				);
			}
		}
		
		// 不等待所有任务完成，让它们在后台运行
		Promise.allSettled(promises).catch(error => {
			console.error('批量缩略图生成出现错误:', error);
		});
	}

	/**
	 * 检查处理队列状态
	 */
	getQueueStatus(): { processing: number; queueItems: string[] } {
		return {
			processing: this.processingQueue.size,
			queueItems: Array.from(this.processingQueue)
		};
	}
}
