<template>
	<div>
		<div class="toolbar">
			<el-input v-model="query.memberId" placeholder="会员ID" style="width:140px;margin-right:8px;" />
			<el-input v-model="query.orderId" placeholder="订单ID" style="width:140px;margin-right:8px;" />
			<el-button @click="fetchList" :loading="loading">查询</el-button>
		</div>
		<el-table :data="list.items" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="member.name" label="会员" min-width="160">
				<template #default="{ row }">{{ row.member?.name || '-' }}（{{ row.member?.phone || '-' }}）</template>
			</el-table-column>
			<el-table-column prop="order.no" label="订单号" min-width="160">
				<template #default="{ row }">{{ row.order?.no || row.orderId }}</template>
			</el-table-column>
			<el-table-column prop="couponSnapshot" label="卡券信息" min-width="320">
				<template #default="{ row }">
					<el-popover trigger="hover" width="460px">
						<template #reference>
							<div style="display:flex;align-items:center;gap:8px;">
								<el-tag type="info">查看</el-tag>
								<el-tag v-if="String(row.action||'').toUpperCase()==='USE' && Number((buildSnapshot(row).discountApplied||0))>0" type="danger" effect="plain">-¥{{ Number(buildSnapshot(row).discountApplied||0).toFixed(2) }}</el-tag>
							</div>
						</template>
						<div class="log-pop">
							<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
								<el-tag :type="getActionTagType(row.action)" effect="light">{{ actionText(row.action) }}</el-tag>
								<el-tag v-if="row.count" type="info">x{{ row.count }}</el-tag>
							</div>
							<el-descriptions :column="1" size="small" border>
								<el-descriptions-item label="卡券">
									{{ (buildSnapshot(row).couponName || row.coupon?.name) || '-' }}
									<span v-if="buildSnapshot(row).couponId">（ID: {{ buildSnapshot(row).couponId }}）</span>
								</el-descriptions-item>
								<el-descriptions-item label="会员券" v-if="buildSnapshot(row).memberCouponId || buildSnapshot(row).memberCouponName || row.memberCoupon || row.memberCouponId">
									{{ buildSnapshot(row).memberCouponName || row.memberCoupon?.name || '-' }}
									<span v-if="buildSnapshot(row).memberCouponId || row.memberCouponId || row.memberCoupon?.id">（ID: {{ buildSnapshot(row).memberCouponId || row.memberCouponId || row.memberCoupon?.id }}）</span>
								</el-descriptions-item>
								<el-descriptions-item label="订单" v-if="row.order?.no || buildSnapshot(row).orderId || buildSnapshot(row).orderNo">
									{{ row.order?.no || buildSnapshot(row).orderNo || buildSnapshot(row).orderId }}
								</el-descriptions-item>
								<el-descriptions-item label="会员" v-if="row.member">
									{{ row.member?.name || '-' }}（{{ row.member?.phone || '-' }}）
								</el-descriptions-item>
								<el-descriptions-item label="有效期" v-if="buildSnapshot(row).startAt || buildSnapshot(row).endAt">
									{{ buildSnapshot(row).startAt ? formatLocal(buildSnapshot(row).startAt) : '-' }} ~ {{ buildSnapshot(row).endAt ? formatLocal(buildSnapshot(row).endAt) : '-' }}
								</el-descriptions-item>
								<el-descriptions-item label="减免金额" v-if="String(row.action||'').toUpperCase()==='USE' && (buildSnapshot(row).discountApplied!=null)">
									¥{{ Number(buildSnapshot(row).discountApplied||0).toFixed(2) }}
								</el-descriptions-item>
								<el-descriptions-item label="备注" v-if="row.remark || buildSnapshot(row).remark">
									{{ row.remark || buildSnapshot(row).remark }}
								</el-descriptions-item>
							</el-descriptions>
						</div>
					</el-popover>
				</template>
			</el-table-column>
			<el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
			<el-table-column prop="createdAt" label="记录时间" width="200">
				<template #default="{ row }">{{ formatLocal(row.createdAt) }}</template>
			</el-table-column>
		</el-table>
		<el-pagination v-if="list.total>pageSize" background layout="prev, pager, next" :total="list.total" :page-size="pageSize" :current-page="page" @current-change="onPage" style="margin-top:12px" />
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const query = ref<{ memberId?: string | number; orderId?: string | number }>({});
const list = ref<{ total:number; page:number; pageSize:number; items:any[] }>({ total:0, page:1, pageSize:20, items: [] });

function toPretty(obj:any){ try{ return JSON.stringify(obj||{}, null, 2); }catch{ return String(obj||''); } }
function formatLocal(d?: string | Date | null): string{ try{ if(!d) return ''; const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const dd=String(x.getDate()).padStart(2,'0'); const hh=String(x.getHours()).padStart(2,'0'); const mm=String(x.getMinutes()).padStart(2,'0'); const ss=String(x.getSeconds()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`; }catch{ return ''; } }
function buildSnapshot(row:any){
  if (row?.couponSnapshot || row?.snapshot) return row.couponSnapshot ?? row.snapshot;
  const data: any = {};
  if (row?.coupon) { data.couponId = row.coupon.id; data.couponName = row.coupon.name; }
  if (row?.memberCoupon) { data.memberCouponId = row.memberCoupon.id; data.memberCouponName = row.memberCoupon.name; }
  if (row?.order) { data.orderId = row.order.id; data.orderNo = row.order.no; }
  if (row?.member) { data.memberId = row.member.id; data.memberName = row.member.name; data.memberPhone = row.member.phone; }
  if (row?.action) { data.action = row.action; }
  if (row?.count != null) { data.count = row.count; }
  if (row?.remark) { data.remark = row.remark; }
  return data;
}
function actionText(a?: string){
  switch(String(a||'')){
    case 'ISSUE': return '发放';
    case 'CLAIM': return '领取';
    case 'USE': return '使用';
    case 'RESTORE': return '回退';
    case 'REVOKE': return '作废';
    case 'EXPIRE': return '过期';
    case 'ADJUST': return '调整';
    default: return a||'-';
  }
}
function getActionTagType(a?: string){
  switch(String(a||'')){
    case 'ISSUE': return 'success';
    case 'CLAIM': return 'primary';
    case 'USE': return 'warning';
    case 'RESTORE': return 'info';
    case 'REVOKE': return 'danger';
    case 'EXPIRE': return 'info';
    case 'ADJUST': return 'default';
    default: return 'default';
  }
}

async function fetchList(){
  loading.value = true;
  try{
    list.value = await http('/coupons/logs', { query: { page: page.value, pageSize: pageSize.value, memberId: query.value.memberId || undefined, orderId: query.value.orderId || undefined } });
  } finally { loading.value = false; }
}
function onPage(p:number){ page.value=p; fetchList(); }

onMounted(fetchList);
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
.log-pop :deep(.el-descriptions__label){ width: 88px; }
.log-pop{ padding:4px 2px; }
</style>


