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
					<el-button v-if="row.status==='PENDING'" size="small" type="success" @click="openAudit(row, true)">通过</el-button>
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

		<!-- 审核通过确认（仅用于提示后续退款确认在订单页面操作） -->
		<el-dialog v-model="auditDialog" title="审核确认" width="480px">
			<div v-if="auditRow">
				<p>是否确认通过该售后申请？</p>
				<p v-if="auditRow?.order?.payMethod==='WECHAT_JSAPI'" style="color:#666;">提示：通过后请到该订单详情或列表进行退款确认（支持全额/部分退款）。</p>
			</div>
			<template #footer>
				<el-button @click="auditDialog=false">取消</el-button>
				<el-button type="primary" @click="confirmAudit">确认通过</el-button>
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
const auditDialog = ref(false);
const auditRow = ref<any>(null);
const auditRefundMode = ref<'FULL'|'PART'>('FULL');
const auditRefundAmount = ref<number|undefined>(undefined);
const auditHasPartial = ref(false);
const auditRefundableLeft = ref(0);

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
function openAudit(row: any, approve: boolean){
    auditRow.value = row; auditDialog.value = true;
    auditRefundMode.value = 'FULL'; auditRefundAmount.value = undefined;
    // 预计算退款可用信息（仅JSAPI展示选项）
    const ord = row?.order || {};
    const rr = Array.isArray(ord.refundRecords) ? ord.refundRecords : [];
    const successSum = rr.filter((r:any)=> r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
    auditHasPartial.value = successSum > 0;
    auditRefundableLeft.value = Math.max(0, Number(ord.payAmount||0) - successSum);
}
async function confirmAudit(){
    if (!auditRow.value) return;
    const afr = auditRow.value;
    // 先审核通过
    await http(`/orders/_after-sales/${afr.id}/audit`, { method:'POST', body: { approve: true } });
    try{
        const ord = afr.order || {};
        if (ord.payMethod === 'WECHAT_JSAPI'){
            let amount: number | undefined = undefined;
            if (auditRefundMode.value === 'FULL'){
                if (auditHasPartial.value){ ElMessage.error('已发生部分退款，不能再使用全额退款'); auditDialog.value=false; fetchList(); return; }
                amount = Number(ord.payAmount||0);
            } else {
                const v = Number(auditRefundAmount.value||0);
                if (!isFinite(v) || v < 0.01){ ElMessage.error('部分退款金额至少为0.01'); auditDialog.value=false; fetchList(); return; }
                if (v > auditRefundableLeft.value + 1e-6){ ElMessage.error('超出剩余可退金额'); auditDialog.value=false; fetchList(); return; }
                amount = v;
            }
            const resp = await http(`/orders/${ord.id}/refund/wechat`, { method:'POST', body: { reason: '售后退款', amount } });
            if (resp?.ok){ ElMessage.success('退款已提交'); } else { ElMessage.error(resp?.error || '退款申请失败'); }
        } else {
            // 非微信：内部退款
            await http(`/orders/${afr.orderId}/refund`, { method:'POST', body: { reason: '售后退款' } });
            ElMessage.success('已退款');
        }
    }catch{}
    auditDialog.value = false; fetchList();
}
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


