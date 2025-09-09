#!/bin/bash

# 生产环境一键部署脚本
# 使用方法: ./scripts/deploy-production.sh

set -e  # 遇到错误立即退出

echo "🚀 WashClub 生产环境部署脚本"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ] || [ ! -f "prisma/schema.prisma" ]; then
    echo -e "${RED}❌ 错误：请在 apps/api 目录下运行此脚本${NC}"
    exit 1
fi

# 检查环境变量
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ 错误：未找到 .env 文件，请先配置环境变量${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  警告：此操作将完全重置生产数据库！${NC}"
echo -e "${YELLOW}⚠️  所有现有数据将被删除！${NC}"
echo ""
read -p "您是否已经备份了重要数据？(yes/no): " backup_confirm

if [ "$backup_confirm" != "yes" ]; then
    echo -e "${RED}请先备份重要数据！${NC}"
    exit 1
fi

echo ""
read -p "确认要继续部署吗？这将重置整个数据库 (yes/no): " deploy_confirm
if [ "$deploy_confirm" != "yes" ]; then
    echo -e "${YELLOW}部署已取消${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}📋 开始部署流程...${NC}"

# 1. 安装依赖
echo -e "${BLUE}📦 安装 Node.js 依赖...${NC}"
npm ci --only=production

# 2. 生成 Prisma Client
echo -e "${BLUE}🔧 生成 Prisma Client...${NC}"
npx prisma generate

# 3. 重置数据库并应用迁移
echo -e "${BLUE}🗑️  重置数据库...${NC}"
npx prisma migrate reset --force --skip-seed

echo -e "${BLUE}🚀 部署数据库迁移...${NC}"
npx prisma migrate deploy

# 4. 运行生产环境种子数据
echo -e "${BLUE}🌱 初始化基础数据...${NC}"
npm run db:seed:production

# 5. 构建应用
echo -e "${BLUE}🔨 构建应用...${NC}"
npm run build

# 6. 验证部署
echo -e "${BLUE}✅ 验证部署状态...${NC}"
npx prisma migrate status

echo ""
echo -e "${GREEN}🎉 生产环境部署完成！${NC}"
echo ""
echo -e "${GREEN}📋 部署摘要：${NC}"
echo -e "   👑 管理员账号: 19160906595"
echo -e "   🔑 管理员密码: csc3619xcc."
echo -e "   💳 积分配置: 100积分抵扣0.01元"
echo -e "   🏆 默认会员等级: 注册会员"
echo ""
echo -e "${BLUE}🎯 下一步：${NC}"
echo -e "   1. 启动应用服务"
echo -e "   2. 登录管理后台完善配置"
echo -e "   3. 上传必要的图片资源"
echo ""
echo -e "${YELLOW}⚠️  重要提醒：${NC}"
echo -e "   - 请及时修改默认管理员密码"
echo -e "   - 请配置微信支付等第三方服务"
echo -e "   - 请设置定期数据备份"
