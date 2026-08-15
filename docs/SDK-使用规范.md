# API Client 使用规范（兼容入口）

原“SDK 最小规范”已合并到 [API Client 维护指南](./api-client.md)。请以后者作为唯一详细规范；本文件只为保留旧链接。

最重要的边界：

- 业务请求只从 `@wash/api-client` 包入口导入。
- 严禁手改 `packages/api-client/src/generated/**`。
- 文件上传、WebSocket 和第三方 API 是明确例外。
- 契约缺失时修后端 DTO/Swagger 并重新生成，不在页面永久追加 `any` 或手写重复请求。
