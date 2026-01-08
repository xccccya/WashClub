<template>
	<el-drawer v-model="visibleLocal" title="挂单/取单" size="40%">
		<div class="hang-top">
			<div class="hang-current">
				<div class="hang-current-title">当前单</div>
				<div class="hang-current-summary">{{ currentSummary || '—' }}</div>
				<div class="hang-current-hint">提示：点击“挂到此槽”即可保存当前清单并开始下一单</div>
			</div>
		</div>
		<div class="hang-grid">
			<div v-for="slot in 8" :key="slot" class="hang-slot">
				<div class="slot-head">
					<div class="slot-title">
						{{ (hangSlots[slot-1] && hangSlots[slot-1].label) ? hangSlots[slot-1].label : ('挂单 ' + slot) }}
					</div>
					<div class="slot-sub">
						<span v-if="hangSlots[slot-1]?.ts" class="slot-time">{{ fmtTime(hangSlots[slot-1]?.ts) }}</span>
						<el-tag v-if="hangSlots[slot-1]" size="small" type="success" effect="light">已挂</el-tag>
						<el-tag v-else size="small" type="info" effect="light">空</el-tag>
					</div>
				</div>
				<div class="slot-body" v-if="hangSlots[slot-1]">
					<div class="slot-meta">{{ hangSlots[slot-1]?.summary || '-' }}</div>
					<div class="slot-actions">
						<el-button size="small" type="primary" @click="$emit('load', slot-1)">取单</el-button>
						<el-button size="small" :disabled="!canHang" @click="$emit('hang', slot-1)">覆盖挂单</el-button>
						<el-button size="small" @click="$emit('rename', slot-1)">改名</el-button>
						<el-button size="small" @click="$emit('clear', slot-1)">清空</el-button>
					</div>
				</div>
				<div v-else class="slot-empty">
					<div class="slot-empty-text">空槽</div>
					<div class="slot-actions">
						<el-button size="small" type="primary" :disabled="!canHang" @click="$emit('hang', slot-1)">挂到此槽</el-button>
					</div>
				</div>
			</div>
		</div>
		<div class="hang-footer">
			<el-button type="danger" plain @click="$emit('clear-all')">清空全部</el-button>
			<el-button @click="visibleLocal=false">关闭</el-button>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ modelValue: boolean; hangSlots: Array<any|null>; canHang?: boolean; currentSummary?: string }>();
const emit = defineEmits<{
	(e:'update:modelValue', v:boolean): void;
	(e:'load', idx:number): void;
	(e:'clear', idx:number): void;
	(e:'clear-all'): void;
	(e:'hang', idx:number): void;
	(e:'rename', idx:number): void;
}>();

const visibleLocal = computed({
	get(){ return props.modelValue; },
	set(v:boolean){ emit('update:modelValue', v); }
});

const canHang = computed(()=> !!props.canHang);
function fmtTime(ts: any){
	try{
		const n = Number(ts||0);
		if (!n) return '';
		return new Date(n).toLocaleString();
	}catch{ return ''; }
}
</script>

<style scoped>
.hang-top{
	display:flex;
	align-items:flex-start;
	justify-content:space-between;
	gap:12px;
	margin-bottom: 12px;
}
.hang-current{
	flex:1 1 auto;
	min-width:0;
	background: linear-gradient(180deg, rgba(64,158,255,0.10), rgba(64,158,255,0.04));
	border: 1px solid rgba(64,158,255,0.18);
	border-radius: 14px;
	padding: 10px 12px;
}
.hang-current-title{ font-weight:900; color:#111827; font-size:13px; }
.hang-current-summary{ margin-top: 4px; font-weight:900; color:#111827; font-size:16px; }
.hang-current-hint{ margin-top: 6px; color:#6b7280; font-size:12px; }

.hang-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px; }
.hang-slot{
	border: 1px solid #eef1f5;
	border-radius: 14px;
	padding: 12px;
	min-height: 128px;
	display:flex;
	flex-direction:column;
	gap:10px;
	background:#fff;
}
.slot-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.slot-title{ font-weight:900; color:#111827; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.slot-sub{ display:flex; align-items:center; gap:8px; flex:0 0 auto; }
.slot-time{ color:#9ca3af; font-size:12px; }
.slot-meta{ color:#374151; font-size:13px; line-height:1.35; }
.slot-empty{ display:flex; flex-direction:column; gap:10px; color:#9ca3af; }
.slot-empty-text{ font-size:13px; }
.slot-actions{ display:flex; flex-wrap:wrap; gap:8px; }
.hang-footer{
	margin-top: 14px;
	padding-top: 12px;
	border-top: 1px solid #eef1f5;
	display:flex;
	justify-content:flex-end;
	gap:10px;
}
</style>




