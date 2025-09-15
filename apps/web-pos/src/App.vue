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
</style>
