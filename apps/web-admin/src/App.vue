<template>
	<router-view />
</template>

<script setup lang="ts"></script>

<style>
html, body, #app { height: 100%; }
/* 主题变量：通过 data-theme / data-color-scheme 控制 */
:root{
  color-scheme: light;
  --app-primary: #409eff;
  --app-success: #67c23a;
  --app-warning: #e6a23c;
  --app-danger:  #f56c6c;
  --app-bg: #ffffff;
  --app-text: #303133;
  --app-muted: #606266;
  /* 视觉系统（仅供 wc-* 组件/页面使用，不会自动影响其它页面） */
  --app-surface: #ffffff;
  --app-surface-2: #f6f8fb;
  --app-surface-3: #eef2f7;
  --app-border: color-mix(in oklab, var(--el-border-color), transparent 35%);
  --app-radius: 14px;
  --app-radius-sm: 10px;
  --app-radius-xs: 8px;
  --app-shadow-0: 0 1px 2px rgba(15, 23, 42, 0.06);
  --app-shadow-1: 0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 30px rgba(15, 23, 42, 0.08);
  --app-shadow-dialog: 0 12px 40px rgba(15, 23, 42, 0.18);
}
[data-theme='dark']{
  color-scheme: dark;
  --app-bg: #0f1114;
  --app-text: #e9edf3;
  --app-muted: #a6a9b2;
  --app-surface: #121419;
  --app-surface-2: #0f1114;
  --app-surface-3: #0b0d10;
  --app-border: color-mix(in oklab, var(--el-border-color), transparent 20%);
  /* Element 基础暗色适配 */
  --el-bg-color: var(--app-bg);
  --el-text-color-primary: var(--app-text);
  --el-text-color-regular: var(--app-muted);
  --el-border-color: #2a2f3a;
  --el-fill-color: #1a1d22;
  --el-fill-color-light: #171a1f;
}
[data-color-scheme='green']{
  --app-primary: #18a058;
}
[data-color-scheme='violet']{
  --app-primary: #7c4dff;
}
[data-color-scheme='orange']{
  --app-primary: #ff7d00;
}
[data-color-scheme='macaron-pink']{
  --app-primary: #ff9db5;
}
[data-color-scheme='macaron-blue']{
  --app-primary: #91c9ff;
}
[data-color-scheme='macaron-green']{
  --app-primary: #9fe3c0;
}
/* 覆盖 Element Plus 主色（仅对部分组件立即生效）*/
:root{
  --el-color-primary: var(--app-primary);
  --el-bg-color: var(--app-bg);
  --el-text-color-primary: var(--app-text);
  --el-text-color-regular: var(--app-muted);
  --el-color-primary-light-3: color-mix(in oklab, var(--app-primary), #fff 30%);
  --el-color-primary-light-5: color-mix(in oklab, var(--app-primary), #fff 50%);
  --el-color-primary-light-7: color-mix(in oklab, var(--app-primary), #fff 70%);
  --el-color-primary-light-8: color-mix(in oklab, var(--app-primary), #fff 80%);
  --el-color-primary-light-9: color-mix(in oklab, var(--app-primary), #fff 90%);
  --el-color-primary-dark-2: color-mix(in oklab, var(--app-primary), #000 20%);
}

/* 全局背景与文字适配（尽量不影响局部定制） */
body{ background: var(--app-bg); color: var(--app-text); }
.theme-pop{ padding: 8px 10px; border-radius: 8px; }

/* ============================================================
   全局滚动条美化
   - 细长优雅的滚动条
   - 圆角设计
   - hover 时颜色加深
   - 支持 Firefox 和 WebKit 浏览器
   ============================================================ */

/* Firefox 滚动条 */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb, rgba(144, 147, 153, 0.3)) var(--scrollbar-track, transparent);
}

/* WebKit 滚动条（Chrome, Safari, Edge） */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb {
  background: rgba(144, 147, 153, 0.3);
  border-radius: 3px;
  transition: background 0.2s ease;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(144, 147, 153, 0.5);
}
::-webkit-scrollbar-thumb:active {
  background: rgba(144, 147, 153, 0.7);
}
::-webkit-scrollbar-corner {
  background: transparent;
}

/* 暗色主题滚动条 */
[data-theme='dark'] ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
[data-theme='dark'] ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
[data-theme='dark'] ::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.35);
}
[data-theme='dark'] {
  --scrollbar-thumb: rgba(255, 255, 255, 0.15);
}

/* 主内容区滚动条稍宽一些 */
.content::-webkit-scrollbar,
.el-scrollbar__wrap::-webkit-scrollbar,
.el-table__body-wrapper::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.content::-webkit-scrollbar-thumb,
.el-scrollbar__wrap::-webkit-scrollbar-thumb,
.el-table__body-wrapper::-webkit-scrollbar-thumb {
  background: rgba(144, 147, 153, 0.25);
  border-radius: 4px;
}
.content::-webkit-scrollbar-thumb:hover,
.el-scrollbar__wrap::-webkit-scrollbar-thumb:hover,
.el-table__body-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(144, 147, 153, 0.4);
}

/* Element Plus 组件内部滚动条优化 */
.el-select-dropdown__wrap::-webkit-scrollbar,
.el-cascader-menu__wrap::-webkit-scrollbar,
.el-dropdown__list::-webkit-scrollbar,
.el-autocomplete-suggestion__wrap::-webkit-scrollbar {
  width: 5px;
}
.el-select-dropdown__wrap::-webkit-scrollbar-thumb,
.el-cascader-menu__wrap::-webkit-scrollbar-thumb,
.el-dropdown__list::-webkit-scrollbar-thumb,
.el-autocomplete-suggestion__wrap::-webkit-scrollbar-thumb {
  background: rgba(144, 147, 153, 0.3);
  border-radius: 2.5px;
}

/* 隐藏滚动条但保留滚动功能（特定场景）*/
.scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
.scrollbar-hidden {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* ============================================================
   WashClub Admin UI（仅对使用 wc-* 类的区域生效）
   - 页面筛选条 / 卡片容器 / 表格 / 弹窗视觉统一
   ============================================================ */

.wc-page{
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.wc-toolbar{
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 12px;
  border-radius: var(--app-radius);
  border: 1px solid var(--app-border);
  background: color-mix(in oklab, var(--app-surface), var(--app-surface-2) 35%);
  box-shadow: var(--app-shadow-0);
}

.wc-toolbar .wc-spacer{
  flex: 1;
  min-width: 12px;
}

.wc-field{ width: 160px; }
.wc-field--xs{ width: 120px; }
.wc-field--sm{ width: 140px; }
.wc-field--md{ width: 180px; }
.wc-field--lg{ width: 220px; }
.wc-field--full{ width: 100%; }

.wc-surface{
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-0);
}
.wc-surface--padded{ padding: 12px; }

.wc-table-wrap{
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  overflow: hidden;
  box-shadow: var(--app-shadow-0);
}

.wc-table-wrap .el-table{
  --el-table-border-color: transparent;
  --el-table-header-bg-color: color-mix(in oklab, var(--app-surface-2), transparent 20%);
  --el-table-row-hover-bg-color: color-mix(in oklab, var(--el-color-primary), transparent 93%);
}
.wc-table-wrap .el-table th.el-table__cell{
  background: var(--el-table-header-bg-color);
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.wc-table-wrap .el-table .el-table__cell{
  border-bottom: 1px solid color-mix(in oklab, var(--app-border), transparent 30%);
}
.wc-table-wrap .el-table .el-table__header-wrapper{
  border-bottom: 1px solid color-mix(in oklab, var(--app-border), transparent 30%);
}

.wc-pagination{
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 0;
}

/* Dialog：只对加了 wc-dialog class 的弹窗生效（避免影响其它模块） */
.wc-dialog.el-dialog{
  border-radius: var(--app-radius);
  overflow: hidden;
  box-shadow: var(--app-shadow-dialog);
  border: 1px solid var(--app-border);
}
.wc-dialog .el-dialog__header{
  padding: 14px 16px;
  margin-right: 0;
  border-bottom: 1px solid color-mix(in oklab, var(--app-border), transparent 10%);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--app-surface), var(--app-surface-2) 45%),
    var(--app-surface)
  );
}
.wc-dialog .el-dialog__title{
  font-weight: 800;
  letter-spacing: 0.2px;
  color: var(--el-text-color-primary);
}
.wc-dialog .el-dialog__body{
  padding: 16px 16px 10px;
}
.wc-dialog .el-dialog__footer{
  padding: 10px 16px 14px;
  border-top: 1px solid color-mix(in oklab, var(--app-border), transparent 10%);
  background: color-mix(in oklab, var(--app-surface), var(--app-surface-2) 22%);
}
.wc-dialog .el-form-item{ margin-bottom: 14px; }
.wc-dialog .el-form-item__label{
  color: var(--el-text-color-regular);
  font-weight: 600;
}

/* Popover：仅对指定 class 生效 */
.wc-log-popover{
  padding: 10px 10px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.16);
  border: 1px solid var(--app-border);
}
</style>

