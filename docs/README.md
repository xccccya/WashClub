# 项目文档地图

本目录用于保存可随仓库传播、能够指导当前开发的文档。项目早期由 Cursor 辅助开发，工作区里遗留了若干草案、阶段总结和提示词；它们记录过开发过程，但不能自动视为当前实现。

## 如何判断信息是否权威

遇到冲突时，按以下顺序核对：

1. 当前代码、配置、Prisma schema 和已提交 migration。
2. NestJS controller/DTO，以及由当前代码生成的 `apps/api/openapi.json`。
3. 根 `AGENTS.md` 中的仓库操作与安全规则。
4. 本页列出的“当前维护文档”。
5. 带日期的总结、阶段进展、设计草案、原型和 AI 提示词。

历史文档可以解释“为什么曾经这样设计”，但不能证明功能已经实现，也不能覆盖当前代码事实。README 中手工列出的接口、版本号或功能状态若与 OpenAPI/代码不同，以代码和生成契约为准。

## 当前维护文档

| 文档 | 作用 | 维护要求 |
|---|---|---|
| [`../README.md`](../README.md) | 项目入口、结构、快速开始 | 只保留当前可验证信息，不复制完整 API 清单 |
| [`../AGENTS.md`](../AGENTS.md) | Codex 开发、安全和验证硬规则 | 后续代理进入仓库后应先阅读 |
| [`../CHANGELOG.md`](../CHANGELOG.md) | 受版本控制的人工更新日志和小程序日志源 | 发布或新增用户可见变更时更新 |
| [`architecture.md`](architecture.md) | 系统边界、数据流和核心业务链路 | 模块职责或跨端链路变化时更新 |
| [`development.md`](development.md) | 本地开发、构建和验证矩阵 | package scripts 或工具链变化时更新 |
| [`configuration.md`](configuration.md) | 环境变量、默认值和安全边界 | 与各应用 `.env.example` 和代码读取保持一致 |
| [`database.md`](database.md) | Prisma 7、migration 和数据安全流程 | schema、Prisma 配置或发布流程变化时更新 |
| [`api-client.md`](api-client.md) | OpenAPI/Orval/SDK 的权威维护指南 | 后端契约或 SDK 生成流程变化时更新 |
| [`operations.md`](operations.md) | 运行、部署和运维检查清单 | 只记录经过验证且可恢复的流程 |
| [`known-issues.md`](known-issues.md) | 已验证的风险和优化顺序 | 修复后同步状态和证据，避免保留已失效结论 |
| [`SDK-使用规范.md`](SDK-使用规范.md) | 早期 SDK 最小规范 | 仅作简明兼容入口；详细规则以 `api-client.md` 为准 |
| [`../packages/api-client/README.md`](../packages/api-client/README.md) | API Client 包内生成和使用说明 | 不与 SDK 规范重复维护业务规则 |
| [`../apps/api/scripts/README.md`](../apps/api/scripts/README.md) | 后端维护脚本风险索引 | 不是命令速查；必须先读风险和授权条件 |
| [`../apps/api/.env.example`](../apps/api/.env.example) | 后端环境变量的脱敏示例 | 变量名必须与代码实际读取保持一致，禁止真实值 |
| [`../apps/api/openapi.json`](../apps/api/openapi.json) | 由后端生成的机器可读 API 契约 | 不手改；由 OpenAPI 流程再生 |
| [`login-reset-prototype.html`](login-reset-prototype.html) | 登录/重置密码的历史交互原型 | 仅供视觉追溯，不是运行实现或需求规范 |
| [`../SECURITY.md`](../SECURITY.md) | 当前安全风险和上线前要求 | 不记录真实凭据；风险关闭必须有验证依据 |

运行后端后，Swagger UI 默认位于 `/docs`。它适合浏览当前接口；前端开发仍应调用生成的 `@wash/api-client`，不要从 Swagger 页面重新手写请求路径。

## Cursor 遗留审计

2026-08-15 的全仓检查没有发现可迁移的 Cursor skill 或规则：

- `.cursor/rules/` 目录为空且未被 Git 跟踪；干净 clone 不会包含它。
- 不存在 `.cursorrules`、`.mdc`、`SKILL.md`、`.cursorignore` 或其他 Cursor 指令文件。
- Git 历史中也没有 `.cursor` / `.cursorrules` 规则记录。
- 本地 `提示模板-MySQL8.4.md` 和 `SDK-统一调用重构指南与提示词.md` 只是被忽略的历史提示文本，不是 Cursor skill，也不是现行规则。

后续 Codex 的仓库规则以根 [`AGENTS.md`](../AGENTS.md) 为准；其位置和作用遵循 [OpenAI 官方的 `AGENTS.md` 项目指令约定](https://developers.openai.com/codex/guides/agents-md)。

## 代码事实入口

- 后端入口：`apps/api/src/main.ts`
- 后端模块装配：`apps/api/src/app.module.ts`
- 数据模型：`apps/api/prisma/schema.prisma`
- Prisma 7 配置：`apps/api/prisma.config.ts`
- OpenAPI 生成脚本：`apps/api/scripts/generate-openapi.mjs`
- Orval 配置：`orval.config.ts`
- SDK 公开入口：`packages/api-client/src/index.ts`
- 跨端 API base/HTTP：`packages/shared-utils/src/api-base.ts`、`packages/shared-utils/src/http.ts`
- 管理后台路由：`apps/web-admin/src/router.ts`
- POS 路由：`apps/web-pos/src/main.ts`
- 小程序页面注册：`apps/miniapp-uni/src/pages.json`

## 本地历史文档说明

当前工作区根目录可能存在以下被 `.gitignore` 排除的旧文档。它们不会出现在干净 clone 中，也不属于可靠的团队文档：

- 功能草案：集团客户、商店和订单系统设计。
- 阶段快照：消息系统进展、2025 年项目现状评估。
- 操作提示：旧 Prisma 流程、MySQL 8.4 AI 提示、SDK 迁移提示词。
- 更新日志源：旧 `unichlog.md`。
- 第三方接口或服务配置便笺。

使用这些文件时遵循以下规则：

- 先验证其日期和代码对应版本，并明确标注“历史、非当前规范”。
- 已实现的草案不得再次当作待开发需求。
- 旧命令不得直接执行，尤其是 Prisma、seed、部署、清理和删除命令。
- 不把历史提示词原样复制进 `AGENTS.md`；只提炼经当前代码验证的规则。
- 若文件包含云密钥、API key、密码、连接串或真实账号，不得引用、移动到 archive 或提交；应报告并轮换相关凭据。

## 已知文档债务

- 根 `CHANGELOG.md` 已成为受版本控制的日志源，但小程序 Vite 配置仍会在加载时覆盖 `src/assets/changelog.html` 与 `changelog.ts`；运行小程序命令后必须检查生成 diff。
- 根 package、mini package 与小程序 manifest 的版本号仍未统一，发布时不得假定三者自动同步。
- 大量 OpenAPI operation 的响应 schema 仍不完整；发现 SDK 返回 `Promise<void>` 与运行时不符时，应修后端 Swagger DTO 后重新生成。
- 仓库当前没有可靠的自动测试或 lint 门禁；文档不得把“构建成功”等同于业务已验证。

## 文档维护规则

- 当前文档使用简体中文；代码、命令、路径和配置键保持原文。
- 示例只使用明显的假值，不记录任何生产身份、手机号或密钥。
- 一个事实只设一个主要维护位置，其余文档通过链接引用，避免复制漂移。
- 行为、路由、环境变量、数据库流程或生成命令变化时，在同一变更中更新对应文档。
- 新增历史资料时放入明确的 archive 目录并写明日期、来源和非权威状态；敏感便笺不归档。
