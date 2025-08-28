import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfill() {
	console.log('Backfilling orders: fulfillmentStatus/reviewStatus/deletedAt(default null) ...');
	const batchSize = 200;
	let cursorId = 0;
	let total = 0;
	for (;;) {
		const orders = await prisma.order.findMany({
			where: { id: { gt: cursorId } },
			orderBy: { id: 'asc' },
			take: batchSize,
			select: { id: true, type: true, status: true, payStatus: true, fulfillmentStatus: true, reviewStatus: true, deletedAt: true },
		});
		if (orders.length === 0) break;
		for (const o of orders) {
			let fulfillment = o.fulfillmentStatus;
			// 推导履约状态（仅当为空或需要修正时）
			if (!fulfillment) {
				if (o.type === 'FK') {
					fulfillment = 'NONE';
				} else if (o.type === 'SERVICE') {
					if (o.status === 'FULFILLED') fulfillment = 'DONE';
					else fulfillment = 'PENDING';
				} else if (o.type === 'SP') {
					if (o.status === 'CLOSED') fulfillment = 'RECEIVED';
					else if (o.status === 'FULFILLED') fulfillment = 'SHIPPED';
					else if (o.status === 'PAID') fulfillment = 'PENDING';
					else fulfillment = 'PENDING';
				}
			}
			const review = o.reviewStatus ?? 'NONE';
			await prisma.order.update({ where: { id: o.id }, data: { fulfillmentStatus: fulfillment, reviewStatus: review, deletedAt: o.deletedAt ?? null } });
			cursorId = o.id;
			total++;
		}
	}
	console.log('Backfill done. total updated:', total);
}

backfill().finally(async () => { await prisma.$disconnect(); });


