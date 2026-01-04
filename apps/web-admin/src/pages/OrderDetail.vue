<template>
	<div class="order-detail">
		<div class="order-detail__toolbar">
			<div class="order-detail__toolbar-left">
				<el-button class="back-btn" link :icon="getIcon('ArrowLeft')" @click="$router.back()">返回</el-button>
				<div class="order-detail__toolbar-meta">
					<div class="order-detail__no">订单号：{{ data?.no || '-' }}</div>
					<div class="order-detail__status">
						<el-tag v-if="data?.status" class="status-pill status-pill--order" size="small" effect="light" round :type="orderStatusTagType(data?.status)">
							<span class="status-pill__k">订单</span><span class="status-pill__v">{{ statusLabel(data?.status) }}</span>
						</el-tag>
						<el-tag v-if="data?.payStatus" class="status-pill status-pill--pay" size="small" effect="light" round :type="payStatusTagType(data?.payStatus)">
							<span class="status-pill__k">支付</span><span class="status-pill__v">{{ displayPayStatus(data?.payStatus) }}</span>
						</el-tag>
					</div>
				</div>
			</div>
			<div class="order-detail__toolbar-right">
				<el-button v-if="canWriteoff() && data?.id" type="danger" @click="writeoffThis">作废/红冲</el-button>
			</div>
		</div>

		<div class="order-detail__sections">
			<el-card class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--base">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('Document')" /></el-icon>
							<span>基础信息</span>
						</div>
						<div class="section-header__actions">
							<el-tag v-if="data?.type" size="small" effect="plain">{{ displayType(data?.type) }}</el-tag>
							<el-tag v-if="data?.payMethod" size="small" effect="plain" type="info">{{ displayPayMethod(data?.payMethod) }}</el-tag>
						</div>
					</div>
				</template>
				<div class="base-stats">
					<div class="stat">
						<div class="stat__label">支付金额</div>
						<div class="stat__value stat__value--primary">¥{{ fmtMoney(data?.payAmount) }}</div>
					</div>
					<div class="stat">
						<div class="stat__label">订单总额</div>
						<div class="stat__value">¥{{ fmtMoney(data?.totalAmount) }}</div>
					</div>
					<div class="stat">
						<div class="stat__label">减免金额</div>
						<div class="stat__value stat__value--success">-¥{{ fmtMoney(data?.discountAmount) }}</div>
					</div>
					<div class="stat stat--right">
						<div class="stat__label">下单时间</div>
						<div class="stat__value stat__value--muted">{{ formatDate(data?.createdAt) }}</div>
					</div>
				</div>
				<el-descriptions :column="2" border size="small" class="section-desc">
					<el-descriptions-item label="订单号">
						<span>{{ data?.no || '-' }}</span>
						<el-button
							v-if="data?.no"
							class="copy-btn"
							text
							title="复制订单号"
							@click.stop="copyOrderNo"
						>
							<el-icon><component :is="getIcon('CopyDocument')" /></el-icon>
						</el-button>
					</el-descriptions-item>
					<el-descriptions-item label="类型">{{ displayType(data?.type) }}</el-descriptions-item>
					<el-descriptions-item label="状态">{{ statusLabel(data?.status) }}</el-descriptions-item>
					<el-descriptions-item label="支付状态">
						<span>{{ displayPayStatus(data?.payStatus) }}</span>
						<el-tag v-if="data?.payStatus==='UNPAID' && remainSeconds(data)>0" type="warning" effect="light" style="margin-left:6px;">
							倒计时 {{ formatRemain(remainSeconds(data)) }}
						</el-tag>
					</el-descriptions-item>
					<el-descriptions-item label="提醒" v-if="data?.remark && String(data?.remark).includes('系统超时取消')">
						<span class="text-danger">超过15分钟未支付，系统已自动取消</span>
					</el-descriptions-item>
					<el-descriptions-item label="支付方式">{{ displayPayMethod(data?.payMethod) }}</el-descriptions-item>
					<el-descriptions-item label="微信交易单号" v-if="data?.wechatTransactionId">{{ data?.wechatTransactionId }}</el-descriptions-item>
					<el-descriptions-item label="收银立减" v-if="Number((data as any)?.cashierDiscountAmount||0)>0">{{ (data as any)?.cashierDiscountAmount }}</el-descriptions-item>
					<el-descriptions-item label="洗车卡抵扣" v-if="Number((data as any)?.washCardDeductAmount||0)>0">{{ (data as any)?.washCardDeductAmount }}</el-descriptions-item>
					<el-descriptions-item label="会员折扣减免" v-if="Number((data as any)?.memberDiscountAmount||0)>0">{{ (data as any)?.memberDiscountAmount }}</el-descriptions-item>
					<el-descriptions-item label="配送费">{{ data?.shippingFee }}</el-descriptions-item>
					<el-descriptions-item label="支付时间">{{ formatDate(data?.paidAt) }}</el-descriptions-item>
					<el-descriptions-item label="会员">{{ data?.member?.name }}（UID: {{ data?.member?.uid }} / {{ data?.member?.phone }}）</el-descriptions-item>
					<el-descriptions-item v-if="data?.isProxyOrder" label="代客下单">
						<span>由 {{ data?.proxyAdminSnapshot?.name || data?.proxyAdminUser?.name || '-' }}（{{ data?.proxyAdminSnapshot?.phone || data?.proxyAdminUser?.phone || '-' }}）创建</span>
					</el-descriptions-item>
					<el-descriptions-item label="用户备注">{{ (data as any)?.userRemark || '-' }}</el-descriptions-item>
					<el-descriptions-item label="付款说明">{{ (data as any)?.paymentNote || '-' }}</el-descriptions-item>
					<el-descriptions-item label="系统备注">{{ data?.remark || '-' }}</el-descriptions-item>
					<el-descriptions-item label="收货地址" v-if="data?.shippingAddressSnapshot">
						{{ addrDisplay(data?.shippingAddressSnapshot) }}
					</el-descriptions-item>
					<el-descriptions-item label="车辆" v-if="data?.type==='SERVICE'">{{ data?.vehicle?.plateNumber || '-' }}</el-descriptions-item>
				</el-descriptions>
			</el-card>

			<el-card v-if="(data as any)?.afterSalesRequests?.length" class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--aftersales">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('ChatDotRound')" /></el-icon>
							<span>售后/退款</span>
						</div>
					</div>
				</template>
				<el-timeline class="section-timeline">
					<el-timeline-item v-for="it in (data as any).afterSalesRequests" :key="it.id" :timestamp="formatDate(it.createdAt)">
						类型：{{ zhAftersalesType(it.type) }} / 状态：{{ zhAftersalesStatus(it.status) }}
					</el-timeline-item>
				</el-timeline>
				<div v-if="!((data as any).afterSalesRequests||[]).some((x:any)=>x.status==='PENDING'||x.status==='APPROVED')" class="text-muted" style="margin-top:8px;">
					无进行中售后
				</div>
			</el-card>

			<el-card v-if="(data as any)?.timelines?.length" class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--timeline">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('List')" /></el-icon>
							<span>订单流转</span>
						</div>
					</div>
				</template>
				<el-timeline class="section-timeline">
					<el-timeline-item v-for="it in (data as any).timelines" :key="it.id" :timestamp="formatDate(it.createdAt)">
						{{ zhEvent(it.event) }}：{{ zhTimelineValue(it.event, it.value, data) }}<span v-if="it.remark">（{{ zhRemark(it.event, it.remark) }}）</span>
					</el-timeline-item>
				</el-timeline>
			</el-card>

			<el-card v-if="(data as any)?.refundRecords?.length" class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--refund">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('Money')" /></el-icon>
							<span>退款记录</span>
						</div>
						<div class="section-header__actions">
							<el-button v-if="data?.payMethod==='WECHAT_JSAPI' && canShowRetryRefund" size="small" type="primary" @click="openRetryRefund">重试渠道退款</el-button>
							<el-button v-if="(data?.payMethod==='WECHAT_JSAPI' || data?.payMethod==='WECHAT_MICROPAY') && canShowPartialRefund" size="small" @click="openPartialRefund">部分退款</el-button>
						</div>
					</div>
				</template>
				<el-table :data="(data as any).refundRecords" size="small" border stripe class="section-table">
					<el-table-column prop="id" label="ID" width="80" />
					<el-table-column prop="amount" label="金额" width="120" />
					<el-table-column prop="method" label="方式" width="140">
						<template #default="{ row }">{{ zhRefundMethod(row.method) }}</template>
					</el-table-column>
					<el-table-column prop="status" label="状态" width="140">
						<template #default="{ row }">{{ zhRefundStatus(row.status) }}</template>
					</el-table-column>
					<el-table-column prop="outRefundNo" label="商户退款单号" min-width="220" />
					<el-table-column prop="wechatRefundId" label="微信退款单号" min-width="220" />
					<el-table-column prop="failedReason" label="失败原因" min-width="180" />
					<el-table-column label="操作" width="120" fixed="right">
						<template #default="{ row }">
							<el-button v-if="canQueryRefund(row)" size="small" @click="queryRefund(row)">查询</el-button>
						</template>
					</el-table-column>
				</el-table>
			</el-card>

			<el-card v-if="(data as any)?.couponRestoreLogs?.length" class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--coupon">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('Tickets')" /></el-icon>
							<span>优惠券恢复记录</span>
						</div>
					</div>
				</template>
				<el-table :data="(data as any).couponRestoreLogs" size="small" border stripe class="section-table">
					<el-table-column prop="id" label="ID" width="80" />
					<el-table-column prop="createdAt" label="时间" width="180">
						<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
					</el-table-column>
					<el-table-column prop="remark" label="备注" min-width="240" />
				</el-table>
			</el-card>

			<el-card class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--items">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('ShoppingCart')" /></el-icon>
							<span>订单项</span>
						</div>
					</div>
				</template>
				<el-table :data="data?.items||[]" border stripe size="small" class="section-table">
					<el-table-column label="图片" width="80">
						<template #default="{ row }">
							<img v-if="row.imageUrl" :src="absUrl(row.imageUrl)" class="item-img" />
							<span v-else class="text-muted">-</span>
						</template>
					</el-table-column>
					<el-table-column prop="name" label="名称" min-width="160" />
					<el-table-column prop="specsText" label="规格" min-width="200" />
					<el-table-column prop="barcode" label="条码" width="160" />
					<el-table-column prop="price" label="单价" width="120" />
					<el-table-column prop="discount" label="优惠" width="120" />
					<el-table-column prop="quantity" label="数量" width="80" />
				</el-table>
			</el-card>

			<el-card v-if="data?.type==='SP' || exchangeShipments.length" class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--logistics">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('Van')" /></el-icon>
							<span>物流信息</span>
						</div>
					</div>
				</template>

				<div v-if="data?.type==='SP'" class="logistics-box">
					<div v-if="data?.shipNoExpress" class="text-muted">商家已选择无需快递发货</div>
					<div v-else-if="data?.shipExpressTrackingNo" class="logistics-row">
						<img v-if="data?.shipExpressCompanyLogo" :src="data?.shipExpressCompanyLogo" class="logistics-logo" />
						<div class="logistics-main">
							<div class="logistics-line">快递公司：{{ data?.shipExpressCompanyName || data?.shipExpressCompanyCode || '-' }}</div>
							<div class="logistics-line">运单号：{{ data?.shipExpressTrackingNo }}</div>
							<div class="logistics-line" v-if="data?.shippedAt">发货时间：{{ formatDate(data?.shippedAt) }}</div>
							<div v-if="(data?.shipExpressExtra||{}).editedOnce" class="text-muted" style="margin-top:4px;">
								提示：该订单的物流单号已在{{ formatDate((data?.shipExpressExtra||{}).editAt) }}进行过一次修改（原单号：{{ (data?.shipExpressExtra||{}).prevTrackingNo||'-' }}）
							</div>
						</div>
						<el-button size="small" type="primary" @click="openTrace">查询物流</el-button>
					</div>
					<div v-else class="text-muted">暂无物流信息</div>
				</div>

				<div v-if="exchangeShipments.length" class="logistics-box" style="margin-top:12px;">
					<div class="logistics-subtitle">换货物流</div>
					<div class="exchange-list">
						<div v-for="(ex,idx) in exchangeShipments" :key="idx" class="exchange-item">
							<div v-if="ex.noExpress" class="text-muted">无需快递发货</div>
							<div v-else class="logistics-row" style="gap:10px;">
								<div class="logistics-main">
									<div class="logistics-line">快递公司：{{ ex.companyName || ex.companyCode || '-' }}</div>
									<div class="logistics-line">运单号：{{ ex.trackingNo || '-' }}</div>
									<div class="logistics-line" v-if="ex.createdAt">发货时间：{{ formatDate(ex.createdAt) }}</div>
								</div>
								<el-button v-if="canQueryExchangeTrace(ex)" size="small" type="primary" @click="openExchangeTrace(ex)">查询物流</el-button>
							</div>
						</div>
					</div>
				</div>
			</el-card>

			<el-card class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--benefits">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('Present')" /></el-icon>
							<span>权益与卡券</span>
						</div>
					</div>
				</template>
				<el-descriptions :column="2" border size="small" class="section-desc">
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
					<el-descriptions-item label="洗车卡抵扣" v-if="Number((data as any)?.washCardDeductAmount||0)>0">
						<span>已用洗车卡抵扣：¥{{ Number((data as any)?.washCardDeductAmount||0).toFixed(2) }}</span>
					</el-descriptions-item>
				</el-descriptions>
			</el-card>

			<el-card class="section-card" shadow="never">
				<template #header>
					<div class="section-header section-header--points">
						<div class="section-title">
							<el-icon class="section-icon"><component :is="getIcon('TrendCharts')" /></el-icon>
							<span>积分变动（本订单）</span>
						</div>
						<div class="section-header__actions points-chips">
							<el-tag effect="light" type="success">支付入账 +{{ sumPay }}</el-tag>
							<el-tag effect="light" type="warning">下单抵扣 -{{ sumUse }}</el-tag>
							<el-tag effect="light" type="info">退款返还 +{{ sumRefundReturn }}</el-tag>
							<el-tag effect="light" type="danger">退款扣减 -{{ sumRefundDeduct }}</el-tag>
							<el-tag effect="dark" :type="netChange>=0?'success':'danger'">净变动 {{ netChange>=0?('+'+netChange):netChange }}</el-tag>
						</div>
					</div>
				</template>
				<div v-if="!pointsLogs.length" class="text-muted">暂无积分变动记录</div>
				<el-table v-else :data="pointsLogs" size="small" border stripe class="section-table">
					<el-table-column prop="createdAt" label="时间" width="180">
						<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
					</el-table-column>
					<el-table-column prop="source" label="来源" width="120">
						<template #default="{ row }">
							<el-tag size="small" effect="light" :type="sourceTagType(row)">{{ sourceLabel(row) }}</el-tag>
						</template>
					</el-table-column>
					<el-table-column prop="change" label="变动" width="120" align="right">
						<template #default="{ row }">
							<span class="points-change" :class="{ 'points-change--pos': Number(row.change)>=0, 'points-change--neg': Number(row.change)<0 }">
								{{ Number(row.change)>=0 ? ('+'+Number(row.change)) : Number(row.change) }}
							</span>
						</template>
					</el-table-column>
					<el-table-column prop="desc" label="备注" min-width="220" />
				</el-table>
				<div class="points-card__hint">说明：仅展示与该订单关联（orderId）的一次性积分日志；退款扣减/返还会以 REFUND 记录体现。</div>
			</el-card>
		</div>

		<el-dialog v-model="dialogPartial" title="部分退款" width="420px">
			<el-form label-width="96px">
				<el-form-item label="退款金额(元)">
					<el-input v-model="partialAmountText" inputmode="decimal" :placeholder="`输入金额，最低0.01，最高¥${refundableLeft.toFixed(2)}`" />
					<div class="text-muted" style="margin-left:8px;">剩余可退：¥{{ refundableLeft.toFixed(2) }}</div>
				</el-form-item>
				<el-form-item label="原因"><el-input v-model="partialReason" placeholder="可选" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogPartial=false">取消</el-button>
				<el-button type="primary" @click="submitPartialRefund">提交</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showTrace" title="物流轨迹" width="640px">
			<el-skeleton v-if="loadingTrace" :rows="4" animated />
			<div v-else>
				<div class="text-muted" style="margin-bottom:8px;">状态：{{ traceStatusDesc || '-' }}</div>
				<el-timeline class="section-timeline">
					<el-timeline-item v-for="(it,idx) in traceList" :key="idx" :timestamp="it.datetime" placement="top">
						{{ it.remark }}
					</el-timeline-item>
				</el-timeline>
			</div>
			<template #footer>
				<el-button @click="showTrace=false">关闭</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { absUrl } from '../utils/http';
import * as EpIcons from '@element-plus/icons-vue';
import {
	orderControllerGet,
	orderControllerGetByNo,
	orderControllerQuery,
	orderControllerQueryRefundV2,
	orderControllerRetryRefund,
	orderControllerWechatRefund,
	orderControllerWriteoff,
} from '@wash/api-client';
import { ElMessage, ElMessageBox } from 'element-plus';

const route = useRoute();
const data = ref<any>(null);
const canShowRetryRefund = ref(false);
const canShowPartialRefund = ref(false);
const showTrace = ref(false);
const traceList = ref<Array<{ datetime:string; remark:string }>>([]);
const traceStatusDesc = ref<string>('');
const loadingTrace = ref(false);
function getIcon(name: string){
	return (EpIcons as any)[name] || (EpIcons as any).Document;
}
function statusLabel(v?: string){ if(v==='CREATED') return '已创建'; if(v==='PAID') return '已支付'; if(v==='FULFILLED') return '已履约'; if(v==='CLOSED') return '已完成'; if(v==='CANCELLED') return '已取消'; return v || '-'; }
function orderStatusTagType(v?: string){
	const s = String(v || '').toUpperCase();
	if (s === 'PAID' || s === 'FULFILLED' || s === 'CLOSED') return 'success';
	if (s === 'CREATED') return 'warning';
	if (s === 'CANCELLED') return 'info';
	return 'info';
}
function payStatusTagType(v?: string){
	const s = String(v || '').toUpperCase();
	if (s === 'PAID') return 'success';
	if (s === 'UNPAID') return 'warning';
	if (s === 'REFUNDED' || s === 'PARTIAL_REFUND') return 'info';
	if (s === 'CANCELLED') return 'info';
	return 'info';
}
function fmtMoney(v: any){
	try{
		const n = Number(v ?? 0);
		if (!Number.isFinite(n)) return '0.00';
		return n.toFixed(2);
	}catch{
		return '0.00';
	}
}

async function copyOrderNo(){
	try{
		const no = String(data.value?.no || '').trim();
		if (!no){ ElMessage.error('订单号为空'); return; }
		if (navigator?.clipboard?.writeText){
			await navigator.clipboard.writeText(no);
			ElMessage.success('已复制订单号');
			return;
		}
		// 兼容：降级方案
		const ta = document.createElement('textarea');
		ta.value = no;
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.focus();
		ta.select();
		const ok = document.execCommand('copy');
		document.body.removeChild(ta);
		if (ok) ElMessage.success('已复制订单号');
		else ElMessage.error('复制失败');
	}catch(e:any){
		ElMessage.error(String(e?.message || e || '复制失败'));
	}
}
async function fetchDetail(){
    const idParam = route.params.id as string | undefined;
    const noParam = route.params.no as string | undefined;
    if (noParam) {
        data.value = await (orderControllerGetByNo(encodeURIComponent(String(noParam))) as any);
    } else if (idParam) {
        const id = Number(idParam);
        data.value = await (orderControllerGet(id) as any);
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

// =========================
// 本订单积分日志（仅后台返回）
// =========================
type PointsLogRow = { id: number; createdAt: string; change: number; source: string; desc?: string | null };
const pointsLogs = computed<PointsLogRow[]>(() => {
	try {
		const rows: any[] = Array.isArray((data.value as any)?.pointsLogs) ? (data.value as any).pointsLogs : [];
		return rows
			.map((r) => ({
				id: Number((r as any)?.id || 0),
				createdAt: String((r as any)?.createdAt || ''),
				change: Number((r as any)?.change || 0),
				source: String((r as any)?.source || ''),
				desc: (r as any)?.desc ?? null,
			}))
			.filter((r) => r.id > 0)
			.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	} catch {
		return [];
	}
});
const sumPay = computed(() => pointsLogs.value.filter(r => String(r.source).toUpperCase()==='PAY').reduce((s,r)=> s + Math.max(0, Number(r.change||0)), 0));
const sumUse = computed(() => pointsLogs.value.filter(r => String(r.source).toUpperCase()==='USE').reduce((s,r)=> s + Math.abs(Math.min(0, Number(r.change||0))), 0));
const sumRefundReturn = computed(() => pointsLogs.value.filter(r => String(r.source).toUpperCase()==='REFUND' && Number(r.change)>0).reduce((s,r)=> s + Number(r.change||0), 0));
const sumRefundDeduct = computed(() => pointsLogs.value.filter(r => String(r.source).toUpperCase()==='REFUND' && Number(r.change)<0).reduce((s,r)=> s + Math.abs(Number(r.change||0)), 0));
const netChange = computed(() => pointsLogs.value.reduce((s,r)=> s + Number(r.change||0), 0));
function sourceLabel(row: any){
	const src = String(row?.source||'').toUpperCase();
	if (src === 'PAY') return '支付入账';
	if (src === 'USE') return '下单抵扣';
	if (src === 'REFUND') return Number(row?.change||0) >= 0 ? '退款返还' : '退款扣减';
	if (src === 'ADMIN') return '后台调整';
	return src || '-';
}
function sourceTagType(row: any){
	const src = String(row?.source||'').toUpperCase();
	if (src === 'PAY') return 'success';
	if (src === 'USE') return 'warning';
	if (src === 'REFUND') return Number(row?.change||0) >= 0 ? 'info' : 'danger';
	if (src === 'ADMIN') return 'info';
	return undefined as any;
}

function remainSeconds(row:any): number { try{ const exp:any = row?.paymentExpireAt || null; if(!exp) return 0; const t = new Date(exp).getTime(); return Math.max(0, Math.floor((t - Date.now())/1000)); }catch{ return 0; } }
function formatRemain(sec:number): string { const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60; return (h>0)?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

async function openRetryRefund(){
    // 找到可重试的记录（FAILED或PENDING）
    const rec = (data.value?.refundRecords||[]).find((r:any)=> r.status==='FAILED' || r.status==='PENDING');
    if (!rec) return;
    try{
        await orderControllerRetryRefund(Number(rec?.id||0));
        ElMessage.success('已提交重试，请稍后刷新状态');
        await fetchDetail();
    }catch(e:any){
        ElMessage.error(String(e?.message||e||'重试失败'));
    }
}

function canWriteoff(){ try{ const raw = localStorage.getItem('user')||'{}'; const u = JSON.parse(raw||'{}'); const perms = Array.isArray(u?.permissions)?u.permissions:[]; return perms.includes('*') || perms.includes('orders-writeoff'); }catch{ return false; } }
async function writeoffThis(){ try{ const ok = await new Promise<boolean>(r=>{ ElMessageBox.confirm('确认对该订单执行作废/红冲操作？', '操作确认', { type:'warning' }).then(()=>r(true)).catch(()=>r(false)); }); if(!ok) return; const id = Number((data.value?.id)||0); if(!id) return; await orderControllerWriteoff(id, { body: { reason: '后台作废/红冲' } } as any); ElMessage.success('操作成功'); await fetchDetail(); }catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }

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
        const res:any = await (orderControllerQueryRefundV2(encodeURIComponent(String(row.outRefundNo||''))) as any);
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
        await orderControllerWechatRefund(Number(data.value?.id||0), { body: { reason: partialReason.value || '部分退款', amount: v } } as any);
        ElMessage.success('已提交退款请求');
        dialogPartial.value = false;
        fetchDetail();
    }catch(e:any){
        ElMessage.error(String(e?.message||e||'提交失败'));
    }
}

async function openTrace(){
    if (!data.value?.shipExpressTrackingNo) return;
    showTrace.value = true; loadingTrace.value = true; traceList.value = []; traceStatusDesc.value = '';
    try{
        const res:any = await (orderControllerQuery({ com: data.value?.shipExpressCompanyCode || undefined, no: data.value?.shipExpressTrackingNo } as any) as any);
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
        const res:any = await (orderControllerQuery({ com: ex?.companyCode || undefined, no: ex?.trackingNo } as any) as any);
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
	if (v.includes('WASH_CARD') || v==='WASH_CARD') return '洗车卡结算';
	if (v==='GROUP_BALANCE') return '集团余额支付';
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
		if (v==='WASHCARD_DEDUCT') return '洗车卡划扣';
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
		if (v==='CASHIER_DISCOUNT_ADJUST') return '收银立减调整';
        if (v==='GROUP_RECHARGE_CREDIT') return '集团余额充值入账';
        if (v==='GROUP_RECHARGE_REFUND_DEBIT') return '集团充值退款出账';
        if (v==='GROUP_BALANCE_PAY') return '集团余额支付';
        if (v==='GROUP_BALANCE_REFUND_CREDIT') return '集团余额退款入账';
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
</script>

<style scoped>
.order-detail{ padding: 8px 8px 16px; }
.order-detail__toolbar{
	display:flex;
	align-items:flex-start;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
	flex-wrap: wrap;
}
.order-detail__toolbar-left{
	display:flex;
	align-items:center;
	gap:10px;
	flex-wrap: wrap;
	flex: 1 1 560px;
	min-width: 0;
}
.order-detail__toolbar-right{
	display:flex;
	align-items:center;
	justify-content:flex-end;
	margin-left: auto;
}
.order-detail__toolbar-meta{
	display:flex;
	align-items:center;
	gap:8px;
	flex-wrap: wrap;
	/* 关键：不允许在同一行被挤到很窄然后内部换行，从而产生“按钮宽度的左侧留白” */
	flex: 1 0 420px;
	min-width: 420px;
}
.order-detail__status{ display:flex; align-items:center; gap:8px; flex-wrap: wrap; }
.status-pill{ display:inline-flex; align-items:center; }
.status-pill__k{
	font-size: 12px;
	font-weight: 800;
	opacity: 0.8;
	padding-right: 6px;
	margin-right: 6px;
	border-right: 1px solid rgba(0,0,0,0.10);
}
.status-pill__v{ font-weight: 900; letter-spacing: 0.2px; }
.back-btn{
	padding-left: 0;
	font-weight: 600;
}
.copy-btn{
	margin-left: 6px;
	padding: 0 4px;
}
.order-detail__no{ font-weight: 700; color:#303133; }
.order-detail__sections{
	display:flex;
	flex-direction: column;
	gap: 12px;
	width:100%;
	min-width: 0;
}

.section-card{ border-radius: 10px; }
.section-header{
	position: relative;
	display:flex;
	align-items:center;
	justify-content: space-between;
	gap:12px;
	--bar-gradient: linear-gradient(180deg, #94a3b8, #64748b);
	--icon-color: #3b82f6;
}
.section-header::before{
	content:'';
	position:absolute;
	left:-16px;
	top:50%;
	transform: translateY(-50%);
	width:4px;
	height:18px;
	border-radius: 2px;
	background: var(--bar-gradient);
}
.section-title{
	display:flex;
	align-items:center;
	gap:8px;
	font-weight: 800;
	color:#1f2937;
	letter-spacing: 0.2px;
}
.section-icon{ color: var(--icon-color); }
.section-header__actions{ display:flex; align-items:center; gap:8px; flex-wrap: wrap; justify-content: flex-end; }
.points-chips :deep(.el-tag){ margin-right: 0; }

.text-muted{ color:#909399; }
.text-danger{ color:#b91c1c; font-weight: 600; }

.section-header--base{ --bar-gradient: linear-gradient(180deg, #3b82f6, #22c55e); --icon-color:#3b82f6; }
.section-header--aftersales{ --bar-gradient: linear-gradient(180deg, #a855f7, #ec4899); --icon-color:#a855f7; }
.section-header--timeline{ --bar-gradient: linear-gradient(180deg, #06b6d4, #3b82f6); --icon-color:#06b6d4; }
.section-header--refund{ --bar-gradient: linear-gradient(180deg, #f59e0b, #ef4444); --icon-color:#f59e0b; }
.section-header--coupon{ --bar-gradient: linear-gradient(180deg, #22c55e, #84cc16); --icon-color:#22c55e; }
.section-header--items{ --bar-gradient: linear-gradient(180deg, #64748b, #334155); --icon-color:#64748b; }
.section-header--logistics{ --bar-gradient: linear-gradient(180deg, #0ea5e9, #6366f1); --icon-color:#0ea5e9; }
.section-header--benefits{ --bar-gradient: linear-gradient(180deg, #14b8a6, #22c55e); --icon-color:#14b8a6; }
.section-header--points{ --bar-gradient: linear-gradient(180deg, #6366f1, #a855f7); --icon-color:#6366f1; }

.base-stats{
	display:grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 10px;
	padding: 10px;
	border-radius: 10px;
	background: linear-gradient(180deg, #f8fafc, #ffffff);
	border: 1px solid #f0f2f5;
	margin-bottom: 12px;
}
.stat{
	padding: 10px 12px;
	border-radius: 10px;
	background:#fff;
	border: 1px solid #f3f4f6;
	min-width: 0;
}
.stat__label{ color:#6b7280; font-size: 12px; }
.stat__value{ color:#111827; font-weight: 800; margin-top: 4px; white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
.stat__value--primary{ color:#2563eb; }
.stat__value--success{ color:#16a34a; }
.stat__value--muted{ color:#374151; font-weight: 700; }
.stat--right .stat__value{ font-weight: 700; }

.item-img{ width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #ebeef5; background:#fff; }

.logistics-box{ background:#fafafa; border:1px solid #f0f2f5; border-radius:10px; padding:12px; }
.logistics-row{ display:flex; align-items:center; gap:12px; }
.logistics-logo{ width:28px; height:28px; object-fit:contain; }
.logistics-main{ flex:1; min-width:0; }
.logistics-line{ color:#303133; line-height: 1.6; }
.logistics-subtitle{ font-weight: 700; color:#303133; margin-bottom: 8px; }
.exchange-list{ display:flex; flex-direction: column; gap:10px; }
.exchange-item{ padding-top: 10px; border-top: 1px dashed #e5e7eb; }
.exchange-item:first-child{ padding-top: 0; border-top: 0; }

.points-change{ font-weight: 700; }
.points-change--pos{ color:#16a34a; }
.points-change--neg{ color:#ef4444; }

.coupon-list{ display:flex; flex-direction: column; gap:8px; }
.coupon-item{ display:flex; align-items:center; justify-content: space-between; background: #fafafa; border:1px dashed #e5e7eb; border-radius:8px; padding:8px 12px; }
.coupon-left{ display:flex; flex-direction: column; gap:4px; }
.coupon-name{ font-weight: 600; color:#303133; }
.coupon-meta{ display:flex; gap:12px; color:#606266; font-size:12px; }
.coupon-right{ display:flex; align-items:center; gap:8px; }
.coupon-summary{ text-align:right; color:#67C23A; font-weight:600; margin-top:4px; }

.points-card__hint{ margin-top: 10px; color:#909399; font-size: 12px; }

/* Element Plus 细节统一 */
.order-detail :deep(.el-card__header){ padding: 12px 16px; border-bottom: 1px solid #f0f2f5; }
.order-detail :deep(.el-card__body){ padding: 12px 16px; }
.order-detail :deep(.el-descriptions__label){ color:#606266; }
.order-detail :deep(.el-table th.el-table__cell){ background:#fafafa; }
.order-detail :deep(.el-timeline-item__timestamp){ color:#909399; }
.section-timeline{ margin-top: 4px; }

@media (max-width: 640px){
	.order-detail__toolbar-meta{
		flex-basis: 100%;
		min-width: 0;
	}
	.order-detail__toolbar-right{
		width: 100%;
	}
	.base-stats{
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.section-header::before{ left: -12px; }
}
</style>


