<template>
	<BasePage title="售后申请">
		<template #actions>
			<el-input v-model="keyword" placeholder="搜索订单号/手机号" clearable style="width:240px;" />
			<el-select v-model="status" placeholder="状态" style="width:180px; margin-left:8px;">
				<el-option label="全部" value="" />
				<el-option label="待审核" value="PENDING" />
				<el-option label="已通过" value="APPROVED" />
				<el-option label="已拒绝" value="REJECTED" />
				<el-option label="已完成" value="COMPLETED" />
			</el-select>
			<el-button type="primary" @click="fetchList" style="margin-left:8px;">刷新</el-button>
		</template>
		<el-table :data="rows" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="order.no" label="订单号" width="200">
				<template #default="{ row }">
					<el-link type="primary" @click="openOrder(row.order?.id)">{{ row.order?.no }}</el-link>
				</template>
			</el-table-column>
			<el-table-column prop="member.phone" label="手机号" width="140" />
			<el-table-column prop="type" label="类型" width="120">
				<template #default="{ row }">{{ zhType(row.type) }}</template>
			</el-table-column>
			<el-table-column prop="status" label="状态" width="120">
				<template #default="{ row }">{{ zhStatus(row.status) }}</template>
			</el-table-column>
			<el-table-column label="理由/说明">
				<template #default="{ row }">
					<div>{{ zhReason(row.reasonCode) || '-' }}</div>
					<div style="color:#666;">{{ row.reasonText || row.description || '-' }}</div>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="260">
				<template #default="{ row }">
					<el-button size="small" @click="view(row)">详情</el-button>
					<el-button v-if="row.status==='PENDING'" size="small" type="success" @click="audit(row, true)">通过</el-button>
					<el-button v-if="row.status==='PENDING'" size="small" type="danger" @click="audit(row, false)">拒绝</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="detailVisible" title="售后详情" width="720px">
			<div v-if="current">
				<p><b>订单号：</b>{{ current.order?.no }}</p>
				<p><b>类型：</b>{{ zhType(current.type) }}　<b>状态：</b>{{ zhStatus(current.status) }}</p>
				<p><b>理由：</b>{{ zhReason(current.reasonCode) || '-' }}</p>
				<p><b>说明：</b>{{ current.reasonText || current.description || '-' }}</p>
				<div v-if="current.type==='EXCHANGE' && current.exchangeAddressSnapshot" style="margin-top:8px;">
					<p><b>换货收货地址：</b></p>
					<p>{{ addrDisplay(current.exchangeAddressSnapshot) }}</p>
				</div>
				<div v-if="(current.imagesJson||[]).length" style="margin-top:8px;">
					<p><b>凭证：</b></p>
					<div style="display:flex; gap:8px; flex-wrap:wrap;">
						<img v-for="(img,idx) in (current.imagesJson||[])" :key="idx" :src="img" style="width:96px;height:96px;object-fit:cover;border-radius:6px;border:1px solid #eee;" />
					</div>
				</div>
			</div>
			<template #footer>
				<el-button @click="detailVisible=false">关闭</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Row = any;
const rows = ref<Row[]>([]);
const keyword = ref('');
const status = ref('');
const detailVisible = ref(false);
const current = ref<any>(null);

function zhType(t: string){ if (t==='REFUND') return '退款'; if (t==='EXCHANGE') return '换货'; if (t==='RE_SERVICE') return '重新服务'; return t; }
function zhStatus(s: string){ if (s==='PENDING') return '待审核'; if (s==='APPROVED') return '已通过'; if (s==='REJECTED') return '已拒绝'; if (s==='COMPLETED') return '已完成'; if (s==='CANCELLED') return '已撤销'; return s; }
function zhReason(code?: string){
    const c = String(code||'').toUpperCase();
    if (!c) return '';
    const map: Record<string,string> = {
        'NO_LONGER_NEED': '不想要了',
        'PRICE_OR_COUPON': '买贵了/少用优惠',
        'NOT_RECEIVED_OR_UNUSED': '未收到商品/未使用服务',
        'QUALITY': '质量问题',
        'MISSING_OR_DAMAGED': '少件/破损/变形',
        'NOT_LIKE': '拍错/不喜欢/不合适',
        'SELLER_WRONG': '卖家发错货',
        'POOR_WORKMANSHIP': '做工粗糙/有瑕疵',
        'NOT_SATISFIED': '不满意服务效果',
        'UNFINISHED': '服务未完成约定项目',
        'OTHER': '其他'
    };
    return map[c] || code || '';
}

async function fetchList(){
	const list = await http('/orders/_after-sales', { method:'GET', query: { status: status.value || undefined } });
	let data: any[] = Array.isArray(list) ? list : [];
	if (keyword.value.trim()){
		const kw = keyword.value.trim();
		data = data.filter(it => String(it?.order?.no||'').includes(kw) || String(it?.member?.phone||'').includes(kw));
	}
	rows.value = data;
}

function openOrder(orderId?: number){ if (!orderId) return; window.open(`/orders/${orderId}`, '_blank'); }
function view(row: any){ current.value = row; detailVisible.value = true; }
async function audit(row: any, approve: boolean){ await http(`/orders/_after-sales/${row.id}/audit`, { method:'POST', body: { approve } }); ElMessage.success('已提交'); fetchList(); }

function addrDisplay(info: any){
	try{
		const a = typeof info === 'string' ? JSON.parse(info) : info;
		if (!a) return '-';
		const line1 = [a?.province, a?.city, a?.district, a?.street].filter(Boolean).join(' ');
		const line2 = [a?.detail, a?.name, a?.phone].filter(Boolean).join(' · ');
		return `${line1} ${line2 ? (' / ' + line2) : ''}`;
	}catch{ return '-'; }
}

onMounted(fetchList);
</script>

<style scoped>
</style>


