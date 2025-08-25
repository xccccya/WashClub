<template>
	<div>
		<el-button @click="$router.back()" style="margin-bottom:12px;">返回</el-button>
		<h3>订单详情 #{{ id }}</h3>
		<el-descriptions :column="2" border>
			<el-descriptions-item label="订单号">{{ data?.no }}</el-descriptions-item>
			<el-descriptions-item label="类型">{{ data?.type }}</el-descriptions-item>
			<el-descriptions-item label="状态">{{ data?.status }}</el-descriptions-item>
			<el-descriptions-item label="支付状态">{{ data?.payStatus }}</el-descriptions-item>
			<el-descriptions-item label="支付方式">{{ data?.payMethod || '-' }}</el-descriptions-item>
			<el-descriptions-item label="订单总额">{{ data?.totalAmount }}</el-descriptions-item>
			<el-descriptions-item label="减免金额">{{ data?.discountAmount }}</el-descriptions-item>
			<el-descriptions-item label="配送费">{{ data?.shippingFee }}</el-descriptions-item>
			<el-descriptions-item label="支付金额">{{ data?.payAmount }}</el-descriptions-item>
			<el-descriptions-item label="下单时间">{{ formatDate(data?.createdAt) }}</el-descriptions-item>
			<el-descriptions-item label="支付时间">{{ formatDate(data?.paidAt) }}</el-descriptions-item>
			<el-descriptions-item label="会员">{{ data?.member?.name }}（UID: {{ data?.member?.uid }} / {{ data?.member?.phone }}）</el-descriptions-item>
			<el-descriptions-item label="备注">{{ data?.remark || '-' }}</el-descriptions-item>
			<el-descriptions-item label="车辆" v-if="data?.type==='SERVICE'">{{ data?.vehicle?.plateNumber || '-' }}</el-descriptions-item>
		</el-descriptions>
		<h4 style="margin-top:16px;">订单项</h4>
		<el-table :data="data?.items||[]" border size="small" style="width: 100%">
			<el-table-column label="图片" width="80">
				<template #default="{ row }">
					<img v-if="row.imageUrl" :src="row.imageUrl" style="width:48px;height:48px;object-fit:cover;" />
					<span v-else>-</span>
				</template>
			</el-table-column>
			<el-table-column prop="name" label="名称" />
			<el-table-column prop="specsText" label="规格" width="200" />
			<el-table-column prop="barcode" label="条码" width="160" />
			<el-table-column prop="price" label="单价" width="120" />
			<el-table-column prop="discount" label="优惠" width="120" />
			<el-table-column prop="quantity" label="数量" width="80" />
		</el-table>

		<h4 style="margin-top:16px;">权益与卡券</h4>
		<el-descriptions :column="2" border>
			<el-descriptions-item label="使用积分">{{ data?.usedPoints }}</el-descriptions-item>
			<el-descriptions-item label="积分抵扣金额">{{ data?.pointsAmount }}</el-descriptions-item>
			<el-descriptions-item label="卡券信息">{{ formatCoupon(data?.couponInfo) }}</el-descriptions-item>
		</el-descriptions>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';

const route = useRoute();
const id = Number(route.params.id);
const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const data = ref<any>(null);
async function fetchDetail(){ data.value = await http(`/orders/${id}`); }
onMounted(fetchDetail);

function formatDate(val: string | null | undefined){
	if(!val) return '-';
	try{ return new Date(val).toLocaleString(); }catch{ return String(val); }
}

function formatCoupon(info: any){
	if(!info) return '-';
	try{
		if(typeof info === 'string') return info;
		if(info.name) return `${info.name}`;
		return JSON.stringify(info);
	}catch{ return '-'; }
}
</script>

<style scoped>
</style>


