// 统一环境变量读取，兼容 H5 与 小程序 (mp-weixin)
// 仅导出实际用到的方法，避免 tree-shaking 失效导致产物缺文件

// 直接引入以触发 Vite 在构建期内联（重要：不要用动态属性访问）
// @ts-ignore
const INLINE_VITE_STORE_LOCATION = import.meta.env?.VITE_STORE_LOCATION as unknown as string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV_ANY: any = (import.meta as any)?.env || {};

function readEnvRaw(key: string): string{
	try{
		const im = ENV_ANY || {};
		// 允许传入 VITE_ 前缀或不带前缀
		const full = key.startsWith('VITE_') ? key : `VITE_${key}`;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const g: any = (typeof globalThis !== 'undefined' ? (globalThis as any) : {}) || {};
		const v = String(
			im[full] ?? im[key] ??
			g[full] ?? g[key] ??
			(g as any)?.process?.env?.[full] ?? (g as any)?.process?.env?.[key] ?? ''
		).trim();
		return v;
	}catch{ return ''; }
}

export function readStoreLocation(): string{
	return (INLINE_VITE_STORE_LOCATION || '')
		|| readEnvRaw('VITE_STORE_LOCATION')
		|| '';
}


