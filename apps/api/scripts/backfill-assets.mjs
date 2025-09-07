import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const prisma = new PrismaClient();

function walk(dir, list = [], prefix = '') {
	for (const name of readdirSync(dir)) {
		const abs = join(dir, name);
		const st = statSync(abs);
		if (st.isDirectory()) walk(abs, list, `${prefix}${name}/`);
		else list.push({ abs, rel: `${prefix}${name}`, size: st.size, mtime: st.mtimeMs });
	}
	return list;
}

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

function guessMimeByExt(ext) {
	switch (ext) {
		case '.png': return 'image/png';
		case '.jpg':
		case '.jpeg': return 'image/jpeg';
		case '.gif': return 'image/gif';
		case '.webp': return 'image/webp';
		case '.mp4': return 'video/mp4';
		case '.mp3': return 'audio/mpeg';
		case '.pdf': return 'application/pdf';
		default: return 'application/octet-stream';
	}
}

async function main() {
	const root = join(process.cwd(), 'uploads');
	if (!existsSync(root)) { console.log('uploads 目录不存在，跳过'); return; }
	const items = walk(root, []);
	console.log('发现文件数：', items.length);
	let created = 0, skipped = 0;
	for (const it of items) {
		const buf = readFileSync(it.abs);
		const sum = sha256(buf);
		const existed = await prisma.fileAsset.findUnique({ where: { checksumSha256: sum } }).catch(()=>null);
		if (existed) { skipped++; continue; }
		const ext = extname(it.rel).toLowerCase();
		await prisma.fileAsset.create({ data: {
			filename: it.rel.split('/').pop() || it.rel,
			extension: ext.replace(/^\./, ''),
			mimeType: guessMimeByExt(ext),
			size: it.size,
			checksumSha256: sum,
			storage: 'local',
			bucket: null,
			objectKey: it.rel,
			url: `/uploads/${it.rel.split('\\').join('/')}`,
			isPublic: true,
			tagsJson: null,
			variants: null,
			extra: null,
		}});
		created++;
	}
	console.log('导入完成，新增：', created, '，跳过（已存在）：', skipped);
}

main().finally(()=>prisma.$disconnect());


