<template>
	<BasePage title="洗车计次卡">
		<template #actions>
			<el-select
				v-model="selectedMemberId"
				filterable
				remote
				clearable
				:remote-method="searchMembers"
				:loading="loadingMembers"
				placeholder="选择会员（按昵称/手机号搜索）"
				style="width: 320px; margin-right: 8px;"
				@change="onMemberChange"
			>
				<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name || '会员'}（${m.phone}）`" :value="m.id" />
			</el-select>

			<el-select
				v-model="selectedVehicleId"
				filterable
				remote
				clearable
				:remote-method="searchVehicles"
				:loading="loadingVehicles"
				placeholder="选择车辆（按车牌搜索）"
				style="width: 300px; margin-right: 8px;"
				@change="onVehicleChange"
			>
				<el-option v-for="v in vehicleOptions" :key="v.id" :label="`${v.plateNumber}（${v.memberName||v.memberPhone||'-'}）`" :value="v.id" />
			</el-select>

			<el-button @click="fetchList" :loading="loading" style="margin-right:8px;">
				<el-icon style="vertical-align: middle; margin-right:4px;"><Search /></el-icon>
				<span style="vertical-align: middle;">搜索</span>
			</el-button>
			<el-button @click="clearFilters" style="margin-right:8px;">清空</el-button>
			<el-button type="primary" @click="openCreate">
				<el-icon style="vertical-align: middle; margin-right:4px;"><CirclePlus /></el-icon>
				<span style="vertical-align: middle;">新增洗车卡</span>
			</el-button>
		</template>
		<div class="table-scroll"><el-table :data="list" stripe style="min-width: 980px; width: 100%;" highlight-current-row>
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="卡名称" min-width="160" show-overflow-tooltip />
			<el-table-column prop="cardNo" label="卡号" width="140" />
			<el-table-column label="默认" width="100">
				<template #default="{ row }">
					<el-tag :type="row.isDefault? 'success':'info'">{{ row.isDefault ? '是' : '否' }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="持有人" min-width="200">
				<template #default="{ row }">
					{{ row.owner?.name || '-' }}（{{ row.owner?.phone || '-' }}）
				</template>
			</el-table-column>
			<el-table-column label="次数(剩/总)" width="160">
				<template #default="{ row }">{{ row.remainingTimes }}/{{ row.totalTimes }}</template>
			</el-table-column>
			<el-table-column prop="expiryAt" label="有效期" width="180">
				<template #default="{ row }">{{ formatTime(row.expiryAt) || '永久' }}</template>
			</el-table-column>
			<el-table-column label="共享" min-width="220" show-overflow-tooltip>
				<template #default="{ row }">
					<span v-if="(row.shares||[]).length===0">—</span>
					<span v-else>
						<el-tag v-for="s in row.shares" :key="s.id" style="margin-right:6px;">{{ s.member?.name || s.member?.phone || s.memberId }}</el-tag>
					</span>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="620" fixed="right">
				<template #default="{ row }">
					<el-button size="small" link @click="openAdd(row)"><el-icon><CirclePlus /></el-icon><span>加次</span></el-button>
					<el-button size="small" link type="warning" @click="openDeduct(row)"><el-icon><Remove /></el-icon><span>划扣</span></el-button>
					<el-button size="small" link @click="openShare(row)"><el-icon><Share /></el-icon><span>共享</span></el-button>
					<el-button size="small" link @click="openLogs(row)"><el-icon><List /></el-icon><span>日志</span></el-button>
					<el-button size="small" link type="success" :disabled="row.isDefault" @click="setDefault(row)"><el-icon><Star /></el-icon><span>设为默认</span></el-button>
					<el-button size="small" link type="danger" @click="openDelete(row)"><el-icon><Delete /></el-icon><span>删除</span></el-button>
				</template>
			</el-table-column>
		</el-table></div>
		<div style="margin-top:12px;display:flex;justify-content:flex-end;">
			<el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />
		</div>

		<!-- 新建/加次/划扣/共享/日志 对话框 -->
		<el-dialog v-model="dialogCreate" title="新增洗车卡" width="540px">
			<el-form :model="createForm" label-width="120px">
				<el-form-item label="持卡会员" required>
					<el-select v-model="createForm.ownerMemberId" placeholder="选择会员" filterable style="width:100%">
						<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name || '会员'}（${m.phone}）`" :value="m.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="卡名称"><el-input v-model="createForm.name" placeholder="例如：标准洗车10次卡" /></el-form-item>
				<el-form-item label="初始总次数"><el-input v-model.number="createForm.totalTimes" type="number" /></el-form-item>
				<el-form-item label="初始剩余次数"><el-input v-model.number="createForm.remainingTimes" type="number" /></el-form-item>
				<el-form-item label="有效期">
					<div style="display:flex;gap:8px;width:100%;align-items:center;">
						<el-switch v-model="createFormPermanent" active-text="永久" inactive-text="自定义" />
						<el-date-picker v-model="createForm.expiryAt" :disabled="createFormPermanent" type="date" placeholder="选择日期(可选)" style="flex:1;" />
					</div>
					<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
						<el-button size="small" @click="applyExpiryDays(1)">1天</el-button>
						<el-button size="small" @click="applyExpiryDays(7)">7天</el-button>
						<el-button size="small" @click="applyExpiryDays(30)">30天</el-button>
						<el-button size="small" @click="applyExpiryMonths(3)">3个月</el-button>
						<el-button size="small" @click="applyExpiryMonths(6)">6个月</el-button>
						<el-button size="small" @click="applyExpiryYears(1)">1年</el-button>
					</div>
				</el-form-item>
				<el-form-item label="设为默认">
					<el-switch v-model="createForm.isDefault" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogCreate=false">取消</el-button>
				<el-button type="primary" @click="onCreateSave">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="dialogAdd" title="增加次数" width="420px">
			<el-form :model="addForm" label-width="120px">
				<el-form-item label="次数"><el-input v-model.number="addForm.count" type="number" /></el-form-item>
				<el-form-item label="备注"><el-input v-model="addForm.remark" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogAdd=false">取消</el-button>
				<el-button type="primary" @click="onAddSave">确定</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="dialogDeduct" title="划扣次数" width="420px">
			<el-form :model="deductForm" label-width="120px">
				<el-form-item label="次数"><el-input v-model.number="deductForm.count" type="number" /></el-form-item>
				<el-form-item label="原因">
					<el-select v-model="deductForm.reason" style="width:100%">
						<el-option label="服务划扣" value="SERVICE_DEDUCT" />
						<el-option label="退款划扣" value="REFUND_DEDUCT" />
						<el-option label="后台手动划扣" value="BACKEND_DEDUCT" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="deductForm.reason==='SERVICE_DEDUCT'" label="服务车辆">
					<el-select v-model="deductForm.vehicleId" filterable placeholder="选择车辆（含持有人及共享会员车辆）" style="width:100%">
						<el-option v-for="v in deductVehicles" :key="v.id" :label="`${v.plateNumber}（${v._ownerDisplay}）`" :value="v.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="备注"><el-input v-model="deductForm.remark" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogDeduct=false">取消</el-button>
				<el-button type="primary" @click="onDeductSave">确定</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="dialogShare" title="共享设置" width="560px">
			<el-form :model="shareForm" label-width="120px">
				<el-form-item label="新增共享对象">
					<el-select v-model="shareForm.memberId" placeholder="选择会员" filterable style="width:100%">
						<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name || '会员'}（${m.phone}）`" :value="m.id" />
					</el-select>
					<el-button style="margin-left:8px;" @click="onAddShare" :disabled="!shareForm.memberId">添加</el-button>
				</el-form-item>
			</el-form>
			<div>
				<el-tag v-for="s in (current?.shares||[])" :key="s.id" closable @close="onRemoveShare(s.memberId)" style="margin-right:8px;">
					{{ s.member?.name || s.member?.phone || s.memberId }}
				</el-tag>
			</div>
			<template #footer>
				<el-button @click="dialogShare=false">关闭</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="dialogLogs" title="变更记录" width="900px">
			<el-table :data="logs" stripe style="width:100%">
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column prop="createdAt" label="时间" width="180">
					<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
				</el-table-column>
				<el-table-column label="动作" width="160">
					<template #default="{ row }">
						{{ row.action === 'ADD' ? '增加' : (row.action === 'DEDUCT' ? '划扣' : '共享') }}
					</template>
				</el-table-column>
				<el-table-column label="原因" width="220">
					<template #default="{ row }">{{ zhReason(row.reason) }}</template>
				</el-table-column>
				<el-table-column label="变更" width="120">
					<template #default="{ row }">{{ row.change > 0 ? ('+'+row.change) : row.change }}</template>
				</el-table-column>
				<el-table-column label="剩余(前→后)" width="160">
					<template #default="{ row }">{{ row.beforeRemaining }} → {{ row.afterRemaining }}</template>
				</el-table-column>
				<el-table-column label="共享对象/车辆" width="260">
					<template #default="{ row }">
						<span v-if="row.member">{{ row.member.name || '会员' }}（{{ row.member.phone }}）</span>
						<span v-else>-</span>
						<span v-if="row.vehicle" style="margin-left:8px; color:#909399;">车辆：{{ row.vehicle.plateNumber }}</span>
					</template>
				</el-table-column>
				<el-table-column label="关联订单" width="140">
					<template #default="{ row }">
						<el-button v-if="(row.reason==='PURCHASE_ADD' && row.purchaseOrderId) || (row.reason==='REFUND_DEDUCT' && row.purchaseOrderId)" size="small" link type="primary" @click="gotoOrder(row.purchaseOrderId)">查看订单</el-button>
						<span v-else>—</span>
					</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
			</el-table>
			<div style="margin-top:12px;display:flex;justify-content:flex-end;">
				<el-pagination background layout="prev, pager, next" :total="logsTotal" :page-size="logsPageSize" :current-page="logsPage" @current-change="onLogsPageChange" />
			</div>
			<template #footer>
				<el-button @click="dialogLogs=false">关闭</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="delDialog" title="确认删除" width="420px" @closed="clearDelTimer">
			<div>确认删除该计次卡？将同时删除该卡的共享关系与日志记录，此操作不可恢复。</div>
			<template #footer>
				<el-button @click="delDialog=false">取消</el-button>
				<el-button type="danger" :disabled="delCountdown>0" @click="onDeleteConfirm">{{ delCountdown>0 ? `确认(${delCountdown}s)` : '确认' }}</el-button>
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
import { ElIcon } from 'element-plus';
import { Search, CirclePlus, Remove, Share, List, Star, Delete } from '@element-plus/icons-vue';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Member = { id: number; name: string; phone: string };
type Share = { id: number; memberId: number; member?: Member };
type Card = { id: number; name: string; ownerMemberId: number; owner?: Member; totalTimes: number; remainingTimes: number; expiryAt?: string | null; shares?: Share[]; isDefault?: boolean; cardNo?: string };
const memberOptions = ref<Member[]>([]);
const selectedMemberId = ref<number | null>(null);
const loadingMembers = ref(false);

type VehicleLite = { id: number; plateNumber: string; memberId?: number | null; memberName?: string; memberPhone?: string; _ownerDisplay?: string };
const vehicleOptions = ref<VehicleLite[]>([]);
const loadingVehicles = ref(false);
const selectedVehicleId = ref<number | null>(null);

const list = ref<Card[]>([]);
const keyword = ref('');
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const dialogCreate = ref(false);
const createForm = ref<Partial<Card> & { ownerMemberId?: number; totalTimes?: number; remainingTimes?: number; expiryAt?: string | null; isDefault?: boolean }>({ name: '洗车计次卡', totalTimes: 0, remainingTimes: 0, expiryAt: null, isDefault: true });
const createFormPermanent = ref(true);

const dialogAdd = ref(false);
const addForm = ref<{ count: number; remark?: string }>({ count: 1 });

const dialogDeduct = ref(false);
const deductVehicles = ref<VehicleLite[]>([]);
const deductForm = ref<{ count: number; reason: 'SERVICE_DEDUCT'|'REFUND_DEDUCT'|'BACKEND_DEDUCT'; remark?: string; vehicleId?: number | null }>({ count: 1, reason: 'BACKEND_DEDUCT' });

const dialogShare = ref(false);
const shareForm = ref<{ memberId?: number }>({});

const dialogLogs = ref(false);
const logs = ref<any[]>([]);
const logsPage = ref(1);
const logsPageSize = ref(10);
const logsTotal = ref(0);

const current = ref<Card | null>(null);
const delDialog = ref(false);
const delCountdown = ref(0);
let delTimer: any = null;

function formatTime(v?: string | null){
    if (!v) return '';
    try { const d = new Date(v as any); if (isNaN(d.getTime())) return ''; const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; } catch { return ''; }
}

async function fetchMembers(){
    const res = await http<{ items: Member[] }>("/member/list", { method: 'GET', query: { page: 1, pageSize: 200 } });
    memberOptions.value = res.items || [];
}

async function searchMembers(q?: string){
    loadingMembers.value = true;
    try{
        const res = await http<{ items: Member[] }>("/member/list", { method:'GET', query: { page: 1, pageSize: 50, keyword: (q||'').trim() || undefined } });
        memberOptions.value = res.items || [];
    } finally { loadingMembers.value = false; }
}

async function searchVehicles(q?: string){
    loadingVehicles.value = true;
    try{
        const res = await http<VehicleLite[]>("/vehicle/search", { method:'GET', query: { q: (q||'').trim() || undefined, limit: 30 } });
        vehicleOptions.value = Array.isArray(res) ? res.map(v => ({ ...v, _ownerDisplay: v.memberName || v.memberPhone || '-' })) : [];
    } finally { loadingVehicles.value = false; }
}

async function fetchList(){
    loading.value = true;
    try {
        const query:any = { keyword: keyword.value || undefined, page: page.value, pageSize: pageSize.value };
        if (selectedMemberId.value) query.memberId = selectedMemberId.value;
        const res = await http<{ items: Card[]; total: number; page: number; pageSize: number }>(
            '/wash-card/list', { method: 'GET', query }
        );
        list.value = res.items; total.value = res.total;
    } finally { loading.value = false; }
}

function onPageChange(p: number){ page.value = p; fetchList(); }

function onMemberChange(){
    // 选择会员后清空车辆选择
    selectedVehicleId.value = null;
    fetchList();
}

async function onVehicleChange(){
    // 通过车辆反查所属会员并筛选其洗车卡
    try{
        const v = vehicleOptions.value.find(x=>x.id===selectedVehicleId.value);
        if (v?.memberId) { selectedMemberId.value = v.memberId; }
    } finally {
        fetchList();
    }
}

function clearFilters(){ selectedMemberId.value = null; selectedVehicleId.value = null; keyword.value=''; fetchList(); }

function openCreate(){ current.value = null; createForm.value = { name: '洗车计次卡', totalTimes: 0, remainingTimes: 0, expiryAt: null, ownerMemberId: undefined, isDefault: true }; dialogCreate.value = true; }
async function onCreateSave(){
    if (!createForm.value.ownerMemberId) { ElMessage.error('请选择持卡会员'); return; }
    const payload: any = { ...createForm.value };
    if (createFormPermanent.value) { payload.expiryAt = null; }
    await http('/wash-card/create', { method: 'POST', body: payload });
    dialogCreate.value = false; ElMessage.success('已创建'); fetchList();
}

function openAdd(card: Card){ current.value = card; addForm.value = { count: 1, remark: '' }; dialogAdd.value = true; }
async function onAddSave(){ if (!current.value) return; await http(`/wash-card/${current.value.id}/add`, { method: 'POST', body: addForm.value }); dialogAdd.value = false; ElMessage.success('已增加次数'); fetchList(); }

async function loadDeductVehicles(card: Card){
    try{
        const ownerId = card.ownerMemberId;
        const ownerVehicles = await http<any[]>(`/vehicle/member/${ownerId}`, { method:'GET' });
        // 聚合共享会员车辆
        const sharedMemberIds = (card.shares||[]).map(s=>s.memberId);
        const sharedVehiclesArr = await Promise.all(sharedMemberIds.map(id=> http<any[]>(`/vehicle/member/${id}`, { method:'GET' }).catch(()=>[])));
        const all = [
            ...(ownerVehicles||[]).map((v:any)=> ({ id: v.id, plateNumber: v.plateNumber, _ownerDisplay: '持有人' })),
            ...sharedVehiclesArr.flat().map((v:any)=> ({ id: v.id, plateNumber: v.plateNumber, _ownerDisplay: '共享会员' })),
        ];
        // 去重
        const map = new Map<number, any>();
        for (const v of all){ if (!map.has(v.id)) map.set(v.id, v); }
        deductVehicles.value = Array.from(map.values());
    } catch { deductVehicles.value = []; }
}

function openDeduct(card: Card){ current.value = card; deductForm.value = { count: 1, reason: 'BACKEND_DEDUCT', remark: '', vehicleId: null }; dialogDeduct.value = true; loadDeductVehicles(card); }
async function onDeductSave(){
    if (!current.value) return;
    const body:any = { count: deductForm.value.count, reason: deductForm.value.reason, remark: deductForm.value.remark };
    if (deductForm.value.reason === 'SERVICE_DEDUCT' && deductForm.value.vehicleId) {
        body.vehicleId = deductForm.value.vehicleId;
        // 自动拼接车辆信息到备注
        const v = deductVehicles.value.find(x=>x.id===deductForm.value.vehicleId);
        const suffix = v ? `（服务车辆：${v.plateNumber}）` : '';
        if (!body.remark) body.remark = `服务划扣${suffix}`; else if (!String(body.remark).includes('服务车辆：') && suffix) body.remark += suffix;
    }
    await http(`/wash-card/${current.value.id}/deduct`, { method: 'POST', body });
    dialogDeduct.value = false; ElMessage.success('已划扣'); fetchList();
}

function openShare(card: Card){ current.value = card; shareForm.value = {}; dialogShare.value = true; }
async function onAddShare(){ if (!current.value || !shareForm.value.memberId) return; await http(`/wash-card/${current.value.id}/shares`, { method: 'POST', body: { memberId: shareForm.value.memberId } }); ElMessage.success('已共享'); const fresh = await http<Card>(`/wash-card/${current.value.id}`, { method: 'GET' }); current.value = fresh; fetchList(); }
async function onRemoveShare(memberId: number){ if (!current.value) return; await http(`/wash-card/${current.value.id}/shares/${memberId}/remove`, { method: 'POST' }); ElMessage.success('已移除'); const fresh = await http<Card>(`/wash-card/${current.value.id}`, { method: 'GET' }); current.value = fresh; fetchList(); }

function openLogs(card: Card){ current.value = card; logsPage.value = 1; fetchLogs(); dialogLogs.value = true; }
async function fetchLogs(){ if (!current.value) return; const res = await http<{ items: any[]; total: number }>(`/wash-card/${current.value.id}/logs`, { method: 'GET', query: { page: logsPage.value, pageSize: logsPageSize.value } }); logs.value = res.items; logsTotal.value = res.total; }
function onLogsPageChange(p:number){ logsPage.value = p; fetchLogs(); }

function gotoOrder(orderId: number){
    const path = `/admin/orders/${orderId}`;
    try { window.open(path, '_blank'); } catch { location.href = path; }
}

onMounted(()=>{ fetchMembers(); fetchList(); });

function applyExpiryDays(days: number){
    try { const d = new Date(); d.setDate(d.getDate() + days); createForm.value.expiryAt = formatDateISO(d); createFormPermanent.value = false; } catch {}
}
function applyExpiryMonths(months: number){
    try { const d = new Date(); d.setMonth(d.getMonth() + months); createForm.value.expiryAt = formatDateISO(d); createFormPermanent.value = false; } catch {}
}
function applyExpiryYears(years: number){
    try { const d = new Date(); d.setFullYear(d.getFullYear() + years); createForm.value.expiryAt = formatDateISO(d); createFormPermanent.value = false; } catch {}
}
function formatDateISO(d: Date){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

async function setDefault(card: Card){ await http(`/wash-card/${card.id}/set-default`, { method: 'POST' }); ElMessage.success('已设为默认'); fetchList(); }

function openDelete(card: Card){ current.value = card; delCountdown.value = 5; delDialog.value = true; if (delTimer) { clearInterval(delTimer); delTimer = null; } delTimer = setInterval(()=>{ delCountdown.value = Math.max(0, delCountdown.value - 1); if (delCountdown.value === 0 && delTimer) { clearInterval(delTimer); delTimer = null; } }, 1000); }
function clearDelTimer(){ if (delTimer) { clearInterval(delTimer); delTimer = null; } }
async function onDeleteConfirm(){ if (!current.value) return; await http(`/wash-card/${current.value.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); delDialog.value = false; fetchList(); }

function zhReason(r?: string){
    const v = String(r||'').toUpperCase();
    if (v === 'BACKEND_ADD') return '后台增加';
    if (v === 'PURCHASE_ADD') return '购卡增加';
    if (v === 'SERVICE_DEDUCT') return '服务划扣';
    if (v === 'REFUND_DEDUCT') return '退款扣减';
    if (v === 'BACKEND_DEDUCT') return '后台扣减';
    if (v === 'SHARE_ADD') return '共享加入';
    if (v === 'SHARE_REMOVE') return '取消共享';
    return r || '-';
}
</script>

<style scoped>
.table-scroll{ overflow:auto; width:100%; }
.base-page__header{ flex-wrap: wrap; gap:8px; width:100%; }
</style>


