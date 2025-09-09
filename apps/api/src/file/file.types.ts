/**
 * 文件管理系统类型定义
 * 提供更好的类型安全和代码提示
 */

export interface FileAsset {
	id: string;
	createdAt: Date;
	deletedAt: Date | null;
	filename: string;
	extension: string | null;
	mimeType: string;
	size: number;
	width: number | null;
	height: number | null;
	durationMs: number | null;
	checksumSha256: string;
	storage: string;
	bucket: string | null;
	objectKey: string;
	url: string;
	isPublic: boolean;
	tagsJson: string[] | null;
	variants: Record<string, string> | null;
	extra: any | null;
	refCount: number;
}

export interface FileBinding {
	id: string;
	createdAt: Date;
	fileId: string;
	tableName: string;
	rowId: string;
	fieldName: string;
}

export interface UploadOptions {
	/** 文件保存目录 */
	dir?: string;
	/** 手动指定的标签 */
	tags?: string[];
	/** 上传来源，用于自动标签 */
	source?: string;
	/** 是否跳过重复检查 */
	skipDuplicateCheck?: boolean;
	/** 是否异步生成缩略图 */
	generateThumbnails?: boolean;
}

export interface UploadResult {
	id: string;
	url: string;
	checksumSha256: string;
	filename: string;
	mimeType: string;
	size: number;
	objectKey: string;
	storage: string;
}

export interface ListQuery {
	page?: number;
	pageSize?: number;
	mimeType?: string;
	q?: string; // 文件名搜索
	tag?: string; // 单个标签
	tags?: string[]; // 多个标签
	sortBy?: 'createdAt' | 'filename' | 'size';
	sortOrder?: 'asc' | 'desc';
}

export interface ListResult {
	page: number;
	pageSize: number;
	total: number;
	items: Partial<FileAsset>[];
}

export interface FileValidation {
	isValid: boolean;
	error?: string;
}

export interface ThumbnailOptions {
	size: number;
	quality?: number;
	format?: 'jpeg' | 'png' | 'webp';
}

export interface FileReference {
	id: string;
	tableName: string;
	rowId: string;
	fieldName: string;
	createdAt: Date;
}

export interface CleanupResult {
	removedFiles: number;
	updatedRows: number;
	errors?: string[];
}

// 增强的错误类型
export class FileUploadError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly details?: any
	) {
		super(message);
		this.name = 'FileUploadError';
	}
}

export class FileSizeExceededError extends FileUploadError {
	constructor(size: number, limit: number) {
		super(
			`文件大小 ${Math.round(size / 1024 / 1024)}MB 超过限制 ${Math.round(limit / 1024 / 1024)}MB`,
			'FILE_SIZE_EXCEEDED',
			{ size, limit }
		);
	}
}

export class UnsupportedFileTypeError extends FileUploadError {
	constructor(mimeType: string) {
		super(
			`不支持的文件类型: ${mimeType}`,
			'UNSUPPORTED_FILE_TYPE',
			{ mimeType }
		);
	}
}

export class FileNotFoundError extends FileUploadError {
	constructor(fileId: string) {
		super(
			`文件不存在: ${fileId}`,
			'FILE_NOT_FOUND',
			{ fileId }
		);
	}
}

export class FileInUseError extends FileUploadError {
	constructor(fileId: string, refCount: number) {
		super(
			`文件正在被引用，无法删除: ${fileId} (引用数: ${refCount})`,
			'FILE_IN_USE',
			{ fileId, refCount }
		);
	}
}

// 类型守卫
export function isImageFile(mimeType: string): boolean {
	return mimeType.startsWith('image/');
}

export function isVideoFile(mimeType: string): boolean {
	return mimeType.startsWith('video/');
}

export function isAudioFile(mimeType: string): boolean {
	return mimeType.startsWith('audio/');
}

export function isDocumentFile(mimeType: string): boolean {
	return mimeType.includes('document') || 
		   mimeType.includes('pdf') || 
		   mimeType.includes('text') ||
		   mimeType.includes('sheet') ||
		   mimeType.includes('presentation');
}
