# @wash/api-client

本包为 **WashClub OpenAPI 的前端/前端小程序 SDK**（由 `orval` 生成），供：

- `apps/web-admin`
- `apps/web-pos`
- `apps/miniapp-uni`

统一调用后端接口使用。

## 目录结构（关键）

- `src/generated/`：**生成物目录（严禁手改）**
- `src/http-mutator.ts`：orval 的 mutator（负责把请求实现绑定到 `@wash/shared-utils` 的 `createHttpClient`）
- `src/index.ts`：包入口，统一对外导出（业务侧只 import `@wash/api-client`）

## 重要约束（请务必遵守）

- **严禁手改**：`src/generated/**`
- **业务接口必须走 SDK**：只允许例外：
  - 文件上传（`/assets/upload`）：使用 `fetch` / `uni.uploadFile`
  - WebSocket（`/ws`）
  - 第三方接口（如 AMap）
- **禁止内部路径导入**：
  - ✅ `import { xxx } from '@wash/api-client'`
  - ❌ `import { xxx } from '@wash/api-client/src/...'`

## 生成/更新 SDK

OpenAPI 由后端生成到 `apps/api/openapi.json`，再由 orval 生成本包代码：

```bash
pnpm -F WashClubAPI run openapi
pnpm generate:client
```

建议在提交前跑一次全仓构建：

```bash
pnpm build
pnpm -F miniapp-uni run build:mp-weixin
```

## 使用方式（示例）

### Web（web-admin / web-pos）

```ts
import { memberControllerList } from '@wash/api-client';

const res: any = await memberControllerList({ page: 1, pageSize: 20, keyword: '张' } as any);
console.log(res?.items || []);
```

### 小程序（miniapp-uni）

SDK 底层会优先使用 `uni.request`，并默认从小程序 storage 读取 `token`；`baseUrl` 优先从全局/编译期注入读取（项目内由 `apps/miniapp-uni/src/utils/auth.ts` 负责设置）。

```ts
import { vehicleControllerMyVehicles } from '@wash/api-client';

const list: any = await vehicleControllerMyVehicles({} as any);
console.log(Array.isArray(list) ? list : []);
```


