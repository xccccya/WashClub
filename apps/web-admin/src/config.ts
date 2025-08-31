// 统一 API 基址：优先使用环境变量，避免误回退到前端 dev 端口
// 在本地未配置时，回退到 http://127.0.0.1:3000
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const API_BASE: string = String(
    import.meta.env.VITE_API_BASE || import.meta.env.VITE_APP_API_BASE || 'http://127.0.0.1:3000'
  );
