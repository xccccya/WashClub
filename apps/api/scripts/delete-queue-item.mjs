import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
	path.resolve(__dirname, '../.env'),
	path.resolve(process.cwd(), '.env'),
	path.resolve(process.cwd(), 'apps/api/.env'),
];
for (const p of envCandidates) {
	if (fs.existsSync(p)) {
		dotenvConfig({ path: p });
		break;
	}
}

const url = process.env.DATABASE_URL;
if (!url || !url.trim()) {
	console.error('[env] 缺少 DATABASE_URL。请设置环境变量或在 apps/api/.env 中配置数据库连接串。');
	process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

function usageAndExit() {
	console.log('用法: node ./scripts/delete-queue-item.mjs <queueItemId> [--force]');
	process.exit(1);
}

function parseArgs(argv) {
	const args = argv.slice(2);
	const force = args.includes('--force');
	const idArg = args.find((a) => !a.startsWith('-'));
	if (!idArg) return { id: null, force };
	const id = Number(idArg);
	return { id: Number.isInteger(id) && id > 0 ? id : null, force };
}

async function main() {
	const { id: queueItemId, force } = parseArgs(process.argv);
	if (!queueItemId) usageAndExit();

	const item = await prisma.serviceQueueItem.findUnique({
		where: { id: queueItemId },
		select: { id: true, status: true, plateNumber: true, orderId: true },
	});
	if (!item) {
		console.log(`队列项不存在: id=${queueItemId}`);
		return;
	}

	if (!force && item.status !== 'IN_QUEUE') {
		console.log(`队列项当前状态为 ${item.status}，默认仅允许删除 IN_QUEUE 状态。若需强制删除请加 --force。`);
		process.exit(1);
	}

	await prisma.$transaction(async (tx) => {
		// 删除关联任务（ServiceTask 对队列项 onDelete: Cascade，显式删除以更稳妥）
		await tx.serviceTask.deleteMany({ where: { queueItemId: queueItemId } });
		// 删除队列项
		await tx.serviceQueueItem.delete({ where: { id: queueItemId } });
	});

	console.log(`已删除队列项: id=${queueItemId}, 车牌=${item.plateNumber || '-'}${item.orderId ? `, 关联订单=${item.orderId}` : ''}`);
}

main()
	.catch((e) => {
		console.error('删除失败:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});


