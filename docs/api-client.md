# API Client 维护指南

`@wash/api-client` 是 Admin、POS、H5 和微信小程序访问 WashClub 后端的统一客户端。本文定义生成来源、公开入口、手写请求边界和接口变更流程。

## 1. 权威生成链路

```text
apps/api 中的 Controller / DTO / Swagger 元数据
  -> apps/api/openapi.json
  -> orval.config.ts
  -> packages/api-client/src/generated/**
  -> packages/api-client/src/index.ts
  -> import '@wash/api-client'
```

各节点职责：

- `apps/api/openapi.json`：后端导出的 OpenAPI 快照。
- `orval.config.ts`：Orval 的唯一生成配置。
- `packages/api-client/src/generated/washClubAPI.ts`：生成的请求函数。
- `packages/api-client/src/generated/model/**`：生成的请求参数和模型。
- `packages/api-client/src/http-mutator.ts`：将 Orval 请求转发到 `@wash/shared-utils` 的 HTTP 实现。
- `packages/api-client/src/index.ts`：包的唯一公开入口。

Orval 的 `clean: true` 只清理 `src/generated`。任何手写文件都不得放进该目录。

## 2. 唯一允许的导入方式

业务代码只从包入口导入：

```ts
import {
  memberControllerList,
  type MemberControllerListParams,
} from '@wash/api-client';
```

禁止导入包内部路径：

```ts
// 禁止
import { memberControllerList } from '@wash/api-client/src/generated/washClubAPI';
import type { MemberControllerListParams } from '@wash/api-client/src/generated/model';
```

这样可以保证生成目录调整时业务代码不被绑定到内部结构，也能避免误用旧生成树。

## 3. 生成目录与遗留目录

### 3.1 权威文件

- `packages/api-client/src/generated/**`
- `packages/api-client/src/http-mutator.ts`
- `packages/api-client/src/index.ts`

`src/generated/**` 完全由 Orval 生成：

- 不得手工修改；
- 不得在其中新增手写 wrapper；
- 不得为通过编译而直接改生成签名；
- 发现生成问题时，应修改后端 OpenAPI 元数据、`orval.config.ts` 或 mutator，然后重新生成。

### 3.2 非权威遗留文件

以下是旧生成流程留下的重复文件，不是当前包入口的一部分：

- `packages/api-client/src/washClubAPI.ts`
- `packages/api-client/src/model/**`

不得从这些路径导入，不得把它们当作接口最新定义，也不要在接口变更时同步手改它们。当前 `tsconfig` 仍会扫描整个 `src`，所以这些遗留文件暂时还可能影响包构建；后续应在独立清理任务中删除，而不是在普通业务改动里继续维护。

仓库中的 `washCardExtra.ts`、`groupBalanceExtra.ts`、`memberPointsExtra.ts` 当前没有从包入口导出。新增手写扩展时必须使用不会与 Orval operation 名冲突的名称，并明确从 `src/index.ts` 导出；优先方案仍然是补齐 OpenAPI 后重新生成。

## 4. 运行时行为

生成请求通过 `src/http-mutator.ts` 使用 `@wash/shared-utils`：

- Web 端使用 `fetch`；
- uni-app 端优先使用 `uni.request`；
- 默认从 Web `localStorage` 或 uni storage 的 `token` 注入 Bearer token；
- API 基址由三个应用在启动时配置；具体环境变量见 [开发指南](./development.md#2-环境变量)；
- 401 会触发应用注册的全局未授权处理器；
- Orval 配置关闭了 HTTP response wrapper，调用成功时返回的是响应 body，而不是 `{ data, status, headers }`。

页面不应重复拼接 Authorization header，除非正在实现本文允许的手写请求例外。

## 5. 当前响应类型缺口

当前 OpenAPI 对请求参数的描述较完整，但大多数成功响应没有明确 schema。以仓库现有生成结果为基线：

- 共 314 个生成请求函数；
- 其中 293 个返回类型仍被生成为 `Promise<void>`；
- 实际后端通常会返回 JSON body，业务代码因此存在大量 `as any`。

2026-08-15 的 P0 第一阶段已补齐以下契约：车型品牌/车系列表、改手机号发送/提交、公开与管理队列列表、队列摘要和 ETA。调用端应直接使用生成 DTO，不再为这些接口增加 `any`。`POST /auth/change-phone` 的请求体已破坏性变更为新手机号加新旧两个验证码；管理端/POS 队列列表改用受保护的 `queueControllerManageList()`。

这意味着当前 SDK 可以作为统一的 endpoint、参数和请求运行时，但不能被描述为“完整响应类型安全”。不要因为生成类型是 `void` 就假设接口没有返回值，也不要在生成文件中直接把 `void` 改成某个本地类型。

正确修复路径：

1. 在后端为响应补充可复用 DTO 与 Swagger response schema。
2. 重新导出 `apps/api/openapi.json`。
3. 重新运行 Orval。
4. 删除调用端不再需要的 `any` 断言。

若短期必须在业务侧描述响应，可在业务模块或明确的手写适配层定义临时类型，并标注其对应 endpoint；该类型不是 OpenAPI 的替代来源。

## 6. 允许绕过 SDK 的情况

默认规则：业务后端接口必须使用 `@wash/api-client`。只有以下情况允许直接使用平台请求 API。

### 6.1 文件上传

使用浏览器 `fetch` + `FormData` 或小程序 `uni.uploadFile`。

原因：当前 shared HTTP mutator 默认按 JSON 设置 Content-Type，并会序列化非字符串 body；生成的 FormData 上传函数不能正确通过该 mutator 发送。修复 mutator 并完成三端回归前，不要改用生成的上传函数。

### 6.2 WebSocket

`/ws` 使用浏览器 `WebSocket` 或 `uni.connectSocket`。WebSocket 生命周期、首包鉴权、重连和退出登录清理属于实时连接模块，不走 HTTP SDK。

### 6.3 第三方服务

例如高德地图 API。这类请求不属于 WashClub OpenAPI，必须放在明确命名的第三方服务模块中，不得混入生成 SDK。

### 6.4 存量未覆盖请求的过渡处理

OpenAPI 暂未覆盖后端接口不构成新增手写请求的例外。存量手写业务请求是待清理债务；触及相应功能或增加新调用时，应先补后端 Swagger/OpenAPI、重新生成 SDK，再从包入口调用。

若本次授权范围不足以补契约，停止扩展该调用并记录阻碍，不要再新增 `fetch`、`uni.request` 或另一套 HTTP client。迁移存量代码时保持 token、API base、401 和错误处理行为，并在生成函数可用后删除手写实现。

除文件上传、WebSocket 和第三方服务三类明确例外外，不应在页面中新增 `fetch` 或 `uni.request`。

## 7. 接口变更工作流

### 7.1 修改后端契约

在 `apps/api` 修改 Controller、DTO、校验规则和 Swagger 元数据。新增或修改成功响应时，同时补充响应 DTO/schema，避免继续生成 `Promise<void>`。

保持 operationId 稳定。operationId 的变化会直接改变前端导出函数名，属于破坏性变更。

### 7.2 导出 OpenAPI

```bash
pnpm -F WashClubAPI openapi
```

该脚本会先构建 API，再生成 `apps/api/openapi.json`。生成后先检查 OpenAPI diff，重点确认：

- path 与 HTTP method；
- operationId；
- path/query/body 参数的必填性和类型；
- 鉴权要求；
- 成功与错误响应 schema。

### 7.3 生成客户端

```bash
pnpm generate:client
```

检查 `packages/api-client/src/generated/**` diff。生成 diff 应能由 OpenAPI 变化解释；不要在生成后追加手工补丁。

### 7.4 更新调用方

统一从 `@wash/api-client` 导入新函数和模型。若函数名与已有手写扩展冲突，应删除或重命名手写扩展，不能同时导出两个同名实现。

### 7.5 验证

```bash
pnpm -F @wash/api-client build
pnpm -F web-admin build
pnpm -F web-pos build
pnpm -F miniapp-uni build:h5
pnpm -F miniapp-uni build:mp-weixin
```

构建不能替代接口运行验证。至少人工检查一个成功请求、一个参数错误、一个 401/403 分支；支付、退款、库存、洗车卡和集团余额接口还需验证幂等性或防重复提交行为。

## 8. 变更检查清单

- [ ] 后端 DTO、校验和 Swagger 描述一致。
- [ ] 已运行 API OpenAPI 导出。
- [ ] 已运行 Orval，且没有手改 `src/generated/**`。
- [ ] 业务代码只从 `@wash/api-client` 导入。
- [ ] 没有新增不属于例外的 `fetch` / `uni.request`。
- [ ] 新增响应尽可能拥有明确 schema，而不是继续生成 `void`。
- [ ] API Client、Admin、POS、H5、mp-weixin 均完成相应验证。
- [ ] 提交中没有混入旧 `src/washClubAPI.ts` / `src/model/**` 的人工同步改动。
