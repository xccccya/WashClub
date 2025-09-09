import { Injectable, BadRequestException } from '@nestjs/common';
import { writeFileSync, existsSync, mkdirSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

export type SavedFile = { filename: string; url: string; path: string; size: number };

@Injectable()
export class FileService {
	private getUploadsRoot() { return join(process.cwd(), 'uploads'); }

	private ensureDir(dir: string) {
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	}

	private safeJoin(root: string, targetRel: string) {
		// 增强路径安全检查
		if (!targetRel || typeof targetRel !== 'string') {
			throw new BadRequestException('路径参数无效');
		}
		
		// 检查危险字符和路径遍历
		if (/[<>:"|?*\x00-\x1f]/.test(targetRel) || /\.\./.test(targetRel)) {
			throw new BadRequestException('路径包含非法字符');
		}
		
		const p = normalize(join(root, targetRel));
		if (!p.startsWith(root)) {
			throw new BadRequestException('非法路径');
		}
		return p;
	}

	saveFile(buffer: Buffer, originalName: string, dir: string): SavedFile {
		const root = this.getUploadsRoot();
		const now = new Date();
		const sub = join(dir || 'public', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
		const targetDir = this.safeJoin(root, sub);
		this.ensureDir(targetDir);
		const ext = extname(originalName || '').toLowerCase();
		const rnd = Math.random().toString(36).slice(2, 10);
		const filenameOnly = `${now.getTime()}_${rnd}${ext || ''}`;
		const abs = join(targetDir, filenameOnly);
		writeFileSync(abs, buffer);
		const relPath = [sub, filenameOnly].join(sep).split('\\').join('/');
		const size = statSync(abs).size;
		return { filename: filenameOnly, url: `/uploads/${relPath}`, path: relPath, size };
	}

	list(dir = 'public') {
		const root = this.getUploadsRoot();
		const target = this.safeJoin(root, dir);
		this.ensureDir(target);
		const results: Array<{ name: string; url: string; path: string; size: number; mtime: number }>= [];
		const walk = (d: string, prefixRel: string) => {
			for (const name of readdirSync(d)) {
				const abs = join(d, name);
				const st = statSync(abs);
				if (st.isDirectory()) walk(abs, `${prefixRel}${name}/`);
				else results.push({ name, url: `/uploads/${prefixRel}${name}`, path: `${prefixRel}${name}`, size: st.size, mtime: st.mtimeMs });
			}
		};
		walk(target, (dir.endsWith('/') ? dir : dir + '/').replace(/^\/+/, ''));
		return results.sort((a,b)=>b.mtime-a.mtime);
	}

	remove(pathRel: string) {
		const root = this.getUploadsRoot();
		const abs = this.safeJoin(root, pathRel);
		if (!existsSync(abs)) return { ok: true };
		unlinkSync(abs);
		return { ok: true };
	}
}


