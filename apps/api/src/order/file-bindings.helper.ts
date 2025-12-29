import type { PrismaService } from '../prisma.service.js';
import type { AssetService } from '../file/asset.service.js';

function normalizeUrls(urls: string[]): string[] {
  const set = new Set<string>();
  for (const u of urls || []) {
    if (!u) continue;
    const s = String(u).trim();
    if (!s) continue;
    set.add(s);
    try {
      if (/^https?:\/\//i.test(s)) {
        const rel = new URL(s).pathname;
        if (rel) set.add(rel);
      }
    } catch {
      // ignore url parse errors
    }
  }
  return Array.from(set);
}

async function getAssetIdsFromUrls(prisma: PrismaService, urls: string[]): Promise<string[]> {
  const arr = normalizeUrls(urls);
  if (!arr.length) return [];
  // Prisma 类型在部分环境可能滞后，这里仅对 fileAsset/fileBinding 走最小程度断言，避免把 any 扩散到调用方。
  const rows = await (prisma as unknown as { fileAsset: { findMany: Function } }).fileAsset.findMany({
    where: { url: { in: arr } },
    select: { id: true },
  });
  return Array.isArray(rows) ? rows.map((r: any) => String(r.id)) : [];
}

export async function syncFileBindings(params: {
  prisma: PrismaService;
  assets?: AssetService;
  tableName: string;
  rowId: string;
  fieldName: string;
  urls: string[];
}): Promise<void> {
  try {
    const { prisma, assets, tableName, rowId, fieldName, urls } = params;
    const desired = new Set<string>(await getAssetIdsFromUrls(prisma, urls));
    const existing = await (prisma as unknown as { fileBinding: { findMany: Function } }).fileBinding.findMany({
      where: { tableName, rowId: String(rowId), fieldName },
    });

    if (Array.isArray(existing)) {
      for (const b of existing) {
        if (!desired.has(String((b as any).fileId))) {
          try {
            await assets?.unbindReference(String((b as any).fileId), String((b as any).id));
          } catch {}
        }
      }
      for (const fid of desired) {
        const ok = existing.find((b: any) => String(b.fileId) === fid);
        if (!ok) {
          try {
            await assets?.bindReference(String(fid), { tableName, rowId: String(rowId), fieldName });
          } catch {}
        }
      }
    }
  } catch {
    // ignore
  }
}


