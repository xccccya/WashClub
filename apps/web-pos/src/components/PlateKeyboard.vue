<template>
	<div class="kb-panel">
		<div class="kb-head">
			<div class="left">
				<span class="title">车牌输入键盘</span>
			</div>
			<div class="right">
				<button type="button" class="btn" @mousedown.capture.stop.prevent @click.stop="emit('confirm')" @touchend.stop.prevent="emit('confirm')">完成</button>
			</div>
		</div>
		<div class="kb-rows">
			<!-- 模式切换行 -->
			<div class="row ops">
				<button type="button" class="key op" :class="{ active: mode==='province' }" @mousedown.capture.stop.prevent @click.stop="mode='province'" @touchend.stop.prevent="mode='province'">省/市</button>
				<button type="button" class="key op" :class="{ active: mode==='alpha' }" @mousedown.capture.stop.prevent @click.stop="mode='alpha'" @touchend.stop.prevent="mode='alpha'">123/ABC</button>
				<button type="button" class="key op del" @mousedown.capture.stop.prevent @click.stop="emit('delete')" @touchend.stop.prevent="emit('delete')">删除</button>
			</div>
			<!-- 省市模式：三行省份简称 -->
			<template v-if="mode==='province'">
				<div class="row grid" v-for="(r,ri) in provincesRows" :key="'pr'+ri">
					<button type="button" v-for="p in r" :key="p" class="key" @mousedown.capture.stop.prevent @click.stop="emit('press', p)" @touchend.stop.prevent="emit('press', p)">{{ p }}</button>
				</div>
			</template>
			<!-- 字母数字模式：数字 + 字母三行 + 特殊标识 -->
			<template v-else>
				<div class="row grid">
					<button type="button" v-for="a in rowNumber" :key="'n'+a" class="key" @mousedown.capture.stop.prevent @click.stop="emit('press', a)" @touchend.stop.prevent="emit('press', a)">{{ a }}</button>
				</div>
				<div class="row grid">
					<button type="button" v-for="a in rowAlpha1" :key="'a1'+a" class="key" @mousedown.capture.stop.prevent @click.stop="emit('press', a)" @touchend.stop.prevent="emit('press', a)">{{ a }}</button>
				</div>
				<div class="row grid">
					<button type="button" v-for="a in rowAlpha2" :key="'a2'+a" class="key" @mousedown.capture.stop.prevent @click.stop="emit('press', a)" @touchend.stop.prevent="emit('press', a)">{{ a }}</button>
				</div>
				<div class="row grid">
					<button type="button" v-for="a in rowAlpha3" :key="'a3'+a" class="key" @mousedown.capture.stop.prevent @click.stop="emit('press', a)" @touchend.stop.prevent="emit('press', a)">{{ a }}</button>
					<button type="button" v-for="s in specials" :key="'s'+s" class="key" @mousedown.capture.stop.prevent @click.stop="emit('press', s)" @touchend.stop.prevent="emit('press', s)">{{ s }}</button>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
	(e: 'press', ch: string): void;
	(e: 'delete'): void;
	(e: 'confirm'): void;
}>();

const mode = ref<'province'|'alpha'>('alpha');

// 省/市三行排布
const provincesRows = [
	Array.from('京津冀晋蒙辽吉鲁豫粤'),
	Array.from('黑沪苏浙皖闽赣鄂湘桂'),
	Array.from('渝川贵云藏陕甘琼青宁'),
];

// 数字与字母键盘（无 I/O，共四行）
const rowNumber = Array.from('0123456789');
const rowAlpha1 = Array.from('ABCDEFGHJK');
const rowAlpha2 = Array.from('LMNPQRSTUV');
const rowAlpha3 = Array.from('WXYZ');
const specials = ['警','澳','港','领','使','学'];
</script>

<style scoped>
.kb-panel{ background:#fff; border-radius: 16px; padding: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.12); width: 560px; max-width: 92vw; }
.kb-head{ display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px; }
.kb-head .title{ font-weight:700; margin-right:8px; }
.kb-head .hint{ font-size: 12px; color:#6b7280; }
.kb-head .btn{ background:#409eff; color:#fff; border:none; border-radius:8px; padding:8px 12px; cursor:pointer; }
.kb-rows .row{ display:flex; flex-wrap: nowrap; gap: 8px; margin-bottom: 8px; }
.row.grid .key{ flex: 0 0 calc((100% - 9*8px)/10); }
.key{ height: 56px; background:#f1f5f9; border-radius: 12px; display:flex; align-items:center; justify-content:center; border:none; font-size:18px; cursor:pointer; user-select:none; }
.row.ops{ display:flex; gap: 8px; margin-bottom: 12px; }
.row.ops .key.op{ flex: 1 1 0; height: 48px; }
.row.ops .key.op.active{ background:#eef2ff; color:#1f2937; }
.row.ops .key.del{ background:#fee2e2; }

@media (min-width: 1280px){
	.key{ height: 60px; font-size: 20px; }
	.kb-panel{ width: 600px; }
}
</style>


