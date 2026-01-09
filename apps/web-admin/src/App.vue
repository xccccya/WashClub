<template>
	<router-view />
</template>

<script setup lang="ts"></script>

<style>
html, body, #app { height: 100%; }
/* 主题变量：通过 data-theme / data-color-scheme 控制 */
:root{
  --app-primary: #409eff;
  --app-success: #67c23a;
  --app-warning: #e6a23c;
  --app-danger:  #f56c6c;
  --app-bg: #ffffff;
  --app-text: #303133;
  --app-muted: #606266;
}
[data-theme='dark']{
  color-scheme: dark;
  --app-bg: #0f1114;
  --app-text: #e9edf3;
  --app-muted: #a6a9b2;
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
</style>

