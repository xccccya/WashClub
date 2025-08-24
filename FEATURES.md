## 功能总览（Wash Club 项目）

### 后端（NestJS + Prisma + JWT）
- 认证与授权
  - 会员登录：`POST /auth/login`，使用手机号+密码，签发 JWT（有效期默认 7 天）。
  - 管理员登录：`POST /auth/admin/login`；管理员资料/密码修改接口。
  - Token 校验：`GET /member/me/profile` 基于 JWT 验证并返回会员完整资料；`POST /member/me/active` 上报活跃时间。
  - 附加有效期保护：基于 `iat` 的二次过期限制（默认 7 天，可用 `MEMBER_TOKEN_MAXAGE_MS` 覆盖）。

- 会员模块
  - 会员列表分页查询：`GET /member/list`，支持关键词（姓名/手机号）搜索，返回等级、分类、标签等关联信息。
  - 会员详情：`GET /member/:id`。
  - 新建会员：`POST /member/create`（必填：等级、分类；可选：头像、密码、标签、积分、余额）。
  - 更新会员：`PUT /member/:id`（支持头像 `avatarUrl`、标签、积分、余额、等级、分类、手机号、昵称、密码等字段）。
  - 删除会员：`DELETE /member/:id`。
  - 设置会员密码：`PUT /member/:id/password`。

- 会员等级/分类/标签
  - 等级：`/member-level`（GET 列表、POST 新建、PUT 更新、DELETE 删除）。
  - 分类：`/member-category`（同上）。
  - 标签：`/member-tag`（同上）。

- 文件服务
  - 上传文件：`POST /file/upload`（multipart/form-data，支持指定目录 `dir`：public/admin/pos/miniapp）。
  - 列举目录文件：`GET /file/list?dir=public|admin|pos|miniapp`。
  - 删除文件：`DELETE /file/:path`。
  - 静态访问：`/uploads/**`。

- 其它
  - OpenAPI 文档：`/docs`。
  - 全局 CORS、ValidationPipe。

### 管理后台（Vue 3 + Element Plus）
- 认证与权限
  - 登录（管理员），路由鉴权（基于本地 token + 用户权限），菜单权限控制示例。

- 会员管理
  - 列表：搜索、分页、查看活跃/注册时间、显示积分和余额。
  - 新建/编辑：
    - 基础信息（昵称、手机号、等级、分类、标签、积分、余额、密码（新建必填））。
    - 头像支持：
      - 列表增加头像列显示。
      - 编辑/新建弹窗中支持头像预览与上传（默认头像回退）。
  - 修改密码：独立弹窗操作。
  - 删除会员。

- 会员体系配置
  - 等级管理：新增、编辑、启用排序（基于权重）、删除。
  - 分类管理：新增、编辑、排序、删除。
  - 标签管理：新增、编辑、删除；在会员编辑中支持“选择/创建”并自动创建后回填。

- 系统管理
  - 角色管理：新增、编辑、启用/禁用、删除，分配菜单权限。
  - 管理员管理：新增、编辑、删除，分配角色。
  - 文件管理：上传、浏览、删除文件，按目录分组；可复制静态访问链接。

### 小程序（uni-app）
- 登录与会话
  - 手机号+密码登录，成功后保存 token 与用户信息，并立即上报活跃。
  - 登录状态检测：
    - 未登录：不提示、不跳转，由页面自行引导。
    - 已登录：进入页面时通过 `GET /member/me/profile` 服务端验证；过期/无效将清理本地并跳转登录。
  - 会话有效期：与后端保持一致为 7 天。

- 页面功能
  - 我的页面（/pages/me/index）：
    - 展示头像、昵称、等级、UID 等；未登录展示“点击登录账号”。
    - 已登录可查看/更换头像（上传到 `miniapp` 目录并更新后端头像字段）。
    - 游客点击头像将跳转登录（不弹出选择菜单）。
    - 显示计次卡占位、订单入口占位、其它功能占位；底部 Tab 导航。
  - 登录页（/pages/login/index）：手机号+密码登录、忘记密码入口（占位）。
  - 其它示例页（首页、门店等占位导航）。

### 共享包（packages）
- shared-utils：封装 `createHttpClient`（baseUrl、token 注入、JSON/文本响应处理、query 拼接）。
- shared-ui：基础布局组件 `BasePage`。
- shared-types：共享类型定义（如会员相关类型占位）。
- api-client：orval 生成的 API 客户端骨架（后续可完善）。

### 数据结构（Prisma）
- Member：包含 `avatarUrl`、`uid`、`name`、`phone`、`password?`、`level`、`category`、`tags`、`vehicles`、`points`、`balance`、`lastActiveAt` 等。
- MemberLevel / MemberCategory / MemberTag：基础维度表及关联。
- User / AdminRole：后台用户与角色、权限。
- Vehicle：与会员的车辆关联（级联删除）。

### 运行与部署
- API 默认端口：`3000`；静态资源 `/uploads`；Swagger `/docs`。
- 重要环境变量：
  - `JWT_SECRET`：JWT 密钥。
  - `JWT_EXPIRES_IN`：默认 `7d`（已在会员登录时覆盖为 7 天）。
  - `MEMBER_TOKEN_MAXAGE_MS`：会员 token 二次过期保护窗口（默认 7 天）。

---

如需新增功能或调整有效期、鉴权策略、文件目录等，请在对应模块按以上约定扩展。


