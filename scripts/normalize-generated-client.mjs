import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const generatedRoot = fileURLToPath(new URL('../packages/api-client/src/generated/', import.meta.url));
const clientPath = join(generatedRoot, 'washClubAPI.ts');
const source = await readFile(clientPath, 'utf8');
const sections = [
	{ summary: '当前会员修改自己的昵称或头像' },
	{ summary: '修改我的车辆（会员端）' },
	{ summary: '删除我的车辆（会员端）' },
	{ summary: '设置我的默认车辆（会员端）' },
	{ summary: '查询起点半径内的空闲和忙碌内部司机', toEnd: true },
];
let normalized = source;

for (const { summary, toEnd = false } of sections) {
	const summaryIndex = normalized.indexOf(summary);
	if (summaryIndex < 0) continue;
	const start = normalized.lastIndexOf('/**', summaryIndex);
	if (start < 0) continue;
	const nextSection = normalized.indexOf('/**', summaryIndex + summary.length);
	const end = toEnd || nextSection < 0 ? normalized.length : nextSection;
	let section = normalized.slice(start, end).replace(/[ \t]+$/gm, '');
	if (toEnd) section = `${section.replace(/\s*$/, '')}\n`;
	normalized = `${normalized.slice(0, start)}${section}${normalized.slice(end)}`;
}

if (normalized !== source) {
	await writeFile(clientPath, normalized, 'utf8');
}
