# 开发指南

本文只描述仓库当前真实可用的开发、构建和验证方式。API Client 的生成与使用规则见 [API Client 维护指南](./api-client.md)。

## 1. 运行环境

仓库根目录声明了 `pnpm@9.6.0`，Web 应用使用的 Vite 7.3 要求 Node.js `^20.19.0 || >=22.12.0`。建议统一使用 Node.js 22 LTS，并让 Corepack 使用仓库指定的 pnpm 版本。

```bash
corepack enable
corepack prepare pnpm@9.6.0 --activate

node --version
pnpm --version
```

`pnpm --version` 应输出 `9.6.0`。Turbo 和 API build 内部还会再次调用裸 `pnpm`，因此仅有 `corepack pnpm --version` 正确并不够；若 PATH 中的 `pnpm` 仍是其他版本，应先修正 Corepack shim。不要直接使用系统中较新的 pnpm 代替：pnpm 11 会忽略当前根 `package.json` 中的 `pnpm.overrides` 配置，并可能尝试重建现有 `node_modules`。

安装依赖：

```bash
pnpm install --frozen-lockfile
```

## 2. 环境变量

三个客户端应用分别从自己的目录加载 `.env.development`、`.env.production` 等 Vite 环境文件。仓库会忽略 `.env` 和 `.env.*`，这些文件是本机或部署环境配置，不应提交真实密钥。

| 变量 | 应用 | 必需性 | 说明 |
| --- | --- | --- | --- |
| `VITE_API_BASE` | Admin、POS、H5、小程序 | 生产必需 | 后端绝对地址，例如 `http://127.0.0.1:3000` 或 `https://api.example.com` |
| `VITE_APP_API_BASE` | 三端 | 兼容项 | `VITE_API_BASE` 的旧兼容名称，新配置应优先使用 `VITE_API_BASE` |
| `VITE_NO_PLATE_NUMBER` | Admin、POS | 可选 | 无牌车占位车牌，默认 `川K00000`；必须与后端 `NO_PLATE_NUMBER` 一致 |
| `VITE_GUEST_MEMBER_ID` | POS | 可选 | 游客会员 ID；不配置或为 `0` 时由后端 `GUEST_MEMBER_ID` 兜底 |
| `VITE_AMAP_KEY` | H5、小程序 | 使用地图功能时必需 | 高德客户端 Key，会进入客户端产物，不得填写服务端秘密 |
| `VITE_STORE_LOCATION` | H5、小程序 | 使用门店定位时必需 | 门店经纬度等位置配置 |
| `VITE_AMAP_BASE` | H5、小程序 | 可选 | 高德 API 基址，默认 `https://restapi.amap.com` |

注意：

- `VITE_API_BASE` 应是包含协议的绝对地址，不要写成 `/api`。
- 当前 Vite 配置没有开发代理。浏览器联调依赖后端 CORS 配置，小程序真机联调还要求 API 地址可从设备访问。
- 开发模式可通过 URL 参数 `api` / `apibase` 或 storage 临时覆盖 API 地址；生产构建禁用这些运行时覆盖。
- 所有 `VITE_*` 值都会暴露给客户端，只能存放可公开配置。
- 仓库已提供脱敏模板：`apps/api/.env.example` 以及三个客户端各自的 `.env.example`。仅在目标配置文件不存在时复制，再写入本地 `.env` / `.env.development`；不要覆盖已有本地配置，也不要把真实秘密写回模板。

## 3. 启动开发环境

建议分别启动后端和需要调试的客户端，日志更清晰。

```bash
# 后端，默认端口由后端环境配置决定，通常为 3000
pnpm -F WashClubAPI dev

# 管理后台：http://localhost:5173/admin/
pnpm -F web-admin dev

# POS：http://localhost:5174/pos/
pnpm -F web-pos dev

# 会员端 H5：http://localhost:5175/h5/
pnpm -F miniapp-uni dev:h5

# 微信小程序开发构建
pnpm -F miniapp-uni dev:mp-weixin
```

根命令：

```bash
pnpm dev
```

`pnpm dev` 通过 Turbo 并行启动有 `dev` 脚本的 workspace，目前是 API、Admin 和 POS。`miniapp-uni` 只有 `dev:h5` 与 `dev:mp-weixin`，不会被根命令启动。

## 4. 构建与预览

### 4.1 Web 与后端

```bash
# Turbo 构建 API、Admin、POS，以及拥有 build 脚本的内部包
pnpm build

# 单独构建
pnpm -F WashClubAPI build
pnpm -F web-admin build
pnpm -F web-pos build

# 预览 Web 构建产物
pnpm -F web-admin preview
pnpm -F web-pos preview
```

`pnpm build` **不构建 miniapp-uni**，因为该 workspace 没有名为 `build` 的脚本。它也不会构建没有 `build` 脚本的 `@wash/shared-ui` 和 `@wash/shared-types`。

### 4.2 H5 与微信小程序

```bash
pnpm -F miniapp-uni build:h5
pnpm -F miniapp-uni build:mp-weixin
```

微信开发者工具应打开编译输出目录，而不是 `src`：

- 开发输出：`apps/miniapp-uni/dist/dev/mp-weixin`
- 生产输出：`apps/miniapp-uni/dist/build/mp-weixin`

会员端的权威页面和应用配置分别是：

- `apps/miniapp-uni/src/pages.json`
- `apps/miniapp-uni/src/manifest.json`

### 4.3 miniapp 构建副作用

`apps/miniapp-uni/vite.config.ts` 在配置加载时会优先读取受版本控制的根 `CHANGELOG.md`（旧 `unichlog.md` 只作本地 fallback），并生成：

- `apps/miniapp-uni/src/assets/changelog.html`
- `apps/miniapp-uni/src/assets/changelog.ts`

因此启动或构建 miniapp 可能改变这两个文件。它们是生成物，不要手工编辑；构建后应检查 `git status`，确认差异是否来自更新日志的预期变化。

该 Vite 配置还包含小程序 Intl polyfill、H5 模块路径修复和文件名清洗。Web 应用使用 Vite 7，而 uni-app 当前固定在 Vite 5 与 DCloud alpha 版本；不要为了“统一版本”单独升级 miniapp 的 Vite 或 DCloud 依赖。

## 5. API Client 更新

接口变更后必须重新生成 OpenAPI 和客户端，不能直接修改生成文件：

```bash
pnpm -F WashClubAPI openapi
pnpm generate:client
```

完整流程、生成目录和手写请求例外见 [API Client 维护指南](./api-client.md)。

## 6. 验证矩阵

当前没有一个根命令能覆盖全部四个客户端目标。按改动范围执行下面的最小验证；涉及共享代码时应执行所有消费者构建。

| 改动范围 | 最小构建验证 | 还需人工检查 |
| --- | --- | --- |
| 仅 Admin | `pnpm -F web-admin build` | 登录、权限菜单、改动页面、401 跳转 |
| 仅 POS | `pnpm -F web-pos build` | 登录、触屏交互、收银/队列/订单相关流程 |
| miniapp 公共代码 | `pnpm -F miniapp-uni build:h5` 和 `pnpm -F miniapp-uni build:mp-weixin` | H5 与微信开发者工具各验证一次 |
| `@wash/shared-ui` | Admin、POS 两个 build | 两端使用该组件的页面 |
| `@wash/shared-utils` | `pnpm -F @wash/shared-utils build`，再构建 Admin、POS、H5、小程序 | API 基址、token、401、错误提示 |
| API DTO / Controller / OpenAPI | API build、重新生成 SDK、`pnpm -F @wash/api-client build`，再构建四个客户端目标 | 请求参数、响应结构、权限、错误分支 |
| 全仓回归 | `pnpm build`，再执行 miniapp 的两个 build | 下方冒烟清单 |

建议的前端全目标验证命令：

```bash
pnpm -F web-admin build
pnpm -F web-pos build
pnpm -F miniapp-uni build:h5
pnpm -F miniapp-uni build:mp-weixin
```

最低人工冒烟清单：

1. Admin 与 POS 可以登录，刷新后仍能恢复会话。
2. 无效 token 会清理登录态并返回登录页。
3. 至少打开一个列表、详情和写操作，确认 API 基址、参数和响应结构正确。
4. 涉及支付、退款、洗车卡、集团余额或库存时，验证失败分支不会造成重复提交。
5. 消息相关改动需验证首次连接、断线重连、退出登录后的连接停止。
6. miniapp 改动需同时验证 H5 与微信小程序，不能只验证其中一个平台。

## 7. 当前质量门禁的真实状态

目前仓库还没有可靠的自动质量门禁：

- 根目录存在 `pnpm lint` 和 `pnpm format`，但任何 workspace 都没有对应脚本；它们不是有效校验。
- ESLint 配置当前只有忽略目录，没有启用代码规则。
- 没有单元测试、集成测试或 E2E 测试脚本。
- 没有 `vue-tsc` / uni-app 类型检查脚本。
- Vite build 负责转译和打包，不等同于完整的 Vue SFC 类型检查。
- `@wash/api-client` 与 `@wash/shared-utils` 的 `tsc` build 能检查各自 TypeScript，但不能替代三端检查。

提交说明和交接文档必须准确写明实际执行过哪些命令及哪些人工流程，不能笼统声称“已通过 lint/test/typecheck”。

## 8. 部署路径要求

- Admin 构建基路径是 `/admin/`，服务器需把 `/admin/*` 的前端路由回退到 Admin 的 `index.html`。
- POS 构建基路径是 `/pos/`，服务器需把 `/pos/*` 回退到 POS 的 `index.html`。
- H5 构建基路径是 `/h5/`，应用使用 hash 路由。
- API 与 Web 当前没有同源代理约定；反向代理、CORS、HTTPS 和 WebSocket `/ws` 转发需要在部署层明确配置。
