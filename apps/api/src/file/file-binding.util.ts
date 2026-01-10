import { PrismaService } from '../prisma.service.js';

/**
 * 文件绑定工具类 - 自动管理文件引用关系
 */
export class FileBindingUtil {
	constructor(private prisma: PrismaService) {}

	private normalizeAssetUrl(input: string): string | null {
		const raw = String(input || '').trim();
		if (!raw) return null;
		let s = raw;

		// 1) 绝对 URL：取 pathname
		if (/^https?:\/\//i.test(s)) {
			try {
				const u = new URL(s);
				s = u.pathname || '';
			} catch {
				// fallback：继续走后续规则
			}
		}

		// 2) 去掉 query/hash（兼容 /uploads/xxx.jpg?x=1#y）
		s = s.split('#')[0].split('?')[0];

		// 3) 统一到库里存的形态：/uploads/...
		if (s.startsWith('uploads/')) s = `/${s}`;
		if (!s.startsWith('/')) s = `/${s}`;

		// 允许传入类似 /api/uploads/... 或 https://xxx.com/uploads/... → 截取到 /uploads/...
		const idx = s.indexOf('/uploads/');
		if (idx >= 0) s = s.slice(idx);

		if (!s.startsWith('/uploads/')) return null;
		return s;
	}

	/**
	 * 从URL数组中提取文件资产ID
	 */
	async getAssetIdsFromUrls(urls: string[]): Promise<string[]> {
		if (!Array.isArray(urls) || urls.length === 0) return [];
		
		try {
			const normalizedUrls = Array.from(
				new Set(
					urls
						.map((u) => this.normalizeAssetUrl(u))
						.filter((u): u is string => !!u),
				),
			);
			if (normalizedUrls.length === 0) return [];

			const prisma = this.prisma as any;
			const results = await prisma.fileAsset.findMany({
				where: {
					url: { in: normalizedUrls },
					deletedAt: null
				},
				select: { id: true, url: true }
			});
			
			return results.map((r: any) => r.id);
		} catch (error) {
			console.error('从URL获取资产ID失败:', error);
			return [];
		}
	}

	/**
	 * 绑定文件引用关系
	 */
	async bindFileReferences(
		fileUrls: string[], 
		tableName: string, 
		rowId: string, 
		fieldName: string
	): Promise<{ bindCount: number }> {
		if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
			return { bindCount: 0 };
		}

		try {
			const fileIds = await this.getAssetIdsFromUrls(fileUrls);
			if (fileIds.length === 0) return { bindCount: 0 };

			const prisma = this.prisma as any;
			let bindCount = 0;

			await prisma.$transaction(async (tx: any) => {
				// 先获取旧绑定，用于减少引用计数
				const oldBindings = await tx.fileBinding.findMany({
					where: { tableName, rowId, fieldName }
				});

				// 删除旧绑定并减少引用计数
				for (const oldBinding of oldBindings) {
					await tx.fileBinding.delete({
						where: { id: oldBinding.id }
					});
					
					// 原子性地减少引用计数，使用 Math.max 确保不会变成负数
					await tx.fileAsset.update({
						where: { id: oldBinding.fileId },
						data: { 
							refCount: {
								decrement: 1
							}
						}
					});
				}

				// 创建新绑定并增加引用计数
				for (const fileId of fileIds) {
					await tx.fileBinding.create({
						data: { fileId, tableName, rowId, fieldName }
					});
					
					// 原子性地增加引用计数
					await tx.fileAsset.update({
						where: { id: fileId },
						data: { refCount: { increment: 1 } }
					});
					
					bindCount++;
				}
			});

			return { bindCount };
		} catch (error) {
			console.error('绑定文件引用失败:', error);
			return { bindCount: 0 };
		}
	}

	/**
	 * 解绑文件引用关系
	 */
	async unbindFileReferences(
		tableName: string, 
		rowId: string, 
		fieldName?: string
	): Promise<{ unbindCount: number }> {
		try {
			const prisma = this.prisma as any;
			let unbindCount = 0;

			await prisma.$transaction(async (tx: any) => {
				const where: any = { tableName, rowId };
				if (fieldName) where.fieldName = fieldName;

				// 获取要删除的绑定
				const bindings = await tx.fileBinding.findMany({ where });
				
				// 删除绑定并更新引用计数
				for (const binding of bindings) {
					await tx.fileBinding.delete({ where: { id: binding.id } });
					
					// 原子性地减少引用计数，确保不会变成负数
					await tx.fileAsset.update({
						where: { id: binding.fileId },
						data: { refCount: { decrement: 1 } }
					});
					unbindCount++;
				}
			});

			return { unbindCount };
		} catch (error) {
			console.error('解绑文件引用失败:', error);
			return { unbindCount: 0 };
		}
	}

	/**
	 * 更新文件引用关系（先解绑旧的，再绑定新的）
	 */
	async updateFileReferences(
		newFileUrls: string[],
		tableName: string,
		rowId: string,
		fieldName: string
	): Promise<{ bindCount: number; unbindCount: number }> {
		// 先解绑旧的引用
		const { unbindCount } = await this.unbindFileReferences(tableName, rowId, fieldName);
		
		// 再绑定新的引用
		const { bindCount } = await this.bindFileReferences(newFileUrls, tableName, rowId, fieldName);

		return { bindCount, unbindCount };
	}

	/**
	 * 获取文件的引用列表
	 */
	async getFileReferences(fileId: string): Promise<any[]> {
		try {
			const prisma = this.prisma as any;
			return await prisma.fileBinding.findMany({
				where: { fileId },
				orderBy: { createdAt: 'desc' }
			});
		} catch (error) {
			console.error('获取文件引用失败:', error);
			return [];
		}
	}

	/**
	 * 检查文件是否可以安全删除（没有引用）
	 */
	async canDeleteFile(fileId: string): Promise<boolean> {
		try {
			const prisma = this.prisma as any;
			const file = await prisma.fileAsset.findFirst({
				where: { id: fileId, deletedAt: null }
			});
			
			return file && (file.refCount || 0) === 0;
		} catch (error) {
			console.error('检查文件删除权限失败:', error);
			return false;
		}
	}
}

/**
 * 全局文件绑定工具函数 - 供其他服务使用
 */
export async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]> {
	const util = new FileBindingUtil(prisma);
	return await util.getAssetIdsFromUrls(urls);
}

export async function bindFileReferences(
	prisma: PrismaService,
	fileUrls: string[], 
	tableName: string, 
	rowId: string, 
	fieldName: string
): Promise<{ bindCount: number }> {
	const util = new FileBindingUtil(prisma);
	return await util.bindFileReferences(fileUrls, tableName, rowId, fieldName);
}

export async function updateFileReferences(
	prisma: PrismaService,
	newFileUrls: string[],
	tableName: string,
	rowId: string,
	fieldName: string
): Promise<{ bindCount: number; unbindCount: number }> {
	const util = new FileBindingUtil(prisma);
	return await util.updateFileReferences(newFileUrls, tableName, rowId, fieldName);
}
