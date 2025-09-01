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
			<el-table-column prop="couponSnapshot" label="卡券信息" min-width="220">
				<template #default="{ row }">
					<el-popover trigger="hover" width="420px">
						<template #reference>
							<el-tag type="info">查看</el-tag>
						</template>
						<pre style="white-space:pre-wrap;max-height:260px;overflow:auto">{{ toPretty(row.couponSnapshot) }}</pre>
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

async function fetchList(){
  loading.value = true;
  try{
    list.value = await http('/coupon/logs', { query: { page: page.value, pageSize: pageSize.value, memberId: query.value.memberId || undefined, orderId: query.value.orderId || undefined } });
  } finally { loading.value = false; }
}
function onPage(p:number){ page.value=p; fetchList(); }

onMounted(fetchList);
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
</style>


