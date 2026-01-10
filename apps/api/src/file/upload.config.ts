/**
 * 文件上传安全配置
 * 注意：修改这些配置时请谨慎，确保不影响现有业务功能
 */

// 文件大小限制（字节）
export const FILE_SIZE_LIMITS = {
	// 图片文件：10MB
	IMAGE: 10 * 1024 * 1024,
	// 文档文件：5MB
	DOCUMENT: 5 * 1024 * 1024,
	// 视频文件：50MB
	VIDEO: 50 * 1024 * 1024,
	// 音频文件：10MB
	AUDIO: 10 * 1024 * 1024,
	// 默认限制：20MB
	DEFAULT: 20 * 1024 * 1024,
};

// 允许的MIME类型（保持现有业务兼容性）
export const ALLOWED_MIME_TYPES = {
	// 图片类型
	IMAGE: [
		'image/jpeg',
		'image/jpg', 
		'image/png',
		'image/gif',
		'image/webp',
		'image/bmp',
	],
	// 文档类型
	DOCUMENT: [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'text/plain',
		'text/csv',
	],
	// 视频类型
	VIDEO: [
		'video/mp4',
		'video/avi',
		'video/mov',
		'video/wmv',
		'video/flv',
		'video/webm',
	],
	// 音频类型
	AUDIO: [
		'audio/mp3',
		'audio/wav',
		'audio/flac',
		'audio/aac',
		'audio/ogg',
	],
};

// 危险的文件扩展名（禁止上传）
export const DANGEROUS_EXTENSIONS = [
	'.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
	'.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh', '.ps1',
	// XSS / HTML 注入风险（至少禁用 svg/html/htm）
	'.svg', '.html', '.htm',
];

// 明确禁止的 MIME（至少禁用 svg/html/htm 对应类型；支持带 charset 的场景）
export const BLOCKED_MIME_TYPES = [
	'image/svg+xml',
	'text/html',
	'application/xhtml+xml',
];

// 允许的目录名称（防止路径注入）
export const ALLOWED_DIRECTORIES = [
	'public', 'admin', 'carimg', 'miniapp', 'pos', 'avatar', 'product', 
	'banner', 'coupon', 'system', 'temp', 'upload', 'files',
];

/**
 * 验证文件是否安全
 */
export function validateFileSecurity(
	buffer: Buffer, 
	originalName: string, 
	mimeType: string
): { isValid: boolean; error?: string } {
	// 1. 检查文件名
	if (!originalName || originalName.length > 255) {
		return { isValid: false, error: '文件名无效或过长' };
	}

	// 2. 检查危险扩展名
	const ext = originalName.toLowerCase();
	for (const dangerousExt of DANGEROUS_EXTENSIONS) {
		if (ext.endsWith(dangerousExt)) {
			return { isValid: false, error: '不允许上传此类型文件' };
		}
	}

	// 2.1 检查明确禁止的 MIME（防止通过更换后缀绕过）
	const lowerMime = String(mimeType || '').toLowerCase();
	if (lowerMime) {
		const hitBlocked = BLOCKED_MIME_TYPES.some((m) => lowerMime === m || lowerMime.startsWith(`${m};`));
		if (hitBlocked) {
			return { isValid: false, error: '不支持的文件类型' };
		}
	}

	// 3. 检查文件大小
	const fileType = getFileTypeFromMime(mimeType);
	const sizeLimit = FILE_SIZE_LIMITS[fileType] || FILE_SIZE_LIMITS.DEFAULT;
	if (buffer.length > sizeLimit) {
		return { 
			isValid: false, 
			error: `文件大小超过限制（${Math.round(sizeLimit / 1024 / 1024)}MB）` 
		};
	}

	// 4. 检查MIME类型（宽松检查，主要防止危险类型）
	if (mimeType && isDangerousMimeType(mimeType)) {
		return { isValid: false, error: '不支持的文件类型' };
	}

	return { isValid: true };
}

/**
 * 验证目录名是否安全
 */
export function validateDirectoryName(dir: string): { isValid: boolean; error?: string } {
	if (!dir) {
		return { isValid: true }; // 允许空目录（使用默认）
	}

	// 检查是否包含危险字符
	if (/[<>:"|?*\x00-\x1f]/.test(dir) || /\.\./.test(dir)) {
		return { isValid: false, error: '目录名包含非法字符' };
	}

	// 检查是否在允许列表中
	if (!ALLOWED_DIRECTORIES.includes(dir)) {
		return { isValid: false, error: '不允许的目录名' };
	}

	return { isValid: true };
}

/**
 * 根据MIME类型获取文件分类
 */
function getFileTypeFromMime(mimeType: string): keyof typeof FILE_SIZE_LIMITS {
	if (mimeType.startsWith('image/')) return 'IMAGE';
	if (mimeType.startsWith('video/')) return 'VIDEO';
	if (mimeType.startsWith('audio/')) return 'AUDIO';
	if (mimeType.includes('document') || mimeType.includes('pdf') || mimeType.includes('text')) {
		return 'DOCUMENT';
	}
	return 'DEFAULT';
}

/**
 * 检查MIME类型是否被允许（保持原有的严格列表，供参考）
 */
function isAllowedMimeType(mimeType: string): boolean {
	const allAllowed = [
		...ALLOWED_MIME_TYPES.IMAGE,
		...ALLOWED_MIME_TYPES.DOCUMENT,
		...ALLOWED_MIME_TYPES.VIDEO,
		...ALLOWED_MIME_TYPES.AUDIO,
	];
	return allAllowed.includes(mimeType);
}

/**
 * 检查MIME类型是否危险（黑名单方式，更宽松）
 */
function isDangerousMimeType(mimeType: string): boolean {
	// 危险的MIME类型黑名单
	const dangerousTypes = [
		'application/x-executable',
		'application/x-msdownload',
		'application/x-msdos-program',
		'application/x-msi',
		'application/x-bat',
		'application/x-sh',
		'application/x-csh',
		'application/javascript',
		'text/javascript',
		'application/x-javascript',
		'text/x-python',
		'application/x-python-code',
		'text/x-php',
		'application/x-php',
		'application/x-httpd-php',
		'text/x-ruby',
		'application/x-ruby',
		'text/x-perl',
		'application/x-perl',
	];
	
	return dangerousTypes.some(dangerous => 
		mimeType.toLowerCase().includes(dangerous.toLowerCase())
	);
}
