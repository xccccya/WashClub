import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function sha256(s) {
	return crypto.createHash('sha256').update(s).digest('hex');
}

// 生成随机手机号
function generatePhone() {
	const prefixes = ['138', '139', '150', '151', '152', '158', '159', '178', '188', '189'];
	const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
	const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
	return prefix + suffix;
}

// 生成随机姓名
function generateName() {
	const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'];
	const names = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞'];
	const surname = surnames[Math.floor(Math.random() * surnames.length)];
	const name = names[Math.floor(Math.random() * names.length)];
	return surname + name;
}

// 生成随机车牌号
function generatePlateNumber() {
	const provinces = ['京', '津', '冀', '晋', '蒙', '辽', '吉', '黑', '沪', '苏', '浙', '皖', '闽', '赣', '鲁', '豫', '鄂', '湘', '粤', '桂', '琼', '渝', '川', '贵', '云', '藏', '陕', '甘', '青', '宁', '新'];
	const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
	const numbers = '0123456789';
	
	const province = provinces[Math.floor(Math.random() * provinces.length)];
	const cityCode = letters[Math.floor(Math.random() * letters.length)];
	
	let suffix = '';
	for (let i = 0; i < 5; i++) {
		if (Math.random() < 0.7) {
			suffix += numbers[Math.floor(Math.random() * numbers.length)];
		} else {
			suffix += letters[Math.floor(Math.random() * letters.length)];
		}
	}
	
	return province + cityCode + suffix;
}

async function main() {
	console.log('🌱 开始生成演示数据...');

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

	// 3) 创建额外的管理员角色
	console.log('👥 创建其他管理员角色...');
	const roles = [
		{ id: 2, name: '店长', permissions: ['member', 'order', 'store', 'queue', 'coupon'] },
		{ id: 3, name: '收银员', permissions: ['order', 'member-points', 'queue'] },
		{ id: 4, name: '客服', permissions: ['member', 'order', 'after-sales'] },
	];
	for (const role of roles) {
		await prisma.adminRole.upsert({
			where: { id: role.id },
			update: { name: role.name, enabled: true, isSystem: false, permissions: role.permissions },
			create: { id: role.id, name: role.name, enabled: true, isSystem: false, permissions: role.permissions },
		});
	}

	// 4) 默认的会员等级
	console.log('🏆 创建会员等级...');
	const memberLevels = [
		{ id: 1, name: '注册会员', level: 1, requiredGrowth: 0, isDefault: true, pointsMultiplier: 1, payDiscountPercent: 0 },
		{ id: 2, name: '银卡会员', level: 2, requiredGrowth: 1000, isDefault: false, pointsMultiplier: 1, payDiscountPercent: 5 },
		{ id: 3, name: '金卡会员', level: 3, requiredGrowth: 5000, isDefault: false, pointsMultiplier: 2, payDiscountPercent: 8 },
		{ id: 4, name: 'VIP会员', level: 4, requiredGrowth: 20000, isDefault: false, pointsMultiplier: 3, payDiscountPercent: 12 },
	];
	for (const level of memberLevels) {
		await prisma.memberLevel.upsert({
			where: { id: level.id },
			update: { 
				name: level.name, 
				level: level.level, 
				requiredGrowth: level.requiredGrowth, 
				isDefault: level.isDefault,
				pointsMultiplier: level.pointsMultiplier,
				payDiscountPercent: level.payDiscountPercent
			},
			create: { 
				id: level.id, 
				name: level.name, 
				level: level.level, 
				requiredGrowth: level.requiredGrowth, 
				isDefault: level.isDefault,
				pointsMultiplier: level.pointsMultiplier,
				payDiscountPercent: level.payDiscountPercent
			},
		});
	}

	// 5) 默认的后台管理员（phone=19160906595，name=admin，密码=csc3619xcc.，roleId=1）
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

	// 6) 创建其他管理员用户
	console.log('👥 创建其他管理员用户...');
	const adminUsers = [
		{ phone: '13800000001', name: '店长张三', role: 'manager', roleId: 2 },
		{ phone: '13800000002', name: '收银员李四', role: 'staff', roleId: 3 },
		{ phone: '13800000003', name: '客服王五', role: 'staff', roleId: 4 },
	];
	for (const user of adminUsers) {
		await prisma.user.upsert({
			where: { phone: user.phone },
			update: { name: user.name, password: sha256('123456'), role: user.role, roleId: user.roleId },
			create: { phone: user.phone, name: user.name, password: sha256('123456'), role: user.role, roleId: user.roleId },
		});
	}

	// 7) 创建会员分类
	console.log('📂 创建会员分类...');
	const memberCategories = [
		{ id: 1, name: '普通客户', weight: 0 },
		{ id: 2, name: '企业客户', weight: 10 },
		{ id: 3, name: '老客户', weight: 20 },
		{ id: 4, name: 'VIP客户', weight: 30 },
	];
	for (const category of memberCategories) {
		await prisma.memberCategory.upsert({
			where: { id: category.id },
			update: { name: category.name, weight: category.weight },
			create: { id: category.id, name: category.name, weight: category.weight },
		});
	}

	// 8) 创建演示会员
	console.log('👤 创建演示会员...');
	const demoMembers = [];
	for (let i = 1; i <= 20; i++) {
		const phone = i <= 5 ? `1380000000${i}` : generatePhone();
		const name = generateName();
		const points = Math.floor(Math.random() * 5000);
		const growthPoints = Math.floor(Math.random() * 10000);
		const levelId = growthPoints >= 20000 ? 4 : growthPoints >= 5000 ? 3 : growthPoints >= 1000 ? 2 : 1;
		const categoryId = Math.floor(Math.random() * 4) + 1;
		
		const member = await prisma.member.create({
			data: {
				uid: 100000 + i,
				name: name,
				phone: phone,
				points: points,
				growthPoints: growthPoints,
				levelId: levelId,
				categoryId: categoryId,
				tags: {
					connect: [{ id: Math.floor(Math.random() * 4) + 1 }]
				}
			}
		});
		demoMembers.push(member);
	}

	// 9) 为会员创建车辆
	console.log('🚗 创建演示车辆...');
	for (let i = 0; i < demoMembers.length; i++) {
		const member = demoMembers[i];
		const vehicleCount = Math.floor(Math.random() * 3) + 1; // 每个会员1-3辆车
		
		for (let j = 0; j < vehicleCount; j++) {
			await prisma.vehicle.create({
				data: {
					plateNumber: generatePlateNumber(),
					brand: ['奔驰', '宝马', '奥迪', '大众', '丰田', '本田', '日产', '现代'][Math.floor(Math.random() * 8)],
					series: ['轿车', 'SUV', 'MPV'][Math.floor(Math.random() * 3)],
					typeMain: '小型车',
					color: ['黑色', '白色', '银色', '红色', '蓝色'][Math.floor(Math.random() * 5)],
					memberId: member.id,
					isDefault: j === 0 // 第一辆车设为默认
				}
			});
		}
	}

	// 10) 创建商品分类
	console.log('📦 创建商品分类...');
	const productCategories = [
		{ id: 1, name: '洗车服务', weight: 100 },
		{ id: 2, name: '美容护理', weight: 90 },
		{ id: 3, name: '汽车用品', weight: 80 },
		{ id: 4, name: '会员卡券', weight: 70 },
	];
	for (const category of productCategories) {
		await prisma.productCategory.upsert({
			where: { id: category.id },
			update: { name: category.name, weight: category.weight, enabled: true },
			create: { id: category.id, name: category.name, weight: category.weight, enabled: true },
		});
	}

	// 11) 创建演示商品
	console.log('🛍️ 创建演示商品...');
	const products = [
		// 洗车服务
		{ name: '基础洗车', categoryId: 1, type: 'SERVICE', price: 25.00, pointsDeductible: true, memberDiscount: true },
		{ name: '精洗套餐', categoryId: 1, type: 'SERVICE', price: 45.00, pointsDeductible: true, memberDiscount: true },
		{ name: '豪华洗车', categoryId: 1, type: 'SERVICE', price: 68.00, pointsDeductible: true, memberDiscount: true },
		
		// 美容护理
		{ name: '车内清洁', categoryId: 2, type: 'SERVICE', price: 80.00, pointsDeductible: true, memberDiscount: true },
		{ name: '打蜡抛光', categoryId: 2, type: 'SERVICE', price: 120.00, pointsDeductible: true, memberDiscount: true },
		{ name: '镀膜护理', categoryId: 2, type: 'SERVICE', price: 300.00, pointsDeductible: false, memberDiscount: true },
		
		// 汽车用品
		{ name: '洗车液', categoryId: 3, type: 'PHYSICAL', price: 35.00, stockQuantity: 100, pointsDeductible: true, memberDiscount: false },
		{ name: '车载香水', categoryId: 3, type: 'PHYSICAL', price: 15.00, stockQuantity: 50, pointsDeductible: true, memberDiscount: false },
		{ name: '洗车毛巾', categoryId: 3, type: 'PHYSICAL', price: 8.00, stockQuantity: 200, pointsDeductible: true, memberDiscount: false },
	];

	for (let i = 0; i < products.length; i++) {
		const product = products[i];
		await prisma.product.create({
			data: {
				name: product.name,
				categoryId: product.categoryId,
				type: product.type,
				price: product.price,
				listPrice: product.price * 1.2, // 原价比现价高20%
				stockQuantity: product.stockQuantity || null,
				pointsDeductible: product.pointsDeductible,
				memberDiscount: product.memberDiscount,
				enabled: true,
				sortWeight: 100 - i * 5,
				initialSales: Math.floor(Math.random() * 100),
				sellPoint: '热销推荐'
			}
		});
	}

	// 12) 创建站点设置
	console.log('⚙️ 创建站点设置...');
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

	// 13) 创建滚动通知
	console.log('📢 创建滚动通知...');
	const notices = [
		{ type: 'home', content: '欢迎使用WashClub洗车行管理系统！', enabled: true },
		{ type: 'store', content: '新用户注册即送100积分，快来体验吧！', enabled: true },
	];
	for (let i = 0; i < notices.length; i++) {
		const notice = notices[i];
		await prisma.scrollNotice.create({
			data: {
				type: notice.type,
				content: notice.content,
				enabled: notice.enabled
			}
		});
	}

	// 14) 为部分会员生成积分和成长值记录
	console.log('📊 生成会员积分和成长值记录...');
	for (let i = 0; i < Math.min(demoMembers.length, 10); i++) {
		const member = demoMembers[i];
		
		// 生成几条积分记录
		for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
			const sources = ['PAY', 'ADMIN'];
			const source = sources[Math.floor(Math.random() * sources.length)];
			const change = Math.floor(Math.random() * 100) + 10;
			
			await prisma.memberPointsLog.create({
				data: {
					memberId: member.id,
					change: change,
					source: source,
					desc: source === 'PAY' ? '消费获得积分' : '后台调整积分'
				}
			});
		}
		
		// 生成几条成长值记录
		for (let j = 0; j < Math.floor(Math.random() * 5) + 1; j++) {
			const sources = ['PAY', 'SIGN', 'ADMIN'];
			const source = sources[Math.floor(Math.random() * sources.length)];
			const change = Math.floor(Math.random() * 200) + 50;
			
			await prisma.memberGrowthLog.create({
				data: {
					memberId: member.id,
					change: change,
					source: source,
					desc: source === 'PAY' ? '消费获得成长值' : source === 'SIGN' ? '签到获得成长值' : '后台调整成长值'
				}
			});
		}
	}

	console.log('✅ 演示数据生成完成！');
	console.log('');
	console.log('📋 创建的数据摘要：');
	console.log(`👑 管理员用户: 4个 (超管: 19160906595/csc3619xcc.)`);
	console.log(`👤 演示会员: ${demoMembers.length}个`);
	console.log(`🚗 演示车辆: ${await prisma.vehicle.count()}辆`);
	console.log(`🛍️ 演示商品: ${products.length}个`);
	console.log(`🏆 会员等级: ${memberLevels.length}个`);
	console.log(`📂 商品分类: ${productCategories.length}个`);
	console.log(`📋 会员标签: 4个系统标签`);
	console.log('');
	console.log('🔧 积分系统配置：');
	console.log('   - 消费1分获得1积分');
	console.log('   - 100积分可抵扣0.01元');
	console.log('   - 无单笔订单抵扣限制');
}

main()
	.then(() => {
		console.log('🎉 演示数据种子脚本执行成功！');
	})
	.catch((e) => {
		console.error('❌ 演示数据种子脚本执行失败：');
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
