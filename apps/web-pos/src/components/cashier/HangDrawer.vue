<template>
	<el-drawer v-model="visibleLocal" title="挂单/取单" size="40%">
		<div class="hang-grid">
			<div v-for="slot in 8" :key="slot" class="hang-slot">
				<div class="slot-title">{{ (hangSlots[slot-1] && hangSlots[slot-1].label) ? hangSlots[slot-1].label : ('挂单 ' + slot) }}</div>
				<div class="slot-body" v-if="hangSlots[slot-1]">
					<div class="slot-meta">{{ hangSlots[slot-1]?.summary || '-' }}</div>
					<div class="slot-actions">
						<el-button size="small" type="primary" @click="$emit('load', slot-1)">取单</el-button>
						<el-button size="small" @click="$emit('clear', slot-1)">清空</el-button>
					</div>
				</div>
				<div v-else class="slot-empty">空</div>
			</div>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ modelValue: boolean; hangSlots: Array<any|null> }>();
const emit = defineEmits<{ (e:'update:modelValue', v:boolean): void; (e:'load', idx:number): void; (e:'clear', idx:number): void }>();

const visibleLocal = computed({
	get(){ return props.modelValue; },
	set(v:boolean){ emit('update:modelValue', v); }
});
</script>

<style scoped>
.hang-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:10px; }
.hang-slot{ border:1px dashed var(--el-border-color); border-radius:8px; padding:10px; min-height:100px; display:flex; flex-direction:column; gap:8px; }
.slot-title{ font-weight:700; }
.slot-empty{ color:#999; }
.slot-actions{ display:flex; gap:6px; }
</style>




