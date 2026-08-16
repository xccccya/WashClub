<template>
	<div class="page">
		<div class="head"><h2>全部行程订单</h2><el-button @click="load">刷新</el-button></div>
		<el-card>
			<el-form inline @submit.prevent="search">
				<el-form-item label="订单号"><el-input v-model="filters.keyword" clearable placeholder="输入订单号" /></el-form-item>
				<el-form-item label="乘客"><el-input v-model="filters.passenger" clearable placeholder="姓名或手机号" /></el-form-item>
				<el-form-item label="司机"><el-input v-model="filters.driver" clearable placeholder="姓名或手机号" /></el-form-item>
				<el-form-item label="状态"><el-select v-model="filters.status" clearable style="width:190px"><el-option v-for="item in statuses" :key="item" :label="statusText(item)" :value="item" /></el-select></el-form-item>
				<el-form-item label="创建时间"><el-date-picker v-model="filters.timeRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" /></el-form-item>
				<el-form-item><el-button type="primary" native-type="submit">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
			</el-form>
			<el-table v-loading="loading" :data="items" stripe>
				<el-table-column prop="order.no" label="订单号" min-width="190" />
				<el-table-column label="乘客" min-width="120"><template #default="{row}">{{ row.passenger?.name || row.passengerMemberId }}</template></el-table-column>
				<el-table-column label="司机" min-width="120"><template #default="{row}">{{ row.driverEmployee?.name || row.driverMember?.name || '待接单' }}</template></el-table-column>
				<el-table-column label="起点" min-width="180" show-overflow-tooltip prop="originAddress" />
				<el-table-column label="终点" min-width="180" show-overflow-tooltip prop="destinationAddress" />
				<el-table-column label="状态" width="130"><template #default="{row}"><el-tag>{{ statusText(row.status) }}</el-tag></template></el-table-column>
				<el-table-column label="预估/最终" width="140"><template #default="{row}">¥{{ money(row.estimatedAmount) }} / {{ row.finalAmount == null ? '-' : `¥${money(row.finalAmount)}` }}</template></el-table-column>
				<el-table-column prop="createdAt" label="创建时间" width="180"><template #default="{row}">{{ formatTime(row.createdAt) }}</template></el-table-column>
				<el-table-column label="操作" width="100" fixed="right"><template #default="{row}"><el-button link type="primary" @click="$router.push(`/rides/orders/${row.id}`)">详情</el-button></template></el-table-column>
			</el-table>
			<el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="prev, pager, next, total" @current-change="load" />
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { rideAdminControllerList } from '@wash/api-client';
const statuses = ['PREPAY_PENDING','DISPATCHING','TO_PICKUP','ARRIVED_PICKUP','IN_TRIP','ARRIVED_DESTINATION','FARE_PENDING','SUPPLEMENT_PENDING','REFUND_PENDING','COMPLETED','CANCELLED','NO_DRIVER'];
const filters = ref({ keyword:'', passenger:'', driver:'', status:'', timeRange:[] as Date[] });
const items = ref<any[]>([]); const total = ref(0); const page = ref(1); const loading = ref(false);
async function load(){
	loading.value=true;
	try{
		const [startAt,endAt]=filters.value.timeRange||[];
		const data=(await rideAdminControllerList({page:page.value,pageSize:20,keyword:filters.value.keyword||undefined,passenger:filters.value.passenger||undefined,driver:filters.value.driver||undefined,status:filters.value.status||undefined,startAt:startAt?.toISOString(),endAt:endAt?.toISOString()} as any) as unknown) as any;
		items.value=data?.items||[]; total.value=Number(data?.total||0);
	} finally{loading.value=false;}
}
function search(){page.value=1;void load()}
function reset(){filters.value={keyword:'',passenger:'',driver:'',status:'',timeRange:[]};search()}
function money(v:any){return Number(v||0).toFixed(2)} function formatTime(v:string){return v?new Date(v).toLocaleString():'-'}
function statusText(v:string){return ({PREPAY_PENDING:'待预付',DISPATCHING:'派单中',TO_PICKUP:'前往上车点',ARRIVED_PICKUP:'已到上车点',IN_TRIP:'行程中',ARRIVED_DESTINATION:'已到目的地',FARE_PENDING:'费用确认',SUPPLEMENT_PENDING:'待补款',REFUND_PENDING:'退款中',COMPLETED:'已完成',CANCELLED:'已取消',NO_DRIVER:'无司机'} as any)[v]||v}
onMounted(load);
</script>
<style scoped>.page{display:flex;flex-direction:column;gap:16px}.head{display:flex;justify-content:space-between;align-items:center}.head h2{margin:0}.el-pagination{margin-top:18px;justify-content:flex-end}</style>
