<template>
	<div>
		<h3>订单列表</h3>
		<div class="toolbar card">
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
		<el-table :data="list" border stripe size="small" style="width: 100%;border-radius:8px;overflow:hidden;">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="no" label="订单号" min-width="200">
				<template #default="{ row }">
					<span class="link" :class="{ deleted: !!row.deletedAt }" title="双击查看详情" @dblclick="openByNo(row.no)" @click="copyNo(row.no)">{{ row.no }}</span>
				</template>
			</el-table-column>
			<el-table-column label="类型" width="100">
				<template #default="{ row }"><el-tag :type="row.deletedAt ? 'info' : ''">{{ typeLabel(row.type) }}</el-tag></template>
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
			<el-table-column label="操作" width="400">
				<template #default="{ row }">
					<el-tooltip content="查看">
						<el-button text class="icon-btn" title="查看" @click="open(row.id)"><img class="icon" :src="SeeIcon" /></el-button>
					</el-tooltip>
					<el-button v-if="row.payStatus==='UNPAID' && !row.deletedAt" size="small" type="success" @click="openPay(row)">标记支付</el-button>
					<el-button v-if="row.payStatus==='PAID' && !row.deletedAt" size="small" type="warning" @click="openRefund(row)">退款</el-button>
					<!-- 商品履约：发货/收货 -->
					<el-button v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='PENDING' && !row.deletedAt" size="small" type="primary" @click="openShip(row)">发货</el-button>
					<el-button v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='SHIPPED' && !row.deletedAt" size="小" type="primary" @click="receive(row.id)">确认收货</el-button>
					<!-- 服务履约：开始/结束 -->
					<el-button v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='PENDING') && !row.deletedAt" size="small" type="primary" @click="startService(row.id)">开始服务</el-button>
					<el-button v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='IN_SERVICE' || row.fulfillmentStatus==='PENDING') && !row.deletedAt" size="small" type="success" @click="finishService(row.id)">结束服务</el-button>
					<el-popconfirm v-if="!row.deletedAt" title="确认删除（软删除）？" @confirm="close(row.id)">
						<template #reference>
							<el-tooltip content="删除">
								<el-button text class="icon-btn danger" title="删除"><img class="icon" :src="DeleteIcon" /></el-button>
							</el-tooltip>
						</template>
					</el-popconfirm>
					<el-popconfirm v-else title="确认恢复该订单？" @confirm="restore(row.id)"><template #reference><el-button size="small" type="warning">恢复</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

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
			<el-form label-width="80px">
				<el-form-item label="原因">
					<el-input v-model="refundReason" type="textarea" placeholder="可选，填写退款原因" :rows="3" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showRefund=false">取消</el-button>
				<el-button type="primary" @click="doRefund">确认退款</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showShipDialog" title="发货" width="520px">
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
			</div>
			<template #footer>
				<el-button @click="showShipDialog=false">取消</el-button>
				<el-button type="primary" @click="doShip">提交</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
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
function statusTagType(v?: string){ if(v==='CREATED') return 'info'; if(v==='PAID') return 'success'; if(v==='FULFILLED') return 'success'; if(v==='CLOSED') return 'warning'; if(v==='CANCELLED') return 'danger'; return '' as any; }
function payStatusLabel(v?: string){ if(v==='UNPAID') return '未支付'; if(v==='PAID') return '已支付'; if(v==='REFUNDED') return '已退款'; if(v==='CANCELLED') return '已作废'; return v || '-'; }
function payStatusTagType(v?: string){ if(v==='UNPAID') return 'info'; if(v==='PAID') return 'success'; if(v==='REFUNDED') return 'warning'; if(v==='CANCELLED') return 'danger'; return '' as any; }
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
const companies = ref<Array<{ code:string; name:string; logo?:string }>>([]);
const selectedCompanyCode = ref<string>('');
const selectedCompany = ref<{ code:string; name:string; logo?:string }|null>(null);
const trackingNo = ref('');

function openShip(row:any){
    shipOrderId.value = row?.id || null;
    shipMode.value = 'express';
    selectedCompanyCode.value = '';
    selectedCompany.value = null;
    trackingNo.value = '';
    showShipDialog.value = true;
    loadCompanies();
}

async function loadCompanies(){
    try { companies.value = await http('/orders/_logistics/companies'); } catch { companies.value = []; }
}

function onCompanyChange(code:string){
    selectedCompany.value = companies.value.find(c=>c.code===code) || null;
}

async function doShip(){
    if (!shipOrderId.value) return;
    if (shipMode.value === 'noExpress'){
        await http(`/orders/${shipOrderId.value}/ship`, { method:'POST', body:{ noExpress: true } });
        ElMessage.success('已标记为无需快递发货');
    } else {
        if (!selectedCompany.value || !trackingNo.value.trim()) { ElMessage.error('请选择快递公司并填写快递单号'); return; }
        await http(`/orders/${shipOrderId.value}/ship`, { method:'POST', body:{
            noExpress: false,
            companyCode: selectedCompany.value.code,
            companyName: selectedCompany.value.name,
            companyLogo: selectedCompany.value.logo || undefined,
            trackingNo: trackingNo.value.trim(),
        }});
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
function openRefund(row:any){ currentOrderId.value = row.id; refundReason.value = ''; showRefund.value = true; }
async function doRefund(){ if (!currentOrderId.value) return; await http(`/orders/${currentOrderId.value}/refund`, { method: 'POST', body: { reason: refundReason.value || undefined } }); ElMessage.success('已退款'); showRefund.value = false; await fetchList(); }

function resetFilters(){ keyword.value=''; type.value=''; scene.value=''; status.value=''; payStatus.value=''; createdAtRange.value=null; fetchList(); }

async function copyNo(no:string){ try { await navigator.clipboard.writeText(no); ElMessage.success('已复制订单号'); } catch { /* ignore */ } }

onMounted(fetchList);
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; gap:8px; }
.card{ background:#fff; border:1px solid #eee; border-radius:8px; padding:12px; }
.link{ color:#409EFF; cursor:pointer; }
.deleted{ text-decoration: line-through; opacity: .65; }
.icon-btn{ padding: 4px; min-width: auto; }
.icon-btn.danger{ color:#F56C6C; }
.icon{ width: 18px; height: 18px; object-fit: contain; display:inline-block; }
</style>


