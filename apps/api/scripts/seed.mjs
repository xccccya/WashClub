import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function sha256(s) {
	return crypto.createHash('sha256').update(s).digest('hex');
}

async function main() {
	// 确保内置超级管理员角色（id=1，不可删除/编辑）
	const superRole = await prisma.adminRole.upsert({
		where: { id: 1 },
		update: { name: '超级管理员', enabled: true, isSystem: true, permissions: ['*'] },
		create: { id: 1, name: '超级管理员', enabled: true, isSystem: true, permissions: ['*'] },
	});

	// 添加超级管理员账号
	const phone = '19160906595';
	const password = sha256('csc3619xcc');
	await prisma.user.upsert({
		where: { phone },
		create: { phone, password, name: 'Yuki', role: 'owner', roleId: superRole.id },
		update: { password, name: 'Yuki', role: 'owner', roleId: superRole.id },
	});
	console.log('Seeded super admin user:', phone);

	// 系统默认会员标签（不可编辑/删除/手动分配）
	const systemMemberTags = [
		{ id: 1, name: '后台手动注册账号' },
		{ id: 2, name: '手机号验证码登录自动创建账号' },
		{ id: 3, name: '微信一键登录自动创建账号' },
		{ id: 4, name: '微信一键登录绑定已有账号' },
	];
	for (const t of systemMemberTags) {
		await prisma.memberTag.upsert({
			where: { id: t.id },
			update: { name: t.name, isSystem: true },
			create: { id: t.id, name: t.name, isSystem: true },
		});
	}
	console.log('Seeded/updated system member tags #1-#4');

	// 商品分类与测试商品
	const cat = await prisma.productCategory.upsert({ where: { id: 1 }, update: { name: '洗车服务', enabled: true, weight: 100 }, create: { id: 1, name: '洗车服务', enabled: true, weight: 100 } });
	const prod1 = await prisma.product.upsert({
		where: { id: 1 },
		update: { name: '标准洗车', type: 'SERVICE', categoryId: cat.id, specType: 'SINGLE', price: 25, listPrice: 29, enabled: true, description: '标准洗车服务' },
		create: { id: 1, name: '标准洗车', type: 'SERVICE', categoryId: cat.id, specType: 'SINGLE', price: 25, listPrice: 29, enabled: true, description: '标准洗车服务' },
	});
	const prod2 = await prisma.product.upsert({
		where: { id: 2 },
		update: { name: '玻璃水', type: 'PHYSICAL', categoryId: cat.id, specType: 'SINGLE', price: 9.9, listPrice: 12.9, stockQuantity: 100, enabled: true, description: '玻璃水 500ml' },
		create: { id: 2, name: '玻璃水', type: 'PHYSICAL', categoryId: cat.id, specType: 'SINGLE', price: 9.9, listPrice: 12.9, stockQuantity: 100, enabled: true, description: '玻璃水 500ml' },
	});
	const prod3 = await prisma.product.upsert({
		where: { id: 3 },
		update: { name: '洗车计次卡（10次）', type: 'VIRTUAL_CARD', categoryId: cat.id, specType: 'SINGLE', price: 199, listPrice: 239, stockQuantity: 999999, enabled: true, description: '一次购买获得10次洗车次数' },
		create: { id: 3, name: '洗车计次卡（10次）', type: 'VIRTUAL_CARD', categoryId: cat.id, specType: 'SINGLE', price: 199, listPrice: 239, stockQuantity: 999999, enabled: true, description: '一次购买获得10次洗车次数' },
	});
	console.log('Seeded products:', prod1.id, prod2.id, prod3.id);

	// 更新超级管理员角色：追加新菜单权限（若存在）
	try {
		const role1 = await prisma.adminRole.findUnique({ where: { id: 1 } });
		if (role1 && Array.isArray(role1.permissions) && role1.permissions.includes('*')) {
			// 已有 * 则无需更新
		} else if (role1) {
			const arr = Array.isArray(role1.permissions) ? role1.permissions : [];
			const set = new Set(arr);
			['store-categories','store-products','store-inventory','orders','after-sales','coupon-groups','coupons'].forEach((k)=>set.add(k));
			await prisma.adminRole.update({ where: { id: 1 }, data: { permissions: Array.from(set) } });
			console.log('Updated role#1 permissions with store & orders menus');
		}
	} catch {}

	// 卡券分组与“10次洗车卡”，并绑定到虚拟卡券商品（id=3）
	const group = await prisma.couponGroup.upsert({ where: { id: 1 }, update: { name: '默认分组', enabled: true, weight: 100 }, create: { id: 1, name: '默认分组', enabled: true, weight: 100 } });
	const wc = await prisma.coupon.upsert({ where: { id: 1 }, update: { name: '洗车计次卡（10次）', type: 'WASH_CARD', groupId: group.id, totalTimes: 10, validDays: null, enabled: true }, create: { id: 1, name: '洗车计次卡（10次）', type: 'WASH_CARD', groupId: group.id, totalTimes: 10, validDays: null, enabled: true } });
	await prisma.product.update({ where: { id: 3 }, data: { couponId: wc.id } });
}

main().finally(async () => {
	await prisma.$disconnect();
});


