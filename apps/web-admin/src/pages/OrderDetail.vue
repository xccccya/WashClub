<template>
	<div>
		<el-button @click="$router.back()" style="margin-bottom:12px;">返回</el-button>
		<h3>订单详情 {{ data?.no ? ('#' + data?.no) : '' }}</h3>
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
			<el-descriptions-item label="收货地址" v-if="data?.shippingAddressSnapshot">
				{{ addrDisplay(data?.shippingAddressSnapshot) }}
			</el-descriptions-item>
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

		<h4 style="margin-top:16px;">物流信息</h4>
		<el-card v-if="data?.type==='SP'" class="box-card" shadow="hover">
			<template #default>
				<div v-if="data?.shipNoExpress" style="color:#606266;">商家已选择无需快递发货</div>
				<div v-else-if="data?.shipExpressTrackingNo" style="display:flex;align-items:center;gap:12px;">
					<img v-if="data?.shipExpressCompanyLogo" :src="data?.shipExpressCompanyLogo" style="width:28px;height:28px;object-fit:contain;" />
					<div style="flex:1;min-width:0;">
						<div>快递公司：{{ data?.shipExpressCompanyName || data?.shipExpressCompanyCode || '-' }}</div>
						<div>运单号：{{ data?.shipExpressTrackingNo }}</div>
						<div v-if="data?.shippedAt">发货时间：{{ formatDate(data?.shippedAt) }}</div>
					</div>
					<el-button size="small" type="primary" @click="openTrace">查询物流</el-button>
				</div>
				<div v-else style="color:#909399;">暂无物流信息</div>
			</template>
		</el-card>

		<el-dialog v-model="showTrace" title="物流轨迹" width="640px">
			<el-skeleton v-if="loadingTrace" :rows="4" animated />
			<div v-else>
				<div style="margin-bottom:8px;">状态：{{ traceStatusDesc || '-' }}</div>
				<el-timeline>
					<el-timeline-item v-for="(it,idx) in traceList" :key="idx" :timestamp="it.datetime" placement="top">
						{{ it.remark }}
					</el-timeline-item>
				</el-timeline>
			</div>
			<template #footer>
				<el-button @click="showTrace=false">关闭</el-button>
			</template>
		</el-dialog>

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
const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const data = ref<any>(null);
const showTrace = ref(false);
const traceList = ref<Array<{ datetime:string; remark:string }>>([]);
const traceStatusDesc = ref<string>('');
const loadingTrace = ref(false);
async function fetchDetail(){
    const idParam = route.params.id as string | undefined;
    const noParam = route.params.no as string | undefined;
    if (noParam) {
        data.value = await http(`/orders/by-no/${encodeURIComponent(String(noParam))}`);
    } else if (idParam) {
        const id = Number(idParam);
        data.value = await http(`/orders/${id}`);
    }
}
onMounted(fetchDetail);

async function openTrace(){
    if (!data.value?.shipExpressTrackingNo) return;
    showTrace.value = true; loadingTrace.value = true; traceList.value = []; traceStatusDesc.value = '';
    try{
        const res:any = await http('/orders/_logistics/query', { query: { com: data.value?.shipExpressCompanyCode || undefined, no: data.value?.shipExpressTrackingNo } });
        traceStatusDesc.value = String(res?.data?.status_desc || res?.data?.statusDesc || res?.data?.status || res?.msg || '');
        const rawList:any[] = Array.isArray(res?.data?.list) ? res.data.list : [];
        const getTime = (it:any)=> it?.datetime || it?.time || '';
        const getRemark = (it:any)=> it?.remark || it?.context || '';
        rawList.sort((a,b)=> new Date(getTime(b)||0).getTime() - new Date(getTime(a)||0).getTime());
        traceList.value = rawList.map(it=>({ datetime: String(getTime(it)||'').trim(), remark: String(getRemark(it)||'').trim() }));
    }catch{
        traceList.value = [];
        traceStatusDesc.value = '';
    }finally{
        loadingTrace.value = false;
    }
}

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

function addrDisplay(info: any){
    try{
        const a = typeof info === 'string' ? JSON.parse(info) : info;
        if (!a) return '-';
        const line1 = [a?.province, a?.city, a?.district, a?.street].filter(Boolean).join(' ');
        const line2 = [a?.detail, a?.phone].filter(Boolean).join(' · ');
        return `${line1} ${line2 ? (' / ' + line2) : ''}`;
    }catch{ return '-'; }
}
</script>

<style scoped>
</style>


