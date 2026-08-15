# 数据库与 Prisma 规范

> 本文是当前仓库的数据库安全操作规范。任何生产变更都必须同时遵循 [operations.md](./operations.md)。最后核对日期：2026-08-15。

## 1. 当前事实

- 数据库 provider 为 MySQL，运行时通过 `@prisma/adapter-mariadb` 连接 MySQL/MariaDB。
- Prisma Client 和 CLI 版本为 7.2.x。
- 数据模型：`apps/api/prisma/schema.prisma`。
- Prisma 7 datasource URL：`apps/api/prisma.config.ts`，不是 schema 内的 `url = env(...)`。
- 迁移目录：`apps/api/prisma/migrations`。
- 运行时连接：`apps/api/src/prisma.service.ts`。
- `DATABASE_URL` 是 API 启动和 Prisma CLI 的必要变量。

当前 schema 约有 57 个 model、30 个 enum，覆盖管理用户/权限、会员/车辆/卡、集团、商品/SKU/库存、优惠券、订单/支付/退款/售后、排队、文件和通知。

`prisma validate` 只能证明 schema/config 可解析，不能证明目标数据库与迁移历史一致。必须连接目标数据库执行 `prisma migrate status` 并做业务检查。

## 2. 工作目录和环境加载

从仓库根目录使用 filter 执行 Prisma，确保 CLI 在 `apps/api` 包上下文运行：

```powershell
pnpm --filter WashClubAPI exec prisma validate
pnpm --filter WashClubAPI exec prisma migrate status
pnpm --filter WashClubAPI run prisma:generate
```

`apps/api/prisma.config.ts` 按当前 cwd 查找以下候选文件：

1. `.env`
2. `apps/api/.env`
3. `prisma/.env`
4. `apps/api/prisma/.env`

dotenv 默认不覆盖已经加载的变量。执行命令前应打印“连接目标的非秘密标识”，例如主机、端口、数据库名和环境名称；不要把完整 `DATABASE_URL` 或密码写入日志。

## 3. 本地 schema 变更流程

只在本地、可丢弃的开发数据库上使用 `migrate dev`。

1. 确认 Git 工作区，避免覆盖他人 schema 或迁移。
2. 为当前任务准备独立的开发数据库。
3. 修改 `apps/api/prisma/schema.prisma`。
4. 使用有意义且唯一的迁移名生成迁移：

   ```powershell
   pnpm --filter WashClubAPI exec prisma migrate dev --name add_example_field
   ```

5. 人工审查新生成的 `migration.sql`，特别检查：
   - DROP/TRUNCATE/重建表；
   - 非空列是否有安全默认值或分阶段回填；
   - 索引创建对大表的锁表影响；
   - enum、外键、唯一约束是否会与现有脏数据冲突；
   - 金额精度、字符集和时区是否变化。
6. 执行：

   ```powershell
   pnpm --filter WashClubAPI exec prisma validate
   pnpm --filter WashClubAPI run prisma:generate
   pnpm --filter WashClubAPI exec tsc --noEmit
   ```

7. 在包含代表性数据的数据库副本上演练迁移和回滚预案。
8. 一起提交 schema、迁移 SQL、业务代码和文档。

`apps/api/package.json` 中的 `prisma:migrate` 固定使用迁移名 `init`，不适合后续日常迁移；优先使用上面的显式命令。

## 4. 生产迁移流程

生产环境只允许执行已提交、已审查的迁移：

```powershell
pnpm --filter WashClubAPI run prisma:deploy
```

标准顺序：

1. 确认目标环境和 `DATABASE_URL`。
2. 记录当前应用版本和 `_prisma_migrations` 状态。
3. 同时备份数据库和 `uploads/`，并校验备份可读。
4. 在生产数据副本演练同一批迁移。
5. 根据兼容性决定先发布代码还是先迁移。优先采用 expand/contract：先增加兼容字段，再回填和切换代码，最后在后续版本删除旧字段。
6. 执行 `prisma migrate deploy`。
7. 再次执行 `prisma migrate status`。
8. 启动应用并完成健康检查和业务烟测。
9. 观察错误日志、慢查询、订单支付与通知积压。

Prisma 不提供安全的自动 down migration。生产迁移失败时，优先停止发布、恢复兼容版本，并创建经过审查的向前修复迁移；不要使用 reset 或 db push“修好”迁移记录。

## 5. 金额、积分和数量

### 金额

schema 中商品价格、订单金额、退款金额、会员/集团余额和流水金额大多使用：

```prisma
Decimal @db.Decimal(12, 2)
```

当前业务单位是“元”，保留两位小数，不是整数分。新代码应遵守：

- 数据库计算优先使用 Prisma Decimal 或规范化十进制字符串。
- 不使用 JavaScript 浮点数直接累计、比较或作为幂等判断。
- 所有外部输入必须限制为非负、两位小数，并设置合理上限。
- 支付回调金额应转换为同一单位后与数据库应付金额精确比较。
- 退款累计必须保证 `0 <= refundedAmount <= 实际可退金额`。

订单至少区分 `totalAmount`、`discountAmount`、`memberDiscountAmount`、`cashierDiscountAmount`、`payAmount`、`washCardDeductAmount`、`refundedAmount`、`shippingFee` 和 `pointsAmount`。不要用单个字段推断全部财务含义。

集团余额或洗车卡支付时 `Order.payAmount` 可能被置为 0，资金报表必须结合集团流水、洗车卡扣减和支付方式。会员 `balance` 字段目前偏历史数据，不应未经业务确认直接接入支付。

### 积分、成长值和次数

积分、成长值、库存、洗车卡次数使用整数。必须校验非负和上下限；涉及并发扣减时使用条件更新、原子增减或 version 乐观锁，禁止“先读余额，再写绝对值”。

`SystemSettings` 同时保留 `pointsPerYuan` 和历史 `pointsPerFen`。现有代码会在新版配置为 0 时回退旧字段，清理旧字段前必须先完成数据迁移和代码切换。

## 6. 时间与时区

- API 默认尝试使用 `TZ=Asia/Shanghai`。
- Prisma 数据库连接建立后执行 `SET time_zone = '+08:00'`。
- MySQL `DateTime`/`DATETIME` 本身不携带时区。

当前业务实际上依赖中国标准时间语义。不要在单个功能中擅自切换为 UTC。新增代码应：

- 对外接口使用明确带 offset 的 ISO 8601，或清楚注明为 Asia/Shanghai。
- 比较超时、营业日和签到日期时统一经过同一时区规则。
- 不依赖宿主机默认时区。
- 变更 `TZ` 或数据库 session 时区前，先审计订单过期、通知调度、签到和报表边界。

注意：`main.ts` 当前在 Nest 应用创建后才设置默认 `TZ`，模块初始化阶段仍可能受宿主机时区影响；部署环境应显式设置 `TZ=Asia/Shanghai`。

## 7. 事务、一致性和幂等

### 已有较强保证

- 普通下单主要在一个事务内创建订单、预占库存、扣积分并占用优惠券。
- 支付状态使用条件更新将 `UNPAID` 原子切换为 `PAID`。
- 集团余额账户有 version 字段和余额流水。
- 通知数据库任务有领取/状态字段，可用于兜底调度。

### 当前不能假定的保证

- 支付成功不保证奖励、虚拟卡、集团充值权益和通知均已完成。
- 完整退款及库存/积分/券/卡/集团余额回滚不是单一事务。
- 队列创建和服务订单创建不是同一事务。
- 队列完工和订单履约同步不是同一事务。
- 优惠券恢复常发生在订单事务外。
- 个人/集团洗车卡部分路径仍为先读后写。
- 订单 Service 上的临时积分比例存在并发串值风险。

新建跨域流程时，必须明确：

1. 哪个表是状态权威来源；
2. 哪一步是提交点；
3. 重复请求的幂等键；
4. 提交后副作用如何持久化、重试和对账；
5. 部分成功时的人机可见状态；
6. 人工补偿是否有审计记录。

支付、退款、库存和余额修改不得以空 `catch` 作为容错方案。

## 8. 数据约束和删除语义

- Product 和 Group 等模型含 `deletedAt`，但并非所有查询都一致过滤软删除数据。
- ProductCategory 等部分模型使用硬删除。
- Vehicle 的 `memberId`/`groupId` 互斥仅靠业务代码，没有数据库 CHECK。
- Group 最后一名 ADMIN 的移除规则与“零成员才能删除”的规则冲突。
- FileBinding 使用业务字符串引用，没有外键级联。
- 多个流程依赖固定系统标签 ID、游客会员和集团占位会员。

新增删除功能前必须列出：软删除还是硬删除、所有引用表、库存/积分/余额补偿、文件绑定、审计记录和可恢复方式。不得用通用 Prisma delete 脚本代替业务删除。

## 9. 迁移历史说明

当前迁移的主要节点：

| 迁移 | 说明 |
| --- | --- |
| `20250918075720_init` | 大型基线，创建绝大多数业务表 |
| `20250919120226_enlarge_product_description` | 商品描述改为 LONGTEXT |
| `20250919120327_enlarge_product_description` | 空的重复迁移；保留历史，不要重写已部署迁移 |
| `20251010045609_add_business_hour` | 营业时间 |
| `20251014034603_add_veh_log` | 车辆日志 |
| `20251229000100_add_notification_job` | 数据库通知任务 |
| `20260101080000_add_wxapp_subscribe_message` | 微信订阅消息 |
| `20260105000000_add_points_per_yuan` | 新积分比例并从旧字段回填 |

已经进入共享或生产环境的 migration.sql 不得修改或重新排序。需要修正时创建新的向前迁移。

## 10. 高风险命令

| 命令 | 风险 | 规则 |
| --- | --- | --- |
| `prisma migrate reset` | 删除并重建整个数据库 | 禁止对生产和共享环境执行 |
| `prisma db push` | 绕过迁移历史，可能直接改变或丢弃结构 | 禁止生产使用；本地原型也应优先迁移 |
| `prisma migrate dev` | 使用 shadow DB，并可能要求 reset | 仅独立本地开发库 |
| `prisma migrate resolve` | 直接改变迁移历史认定 | 只由确认过实际 SQL 状态的负责人执行并记录原因 |
| 直接 `DELETE`/`TRUNCATE` | 绕过业务补偿和审计 | 必须有备份、影响清单、双人复核和恢复方案 |

`apps/api/scripts/deploy-production.sh` 包含 `prisma migrate reset --force --skip-seed`，绝对禁止使用。`bootstrap-linux.sh` 在 migrate deploy 失败后回退到 `db push`，也禁止作为部署入口。

## 11. 数据脚本现状

以下脚本仍以 Prisma 7 不接受的无参数 `new PrismaClient()` 初始化，当前不能视为可运行工具：

- `seed.mjs`
- `production-seed.mjs`
- `demo-seed.mjs`
- `bootstrap-seed.mjs`
- `backfill-assets.mjs`
- `backfill-orders.mjs`
- `clear-file-assets.mjs`

此外：

- `bootstrap-seed.mjs` 写入 schema 已移除的 `MemberLevel.weight`。
- seed 脚本含硬编码默认管理员密码，且不同脚本密码不一致。
- demo seed 非幂等，并使用已经过期的权限键。
- `clear-file-assets.mjs` 无确认删除全部文件资产/绑定，但不清理磁盘和业务 URL。
- `delete-order.mjs` 不补偿库存、积分、余额和卡权益。
- `delete-queue-item.mjs` 绕过正常订单取消及库存/优惠券恢复。

在完成 adapter、参数校验、dry-run、确认提示、幂等性和审计改造前，禁止在真实数据上运行这些脚本。

## 12. 数据库变更审查清单

- [ ] 目标数据库和环境已明确，没有输出秘密。
- [ ] 使用 pnpm 9.6.0 和仓库锁文件。
- [ ] schema 与新 migration.sql 同时审查。
- [ ] 已检查锁表、全表回填和大索引风险。
- [ ] 金额、时区、默认值和 nullability 语义明确。
- [ ] 迁移前数据库和 uploads 同步备份。
- [ ] 在生产数据副本完成演练。
- [ ] 新旧代码可在发布窗口内兼容。
- [ ] 有向前修复或完整恢复方案。
- [ ] 迁移后检查 `_prisma_migrations`、核心计数和支付/队列/通知烟测。
