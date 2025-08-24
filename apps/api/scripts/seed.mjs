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
}

main().finally(async () => {
	await prisma.$disconnect();
});


