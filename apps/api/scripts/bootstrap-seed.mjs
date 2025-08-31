import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function sha256(s) {
	return crypto.createHash('sha256').update(s).digest('hex');
}

async function main() {
	// 1) 系统默认的四个会员标签（id: 1..4, isSystem: true）
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

	// 2) 系统默认的后台角色（id=1，超级管理员，permissions=["*"]）
	await prisma.adminRole.upsert({
		where: { id: 1 },
		update: { name: '超级管理员', enabled: true, isSystem: true, permissions: ['*'] },
		create: { id: 1, name: '超级管理员', enabled: true, isSystem: true, permissions: ['*'] },
	});

	// 3) 默认的会员等级（id=1，name=注册会员，weight=0，isDefault=true）
	await prisma.memberLevel.upsert({
		where: { id: 1 },
		update: { name: '注册会员', weight: 0, isDefault: true },
		create: { id: 1, name: '注册会员', weight: 0, isDefault: true },
	});

	// 4) 默认的后台管理员（phone=19160906595，name=admin，密码=csc3619xcc.，roleId=1）
	// 注意：后端校验使用 sha256(password) 与库中值对比，因此落库需为 sha256(明文)
	const adminPhone = '19160906595';
	const adminName = 'admin';
	const adminPasswordPlain = 'csc3619xcc.'; // 需求给定的明文
	const adminPasswordHashed = sha256(adminPasswordPlain);
	await prisma.user.upsert({
		where: { phone: adminPhone },
		update: { name: adminName, password: adminPasswordHashed, role: 'owner', roleId: 1 },
		create: { phone: adminPhone, name: adminName, password: adminPasswordHashed, role: 'owner', roleId: 1 },
	});

	console.log('Bootstrap seed done.');
}

main().finally(async () => {
	await prisma.$disconnect();
});


