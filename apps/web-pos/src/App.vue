<template>
	<router-view v-slot="{ Component }">
		<transition name="fade" mode="out-in">
			<component :is="Component" />
		</transition>
	</router-view>
</template>

<script setup lang="ts">
// 触屏全局优化：增大点击区域和默认字体
</script>

<style>
html, body, #app { height: 100%; }
* { -webkit-tap-highlight-color: transparent; }
body { font-size: 16.5px; }
/* 全局触控尺寸与表单密度（平板优先） */
:root{
  --pos-touch-padding-y: 12px;
  --pos-touch-padding-x: 14px;
  --pos-input-padding-y: 10px;
  --pos-input-padding-x: 12px;
}
/* Element Plus 全局尺寸微调 */
.el-button--large { padding: var(--pos-touch-padding-y) var(--pos-touch-padding-x); }
.el-input__wrapper { padding: var(--pos-input-padding-y) var(--pos-input-padding-x); }
.el-select__wrapper { padding: var(--pos-input-padding-y) var(--pos-input-padding-x); }
.el-dialog { border-radius: 10px; }
.el-dialog__body { padding-top: 10px; }
/* 全局淡入淡出左右位移过渡 */
.fade-enter-active, .fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.fade-enter-from { opacity: 0; transform: translateX(12px); }
.fade-leave-to { opacity: 0; transform: translateX(-12px); }

/* ========= 全局美化滚动条（接近截图样式：细、圆角、低存在感） ========= */
:root{
  --pos-scrollbar-size: 10px;
  --pos-scrollbar-thumb: rgba(17, 24, 39, 0.18);
  --pos-scrollbar-thumb-hover: rgba(17, 24, 39, 0.30);
  --pos-scrollbar-track: transparent;
}

/* Firefox */
*{
  scrollbar-width: thin;
  scrollbar-color: var(--pos-scrollbar-thumb) var(--pos-scrollbar-track);
}

/* Chromium / Safari */
*::-webkit-scrollbar{
  width: var(--pos-scrollbar-size);
  height: var(--pos-scrollbar-size);
}
*::-webkit-scrollbar-track{
  background: var(--pos-scrollbar-track);
}
*::-webkit-scrollbar-thumb{
  background-color: var(--pos-scrollbar-thumb);
  border-radius: 999px;
  /* 通过透明边框制造“更细”的观感 */
  border: 3px solid transparent;
  background-clip: content-box;
}
*::-webkit-scrollbar-thumb:hover{
  background-color: var(--pos-scrollbar-thumb-hover);
}

/* Element Plus el-scrollbar（自绘滚动条）同步风格 */
.el-scrollbar__bar.is-vertical{ width: var(--pos-scrollbar-size); }
.el-scrollbar__bar.is-horizontal{ height: var(--pos-scrollbar-size); }
.el-scrollbar__thumb{
  background: var(--pos-scrollbar-thumb) !important;
  border-radius: 999px !important;
}
.el-scrollbar__thumb:hover{
  background: var(--pos-scrollbar-thumb-hover) !important;
}
</style>
