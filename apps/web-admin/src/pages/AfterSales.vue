<template>
	<BasePage title="售后申请">
		<template #actions>
			<el-input v-model="keyword" placeholder="搜索订单号/手机号" clearable style="width:240px;" @keyup.enter="fetchList" />
			<el-select v-model="status" placeholder="状态" style="width:180px; margin-left:8px;">
				<el-option label="全部" value="" />
				<el-option label="待审核" value="PENDING" />
				<el-option label="已通过" value="APPROVED" />
				<el-option label="已拒绝" value="REJECTED" />
				<el-option label="已完成" value="COMPLETED" />
			</el-select>
			<el-button type="primary" @click="fetchList" style="margin-left:8px;">
				<el-icon style="vertical-align: middle; margin-right:4px;"><Refresh /></el-icon>
				<span style="vertical-align: middle;">刷新</span>
			</el-button>
		</template>
		<el-table :data="rows" stripe style="width:100%" v-loading="loading">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="order.no" label="订单号" width="280">
				<template #default="{ row }">
					<el-link type="primary" @click="openOrder(row.order?.no)">
						<span>{{ headOrderNo(row.order?.no) }}</span><span class="order-tail">{{ tailOrderNo(row.order?.no) }}</span>
					</el-link>
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
					<el-button size="small" @click="view(row)">
						<el-icon><View /></el-icon>
						<span>详情</span>
					</el-button>
					<el-button v-if="row.status==='PENDING'" size="small" type="success" @click="openAudit(row)">
						<el-icon><Check /></el-icon>
						<span>通过</span>
					</el-button>
					<el-button v-if="row.status==='PENDING'" size="small" type="danger" @click="audit(row, false)">
						<el-icon><Close /></el-icon>
						<span>拒绝</span>
					</el-button>
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

		<!-- 审核确认：仅退款时可发起退款；换货时填写换货发货信息 -->
		<el-dialog v-model="auditDialog" title="审核确认" width="520px">
			<div v-if="auditRow">
				<p>是否确认通过该售后申请？</p>
				<template v-if="auditRow?.type==='REFUND' && (auditRow?.order?.payMethod==='WECHAT_JSAPI' || auditRow?.order?.payMethod==='WECHAT_MICROPAY')">
					<el-form label-width="96px" style="margin-top:8px;">
						<el-form-item label="退款方式">
							<el-radio-group v-model="auditRefundMode">
								<el-radio value="FULL" :disabled="auditHasPartial">全额退款</el-radio>
								<el-radio value="PART">部分退款</el-radio>
							</el-radio-group>
						</el-form-item>
						<el-form-item v-if="auditRefundMode==='PART'" label="退款金额">
							<el-input v-model="auditRefundAmountText" inputmode="decimal" :placeholder="`输入金额，最低0.01，最高¥${auditRefundableLeft.toFixed(2)}`" />
							<div style="margin-left:8px;color:#666;">剩余可退：¥{{ auditRefundableLeft.toFixed(2) }}</div>
						</el-form-item>
					</el-form>
				</template>
				<template v-else-if="auditRow?.type==='EXCHANGE'">
					<el-alert type="info" show-icon :closable="false" title="换货：审核通过后请在下方填写换货发货信息（独立于原订单发货）" style="margin:8px 0;" />
					<el-form label-width="96px" style="margin-top:8px;">
						<el-form-item label="无需快递">
							<el-switch v-model="exNoExpress" />
						</el-form-item>
						<template v-if="!exNoExpress">
							<el-form-item label="快递公司">
								<el-select v-model="exCompanyCode" filterable placeholder="选择快递">
									<el-option v-for="it in deliveryCompanies" :key="it.code" :label="it.name" :value="it.code" />
								</el-select>
							</el-form-item>
							<el-form-item label="运单号">
								<el-input v-model="exTrackingNo" placeholder="填写快递单号" />
							</el-form-item>
							<el-form-item label="寄件/收件隐私号" v-if="isSFCompany(exCompanyCode)">
								<div style="display:flex; gap:8px; align-items:center;">
									<el-input v-model="exSenderPhoneMasked" placeholder="寄件人隐私号（可选）" style="width:200px;" />
									<el-input v-model="exReceiverPhoneMasked" placeholder="收件人隐私号（可选）" style="width:200px;" />
								</div>
							</el-form-item>
						</template>
					</el-form>
				</template>
			</div>
			<template #footer>
				<el-button @click="auditDialog=false">取消</el-button>
				<el-button type="primary" :loading="auditSubmitting" :disabled="auditSubmitting" @click="confirmAudit">确认通过</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { BasePage } from '@wash/shared-ui';
import {
	orderControllerAuditAfterSales,
	orderControllerGet,
	orderControllerGetCompanies,
	orderControllerGetCompaniesFromTanshu,
	orderControllerListAfterSales,
	orderControllerShipExchange,
	orderControllerWechatRefund,
} from '@wash/api-client';
import { ElMessage } from 'element-plus';
import { Refresh, View, Check, Close } from '@element-plus/icons-vue';

const router = useRouter();

type Row = any;
const rows = ref<Row[]>([]);
const loading = ref(false);
const keyword = ref('');
const status = ref('');
const detailVisible = ref(false);
const current = ref<any>(null);
const auditDialog = ref(false);
const auditSubmitting = ref(false);
const auditRow = ref<any>(null);
const auditRefundMode = ref<'FULL'|'PART'>('FULL');
const auditRefundAmountText = ref<string>('');
const auditHasPartial = ref(false);
const auditRefundableLeft = ref(0);
// 换货发货表单
const exNoExpress = ref(false);
const exCompanyCode = ref<string>('');
const exTrackingNo = ref<string>('');
const exSenderPhoneMasked = ref<string>('');
const exReceiverPhoneMasked = ref<string>('');
const deliveryCompanies = ref<Array<{ code: string; name: string }>>([]);
function isSFCompany(code?: string){ const c = String(code||'').toUpperCase(); return c==='SF'; }

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

function headOrderNo(no?: string){ try{ const s=String(no||''); return s.slice(0, Math.max(0, s.length-6)); }catch{ return String(no||''); } }
function tailOrderNo(no?: string){ try{ const s=String(no||''); return s.slice(-6); }catch{ return ''; } }

function unwrapList(resp: unknown): any[] {
	// 兼容多种后端/SDK返回结构：数组 / {data:[]} / {data:{list:[]}} / {list:[]} / {items:[]}
	// 之所以需要兼容，是因为 OpenAPI 里该接口缺少明确 schema，生成的 SDK 类型不可靠。
	const r: any = resp as any;
	if (Array.isArray(r)) return r;
	if (Array.isArray(r?.data)) return r.data;
	if (Array.isArray(r?.data?.list)) return r.data.list;
	if (Array.isArray(r?.list)) return r.list;
	if (Array.isArray(r?.items)) return r.items;
	return [];
}

async function fetchList(){
	loading.value = true;
	try{
		const resp = await (orderControllerListAfterSales({ status: status.value || undefined } as any) as any);
		let data: any[] = unwrapList(resp);
		if (keyword.value.trim()){
			const kw = keyword.value.trim();
			data = data.filter(it => String(it?.order?.no||'').includes(kw) || String(it?.member?.phone||'').includes(kw));
		}
		rows.value = data;
	}catch(e:any){
		rows.value = [];
		ElMessage.error(String(e?.message || '售后列表加载失败'));
	}finally{
		loading.value = false;
	}
}

function openOrder(orderNo?: string){
    if (!orderNo) return;
    const href = router.resolve(`/orders/no/${encodeURIComponent(orderNo)}`).href;
    window.open(href, '_blank');
}
function view(row: any){ current.value = row; detailVisible.value = true; }
function openAudit(row: any){
    auditRow.value = row; auditDialog.value = true;
    auditRefundMode.value = 'FULL'; auditRefundAmountText.value = '';
    // 重置换货发货表单并拉取快递公司
    exNoExpress.value = false; exCompanyCode.value = ''; exTrackingNo.value = ''; exSenderPhoneMasked.value = ''; exReceiverPhoneMasked.value = '';
    if (row?.type==='EXCHANGE'){
        loadDeliveryCompanies(row);
    }
    // 预计算退款可用信息：拉取最新订单详情，避免使用旧数据
    (async ()=>{
        try{
            const ord0 = row?.order || {};
            const fresh:any = ord0?.id ? await (orderControllerGet(Number(ord0.id)) as any) : ord0;
            const rr = Array.isArray(fresh?.refundRecords) ? fresh.refundRecords : [];
            const successSum = rr.filter((r:any)=> r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
            auditHasPartial.value = successSum > 0;
            auditRefundableLeft.value = Math.max(0, Number(fresh?.payAmount||ord0?.payAmount||0) - successSum);
            // 若已发生部分退款，则默认切换为 PART，并禁用 FULL（UI 已禁用）
            if (auditHasPartial.value) auditRefundMode.value = 'PART';
        }catch{
            const ord = row?.order || {};
            const rr = Array.isArray(ord.refundRecords) ? ord.refundRecords : [];
            const successSum = rr.filter((r:any)=> r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
            auditHasPartial.value = successSum > 0;
            auditRefundableLeft.value = Math.max(0, Number(ord.payAmount||0) - successSum);
            if (auditHasPartial.value) auditRefundMode.value = 'PART';
        }
    })();
}
async function confirmAudit(){
    if (auditSubmitting.value) return;
    if (!auditRow.value) return;
    const afr = auditRow.value;

	// 审核通过：如为微信渠道，附带部分退款金额（若选择部分退款）
    let amountPayload: number | undefined = undefined;
    const ord0 = afr.order || {};
    if (afr.type==='REFUND' && (ord0.payMethod==='WECHAT_JSAPI' || ord0.payMethod==='WECHAT_MICROPAY')){
        if (auditRefundMode.value === 'FULL'){
            if (auditHasPartial.value){ ElMessage.error('已发生部分退款，不能再使用全额退款'); return; }
            amountPayload = Number(ord0.payAmount||0);
        } else {
            const raw = (auditRefundAmountText.value||'').trim().replace(',', '.');
            if (!/^\d+(\.\d{1,2})?$/.test(raw)) { ElMessage.error('金额格式不正确，最多保留2位小数'); return; }
            const v = Number(raw);
            if (!isFinite(v) || v < 0.01){ ElMessage.error('部分退款金额至少为0.01'); return; }
            if (v > auditRefundableLeft.value + 1e-6){ ElMessage.error('超出剩余可退金额'); return; }
            amountPayload = v;
        }
    }

    auditSubmitting.value = true;
	try{
		// 先审核通过
		await orderControllerAuditAfterSales(Number(afr.id), { body: { approve: true, amount: amountPayload } } as any);

		const ord = afr.order || {};
		if (afr.type==='REFUND' && ord.payMethod === 'WECHAT_JSAPI'){
			const amount = amountPayload; // FULL/PART 已在上方统一校验
			const resp:any = await (orderControllerWechatRefund(Number(ord.id), { body: { reason: '售后退款', amount } } as any) as any);
			if (resp?.ok){ ElMessage.success('退款已提交'); } else { ElMessage.error(resp?.error || '退款申请失败'); }
		} else if (afr.type==='REFUND' && ord.payMethod==='WECHAT_MICROPAY'){
			// 审核接口已触发渠道退款，这里不再重复调用退款接口
			ElMessage.success('已提交渠道退款');
		} else if (afr.type==='REFUND') {
			// 非微信：内部退款
			await orderControllerWechatRefund(Number(afr.orderId), { body: { reason: '售后退款' } } as any);
			ElMessage.success('已退款');
		} else if (afr.type==='EXCHANGE') {
			// 换货：提交换货发货信息（独立于订单原始发货）
			const body:any = { noExpress: !!exNoExpress.value };
			if (!exNoExpress.value){
				if (!exCompanyCode.value){ ElMessage.error('请选择快递公司'); return; }
				if (!exTrackingNo.value.trim()){ ElMessage.error('请填写运单号'); return; }
				body.companyCode = exCompanyCode.value; body.trackingNo = exTrackingNo.value; body.companyName = (deliveryCompanies.value.find(it=>it.code===exCompanyCode.value)?.name)||undefined;
				if (isSFCompany(exCompanyCode.value)){
					body.contactSenderPhoneMasked = exSenderPhoneMasked.value || undefined;
					body.contactReceiverPhoneMasked = exReceiverPhoneMasked.value || undefined;
				}
			}
			await orderControllerShipExchange(Number(afr.id), { body } as any);
			ElMessage.success('换货发货信息已提交');
		}

		auditDialog.value = false;
		await fetchList();
	}catch(e:any){
		ElMessage.error(String(e?.message || '操作失败'));
	}finally{
		auditSubmitting.value = false;
	}
}
async function audit(row: any, approve: boolean){
	try{
		await orderControllerAuditAfterSales(Number(row.id), { body: { approve } } as any);
		ElMessage.success('已提交');
		await fetchList();
	}catch(e:any){
		ElMessage.error(String(e?.message || '操作失败'));
	}
}

function addrDisplay(info: any){
	try{
		const a = typeof info === 'string' ? JSON.parse(info) : info;
		if (!a) return '-';
		const line1 = [a?.province, a?.city, a?.district, a?.street].filter(Boolean).join(' ');
		const line2 = [a?.detail, a?.name, a?.phone].filter(Boolean).join(' · ');
		return `${line1} ${line2 ? (' / ' + line2) : ''}`;
	}catch{ return '-'; }
}

async function loadDeliveryCompanies(row?: any){
    try{
        const ord = row?.order || {};
        const extra:any = ord?.shipExpressExtra || {};
        const editedOnce = !!extra?.editedOnce;
        const useWechat = ord?.payMethod === 'WECHAT_JSAPI' && !editedOnce;
        const list:any[] = useWechat
			? await (orderControllerGetCompanies() as any)
			: await (orderControllerGetCompaniesFromTanshu() as any);
        deliveryCompanies.value = Array.isArray(list) ? list : [];
    }catch{ deliveryCompanies.value = []; }
}

onMounted(fetchList);
</script>

<style scoped>
.order-tail{ font-weight: 700; font-size: 16px; margin-left:4px; }
</style>


