# Codex 仓库工作规则

本文件适用于整个仓库。目标是让后续 Codex 会话可以持续开发，同时保护现有生产数据、用户改动和已经运行中的业务行为。

## 事实源与项目边界

- 当前代码、配置、Prisma schema、已提交 migration、NestJS controller/DTO 和生成后的 OpenAPI 是实现事实源。
- 根 `README.md` 与 `docs/` 下的当前文档用于解释实现；带日期的总结、阶段进展、设计草案和提示词只能作为历史背景，不能覆盖代码事实。
- 接口事实优先检查 controller、DTO 和 `apps/api/openapi.json`，不要依赖 README 中手工维护的接口清单。
- 不确定业务规则时，先从调用链、数据库模型和现有页面交叉验证；不得根据旧草案自行补全需求。
- 只处理用户授权的范围。发现相邻问题可以记录，但不要顺手扩大重构。

## 工作树保护

- 开始前和交付前都运行 `git status --short`。
- 所有已有未提交改动都视为用户所有；不得覆盖、回滚、暂存、移动或格式化这些改动。
- 禁止使用 `git reset --hard`、`git checkout --`、`git clean` 等会丢失工作的命令，除非用户明确要求并确认精确目标。
- 保持改动小而可审阅；禁止无关的全仓格式化、批量重命名或生成物刷新。
- 遵守 `.editorconfig`：UTF-8、LF、文件末尾换行、tab 缩进宽度 2、去除行尾空格；同时优先保持被编辑文件的局部风格。
- 不手改 `dist/`、`build/`、`unpackage/`、`.turbo/` 等构建产物。

## 技术边界

- 后端位于 `apps/api`，使用 NestJS 11、Prisma 7、MySQL/MariaDB adapter，并以 ESM/NodeNext 运行。
- 管理后台位于 `apps/web-admin`，POS 位于 `apps/web-pos`，小程序位于 `apps/miniapp-uni`。
- 共享包位于 `packages/`；API SDK 为 `@wash/api-client`，跨端 HTTP/API base 工具为 `@wash/shared-utils`。
- Prisma 7.2 的 Node.js 要求是 `^20.19 || ^22.12 || >=24`；不要沿用旧文档中的 Node 18 结论。
- 执行 workspace 命令前确认裸 `pnpm --version` 为 `9.6.0`。Turbo 和嵌套 package script 不一定继承 `corepack pnpm` 的版本；若 Codex fallback 解析到 pnpm 11，先修正 Corepack shim/PATH 或改做安全的直接构建，不要允许错误版本清理 `node_modules`。

## ESM 与后端代码

- `apps/api/package.json` 声明了 `"type": "module"`，`apps/api/tsconfig.json` 使用 NodeNext。
- 后端相对 import 保持编译后可解析的 `.js` 后缀。
- 禁止新增依赖全局 CommonJS `require` 的代码。确需加载 CommonJS 包时，使用标准 ESM import；只有兼容性确有要求时才显式使用 `createRequire` 并说明原因。
- 不要为了绕过类型或模块错误修改生成的 JS、降低全局编译约束或加入静默 fallback。

## API、OpenAPI 与 SDK

- 三端新增或修改的后端业务请求必须通过 `@wash/api-client` 的公开入口调用。
- 禁止从 `@wash/api-client/src/...`、`@wash/shared-utils/src/...` 等内部路径导入。
- 允许不走 SDK 的范围只有：multipart 文件上传、`/ws` WebSocket、AMap/微信等第三方服务。例外调用仍应集中封装，不能散落复制。
- API base、token 注入和全局 401 行为统一由 `@wash/shared-utils` 处理；页面不得重复创建另一套 base/token 解析逻辑。
- `packages/api-client/src/generated/**` 和 `apps/api/openapi.json` 是生成物，严禁手改。
- 后端接口、参数、DTO 或响应发生变化时，正确流程是：

  1. 完善 controller/DTO 的 Swagger 参数和响应声明。
  2. 运行 `pnpm -F WashClubAPI run openapi`。
  3. 运行 `pnpm generate:client`。
  4. 审阅 OpenAPI 与 SDK 的生成 diff，再构建受影响前端。

- 若 SDK 返回 `Promise<void>` 但运行时实际有响应，应补齐后端响应 DTO/Swagger 装饰器并重新生成；禁止手改 generated，也不要用新增永久 `any` 掩盖契约缺失。
- 存量直接请求不代表推荐模式；触及相应功能时，在能保持行为的前提下收敛到 SDK。

## 环境变量与敏感信息

- `.env`、证书、私钥、云密钥、API key、真实密码和生产连接串不得提交。
- 文档、日志、终端回报和示例只能使用明显的占位值，不得复述工作区中发现的真实凭据。
- 发现硬编码或已暴露凭据时，先报告并按已泄露处理；删除文本不能替代在服务商处轮换凭据。
- 第三方服务密钥应保留在后端环境变量中；不能把秘密放入 Web/小程序代码或 `VITE_*` 变量。公开客户端 key 也必须确认其平台限制和域名白名单。
- 新增、删除或重命名环境变量时，必须同步更新对应应用的脱敏 `.env.example` 和对应文档；后端变量使用 `apps/api/.env.example`，并核对代码实际读取的变量名。
- 检查数据库目标时不得把完整 `DATABASE_URL` 输出到聊天或日志；只报告脱敏后的主机、端口、库名和环境判断。

## Prisma 与数据库安全

- 数据模型主源是 `apps/api/prisma/schema.prisma`；Prisma 7 连接配置在 `apps/api/prisma.config.ts`。
- Prisma 7 的 `migrate dev` 与 `db push` 不会自动生成 Client；需要显式运行 `pnpm -F WashClubAPI run prisma:generate`。
- 已经应用或提交的 migration 不得改写；结构变化应创建命名清晰的新 migration，并审阅 SQL。
- 生产/预发只应通过经过审阅的 migration 和受控发布流程演进，不能用 `db push` 替代失败的 migration。
- 任何会写数据库的命令都要先确认其目标环境。以下操作没有本轮用户明确授权时一律禁止执行：

  - `prisma migrate reset`
  - `prisma db push`，尤其是 `--accept-data-loss`
  - `prisma migrate deploy`
  - 任意 seed、backfill、clear、delete、bootstrap 或 deployment 脚本
  - 手写 SQL 的 `DELETE`、`UPDATE`、`TRUNCATE`、`DROP`、批量修复

- 获得授权也不等于可以直接执行：必须再次核对脱敏后的数据库目标、备份时间与可恢复性，优先在生产副本演练，并说明预计影响范围。
- migration 出现失败或 drift 时停止，保留错误证据并制定修复方案；不得自动 fallback 到 `db push` 或 reset。
- `apps/api/scripts/README.md` 是脚本风险索引；其中脚本均不是日常开发快捷命令。

## 高风险业务域

订单、支付、退款、售后、库存、优惠券、积分、会员余额、个人/集团洗车卡、服务队列和通知属于高风险域。修改这些区域时必须：

- 先画清状态变化、调用入口、数据库写入、失败补偿和重复请求路径。
- 保持现有金额单位和舍入方式；数据库金额使用 Decimal，微信等渠道通常使用分，转换边界必须显式且可核对。
- 保持事务边界，事务内不要混用事务 client 与全局 Prisma client。
- 对支付回调、退款回调、库存扣减、权益发放/回收和通知任务保证幂等；不得仅以前端按钮禁用作为防重。
- 保留订单时间线、库存流水、积分/券/卡流水等审计记录，不以硬删除代替业务状态迁移。
- 核对管理员/会员身份、权限、资源归属和越权访问，不能信任前端传入的价格、会员、支付状态或角色。
- 修改关键路径后至少验证成功、重复请求、失败回滚、零金额/边界金额和无权限场景；无法运行环境验证时必须明确列出未验证项。

## 小程序与生成副作用

- 根 `pnpm dev` 和 `pnpm build` 不包含 `miniapp-uni`；小程序需显式运行 `pnpm -F miniapp-uni run dev:mp-weixin`、`build:mp-weixin` 或对应 H5 命令。
- `apps/miniapp-uni/vite.config.ts` 在加载配置时会根据 changelog 源写入 `src/assets/changelog.html` 与 `changelog.ts`。即使只是启动或构建，也可能让工作树变脏。
- 运行小程序命令前后都检查这些生成文件；不得把无关 changelog 覆盖混入功能提交，也不得覆盖用户已修改的生成文件。
- 不要直接编辑小程序 `dist/` 或 `unpackage/`；需要验证时使用正式脚本生成。

## 验证与交付边界

- 当前仓库没有测试脚本或测试文件，也没有有效的 lint 规则；不得声称“测试通过”或“lint 通过”来替代真实验证。
- 根 `pnpm build` 不构建小程序。按改动范围至少选择以下命令：

  - 后端：`pnpm -F WashClubAPI run build`
  - 管理后台：`pnpm -F web-admin run build`
  - POS：`pnpm -F web-pos run build`
  - SDK：`pnpm -F @wash/api-client run build`
  - shared-utils：`pnpm -F @wash/shared-utils run build`
  - 小程序：`pnpm -F miniapp-uni run build:mp-weixin`，需要时再运行 `build:h5`

- 优先运行最小且相关的验证，避免无关生成副作用。涉及跨包契约时再扩大构建范围。
- 交付时逐项报告实际运行的命令、结果、未运行的检查及原因；构建成功不等于数据库、支付或 UI 运行时已验证。
- 工具或环境失败时保留真实错误，不通过修改业务代码来迎合本机环境。

## 文档约定

- 面向维护者的文档和注释默认使用简体中文；代码标识符、命令、环境变量名保持原文。
- 行为、命令、环境变量、路由或生成流程变化时，同一改动中更新对应文档。
- 历史文档必须明确标注日期和“非当前规范”；含敏感信息的旧便笺不得归档到版本库。
- 文档地图与权威性说明见 `docs/README.md`。
