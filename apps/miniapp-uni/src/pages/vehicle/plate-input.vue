<template>
	<view class="plate-input">
		<view class="box" @tap="openKeyboard">
			<view class="cells">
				<text v-for="(ch, idx) in cells" :key="idx" class="cell" :class="{ first: idx===0, nev: idx===7 }">{{ ch || '' }}</text>
				<view v-if="isNewEnergy" class="nev-badge"><text v-for="c in nevChars" :key="c">{{ c }}</text></view>
			</view>
			<text class="placeholder" :class="{ hidden: hasPreviewPlate }">点击输入车牌</text>
		</view>

		<!-- 自定义车牌键盘 -->
		<view v-if="visible" class="kb-mask" @tap="close"></view>
		<view v-if="visible" class="kb-panel">
			<view class="kb-head">
				<view class="left">
					<text class="title">车牌输入</text>
					<text class="hint">{{ isNewEnergy ? '新能源8位' : '普通7位' }}</text>
				</view>
				<view class="right">
					<text class="close" @tap="close">关闭键盘</text>
				</view>
			</view>
			<view class="kb-cells">
				<text v-for="(ch, idx) in cells" :key="idx" class="kb-cell" :class="{ active: idx===pos, first: idx===0 }" @tap="setPos(idx)">{{ ch || '·' }}</text>
			</view>
			<view class="kb-rows">
				<template v-if="pos===0">
					<view class="row grid" v-for="(r,ri) in provincesRows" :key="'pr'+ri">
						<text v-for="p in r" :key="p" class="key" @tap="input(p)">{{ p }}</text>
					</view>
				</template>
				<view v-else class="row grid">
					<text v-for="a in rowNumber" :key="'n'+a" class="key" @tap="input(a)">{{ a }}</text>
				</view>
				<view v-if="pos!==0 && alphaMode==='alpha'" class="row grid">
					<text v-for="a in rowAlpha1" :key="'a1'+a" class="key" @tap="input(a)">{{ a }}</text>
				</view>
				<view v-if="pos!==0 && alphaMode==='alpha'" class="row grid">
					<text v-for="a in rowAlpha2" :key="'a2'+a" class="key" @tap="input(a)">{{ a }}</text>
				</view>
				<view v-if="pos!==0 && alphaMode==='alpha'" class="row grid">
					<text v-for="a in rowAlpha3" :key="'a3'+a" class="key" @tap="input(a)">{{ a }}</text>
					<text v-for="s in specials" :key="'s'+s" class="key" @tap="input(s)">{{ s }}</text>
				</view>
				<view class="row ops">
					<template v-if="pos===0">
						<text class="key xin" @tap="input('新')">新</text>
						<text class="key op del" @tap="del">删除</text>
						<text class="key op ok" @tap="confirm">完成</text>
					</template>
					<template v-else>
						<text class="key op" @tap="goProvince">⇄ 省/市</text>
						<text class="key op" @tap="toggleAlpha">⇄ 123/ABC</text>
						<text class="key op del" @tap="del">删除</text>
						<text class="key op ok" @tap="confirm">完成</text>
					</template>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e:'update:modelValue', v: string): void }>();

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

// 省/市三行排布
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
function close(){ visible.value = false; }
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
}
function del(){ if (cells.value[pos.value]) { cells.value[pos.value] = ''; isNewEnergy.value = !!cells.value[7]; updatePreviewFromCells(); return; } if (pos.value > 0) { pos.value--; cells.value[pos.value] = ''; isNewEnergy.value = !!cells.value[7]; updatePreviewFromCells(); } }
function confirm(){ const maxLen = cells.value[7] ? 8 : 7; const s = cells.value.slice(0, maxLen).join(''); emit('update:modelValue', s); previewValue.value = ''; close(); }

function updatePreviewFromCells(){
	const filledChars = cells.value.filter(ch => !!ch);
	previewValue.value = filledChars.slice(0, 8).join('');
}
</script>

<style>
.plate-input { }
.box { padding: 18rpx; background:#f3f4f6; border-radius: 12rpx; color:#111827; position: relative; }
.cells { display:flex; gap: 8rpx; }
.cell { width: 64rpx; height: 64rpx; background:#fff; border-radius: 8rpx; border: 2rpx solid #e5e7eb; display:flex; align-items:center; justify-content:center; font-weight:700; font-size: 28rpx; }
.cell.first { border-color:#60a5fa; }
.cell.nev { background:#e6fff4; }
.placeholder { position:absolute; left: 18rpx; top: 18rpx; color:#9ca3af; font-size: 24rpx; transition: opacity 220ms ease; opacity: 1; pointer-events: none; }
.placeholder.hidden { opacity: 0; }
.nev-badge { display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 4rpx 4rpx; border-radius: 6rpx; background:#e6fff4; color:#16a34a; font-size: 18rpx; margin-left: 6rpx; }
.nev-badge text { line-height: 18rpx; }

.kb-mask { position: fixed; left:0; right:0; top:0; bottom:0; background:rgba(0,0,0,0.35); z-index: 999; }
.kb-panel { position: fixed; left:0; right:0; bottom:0; background:#fff; border-radius: 24rpx 24rpx 0 0; padding: 16rpx; z-index: 1000; }
.kb-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 10rpx; }
.kb-head .title { font-weight: 700; margin-right: 10rpx; }
.kb-head .hint { font-size: 24rpx; color:#6b7280; }
.kb-head .close { color:#409eff; }
.kb-cells { display:flex; gap: 10rpx; margin-bottom: 12rpx; justify-content: center; }
.kb-cell { width: 64rpx; height: 64rpx; border-radius: 8rpx; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-weight:700; }
.kb-cell.first { border: 2rpx solid #60a5fa; }
.kb-cell.active { outline: 2rpx solid #2563eb; }
.kb-rows .row { display:flex; flex-wrap: nowrap; gap: 10rpx; margin-bottom: 10rpx; }
.row.grid .key { flex: 0 0 calc((100% - 9*10rpx)/10); }
.key { height: 64rpx; background:#f1f5f9; border-radius: 12rpx; display:flex; align-items:center; justify-content:center; }
.row.ops { display:flex; gap: 10rpx; }
.row.ops .key.xin { flex: 0 0 calc((100% - 3*10rpx)/10); }
.row.ops .key.op { flex: 1 1 0; }
.key.mode { background:#eef2ff; }
.key.del { background:#fee2e2; }
.key.ok { background:#dcfce7; }
</style>


