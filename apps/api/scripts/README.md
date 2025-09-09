# 数据库脚本使用指南

本目录包含了用于初始化和管理数据库的各种脚本。

## 📋 脚本概览

### 🌱 种子数据脚本

| 脚本文件 | npm 命令 | 用途 | 适用场景 |
|---------|----------|------|----------|
| `bootstrap-seed.mjs` | `npm run db:bootstrap` | 系统基础数据 | 最小化启动 |
| `production-seed.mjs` | `npm run db:seed:production` | 生产环境基础数据 | 生产环境初始化 |
| `demo-seed.mjs` | `npm run db:seed:demo` | 完整演示数据 | 开发测试环境 |

### 🚀 部署脚本

| 脚本文件 | 用途 | 适用场景 |
|---------|------|----------|
| `deploy-production.sh` | 生产环境一键部署 | 生产环境重置部署 |

## 🎯 使用场景

### 1. 全新安装/开发环境

```bash
# 1. 应用迁移
npx prisma migrate dev --name init_complete_schema

# 2. 生成完整演示数据（推荐用于开发）
npm run db:seed:demo
```

### 2. 生产环境初始化

```bash
# 方案一：使用一键部署脚本（推荐）
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh

# 方案二：手动步骤
npx prisma migrate deploy
npm run db:seed:production
```

### 3. 最小化启动

```bash
# 只创建必要的系统数据
npx prisma migrate deploy
npm run db:bootstrap
```

## 📊 数据内容对比

### bootstrap-seed.mjs（最小化）
- ✅ 系统会员标签（4个）
- ✅ 超级管理员角色
- ✅ 默认会员等级
- ✅ 默认管理员用户（19160906595）

### production-seed.mjs（生产基础）
- ✅ 包含 bootstrap-seed 的所有内容
- ✅ 站点基础配置
- ✅ 积分系统配置（100积分抵扣0.01元）

### demo-seed.mjs（完整演示）
- ✅ 包含 production-seed 的所有内容
- ✅ 额外管理员角色和用户
- ✅ 会员分类和等级体系
- ✅ 20个演示会员
- ✅ 演示车辆数据
- ✅ 商品分类和演示商品
- ✅ 滚动通知
- ✅ 积分和成长值记录

## 🔐 默认账号信息

### 超级管理员
- **手机号**: `19160906595`
- **密码**: `csc3619xcc.`
- **角色**: 超级管理员（拥有所有权限）

### 其他管理员（仅在 demo-seed 中）
- **店长**: `13800000001` / `123456`
- **收银员**: `13800000002` / `123456`
- **客服**: `13800000003` / `123456`

## ⚙️ 积分系统配置

所有脚本都会设置以下积分系统配置：

- **消费获取积分**: 1分 = 1积分
- **积分抵扣**: 100积分 = 0.01元
- **单笔订单抵扣限制**: 无限制
- **签到奖励**: 连续7天递增，第8天起每天50积分

## 🛡️ 安全注意事项

1. **生产环境部署前**：
   - 务必备份现有数据
   - 确认环境变量配置正确
   - 在维护时间窗口执行

2. **部署后必做**：
   - 立即修改默认管理员密码
   - 配置微信支付等第三方服务
   - 设置定期数据备份

3. **权限管理**：
   - 给部署脚本执行权限：`chmod +x scripts/deploy-production.sh`
   - 确保数据库连接权限正确

## 🔧 故障排除

### 常见问题

1. **迁移冲突**：
   ```bash
   npx prisma migrate reset --force
   npx prisma migrate deploy
   ```

2. **权限错误**：
   ```bash
   chmod +x scripts/deploy-production.sh
   ```

3. **环境变量问题**：
   ```bash
   # 检查 .env 文件
   cat .env | grep DATABASE_URL
   ```

### 验证部署

```bash
# 检查迁移状态
npx prisma migrate status

# 检查数据库连接
npx prisma db pull --print

# 测试应用启动
npm run build
npm run start
```

## 📞 支持

如果在使用过程中遇到问题，请检查：

1. 数据库连接配置是否正确
2. Node.js 和 npm 版本是否兼容
3. Prisma Client 是否已生成
4. 相关权限是否足够

---

**重要提醒**：生产环境操作前请务必备份数据！
