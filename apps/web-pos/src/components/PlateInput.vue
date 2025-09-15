
<template>
	<div class="plate-input">
		<div v-if="inline" class="box" @click="openKeyboard">
			<div class="cells">
				<span v-for="(ch, idx) in cells" :key="idx" class="cell" :class="{ first: idx===0, nev: idx===7 }">{{ ch || '' }}</span>
				<div v-if="isNewEnergy" class="nev-badge"><span class="nev-badge-text" v-for="c in nevChars" :key="c">{{ c }}</span></div>
			</div>
			<span class="placeholder" :class="{ hidden: hasPreviewPlate }">{{ placeholder || '点击输入车牌' }}</span>
			<button v-if="showClear" type="button" class="clear-btn" @click.stop="clearAll">清除</button>
		</div>

		<!-- 自定义车牌键盘（保持与小程序同款布局，放大适配） -->
		<div v-if="visible" class="kb-mask" @click="close"></div>
		<div v-if="visible" class="kb-panel">
			<div class="kb-head">
				<div class="left">
					<span class="title">车牌输入</span>
					<span class="hint">{{ isNewEnergy ? '新能源8位' : '普通7位' }}</span>
				</div>
				<div class="right">
					<button type="button" class="close" @click="close">关闭键盘</button>
				</div>
			</div>
			<div class="kb-cells">
				<span v-for="(ch, idx) in cells" :key="idx" class="kb-cell" :class="{ active: idx===pos, first: idx===0 }" @click="setPos(idx)">{{ ch || '·' }}</span>
			</div>
			<div class="kb-rows">
				<template v-if="pos===0">
					<div class="row grid" v-for="(r,ri) in provincesRows" :key="'pr'+ri">
						<button type="button" v-for="p in r" :key="p" class="key" @click="input(p)">{{ p }}</button>
					</div>
				</template>
				<div v-else class="row grid">
					<button type="button" v-for="a in rowNumber" :key="'n'+a" class="key" @click="input(a)">{{ a }}</button>
				</div>
				<div v-if="pos!==0 && alphaMode==='alpha'" class="row grid">
					<button type="button" v-for="a in rowAlpha1" :key="'a1'+a" class="key" @click="input(a)">{{ a }}</button>
				</div>
				<div v-if="pos!==0 && alphaMode==='alpha'" class="row grid">
					<button type="button" v-for="a in rowAlpha2" :key="'a2'+a" class="key" @click="input(a)">{{ a }}</button>
				</div>
				<div v-if="pos!==0 && alphaMode==='alpha'" class="row grid">
					<button type="button" v-for="a in rowAlpha3" :key="'a3'+a" class="key" @click="input(a)">{{ a }}</button>
					<button type="button" v-for="s in specials" :key="'s'+s" class="key" @click="input(s)">{{ s }}</button>
				</div>
				<div class="row ops">
					<template v-if="pos===0">
						<button type="button" class="key xin" @click="input('新')">新</button>
						<button type="button" class="key op del" @click="del">删除</button>
						<button type="button" class="key op ok" @click="confirm">完成</button>
					</template>
					<template v-else>
						<button type="button" class="key op" @click="goProvince">⇄ 省/市</button>
						<button type="button" class="key op" @click="toggleAlpha">⇄ 123/ABC</button>
						<button type="button" class="key op del" @click="del">删除</button>
						<button type="button" class="key op ok" @click="confirm">完成</button>
					</template>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, computed, defineExpose } from 'vue';

const props = defineProps<{ modelValue: string; placeholder?: string; inline?: boolean; clearable?: boolean }>();
const emit = defineEmits<{ (e:'update:modelValue', v: string): void; (e:'confirm'): void; (e:'clear'): void }>();

const visible = ref(false);
const isNewEnergy = ref(false);
const pos = ref(0);
const cells = ref<string[]>(Array(8).fill(''));
const nevChars = Array.from('新能源');
const previewValue = ref('');
const hasPreviewPlate = computed(() => {
	const modelLen = (props.modelValue || '').trim().length;
	const previewLen = (previewValue.value || '').trim().length;
	return modelLen >= 7 || previewLen >= 7;
});
const showClear = computed(()=>{
	if (props.clearable === false) return false;
	return ((props.modelValue||'').trim().length > 0);
});

// 省/市三行排布（保持同款布局）
const provincesRows = [
	Array.from('京津冀晋蒙辽吉鲁豫粤'),
	Array.from('黑沪苏浙皖闽赣鄂湘桂'),
	Array.from('渝川贵云藏陕甘琼青宁'),
];
const provinces = provincesRows.flat();
// 数字与字母键盘（无 I/O，共四行）
const rowNumber = Array.from('0123456789');
const rowAlpha1 = Array.from('ABCDEFGHJK');
const rowAlpha2 = Array.from('LMNPQRSTUV');
const rowAlpha3 = Array.from('WXYZ');
const specials = ['警','澳','港','领','使','学'];
const alphaMode = ref<'num'|'alpha'>('num');

watch(() => props.modelValue, (v) => {
	const s = (v||'').toUpperCase().replace(/\s+/g,'');
	const arr = Array(8).fill('');
	for (let i=0; i<Math.min(s.length,8); i++) arr[i] = s[i];
	cells.value = arr;
	isNewEnergy.value = s.length >= 8;
}, { immediate: true });

function openKeyboard(){
	visible.value = true;
	const i = cells.value.findIndex(c => !c);
	pos.value = i>=0 ? i : (isNewEnergy.value ? 7 : 6);
	alphaMode.value = pos.value === 0 ? 'num' : 'alpha';
}
function close(){ commitToModel(); visible.value = false; }
function setPos(i: number){ pos.value = i; }
function goProvince(){ pos.value = 0; }
function toggleAlpha(){ alphaMode.value = alphaMode.value==='num' ? 'alpha' : 'num'; }
function input(ch: string){
	const currentPos = pos.value;
	if (currentPos === 0 && !(provinces.includes(ch) || ch === '新')) return;
	const allowNum = rowNumber; const allowAlpha = [...rowAlpha1, ...rowAlpha2, ...rowAlpha3, ...specials];
	if (currentPos > 0) {
		const isAllowed = allowNum.includes(ch) || allowAlpha.includes(ch);
		if (!isAllowed) return;
	}
	cells.value[currentPos] = ch;
	if (currentPos < 7) pos.value = currentPos + 1;
	if (currentPos === 0) alphaMode.value = 'alpha';
	isNewEnergy.value = !!cells.value[7];
	updatePreviewFromCells();
	commitToModel();
}
function del(){
	if (cells.value[pos.value]) {
		cells.value[pos.value] = '';
		isNewEnergy.value = !!cells.value[7];
		updatePreviewFromCells();
		commitToModel();
		return;
	}
	if (pos.value > 0) {
		pos.value--;
		cells.value[pos.value] = '';
		isNewEnergy.value = !!cells.value[7];
		updatePreviewFromCells();
		commitToModel();
	}
}
function confirm(){ commitToModel(); previewValue.value = ''; try{ emit('confirm'); }catch{} close(); }
function commitToModel(){ const maxLen = cells.value[7] ? 8 : 7; const s = cells.value.slice(0, maxLen).join(''); emit('update:modelValue', s); }

function updatePreviewFromCells(){
	const filledChars = cells.value.filter(ch => !!ch);
	previewValue.value = filledChars.slice(0, 8).join('');
}

// 暴露方法用于外部仅调用键盘
function open(){ openKeyboard(); }
defineExpose({ open, close });

function clearAll(){
	try{
		cells.value = Array(8).fill('');
		isNewEnergy.value = false;
		previewValue.value = '';
		emit('update:modelValue', '');
		try{ emit('clear'); }catch{}
	}catch{}
}
</script>

<style scoped>
.box{ padding: 12px; background:#f3f4f6; border-radius: 10px; color:#111827; position: relative; cursor: pointer; }
.cells{ display:flex; gap: 6px; }
.cell{ width: 48px; height: 48px; background:#fff; border-radius: 8px; border: 1px solid #e5e7eb; display:flex; align-items:center; justify-content:center; font-weight:700; font-size: 18px; user-select: none; }
.cell.first{ border-color:#60a5fa; }
.cell.nev{ background:#e6fff4; }
.placeholder{ position:absolute; left: 12px; top: 10px; color:#9ca3af; font-size: 13px; transition: opacity 220ms ease; opacity: 1; pointer-events: none; }
.placeholder.hidden{ opacity: 0; }
.nev-badge{ display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 2px 2px; border-radius: 6px; background:#e6fff4; color:#16a34a; font-size: 12px; margin-left: 4px; position: static; }
.nev-badge-text{ line-height: 14px; }
/* 清除按钮：吸附在输入框右侧，触控友好 */
.clear-btn{ position:absolute; right: 10px; top: 50%; transform: translateY(-50%); background:#fee2e2; color:#d03050; border:none; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor:pointer; }

/* 键盘蒙层与面板（放大适配 12.7" 平板） */
.kb-mask{ position: fixed; left:0; right:0; top:0; bottom:0; background:rgba(0,0,0,0.35); z-index: 3100; }
.kb-panel{ position: fixed; left:0; right:0; bottom:0; background:#fff; border-radius: 20px 20px 0 0; padding: 12px; z-index: 3110; box-shadow: 0 -6px 20px rgba(0,0,0,.12); }
.kb-head{ display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px; }
.kb-head .title{ font-weight: 700; margin-right: 10px; font-size: 16px; }
.kb-head .hint{ font-size: 14px; color:#6b7280; }
.kb-head .close{ background:transparent; border:none; color:#409eff; font-size:14px; cursor:pointer; }
.kb-cells{ display:flex; gap: 8px; margin-bottom: 10px; justify-content: center; }
.kb-cell{ width: 56px; height: 56px; border-radius: 8px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-weight:700; font-size: 18px; user-select: none; }
.kb-cell.first{ border: 2px solid #60a5fa; }
.kb-cell.active{ outline: 2px solid #2563eb; }
.kb-rows .row{ display:flex; flex-wrap: nowrap; gap: 8px; margin-bottom: 8px; }
.row.grid .key{ flex: 0 0 calc((100% - 9*8px)/10); }
.key{ height: 56px; background:#f1f5f9; border-radius: 12px; display:flex; align-items:center; justify-content:center; border:none; font-size:18px; cursor:pointer; user-select:none; }
.row.ops{ display:flex; gap: 8px; }
.row.ops .key.xin{ flex: 0 0 calc((100% - 3*8px)/10); }
.row.ops .key.op{ flex: 1 1 0; }
.key.mode{ background:#eef2ff; }
.key.del{ background:#fee2e2; }
.key.ok{ background:#dcfce7; }

/* 更大屏幕进一步放大（横屏 12.7"） */
@media (min-width: 1280px){
	.kb-cell{ width: 60px; height: 60px; font-size: 20px; }
	.key{ height: 60px; font-size: 20px; }
	.cell{ width: 52px; height: 52px; font-size: 19px; }
}
</style>


