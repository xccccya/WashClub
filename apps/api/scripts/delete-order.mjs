import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function usageAndExit() {
	console.log('用法: node ./scripts/delete-order.mjs <orderId>');
	process.exit(1);
}

async function main() {
	const arg = process.argv[2];
	if (!arg) usageAndExit();
	const orderId = Number(arg);
	if (!Number.isInteger(orderId) || orderId <= 0) usageAndExit();

	const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, no: true } });
	if (!exists) {
		console.log(`订单不存在: id=${orderId}`);
		return;
	}

	await prisma.$transaction(async (tx) => {
		// 清理与订单相关的子表/日志/引用
		await tx.orderItem.deleteMany({ where: { orderId } });
		await tx.afterSalesRequest.deleteMany({ where: { orderId } });
		await tx.refundRecord.deleteMany({ where: { orderId } });
		await tx.couponRestoreLog.deleteMany({ where: { orderId } });
		await tx.couponFlowLog.deleteMany({ where: { orderId } });
		await tx.orderTimeline.deleteMany({ where: { orderId } });
		await tx.memberGrowthLog.deleteMany({ where: { orderId } });
		await tx.memberPointsLog.deleteMany({ where: { orderId } });
		await tx.serviceQueueItem.updateMany({ where: { orderId }, data: { orderId: null } });
		await tx.groupBalanceLedger.updateMany({ where: { orderId }, data: { orderId: null, orderNo: null } });
		await tx.memberCoupon.updateMany({ where: { orderId }, data: { orderId: null } });
		await tx.orderReview.deleteMany({ where: { orderId } });

		// 最后删除订单本身
		await tx.order.delete({ where: { id: orderId } });
	});

	console.log(`已删除订单及相关记录: id=${orderId}, no=${exists.no}`);
}

main()
	.catch((e) => {
		console.error('删除失败:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});


