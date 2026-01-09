import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AssetService } from '../file/asset.service.js';
import { hashPassword } from './password.js';

export type AdminMenuKey =
	| 'members'
	| 'member-levels'
	| 'member-categories'
	| 'member-addresses'
	| 'member-vehicles'
	| 'member-washcards'
	| 'member-signins'
	| 'member-points'
	// 集团菜单
	| 'group'
	| 'group-vehicles'
	| 'group-cards'
	| 'group-balance'
	| 'service-queue'
	| 'system-roles'
	| 'system-admins'
	| 'system-basic'
	| 'member-tags'
	| 'system-files'
	| 'system-sms'
	| 'system-employees'
	| 'content-notices'
	| 'content-banners'
	| 'content-reviews'
	| 'store-categories'
	| 'store-products'
	| 'store-inventory'
	| 'orders'
	| 'orders-writeoff'
	| 'after-sales'
	| 'coupon-groups'
	| 'coupons'
	| 'member-coupons'
	| 'coupon-logs'
	| 'notification-templates'
	| 'notification-overview'
	// 预留：运营统计概览
	| 'dashboard-metrics'
	// 内置保留：管理员自助类接口（更新昵称/头像/密码等），不对应菜单项
	| 'admin-self';

@Injectable()
export class AdminRoleService {
	constructor(private prisma: PrismaService, private assets: AssetService) {}

	listRoles() {
		return this.prisma.adminRole.findMany({ orderBy: { id: 'asc' } });
	}

	listRoleOptions() {
		return this.prisma.adminRole.findMany({
			orderBy: { id: 'asc' },
			select: { id: true, name: true, enabled: true, isSystem: true },
		});
	}

	async createRole(data: { name: string; enabled?: boolean; permissions?: AdminMenuKey[]; isSystem?: boolean }) {
		const permissions = (data.permissions || []) as any;
		return this.prisma.adminRole.create({ data: { name: data.name, enabled: data.enabled ?? true, isSystem: !!data.isSystem, permissions } });
	}

	async updateRole(id: number, data: { name?: string; enabled?: boolean; permissions?: AdminMenuKey[] }) {
		const role = await this.prisma.adminRole.findUnique({ where: { id } });
		if (!role) throw new NotFoundException('角色不存在');
		if (role.isSystem) throw new BadRequestException('系统内置角色不可修改');
		return this.prisma.adminRole.update({ where: { id }, data: { ...data, permissions: data.permissions as any } });
	}

	async removeRole(id: number) {
		const role = await this.prisma.adminRole.findUnique({ where: { id } });
		if (!role) return { ok: true };
		if (role.isSystem) throw new BadRequestException('系统内置角色不可删除');
		const hasUsers = await this.prisma.user.count({ where: { roleId: id } });
		if (hasUsers) throw new BadRequestException('该角色下仍有关联的管理员账号');
		await this.prisma.adminRole.delete({ where: { id } });
		return { ok: true };
	}

	// 管理员账号管理
	listAdmins() {
		return this.prisma.user.findMany({ orderBy: { id: 'asc' }, include: { roleRef: true } });
	}

	async createAdmin(data: { phone: string; name?: string; password: string; roleId: number; avatarUrl?: string | null }) {
		return this.prisma.$transaction(async (tx) => {
			const exists = await tx.user.findUnique({ where: { phone: data.phone } });
			if (exists) throw new BadRequestException('手机号已存在');
			// 头像策略与会员一致：未自定义头像则保持 null（由前端按站点默认头像回退）
			const avatarUrl = typeof data.avatarUrl === 'string' ? (data.avatarUrl.trim() || null) : (data.avatarUrl ?? null);
			const hashed = await hashPassword(data.password);
			const created = await tx.user.create({ data: ({ phone: data.phone, name: data.name, password: hashed, roleId: data.roleId, role: 'staff', avatarUrl } as any) });
			try { await this.syncBindings('User', String(created.id), 'avatarUrl', (created as any).avatarUrl ? [(created as any).avatarUrl] : []); } catch {}
			return created;
		});
	}

	async updateAdmin(id: number, data: { phone?: string; name?: string; password?: string; roleId?: number | null; avatarUrl?: string | null }) {
		const payload: any = { ...data };
		if (data.password) payload.password = await hashPassword(data.password);
		const u: any = await (this.prisma.user.update({ where: { id }, data: payload as any }) as any);
		try { await this.syncBindings('User', String(u.id), 'avatarUrl', (u as any).avatarUrl ? [(u as any).avatarUrl] : []); } catch {}
		return u;
	}

	removeAdmin(id: number) {
		if (id === 1) throw new BadRequestException('内置管理员不可删除');
		return this.prisma.user.delete({ where: { id } });
	}

	// 菜单清单（供角色权限编辑选择）
	listMenus() {
		return [
			// 集团客户
			{ key: 'group', name: '集团列表', path: '/groups' },
			{ key: 'group-vehicles', name: '集团车辆', path: '/groups/vehicles' },
			{ key: 'group-cards', name: '集团洗车卡', path: '/groups/cards' },
			{ key: 'group-balance', name: '集团余额', path: '/groups/balance' },
			{ key: 'system-basic', name: '基础设置', path: '/system/basic' },
			{ key: 'members', name: '会员列表', path: '/members' },
			{ key: 'member-signins', name: '签到管理', path: '/member-signins' },
			{ key: 'member-points', name: '积分管理', path: '/member-points' },
			{ key: 'member-levels', name: '会员等级', path: '/member-levels' },
			{ key: 'member-categories', name: '会员分类', path: '/member-categories' },
			{ key: 'member-tags', name: '会员标签', path: '/member-tags' },
			{ key: 'system-roles', name: '后台角色', path: '/system/roles' },
			{ key: 'system-admins', name: '后台管理员', path: '/system/admins' },
			{ key: 'system-files', name: '文件管理', path: '/system/files' },
			{ key: 'system-sms', name: '短信管理', path: '/system/sms' },
			{ key: 'system-employees', name: '员工配置', path: '/system/employees' },
			{ key: 'notification-overview', name: '消息总览', path: '/notification/overview' },
			{ key: 'notification-templates', name: '通知配置', path: '/notification/templates' },
			{ key: 'service-queue', name: '服务队列', path: '/service-queue' },
			{ key: 'content-notices', name: '滚动通知', path: '/content/notices' },
			{ key: 'content-banners', name: '广告横幅', path: '/content/banners' },
			{ key: 'content-reviews', name: '评价管理', path: '/content/reviews' },
			{ key: 'store-categories', name: '商品分类', path: '/store/categories' },
			{ key: 'store-products', name: '商品列表', path: '/store/products' },
			{ key: 'store-inventory', name: '库存管理', path: '/store/inventory' },
			{ key: 'orders', name: '订单列表', path: '/orders' },
			{ key: 'orders-writeoff', name: '订单作废/红冲', path: '' },
			{ key: 'after-sales', name: '售后', path: '/after-sales' },
			{ key: 'coupon-groups', name: '卡券分组', path: '/coupon/groups' },
			{ key: 'coupons', name: '卡券列表', path: '/coupon/list' },
			{ key: 'member-coupons', name: '会员卡券', path: '/coupon/member-coupons' },
			{ key: 'coupon-logs', name: '卡券流水', path: '/coupon/logs' },
			{ key: 'dashboard-metrics', name: '运营概览', path: '/dashboard' },
		];
	}

	// ===== 文件绑定辅助 =====
	private async syncBindings(tableName: string, rowId: string, fieldName: string, urls: string[]) {
		try {
			const desired = new Set<string>(await this.getAssetIdsFromUrls(urls));
			const existing: any[] = await (this.prisma as any).fileBinding.findMany({ where: { tableName, rowId: String(rowId), fieldName } });
			for (const b of existing) {
				if (!desired.has(String(b.fileId))) {
					try { await this.assets.unbindReference(String(b.fileId), String(b.id)); } catch {}
				}
			}
			for (const fid of desired) {
				const ok = existing.find((b: any) => String(b.fileId) === fid);
				if (!ok) { try { await this.assets.bindReference(String(fid), { tableName, rowId: String(rowId), fieldName }); } catch {} }
			}
		} catch {}
	}
	private async getAssetIdsFromUrls(urls: string[]): Promise<string[]> {
		const set = new Set<string>();
		for (const u of urls) {
			if (!u || typeof u !== 'string') continue;
			const s = String(u).trim();
			if (!s) continue;
			set.add(s);
			try { if (/^https?:\/\//i.test(s)) { const rel = new URL(s).pathname; if (rel) set.add(rel); } } catch {}
		}
		const arr = Array.from(set);
		if (arr.length === 0) return [];
		const rows = await (this.prisma as any).fileAsset.findMany({ where: { url: { in: arr } }, select: { id: true, url: true } });
		return Array.isArray(rows) ? rows.map((r: any) => String(r.id)) : [];
	}
}



