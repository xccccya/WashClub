<template>
	<div>
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<div class="toolbar card no-wrap">
			<el-input v-model="keyword" placeholder="订单号/备注/手机号" style="width:260px;margin-right:8px;" @keyup.enter="fetchList" />
			<el-select v-model="type" placeholder="类型" style="width:140px;margin-right:8px;">
				<el-option label="全部" value="" />
				<el-option label="服务" value="SERVICE" />
				<el-option label="商品" value="SP" />
				<el-option label="付款" value="FK" />
			</el-select>
			<el-select v-model="scene" placeholder="场景筛选" style="width:160px;margin-right:8px;">
				<el-option label="无" value="" />
				<el-option label="待支付" value="PENDING_PAYMENT" />
				<el-option label="待发货（商品）" value="PENDING_DELIVERY" />
				<el-option label="待收货（商品）" value="PENDING_RECEIPT" />
				<el-option label="待服务（服务）" value="PENDING_SERVICE" />
				<el-option label="退款/售后" value="REFUND_AFTERSALE" />
				<el-option label="已完成" value="COMPLETED" />
				<el-option label="已取消" value="CANCELLED" />
				<el-option label="已删除" value="DELETED" />
			</el-select>
			<el-select v-model="status" placeholder="状态" style="width:140px;margin-right:8px;">
				<el-option label="全部" value="" />
				<el-option label="已创建" value="CREATED" />
				<el-option label="已支付" value="PAID" />
				<el-option label="已履约" value="FULFILLED" />
				<el-option label="已完成" value="CLOSED" />
				<el-option label="已取消" value="CANCELLED" />
			</el-select>
			<el-select v-model="payStatus" placeholder="支付状态" style="width:140px;margin-right:8px;">
				<el-option label="全部" value="" />
				<el-option label="未支付" value="UNPAID" />
				<el-option label="已支付" value="PAID" />
				<el-option label="已退款" value="REFUNDED" />
				<el-option label="已作废" value="CANCELLED" />
			</el-select>
			<el-date-picker
				v-model="createdAtRange"
				type="datetimerange"
				start-placeholder="开始时间"
				end-placeholder="结束时间"
				style="margin-right:8px;"
				value-format="YYYY-MM-DDTHH:mm:ssZ"
			/>
			<el-button type="primary" @click="fetchList">查询</el-button>
			<el-button @click="resetFilters">重置</el-button>
		</div>
		<div class="table-scroll"><el-table :data="list" border stripe size="small" style="min-width: 980px; width: 100%; border-radius:8px;overflow:hidden;">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="no" label="订单号" min-width="200">
				<template #default="{ row }">
					<span class="link" :class="{ deleted: !!row.deletedAt }" title="双击查看详情" @dblclick="openByNo(row.no)" @click="copyNo(row.no)">{{ row.no }}</span>
				</template>
			</el-table-column>
			<el-table-column label="类型" width="100">
				<template #default="{ row }"><el-tag :type="row.deletedAt ? 'info' : undefined">{{ typeLabel(row.type) }}</el-tag></template>
			</el-table-column>
			<el-table-column label="状态" width="100">
				<template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
			</el-table-column>
			<el-table-column label="履约状态" width="120">
				<template #default="{ row }"><el-tag type="info">{{ fulfillLabel(row.fulfillmentStatus) }}</el-tag></template>
			</el-table-column>
			<el-table-column label="支付状态" width="100">
				<template #default="{ row }"><el-tag :type="payStatusTagType(row.payStatus)">{{ payStatusLabel(row.payStatus) }}</el-tag></template>
			</el-table-column>
            <el-table-column label="售后/退款" width="100">
                <template #default="{ row }">
                    <el-tag v-if="Array.isArray((row as any).afterSalesRequests) && (row as any).afterSalesRequests.some((x:any)=>x.status==='PENDING'||x.status==='APPROVED')" type="warning">售后中</el-tag>
                    <span v-else>-</span>
                </template>
            </el-table-column>
			<el-table-column label="支付方式" width="120">
				<template #default="{ row }">{{ payMethodLabel(row.payMethod) }}</template>
			</el-table-column>
			<el-table-column prop="totalAmount" label="订单总额" width="120" />
			<el-table-column prop="payAmount" label="支付金额" width="120" />
			<el-table-column prop="createdAt" label="下单时间" width="170">
				<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column prop="paidAt" label="支付时间" width="170">
				<template #default="{ row }">{{ formatDate(row.paidAt) }}</template>
			</el-table-column>
			<el-table-column label="会员" min-width="200">
				<template #default="{ row }">
					<span>UID: {{ row.member?.uid || '-' }} / ID: {{ row.memberId }}</span>
					<br />
					<span>{{ row.member?.name || '-' }}（{{ row.member?.phone || '-' }}）</span>
				</template>
			</el-table-column>
			<el-table-column prop="remark" label="备注" min-width="160" />
			<el-table-column label="操作" width="400" fixed="right">
				<template #default="{ row }">
					<el-tooltip content="查看">
						<el-button text class="icon-btn" title="查看" @click="open(row.id)"><img class="icon" :src="SeeIcon" /></el-button>
					</el-tooltip>
					<el-button v-if="row.payStatus==='UNPAID' && !row.deletedAt" size="small" type="success" @click="openPay(row)">标记支付</el-button>
					<el-button v-if="row.payStatus==='PAID' && !row.deletedAt" size="small" type="warning" @click="openRefund(row)">退款</el-button>
					<!-- 商品履约：发货/收货 -->
					<el-button v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='PENDING' && !row.deletedAt" size="small" type="primary" @click="openShip(row)">发货</el-button>
					<el-button v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='SHIPPED' && !row.deletedAt" size="小" type="primary" @click="receive(row.id)">确认收货</el-button>
					<el-button v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='SHIPPED' && row.payMethod==='WECHAT_JSAPI' && !row.deletedAt" size="small" @click="openEditTracking(row)">修改物流单号</el-button>
					<!-- 服务履约：开始/结束 -->
					<el-button v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='PENDING') && !row.deletedAt" size="small" type="primary" @click="startService(row.id)">开始服务</el-button>
					<el-button v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='IN_SERVICE' || row.fulfillmentStatus==='PENDING') && !row.deletedAt" size="small" type="success" @click="finishService(row.id)">结束服务{{ row.payMethod==='WECHAT_JSAPI' ? '（上报小程序）' : '' }}</el-button>
					<el-popconfirm v-if="!row.deletedAt" title="确认删除（软删除）？" @confirm="close(row.id)">
						<template #reference>
							<el-button text class="icon-btn danger" title="删除"><img class="icon" :src="DeleteIcon" /></el-button>
						</template>
					</el-popconfirm>
					<el-popconfirm v-else title="确认恢复该订单？" @confirm="restore(row.id)"><template #reference><el-button size="small" type="warning">恢复</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
		</el-table></div>

		<el-dialog v-model="showPay" title="手动确认支付" width="420px">
			<el-select v-model="payMethod" placeholder="支付方式" style="width: 100%">
				<el-option label="现金" value="CASH" />
				<el-option label="收钱吧" value="SHOUQIANBA" />
				<el-option label="线下其他" value="OFFLINE" />
			</el-select>
			<template #footer>
				<el-button @click="showPay=false">取消</el-button>
				<el-button type="primary" @click="doMarkPaid">确认支付</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showRefund" title="退款确认" width="520px">
			<el-form label-width="96px">
				<template v-if="currentOrder && currentOrder.payMethod==='WECHAT_JSAPI'">
					<el-form-item label="退款方式">
						<el-radio-group v-model="refundMode">
							<el-radio label="FULL" :disabled="hasPartialRefund">全额退款</el-radio>
							<el-radio label="PART">部分退款</el-radio>
						</el-radio-group>
					</el-form-item>
					<el-form-item v-if="refundMode==='PART'" label="退款金额">
						<el-input v-model="refundAmountText" inputmode="decimal" :placeholder="`输入金额，最低0.01，最高¥${refundableLeft.toFixed(2)}`" />
						<div style="margin-left:8px;color:#666;">剩余可退：¥{{ refundableLeft.toFixed(2) }}</div>
					</el-form-item>
				</template>
				<el-form-item label="原因">
					<el-input v-model="refundReason" type="textarea" placeholder="可选，填写退款原因" :rows="3" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showRefund=false">取消</el-button>
				<el-button type="primary" @click="doRefund">确认退款</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showShipDialog" :title="shipDialogTitle" width="560px">
			<el-radio-group v-model="shipMode" style="margin-bottom:12px;">
				<el-radio label="express">快递发货</el-radio>
				<el-radio label="noExpress">无需快递发货</el-radio>
			</el-radio-group>
			<div v-if="shipMode==='express'">
				<div style="margin-bottom:10px;">
					<el-select v-model="selectedCompanyCode" placeholder="选择快递公司" style="width:100%;" filterable @change="onCompanyChange">
						<el-option v-for="c in companies" :key="c.code" :label="c.name" :value="c.code">
							<div style="display:flex;align-items:center;gap:8px;">
								<img v-if="c.logo" :src="c.logo" style="width:18px;height:18px;object-fit:contain;" />
								<span>{{ c.name }}</span>
							</div>
						</el-option>
					</el-select>
				</div>
				<el-input v-model="trackingNo" placeholder="快递单号" />
				<div v-if="isSF" style="margin-top:10px;">
					<div style="color:#909399; font-size:12px; margin-bottom:6px;">顺丰要求提供寄件人或收件人联系方式（掩码规则：手机号中间四位用*替代，如 138****1234）</div>
					<el-input v-model="contactSenderMasked" placeholder="寄件人手机号（掩码，可选，二选一）" style="margin-bottom:6px;" />
					<el-input v-model="contactReceiverMasked" placeholder="收件人手机号（掩码，可选，二选一）" />
				</div>
			</div>
			<template #footer>
				<el-button @click="showShipDialog=false">取消</el-button>
				<el-button type="primary" @click="doShip">提交</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showEditTrackingDialog" title="修改物流单号（仅一次）" width="460px">
			<el-input v-model="editTrackingNo" placeholder="新物流单号" />
			<div style="margin-top:10px;">
				<div style="margin-bottom:6px;">（可选）更新快递公司</div>
				<el-select v-model="selectedCompanyCode" placeholder="选择快递公司" style="width:100%;" filterable @change="onCompanyChange">
					<el-option v-for="c in companies" :key="c.code" :label="c.name" :value="c.code">
						<div style="display:flex;align-items:center;gap:8px;">
							<img v-if="c.logo" :src="c.logo" style="width:18px;height:18px;object-fit:contain;" />
							<span>{{ c.name }}</span>
						</div>
					</el-option>
				</el-select>
			</div>
			<div v-if="editIsSF" style="margin-top:10px;">
				<div style="color:#909399; font-size:12px; margin-bottom:6px;">顺丰要求提供寄件人或收件人联系方式（掩码规则：手机号中间四位用*替代，如 138****1234）</div>
				<el-input v-model="contactSenderMasked" placeholder="寄件人手机号（掩码，可选，二选一）" style="margin-bottom:6px;" />
				<el-input v-model="contactReceiverMasked" placeholder="收件人手机号（掩码，可选，二选一）" />
			</div>
			<template #footer>
				<el-button @click="showEditTrackingDialog=false">取消</el-button>
				<el-button type="primary" @click="doEditTracking">提交</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import SeeIcon from '../static/icons/see.png';
import DeleteIcon from '../static/icons/delete.png';

const router = useRouter();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const list = ref<any[]>([]);
const keyword = ref('');
const type = ref<string | ''>('');
const scene = ref<string | ''>('');
const status = ref<string | ''>('');
const payStatus = ref<string | ''>('');
const createdAtRange = ref<[string, string] | null>(null);

function formatDate(val: string | null | undefined){
	if(!val) return '-';
	try{ return new Date(val).toLocaleString(); }catch{ return String(val); }
}

function typeLabel(v?: string){ if(v==='SERVICE') return '服务订单'; if(v==='SP') return '商品订单'; if(v==='FK') return '付款订单'; return v || '-'; }
function statusLabel(v?: string){ if(v==='CREATED') return '已创建'; if(v==='PAID') return '已支付'; if(v==='FULFILLED') return '已履约'; if(v==='CLOSED') return '已完成'; if(v==='CANCELLED') return '已取消'; return v || '-'; }
function statusTagType(v?: string){ if(v==='CREATED') return 'info'; if(v==='PAID') return 'success'; if(v==='FULFILLED') return 'success'; if(v==='CLOSED') return 'warning'; if(v==='CANCELLED') return 'danger'; return undefined as any; }
function payStatusLabel(v?: string){ if(v==='UNPAID') return '未支付'; if(v==='PAID') return '已支付'; if(v==='REFUNDED') return '已退款'; if(v==='CANCELLED') return '已作废'; return v || '-'; }
function payStatusTagType(v?: string){ if(v==='UNPAID') return 'info'; if(v==='PAID') return 'success'; if(v==='REFUNDED') return 'warning'; if(v==='CANCELLED') return 'danger'; return undefined as any; }
function payMethodLabel(v?: string | null){ if(!v) return '-'; if(v==='CASH') return '现金'; if(v==='SHOUQIANBA') return '收钱吧'; if(v==='OFFLINE') return '线下其他'; return v; }
function fulfillLabel(v?: string){ if(!v) return '-'; if(v==='NONE') return '不需履约'; if(v==='PENDING') return '待履约/待发货'; if(v==='SHIPPED') return '已发货'; if(v==='RECEIVED') return '已收货'; if(v==='IN_SERVICE') return '服务中'; if(v==='DONE') return '服务完成'; return v; }

async function fetchList(){
	const start = createdAtRange.value?.[0];
	const end = createdAtRange.value?.[1];
	list.value = await http('/orders', { query: {
		keyword: keyword.value || undefined,
		type: type.value || undefined,
		scene: scene.value || undefined,
		status: status.value || undefined,
		payStatus: payStatus.value || undefined,
		includeDeleted: true,
		start: start || undefined,
		end: end || undefined,
	} });
}
function open(id:number){ router.push(`/orders/${id}`); }
function openByNo(no:string){ router.push(`/orders/no/${encodeURIComponent(no)}`); }
async function close(id:number){ await http(`/orders/${id}/close`, { method:'POST' }); ElMessage.success('已关闭'); await fetchList(); }
async function restore(id:number){ await http(`/orders/${id}/restore`, { method:'POST' }); ElMessage.success('已恢复'); await fetchList(); }

// 履约操作
// 发货弹窗与逻辑
const showShipDialog = ref(false);
const shipOrderId = ref<number|null>(null);
const shipMode = ref<'noExpress'|'express'>('express');
const shipDialogTitle = computed(()=>{
    const row = list.value.find(x=> x.id===shipOrderId.value);
    return row && row.payMethod==='WECHAT_JSAPI' ? '发货（已接入小程序发货接口）' : '发货';
});
const companies = ref<Array<{ code:string; name:string; logo?:string }>>([]);
const selectedCompanyCode = ref<string>('');
const selectedCompany = ref<{ code:string; name:string; logo?:string }|null>(null);
const trackingNo = ref('');
const contactSenderMasked = ref('');
const contactReceiverMasked = ref('');
const isSF = computed(()=>{
    const code = String(selectedCompanyCode.value||'').toUpperCase();
    const name = String(selectedCompany.value?.name||'');
    return code==='SF' || /顺丰/.test(name);
});

// 修改物流单号（仅一次）
const showEditTrackingDialog = ref(false);
const editTrackingOrderId = ref<number|null>(null);
const editTrackingNo = ref('');
const editIsSF = computed(()=>{
    const row = list.value.find(x=>x.id===editTrackingOrderId.value);
    const code = String(row?.shipExpressCompanyCode||'').toUpperCase();
    const name = String(row?.shipExpressCompanyName||'');
    return code==='SF' || /顺丰/.test(name);
});
async function openEditTracking(row:any){ editTrackingOrderId.value = row?.id||null; editTrackingNo.value=''; contactSenderMasked.value=''; contactReceiverMasked.value=''; showEditTrackingDialog.value=true; }
async function doEditTracking(){
    if(!editTrackingOrderId.value){ return; }
    if(!editTrackingNo.value.trim()){ ElMessage.error('请输入新物流单号'); return; }
    const row = list.value.find(x=>x.id===editTrackingOrderId.value);
    if (row && row.payMethod !== 'WECHAT_JSAPI'){ ElMessage.error('非微信支付订单不支持修改物流单号'); return; }
    const body:any = { trackingNo: editTrackingNo.value.trim() };
    if (selectedCompany.value){
        body.companyCode = selectedCompany.value.code;
        body.companyName = selectedCompany.value.name;
        body.companyLogo = selectedCompany.value.logo || undefined;
    }
    const code = String(row?.shipExpressCompanyCode||'').toUpperCase();
    const name = String(row?.shipExpressCompanyName||'');
    const isSf2 = code==='SF' || /顺丰/.test(name);
    if (isSf2){
        if (!contactSenderMasked.value && !contactReceiverMasked.value){ ElMessage.error('顺丰需二选一填写寄件人或收件人联系方式（掩码）'); return; }
        body.contactSenderPhoneMasked = contactSenderMasked.value || undefined;
        body.contactReceiverPhoneMasked = contactReceiverMasked.value || undefined;
    }
    await http(`/orders/${editTrackingOrderId.value}/ship/edit-tracking`, { method:'POST', body });
    ElMessage.success('已修改'); showEditTrackingDialog.value=false; await fetchList();
}

function openShip(row:any){
    shipOrderId.value = row?.id || null;
    shipMode.value = 'express';
    selectedCompanyCode.value = '';
    selectedCompany.value = null;
    trackingNo.value = '';
    contactSenderMasked.value = '';
    contactReceiverMasked.value = '';
    showShipDialog.value = true;
    loadCompanies();
}

async function loadCompanies(){
    try {
        const row = list.value.find(x=> x.id===shipOrderId.value);
        const url = row && row.payMethod==='WECHAT_JSAPI' ? '/orders/_logistics/companies' : '/orders/_logistics/companies/tanshu';
        companies.value = await http(url);
    } catch { companies.value = []; }
}

function onCompanyChange(code:string){
    selectedCompany.value = companies.value.find(c=>c.code===code) || null;
}

async function doShip(){
    if (!shipOrderId.value) return;
    const row = list.value.find(x=> x.id===shipOrderId.value);
    if (shipMode.value === 'noExpress'){
        await http(`/orders/${shipOrderId.value}/ship`, { method:'POST', body:{ noExpress: true } });
        ElMessage.success('已标记为无需快递发货');
    } else {
        if (!selectedCompany.value || !trackingNo.value.trim()) { ElMessage.error('请选择快递公司并填写快递单号'); return; }
        const body:any = {
            noExpress: false,
            companyCode: selectedCompany.value.code,
            companyName: selectedCompany.value.name,
            companyLogo: selectedCompany.value.logo || undefined,
            trackingNo: trackingNo.value.trim(),
        };
        if (isSF.value){
            if (!contactSenderMasked.value && !contactReceiverMasked.value){ ElMessage.error('顺丰需二选一填写寄件人或收件人联系方式（掩码）'); return; }
            body.contactSenderPhoneMasked = contactSenderMasked.value || undefined;
            body.contactReceiverPhoneMasked = contactReceiverMasked.value || undefined;
        }
        // 非微信支付订单：仅内部发货，不提示“已接入”
        await http(`/orders/${shipOrderId.value}/ship`, { method:'POST', body });
        ElMessage.success('已提交发货信息');
    }
    showShipDialog.value = false;
    await fetchList();
}
async function receive(id:number){ await http(`/orders/${id}/receive`, { method:'POST' }); ElMessage.success('已收货'); await fetchList(); }
async function startService(id:number){ await http(`/orders/${id}/start-service`, { method:'POST' }); ElMessage.success('已开始服务'); await fetchList(); }
async function finishService(id:number){ await http(`/orders/${id}/finish-service`, { method:'POST' }); ElMessage.success('已结束服务'); await fetchList(); }

const showPay = ref(false);
const currentOrderId = ref<number | null>(null);
const payMethod = ref<'CASH'|'SHOUQIANBA'|'OFFLINE'|'CASH'>('CASH');
function openPay(row:any){ currentOrderId.value = row.id; payMethod.value = 'CASH'; showPay.value = true; }
async function doMarkPaid(){ if (!currentOrderId.value) return; await http(`/orders/${currentOrderId.value}/pay/manual`, { method:'POST', body: { method: payMethod.value } }); ElMessage.success('已标记为已支付'); showPay.value = false; await fetchList(); }

const showRefund = ref(false);
const refundReason = ref('');
const refundMode = ref<'FULL'|'PART'>('FULL');
const refundAmountText = ref<string>('');
const currentOrder = ref<any>(null);
const refundableLeft = ref(0);
const hasPartialRefund = ref(false);
async function openRefund(row:any){
    currentOrderId.value = row.id;
    try{ currentOrder.value = await http(`/orders/${row.id}`); }catch{ currentOrder.value = row; }
    refundReason.value = '';
    refundMode.value = 'FULL';
    refundAmountText.value = '';
    // 计算已成功部分退款累计
    const rr = Array.isArray((currentOrder.value as any)?.refundRecords) ? (currentOrder.value as any).refundRecords : [];
    const successSum = rr.filter((r:any)=> r.status==='SUCCESS').reduce((s:number,r:any)=> s + Number(r.amount||0), 0);
    const payAmt = Number((currentOrder.value as any).payAmount||0);
    const left = Math.max(0, payAmt - successSum);
    refundableLeft.value = left;
    hasPartialRefund.value = successSum > 0;
    showRefund.value = true;
}
async function doRefund(){
    if (!currentOrderId.value) return;
    const row = currentOrder.value;
    if (row?.payMethod === 'WECHAT_JSAPI'){
        let amount: number | undefined = undefined;
        if (refundMode.value === 'FULL'){
            if (hasPartialRefund.value){ ElMessage.error('已发生部分退款，不能再使用全额退款'); return; }
            amount = Number(row.payAmount||0);
        } else {
            const raw = (refundAmountText.value||'').trim().replace(',', '.');
            if (!/^\d+(\.\d{1,2})?$/.test(raw)) { ElMessage.error('金额格式不正确，最多保留2位小数'); return; }
            const v = Number(raw);
            if (!isFinite(v) || v < 0.01){ ElMessage.error('部分退款金额至少为0.01'); return; }
            if (v > refundableLeft.value + 1e-6){ ElMessage.error('超出剩余可退金额'); return; }
            amount = v;
        }
        const resAny: any = await http(`/orders/${currentOrderId.value}/refund/wechat`, { method:'POST', body: { reason: refundReason.value || undefined, amount } });
        if (resAny && resAny.ok){ ElMessage.success('退款已提交'); } else { ElMessage.error((resAny && resAny.error) || '退款申请失败'); }
    } else {
        // 非微信渠道：仅支持一次性内部退款
        const res = await http(`/orders/${currentOrderId.value}/refund`, { method:'POST', body: { reason: refundReason.value || undefined } });
        if ((res as any)?.id){ ElMessage.success('已退款'); }
    }
    showRefund.value = false;
    await fetchList();
}

function resetFilters(){ keyword.value=''; type.value=''; scene.value=''; status.value=''; payStatus.value=''; createdAtRange.value=null; fetchList(); }

async function copyNo(no:string){ try { await navigator.clipboard.writeText(no); ElMessage.success('已复制订单号'); } catch { /* ignore */ } }

onMounted(fetchList);
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; gap:8px; width:100%; }
.no-wrap{ flex-wrap: wrap; }
.card{ background:#fff; border:1px solid #eee; border-radius:8px; padding:12px; }
.table-scroll{ overflow:auto; width:100%; }
.link{ color: var(--app-primary); cursor:pointer; }
.deleted{ text-decoration: line-through; opacity: .65; }
.icon-btn{ padding: 4px; min-width: auto; }
.icon-btn.danger{ color:#F56C6C; }
.icon{ width: 18px; height: 18px; object-fit: contain; display:inline-block; }
</style>


