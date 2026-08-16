# 环境变量与配置

本文只记录当前代码实际读取的配置。示例值来自各应用的 `.env.example`，不包含真实凭据。

## 加载规则与安全边界

- API 会按当前工作目录尝试 `.env`、`apps/api/.env`、`prisma/.env`、`apps/api/prisma/.env`。部署时应固定 API 的工作目录，推荐 `apps/api`。
- 已存在的进程环境变量优先，dotenv 默认不会覆盖它们。
- 三端 Vite/uni-app 使用各自目录下的 `.env.[mode]`。生产构建必须在构建时注入配置。
- 所有 `VITE_*` 都会打包进客户端，必须视为公开值；不要放数据库密码、云 Secret、微信商户私钥等服务端秘密。
- `.env`、证书和密钥文件不得提交。新增变量时同步更新本文件和对应 `.env.example`。

## API：启动必需

| 变量 | 必需性 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 必需 | MySQL 连接串；Prisma 7 通过 MariaDB adapter 使用。示例：`mysql://user:password@127.0.0.1:3306/wash_club` |
| `JWT_SECRET` | 必需 | 管理员与会员 JWT 共用的签名 secret；必须是强随机值，代码拒绝精确值 `dev_secret` |

API 启动会立即连接数据库；配置存在但数据库不可达时，服务不会正常就绪。

## API：基础运行与业务兜底

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 与 WebSocket 共用端口 |
| `TZ` | `Asia/Shanghai` | Node 进程时区；数据库会话还会设置为 `+08:00` |
| `ADMIN_JWT_EXPIRES_IN` | `1d` | 管理员 token 有效期 |
| `MEMBER_JWT_EXPIRES_IN` | `7d` | 会员 token 有效期 |
| `JWT_EXPIRES_IN` | `7d` | 历史兼容项，仅在未设置专用会员变量时作为会员 token fallback |
| `BCRYPT_SALT_ROUNDS` | `10` | bcrypt cost，代码允许 8–15 |
| `GUEST_MEMBER_ID` | 无 | 游客订单/地址/车辆/队列依赖的真实 `Member.id`；必须在数据库中存在 |
| `NO_PLATE_NUMBER` | `川K00000` | “无牌车”占位车牌；需与前端一致 |
| `ORDER_TIMEOUT_ENABLED` | `true` | 是否启动订单超时扫描 |
| `ORDER_TIMEOUT_SCAN_MS` | `60000` | 扫描间隔毫秒数 |
| `PUBLIC_API_BASE` | 无 | 微信支付/退款回调的公网 HTTPS API 基址，不带尾部 `/` |

`GUESS_MEMBER_ID` 是历史拼写，只作为 fallback；新环境只使用 `GUEST_MEMBER_ID`。旧 `.env` 中的 `MEMBER_TOKEN_MAXAGE_MS`、服务端 `STORE_LOCATION` 等没有当前代码依据，不应继续复制。

## Redis 与通知任务

可选择单一连接串，或使用拆分字段：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `REDIS_URL` | 无 | 完整 Redis 连接串；设置后优先 |
| `REDIS_HOST` | `127.0.0.1` | 未设置 `REDIS_URL` 时使用 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | 无 | Redis 密码 |
| `NOTIFY_DB_SCHEDULER_INTERVAL_MS` | `30000` | NotificationJob DB 兜底调度间隔；代码下限为 5 秒 |
| `NOTIFY_DB_SCHEDULER_STALE_LOCK_MS` | `600000` | 释放卡死 PROCESSING 任务的阈值；代码下限为 60 秒 |

当前没有“禁用 Redis”的显式开关。即使不配置 Redis，通知服务也会尝试 `127.0.0.1:6379`，同时 DB scheduler 仍会运行。

## 腾讯云短信

以下变量在调用短信功能时必需：

| 变量 | 说明 |
| --- | --- |
| `TENCENTCLOUD_SECRET_ID` | 腾讯云 SecretId |
| `TENCENTCLOUD_SECRET_KEY` | 腾讯云 SecretKey |
| `SMS_REGION` | 地域，代码默认 `ap-nanjing` |
| `SMS_SDK_APP_ID` | 短信应用 ID |
| `SMS_SIGN_NAME` | 短信签名 |
| `SMS_TEMPLATE_ID` | 模板 ID |

不要从本地遗留的短信资料 Markdown 复制旧值；审计发现其中存在明文秘密，应先轮换。

## 微信小程序与微信支付

| 变量 | 说明 |
| --- | --- |
| `WECHAT_MINIAPP_APPID` | 小程序 appid；历史 fallback 为 `WECHAT_APPID` |
| `WECHAT_MINIAPP_SECRET` | 小程序 secret；历史 fallback 为 `WECHAT_SECRET` |
| `WXPAY_MCH_ID` | 微信支付商户号 |
| `WXPAY_API_V3` | API v3 key |
| `WXPAY_API_V2` | 仍使用 v2 流程时的 API v2 key |
| `WXPAY_MCH_PRIVATE_KEY` | 商户私钥文件路径，或包含 `apiclient_key.pem`/`apiclient_cert.pem` 的目录 |
| `WXPAY_MCH_CERT_SERIAL` | 商户证书序列号；若同时提供商户证书，代码会尝试推导 |
| `WXPAY_PLATFORM_CERT` | 微信支付平台证书路径，用于主动验签 |
| `PUBLIC_API_BASE` | 微信能访问的 HTTPS 回调基址 |

旧 README 使用过 `WXPAY_MCHID`、`WXPAY_API_V3_KEY`、`WXPAY_CERT_PATH` 等名字，它们不是当前主要配置名。新部署只使用表中的规范名。

证书目录位于 `apps/api/cert/` 时会被 Git 忽略，但更推荐存放在部署机的独立受限目录。

## 高德与探数

| 变量 | 使用方 | 说明 |
| --- | --- | --- |
| `AMAP_WEBSERVICE_KEY` | API | 高德 Web Service API 服务端 Key，用于天气、行政区、POI 和驾车路线；只有 Key，没有 `securityJsCode` |
| `AMAP_JSAPI_SECURITY_JSCODE` | API | 高德 Web 端 JSAPI v2.0 安全码，仅由 `/_AMapService` 代理追加；不是 Web Service Key |
| `TANSHU_CAR_API_KEY` | API | 车型和物流相关探数请求；部分代码还兼容 `TANSHU_API_KEY`、`TS_API_KEY`、`CAR_API_KEY` |
| `VITE_AMAP_JSAPI_KEY` | Admin、miniapp H5 | 高德“Web端(JS API)”Key，只用于 JSAPI 地图渲染 |
| `VITE_AMAP_JSAPI_SERVICE_HOST` | Admin、miniapp H5 | JSAPI 安全代理；生产必需 |
| `VITE_AMAP_JSAPI_SECURITY_JSCODE` | Admin、miniapp H5 | 仅本地开发；生产必须留空；Web Service API 不使用该值 |
| `VITE_STORE_LOCATION` | miniapp | 门店坐标，格式 `经度,纬度` |

客户端不配置任何 `VITE_AMAP_WEBSERVICE_*`。门店距离和行程路线都通过 API 调用高德 Web Service，只有 API 进程读取 `AMAP_WEBSERVICE_KEY`。

审计发现历史探数 key 已进入已跟踪代码，必须在服务商侧轮换并检查调用记录。当前车型品牌/车系请求已统一通过后端 `/content/car/*` 代理，由 API 进程读取 `TANSHU_CAR_API_KEY`；Web、POS 和小程序不得持有该变量、第三方服务端 key 或对应 `VITE_*` 变量。删除客户端固定值不能撤销历史泄露。

## 三端 API 基址

三端共同使用：

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE` | 规范变量，必须是绝对 `http://` 或 `https://` URL，例如 `http://127.0.0.1:3000` |
| `VITE_APP_API_BASE` | 历史兼容 fallback，不用于新环境 |

生产环境未配置 `VITE_API_BASE` 会直接报错，且禁用 URL/localStorage/uni storage 运行时覆盖；同一生产构建不能在不重建的情况下切换 API。

仅 admin/POS：

| 变量 | 说明 |
| --- | --- |
| `VITE_NO_PLATE_NUMBER` | 无牌车占位值，必须与 API `NO_PLATE_NUMBER` 一致 |

仅 POS：

| 变量 | 说明 |
| --- | --- |
| `VITE_GUEST_MEMBER_ID` | 可选；`0` 表示由后端 `GUEST_MEMBER_ID` 兜底 |

## 配置变更检查清单

1. 确认变量由哪一端读取；服务端秘密绝不使用 `VITE_*`。
2. 更新对应 `.env.example` 和本文件，不写真实值。
3. 验证未配置、非法值和依赖不可达时的失败行为。
4. 若影响支付回调、Redis、数据库或门店兜底账号，在预发环境演练。
5. 使用 `git diff` 检查没有把本地 `.env`、证书、密钥或生成后的秘密带入提交。
