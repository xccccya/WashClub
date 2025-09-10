/**
 * 文件上传自动标签配置
 * 根据上传目录和来源自动为文件添加相应标签
 */

export interface AutoTagRule {
	/** 规则名称 */
	name: string;
	/** 匹配的目录 */
	dir?: string;
	/** 匹配的来源标识 */
	source?: string;
	/** 自动添加的标签 */
	tags: string[];
	/** 规则描述 */
	description: string;
}

export const AUTO_TAG_RULES: AutoTagRule[] = [
	// 头像相关
	{
		name: 'avatar',
		source: 'avatar',
		tags: ['头像'],
		description: '用户头像上传'
	},
	
	// 商品相关
	{
		name: 'product-main',
		source: 'product-main',
		tags: ['商品主图', '商品图片'],
		description: '商品主图上传'
	},
	{
		name: 'product-gallery',
		source: 'product-gallery',
		tags: ['商品图片'],
		description: '商品多图上传'
	},
	{
		name: 'product-sku',
		source: 'product-sku',
		tags: ['商品规格', '商品图片'],
		description: 'SKU图片上传'
	},
	{
		name: 'product-desc',
		source: 'product-desc',
		tags: ['商品详情', '商品图片'],
		description: '商品描述图片上传'
	},
	
	// 订单相关
	{
		name: 'order-review',
		source: 'order-review',
		tags: ['订单评价'],
		description: '订单评价图片上传'
	},
	{
		name: 'order-aftersales',
		source: 'order-aftersales',
		tags: ['订单售后'],
		description: '订单售后图片上传'
	},
	
	// 营销相关
	{
		name: 'coupon',
		source: 'coupon',
		tags: ['优惠券'],
		description: '优惠券图片上传'
	},
	{
		name: 'banner',
		source: 'banner',
		tags: ['广告横幅'],
		description: '广告横幅图片上传'
	},
	
	// 会员相关
	{
		name: 'member-level',
		source: 'member-level',
		tags: ['会员等级'],
		description: '会员等级图标上传'
	},
	
	// 车辆相关
	{
		name: 'vehicle',
		source: 'vehicle',
		tags: ['车辆图片'],
		description: '车辆相关图片上传'
	},
	{
		name: 'vehicle-auto',
		dir: 'carimg',
		tags: ['车辆图片'],
		description: '车辆图片自动下载保存'
	},
	
	// 系统相关
	{
		name: 'system-logo',
		source: 'system-logo',
		tags: ['系统LOGO', '系统'],
		description: '系统LOGO上传'
	},
	{
		name: 'system-bg',
		source: 'system-bg',
		tags: ['系统背景', '系统'],
		description: '系统背景图上传'
	},
	{
		name: 'system-default-avatar',
		source: 'system-default-avatar',
		tags: ['头像', '系统'],
		description: '系统默认头像上传'
	},
	
	// 文件管理
	{
		name: 'file-management',
		dir: 'admin',
		tags: ['文件管理'],
		description: '后台文件管理页面上传'
	},
	// 集团图标（管理后台）
	{
		name: 'admin-group-icon',
		source: 'admin-group',
		tags: ['集团', '集团图标'],
		description: '管理后台-集团图标上传'
	},
	
	// 小程序通用
	{
		name: 'miniapp-general',
		dir: 'miniapp',
		tags: ['小程序'],
		description: '小程序端上传（通用）'
	}
];

/**
 * 根据目录和来源获取自动标签
 */
export function getAutoTags(dir?: string, source?: string): string[] {
	const matchedRules = AUTO_TAG_RULES.filter(rule => {
		// 优先匹配来源标识
		if (source && rule.source === source) return true;
		// 其次匹配目录
		if (dir && rule.dir === dir && !rule.source) return true;
		return false;
	});
	
	// 合并所有匹配规则的标签，去重
	const tags = new Set<string>();
	matchedRules.forEach(rule => {
		rule.tags.forEach(tag => tags.add(tag));
	});
	
	return Array.from(tags);
}

/**
 * 获取所有可用的标签列表
 */
export function getAllAvailableTags(): string[] {
	const tags = new Set<string>();
	AUTO_TAG_RULES.forEach(rule => {
		rule.tags.forEach(tag => tags.add(tag));
	});
	return Array.from(tags).sort();
}

/**
 * 根据标签查找相关规则
 */
export function getRulesByTag(tag: string): AutoTagRule[] {
	return AUTO_TAG_RULES.filter(rule => rule.tags.includes(tag));
}
