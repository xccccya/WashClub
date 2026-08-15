# 已知问题与优化顺序

> 审计基线：2026-08-15，基于当前工作区代码、配置、Prisma schema、OpenAPI 和构建结果。未连接生产数据库、微信支付或云服务，也未做渗透测试。修复后请同步更新本文件，不要把静态审计当成永久事实。

优先级含义：P0 为在扩大使用或继续叠加业务前必须处理；P1 为直接影响可靠性与维护成本；P2 为结构性技术债。

## P0：安全与数据正确性

### 1. 已泄露或固定的凭据

阶段状态（2026-08-15）：管理后台车型页面中的固定第三方 key 已删除；车型品牌/车系只通过后端代理读取服务端环境变量，OpenAPI/SDK 响应也已补齐类型。旧值已经进入版本历史，仍必须在探数服务商侧轮换并检查调用记录；本阶段没有改写 Git 历史。其他历史凭据与危险脚本尚未完成清理。

- 本地隔离文件 `.local/quarantine/credentials/腾讯云短信相关信息资料.md` 含明文腾讯云凭据。
- 本地隔离文件 `.local/quarantine/credentials/车型查询接口文档.md` 与已跟踪的 `apps/web-admin/src/pages/MemberVehicles.vue` 出现相同探数 API key。
- `apps/api/scripts/init-db.mjs`、多个 seed 和旧部署脚本包含固定数据库或管理员凭据；部分 seed 的 `upsert.update` 会在重复运行时把密码重置为固定值。

处理：先在服务商侧轮换所有出现过的值并查调用日志，再移除固定值、改为显式安全输入。敏感本地文档不得归档进 Git。若秘密已进入 Git 历史，需要单独评估历史清理。

### 2. 管理写接口鉴权（本轮范围已修复）

阶段状态（2026-08-15）：本节列出的 Controller 与队列状态写接口已完成第一阶段修复。所有写操作均要求管理员登录，并使用现有真实权限键：`content-banners`、`content-notices`、`coupon-groups`、`member-categories`、`member-levels`、`member-tags`、`service-queue`、`store-categories`、`store-products`。当前没有明确的员工写入调用链，因此本阶段没有通过 `@AllowEmployee()` 扩大员工权限。

公开读取只保留现有业务需要：启用中的广告/公告、会员等级、商品分类/商品、队列摘要/ETA 和脱敏队列列表。`GET /queue/list` 只查询 `IN_QUEUE`/`SERVING`，从数据库层使用最小字段投影，响应由白名单 DTO 映射并由服务端遮罩车牌；管理端改用受 `service-queue` 保护的 `GET /queue/manage-list`。安全测试覆盖了无 token、缺权限和敏感字段哨兵。

| 接口域 | 公开读取 | 管理员 | 员工 |
| --- | --- | --- | --- |
| 广告/公告 | 仅 active | 管理列表与写入分别要求 `content-banners` / `content-notices` | 不允许 |
| 券组 | 无 | 列表允许任意已登录管理员；写入要求 `coupon-groups` | 不允许 |
| 会员分类/标签 | 无 | 选项列表允许任意已登录管理员；写入（及标签会员列表）分别要求 `member-categories` / `member-tags` | 不允许 |
| 会员等级 | 等级列表 | CRUD 与成长值配置要求 `member-levels` | 不允许 |
| 队列类型 | 无 | 列表、CRUD、步骤/商品绑定要求 `service-queue` | 不允许 |
| 商品分类/商品 | 列表；商品详情 | 写入分别要求 `store-categories` / `store-products` | 不允许 |
| 服务队列 | 脱敏列表、summary、ETA | 管理列表及所有状态写入要求 `service-queue` | 不允许 |

兼容性影响：分类、标签和券组的选项列表允许任意已登录管理员读取，以兼容 `members`/`coupons` 页面；对应写接口仍要求实体权限。会员列表的内联新建标签在缺少 `member-tags` 时会收到 403，后续应按权限隐藏该入口。无 `service-queue` 的 POS 管理员同样不能读取或修改队列。

已修复范围包括：

- `apps/api/src/content/ad-banner.controller.ts`
- `apps/api/src/content/scroll-notice.controller.ts`
- `apps/api/src/coupon/group.controller.ts`
- `apps/api/src/member/category.controller.ts`
- `apps/api/src/member/level.controller.ts`
- `apps/api/src/member/tag.controller.ts`
- `apps/api/src/queue/queue-type.controller.ts`
- `apps/api/src/store/category.controller.ts`
- `apps/api/src/store/product.controller.ts`

`apps/api/src/queue/queue.controller.ts` 中会改变队列或关联订单履约的操作也已纳入 `service-queue` 权限。该修复只覆盖本轮明确列出的接口，不代表全仓写接口审计已经完成。

### 3. 订单创建与读取信任边界错误

`POST /orders` 当前接受客户端提交的 `memberId`、价格、折扣、数量、运费等关键字段，服务端没有完整地以 Product/SKU 和当前会员状态重新定价；数量的校验与库存扣减口径也不一致。订单按 ID/订单号读取缺少完整的会员所有权校验。

影响包括伪造价格/数量、使用他人积分或优惠券、枚举订单和泄露个人信息。

处理：使用严格 DTO；服务端仅接受商品/SKU/数量/业务意图并重新计算金额、优惠和权益；从已验证身份推导会员；所有读写验证所有权或后台权限。

### 4. 改手机号账号接管风险（已修复）

阶段状态（2026-08-15）：已修复。`POST /auth/change-phone` 与新的 `POST /auth/change-phone/send-code` 均要求有效会员 token；Controller 显式拒绝 admin 身份，memberId 只从 Guard 注入身份获得。服务端分别向数据库中的当前手机号和请求的新手机号发送验证码，验证码同时绑定 member、手机号、阶段 purpose、五分钟有效期和最多五次尝试；存储值使用服务端秘密参与的 HMAC，正确验证会先通过 CAS 锁定，最终在同一事务中条件消费双码并更新手机号，并发重放只能成功一次。

兼容性影响：公开 `/auth/send-code` 不再接受 `changePhone` purpose；旧请求体 `{ oldPhone, newPhone, code }` 不再可用。H5 与微信小程序统一为新旧手机号双验证码流程。验证码采用 fail-closed 声明：旧码验证成功后若新码错误或最终事务失败，已声明的码需要重新发送。换号后既有 JWT 中的 phone claim 会保持旧值直到重新登录，但当前 Guard 仅以 `sub` 推导身份；后续仍应设计统一 token 撤销/刷新策略。

自动化覆盖包括无登录、错误身份、跨会员验证码、错误尝试耗尽、并发重放和成功后不可重放。仍未用真实短信服务、真实 MySQL 隔离级别或多实例部署做运行时验证。

### 5. 微信支付/退款回调校验不完整

当前回调没有完整验证微信签名请求头，也没有在所有路径严格核对商户号、appid、金额和业务订单。部分退款回调即使内部处理失败仍可能返回成功，导致上游不再重试。

处理：按微信支付规范验证签名与证书；核对所有业务字段；建立幂等状态机、失败重试和对账任务；不在补偿失败时返回虚假成功。

### 6. 旧部署和数据脚本危险或失效

- `apps/api/scripts/deploy-production.sh` 会执行数据库 reset，且混用 npm、已移除的 Prisma 参数和不可用安装顺序。
- `bootstrap-linux.sh` 在迁移失败后回退 `db push`，会掩盖迁移故障。
- 多个 seed/backfill/clear 脚本仍按旧 Prisma Client 构造方式运行，或引用已不存在的字段。
- `delete-order.mjs`、`delete-queue-item.mjs` 和 `clear-file-assets.mjs` 绕过部分库存、优惠券、权益、文件或审计补偿。

处理：停用旧部署脚本；重建可审阅的增量部署流程。所有修复脚本必须有显式目标、dry-run、备份检查、幂等设计和操作审计。

## P1：可靠性和质量门禁

### 1. 支付后的权益与退款补偿不是可靠工作流

付款状态的原子更新之后，时间线、通知、积分/成长值、虚拟卡、集团充值、队列等后续操作分散执行，且很多异常被空 `catch` 吞掉。退款的库存和权益恢复也不是一个完整事务，重试可能产生部分执行或重复执行。

建议引入 outbox/任务表、幂等键、可重试处理器和定期 reconciliation；关键补偿必须持久化失败状态，不得仅靠日志。

### 2. 自动化质量门禁仍不完整

- 根 `lint` / `format` 没有 workspace 任务，实际执行 0 个检查。
- API 已新增一组基于 Node 内置测试运行器的 P0 安全回归测试和 `test:security` 脚本，但尚无覆盖订单、支付、退款和前端的完整测试套件或 CI 门禁。
- Web/uni 的 Vite build 不等于 Vue SFC 类型检查。
- 根 build 不包含 miniapp。

建议先补 API typecheck、ESLint、Vue/uni typecheck，再覆盖鉴权、订单、支付、退款、库存、优惠券与队列的关键测试和 CI。

### 3. OpenAPI 有路径覆盖，但响应类型和安全元数据不足

`apps/api/openapi.json` 已包含 257 个 path、314 个 operation 和 105 个 schema，不再是旧文档所说的占位文件；但绝大多数生成函数返回 `Promise<void>`，大量写接口缺 request body schema，operation 也没有完整 security 声明。

处理点在后端 DTO 与 Swagger response/request 装饰器，不是继续在前端新增 `as any`。详见 [api-client.md](./api-client.md)。

### 4. 权限键和鉴权方式漂移

部分 Controller 使用的权限键与菜单/角色定义不一致，demo seed 仍写入旧权限键；还有 Controller 手动解析 JWT，绕开 Guard 对账号/角色状态的统一检查。管理员与会员 token 缺少统一撤销策略。

建议把身份解析、账号状态、权限和员工例外收敛到 Guard/策略层，并为每个权限键建立一处权威定义。

### 5. 运行时副作用和退出清理不足

API 同一进程承载 HTTP、WebSocket、Redis Pub/Sub、BullMQ Worker 和 DB scheduler。未配置 Redis 时仍会尝试默认本机端口；Redis 连接、Worker 和部分 interval 缺少完整 shutdown。`PrismaService.enableShutdownHooks()` 当前也没有装配。

建议增加显式 Redis 开关、健康检查、优雅停机和后台任务可观测性。

### 6. 文件隐私与备份语义不完整

`/uploads` 当前直接公开本地目录，`FileAsset.isPublic` 不能阻止通过 URL 访问。数据库引用和磁盘文件没有外键一致性；新 `/assets` 与旧 `/file` API 并存。

建议区分公开/私有对象，私有文件走授权下载；数据库和 uploads 做一致备份与恢复测试。

## P2：结构性技术债

### 1. 超大文件与跨域耦合

后端订单/通知服务、管理后台 Home/SystemFiles/MemberVehicles、POS Cashier/ServiceQueue 和小程序登录/订单详情均为超大单文件。Controller 直接访问 Prisma、服务重复注册、补偿逻辑重复，空 `catch` 和 `any` 很多。

建议按业务用例和状态机拆分，先给关键行为加测试，再做小步重构。

### 2. API Client 保留两套生成树

权威生成物是 `packages/api-client/src/generated/**`。`src/washClubAPI.ts`、`src/model/**` 以及几个未导出的 Extra 文件是遗留副本，却仍被 TypeScript 编译。后续应在确认无引用后删除，避免改错目录。

### 3. 前端仍有非例外手写业务请求

上传、WebSocket 和 AMap 直连是当前明确例外；通知 overview、部分洗车卡/车辆业务请求和 shared-ui 内请求应补 OpenAPI 后迁回 SDK。三端认证、WebSocket、订单/队列和会员抽屉也存在多套相似实现。

### 4. 共享包边界不清

`shared-ui` 组件直接依赖 token、权限和 API；`shared-types` 当前无人使用；内部包以源码作为 main，缺少明确 `exports`/`types`；`shared-utils/src` 同时提交 TS 与旧 JS 文件，存在解析漂移风险。

### 5. 前端路由、性能与全局补丁

管理后台所有业务页静态导入，生产主 bundle 很大；admin/POS 没有统一 404；POS 在全局改写 `EventTarget.prototype.addEventListener`，可能影响需要 `preventDefault()` 的组件；WebSocket 主动关闭仍可能触发重连。

### 6. 小程序构建和版本源漂移

小程序有两份 manifest、已跟踪 Vite timestamp 产物和复杂平台补丁。历史上 Vite 配置读取被忽略的 `unichlog.md`，并在配置加载时覆盖已跟踪 changelog 生成物。根版本、mini package 版本和 manifest 版本也不是同一体系。

根 `CHANGELOG.md` 已成为唯一受版本控制的日志源，旧 `unichlog.md` 已移入本机历史区且不再参与构建；后续仍需清理双 manifest、timestamp、生成物和版本发布流程。

## 已过时的旧审计结论

本地 `.local/archive/project-history/项目总结-现状评估-2025-12.md` 只能作为历史快照。它列出的以下问题在当前代码中已经发生变化：

- OpenAPI 已从占位变为完整 Controller 导出。
- JWT secret 已改为强制配置，不再回退 `dev_secret`。
- 密码已支持 bcrypt，旧 SHA-256 登录成功后会升级。
- 原先 ESM 路径中的裸 `require` 已清理或显式处理。
- Web 路由守卫会调用服务端 `/auth/admin/me` 校验会话。

这些改进不抵消本文件当前列出的安全与业务风险。

## 推荐实施顺序

1. 轮换已暴露秘密，停用危险脚本并限制生产入口。
2. 修复改手机号、管理写接口、队列/订单读取和订单服务端定价。
3. 完整验证支付/退款回调，建立支付后权益与退款补偿的可靠任务流。
4. 建立鉴权和关键财务链路测试、lint/typecheck/CI。
5. 补 Swagger DTO 与 SDK 响应类型，迁回手写业务请求。
6. 在测试保护下拆分超大文件、清理重复生成物和共享包边界。
