<template>
	<div>
		<el-button @click="$router.back()" style="margin-bottom:12px;">返回</el-button>
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<el-descriptions :column="2" border>
			<el-descriptions-item label="订单号">{{ data?.no }}</el-descriptions-item>
			<el-descriptions-item label="类型">{{ displayType(data?.type) }}</el-descriptions-item>
			<el-descriptions-item label="状态">{{ statusLabel(data?.status) }}</el-descriptions-item>
			<el-descriptions-item label="支付状态">
				<span>{{ displayPayStatus(data?.payStatus) }}</span>
				<el-tag v-if="data?.payStatus==='UNPAID' && remainSeconds(data)>0" type="warning" effect="light" style="margin-left:6px;">倒计时 {{ formatRemain(remainSeconds(data)) }}</el-tag>
			</el-descriptions-item>
			<el-descriptions-item label="提醒" v-if="data?.remark && String(data?.remark).includes('系统超时取消')">
				<span style="color:#b91c1c;">超过15分钟未支付，系统已自动取消</span>
			</el-descriptions-item>
			<el-descriptions-item label="支付方式">{{ displayPayMethod(data?.payMethod) }}</el-descriptions-item>
			<el-descriptions-item label="微信交易单号" v-if="data?.wechatTransactionId">{{ data?.wechatTransactionId }}</el-descriptions-item>
			<el-descriptions-item label="订单总额">{{ data?.totalAmount }}</el-descriptions-item>
			<el-descriptions-item label="减免金额">{{ data?.discountAmount }}</el-descriptions-item>
			<el-descriptions-item label="会员折扣减免" v-if="Number((data as any)?.memberDiscountAmount||0)>0">{{ (data as any)?.memberDiscountAmount }}</el-descriptions-item>
			<el-descriptions-item label="配送费">{{ data?.shippingFee }}</el-descriptions-item>
			<el-descriptions-item label="支付金额">{{ data?.payAmount }}</el-descriptions-item>
			<el-descriptions-item label="下单时间">{{ formatDate(data?.createdAt) }}</el-descriptions-item>
			<el-descriptions-item label="支付时间">{{ formatDate(data?.paidAt) }}</el-descriptions-item>
			<el-descriptions-item label="会员">{{ data?.member?.name }}（UID: {{ data?.member?.uid }} / {{ data?.member?.phone }}）</el-descriptions-item>
			<el-descriptions-item label="用户备注">{{ (data as any)?.userRemark || '-' }}</el-descriptions-item>
			<el-descriptions-item label="系统备注">{{ data?.remark || '-' }}</el-descriptions-item>
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
					<el-button v-if="data?.payMethod==='WECHAT_JSAPI' && canShowRetryRefund" size="small" type="primary" @click="openRetryRefund">重试渠道退款</el-button>
					<el-button v-if="(data?.payMethod==='WECHAT_JSAPI' || data?.payMethod==='WECHAT_MICROPAY') && canShowPartialRefund" size="small" @click="openPartialRefund">部分退款</el-button>
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
				<el-table-column label="操作" width="160">
					<template #default="{ row }">
						<el-button v-if="canQueryRefund(row)" size="small" @click="queryRefund(row)">查询结果</el-button>
					</template>
				</el-table-column>
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
				<el-form-item label="退款金额(元)">
					<el-input v-model="partialAmountText" inputmode="decimal" :placeholder="`输入金额，最低0.01，最高¥${refundableLeft.toFixed(2)}`" />
					<div style="margin-left:8px;color:#666;">剩余可退：¥{{ refundableLeft.toFixed(2) }}</div>
				</el-form-item>
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
						<div v-if="(data?.shipExpressExtra||{}).editedOnce" style="color:#909399;">提示：该订单的物流单号已在{{ formatDate((data?.shipExpressExtra||{}).editAt) }}进行过一次修改（原单号：{{ (data?.shipExpressExtra||{}).prevTrackingNo||'-' }}）</div>
					</div>
					<el-button size="small" type="primary" @click="openTrace">查询物流</el-button>
				</div>
				<div v-else style="color:#909399;">暂无物流信息</div>
			</template>
		</el-card>

		<!-- 换货物流信息：移动到主物流信息之后，样式与其保持一致 -->
		<h4 v-if="exchangeShipments.length" style="margin-top:16px;">换货物流信息</h4>
		<el-card v-if="exchangeShipments.length" class="box-card" shadow="hover">
			<template #default>
				<div v-for="(ex,idx) in exchangeShipments" :key="idx" :style="{ padding: '8px 0', borderBottom: idx===exchangeShipments.length-1 ? 'none' : '1px dashed #ebeef5' }">
					<div v-if="ex.noExpress" style="color:#606266;">无需快递发货</div>
					<div v-else style="display:flex;align-items:center;gap:12px;">
						<div style="flex:1;min-width:0;">
							<div>快递公司：{{ ex.companyName || ex.companyCode || '-' }}</div>
							<div>运单号：{{ ex.trackingNo || '-' }}</div>
							<div v-if="ex.createdAt">发货时间：{{ formatDate(ex.createdAt) }}</div>
						</div>
						<el-button v-if="canQueryExchangeTrace(ex)" size="small" type="primary" @click="openExchangeTrace(ex)">查询物流</el-button>
					</div>
				</div>
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
			<el-descriptions-item label="会员折扣金额" v-if="Number((data as any)?.memberDiscountAmount||0)>0">{{ (data as any)?.memberDiscountAmount }}</el-descriptions-item>
			<el-descriptions-item label="卡券信息">
				<template v-if="Array.isArray(couponFlows) && couponFlows.length">
					<div class="coupon-list">
						<div v-for="flow in couponFlows" :key="flow.id" class="coupon-item">
							<div class="coupon-left">
								<div class="coupon-name">{{ flow.snapshot?.couponName || flow.memberCoupon?.name || flow.coupon?.name || flow.snapshot?.memberCouponName || '优惠券' }}</div>
								<div class="coupon-meta">
									<span>会员券ID：{{ flow.memberCouponId || flow.snapshot?.memberCouponId || flow.memberCoupon?.id || '-' }}</span>
									<span v-if="flow.snapshot?.discountApplied != null">减免：¥{{ Number(flow.snapshot.discountApplied).toFixed(2) }}</span>
								</div>
							</div>
							<div class="coupon-right">
								<el-tag size="small" :type="flowTagType(flow.action)">{{ flowActionText(flow.action) }}</el-tag>
							</div>
						</div>
						<div class="coupon-summary" v-if="couponDiscountSum != null">合计优惠：¥{{ couponDiscountSum.toFixed(2) }}</div>
					</div>
				</template>
				<template v-else>
					{{ formatCoupon(data?.couponInfo) }}
					<span v-if="data?.couponInfo?.discountApplied != null" style="margin-left:8px;color:#67C23A;">(减免¥{{ Number(data?.couponInfo?.discountApplied||0).toFixed(2) }})</span>
				</template>
			</el-descriptions-item>
		</el-descriptions>
	</div>
</template>

<script setup lang="ts">
function statusLabel(v?: string){ if(v==='CREATED') return '已创建'; if(v==='PAID') return '已支付'; if(v==='FULFILLED') return '已履约'; if(v==='CLOSED') return '已完成'; if(v==='CANCELLED') return '已取消'; return v || '-'; }
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';

const route = useRoute();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const data = ref<any>(null);
const canShowRetryRefund = ref(false);
const canShowPartialRefund = ref(false);
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
    // 计算按钮显隐
    try{
        const rr = Array.isArray((data.value?.refundRecords)||[]) ? (data.value?.refundRecords) : [];
        const failedOrUnknown = rr.some((r:any)=> r.status==='FAILED' || !r.status);
        canShowRetryRefund.value = failedOrUnknown;
        const successSum = rr.filter((r:any)=> r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
        const payAmt = Number(data.value?.payAmount||0);
        canShowPartialRefund.value = payAmt - successSum > 1e-6;
    }catch{ canShowRetryRefund.value=false; canShowPartialRefund.value=false; }
}
onMounted(fetchDetail);

function remainSeconds(row:any): number { try{ const exp:any = row?.paymentExpireAt || null; if(!exp) return 0; const t = new Date(exp).getTime(); return Math.max(0, Math.floor((t - Date.now())/1000)); }catch{ return 0; } }
function formatRemain(sec:number): string { const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60; return (h>0)?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

async function openRetryRefund(){
    // 找到可重试的记录（FAILED或PENDING）
    const rec = (data.value?.refundRecords||[]).find((r:any)=> r.status==='FAILED' || r.status==='PENDING');
    if (!rec) return;
    try{
        await http(`/orders/_refunds/${rec.id}/retry`, { method:'POST' });
    }catch{}
}

function canQueryRefund(row:any){
    try{
        if (!row) return false;
        // 仅对 v2 付款码退款或状态不明确(PENDING/PROCESSING/FAILED/null)展示查询按钮
        const st = String(row.status||'').toUpperCase();
        const isUnknown = !st || st==='PENDING' || st==='PROCESSING' || st==='FAILED';
        const hasOut = !!row.outRefundNo;
        return hasOut && isUnknown;
    }catch{ return false; }
}
async function queryRefund(row:any){
    try{
        if (!row?.outRefundNo){ ElMessage.error('缺少退款单号'); return; }
        const res:any = await http(`/orders/_refunds/${encodeURIComponent(row.outRefundNo)}/query-v2`, { method:'POST' });
        if (res?.ok){ ElMessage.success(`状态：${res.status}`); await fetchDetail(); }
        else { ElMessage.error('查询失败'); }
    }catch(e:any){ ElMessage.error(String(e?.message||e||'查询失败')); }
}

const dialogPartial = ref(false);
const partialAmountText = ref<string>('');
const partialReason = ref<string>('');
const refundableLeft = computed(()=>{
    try{
        const rr = Array.isArray((data.value?.refundRecords)||[]) ? (data.value?.refundRecords) : [];
        const successSum = rr.filter((r:any)=> r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
        const payAmt = Number(data.value?.payAmount||0);
        return Math.max(0, payAmt - successSum);
    }catch{ return 0; }
});
function openPartialRefund(){ partialAmountText.value = ''; partialReason.value = ''; dialogPartial.value = true; }
async function submitPartialRefund(){
    const raw = (partialAmountText.value||'').trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) { ElMessage.error('金额格式不正确，最多保留2位小数'); return; }
    const v = Number(raw);
    if (!isFinite(v) || v < 0.01){ ElMessage.error('部分退款金额至少为0.01'); return; }
    if (v > refundableLeft.value + 1e-6){ ElMessage.error('超出剩余可退金额'); return; }
    try{
        await http(`/orders/${data.value?.id}/refund`, { method:'POST', body: { reason: partialReason.value || '部分退款', amount: v } });
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

function canQueryExchangeTrace(ex: any){ return !!(ex && ex.trackingNo); }
async function openExchangeTrace(ex: any){
    if (!ex?.trackingNo) return;
    showTrace.value = true; loadingTrace.value = true; traceList.value = []; traceStatusDesc.value = '';
    try{
        const res:any = await http('/orders/_logistics/query', { query: { com: ex?.companyCode || undefined, no: ex?.trackingNo } });
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

// 为换货物流维护独立的查询结果，防止覆盖主物流
const exchangeTraceMap: Record<string, { list: Array<{ datetime:string; remark:string }>; statusDesc: string }> = {} as any;
function exchangeKey(ex:any){ return `${ex?.companyCode||''}|${ex?.trackingNo||''}`; }

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
    if (v==='BENEFITS') return '权益变更';
    if (v==='REVIEW') return '评价';
    if (v==='NOTE') return '备注';
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
	if (v==='FK') return '付款订单';
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
		if (v==='REFUND_REQUESTED') return '已提交退款';
		if (v==='PARTIAL_REFUND') return '部分退款';
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
	if (e==='BENEFITS'){
		if (v==='WASHCARD_ROLLBACK') return '退款回收计次';
		if (v==='POINTS_ROLLBACK') return '返还积分';
		if (v==='COUPON_RESTORE') return '恢复优惠券';
		if (v==='COUPON_NOTE') return '优惠券说明';
	}
	if (e==='LOGISTICS'){
		if (v==='SHIPPED') return '已发货';
		if (v==='EXCHANGE_SHIPPED') return '换货已发货';
		if (v==='EDITED') return '已修改物流单号';
		return '物流更新';
	}
	if (e==='AFTERSALES'){
		// 已有状态中文化，补充兼容
		if (v==='PENDING') return '处理中';
		if (v==='APPROVED') return '已同意';
		if (v==='REJECTED') return '已拒绝';
		if (v==='SUCCESS' || v==='COMPLETED') return '已完成';
		if (v==='CANCELLED') return '已取消';
		return v;
	}
	if (e==='REVIEW'){
		if (v==='RATED') return '用户已评价';
		if (v==='REPLIED') return '商家已回复';
	}
    if (e==='NOTE'){
        if (v==='RECEIVED') return '用户已确认收货';
        if (v==='VIRTUAL_CARD_ISSUED') return '系统发放卡券完成';
        if (v==='WECHAT_MICROPAY') return '微信付款码支付';
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
		if (r==='RE_SERVICE') return '重新服务';
	}
	if (e==='FULFILLMENT'){
		if (r==='EXCHANGE_RESET') return '换货流转重置';
		if (r==='RE_SERVICE_RESET') return '重新服务流转重置';
	}
	if (r==='TIMEOUT_15MIN') return '超时15分钟';
    if (e==='NOTE'){
        if (r==='USER_CONFIRMED') return '用户操作';
        if (r==='SYS_AUTO') return '系统自动';
        const raw = String(remark||'');
        const m = /交易成功；银行：([^；\s]+)；完成时间：([0-9]{14})/.exec(raw);
        if (m){
            const bank = m[1];
            const ts = m[2];
            const t = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)} ${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}`;
            const bankMap:any = { 'OTHERS':'其他' };
            const bankZh = bankMap[bank] || bank;
            return `交易成功，银行：${bankZh}，完成时间：${t}`;
        }
    }
	return remark || '';
}

const couponFlows = computed(() => {
    try{
        const flows = Array.isArray((data.value?.couponFlows)||[]) ? (data.value?.couponFlows) : [];
        // 仅展示当前订单内的 USE 动作流水
        return flows.filter((f:any)=> String(f?.action||'').toUpperCase()==='USE');
    }catch{ return []; }
});
const couponDiscountSum = computed(()=>{
    try{
        const arr = couponFlows.value as any[];
        const sum = arr.reduce((s, f:any)=> s + Number(f?.snapshot?.discountApplied||0), 0);
        return Number.isFinite(sum) ? Number(sum) : 0;
    }catch{ return 0; }
});
function flowActionText(a?: string){
  switch(String(a||'')){
    case 'USE': return '使用';
    case 'RESTORE': return '回退';
    case 'CLAIM': return '领取';
    case 'ISSUE': return '发放';
    default: return a||'-';
  }
}
function flowTagType(a?: string){
  switch(String(a||'')){
    case 'USE': return 'warning';
    case 'RESTORE': return 'info';
    case 'CLAIM': return 'primary';
    case 'ISSUE': return 'success';
    default: return undefined as any;
  }
}

// 换货发货记录：从 shipExpressExtra.exchangeShipments 读取
const exchangeShipments = computed(() => {
    try{
        const extra:any = (data.value as any)?.shipExpressExtra || {};
        const list:any[] = Array.isArray(extra?.exchangeShipments) ? extra.exchangeShipments : [];
        return list.slice().sort((a:any,b:any)=> new Date(b?.createdAt||0).getTime() - new Date(a?.createdAt||0).getTime());
    }catch{ return []; }
});
function exchangeShipmentText(ex: any){
    try{
        if (!ex) return '-';
        if (ex.noExpress) return '无需快递';
        const com = ex.companyName || ex.companyCode || '';
        const no = ex.trackingNo || '';
        const phones = [ex?.contact?.senderPhoneMasked, ex?.contact?.receiverPhoneMasked].filter(Boolean).join(' / ');
        const tail = phones ? `（隐私号：${phones}）` : '';
        return [com, no].filter(Boolean).join(' / ') + tail;
    }catch{ return '-'; }
}
</script>

<style scoped>
.coupon-list{ display:flex; flex-direction: column; gap:8px; }
.coupon-item{ display:flex; align-items:center; justify-content: space-between; background: #fafafa; border:1px dashed #e5e7eb; border-radius:8px; padding:8px 12px; }
.coupon-left{ display:flex; flex-direction: column; gap:4px; }
.coupon-name{ font-weight: 600; color:#303133; }
.coupon-meta{ display:flex; gap:12px; color:#606266; font-size:12px; }
.coupon-right{ display:flex; align-items:center; gap:8px; }
.coupon-summary{ text-align:right; color:#67C23A; font-weight:600; margin-top:4px; }
</style>


