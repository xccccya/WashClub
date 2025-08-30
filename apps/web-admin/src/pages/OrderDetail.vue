<template>
	<div>
		<el-button @click="$router.back()" style="margin-bottom:12px;">返回</el-button>
		<h3>订单详情 {{ data?.no ? ('#' + data?.no) : '' }}</h3>
		<el-descriptions :column="2" border>
			<el-descriptions-item label="订单号">{{ data?.no }}</el-descriptions-item>
			<el-descriptions-item label="类型">{{ displayType(data?.type) }}</el-descriptions-item>
			<el-descriptions-item label="状态">{{ statusLabel(data?.status) }}</el-descriptions-item>
			<el-descriptions-item label="支付状态">{{ displayPayStatus(data?.payStatus) }}</el-descriptions-item>
			<el-descriptions-item label="提醒" v-if="data?.remark && String(data?.remark).includes('系统超时取消')">
				<span style="color:#b91c1c;">超过15分钟未支付，系统已自动取消</span>
			</el-descriptions-item>
			<el-descriptions-item label="支付方式">{{ displayPayMethod(data?.payMethod) }}</el-descriptions-item>
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
		<el-card v-if="(data as any)?.afterSalesRequests?.length" class="box-card" style="margin-top:12px;">
			<template #header>
				<div class="card-header"><span>售后/退款</span></div>
			</template>
			<el-timeline>
				<el-timeline-item v-for="it in (data as any).afterSalesRequests" :key="it.id" :timestamp="formatDate(it.createdAt)">
					类型：{{ zhAftersalesType(it.type) }} / 状态：{{ zhAftersalesStatus(it.status) }}
				</el-timeline-item>
			</el-timeline>
			<div v-if="!((data as any).afterSalesRequests||[]).some((x:any)=>x.status==='PENDING'||x.status==='APPROVED')" style="color:#909399; margin-top:8px;">无进行中售后</div>
		</el-card>

		<el-card v-if="(data as any)?.timelines?.length" class="box-card" style="margin-top:12px;">
			<template #header>
				<div class="card-header"><span>订单流转</span></div>
			</template>
			<el-timeline>
				<el-timeline-item v-for="it in (data as any).timelines" :key="it.id" :timestamp="formatDate(it.createdAt)">
					{{ zhEvent(it.event) }}：{{ zhTimelineValue(it.event, it.value, data) }}<span v-if="it.remark">（{{ zhRemark(it.event, it.remark) }}）</span>
				</el-timeline-item>
			</el-timeline>
		</el-card>

		<el-card v-if="(data as any)?.refundRecords?.length" class="box-card" style="margin-top:12px;">
			<template #header>
				<div class="card-header" style="display:flex;align-items:center;gap:12px;">
					<span>退款记录</span>
					<el-button v-if="data?.payMethod==='WECHAT_JSAPI'" size="small" type="primary" @click="openRetryRefund">重试渠道退款</el-button>
					<el-button v-if="data?.payMethod==='WECHAT_JSAPI'" size="small" @click="openPartialRefund">部分退款</el-button>
				</div>
			</template>
			<el-table :data="(data as any).refundRecords" size="small" border>
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column prop="amount" label="金额" width="120" />
				<el-table-column prop="method" label="方式" width="140">
					<template #default="{ row }">{{ zhRefundMethod(row.method) }}</template>
				</el-table-column>
				<el-table-column prop="status" label="状态" width="140">
					<template #default="{ row }">{{ zhRefundStatus(row.status) }}</template>
				</el-table-column>
				<el-table-column prop="outRefundNo" label="商户退款单号" />
				<el-table-column prop="wechatRefundId" label="微信退款单号" />
				<el-table-column prop="failedReason" label="失败原因" />
			</el-table>
		</el-card>

		<el-card v-if="(data as any)?.couponRestoreLogs?.length" class="box-card" style="margin-top:12px;">
			<template #header>
				<div class="card-header"><span>优惠券恢复记录</span></div>
			</template>
			<el-table :data="(data as any).couponRestoreLogs" size="small" border>
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column prop="createdAt" label="时间" width="180">
					<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" />
			</el-table>
		</el-card>

		<el-dialog v-model="dialogPartial" title="部分退款" width="420px">
			<el-form label-width="96px">
				<el-form-item label="退款金额(元)"><el-input v-model.number="partialAmount" type="number" placeholder="例如 10.00" /></el-form-item>
				<el-form-item label="原因"><el-input v-model="partialReason" placeholder="可选" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogPartial=false">取消</el-button>
				<el-button type="primary" @click="submitPartialRefund">提交</el-button>
			</template>
		</el-dialog>
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
function statusLabel(v?: string){ if(v==='CREATED') return '已创建'; if(v==='PAID') return '已支付'; if(v==='FULFILLED') return '已履约'; if(v==='CLOSED') return '已完成'; if(v==='CANCELLED') return '已取消'; return v || '-'; }
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';

const route = useRoute();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
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

async function openRetryRefund(){
    // 简化：取最新一条退款记录金额重试
    const rec = (data.value?.refundRecords||[])[0];
    if (!rec) return;
    try{
        await http(`/orders/${data.value?.id}/refund/wechat`, { method:'POST', body: { reason: '重试退款', amount: rec.amount } });
    }catch{}
}

const dialogPartial = ref(false);
const partialAmount = ref<number|undefined>(undefined);
const partialReason = ref<string>('');
function openPartialRefund(){ partialAmount.value = undefined; partialReason.value = ''; dialogPartial.value = true; }
async function submitPartialRefund(){
    if (!partialAmount.value || partialAmount.value <= 0) { return; }
    try{
        await http(`/orders/${data.value?.id}/refund/wechat`, { method:'POST', body: { reason: partialReason.value || '部分退款', amount: partialAmount.value } });
        dialogPartial.value = false; fetchDetail();
    }catch{}
}

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

function zhEvent(e: string){
    const v = String(e||'').toUpperCase();
    if (v==='ORDER_STATUS') return '订单状态';
    if (v==='PAY_STATUS') return '支付状态';
    if (v==='FULFILLMENT') return '履约状态';
    if (v==='LOGISTICS') return '物流';
    if (v==='AFTERSALES') return '售后';
    if (v==='REVIEW') return '评价';
    return e || '-';
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

// 中文化映射
function displayType(t?: string){
	const v = String(t||'').toUpperCase();
	if (!v) return '-';
	if (v==='SERVICE') return '服务订单';
	if (v==='SP') return '商品订单';
	if (v==='FK') return '福卡订单';
	return '其它';
}
function displayPayStatus(s?: string){
	const v = String(s||'').toUpperCase();
	if (!v) return '-';
	if (v==='UNPAID') return '未支付';
	if (v==='PAID') return '已支付';
	if (v==='REFUNDED') return '已退款';
	if (v==='CANCELLED') return '已取消';
	return s || '-';
}
function displayPayMethod(m?: string){
	const v = String(m||'').toUpperCase();
	if (!v) return '-';
	if (v.includes('WECHAT')) return '微信支付';
	if (v.includes('ALI')) return '支付宝';
	if (v.includes('SHOUQIANBA')) return '收钱吧扫码支付';
	if (v.includes('CASH')) return '现金支付';
	if (v.includes('OFFLINE')) return '线下支付';
	if (v.includes('QRCODE')) return '扫码支付';
	return '其它';
}
function zhAftersalesType(t?: string){
	const v = String(t||'').toUpperCase();
	if (v==='REFUND') return '仅退款';
	if (v==='RETURN') return '退货退款';
	if (v==='EXCHANGE') return '换货';
	return t || '-';
}
function zhAftersalesStatus(s?: string){
	const v = String(s||'').toUpperCase();
	if (v==='PENDING') return '处理中';
	if (v==='APPROVED') return '已同意';
	if (v==='REJECTED') return '已拒绝';
	if (v==='SUCCESS' || v==='COMPLETED') return '已完成';
	if (v==='CANCELLED') return '已取消';
	return s || '-';
}
function zhRefundMethod(m?: string){
	const v = String(m||'').toUpperCase();
	if (v.includes('WECHAT')) return '微信原路退款';
	if (v.includes('ALI')) return '支付宝原路退款';
	if (v.includes('MANUAL')) return '人工退款';
	if (v.includes('OFFLINE')) return '线下退款';
	return m || '-';
}
function zhRefundStatus(s?: string){
	const v = String(s||'').toUpperCase();
	if (v==='PENDING') return '退款中';
	if (v==='SUCCESS') return '退款成功';
	if (v==='FAILED') return '退款失败';
	return s || '-';
}
function zhTimelineValue(eventType?: string, value?: string, order?: any){
	const e = String(eventType||'').toUpperCase();
	const v = String(value||'').toUpperCase();
	if (!v) return '-';
	if (e==='ORDER_STATUS'){
		if (v==='CREATED') return '已创建';
		if (v==='PAID') return '已支付';
		if (v==='FULFILLED') return '已履约';
		if (v==='CLOSED') return '已完成';
		if (v==='CANCELLED') return '已取消';
	}
	if (e==='PAY_STATUS'){
		if (v==='UNPAID') return '未支付';
		if (v==='PAID') return '已支付';
		if (v==='REFUNDED') return '已退款';
		if (v==='CANCELLED') return '已取消';
	}
	if (e==='FULFILLMENT'){
		const type = String(order?.type||'').toUpperCase();
		if (v==='PENDING') return type==='SERVICE' ? '待服务' : '待发货';
		if (v==='IN_SERVICE') return '服务中';
		if (v==='SHIPPED') return '已发货';
		if (v==='RECEIVED') return '已收货';
		if (v==='DONE') return '已完成';
	}
	if (e==='AFTERSALES'){
		return zhAftersalesStatus(v);
	}
	if (e==='REVIEW'){
		if (v==='RATED') return '用户已评价';
		if (v==='REPLIED') return '商家已回复';
	}
	return value || '-';
}

function zhRemark(eventType?: string, remark?: string){
	const e = String(eventType||'').toUpperCase();
	const r = String(remark||'').toUpperCase();
	if (!r) return '';
	if (e==='AFTERSALES'){
		if (r==='REFUND') return '仅退款';
		if (r==='RETURN') return '退货退款';
		if (r==='EXCHANGE') return '换货';
	}
	if (r==='TIMEOUT_15MIN') return '超时15分钟';
	return remark || '';
}
</script>

<style scoped>
</style>


