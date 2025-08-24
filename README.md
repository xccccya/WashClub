## 洗车店会员营销系统 Monorepo

包含应用与包：
- apps/miniapp-uni：微信小程序（uni-app）
- apps/web-admin：网页管理后台（Element Plus）
- apps/web-pos：网页收银台（Element Plus）
- apps/api：后端（NestJS + Prisma + MySQL）
- packages/shared-types：共享类型与校验
- packages/api-client：OpenAPI 生成的前端 SDK
- packages/shared-ui：共享 UI 组件
- packages/shared-utils：共享工具

### 快速开始
1. 安装 pnpm：`npm i -g pnpm`
2. 安装依赖：`pnpm i`
3. 启动全部应用：`pnpm dev`

### 代码生成
- `pnpm generate:client`：根据后端 OpenAPI 生成前端 SDK（packages/api-client）

### 环境
- 后端环境变量：见 `apps/api/.env.example`

