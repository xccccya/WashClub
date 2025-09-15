<template>
	<div class="pos-order-detail">
		<div class="detail-header">
			<div class="left">
				<h3 class="title">订单详情</h3>
				<div class="sub">
					<span>订单号：</span>
					<span class="mono">{{ data?.no || '-' }}</span>
					<el-button text class="icon-btn" title="复制" :disabled="!data?.no" @click="copyNo(data?.no)"><el-icon><DocumentCopy /></el-icon></el-button>
				</div>
			</div>
			<div class="right">
				<el-button @click="$router.back()">返回</el-button>
				<el-button v-if="canWriteoff() && data?.id" type="danger" @click="writeoffThis">作废/红冲</el-button>
			</div>
		</div>

		<!-- 金额摘要：为平板优化的大字号展示 -->
		<div class="amount-summary mt12" v-if="data">
			<div class="sum-item">
				<div class="sum-label">应付金额</div>
				<div class="sum-value pay">¥ {{ money(data?.payAmount) }}</div>
			</div>
			<div class="sum-item">
				<div class="sum-label">订单总额</div>
				<div class="sum-value">¥ {{ money(data?.totalAmount) }}</div>
			</div>
			<div class="sum-item">
				<div class="sum-label">优惠合计</div>
				<div class="sum-value discount">- ¥ {{ money(data?.discountAmount) }}</div>
			</div>
			<div class="sum-item" v-if="Number(data?.pointsAmount||0)>0">
				<div class="sum-label">积分抵扣</div>
				<div class="sum-value">- ¥ {{ money(data?.pointsAmount) }}</div>
			</div>
			<div class="sum-item" v-if="Number((data as any)?.washCardDeductAmount||0)>0">
				<div class="sum-label">洗车卡抵扣</div>
				<div class="sum-value">- ¥ {{ money((data as any)?.washCardDeductAmount) }}</div>
			</div>
		</div>

		<el-descriptions :column="2" border class="mt12">
			<el-descriptions-item label="类型">{{ displayType(data?.type) }}</el-descriptions-item>
			<el-descriptions-item label="状态">{{ statusLabel(data?.status) }}</el-descriptions-item>
			<el-descriptions-item label="支付状态">
				<span>{{ displayPayStatus(data?.payStatus) }}</span>
				<el-tag v-if="data?.payStatus==='UNPAID' && remainSeconds(data)>0" type="warning" effect="light" style="margin-left:6px;">倒计时 {{ formatRemain(remainSeconds(data)) }}</el-tag>
			</el-descriptions-item>
			<el-descriptions-item label="提醒" v-if="data?.remark && String(data?.remark).includes('系统超时取消')">
				<span class="danger-text">超过15分钟未支付，系统已自动取消</span>
			</el-descriptions-item>
			<el-descriptions-item label="支付方式">{{ displayPayMethod(data?.payMethod) }}</el-descriptions-item>
			<el-descriptions-item label="微信交易单号" v-if="data?.wechatTransactionId">{{ data?.wechatTransactionId }}</el-descriptions-item>
			<el-descriptions-item label="订单总额">¥ {{ money(data?.totalAmount) }}</el-descriptions-item>
			<el-descriptions-item label="减免金额">¥ {{ money(data?.discountAmount) }}</el-descriptions-item>
			<el-descriptions-item label="洗车卡抵扣" v-if="Number((data as any)?.washCardDeductAmount||0)>0">¥ {{ money((data as any)?.washCardDeductAmount) }}</el-descriptions-item>
			<el-descriptions-item label="会员折扣减免" v-if="Number((data as any)?.memberDiscountAmount||0)>0">¥ {{ money((data as any)?.memberDiscountAmount) }}</el-descriptions-item>
			<el-descriptions-item label="配送费">¥ {{ money(data?.shippingFee) }}</el-descriptions-item>
			<el-descriptions-item label="支付金额">¥ {{ money(data?.payAmount) }}</el-descriptions-item>
			<el-descriptions-item label="下单时间">{{ formatDate(data?.createdAt) }}</el-descriptions-item>
			<el-descriptions-item label="支付时间">{{ formatDate(data?.paidAt) }}</el-descriptions-item>
			<el-descriptions-item label="会员">{{ data?.member?.name }}（UID: {{ data?.member?.uid }} / {{ data?.member?.phone }}）</el-descriptions-item>
			<el-descriptions-item v-if="data?.isProxyOrder" label="代客下单">
				<span>由 {{ data?.proxyAdminSnapshot?.name || data?.proxyAdminUser?.name || '-' }}（{{ data?.proxyAdminSnapshot?.phone || data?.proxyAdminUser?.phone || '-' }}）创建</span>
			</el-descriptions-item>
			<el-descriptions-item label="车辆" v-if="data?.type==='SERVICE'">{{ data?.vehicle?.plateNumber || '-' }}</el-descriptions-item>
			<el-descriptions-item label="用户备注">{{ (data as any)?.userRemark || '-' }}</el-descriptions-item>
			<el-descriptions-item label="付款说明">{{ (data as any)?.paymentNote || '-' }}</el-descriptions-item>
			<el-descriptions-item label="系统备注">{{ data?.remark || '-' }}</el-descriptions-item>
			<el-descriptions-item label="收货地址" v-if="data?.shippingAddressSnapshot">{{ addrDisplay(data?.shippingAddressSnapshot) }}</el-descriptions-item>
		</el-descriptions>

		<!-- 物流信息（商品订单） -->
		<h4 class="mt16" v-if="data?.type==='SP'">物流信息</h4>
		<el-card v-if="data?.type==='SP'" class="box-card" shadow="hover">
			<template #default>
				<div v-if="data?.shipNoExpress" class="muted">商家已选择无需快递发货</div>
				<div v-else-if="data?.shipExpressTrackingNo" class="ship-row">
					<img v-if="data?.shipExpressCompanyLogo" :src="data?.shipExpressCompanyLogo" class="img28" />
					<div class="flex1">
						<div>快递公司：{{ data?.shipExpressCompanyName || data?.shipExpressCompanyCode || '-' }}</div>
						<div>运单号：{{ data?.shipExpressTrackingNo }}</div>
						<div v-if="data?.shippedAt">发货时间：{{ formatDate(data?.shippedAt) }}</div>
						<div v-if="(data?.shipExpressExtra||{}).editedOnce" class="muted">提示：该订单的物流单号已在{{ formatDate((data?.shipExpressExtra||{}).editAt) }}进行过一次修改（原单号：{{ (data?.shipExpressExtra||{}).prevTrackingNo||'-' }}）</div>
					</div>
					<el-button size="small" type="primary" @click="openTrace">查询物流</el-button>
				</div>
				<div v-else class="muted">暂无物流信息</div>
			</template>
		</el-card>

		<el-card v-if="(data as any)?.afterSalesRequests?.length" class="box-card mt12">
			<template #header><div class="card-header"><span>售后/退款</span></div></template>
			<el-timeline>
				<el-timeline-item v-for="it in (data as any).afterSalesRequests" :key="it.id" :timestamp="formatDate(it.createdAt)">
					类型：{{ zhAftersalesType(it.type) }} / 状态：{{ zhAftersalesStatus(it.status) }}
				</el-timeline-item>
			</el-timeline>
			<div v-if="!((data as any).afterSalesRequests||[]).some((x:any)=>x.status==='PENDING'||x.status==='APPROVED')" class="muted" style="margin-top:8px;">无进行中售后</div>
		</el-card>

		<el-card v-if="(data as any)?.timelines?.length" class="box-card mt12">
			<template #header><div class="card-header"><span>订单流转</span></div></template>
			<el-timeline>
				<el-timeline-item v-for="it in (data as any).timelines" :key="it.id" :timestamp="formatDate(it.createdAt)">
					{{ zhEvent(it.event) }}：{{ zhTimelineValue(it.event, it.value, data) }}<span v-if="it.remark">（{{ zhRemark(it.event, it.remark) }}）</span>
				</el-timeline-item>
			</el-timeline>
		</el-card>

		<el-card class="box-card mt12">
			<template #header><div class="card-header"><span>权益与卡券</span></div></template>
			<el-descriptions :column="2" border>
				<el-descriptions-item label="使用积分">{{ data?.usedPoints || 0 }}</el-descriptions-item>
				<el-descriptions-item label="积分抵扣金额">¥ {{ money(data?.pointsAmount) }}</el-descriptions-item>
			</el-descriptions>
			<div v-if="couponFlows.length" class="coupon-list">
				<div v-for="flow in couponFlows" :key="flow.id" class="coupon-item">
					<div class="coupon-left">
						<div class="coupon-name">{{ flow.snapshot?.couponName || flow.memberCoupon?.name || flow.coupon?.name || flow.snapshot?.memberCouponName || '优惠券' }}</div>
						<div class="coupon-meta">
							<span>会员券ID：{{ flow.memberCouponId || flow.snapshot?.memberCouponId || flow.memberCoupon?.id || '-' }}</span>
							<span v-if="flow.snapshot?.discountApplied != null">减免：¥ {{ Number(flow.snapshot.discountApplied).toFixed(2) }}</span>
						</div>
					</div>
					<div class="coupon-right">
						<el-tag size="small" :type="flowTagType(flow.action)">{{ flowActionText(flow.action) }}</el-tag>
					</div>
				</div>
				<div class="coupon-summary" v-if="couponDiscountSum != null">合计优惠：¥ {{ couponDiscountSum.toFixed(2) }}</div>
			</div>
			<div v-else class="muted">{{ formatCoupon(data?.couponInfo) }}</div>
		</el-card>

		<h4 v-if="exchangeShipments.length" class="mt16">换货物流信息</h4>
		<el-card v-if="exchangeShipments.length" class="box-card" shadow="hover">
			<template #default>
				<div v-for="(ex,idx) in exchangeShipments" :key="idx" :style="{ padding: '8px 0', borderBottom: idx===exchangeShipments.length-1 ? 'none' : '1px dashed #ebeef5' }">
					<div v-if="ex.noExpress" class="muted">无需快递发货</div>
					<div v-else class="ship-row">
						<div class="flex1">
							<div>快递公司：{{ ex.companyName || ex.companyCode || '-' }}</div>
							<div>运单号：{{ ex.trackingNo || '-' }}</div>
							<div v-if="ex.createdAt">发货时间：{{ formatDate(ex.createdAt) }}</div>
						</div>
						<el-button v-if="canQueryExchangeTrace(ex)" size="small" type="primary" @click="openExchangeTrace(ex)">查询物流</el-button>
					</div>
				</div>
			</template>
		</el-card>

		<el-card v-if="(data as any)?.refundRecords?.length" class="box-card mt12">
			<template #header>
				<div class="card-header" style="display:flex;align-items:center;gap:12px;">
					<span>退款记录</span>
					<el-button v-if="data?.payMethod==='WECHAT_JSAPI' && canShowRetryRefund" size="small" type="primary" @click="openRetryRefund">重试渠道退款</el-button>
					<el-button v-if="(data?.payMethod==='WECHAT_JSAPI' || data?.payMethod==='WECHAT_MICROPAY') && canShowPartialRefund" size="small" @click="openPartialRefund">部分退款</el-button>
				</div>
			</template>
			<el-table :data="(data as any).refundRecords" size="small" border>
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column prop="amount" label="金额" width="120" align="right"><template #default="{ row }">¥ {{ money(row.amount) }}</template></el-table-column>
				<el-table-column prop="method" label="方式" width="140"><template #default="{ row }">{{ zhRefundMethod(row.method) }}</template></el-table-column>
				<el-table-column prop="status" label="状态" width="140"><template #default="{ row }">{{ zhRefundStatus(row.status) }}</template></el-table-column>
				<el-table-column prop="outRefundNo" label="商户退款单号" />
				<el-table-column prop="wechatRefundId" label="微信退款单号" />
				<el-table-column prop="failedReason" label="失败原因" />
				<el-table-column label="操作" width="160"><template #default="{ row }"><el-button v-if="canQueryRefund(row)" size="small" @click="queryRefund(row)">查询结果</el-button></template></el-table-column>
			</el-table>
		</el-card>

		<el-card v-if="(data as any)?.couponRestoreLogs?.length" class="box-card mt12">
			<template #header><div class="card-header"><span>优惠券恢复记录</span></div></template>
			<el-table :data="(data as any).couponRestoreLogs" size="small" border>
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column prop="createdAt" label="时间" width="180"><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></el-table-column>
				<el-table-column prop="remark" label="备注" />
			</el-table>
		</el-card>

		<h4 class="mt16">订单项</h4>
		<el-table :data="data?.items||[]" border size="small" style="width: 100%">
			<el-table-column label="图片" width="80"><template #default="{ row }"><img v-if="row.imageUrl" :src="row.imageUrl" class="img48" /><span v-else>-</span></template></el-table-column>
			<el-table-column prop="name" label="名称" />
			<el-table-column prop="specsText" label="规格" width="200" />
			<el-table-column prop="barcode" label="条码" width="160" />
			<el-table-column prop="price" label="单价" width="120" align="right"><template #default="{ row }">¥ {{ money(row.price) }}</template></el-table-column>
			<el-table-column prop="discount" label="优惠" width="120" align="right"><template #default="{ row }">¥ {{ money(row.discount) }}</template></el-table-column>
			<el-table-column prop="quantity" label="数量" width="80" />
		</el-table>

		<el-dialog v-model="showTrace" title="物流轨迹" width="640px">
			<el-skeleton v-if="loadingTrace" :rows="4" animated />
			<div v-else>
				<div style="margin-bottom:8px;">状态：{{ traceStatusDesc || '-' }}</div>
				<el-timeline>
					<el-timeline-item v-for="(it,idx) in traceList" :key="idx" :timestamp="it.datetime" placement="top">{{ it.remark }}</el-timeline-item>
				</el-timeline>
			</div>
			<template #footer><el-button @click="showTrace=false">关闭</el-button></template>
		</el-dialog>

		<!-- 部分退款弹窗 -->
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
	</div>
</template>

<script setup lang="ts" name="OrderDetail">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage, ElMessageBox } from 'element-plus';
import { DocumentCopy } from '@element-plus/icons-vue';

const route = useRoute();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const data = ref<any>(null);
const showTrace = ref(false);
const traceList = ref<Array<{ datetime:string; remark:string }>>([]);
const traceStatusDesc = ref<string>('');
const loadingTrace = ref(false);
const canShowRetryRefund = ref(false);
const canShowPartialRefund = ref(false);
const dialogPartial = ref(false);
const partialAmountText = ref<string>('');
const partialReason = ref<string>('');

async function fetchDetail(){
	const idParam = route.params.id as string | undefined;
	const noParam = route.params.no as string | undefined;
	if (noParam) data.value = await http(`/orders/by-no/${encodeURIComponent(String(noParam))}`);
	else if (idParam) data.value = await http(`/orders/${Number(idParam)}`);
	try{
		const p = route.fullPath;
		const title = data.value?.no ? `订单 ${data.value.no}` : (data.value?.id ? `订单 #${data.value.id}` : '订单');
		window.dispatchEvent(new CustomEvent('pos-set-tab', { detail: { path: p, title } }));
	}catch{}
	// 计算退款操作按钮显隐
	try{
		const rr = Array.isArray((data.value?.refundRecords)||[]) ? (data.value?.refundRecords) : [];
		const failedOrUnknown = rr.some((r:any)=> String(r.status||'').toUpperCase()==='FAILED' || !r.status);
		canShowRetryRefund.value = failedOrUnknown;
		const successSum = rr.filter((r:any)=> String(r.status||'').toUpperCase()==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
		const payAmt = Number(data.value?.payAmount||0);
		canShowPartialRefund.value = payAmt - successSum > 1e-6;
	}catch{ canShowRetryRefund.value=false; canShowPartialRefund.value=false; }
}

onMounted(fetchDetail);

function statusLabel(v?: string){ if(v==='CREATED') return '已创建'; if(v==='PAID') return '已支付'; if(v==='FULFILLED') return '已履约'; if(v==='CLOSED') return '已完成'; if(v==='CANCELLED') return '已取消'; return v || '-'; }
function remainSeconds(row:any): number { try{ const exp:any = row?.paymentExpireAt || null; if(!exp) return 0; const t = new Date(exp).getTime(); return Math.max(0, Math.floor((t - Date.now())/1000)); }catch{ return 0; } }
function formatRemain(sec:number): string { const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60; return (h>0)?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function money(v:any){ const n = Number(v||0); return Number.isFinite(n) ? n.toFixed(2) : '0.00'; }

function canWriteoff(){ try{ const raw = localStorage.getItem('user')||'{}'; const u = JSON.parse(raw||'{}'); const perms = Array.isArray(u?.permissions)?u.permissions:[]; return perms.includes('*') || perms.includes('orders-writeoff'); }catch{ return false; } }
async function writeoffThis(){ try{ const ok = await new Promise<boolean>(r=>{ ElMessageBox.confirm('确认对该订单执行作废/红冲操作？', '操作确认', { type:'warning' }).then(()=>r(true)).catch(()=>r(false)); }); if(!ok) return; const id = Number((data.value?.id)||0); if(!id) return; await http(`/orders/${id}/void`, { method:'POST', body: { reason: '后台作废/红冲' } }); ElMessage.success('操作成功'); await fetchDetail(); }catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }

function canQueryRefund(row:any){ try{ if (!row) return false; const st = String(row.status||'').toUpperCase(); const isUnknown = !st || st==='PENDING' || st==='PROCESSING' || st==='FAILED'; const hasOut = !!row.outRefundNo; return hasOut && isUnknown; }catch{ return false; } }
async function queryRefund(row:any){ try{ if (!row?.outRefundNo){ ElMessage.error('缺少退款单号'); return; } const res:any = await http(`/orders/_refunds/${encodeURIComponent(row.outRefundNo)}/query-v2`, { method:'POST' }); if (res?.ok){ ElMessage.success(`状态：${res.status}`); await fetchDetail(); } else { ElMessage.error('查询失败'); } }catch(e:any){ ElMessage.error(String(e?.message||e||'查询失败')); } }

function formatDate(val: string | null | undefined){ if(!val) return '-'; try{ return new Date(val).toLocaleString(); }catch{ return String(val); } }
function displayType(t?: string){ const v = String(t||'').toUpperCase(); if (!v) return '-'; if (v==='SERVICE') return '服务订单'; if (v==='SP') return '商品订单'; if (v==='FK') return '付款订单'; return '其它'; }
function displayPayStatus(s?: string){ const v = String(s||'').toUpperCase(); if (!v) return '-'; if (v==='UNPAID') return '未支付'; if (v==='PAID') return '已支付'; if (v==='REFUNDED') return '已退款'; if (v==='CANCELLED') return '已取消'; return s || '-'; }
function displayPayMethod(m?: string){ const v = String(m||'').toUpperCase(); if (!v) return '-'; if (v.includes('WECHAT')) return '微信支付'; if (v.includes('ALI')) return '支付宝'; if (v.includes('SHOUQIANBA')) return '收钱吧扫码支付'; if (v.includes('CASH')) return '现金支付'; if (v.includes('OFFLINE')) return '线下支付'; if (v.includes('WASH_CARD') || v==='WASH_CARD') return '洗车卡结算'; if (v.includes('QRCODE')) return '扫码支付'; return '其它'; }

function zhRefundMethod(m?: string){ const v = String(m||'').toUpperCase(); if (v.includes('WECHAT')) return '微信原路退款'; if (v.includes('ALI')) return '支付宝原路退款'; if (v.includes('MANUAL')) return '人工退款'; if (v.includes('OFFLINE')) return '线下退款'; return m || '-'; }
function zhRefundStatus(s?: string){ const v = String(s||'').toUpperCase(); if (v==='PENDING') return '退款中'; if (v==='SUCCESS') return '退款成功'; if (v==='FAILED') return '退款失败'; return s || '-'; }

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

function zhAftersalesType(t?: string){ const v = String(t||'').toUpperCase(); if (v==='REFUND') return '仅退款'; if (v==='RETURN') return '退货退款'; if (v==='EXCHANGE') return '换货'; return t || '-'; }
function zhAftersalesStatus(s?: string){ const v = String(s||'').toUpperCase(); if (v==='PENDING') return '处理中'; if (v==='APPROVED') return '已同意'; if (v==='REJECTED') return '已拒绝'; if (v==='SUCCESS' || v==='COMPLETED') return '已完成'; if (v==='CANCELLED') return '已取消'; return s || '-'; }
function zhEvent(e: string){ const v = String(e||'').toUpperCase(); if (v==='ORDER_STATUS') return '订单状态'; if (v==='PAY_STATUS') return '支付状态'; if (v==='FULFILLMENT') return '履约状态'; if (v==='LOGISTICS') return '物流'; if (v==='AFTERSALES') return '售后'; if (v==='BENEFITS') return '权益变更'; if (v==='REVIEW') return '评价'; if (v==='NOTE') return '备注'; return e || '-'; }
function zhTimelineValue(eventType?: string, value?: string, order?: any){
	const e = String(eventType||'').toUpperCase();
	const v = String(value||'').toUpperCase();
	if (!v) return '-';
	if (e==='ORDER_STATUS'){ if (v==='CREATED') return '已创建'; if (v==='PAID') return '已支付'; if (v==='FULFILLED') return '已履约'; if (v==='CLOSED') return '已完成'; if (v==='CANCELLED') return '已取消'; }
	if (e==='PAY_STATUS'){ if (v==='UNPAID') return '未支付'; if (v==='PAID') return '已支付'; if (v==='REFUND_REQUESTED') return '已提交退款'; if (v==='PARTIAL_REFUND') return '部分退款'; if (v==='REFUNDED') return '已退款'; if (v==='CANCELLED') return '已取消'; }
	if (e==='FULFILLMENT'){
		const type = String(order?.type||'').toUpperCase();
		if (v==='PENDING') return type==='SERVICE' ? '待服务' : '待发货';
		if (v==='IN_SERVICE') return '服务中';
		if (v==='SHIPPED') return '已发货';
		if (v==='RECEIVED') return '已收货';
		if (v==='DONE') return '已完成';
	}
	if (e==='BENEFITS'){ if (v==='WASHCARD_ROLLBACK') return '退款回收计次'; if (v==='WASHCARD_DEDUCT') return '洗车卡划扣'; if (v==='POINTS_ROLLBACK') return '返还积分'; if (v==='COUPON_RESTORE') return '恢复优惠券'; if (v==='COUPON_NOTE') return '优惠券说明'; }
	if (e==='LOGISTICS'){ if (v==='SHIPPED') return '已发货'; if (v==='EXCHANGE_SHIPPED') return '换货已发货'; if (v==='EDITED') return '已修改物流单号'; return '物流更新'; }
	if (e==='AFTERSALES'){ if (v==='PENDING') return '处理中'; if (v==='APPROVED') return '已同意'; if (v==='REJECTED') return '已拒绝'; if (v==='SUCCESS' || v==='COMPLETED') return '已完成'; if (v==='CANCELLED') return '已取消'; return v; }
	if (e==='REVIEW'){ if (v==='RATED') return '用户已评价'; if (v==='REPLIED') return '商家已回复'; }
	if (e==='NOTE'){
		if (v==='RECEIVED') return '用户已确认收货';
		if (v==='VIRTUAL_CARD_ISSUED') return '系统发放卡券完成';
		if (v==='WECHAT_MICROPAY') return '微信付款码支付';
		if (v==='GROUP_RECHARGE_CREDIT') return '集团余额充值入账';
		if (v==='GROUP_RECHARGE_REFUND_DEBIT') return '集团充值退款出账';
	}
	return value || '-';
}
function zhRemark(eventType?: string, remark?: string){
	const e = String(eventType||'').toUpperCase();
	const r = String(remark||'').toUpperCase();
	if (!r) return '';
	if (e==='AFTERSALES'){ if (r==='REFUND') return '仅退款'; if (r==='RETURN') return '退货退款'; if (r==='EXCHANGE') return '换货'; if (r==='RE_SERVICE') return '重新服务'; }
	if (e==='FULFILLMENT'){ if (r==='EXCHANGE_RESET') return '换货流转重置'; if (r==='RE_SERVICE_RESET') return '重新服务流转重置'; }
	if (r==='TIMEOUT_15MIN') return '超时15分钟';
	return remark || '';
}

const couponFlows = computed(()=>{ try{ const flows = Array.isArray((data.value?.couponFlows)||[]) ? (data.value?.couponFlows) : []; return flows.filter((f:any)=> String(f?.action||'').toUpperCase()==='USE'); }catch{ return []; } });
const couponDiscountSum = computed(()=>{ try{ const arr:any[] = couponFlows.value as any; const sum = arr.reduce((s:number,f:any)=> s + Number(f?.snapshot?.discountApplied||0), 0); return Number.isFinite(sum) ? Number(sum) : 0; }catch{ return 0; } });
function flowActionText(a?: string){ switch(String(a||'')){ case 'USE': return '使用'; case 'RESTORE': return '回退'; case 'CLAIM': return '领取'; case 'ISSUE': return '发放'; default: return a||'-'; } }
function flowTagType(a?: string){ switch(String(a||'')){ case 'USE': return 'warning'; case 'RESTORE': return 'info'; case 'CLAIM': return 'primary'; case 'ISSUE': return 'success'; default: return undefined as any; } }

const exchangeShipments = computed(()=>{ try{ const extra:any = (data.value as any)?.shipExpressExtra || {}; const list:any[] = Array.isArray(extra?.exchangeShipments) ? extra.exchangeShipments : []; return list.slice().sort((a:any,b:any)=> new Date(b?.createdAt||0).getTime() - new Date(a?.createdAt||0).getTime()); }catch{ return []; } });
function canQueryExchangeTrace(ex: any){ return !!(ex && ex.trackingNo); }
async function openExchangeTrace(ex: any){ if (!ex?.trackingNo) return; showTrace.value = true; loadingTrace.value = true; traceList.value = []; traceStatusDesc.value = ''; try{ const res:any = await http('/orders/_logistics/query', { query: { com: ex?.companyCode || undefined, no: ex?.trackingNo } }); traceStatusDesc.value = String(res?.data?.status_desc || res?.data?.statusDesc || res?.data?.status || res?.msg || ''); const rawList:any[] = Array.isArray(res?.data?.list) ? res.data.list : []; const getTime = (it:any)=> it?.datetime || it?.time || ''; const getRemark = (it:any)=> it?.remark || it?.context || ''; rawList.sort((a,b)=> new Date(getTime(b)||0).getTime() - new Date(getTime(a)||0).getTime()); traceList.value = rawList.map(it=>({ datetime: String(getTime(it)||'').trim(), remark: String(getRemark(it)||'').trim() })); }catch{ traceList.value = []; traceStatusDesc.value = ''; } finally{ loadingTrace.value = false; } }

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
	} finally{
		loadingTrace.value = false;
	}
}

const refundableLeft = computed(()=>{ try{ const rr = Array.isArray((data.value?.refundRecords)||[]) ? (data.value?.refundRecords) : []; const successSum = rr.filter((r:any)=> String(r.status||'').toUpperCase()==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0); const payAmt = Number(data.value?.payAmount||0); return Math.max(0, payAmt - successSum); }catch{ return 0; } });
function openPartialRefund(){ partialAmountText.value = ''; partialReason.value = ''; dialogPartial.value = true; }
async function submitPartialRefund(){ const raw = (partialAmountText.value||'').trim().replace(',', '.'); if (!/^\d+(\.\d{1,2})?$/.test(raw)) { ElMessage.error('金额格式不正确，最多保留2位小数'); return; } const v = Number(raw); if (!isFinite(v) || v < 0.01){ ElMessage.error('部分退款金额至少为0.01'); return; } if (v > refundableLeft.value + 1e-6){ ElMessage.error('超出剩余可退金额'); return; } try{ await http(`/orders/${data.value?.id}/refund`, { method:'POST', body: { reason: partialReason.value || '部分退款', amount: v } }); dialogPartial.value = false; fetchDetail(); }catch{} }
async function openRetryRefund(){ try{ const rec = (data.value?.refundRecords||[]).find((r:any)=> String(r.status||'').toUpperCase()==='FAILED' || String(r.status||'').toUpperCase()==='PENDING' || !r.status); if (!rec) return; await http(`/orders/_refunds/${rec.id}/retry`, { method:'POST' }); }catch{} }

async function copyNo(no?: string){
	try{
		const text = String(no||'').trim();
		if (!text){ ElMessage.error('无可复制的订单号'); return; }
		if (navigator.clipboard && (window.isSecureContext || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
			await navigator.clipboard.writeText(text);
			ElMessage.success('已复制订单号');
			return;
		}
		// 回退方案：隐藏文本域 + execCommand
		const ta = document.createElement('textarea');
		ta.value = text;
		ta.style.position = 'fixed';
		ta.style.left = '-9999px';
		ta.style.top = '0';
		ta.setAttribute('readonly', 'true');
		document.body.appendChild(ta);
		ta.select();
		ta.setSelectionRange(0, ta.value.length);
		const ok = document.execCommand('copy');
		document.body.removeChild(ta);
		if (ok){ ElMessage.success('已复制订单号'); }
		else { throw new Error('copy failed'); }
	}catch(e:any){ ElMessage.error('复制失败，请手动选择复制'); }
}
</script>

<style scoped>
.pos-order-detail{ display:flex; flex-direction: column; gap:12px; }
.detail-header{ position: sticky; top: 0; z-index: 8; display:flex; align-items:center; justify-content:space-between; background: rgba(255,255,255,0.85); backdrop-filter: blur(6px); padding:8px 0; border-bottom:1px solid #ebeef5; }
.detail-header .title{ margin:0; font-size:18px; }
.detail-header .sub{ display:flex; align-items:center; gap:6px; color:#606266; margin-top:4px; }
.detail-header .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
.mt12{ margin-top:12px; }
.mt16{ margin-top:16px; }
.img48{ width:48px; height:48px; object-fit:cover; }
.img28{ width:28px; height:28px; object-fit:contain; }
.ship-row{ display:flex; align-items:center; gap:12px; }
.flex1{ flex:1; min-width:0; }
.muted{ color:#909399; }
.danger-text{ color:#b91c1c; }
/* 触控滚动体验 */
:host, .pos-order-detail{ touch-action: pan-y; overscroll-behavior: contain; }
.coupon-list{ display:flex; flex-direction: column; gap:8px; margin-top:8px; }
.coupon-item{ display:flex; align-items:center; justify-content: space-between; background: #fafafa; border:1px dashed #e5e7eb; border-radius:8px; padding:8px 12px; }
.coupon-left{ display:flex; flex-direction: column; gap:4px; }
.coupon-name{ font-weight: 600; color:#303133; }
.coupon-meta{ display:flex; gap:12px; color:#606266; font-size:12px; }
.coupon-right{ display:flex; align-items:center; gap:8px; }
.coupon-summary{ text-align:right; color:#67C23A; font-weight:600; margin-top:4px; }

/* 金额摘要（平板优化） */
.amount-summary{ display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; }
.amount-summary .sum-item{ background:#f6f7f9; border:1px solid #ebeef5; border-radius:10px; padding:10px 12px; }
.amount-summary .sum-label{ color:#606266; font-size:12px; }
.amount-summary .sum-value{ margin-top:4px; font-size:20px; font-weight:700; color:#303133; letter-spacing: 0.2px; }
.amount-summary .sum-value.pay{ color:#1f2937; }
.amount-summary .sum-value.discount{ color:#b91c1c; }

@media (max-width: 1200px){
	.amount-summary{ grid-template-columns: repeat(2, minmax(0,1fr)); }
}
</style>
