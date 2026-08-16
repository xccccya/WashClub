# 开发、部署与运维手册

> 本文只记录仓库当前可证实的运行方式。仓库没有已验证的 Docker Compose、Kubernetes、systemd、PM2 或 CI/CD 生产配置；实际进程管理、TLS 和反向代理由部署环境另行负责。最后核对日期：2026-08-15。

## 1. 禁止事项

在继续任何部署操作前先确认：

1. **禁止运行 `apps/api/scripts/deploy-production.sh`。** 它包含 `prisma migrate reset --force --skip-seed`，会清空数据库，而且其 npm 安装流程与本仓库不匹配。
2. **禁止把 `apps/api/scripts/bootstrap-linux.sh` 当作部署脚本。** 它在迁移失败时回退到 `prisma db push`。
3. **禁止在生产或共享数据库运行 `prisma migrate reset`、`prisma db push`、demo seed 或清理脚本。**
4. **禁止只备份数据库而不备份 uploads。** 文件元数据和本地文件必须位于同一个恢复点。
5. **禁止从旧 README、Git 历史或本地便笺复制支付配置。** 只使用当前 `apps/api/.env.example` 的规范变量名，并在部署前与实际 Service 复核。

危险脚本的完整说明见本文第 11 节和 [database.md](./database.md)。

## 2. 工具链与工作目录

根 `package.json` 固定：

```text
pnpm@11.19.0
```

使用 Corepack 激活该版本：

```powershell
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm --version
pnpm install --frozen-lockfile
```

不要混用 npm、yarn 或不同主版本 pnpm。较新的 pnpm 可能判定现有 node_modules 不兼容并尝试重建依赖目录。

推荐始终从仓库根目录执行带 `--filter` 的命令。API 运行时会把上传文件放到 `process.cwd()/uploads`，因此部署进程必须显式设置 cwd：

- 推荐 cwd：`apps/api`，上传目录即 `apps/api/uploads`；或
- 保持既有约定的其他固定 cwd，并将该 cwd 下的 `uploads` 作为持久卷和备份目标。

不要在不同发布版本间改变 cwd，否则应用会读取不同 `.env` 并表现为“上传文件丢失”。

## 3. 环境变量

### 3.1 必需配置

| 变量 | 用途 | 规则 |
| --- | --- | --- |
| `DATABASE_URL` | Prisma/MySQL 连接 | 必需；只通过秘密管理提供 |
| `JWT_SECRET` | 管理员和会员 JWT 签名 | 必需；代码拒绝精确值 `dev_secret`；生产使用高熵随机值 |
| `GUEST_MEMBER_ID` | 游客订单/车辆的占位会员 | 依赖游客流程时必须配置且记录对应数据库行；兼容历史拼写 `GUESS_MEMBER_ID` |
| `PUBLIC_API_BASE` | 微信支付/退款公网回调基址 | 启用微信支付时必须是外部可访问的 HTTPS origin，不带末尾业务路径 |

基础运行变量：

| 变量 | 默认值/兼容逻辑 |
| --- | --- |
| `PORT` | `3000` |
| `TZ` | `Asia/Shanghai`；部署环境应显式设置 |
| `ADMIN_JWT_EXPIRES_IN` | `1d` |
| `MEMBER_JWT_EXPIRES_IN` | 回退 `JWT_EXPIRES_IN`，再回退 `7d` |
| `BCRYPT_SALT_ROUNDS` | `10`，有效范围 8–15 |
| `NO_PLATE_NUMBER` | `川K00000` |
| `ORDER_TIMEOUT_ENABLED` | 默认启用 |
| `ORDER_TIMEOUT_SCAN_MS` | 默认 60000，代码设有最低值 |
| `NOTIFY_DB_SCHEDULER_INTERVAL_MS` | 默认 30000，代码设有最低值 |
| `NOTIFY_DB_SCHEDULER_STALE_LOCK_MS` | 默认 10 分钟 |

### 3.2 外部集成

微信登录和订阅消息：

- `WECHAT_MINIAPP_APPID`，兼容 `WECHAT_APPID`
- `WECHAT_MINIAPP_SECRET`，兼容 `WECHAT_SECRET`

微信支付实际读取：

- `WXPAY_API_V3`
- `WXPAY_API_V2`
- `WXPAY_MCH_ID`
- `WXPAY_MCH_PRIVATE_KEY`
- `WXPAY_PLATFORM_CERT`
- `WXPAY_MCH_CERT_SERIAL`
- appid 使用上面的微信小程序 appid

腾讯云短信：

- `TENCENTCLOUD_SECRET_ID`
- `TENCENTCLOUD_SECRET_KEY`
- `SMS_REGION`
- `SMS_SDK_APP_ID`
- `SMS_SIGN_NAME`
- `SMS_TEMPLATE_ID`

Redis：

- 优先 `REDIS_URL`；或
- `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`

地图/车型：

- `AMAP_WEBSERVICE_KEY`（Web Service API，仅 Key）
- `AMAP_JSAPI_SECURITY_JSCODE`（Web 端 JSAPI v2.0 安全代理专用，不属于 Web Service）
- `TANSHU_CAR_API_KEY`、`TANSHU_API_KEY` 或 `TS_API_KEY`
- 部分车型代码还读取 `CAR_API_KEY`

旧文档曾记录 `WXPAY_MCHID`、`WXPAY_APPID`、`WXPAY_API_V3_KEY`、`WXPAY_CERT_PATH`、`WXPAY_KEY_PATH`、`WXPAY_PLATFORM_CERT_PATH` 等过时变量名。当前脱敏模板为 `apps/api/.env.example`，部署仍应按本节及实际 Service 复核。

### 3.3 env 加载顺序

API 入口依次尝试当前 cwd 下的：

1. `.env`
2. `apps/api/.env`
3. `prisma/.env`
4. `apps/api/prisma/.env`

先加载的值不会被后加载文件覆盖。生产上应只保留一个明确的配置入口，并由进程管理器注入秘密，避免多个 `.env` 相互遮蔽。

## 4. 开发命令

从仓库根目录执行：

```powershell
# API 开发模式
pnpm --filter WashClubAPI run dev

# 管理端
pnpm --filter web-admin run dev

# POS
pnpm --filter web-pos run dev

# 微信小程序
pnpm --filter miniapp-uni run dev:mp-weixin

# 小程序 H5
pnpm --filter miniapp-uni run dev:h5
```

根命令 `pnpm dev` 会通过 Turbo 并行启动所有声明了 `dev` 任务的包，日志和端口更难隔离；排障时优先单包启动。

API 当前没有 `test`、`lint` 或 `typecheck` package script，也没有测试套件。可直接执行只读类型检查：

```powershell
pnpm --filter WashClubAPI exec tsc --noEmit
```

根 `pnpm lint` 不会自动弥补 API 缺失的 lint task。不能把 Turbo 命令成功等同于 API 已完成 lint/测试。

## 5. 构建

API 构建会先生成 Prisma Client，再由 Nest 编译到 `apps/api/dist`：

```powershell
pnpm --filter WashClubAPI run build
```

构建所有声明了 build 的包：

```powershell
pnpm run build
```

前端单独构建：

```powershell
pnpm --filter web-admin run build
pnpm --filter web-pos run build
pnpm --filter miniapp-uni run build:mp-weixin
pnpm --filter miniapp-uni run build:h5
```

启动脚本不会自动构建或迁移。`apps/api/dist/main.js` 不存在时，`start` 必然失败。

## 6. 安全部署流程

### 6.1 发布前

- [ ] 确认 Git commit、发布版本、目标环境和负责人。
- [ ] 使用 pnpm 11.19.0，`pnpm install --frozen-lockfile` 成功。
- [ ] 核对必需环境变量，但不输出秘密值。
- [ ] 确认 `PUBLIC_API_BASE` 是当前生产 HTTPS 地址。
- [ ] 确认固定 cwd、uploads 绝对路径和可用磁盘空间。
- [ ] 检查 Redis 可达性；若 Redis 不可用，明确通知实时性和任务降级影响。
- [ ] 执行 `prisma validate`、类型检查和构建。
- [ ] 查看待部署 migration.sql，确认无未审查的破坏性 SQL。
- [ ] 备份数据库和 uploads，并验证备份清单。
- [ ] 在生产数据副本演练迁移和启动。

建议命令：

```powershell
pnpm --filter WashClubAPI exec prisma validate
pnpm --filter WashClubAPI exec prisma migrate status
pnpm --filter WashClubAPI exec tsc --noEmit
pnpm --filter WashClubAPI run build
```

### 6.2 发布

只部署仓库中已提交的迁移：

```powershell
pnpm --filter WashClubAPI run prisma:deploy
pnpm --filter WashClubAPI run start:prod
```

实际生产应由进程管理器以前台 `node dist/main.js` 为主进程，并配置：固定 cwd、环境变量、自动重启、日志采集、停止超时和 TLS 反向代理。仓库目前没有可直接复用且经过验证的配置文件。

更新期间需要考虑旧代码与新 schema 的兼容窗口。涉及删列、改名、非空约束或大表回填时，使用多版本 expand/contract 发布，不要在一次迁移中直接破坏旧版本。

### 6.3 发布后

1. 执行迁移状态检查：

   ```powershell
   pnpm --filter WashClubAPI exec prisma migrate status
   ```

2. 检查 `/health`。
3. 验证登录、商品查询、创建测试订单、队列读取和通知连接。
4. 若涉及支付，在沙箱/最小金额流程验证预支付和回调，并核对订单、权益和流水。
5. 检查错误日志、数据库连接、Redis 重连、BullMQ 失败任务和 NotificationJob 积压。
6. 检查 `/uploads` 历史文件和新上传均可访问。

## 7. 服务入口与健康检查

| 入口 | 当前行为 | 运维含义 |
| --- | --- | --- |
| `GET /health` | 返回 `{ ok: true, service: "api", ts }` | 只证明 HTTP 进程响应，不检查数据库、Redis、磁盘或外部服务 |
| `/docs` | 公开 Swagger UI | 生产是否暴露应由反向代理限制 |
| `/ws` | 通知 WebSocket | 首条消息须在 5 秒内提交 token |
| `/uploads/*` | 公开静态文件 | 直接从 cwd/uploads 提供，不执行 FileAsset 权限检查 |

推荐至少增加外部探针：

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health'
```

不要仅以 `/health` 200 判断系统完全可用；还要监测数据库查询、Redis、可写磁盘和关键业务烟测。

## 8. Redis、通知和后台任务

API 进程启动时会初始化 NotificationService：

- Redis Pub/Sub 负责 WebSocket 多实例广播。
- BullMQ 队列 `notify` 和 Worker 在 API 进程内运行。
- 数据库 NotificationJob 调度器在进程内定时扫描。
- 未配置 Redis 时默认尝试 `127.0.0.1:6379`，当前没有“完全禁用 Redis”的开关。

多实例部署必须让所有实例连接同一 Redis，否则广播和队列行为不一致。部署滚动重启时要关注 Worker 中断和 stale lock 恢复时间。当前服务没有完整关闭 Redis/Worker/interval 的实现，进程管理器应给予合理终止时间，仍需通过任务状态对账。

Redis 故障不一定让 `/health` 失败。应单独监测 Redis 连接日志、BullMQ failed/waiting 数量及数据库 NotificationJob 的 PENDING/PROCESSING 陈旧记录。

## 9. 上传文件和静态路径

API 在启动时创建：

```text
<process.cwd()>/uploads
```

并把它公开为 `/uploads`。运维要求：

- cwd 在所有版本和实例上保持不变。
- uploads 使用持久磁盘或共享存储，不能位于每次发布都会替换的临时目录。
- 多 API 实例若没有共享文件系统，会看到不同文件集合。
- 备份数据库时记录同一时间点的 uploads 快照。
- 恢复时保持原 URL 相对路径和目录结构。
- `FileAsset.isPublic=false` 目前不构成访问控制；敏感文件不得放入公开静态路径。

## 10. 备份与恢复

### 10.1 备份

数据库备份应使用数据库供应商提供的事务一致性工具和受保护的客户端配置文件。以 MySQL/MariaDB 为例：

```text
mysqldump --defaults-extra-file=<secure-client.cnf> --single-transaction --routines --triggers --events --hex-blob --result-file=<absolute-backup.sql> <database>
```

同时创建 uploads 文件级快照/归档，并生成清单：

- 应用 commit 和构建版本；
- 数据库实例、库名、备份开始/结束时间；
- `_prisma_migrations` 内容；
- SQL 文件大小和校验和；
- uploads 路径、文件数量、总大小和归档校验和；
- 加密位置和保留期限。

不要在命令行直接写密码，避免进入 shell history 和进程列表。

### 10.2 恢复演练

恢复必须先在隔离环境演练：

1. 停止目标环境写流量。
2. 恢复 SQL 到空数据库或明确批准的目标库。
3. 恢复对应时间点的 uploads 到固定 cwd。
4. 检查 `_prisma_migrations`，不要立即执行 db push。
5. 用对应版本应用启动并执行核心烟测。
6. 抽查订单金额、支付/退款、余额流水、库存、文件绑定和通知任务。
7. 记录恢复耗时、丢失窗口和所有人工步骤。

未经演练的备份不能视为可恢复备份。

## 11. 明确停用的旧脚本

| 文件 | 当前问题 | 结论 |
| --- | --- | --- |
| `scripts/deploy-production.sh` | 强制 reset 全库；npm 流程与 pnpm 仓库不匹配 | 禁止执行，待删除或完全重写 |
| `scripts/bootstrap-linux.sh` | migrate deploy 失败即 db push；使用未锁定 npx | 禁止作为部署入口 |
| `scripts/init-db.mjs` | 硬编码 root/app 数据库凭据 | 仅历史本机脚本；不得用于任何真实环境 |
| `scripts/seed.mjs` | Prisma 7 初始化失效；重置硬编码管理员密码 | 禁止生产执行 |
| `scripts/production-seed.mjs` | Prisma 7 初始化失效；包含默认凭据 | 名称不代表安全，禁止执行直至重构审查 |
| `scripts/demo-seed.mjs` | 非幂等、权限键过期、默认凭据、Prisma 7 失效 | 仅可在可丢弃本地库，当前仍不可运行 |
| `scripts/bootstrap-seed.mjs` | Prisma 7 失效，还写入已删除字段 `MemberLevel.weight` | 禁止执行 |
| `scripts/clear-file-assets.mjs` | 无确认清空资产/绑定，不同步业务 URL 和磁盘 | 禁止真实数据执行 |
| `scripts/delete-order.mjs` | 物理删单，不补偿库存、积分、余额、卡权益 | 仅人工对账后的修复工具；默认禁止 |
| `scripts/delete-queue-item.mjs` | 绕过 QueueService 的订单/库存/优惠券补偿 | 仅人工对账后的修复工具；默认禁止 |
| `scripts/backfill-assets.mjs` / `backfill-orders.mjs` | 批量变更，Prisma 7 初始化失效 | 修复、dry-run、备份和副本演练前禁止 |

Git 历史中的旧 `apps/api/scripts/README.md` 同样包含 npm/npx、reset 和硬编码凭据等过时建议，不能作为现行运维手册。

## 12. OpenAPI 生成

```powershell
pnpm --filter WashClubAPI run openapi
```

该命令不是纯构建操作。它会：

1. 构建 API；
2. 导入 AppModule；
3. 要求有效 `DATABASE_URL` 和 `JWT_SECRET`；
4. 连接数据库并尝试 Redis；
5. 启动通知 Worker/调度器；
6. 覆盖 `apps/api/openapi.json`；
7. 最后强制退出。

只能在隔离的非生产环境生成，并审查 openapi diff。不要为了生成文档指向生产数据库。

## 13. 故障处理原则

- 数据库迁移失败：停止发布，保存完整日志和迁移状态；不要 reset/db push。使用兼容代码或经过审查的向前修复迁移。
- 支付已成功但权益未到账：不得重放整个支付回调；按订单、支付、积分/卡/集团流水逐项对账后执行幂等补偿。
- Redis 故障：确认数据库通知任务和主业务是否仍工作，恢复 Redis 后检查重复/积压通知。
- 上传文件缺失：先核对进程 cwd、挂载和备份，不要先删除 FileAsset/FileBinding。
- 队列与订单状态不一致：不要直接运行 delete 脚本；先确认订单支付、履约、库存和优惠券，再通过有审计的修复流程处理。
- 需要回滚应用：回滚到与当前 schema 兼容的代码版本；数据库优先向前修复，不逆向覆盖迁移历史。
