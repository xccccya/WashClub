import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const generatedRoot = fileURLToPath(new URL('../packages/api-client/src/generated/', import.meta.url));
const clientPath = join(generatedRoot, 'washClubAPI.ts');
const source = await readFile(clientPath, 'utf8');
const marker = '/**\n * @summary 查询起点半径内的空闲和忙碌内部司机';
const markerIndex = source.indexOf(marker);

if (markerIndex >= 0) {
	const existingSection = source.slice(0, markerIndex);
	const rideSection = source.slice(markerIndex).replace(/[ \t]+$/gm, '').replace(/\s*$/, '');
	await writeFile(clientPath, `${existingSection}${rideSection}\n`, 'utf8');
}
