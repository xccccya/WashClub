<template>
	<el-dialog v-model="visibleLocal" title="未找到存在车辆，将创建新游客车辆，请选择车辆主类" width="420px">
		<div style="display:flex; flex-direction:column; gap:10px;">
			<el-select v-model="valueLocal" placeholder="选择主类">
				<el-option v-for="opt in options" :key="opt" :label="opt" :value="opt" />
			</el-select>
		</div>
		<template #footer>
			<el-button @click="$emit('cancel')">取消</el-button>
			<el-button type="primary" @click="$emit('confirm')">确定</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ modelValue: boolean; value: string; options: string[] }>();
const emit = defineEmits<{ (e:'update:modelValue', v:boolean): void; (e:'update:value', v:string): void; (e:'confirm'): void; (e:'cancel'): void }>();

const visibleLocal = computed({ get(){ return props.modelValue; }, set(v:boolean){ emit('update:modelValue', v); } });
const valueLocal = computed({ get(){ return props.value; }, set(v:string){ emit('update:value', v); } });
</script>

<style scoped>
</style>




