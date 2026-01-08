<template>
	<div class="pos-orders">
		<div class="toolbar card no-wrap sticky-toolbar">
			<el-input v-model="keyword" placeholder="订单号/备注/手机号" class="filter-input" @keyup.enter="fetchList" />
			<el-select v-model="type" placeholder="类型" class="filter-select">
				<el-option label="全部" value="" />
				<el-option label="服务" value="SERVICE" />
				<el-option label="商品" value="SP" />
				<el-option label="付款" value="FK" />
			</el-select>
			<el-select v-model="scene" placeholder="场景筛选" class="filter-select wide">
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
			<el-select v-model="status" placeholder="状态" class="filter-select">
				<el-option label="全部" value="" />
				<el-option label="已创建" value="CREATED" />
				<el-option label="已支付" value="PAID" />
				<el-option label="已履约" value="FULFILLED" />
				<el-option label="已完成" value="CLOSED" />
				<el-option label="已取消" value="CANCELLED" />
			</el-select>
			<el-select v-model="payStatus" placeholder="支付状态" class="filter-select">
				<el-option label="全部" value="" />
				<el-option label="未支付" value="UNPAID" />
				<el-option label="已支付" value="PAID" />
				<el-option label="已退款" value="REFUNDED" />
				<el-option label="已作废" value="CANCELLED" />
			</el-select>
			<el-date-picker v-model="createdAtRange" type="datetimerange" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DDTHH:mm:ssZ" class="filter-date" />
			<el-button type="primary" size="large" @click="fetchList">查询</el-button>
			<el-button size="large" @click="resetFilters">重置</el-button>
		</div>
		<div class="table-scroll">
			<el-table :data="paged" border stripe size="large" class="orders-table" :row-class-name="ordersRowClass">
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column prop="no" label="订单号" min-width="260">
					<template #default="{ row }">
						<span class="link" :class="{ deleted: !!row.deletedAt }" title="点击查看详情" @click="openByNo(row.no)">{{ row.no }}</span>
					</template>
				</el-table-column>
				<el-table-column label="类型" width="120" class-name="col-type">
					<template #default="{ row }"><el-tag :type="row.deletedAt ? 'info' : undefined">{{ typeLabel(row.type) }}</el-tag></template>
				</el-table-column>
				<el-table-column label="状态" width="120">
					<template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
				</el-table-column>
				<el-table-column label="支付状态" width="130">
					<template #default="{ row }">
						<div class="cell-flex">
							<el-tag v-if="!(row.payStatus==='UNPAID' && remainSeconds(row)>0)" :type="payStatusTagType(row.payStatus)">{{ payStatusLabel(row.payStatus) }}</el-tag>
							<el-tag v-if="row.payStatus==='UNPAID' && remainSeconds(row)>0" type="warning" effect="light">倒计时 {{ formatRemain(remainSeconds(row)) }}</el-tag>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="支付方式" width="140">
					<template #default="{ row }">{{ payMethodLabel(row.payMethod) }}</template>
				</el-table-column>
				<el-table-column prop="totalAmount" label="订单总额" width="140" align="right">
					<template #default="{ row }"><span class="money money--total"><span class="unit">¥</span>{{ money(row.totalAmount) }}</span></template>
				</el-table-column>
				<el-table-column prop="payAmount" label="支付金额" width="140" align="right">
					<template #default="{ row }"><span class="money money--pay"><span class="unit">¥</span>{{ money(row.payAmount) }}</span></template>
				</el-table-column>
				<el-table-column prop="createdAt" label="下单时间" width="200">
					<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
				</el-table-column>
				<el-table-column prop="paidAt" label="支付时间" width="200">
					<template #default="{ row }">{{ formatDate(row.paidAt) }}</template>
				</el-table-column>
				<el-table-column label="会员" min-width="220">
					<template #default="{ row }">
						<span>UID: {{ row.member?.uid || '-' }} / ID: {{ row.memberId }}</span>
						<br />
						<span>{{ row.member?.name || '-' }}（<span v-if="row.member?.phone">****<span class="phone-tail">{{ last4(row.member?.phone) }}</span></span><span v-else>-</span>）</span>
					</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" min-width="200" :show-overflow-tooltip="true" />
				<el-table-column label="操作" width="180" fixed="right">
					<template #default="{ row }">
						<div class="op-actions">
							<el-button text class="icon-btn large-hit" @click="open(row.id)"><el-icon><View /></el-icon></el-button>
							<el-dropdown trigger="click" placement="bottom-end">
								<span class="dropdown-ref"><el-button text class="icon-btn large-hit"><el-icon><MoreFilled /></el-icon></el-button></span>
								<template #dropdown>
									<el-dropdown-menu>
										<el-dropdown-item v-if="row.payStatus==='UNPAID' && !row.deletedAt" @click="openPay(row)"><el-icon style="margin-right:6px;"><Wallet /></el-icon>标记支付</el-dropdown-item>
										<el-dropdown-item v-if="row.payStatus==='PAID' && !row.deletedAt" @click="openRefund(row)"><el-icon style="margin-right:6px;"><Money /></el-icon>退款</el-dropdown-item>
										<el-dropdown-item v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='PENDING' && !row.deletedAt" @click="openShip(row)"><el-icon style="margin-right:6px;"><Promotion /></el-icon>发货</el-dropdown-item>
										<el-dropdown-item v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='SHIPPED' && !row.deletedAt" @click="receive(row.id)"><el-icon style="margin-right:6px;"><Finished /></el-icon>确认收货</el-dropdown-item>
										<el-dropdown-item v-if="row.type==='SP' && row.payStatus==='PAID' && row.fulfillmentStatus==='SHIPPED' && row.payMethod==='WECHAT_JSAPI' && !row.deletedAt" @click="openEditTracking(row)"><el-icon style="margin-right:6px;"><EditPen /></el-icon>修改物流单号</el-dropdown-item>
										<el-dropdown-item v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='PENDING') && !row.deletedAt" @click="startService(row.id)"><el-icon style="margin-right:6px;"><Timer /></el-icon>开始服务</el-dropdown-item>
										<el-dropdown-item v-if="row.type==='SERVICE' && row.payStatus==='PAID' && (row.fulfillmentStatus==='IN_SERVICE' || row.fulfillmentStatus==='PENDING') && !row.deletedAt" @click="finishService(row.id)"><el-icon style="margin-right:6px;"><SuccessFilled /></el-icon>结束服务</el-dropdown-item>
										<el-dropdown-item v-if="canWriteoff() && !row.deletedAt" @click="writeoff(row)"><el-icon style="margin-right:6px;"><Delete /></el-icon>作废/红冲</el-dropdown-item>
										<el-dropdown-item v-if="row.deletedAt" @click="restore(row.id)">恢复</el-dropdown-item>
									</el-dropdown-menu>
								</template>
							</el-dropdown>
							<el-popconfirm v-if="!row.deletedAt" title="确认删除（软删除）？" @confirm="close(row.id)">
								<template #reference>
									<span class="popconfirm-ref"><el-button text class="icon-btn danger large-hit"><el-icon><Delete /></el-icon></el-button></span>
								</template>
							</el-popconfirm>
							<el-popconfirm v-else title="确认恢复该订单？" @confirm="restore(row.id)"><template #reference><el-button size="large" type="warning">恢复</el-button></template></el-popconfirm>
						</div>
					</template>
				</el-table-column>
			</el-table>
		</div>
		<div class="pager-bar">
			<el-pagination
				v-model:current-page="currentPage"
				v-model:page-size="pageSize"
				:page-sizes="[10, 20, 30, 50, 100]"
				layout="total, sizes, prev, pager, next, jumper"
				:total="list.length"
				@size-change="onSizeChange"
				@current-change="onPageChange"
			/>
		</div>

		<!-- 标记支付 -->
		<el-dialog v-model="showPay" title="手动确认支付" width="560px">
			<el-tabs v-model="payTab">
				<el-tab-pane label="常规方式" name="manual">
					<el-select v-model="payMethod" placeholder="支付方式" style="width: 100%">
						<el-option label="现金" value="CASH" />
						<el-option label="收钱吧" value="SHOUQIANBA" />
						<el-option label="线下其他" value="OFFLINE" />
					</el-select>
					<div v-if="orderForPay" style="margin-top:12px; display:flex; align-items:center; gap:8px;">
						<div style="flex:0 0 auto; color:#606266;">收银立减</div>
						<el-input-number v-model="cashierDiscountInput" :min="0" :max="payAmountCap" :step="0.01" :precision="2" :controls="false" size="small" style="width: 140px;" @change="onManualDiscountChange" />
						<div style="flex:1; color:#909399; font-size:12px;">最多可减至 0 元；0 元仅支持内部支付</div>
					</div>
					<div v-if="orderForPay" style="margin-top:6px; text-align:right; color:#303133;">应收：<b>¥{{ payAmountAfterManual.toFixed(2) }}</b></div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" @click="doMarkPaid">确认支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane label="微信付款码" name="wx">
					<el-input v-model="wxAuthCode" placeholder="请扫描/输入顾客微信付款码" maxlength="24" />
					<div style="margin-top:8px;">
						<el-button @click="openScan">打开摄像头识别</el-button>
						<el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="onSelectImage">
							<el-button>从图片识别</el-button>
						</el-upload>
					</div>
					<!-- 隐藏 video/canvas 以启用摄像头识别流程 -->
					<video ref="videoRef" style="display:none; width:0; height:0;" playsinline muted></video>
					<canvas ref="canvasRef" style="display:none;"></canvas>
					<div style="color:#909399;font-size:12px; margin-top:6px;">提示：仅用于线下收银，成功后订单将自动标记已支付。</div>
					<div v-if="orderForPay" style="margin-top:6px; display:flex; justify-content:space-between; align-items:center; color:#303133;">
						<div>应收：<b>¥{{ payAmountAfterManual.toFixed(2) }}</b></div>
						<div v-if="payAmountAfterManual<=0" style="color:#f56c6c; font-size:12px;">零元订单不支持微信付款码</div>
					</div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" :loading="wxPayLoading" :disabled="payAmountAfterManual<=0" @click="doWxMicropay">发起付款码支付</el-button>
					</div>
				</el-tab-pane>
                <el-tab-pane label="洗车卡划扣" name="wash">
                    <el-form label-width="92px" style="margin-bottom:8px;">
                        <el-form-item label="付款会员">
                            <div style="display:flex; gap:6px; width:100%;">
                                <el-input v-model="payerMemberKeyword" placeholder="手机号/昵称（可留空自动）" clearable />
                                <el-button @click="searchPayerMember">搜索</el-button>
                            </div>
                        </el-form-item>
                        <el-form-item v-if="payerMemberList.length" label="选择会员">
                            <el-select v-model="payerMemberId" placeholder="选择付款会员" filterable style="width:100%;">
                                <el-option v-for="m in payerMemberList" :key="m.id" :label="memberLabel(m)" :value="m.id" />
                            </el-select>
                        </el-form-item>
                        <el-form-item v-if="payerMemberId" label="选择卡片">
                            <el-select v-model="payerCardId" placeholder="选择指定卡（可留空自动在该会员名下选择）" style="width:100%;">
                                <el-option v-for="c in payerCards" :key="c.key" :label="c.label" :value="c.value" />
                            </el-select>
                        </el-form-item>
                    </el-form>
                    <div style="color:#606266; font-size:13px; line-height:1.6; background:#f9fafb; padding:8px 10px; border-radius:6px; border:1px dashed #e5e7eb; margin-bottom:8px;">
						系统会自动识别本订单中标记为"计为洗车(次)"的服务商品数量作为需要扣减的次数，并从车辆所属集团或会员的洗车卡中优先扣减。次数不可手动修改。
					</div>
					<el-radio-group v-model="washPrefer" size="small">
						<el-radio-button value="AUTO">自动选择</el-radio-button>
						<el-radio-button value="GROUP">优先集团卡</el-radio-button>
						<el-radio-button value="MEMBER">优先会员卡</el-radio-button>
					</el-radio-group>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" @click="doWashDeduct">确认划扣并支付</el-button>
					</div>
				</el-tab-pane>
			</el-tabs>
		</el-dialog>

		<!-- 退款 -->
		<el-dialog v-model="showRefund" title="退款确认" width="520px">
			<el-form label-width="96px">
				<el-form-item label="退款方式">
					<el-radio-group v-model="refundMode">
						<el-radio value="FULL">全额退款</el-radio>
						<el-radio value="PART">部分退款</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item v-if="refundMode==='PART'" label="退款金额">
					<el-input v-model="refundAmountText" inputmode="decimal" :placeholder="'输入金额，最低0.01'" />
				</el-form-item>
				<el-form-item label="原因"><el-input v-model="refundReason" type="textarea" placeholder="可选，填写退款原因" :rows="3" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="showRefund=false">取消</el-button>
				<el-button type="primary" @click="doRefund">确认退款</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts" name="Orders">
import { ref, onMounted, onUnmounted, computed, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MoreFilled } from '@element-plus/icons-vue';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { memberControllerList, orderControllerGet, orderControllerAdjustCashierDiscount, orderControllerMarkPaid, orderControllerWechatMicropay, orderControllerPayByWashCard, orderControllerWriteoff, orderControllerWechatRefund, orderControllerList, orderControllerReceive, orderControllerStartService, orderControllerFinishService, orderControllerShip, orderControllerClose, orderControllerRestore, washCardControllerAdminList } from '@wash/api-client';

const router = useRouter();
const list = ref<any[]>([]);
const keyword = ref('');
const type = ref<string | ''>('');
const scene = ref<string | ''>('');
const status = ref<string | ''>('');
const payStatus = ref<string | ''>('');
const createdAtRange = ref<[string, string] | null>(null);
const nowTick = ref(0);
let tickTimer: any = null;

const currentPage = ref(1);
const pageSize = ref(10);
const paged = computed(()=>{
	const start = (currentPage.value - 1) * pageSize.value;
	return list.value.slice(start, start + pageSize.value);
});
function onSizeChange(){ currentPage.value = 1; }
function onPageChange(){ /* 占位：依赖 v-model 即可 */ }

function formatDate(val: string | null | undefined){
	if(!val) return '-';
	try{ return new Date(val).toLocaleString(); }catch{ return String(val); }
}
function typeLabel(v?: string){ if(v==='SERVICE') return '服务订单'; if(v==='SP') return '商品订单'; if(v==='FK') return '付款订单'; return v || '-'; }
function statusLabel(v?: string){ if(v==='CREATED') return '已创建'; if(v==='PAID') return '已支付'; if(v==='FULFILLED') return '已履约'; if(v==='CLOSED') return '已完成'; if(v==='CANCELLED') return '已取消'; return v || '-'; }
function statusTagType(v?: string){ if(v==='CREATED') return 'info'; if(v==='PAID') return 'success'; if(v==='FULFILLED') return 'success'; if(v==='CLOSED') return 'warning'; if(v==='CANCELLED') return 'danger'; return undefined as any; }
function payStatusLabel(v?: string){ if(v==='UNPAID') return '未支付'; if(v==='PAID') return '已支付'; if(v==='REFUNDED') return '已退款'; if(v==='CANCELLED') return '已作废'; return v || '-'; }
function payStatusTagType(v?: string){ if(v==='UNPAID') return 'info'; if(v==='PAID') return 'success'; if(v==='REFUNDED') return 'warning'; if(v==='CANCELLED') return 'danger'; return undefined as any; }
function payMethodLabel(v?: string | null){ if(!v) return '-'; if(v==='CASH') return '现金'; if(v==='SHOUQIANBA') return '收钱吧'; if(v==='OFFLINE') return '线下其他'; if(v==='WECHAT_JSAPI') return '微信JSAPI'; if(v==='WECHAT_MICROPAY') return '微信付款码'; if(v==='WASH_CARD') return '洗车卡结算'; if(v==='GROUP_BALANCE') return '集团余额支付'; return v; }
function money(v:any){ const n = Number(v||0); return Number.isFinite(n) ? n.toFixed(2) : '0.00'; }
function last4(p?: string){ try{ const s=String(p||''); return s.slice(-4); }catch{ return ''; } }

// 复用后台的权限判断（作废/红冲）
function canWriteoff(){ try{ const raw = localStorage.getItem('user')||'{}'; const u = JSON.parse(raw||'{}'); const perms = Array.isArray(u?.permissions)?u.permissions:[]; return perms.includes('*') || perms.includes('orders-writeoff'); }catch{ return false; } }

// 履约/物流操作（POS 端仅触发后台接口，与后台一致）
async function openShip(row:any){ try{ await orderControllerShip(Number(row?.id||0), { body:{ noExpress: true } } as any); ElMessage.success('已标记为无需快递发货'); await fetchList(); }catch(e:any){ ElMessage.error(String(e?.message||e||'提交失败')); } }
async function receive(id:number){ try { await orderControllerReceive(Number(id)); ElMessage.success('已收货'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }
async function openEditTracking(row:any){ try{ await ElMessageBox.alert('请在后台修改物流单号；POS 暂不支持此操作', '提示'); }catch{} }
async function startService(id:number){ try { await orderControllerStartService(Number(id)); ElMessage.success('已开始服务'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }
async function finishService(id:number){ try { await orderControllerFinishService(Number(id)); ElMessage.success('已结束服务'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }
async function writeoff(row:any){ try{ const ok = await new Promise<boolean>(r=>{ ElMessageBox.confirm('确认对该订单执行作废/红冲操作？', '操作确认', { type:'warning' }).then(()=>r(true)).catch(()=>r(false)); }); if(!ok) return; await orderControllerWriteoff(Number(row?.id||0), { body: { reason: 'POS作废/红冲' } } as any); ElMessage.success('操作成功'); await fetchList(); }catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }

async function fetchList(){
	const start = createdAtRange.value?.[0];
	const end = createdAtRange.value?.[1];
	list.value = await (orderControllerList({
		keyword: keyword.value || undefined,
		type: type.value || undefined,
		scene: scene.value || undefined,
		status: status.value || undefined,
		payStatus: payStatus.value || undefined,
		includeDeleted: true,
		start: start || undefined,
		end: end || undefined,
	} as any) as any);
	currentPage.value = 1;
}
function open(id:number){ router.push(`/orders/${id}`); }
function openByNo(no:string){ router.push(`/orders/no/${encodeURIComponent(no)}`); }
async function close(id:number){ try { await orderControllerClose(Number(id)); ElMessage.success('已关闭'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'关闭失败')); } }
async function restore(id:number){ try { await orderControllerRestore(Number(id)); ElMessage.success('已恢复'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'恢复失败')); } }
function resetFilters(){ keyword.value=''; type.value=''; scene.value=''; status.value=''; payStatus.value=''; createdAtRange.value=null; fetchList(); }
function remainSeconds(row:any): number {
    try{
        const exp:any = row?.paymentExpireAt || null; if(!exp) return 0;
        const t = new Date(exp).getTime();
        const now = Date.now() + nowTick.value * 0; // 依赖 nowTick 触发视图更新
        return Math.max(0, Math.floor((t - now)/1000));
    }catch{ return 0; }
}
function formatRemain(sec:number): string { const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60; return (h>0)?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
// 订单号点击即跳转详情，不在列表页提供复制操作（避免与跳转冲突）

function ordersRowClass({ row }: any){
	const classes: string[] = [];
	try{
		if (row.deletedAt) classes.push('row-deleted');
		if (String(row.payStatus||'').toUpperCase()==='UNPAID') classes.push('row-unpaid');
	}catch{}
	return classes.join(' ');
}

// 支付弹窗
const showPay = ref(false);
const currentOrderId = ref<number | null>(null);
const payMethod = ref<'CASH'|'SHOUQIANBA'|'OFFLINE'|'CASH'>('CASH');
const payTab = ref<'manual'|'wx'|'wash'>('manual');
const wxAuthCode = ref('');
const wxPayLoading = ref(false);
const washPrefer = ref<'AUTO'|'GROUP'|'MEMBER'>('AUTO');
// 收银立减
const orderForPay = ref<any>(null);
// 手动选择付款会员/卡
const payerMemberKeyword = ref('');
const payerMemberList = ref<Array<{ id:number; name?:string; phone?:string }>>([]);
const payerMemberId = ref<number|null>(null);
const payerCards = ref<Array<{ key:string; value:number; label:string }>>([]);
const payerCardId = ref<number|null>(null);
function memberLabel(m:any){ return `${m.name||'-'}（****${String(m.phone||'').slice(-4)}）#${m.id}`; }
async function searchPayerMember(){
    const q = String(payerMemberKeyword.value||'').trim(); if (!q){ payerMemberList.value=[]; payerMemberId.value=null; payerCards.value=[]; payerCardId.value=null; return; }
    try{
        const res:any = await memberControllerList({ keyword: q, page: 1, pageSize: 20 } as any);
        payerMemberList.value = Array.isArray(res?.items) ? res.items.map((x:any)=>({ id:x.id, name:x.name, phone:x.phone })) : [];
    }catch{ payerMemberList.value=[]; }
}
watchEffect(async ()=>{
    payerCards.value = []; payerCardId.value = null;
    const mid = payerMemberId.value; if (!mid) return;
    try{
        const res:any = await washCardControllerAdminList({ page: 1, pageSize: 50, memberId: String(mid) } as any);
        const items = Array.isArray(res?.items) ? res.items : [];
        payerCards.value = items.map((c:any)=>({ key: `M-${c.id}`, value: c.id, label: `[会员卡] ${c.name||''}（余${c.remainingTimes||0}）#${c.cardNo}` }));
    }catch{ payerCards.value = []; }
});
const cashierDiscountInput = ref<number>(0);
const payAmountCap = computed(()=>{
    try{ const o:any = orderForPay.value; if(!o) return 0; const total=Number(o.totalAmount||0); const discount=Number(o.discountAmount||0); const cashierPrev=Number(o.cashierDiscountAmount||0); return Math.max(0, Number((total - (discount - cashierPrev)).toFixed(2))); }catch{ return 0; }
});
const payAmountAfterManual = computed(()=>{
    try{ const o:any=orderForPay.value; if(!o) return 0; const shipping=Number(o.shippingFee||0); const points=Number(o.pointsAmount||0); const manual=Math.max(0, Number(cashierDiscountInput.value||0)); const base=payAmountCap.value; return Math.max(0, Number((base - manual + shipping - points).toFixed(2))); }catch{ return 0; }
});
function onManualDiscountChange(){ try{ let v=Number(cashierDiscountInput.value||0); if(!Number.isFinite(v)||v<0) v=0; const cap=Number(payAmountCap.value||0); cashierDiscountInput.value=Number(Math.min(cap, v).toFixed(2)); }catch{} }
function openPay(row:any){ currentOrderId.value = row.id; payMethod.value = 'CASH'; payTab.value = 'manual'; washPrefer.value='AUTO'; wxAuthCode.value=''; orderForPay.value = row || null; cashierDiscountInput.value = Math.max(0, Number((row as any)?.cashierDiscountAmount||0)) || 0; showPay.value = true; }
function normalizeMoney2(v:any): number { try{ const n = Number(v||0); if (!Number.isFinite(n) || n<0) return 0; return Number(n.toFixed(2)); }catch{ return 0; } }
function moneyEq(a:any,b:any): boolean { return Math.abs(normalizeMoney2(a)-normalizeMoney2(b)) < 0.0001; }
async function doMarkPaid(){
	if (!currentOrderId.value) return;
	try{
		// 仅当收银立减发生变化时才调用调整接口（避免 0->0 写入时间线）
		try{
			const prev = Number((orderForPay.value as any)?.cashierDiscountAmount||0);
			const next = Number(cashierDiscountInput.value||0);
			if (!moneyEq(prev, next)){
				await orderControllerAdjustCashierDiscount(Number(currentOrderId.value), { body: { amount: normalizeMoney2(next) } } as any);
			}
		}catch{}
		await orderControllerMarkPaid(Number(currentOrderId.value), { body: { method: payMethod.value } } as any);
		ElMessage.success('已标记为已支付');
		showPay.value = false;
		await fetchList();
	}catch(e:any){
		ElMessage.error(String(e?.message||e||'操作失败'));
	}
}

async function doWxMicropay(){
	if (!currentOrderId.value) return;
	const code = wxAuthCode.value.trim();
	if (!/^\d{18,24}$/.test(code)){ ElMessage.error('请输入有效的微信付款码（18-24位数字）'); return; }
	try{
		wxPayLoading.value = true;
		// 仅当收银立减变化时才调整（避免 0->0 写入时间线）
		try{
			const prev = Number((orderForPay.value as any)?.cashierDiscountAmount||0);
			const next = Number(cashierDiscountInput.value||0);
			if (!moneyEq(prev, next)){
				await orderControllerAdjustCashierDiscount(Number(currentOrderId.value), { body: { amount: normalizeMoney2(next) } } as any);
			}
		}catch{}
		await orderControllerWechatMicropay(Number(currentOrderId.value), { body: { authCode: code } } as any);
		ElMessage.success('付款成功，已标记订单为已支付');
		showPay.value = false; wxAuthCode.value = '';
		await fetchList();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'付款失败')); }
	finally{ wxPayLoading.value = false; }
}

async function doWashDeduct(){
	if (!currentOrderId.value) return;
	try{
		const detail:any = await (orderControllerGet(Number(currentOrderId.value)) as any);
		if (String(detail?.type||'').toUpperCase()!=='SERVICE'){ ElMessage.error('仅服务订单可使用洗车卡划扣'); return; }
        const prefer = washPrefer.value === 'AUTO' ? undefined : washPrefer.value;
        const body:any = { prefer };
        if (payerMemberId.value){ body.payerMemberId = payerMemberId.value; }
        if (payerCardId.value){ body.payerCardId = payerCardId.value; }
        const ret:any = await orderControllerPayByWashCard(Number(currentOrderId.value), { body } as any);
		const plan = Array.isArray(ret?.plan)?ret.plan:[];
		const times = Number(ret?.requiredTimes||0);
		ElMessage.success(`划扣成功：扣${times}次，使用${plan.length}张卡`);
		showPay.value = false;
		await fetchList();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'划扣失败')); }
}

// 退款
const showRefund = ref(false);
const refundReason = ref('');
const refundMode = ref<'FULL'|'PART'>('FULL');
const refundAmountText = ref<string>('');
const currentOrder = ref<any>(null);
async function openRefund(row:any){ currentOrder.value = row; refundReason.value=''; refundMode.value='FULL'; refundAmountText.value=''; showRefund.value = true; }
async function doRefund(){
	if (!currentOrder.value) return;
	const row = currentOrder.value;
	if (row?.payMethod === 'WECHAT_JSAPI' || row?.payMethod === 'WECHAT_MICROPAY'){
		let amount: number | undefined = undefined;
		if (refundMode.value === 'FULL') amount = Number(row.payAmount||0);
		else {
			const raw = (refundAmountText.value||'').trim().replace(',', '.');
			if (!/^\d+(\.\d{1,2})?$/.test(raw)) { ElMessage.error('金额格式不正确，最多保留2位小数'); return; }
			const v = Number(raw);
			if (!isFinite(v) || v < 0.01){ ElMessage.error('部分退款金额至少为0.01'); return; }
			amount = v;
		}
		const resAny: any = await orderControllerWechatRefund(Number(row.id), { body: { reason: refundReason.value || undefined, amount } } as any);
		if (resAny && resAny.ok){ ElMessage.success('退款已提交'); } else { ElMessage.error((resAny && resAny.error) || '退款申请失败'); }
	} else {
		const res = await orderControllerWechatRefund(Number(row.id), { body: { reason: refundReason.value || undefined } } as any);
		if ((res as any)?.id){ ElMessage.success('已退款'); }
	}
	showRefund.value = false; await fetchList();
}

// 摄像头/图片识别付款码
const videoRef = ref<HTMLVideoElement|null>(null);
const canvasRef = ref<HTMLCanvasElement|null>(null);
let mediaStream: MediaStream | null = null;
let scanTimer: any = null;
async function openScan(){
	try{
		await stopScan();
		mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
		if (!videoRef.value) return;
		videoRef.value.srcObject = mediaStream as any;
		await videoRef.value.play();
		startDecodeLoop();
	}catch(e:any){ ElMessage.error('无法打开摄像头：' + String(e?.message||e||'')); }
}
function stopScan(){ try{ if (scanTimer){ clearInterval(scanTimer); scanTimer=null; } }catch{} try{ if (videoRef.value){ videoRef.value.pause(); (videoRef.value as any).srcObject = null; } }catch{} try{ if (mediaStream){ mediaStream.getTracks().forEach(t=> t.stop()); mediaStream=null; } }catch{} }
function startDecodeLoop(){
	const reader = new BrowserMultiFormatReader();
	scanTimer = setInterval(async ()=>{
		try{
			if (!videoRef.value) return;
			const video = videoRef.value as any;
			const canvas = canvasRef.value;
			if (!canvas) return;
			const w = video.videoWidth; const h = video.videoHeight;
			if (!w || !h) return;
			canvas.width = w; canvas.height = h;
			const ctx = canvas.getContext('2d'); if (!ctx) return;
			ctx.drawImage(video, 0, 0, w, h);
			const br = new BrowserMultiFormatReader();
			const res = await br.decodeFromImage(undefined as any, canvas.toDataURL('image/png'));
			const text = String((res as any)?.getText?.()).trim();
			if (/^\d{18,24}$/.test(text)){
				wxAuthCode.value = text; ElMessage.success('识别成功'); stopScan();
			}
		}catch(err){ if (!(err instanceof NotFoundException)) {/* 忽略 */} }
	}, 500);
}
async function onSelectImage(file: any){
	try{
		const f = file?.raw || file?.target?.files?.[0]; if (!f) return;
		const reader = new FileReader();
		reader.onload = async ()=>{
			try{
				const img = new Image();
				img.onload = async ()=>{
					const canvas = document.createElement('canvas');
					canvas.width = img.width; canvas.height = img.height;
					const ctx = canvas.getContext('2d'); if (!ctx) return;
					ctx.drawImage(img, 0, 0);
					const br = new BrowserMultiFormatReader();
					const res = await br.decodeFromImage(undefined as any, canvas.toDataURL('image/png'));
					const text = String((res as any)?.getText?.()).trim();
					if (/^\d{18,24}$/.test(text)) { wxAuthCode.value = text; ElMessage.success('识别成功'); }
					else { ElMessage.error('未检测到有效付款码'); }
				};
				img.onerror = ()=> ElMessage.error('图片读取失败');
				img.src = String(reader.result||'');
			}catch{ ElMessage.error('识别失败'); }
		};
		reader.onerror = ()=> ElMessage.error('图片读取失败');
		reader.readAsDataURL(f);
	}catch{ ElMessage.error('识别失败'); }
}

onMounted(() => {
    try{
        const q = router.currentRoute.value.query || {} as any;
        const s = String(q.scene||''); if (s) scene.value = s;
        const t = String(q.type||''); if (t) type.value = t;
        const ps = String(q.payStatus||''); if (ps) payStatus.value = ps;
        const start = String(q.start||''); const end = String(q.end||'');
        if (start && end) createdAtRange.value = [start, end] as any;
    }catch{}
    fetchList();
    try{ if (tickTimer) clearInterval(tickTimer); }catch{}
    tickTimer = setInterval(()=>{ nowTick.value++; }, 1000);
    try{ window.dispatchEvent(new CustomEvent('pos-set-tab', { detail: { path: '/orders', title: '订单列表' } })); }catch{}
});

onUnmounted(()=>{
    try{ if (tickTimer){ clearInterval(tickTimer); tickTimer=null; } }catch{}
});
</script>

<style scoped>
.pos-orders{ display:flex; flex-direction: column; gap:12px; }
/* 筛选卡片：透明背景 + 圆角 + 边框，取消吸顶 */
.toolbar{ display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding:8px; border:1px solid var(--el-border-color); border-radius:12px; background: transparent; box-shadow: 0 2px 10px rgba(0,0,0,.03); }
.sticky-toolbar{ position: static; top: auto; z-index: auto; background: transparent; backdrop-filter: none; border-bottom:none; }
.filter-input{ width:320px; }
.filter-select{ width:160px; }
.filter-select.wide{ width:200px; }
.filter-date{ width:360px; }
.table-scroll{ overflow:auto; overscroll-behavior: contain; touch-action: pan-y; border-radius:12px; border:1px solid var(--el-border-color); box-shadow: 0 2px 10px rgba(0,0,0,.04); }
.orders-table :deep(.cell-flex){ display:flex; align-items:center; gap:6px; }
.orders-table :deep(.col-type .cell){ overflow: visible; text-overflow: clip; }
.link{ color: var(--app-primary); cursor: pointer; text-decoration: none; }
.link.deleted{ color: #909399; text-decoration: line-through; }
.pager-bar{ display:flex; justify-content:flex-end; padding:8px 4px 0; background: transparent; }
.money{ font-variant-numeric: tabular-nums; }
.money .unit{ margin-right:2px; color:#909399; font-size:12px; }
.money--total{ color:#303133; font-weight:600; }
.money--pay{ color: var(--el-color-success); font-weight:700; }
.phone-tail{ font-weight:700; letter-spacing:0.5px; }
.dropdown-ref{ display:inline-flex; }
.popconfirm-ref{ display:inline-flex; }

/* 12.7 寸横屏优化 */
:root{ --pos-base-font: 15px; }
.pos-orders, .orders-table{ font-size: var(--pos-base-font); }
.orders-table :deep(.el-table__row){ height: 56px; }
.orders-table :deep(.el-table__cell){ padding: 12px 10px; }
.icon-btn.large-hit{ padding: 10px; }
.op-actions{ display:flex; align-items:center; gap:12px; }
.op-actions .icon-btn.large-hit{ padding: 12px; font-size:18px; }
.op-actions :deep(.el-icon){ font-size: 20px; }
.row-unpaid :deep(.el-table__cell){ background: #fff7ed; }
.row-deleted :deep(.el-table__cell){ color:#a8abb2; text-decoration: line-through; }
</style>
