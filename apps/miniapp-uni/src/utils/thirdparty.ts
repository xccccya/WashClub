// 第三方服务基址，可通过 .env 注入
// VITE_AMAP_BASE 默认为 https://restapi.amap.com
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENV: any = (import.meta as any)?.env || {};
export const AMAP_API_BASE: string = String(ENV.VITE_AMAP_BASE || 'https://restapi.amap.com');


