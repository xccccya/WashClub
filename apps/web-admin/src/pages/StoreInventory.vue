<template>
	<div>
		<h3>库存管理</h3>
		<div class="toolbar">
			<el-input v-model.number="productId" placeholder="商品ID" style="width:120px;margin-right:8px;" />
			<el-input v-model.number="skuId" placeholder="SKU ID(可选)" style="width:140px;margin-right:8px;" />
			<el-input v-model.number="change" placeholder="变更数量(+入库/-出库)" style="width:200px;margin-right:8px;" />
			<el-select v-model="reason" placeholder="原因" style="width:160px;margin-right:8px;">
				<el-option label="入库" value="INBOUND" />
				<el-option label="出库" value="OUTBOUND" />
				<el-option label="调整" value="ADJUSTMENT" />
			</el-select>
			<el-input v-model="remark" placeholder="备注" style="width:240px;margin-right:8px;" />
			<el-button type="primary" @click="doAdjust">提交</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const productId = ref<number | undefined>(undefined);
const skuId = ref<number | undefined>(undefined);
const change = ref<number | undefined>(undefined);
const reason = ref('INBOUND');
const remark = ref('');

async function doAdjust(){
	if (!productId.value || !change.value) { ElMessage.error('请填写商品ID和变更数量'); return; }
	await http('/store/inventory/adjust', { method:'POST', body: { productId: productId.value, skuId: skuId.value || undefined, change: change.value, reason: reason.value, remark: remark.value } });
	ElMessage.success('已完成库存调整');
}
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
</style>


