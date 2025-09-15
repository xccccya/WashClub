<template>
	<el-dialog v-model="visibleLocal" title="管理收货地址" width="680px">
		<div v-if="!model.editing">
			<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
				<div class="hint">共 {{ model.list.length }} 条</div>
				<el-button type="primary" @click="$emit('begin-create')">新增地址</el-button>
			</div>
			<el-table :data="model.list" height="360" size="small">
				<el-table-column label="地址" min-width="380">
					<template #default="{ row }">{{ addrDisplay(row) }}</template>
				</el-table-column>
				<el-table-column label="操作" width="160">
					<template #default="{ row }">
						<el-button size="small" @click="$emit('begin-edit', row)">编辑</el-button>
						<el-popconfirm title="确认删除该地址？" @confirm="$emit('delete', row)">
							<template #reference>
								<el-button size="small" type="danger">删除</el-button>
							</template>
						</el-popconfirm>
					</template>
				</el-table-column>
			</el-table>
		</div>
		<div v-else>
			<div class="addr-form-grid">
				<el-input v-model="model.form.province" placeholder="省" />
				<el-input v-model="model.form.city" placeholder="市" />
				<el-input v-model="model.form.district" placeholder="区/县" />
				<el-input v-model="model.form.street" placeholder="街道" />
				<el-input v-model="model.form.detail" placeholder="详细地址" />
				<el-input v-model="model.form.phone" placeholder="手机号" maxlength="11" />
				<el-input v-model="model.form.label" placeholder="标签(可选)" maxlength="4" />
			</div>
			<div style="text-align:right; margin-top:8px;">
				<el-button @click="model.editing=false">取消</el-button>
				<el-button type="primary" :loading="model.saving" @click="$emit('save')">保存</el-button>
			</div>
		</div>
		<template #footer>
			<el-button @click="visibleLocal=false">关闭</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ modelValue: boolean; model: any; addrDisplay: (a:any)=>string }>();
const emit = defineEmits<{ (e:'update:modelValue', v:boolean): void; (e:'begin-create'): void; (e:'begin-edit', row:any): void; (e:'save'): void; (e:'delete', row:any): void }>();

const visibleLocal = computed({ get(){ return props.modelValue; }, set(v:boolean){ emit('update:modelValue', v); } });

const model = computed(()=> props.model);
const addrDisplay = props.addrDisplay;
</script>

<style scoped>
.addr-form-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
.hint{ color:#909399; font-size:12px; }
</style>




