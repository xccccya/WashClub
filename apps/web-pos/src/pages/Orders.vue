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
						<span class="link" :class="{ deleted: !!row.deletedAt }" title="双击查看详情" @dblclick="openByNo(row.no)" @click="copyNo(row.no)">{{ row.no }}</span>
					</template>
				</el-table-column>
				<el-table-column label="类型" width="120" class-name="col-type">
					<template #default="{ row }"><el-tag :type="row.deletedAt ? 'info' : undefined">{{ typeLabel(row.type) }}</el-tag></template>
				</el-table-column>
				<el-table-column label="状态" width="120">
					<template #default="{ row }"><el-tag :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template>
				</el-table-column>
				<el-table-column label="支付状态" width="200">
					<template #default="{ row }">
						<div class="cell-flex">
							<el-tag :type="payStatusTagType(row.payStatus)">{{ payStatusLabel(row.payStatus) }}</el-tag>
							<el-tag v-if="row.payStatus==='UNPAID' && remainSeconds(row)>0" type="warning" effect="light">倒计时 {{ formatRemain(remainSeconds(row)) }}</el-tag>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="支付方式" width="140">
					<template #default="{ row }">{{ payMethodLabel(row.payMethod) }}</template>
				</el-table-column>
				<el-table-column prop="totalAmount" label="订单总额" width="140" align="right">
					<template #default="{ row }">¥ {{ money(row.totalAmount) }}</template>
				</el-table-column>
				<el-table-column prop="payAmount" label="支付金额" width="140" align="right">
					<template #default="{ row }">¥ {{ money(row.payAmount) }}</template>
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
						<span>{{ row.member?.name || '-' }}（{{ row.member?.phone || '-' }}）</span>
					</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" min-width="200" :show-overflow-tooltip="true" />
				<el-table-column label="操作" width="360" fixed="right">
					<template #default="{ row }">
						<el-button text class="icon-btn large-hit" title="查看" @click="open(row.id)"><el-icon><View /></el-icon></el-button>
						<el-button v-if="row.payStatus==='UNPAID' && !row.deletedAt" size="large" type="success" @click="openPay(row)"><el-icon style="margin-right:4px;"><Wallet /></el-icon>标记支付</el-button>
						<el-button v-if="row.payStatus==='PAID' && !row.deletedAt" size="large" type="warning" @click="openRefund(row)"><el-icon style="margin-right:4px;"><Money /></el-icon>退款</el-button>
						<el-popconfirm v-if="!row.deletedAt" title="确认删除（软删除）？" @confirm="close(row.id)"><template #reference><el-button text class="icon-btn danger large-hit" title="删除"><el-icon><Delete /></el-icon></el-button></template></el-popconfirm>
						<el-popconfirm v-else title="确认恢复该订单？" @confirm="restore(row.id)"><template #reference><el-button size="large" type="warning">恢复</el-button></template></el-popconfirm>
					</template>
				</el-table-column>
			</el-table>
		</div>
		<div class="pager-bar">
			<el-pagination
				v-model:current-page="currentPage"
				v-model:page-size="pageSize"
				:page-sizes="[10, 20, 30, 50]"
				layout="total, sizes, prev, pager, next"
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
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" :loading="wxPayLoading" @click="doWxMicropay">发起付款码支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane label="洗车卡划扣" name="wash">
					<div style="color:#606266; font-size:13px; line-height:1.6; background:#f9fafb; padding:8px 10px; border-radius:6px; border:1px dashed #e5e7eb; margin-bottom:8px;">
						系统会自动识别本订单中标记为"计为洗车(次)"的服务商品数量作为需要扣减的次数，并从车辆所属集团或会员的洗车卡中优先扣减。次数不可手动修改。
					</div>
					<el-radio-group v-model="washPrefer" size="small">
						<el-radio-button label="AUTO">自动选择</el-radio-button>
						<el-radio-button label="GROUP">优先集团卡</el-radio-button>
						<el-radio-button label="MEMBER">优先会员卡</el-radio-button>
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
						<el-radio label="FULL">全额退款</el-radio>
						<el-radio label="PART">部分退款</el-radio>
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
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

const router = useRouter();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const list = ref<any[]>([]);
const keyword = ref('');
const type = ref<string | ''>('');
const scene = ref<string | ''>('');
const status = ref<string | ''>('');
const payStatus = ref<string | ''>('');
const createdAtRange = ref<[string, string] | null>(null);

const currentPage = ref(1);
const pageSize = ref(20);
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
	currentPage.value = 1;
}
function open(id:number){ router.push(`/orders/${id}`); }
function openByNo(no:string){ router.push(`/orders/no/${encodeURIComponent(no)}`); }
async function close(id:number){ try { await http(`/orders/${id}/close`, { method:'POST' }); ElMessage.success('已关闭'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'关闭失败')); } }
async function restore(id:number){ try { await http(`/orders/${id}/restore`, { method:'POST' }); ElMessage.success('已恢复'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'恢复失败')); } }
function resetFilters(){ keyword.value=''; type.value=''; scene.value=''; status.value=''; payStatus.value=''; createdAtRange.value=null; fetchList(); }
function remainSeconds(row:any): number { try{ const exp:any = row?.paymentExpireAt || null; if(!exp) return 0; const t = new Date(exp).getTime(); return Math.max(0, Math.floor((t - Date.now())/1000)); }catch{ return 0; } }
function formatRemain(sec:number): string { const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60; return (h>0)?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
async function copyNo(no:string){ try { await navigator.clipboard.writeText(no); ElMessage.success('已复制订单号'); } catch { /* ignore */ } }

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
function openPay(row:any){ currentOrderId.value = row.id; payMethod.value = 'CASH'; payTab.value = 'manual'; washPrefer.value='AUTO'; wxAuthCode.value=''; showPay.value = true; }
async function doMarkPaid(){ if (!currentOrderId.value) return; try { await http(`/orders/${currentOrderId.value}/pay/manual`, { method:'POST', body: { method: payMethod.value } }); ElMessage.success('已标记为已支付'); showPay.value = false; await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }

async function doWxMicropay(){
	if (!currentOrderId.value) return;
	const code = wxAuthCode.value.trim();
	if (!/^\d{18,24}$/.test(code)){ ElMessage.error('请输入有效的微信付款码（18-24位数字）'); return; }
	try{
		wxPayLoading.value = true;
		await http(`/orders/${currentOrderId.value}/pay/wx-micropay`, { method:'POST', body: { authCode: code } });
		ElMessage.success('付款成功，已标记订单为已支付');
		showPay.value = false; wxAuthCode.value = '';
		await fetchList();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'付款失败')); }
	finally{ wxPayLoading.value = false; }
}

async function doWashDeduct(){
	if (!currentOrderId.value) return;
	try{
		const detail:any = await http(`/orders/${currentOrderId.value}`);
		if (String(detail?.type||'').toUpperCase()!=='SERVICE'){ ElMessage.error('仅服务订单可使用洗车卡划扣'); return; }
		const prefer = washPrefer.value === 'AUTO' ? undefined : washPrefer.value;
		const ret:any = await http(`/orders/${currentOrderId.value}/pay/wash-card`, { method:'POST', body: { prefer } });
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
		const resAny: any = await http(`/orders/${row.id}/refund`, { method:'POST', body: { reason: refundReason.value || undefined, amount } });
		if (resAny && resAny.ok){ ElMessage.success('退款已提交'); } else { ElMessage.error((resAny && resAny.error) || '退款申请失败'); }
	} else {
		const res = await http(`/orders/${row.id}/refund`, { method:'POST', body: { reason: refundReason.value || undefined } });
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

onMounted(() => { fetchList(); try{ window.dispatchEvent(new CustomEvent('pos-set-tab', { detail: { path: '/orders', title: '订单列表' } })); }catch{} });
</script>

<style scoped>
.pos-orders{ display:flex; flex-direction: column; gap:12px; }
.toolbar{ display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding:8px; }
.sticky-toolbar{ position: sticky; top: 0; z-index: 9; background: rgba(255,255,255,0.85); backdrop-filter: blur(6px); border-bottom:1px solid #ebeef5; }
.filter-input{ width:320px; }
.filter-select{ width:160px; }
.filter-select.wide{ width:200px; }
.filter-date{ width:360px; }
.table-scroll{ overflow:auto; overscroll-behavior: contain; touch-action: pan-y; }
.orders-table :deep(.cell-flex){ display:flex; align-items:center; gap:6px; }
.orders-table :deep(.col-type .cell){ overflow: visible; text-overflow: clip; }
.link{ color: var(--app-primary); cursor: pointer; text-decoration: underline; }
.link.deleted{ color: #909399; text-decoration: line-through; }
.pager-bar{ display:flex; justify-content:flex-end; padding:8px 4px 0; background: transparent; }

/* 12.7 寸横屏优化 */
:root{ --pos-base-font: 15px; }
.pos-orders, .orders-table{ font-size: var(--pos-base-font); }
.orders-table :deep(.el-table__row){ height: 56px; }
.orders-table :deep(.el-table__cell){ padding: 12px 10px; }
.icon-btn.large-hit{ padding: 10px; }
.row-unpaid :deep(.el-table__cell){ background: #fff7ed; }
.row-deleted :deep(.el-table__cell){ color:#a8abb2; text-decoration: line-through; }
</style>
