#!/usr/bin/env bash
set -euo pipefail

# 后端部署初始化脚本（Linux）
# 功能：
# 1) 创建 uploads 及子目录
# 2) 执行 Prisma 生成与数据库结构初始化（migrate deploy 或 db push）
# 3) 插入系统默认数据（会员标签、后台角色、默认会员等级、后台管理员）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> 确认 uploads 目录及子目录"
mkdir -p "$API_DIR/uploads/public" \
	"$API_DIR/uploads/admin" \
	"$API_DIR/uploads/carimg" \
	"$API_DIR/uploads/miniapp" \
	"$API_DIR/uploads/pos"

echo "==> 加载 .env（若存在）"
if [ -z "${DATABASE_URL:-}" ]; then
	if [ -f "$API_DIR/.env" ]; then
		set -a
		. "$API_DIR/.env"
		set +a
	fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
	echo "ERROR: DATABASE_URL 未设置。请导出环境变量或在 $API_DIR/.env 中配置。" >&2
	exit 1
fi

cd "$API_DIR"

echo "==> Prisma generate"
npx --yes prisma generate

echo "==> 应用数据库迁移（migrate deploy）或推送结构（db push）"
if npx --yes prisma migrate deploy; then
	echo "Prisma 迁移已部署"
else
	echo "未发现迁移或迁移失败，尝试 prisma db push 以同步结构"
	npx --yes prisma db push
fi

echo "==> 插入系统默认数据（会员标签/后台角色/默认等级/管理员）"
node "$SCRIPT_DIR/bootstrap-seed.mjs"

echo "==> 初始化完成"


