import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import * as crypto from 'node:crypto';

export type AdminMenuKey =
	| 'members'
	| 'member-levels'
	| 'member-categories'
	| 'member-addresses'
	| 'member-vehicles'
	| 'member-washcards'
	| 'service-queue'
	| 'system-roles'
	| 'system-admins'
	| 'member-tags'
	| 'system-files'
	| 'system-sms'
	| 'content-notices'
	| 'content-banners'
	| 'content-reviews'
	| 'store-categories'
	| 'store-products'
	| 'store-inventory'
	| 'orders'
	| 'after-sales'
	| 'coupon-groups'
	| 'coupons'
	| 'member-coupons';

@Injectable()
export class AdminRoleService {
	constructor(private prisma: PrismaService) {}

	listRoles() {
		return this.prisma.adminRole.findMany({ orderBy: { id: 'asc' } });
	}

	async createRole(data: { name: string; enabled?: boolean; permissions?: AdminMenuKey[]; isSystem?: boolean }) {
		const permissions = (data.permissions || []) as any;
		return this.prisma.adminRole.create({ data: { name: data.name, enabled: data.enabled ?? true, isSystem: !!data.isSystem, permissions } });
	}

	async updateRole(id: number, data: { name?: string; enabled?: boolean; permissions?: AdminMenuKey[] }) {
		const role = await this.prisma.adminRole.findUnique({ where: { id } });
		if (!role) throw new NotFoundException('角色不存在');
		if (role.isSystem && id === 1) throw new BadRequestException('系统内置超级管理员不可修改');
		return this.prisma.adminRole.update({ where: { id }, data: { ...data, permissions: data.permissions as any } });
	}

	async removeRole(id: number) {
		const role = await this.prisma.adminRole.findUnique({ where: { id } });
		if (!role) return { ok: true };
		if (role.isSystem && id === 1) throw new BadRequestException('系统内置超级管理员不可删除');
		const hasUsers = await this.prisma.user.count({ where: { roleId: id } });
		if (hasUsers) throw new BadRequestException('该角色下仍有关联的管理员账号');
		await this.prisma.adminRole.delete({ where: { id } });
		return { ok: true };
	}

	// 管理员账号管理
	listAdmins() {
		return this.prisma.user.findMany({ orderBy: { id: 'asc' }, include: { roleRef: true } });
	}

	private hash(raw: string) { return crypto.createHash('sha256').update(raw).digest('hex'); }

	createAdmin(data: { phone: string; name?: string; password: string; roleId: number }) {
		return this.prisma.$transaction(async (tx) => {
			const exists = await tx.user.findUnique({ where: { phone: data.phone } });
			if (exists) throw new BadRequestException('手机号已存在');
			return tx.user.create({ data: { phone: data.phone, name: data.name, password: this.hash(data.password), roleId: data.roleId, role: 'staff' } });
		});
	}

	updateAdmin(id: number, data: { phone?: string; name?: string; password?: string; roleId?: number | null }) {
		const payload: any = { ...data };
		if (data.password) payload.password = this.hash(data.password);
		return this.prisma.user.update({ where: { id }, data: payload });
	}

	removeAdmin(id: number) {
		if (id === 1) throw new BadRequestException('内置管理员不可删除');
		return this.prisma.user.delete({ where: { id } });
	}

	// 菜单清单（供角色权限编辑选择）
	listMenus() {
		return [
			{ key: 'members', name: '会员列表', path: '/members' },
			{ key: 'member-levels', name: '会员等级', path: '/member-levels' },
			{ key: 'member-categories', name: '会员分类', path: '/member-categories' },
			{ key: 'member-addresses', name: '收货地址', path: '/member-addresses' },
			{ key: 'member-vehicles', name: '会员车辆', path: '/member-vehicles' },
			{ key: 'member-washcards', name: '洗车计次卡', path: '/member-washcards' },
			{ key: 'member-tags', name: '会员标签', path: '/member-tags' },
			{ key: 'system-roles', name: '后台角色', path: '/system/roles' },
			{ key: 'system-admins', name: '后台管理员', path: '/system/admins' },
			{ key: 'system-files', name: '文件管理', path: '/system/files' },
			{ key: 'system-sms', name: '短信管理', path: '/system/sms' },
			{ key: 'service-queue', name: '服务队列', path: '/service-queue' },
			{ key: 'content-notices', name: '滚动通知', path: '/content/notices' },
			{ key: 'content-banners', name: '广告横幅', path: '/content/banners' },
			{ key: 'content-reviews', name: '评价管理', path: '/content/reviews' },
			{ key: 'store-categories', name: '商品分类', path: '/store/categories' },
			{ key: 'store-products', name: '商品列表', path: '/store/products' },
			{ key: 'store-inventory', name: '库存管理', path: '/store/inventory' },
			{ key: 'orders', name: '订单列表', path: '/orders' },
			{ key: 'after-sales', name: '售后', path: '/after-sales' },
			{ key: 'coupon-groups', name: '卡券分组', path: '/coupon/groups' },
			{ key: 'coupons', name: '卡券列表', path: '/coupon/list' },
			{ key: 'member-coupons', name: '会员卡券', path: '/coupon/member-coupons' },
		];
	}
}



