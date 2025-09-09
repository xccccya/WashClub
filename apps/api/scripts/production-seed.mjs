import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function sha256(s) {
	return crypto.createHash('sha256').update(s).digest('hex');
}

async function main() {
	console.log('🚀 开始初始化生产环境基础数据...');

	// 1) 系统默认的四个会员标签（id: 1..4, isSystem: true）
	console.log('📋 创建系统默认会员标签...');
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
	console.log('👑 创建超级管理员角色...');
	await prisma.adminRole.upsert({
		where: { id: 1 },
		update: { name: '超级管理员', enabled: true, isSystem: true, permissions: ['*'] },
		create: { id: 1, name: '超级管理员', enabled: true, isSystem: true, permissions: ['*'] },
	});

	// 3) 默认的会员等级（id=1，name=注册会员，level=1，isDefault=true）
	console.log('🏆 创建默认会员等级...');
	await prisma.memberLevel.upsert({
		where: { id: 1 },
		update: { 
			name: '注册会员', 
			level: 1, 
			requiredGrowth: 0, 
			isDefault: true,
			pointsMultiplier: 1,
			payDiscountPercent: 0
		},
		create: { 
			id: 1, 
			name: '注册会员', 
			level: 1, 
			requiredGrowth: 0, 
			isDefault: true,
			pointsMultiplier: 1,
			payDiscountPercent: 0
		},
	});

	// 4) 默认的后台管理员（phone=19160906595，name=admin，密码=csc3619xcc.，roleId=1）
	console.log('👤 创建默认管理员用户...');
	const adminPhone = '19160906595';
	const adminName = 'admin';
	const adminPasswordPlain = 'csc3619xcc.';
	const adminPasswordHashed = sha256(adminPasswordPlain);
	await prisma.user.upsert({
		where: { phone: adminPhone },
		update: { name: adminName, password: adminPasswordHashed, role: 'owner', roleId: 1 },
		create: { phone: adminPhone, name: adminName, password: adminPasswordHashed, role: 'owner', roleId: 1 },
	});

	// 5) 创建站点基础设置
	console.log('⚙️ 创建站点基础设置...');
	await prisma.siteSetting.upsert({
		where: { id: 1 },
		update: {
			title: 'WashClub 洗车行管理系统',
			growthPerYuan: 1,
			pointsPerFen: 1,
			pointsFenPerPoint: 1, // 100积分抵扣0.01元
			pointsMaxDeductFenPerOrder: 0, // 不限制
			signInConfigJson: {
				dayRewards: [10, 10, 15, 15, 20, 25, 30], // 连续7天签到奖励
				after7: 50 // 7天后每天奖励
			}
		},
		create: {
			id: 1,
			title: 'WashClub 洗车行管理系统',
			growthPerYuan: 1,
			pointsPerFen: 1,
			pointsFenPerPoint: 1, // 100积分抵扣0.01元
			pointsMaxDeductFenPerOrder: 0, // 不限制
			signInConfigJson: {
				dayRewards: [10, 10, 15, 15, 20, 25, 30], // 连续7天签到奖励
				after7: 50 // 7天后每天奖励
			}
		}
	});

	console.log('✅ 生产环境基础数据初始化完成！');
	console.log('');
	console.log('📋 已创建的基础数据：');
	console.log('👑 超级管理员: 19160906595 / csc3619xcc.');
	console.log('📋 系统会员标签: 4个');
	console.log('🏆 默认会员等级: 注册会员');
	console.log('⚙️ 积分系统配置: 100积分抵扣0.01元');
	console.log('');
	console.log('🎯 下一步：请登录管理后台完善其他配置！');
}

main()
	.then(() => {
		console.log('🎉 生产环境基础数据初始化成功！');
	})
	.catch((e) => {
		console.error('❌ 生产环境基础数据初始化失败：');
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
