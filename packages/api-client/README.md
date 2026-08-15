# @wash/api-client

WashClub 的内部 OpenAPI 客户端，供 `web-admin`、`web-pos` 和 `miniapp-uni` 使用。

## 包内结构

- `src/generated/**`：Orval 生成物，严禁手工修改。
- `src/http-mutator.ts`：把生成请求接入 `@wash/shared-utils`。
- `src/index.ts`：唯一公开入口。
- `src/washClubAPI.ts`、`src/model/**`：旧生成流程遗留，非权威文件，不得导入或继续维护。

业务代码只允许从包入口导入：

```ts
import { memberControllerList } from '@wash/api-client';
```

禁止使用 `@wash/api-client/src/...` 内部路径。

## 本包命令

```bash
# 从仓库根目录执行
pnpm -F @wash/api-client build
```

客户端生成需要先更新后端 OpenAPI，再在仓库根目录运行：

```bash
pnpm -F WashClubAPI openapi
pnpm generate:client
```

完整的生成规则、响应类型缺口、手写请求例外和验证流程见：

- [API Client 维护指南](../../docs/api-client.md)
- [项目开发指南](../../docs/development.md)


