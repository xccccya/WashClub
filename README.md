# 🚗 巨科汽车美容管理系统

> 一体化洗车门店管理平台 - 基于 NestJS + Vue 3 + uni-app 的现代化 Monorepo 架构

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com) 
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.3.10-red)](https://nestjs.com/)
[![Vue 3](https://img.shields.io/badge/Vue-3.4.31-green)](https://vuejs.org/)

## 📋 项目概述

巨科汽车美容管理系统是一个功能完整的洗车门店管理平台，包含会员管理、订单处理、支付系统、库存管理、售后服务等核心功能。

### 📁 仓库结构
```
uniap-ai2/
├── apps/
│   ├── api/                    # 🔧 后端API服务 (NestJS + Prisma)
│   ├── miniapp-uni/           # 📱 微信小程序 (uni-app + Vue 3)
│   ├── web-admin/             # 💼 管理后台 (Vue 3 + Element Plus)
│   └── web-pos/               # 💰 收银台系统 (Vue 3 + Element Plus)
├── packages/
│   ├── api-client/            # 🔌 API客户端SDK
│   ├── shared-types/          # 📝 共享类型定义
│   ├── shared-ui/             # 🎨 共享UI组件
│   └── shared-utils/          # 🛠️ 共享工具库
```

### 🎯 核心功能模块

#### 🔐 认证授权系统
- **短信验证码登录** - 支持管理员和会员登录
- **微信小程序一键登录** - 会员微信授权登录
- **角色权限管理** - 基于角色的访问控制 (RBAC)
- **JWT Token认证** - 安全的身份验证机制

#### 👥 会员管理系统
- **会员档案** - 基础信息、等级、分类、标签
- **车辆档案** - 车辆信息绑定与管理
- **积分系统** - 积分获取、使用、等级升级
- **成长值系统** - 消费成长值累积与等级计算
- **洗车计次卡** - 卡券发放、使用、过期管理
- **收货地址** - 多地址管理
- **购物车** - 商品收藏与临时存储

#### 🛒 商店系统 
- **商品分类** - 多级分类管理
- **商品管理** - 支持三种类型：
  - 🔧 **服务项目** (SERVICE) - 洗车、美容等服务
  - 📦 **实物商品** (PHYSICAL) - 汽车用品等实体商品  
  - 🎫 **虚拟卡券** (VIRTUAL_CARD) - 洗车卡、优惠券等
- **规格管理** - 单规格/多规格(SKU)支持
- **库存管理** - 实时库存跟踪与调整
- **价格体系** - 原价、会员价、划线价

#### 📋 订单系统（**⭐ 最新重构优化**）
- **订单类型**：
  - 🔧 **服务订单** (SERVICE) - 需绑定车辆
  - 📦 **商品订单** (SP) - 支持发货物流
  - 💰 **付款订单** (FK) - 直接付款
- **订单流程**：创建 → 支付 → 履约 → 完成
- **优惠系统**：优惠券、积分抵扣、会员折扣
- **库存预占**：下单时预占库存，避免超卖

#### 💳 支付系统
- **微信支付** - JSAPI支付、付款码支付
- **线下支付** - 现金、收钱吧、其他方式
- **支付回调** - 自动处理支付结果
- **支付安全** - 签名验证、重复支付防护

#### 🔄 退款系统  
- **微信退款** - v3/v2接口支持
- **部分退款** - 支持多次部分退款
- **权益回收** - 自动回收积分、洗车卡等权益
- **库存回滚** - 退款时自动回滚库存

#### 🛠️ 售后系统
- **售后类型**：
  - 💰 **退款申请** (REFUND)
  - 🔄 **换货申请** (EXCHANGE)  
  - 🔧 **重新服务** (RE_SERVICE)
- **审核流程** - 管理员审核与处理
- **状态跟踪** - 完整的售后处理链路

#### 🚚 履约系统
- **发货管理** - 快递/无需快递发货
- **物流跟踪** - 集成探数物流查询
- **收货确认** - 用户/管理员确认收货
- **服务履约** - 服务开始/结束管理

#### ⭐ 评价系统
- **订单评价** - 5星评价 + 图片上传
- **商家回复** - 管理员回复用户评价
- **评价管理** - 后台评价审核与管理

#### 🎫 优惠券系统
- **卡券分组** - 分类管理优惠券
- **多种类型** - 满减券、折扣券、洗车卡
- **发放策略** - 手动发放、自动发放
- **使用限制** - 时间、金额、商品限制

#### 📊 内容管理
- **滚动公告** - 首页通知滚动展示
- **广告横幅** - 轮播图管理
- **评价展示** - 用户评价内容管理

#### 📨 消息通知系统（新）
- **站内消息** - 用户/管理员站内消息收发
- **消息模板** - 模板创建、变量占位、模板管理
- **实时通知** - 基于 WebSocket 的即时消息下发
- **通知分类** - 业务分组与消息类型划分

#### 🎯 服务队列
- **排队管理** - 洗车服务排队系统
- **状态跟踪** - 等待、进行中、完成状态

#### 📁 文件管理
- **文件上传** - 支持图片、文档上传
- **静态服务** - 文件访问与下载
- **文件绑定** - 关联业务数据

### 🔧 技术架构

#### 后端技术栈
- **框架**: NestJS 10.3.10 + TypeScript 5.4.5
- **数据库**: MySQL + Prisma ORM
- **认证**: JWT + 短信验证码
- **支付**: 微信支付 v3/v2 API
- **文件**: Multer + Sharp 图片处理
- **文档**: Swagger/OpenAPI 自动生成

#### 前端技术栈
- **管理后台**: Vue 3 + Element Plus + Vite
- **小程序**: uni-app + Vue 3
- **收银台**: Vue 3 + Element Plus + Vite
- **状态管理**: 原生 Composition API
- **HTTP客户端**: 基于OpenAPI自动生成

#### 架构特性
- **Monorepo**: pnpm workspaces + turbo 并行构建
- **类型安全**: 全链路 TypeScript 支持
- **API契约**: OpenAPI规范 + 自动生成客户端
- **模块化**: 微服务化的模块设计
- **可扩展**: 插件化的业务模块

## 🔌 API 接口文档

### 📋 订单相关接口
```bash
# 订单基础操作
POST   /orders                           # 创建订单
GET    /orders                           # 订单列表查询
GET    /orders/:id                       # 获取订单详情
GET    /orders/by-no/:no                 # 通过订单号获取

# 支付相关
POST   /orders/:id/pay/wechat-jsapi      # 微信JSAPI支付
POST   /orders/:id/pay/manual            # 手动确认支付
POST   /orders/:id/pay/wx-micropay       # 微信付款码支付
POST   /orders/_notify/wechat            # 微信支付回调

# 退款相关  
POST   /orders/:id/refund                # 创建退款
POST   /orders/_notify/wechat-refund     # 微信退款回调
POST   /orders/_notify/wechat-refund-v2  # 微信退款回调v2
POST   /orders/_refunds/:outRefundNo/query-v2  # 退款查询
POST   /orders/_refunds/:id/retry        # 退款重试

# 售后相关
POST   /orders/:id/after-sales           # 创建售后申请
GET    /orders/_after-sales              # 售后列表
POST   /orders/_after-sales/:id/audit    # 售后审核
POST   /orders/_after-sales/:id/exchange-ship  # 换货发货

# 履约相关
POST   /orders/:id/ship                  # 订单发货
POST   /orders/:id/ship/edit-tracking    # 修改物流单号
POST   /orders/:id/receive               # 确认收货
POST   /orders/:id/start-service         # 开始服务
POST   /orders/:id/finish-service        # 结束服务
POST   /orders/:id/cancel                # 取消订单
POST   /orders/:id/close                 # 关闭订单
POST   /orders/:id/restore               # 恢复订单

# 评价相关
POST   /orders/:id/review                # 创建评价
GET    /orders/:id/review                # 获取评价
GET    /orders/_reviews                  # 评价列表
POST   /orders/_reviews/:id/delete       # 删除评价
POST   /orders/_reviews/:id/reply        # 回复评价

# 物流相关
GET    /orders/_logistics/companies      # 物流公司列表
GET    /orders/_logistics/companies/tanshu  # 探数物流公司
GET    /orders/_logistics/query          # 物流查询
```

### 🛒 商店相关接口
```bash
# 商品分类
GET    /store/categories                 # 分类列表
POST   /store/categories                 # 创建分类
PUT    /store/categories/:id             # 更新分类
DELETE /store/categories/:id             # 删除分类

# 商品管理
GET    /store/products                   # 商品列表
GET    /store/products/:id               # 商品详情
POST   /store/products                   # 创建商品
PUT    /store/products/:id               # 更新商品
DELETE /store/products/:id               # 删除商品

# 库存管理
POST   /store/inventory/adjust           # 库存调整
GET    /store/inventory/logs             # 库存日志
```

### 👥 会员相关接口
```bash
# 会员管理
GET    /members                          # 会员列表
GET    /members/:id                      # 会员详情
POST   /members                          # 创建会员
PUT    /members/:id                      # 更新会员

# 积分管理
GET    /members/:id/points/logs          # 积分日志
POST   /members/:id/points/adjust        # 积分调整

# 洗车卡管理
GET    /members/:id/washcards            # 洗车卡列表
POST   /members/:id/washcards/use        # 使用洗车卡

# 车辆管理
GET    /members/:id/vehicles             # 车辆列表
POST   /members/:id/vehicles             # 添加车辆
PUT    /vehicles/:id                     # 更新车辆
DELETE /vehicles/:id                     # 删除车辆
```

## 📈 更新日志

### 🎉 V1.0.0 正式版 (2025-09-19)

- 新增：消息通知系统（站内消息、消息模板、WebSocket 实时通知）
- 新增：收银台系统（Web POS）：商品结算、扫码收银、微信/现金等多种支付、退款入口
- 优化：文档与用法说明完善，首个稳定版本发布
- 修复/优化了最后一版测试版存在的诸多问题：
  -修复：解决安卓微信小程序环境缺失 Intl 导致页面报错、商家中心页一直“加载中”的问题，现可正常加载并显示运营数据。
  -修复：多规格“服务”商品在规格选择弹窗中错误显示“库存：0”的问题（服务类不再展示库存）。
  -优化：收银页商品卡片缩略图调整为正方形，完整展示 800×800 主图，提升观感。
  -优化：首页「我的爱车」：无车辆时显示“暂无车辆，点击添加”，一键新增。
  -修复：管理后台-商品介绍：支持粘贴/拖拽图片自动上传为链接，解决多图保存失败问题。
  -优化：管理后台-稳定性：修复富文本与多图上传的类型兼容问题，编辑更顺畅。
  -新增：小程序设置页面关于我们入口，新增关于页。
  -优化：队列下单接口支持多规格 items[{productId, skuId}]，并校验SKU。
  -优化：管理后台/收银端入队向导支持选择SKU，确认页显示“商品名（SKU）”。
  -优化：配置抽屉与列表多规格价格显示区间“￥min ~ ￥max”（单规格显示单价）。
  -修复 web-pos 样式与类型。
  -修复-收银立减规则
        允许“最多减至 0 元”，不再被错误限制为“小计的一半”
        输入超过可减上限自动改写为“减至 0 元”的金额
        保持“0 元仅支持内部支付”的限制
  -优化-先服务后付结算流程
        仅需选择“队列类型”，服务商品直接取自结算清单
        队列类型与清单内服务商品自动适配，不兼容项会被禁用
  -修复-多规格服务商品
        入队请求携带 productId、skuId、quantity，解决“多规格缺少 SKU”导致的报错
  -生效-收银立减在先服务后付
        前端入队请求携带 cashierDiscountAmount
        后端透传并应用收银立减，按应付基数封顶，支持 0 元（仅内部支付）
  -收银立减：在后台/POS“标记支付-常规方式”新增手动立减，实时显示应收，支付前自动应用。
  -微信付款码：当应收≤0 自动禁用并提示“零元订单不支持微信付款码”。
  -后端能力：新增 POST /orders/:id/adjust-cashier-discount（仅未支付可调，自动重算并记时间线）。
  时间线中文化：后台、POS、小程序均新增“收银立减调整”显示。
### 🚀 dev v0.2.0 (2025-09-10) - 订单系统重构优化

#### 🔧 **重大重构：订单系统模块化拆分**
- **目标**：解决订单模块代码臃肿问题，提升可维护性和可扩展性
- **影响**：⭐ **零影响** - 前端无需任何改动，所有API接口保持完全兼容

#### 📦 **拆分架构**
原有臃肿文件：
- `order.controller.ts` (685行) → 拆分为专业化控制器 (379行, -45%)
- `order.service.ts` (1602行) → 拆分为7个专业服务 (687行, -57%)

新增专业化服务模块：
- **OrderService** - 核心订单管理（创建、查询、状态管理）
- **OrderPaymentService** - 支付相关（微信支付、手动支付、支付回调）
- **OrderRefundService** - 退款相关（创建退款、退款回调、退款查询）
- **OrderAfterSalesService** - 售后相关（售后申请、审核、处理）
- **OrderFulfillmentService** - 履约相关（发货、收货、服务开始/结束）
- **OrderReviewService** - 评价相关（创建评价、管理评价）
- **OrderRewardsService** - 权益相关（积分、成长值、洗车卡、优惠券）

#### ✅ **重构成果**
- ✅ **单一职责** - 每个服务专注特定业务领域
- ✅ **零破坏性** - 所有API接口、业务逻辑、数据流保持不变
- ✅ **可测试性** - 每个模块可独立进行单元测试
- ✅ **可维护性** - 代码结构清晰，便于后续开发
- ✅ **团队协作** - 不同开发者可并行开发不同模块
- ✅ **构建验证** - 全项目构建通过，无编译错误

#### 🔧 **技术实现**
- 避免循环依赖，合理设计服务间依赖关系
- 保持事务一致性和数据完整性
- 统一错误处理和日志记录机制
- 优化依赖注入和模块配置

---

### dev v0.1.x 历史更新

#### 2025-09：虚拟卡券商品支持 SKU 级卡券绑定
- 数据库新增 `ProductSku.couponId`
- 执行：`pnpm prisma generate && pnpm prisma db push`

#### 2025-09：管理后台商品编辑体验优化
- 多规格表格列宽优化，`价格/划线价/库存` 默认即可完整展示
- 虚拟卡券多规格支持"每 SKU 绑定卡券"
  - 服务类商品不参与库存：UI 隐藏库存项并在保存时强制库存归零

#### 2025-09：主题/配色系统优化
- 修复"自定义配色覆盖预设首项"的问题（改用 `custom` 通道）
  - 新增马卡龙预设三色：粉/蓝/绿
  - 暗色主题变量优化（背景/边框/填充/文字对比度）

## 🚀 快速开始

### 📋 环境要求
- **Node.js**: >= 18.0.0
- **pnpm**: >= 9.0.0 
- **MySQL**: >= 8.0
- **微信开发者工具**: 小程序开发调试

### ⚡ 一键启动
```bash
# 1. 克隆项目
git clone <repository-url>
cd uniap-ai2

# 2. 安装依赖
pnpm install

# 3. 环境配置
cp apps/api/.env.example apps/api/.env
# 编辑 .env 文件，配置数据库连接等必要信息

# 4. 数据库初始化
cd apps/api
pnpm prisma generate
pnpm prisma db push
pnpm db:seed  # 可选：导入基础数据

# 5. 启动所有服务（并行）
cd ../..
pnpm dev
```

### 🔧 单独启动服务

#### 后端API服务
```bash
cd apps/api
pnpm dev                    # 开发模式
# 或
pnpm build && pnpm start   # 生产模式
```
- 🌐 **访问地址**: http://localhost:3000
- 📚 **API文档**: http://localhost:3000/docs

#### 管理后台
```bash
cd apps/web-admin
pnpm dev
```
- 🌐 **访问地址**: http://localhost:5173

#### 微信小程序
```bash
cd apps/miniapp-uni
pnpm dev:mp-weixin    # 微信小程序
# 或
pnpm dev:h5           # H5版本
```

#### 收银台系统
```bash
cd apps/web-pos
pnpm dev
```
- 🌐 **访问地址**: http://localhost:5174

## ⚙️ 配置说明

### 🔑 必需环境变量
在 `apps/api/.env` 中配置：

```env
# 数据库连接
DATABASE_URL="mysql://user:pass@localhost:3306/jukecar"

# JWT认证
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 腾讯云短信服务
TENCENTCLOUD_SECRET_ID=your_secret_id
TENCENTCLOUD_SECRET_KEY=your_secret_key
SMS_REGION=ap-nanjing
SMS_SDK_APP_ID=your_app_id
SMS_SIGN_NAME=your_sign_name
SMS_TEMPLATE_ID=your_template_id

# 微信小程序配置
WECHAT_MINIAPP_APPID=your_miniapp_appid
WECHAT_MINIAPP_SECRET=your_miniapp_secret

# 微信支付配置
WXPAY_MCHID=your_merchant_id
WXPAY_APPID=your_app_id
WXPAY_API_V3_KEY=your_api_v3_key
WXPAY_CERT_PATH=./cert/apiclient_cert.pem
WXPAY_KEY_PATH=./cert/apiclient_key.pem
WXPAY_PLATFORM_CERT_PATH=./cert/wechatpay_platform.pem

# 服务配置
PORT=3000
TZ=Asia/Shanghai
PUBLIC_API_BASE=https://your-domain.com/api
```

### 📊 数据库管理
```bash
cd apps/api

# 生成Prisma客户端
pnpm prisma generate

# 开发环境：推送schema到数据库
pnpm prisma db push

# 生产环境：使用迁移
pnpm prisma migrate deploy

# 查看数据库
pnpm prisma studio

# 重置数据库（危险操作）
pnpm prisma migrate reset
```

## 🎨 管理后台特性

### 🖥️ 功能模块
- **会员管理** - 会员列表、等级、分类、标签、积分、签到
- **订单管理** - 订单列表、详情、支付、退款、售后、履约
- **商品管理** - 商品分类、商品列表、库存管理
- **优惠券管理** - 卡券分组、卡券列表、会员卡券
- **内容管理** - 滚动通知、广告横幅、评价管理
- **服务管理** - 服务队列、车辆档案
- **系统管理** - 角色权限、管理员、基础设置、文件管理

### 🎨 主题系统
- **明暗主题** - 支持亮色/暗色主题切换
- **多配色方案** - default/green/violet/orange/macaron系列
- **自定义主色** - 支持自定义品牌色
- **响应式设计** - 适配不同屏幕尺寸
- **持久化存储** - 主题偏好自动保存

### 🔐 权限系统
- **角色管理** - 灵活的角色权限配置
- **菜单权限** - 细粒度的功能访问控制
- **数据权限** - 基于角色的数据访问限制

## 💰 收银台特性（Web POS）

### 🛠️ 核心能力
- **快捷收银** - 条码/二维码扫码、手动选品、快速加购
- **多支付方式** - 微信（JSAPI/付款码）、现金、线下其他
- **订单关联** - 自动生成/关联订单，支持退款入口
- **会员联动** - 绑定会员、积分抵扣、成长值累积
- **硬件支持** - 扫码枪（键盘模式）、小票打印（预留）

### 🧭 操作流程
1. 选择商品/扫码加入购物车
2. 选择会员（可选）与优惠方式
3. 选择支付方式并完成收款
4. 打印/导出小票（可选），完成订单

## 📱 小程序特性

### 🎯 核心功能
- **会员中心** - 个人信息、积分、洗车卡、订单
- **商品购买** - 商品浏览、下单、支付
- **服务预约** - 洗车服务预约与排队
- **订单管理** - 订单查看、支付、评价、售后
- **微信支付** - 原生微信支付体验

### 📲 技术特性
- **uni-app框架** - 一套代码，多端运行
- **原生组件** - 使用微信小程序原生组件
- **API集成** - 基于OpenAPI自动生成的客户端
- **状态管理** - 轻量级状态管理方案

## 🏗️ 开发指南

### 📝 代码规范
- **TypeScript** - 严格类型检查
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Commit规范** - 使用约定式提交

### 🧪 测试策略
```bash
# 运行所有测试
pnpm test

# 单元测试
pnpm test:unit

# 集成测试  
pnpm test:e2e

# 测试覆盖率
pnpm test:cov
```

### 📦 构建部署
```bash
# 构建所有项目
pnpm build

# 单独构建
pnpm --filter api build
pnpm --filter web-admin build
pnpm --filter miniapp-uni build:mp-weixin
```

### 🔄 API开发流程
1. **设计API** - 在对应controller中定义接口
2. **实现业务** - 在对应service中实现逻辑
3. **生成文档** - `pnpm --filter api openapi`
4. **生成客户端** - `pnpm generate:client`
5. **前端集成** - 使用生成的客户端SDK

## 📈 项目状态

### ✅ 已完成功能
- 🔐 **认证授权** - 短信登录、微信登录、角色权限
- 👥 **会员系统** - 完整的会员管理体系
- 🛒 **商店系统** - 商品、分类、库存管理
- 📋 **订单系统** - 完整的订单处理流程（**最新重构**）
- 💳 **支付系统** - 微信支付、线下支付
- 🔄 **退款系统** - 完整的退款处理机制
- 🛠️ **售后系统** - 售后申请、审核、处理
- ⭐ **评价系统** - 订单评价与管理
- 🎫 **优惠券系统** - 优惠券发放与使用
- 📊 **内容管理** - 公告、横幅管理
- 🎯 **服务队列** - 排队管理系统
- 💰 **收银台系统** - Web POS 收银与多支付
- 📨 **消息通知** - 站内消息与实时通知
- 📊 **数据统计** - 营收、会员等统计分析
- 📁 **文件管理** - 文件上传与管理

### 🚧 开发中功能
- 🔔 **消息推送** - 微信模板消息推送

### 🗺️ 未来规划
- 📊 **BI报表** - 数据可视化分析
- 🤖 **智能推荐** - 商品推荐算法
- 🔗 **第三方集成** - 更多支付渠道、物流公司
- 📱 **移动端优化** - 更好的移动端体验

## 🛡️ 安全与运维

### 🔒 安全措施
- **环境变量管理** - 敏感信息不提交代码库
- **JWT认证** - 安全的身份验证机制
- **权限控制** - 基于角色的访问控制
- **支付安全** - 微信支付签名验证
- **SQL注入防护** - Prisma ORM安全查询

### 📁 文件管理
- **上传目录**: `apps/api/uploads/`
- **静态服务**: `/uploads` 路径
- **文件绑定**: 业务数据关联管理
- **安全策略**: 文件类型验证、大小限制

### 🔧 运维建议
- **日志监控** - 关键业务操作日志记录
- **错误处理** - 统一的异常处理机制
- **性能优化** - 数据库查询优化
- **备份策略** - 定期数据备份

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 🐛 报告问题
- 使用 [GitHub Issues](https://github.com/your-repo/issues)
- 提供详细的问题描述和复现步骤

### 💡 功能建议
- 在 Issues 中描述新功能需求
- 说明使用场景和期望效果

### 🔧 代码贡献
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

**巨科汽车美容管理系统** - 让洗车门店管理更智能、更高效！ 🚗✨

