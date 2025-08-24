## WashClub Monorepo（开发中）

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

