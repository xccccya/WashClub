## WashClub Monorepo（开发中）

## 商店与订单系统（已实现）

### 后端（NestJS / Prisma）

- 数据模型：`ProductCategory`/`Product`/`ProductSku`/`InventoryLog`/`Order`/`OrderItem`，枚举：`ProductType`、`ProductSpecType`、`InventoryLogReason`、`OrderType`、`OrderStatus`、`PayStatus`、`PayMethod`
- 同步数据库：
  - 进入 `apps/api` 执行：
    - `pnpm prisma generate`
    - `pnpm prisma db push`
    - 如需基础数据：`node ./scripts/seed.mjs`

### API 路由（仅展示关键接口）

- 商品分类：
  - GET `/store/categories`
  - POST `/store/categories`
  - PUT `/store/categories/:id`
  - DELETE `/store/categories/:id`
- 商品：
  - GET `/store/products`（支持 keyword/categoryId/type/enabled 查询）
  - GET `/store/products/:id`
  - POST `/store/products`
  - PUT `/store/products/:id`
  - DELETE `/store/products/:id`
  - 上传图片：复用 `/file/upload`，拿到 `url` 后写入 `product.imageUrl` 或 `sku.imageUrl`
- 库存：
  - POST `/store/inventory/adjust`（body: { productId, skuId?, change, reason: INBOUND|OUTBOUND|ADJUSTMENT, remark? }）
- 订单（仅手动支付方式）：
  - POST `/orders` 创建订单（`type`: SERVICE|SP|FK）
  - GET `/orders` 列表，GET `/orders/:id` 详情
  - POST `/orders/:id/pay/manual` 手动确认支付（body: { method: CASH|SHOUQIANBA|OFFLINE, paidAt? }）
  - POST `/orders/:id/close` 关闭订单

### 管理后台（apps/web-admin）

- 新增菜单：商品分类、商品列表、库存管理、订单列表/详情、售后（占位）
- 角色权限键：`store-categories`、`store-products`、`store-inventory`、`orders`、`after-sales`
- 超管角色（id=1）拥有 `*`；`scripts/seed.mjs` 会为超管补齐新菜单键（若未使用 `*`）

### 小程序端（apps/miniapp-uni）

- `pages/store/index.vue` 接入分类与商品列表，点击“立即购买”直接创建未支付订单并提示到店支付（服务类需选择/绑定车辆）

### 本地运行

1) 启动 API：

```
cd apps/api
pnpm dev
```

2) 启动管理端：

```
cd apps/web-admin
pnpm dev
```

3) 启动小程序（H5 或 MP-微信）：

```
cd apps/miniapp-uni
pnpm dev:h5
# 或
pnpm dev:mp-weixin
```

一体化洗车门店管理平台（开发中）。已实现会员、车辆、计次卡、内容公告、服务排队、文件上传、短信登录等模块；订单、商品、消息通知、收银台系统正在开发中。

### 仓库结构
- apps/miniapp-uni：微信小程序（uni-app，Vue 3）
- apps/web-admin：网页管理后台（Vite + Vue 3 + Element Plus）
- apps/web-pos：网页收银台（Vite + Vue 3 + Element Plus）
- apps/api：后端（NestJS 10 + Prisma 5 + MySQL）
- packages/shared-types：共享类型
- packages/api-client：基于 OpenAPI 的前端 SDK
- packages/shared-ui：共享 UI 组件
- packages/shared-utils：共享工具与 HTTP 客户端

### 技术栈与特性
- Monorepo：pnpm workspaces + turbo
- API：NestJS，基于 Prisma 的 MySQL 持久化，内置 Swagger /docs
- Auth：短信验证码登录、小程序一键登录（微信）
- 会员：等级/标签/分类、车辆档案
- 计次卡：共享、变更日志
- 内容：滚动公告、广告 Banner
- 队列：洗车服务队列与任务
- 文件：Multer 本地上传到 /uploads 并静态服务

### 开发快速开始
1. 安装 pnpm：`npm i -g pnpm`
2. 安装依赖：`pnpm i`
3. 生成临时 OpenAPI 并生成前端 SDK（可选）：
   - `pnpm --filter api openapi`
   - `pnpm generate:client`
4. 启动全部应用（并行）：`pnpm dev`

### 后端（apps/api）
- 启动：
  - 开发：`pnpm --filter api dev`
  - 生产：`pnpm --filter api build && pnpm --filter api start`
- 端口与文档：
  - 默认端口：`3000`（可用环境变量 PORT 覆盖）
  - Swagger 文档：`/docs`
- 数据库：MySQL（Prisma）
  - 连接：`DATABASE_URL`（在 `.env` 中配置）
  - 生成客户端：`pnpm --filter api prisma:generate`
  - 推送/迁移（开发）：`pnpm --filter api prisma:push` 或 `pnpm --filter api prisma:migrate`
  - 初始化/种子脚本：`pnpm --filter api db:init`、`pnpm --filter api db:seed`

#### 必需环境变量
在 `apps/api/.env`（或根 `.env`）配置：
```
DATABASE_URL="mysql://user:pass@localhost:3306/jukecar"

# JWT
JWT_SECRET=change_me
JWT_EXPIRES_IN=7d

# 短信（腾讯云）
TENCENTCLOUD_SECRET_ID=...
TENCENTCLOUD_SECRET_KEY=...
SMS_REGION=ap-nanjing
SMS_SDK_APP_ID=...
SMS_SIGN_NAME=...
SMS_TEMPLATE_ID=...

# 微信小程序（一键登录）
WECHAT_MINIAPP_APPID=...
WECHAT_MINIAPP_SECRET=...

# 服务器
PORT=3000
TZ=Asia/Shanghai
```

### 小程序（apps/miniapp-uni）
- 开发：`pnpm --filter miniapp-uni dev:mp-weixin` 或 `dev:h5`
- 构建：`pnpm --filter miniapp-uni build:mp-weixin` 或 `build:h5`

### 管理后台（apps/web-admin）
- 开发：`pnpm --filter web-admin dev`
- 构建：`pnpm --filter web-admin build`

### 收银台（apps/web-pos）（开发中）
- 开发：`pnpm --filter web-pos dev`
- 构建：`pnpm --filter web-pos build`

### OpenAPI 与前端 SDK
- 生成后端 OpenAPI：`pnpm --filter api openapi`（输出到 `apps/api/openapi.json`）
- 根据 OpenAPI 生成前端 SDK：`pnpm generate:client`（输出到 `packages/api-client`）
- 自定义请求：`packages/shared-utils/src/http.ts` 提供 `createHttpClient`

### 运行期文件与忽略
- 上传目录：`apps/api/uploads/`（由后端启动时自动创建并以 `/uploads` 路径静态服务）
- 建议在仓库中忽略运行期上传与本地配置文件；示例见根 `.gitignore`

### 状态与路线图
- 已完成：会员、车辆、计次卡、内容公告、服务排队、短信登录/重置、文件上传
- 开发中：订单、商品、消息通知、收银台系统

### 安全与密钥
- 所有密钥与连接串请放入 `.env`，不要提交到仓库
- 如果敏感文件误提交，先 `git rm --cached` 移除并加入 `.gitignore`，必要时用 `git filter-repo` 清理历史并在云厂商重置密钥

### 许可证
暂未指定（默认保留所有权）。

