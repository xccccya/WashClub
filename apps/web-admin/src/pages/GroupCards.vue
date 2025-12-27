<template>
  <div class="page">
    <div class="toolbar">
      <el-select
        v-model="groupId"
        filterable
        remote
        clearable
        :remote-method="searchGroups"
        :loading="loadingGroups"
        placeholder="选择集团（可按集团号/名称搜索）"
        style="width: 320px; margin-right: 8px;"
        @change="onGroupChange"
      >
        <el-option v-for="g in groupOptions" :key="g.id" :label="`${g.code} - ${g.name}`" :value="g.id" />
      </el-select>
      <el-button type="primary" style="margin-left: 12px" :disabled="!groupId" @click="openCreate">新增洗车卡</el-button>
    </div>

    <el-table :data="items" height="calc(100vh - 220px)">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="卡名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="cardNo" label="卡号" width="140" />
      <el-table-column label="次数(剩/总)" width="160">
        <template #default="{ row }">{{ row.remainingTimes }}/{{ row.totalTimes }}</template>
      </el-table-column>
      <el-table-column prop="expiryAt" label="有效期" width="180">
        <template #default="{ row }">{{ formatDate(row.expiryAt) || '永久' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="480" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link @click="openAdd(row)">加次</el-button>
          <el-button size="small" link type="warning" @click="openConsume(row)">划扣</el-button>
          <el-button size="small" link @click="openLogs(row)">日志</el-button>
          <el-popconfirm title="确认删除该集团洗车卡？此操作不可恢复。" @confirm="doDelete(row)">
            <template #reference>
              <el-button size="small" link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createVisible" title="新增集团洗车卡" width="540px">
      <el-form label-width="120px">
        <el-form-item label="卡名称"><el-input v-model="form.name" placeholder="例如：标准洗车10次卡" /></el-form-item>
        <el-form-item label="初始总次数"><el-input-number v-model="form.totalTimes" :min="1" /></el-form-item>
        <el-form-item label="初始剩余次数"><el-input-number v-model="form.remainingTimes" :min="0" /></el-form-item>
        <el-form-item label="有效期">
          <div style="display:flex;gap:8px;width:100%;align-items:center;">
            <el-switch v-model="createFormPermanent" active-text="永久" inactive-text="自定义" />
            <el-date-picker v-model="form.expiryAt" :disabled="createFormPermanent" type="date" placeholder="选择日期(可选)" style="flex:1;" />
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
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addVisible" title="增加次数" width="420px">
      <el-form label-width="90px">
        <el-form-item label="次数"><el-input-number v-model="addForm.count" :min="1"/></el-form-item>
        <el-form-item label="备注"><el-input v-model="addForm.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible=false">取消</el-button>
        <el-button type="primary" @click="doAdd">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="consumeVisible" title="划扣次数" width="520px">
      <el-form label-width="90px">
        <el-form-item label="次数"><el-input-number v-model="consumeForm.times" :min="1"/></el-form-item>
        <el-form-item label="原因">
          <el-select v-model="consumeForm.reason" style="width:100%">
            <el-option label="服务划扣" value="SERVICE_DEDUCT" />
            <el-option label="退款划扣" value="REFUND_DEDUCT" />
            <el-option label="后台手动划扣" value="BACKEND_DEDUCT" />
          </el-select>
        </el-form-item>
        <el-form-item label="服务车辆">
          <el-select
            v-model="consumeForm.vehicleId"
            filterable
            remote
            clearable
            :remote-method="searchConsumeVehicles"
            :loading="loadingConsumeVehicles"
            placeholder="选择车辆（集团/集团会员车辆）"
            style="width: 100%;"
            @change="onConsumeVehicleChange"
          >
            <el-option
              v-for="v in consumeVehicles"
              :key="v.id"
              :label="`${v.plateNumber}（${v.isMemberVehicle ? ('会员：'+(v.member?.name||v.member?.phone||v.memberId)) : '集团车辆'}）`"
              :value="v.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="consumeForm.remark"/></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="consumeVisible=false">取消</el-button>
        <el-button type="primary" @click="doConsume">划扣</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logsVisible" title="变更记录" width="900px">
      <el-table :data="logs" stripe style="width:100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="createdAt" label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="动作" width="120">
          <template #default="{ row }">{{ row.action === 'ADD' ? '增加' : '划扣' }}</template>
        </el-table-column>
        <el-table-column label="原因" width="200">
          <template #default="{ row }">{{ zhReason(row.reason) }}</template>
        </el-table-column>
        <el-table-column label="变更" width="120">
          <template #default="{ row }">{{ row.change > 0 ? ('+'+row.change) : row.change }}</template>
        </el-table-column>
        <el-table-column label="剩余(前→后)" width="160">
          <template #default="{ row }">{{ row.beforeRemaining }} → {{ row.afterRemaining }}</template>
        </el-table-column>
        <el-table-column label="车辆/会员" min-width="200">
          <template #default="{ row }">
            <span v-if="row.vehicle">车牌：{{ row.vehicle.plateNumber }}</span>
            <span v-else-if="row.member">{{ row.member.name || '会员' }}（{{ row.member.phone }}）</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="关联订单号" width="260">
          <template #default="{ row }">
            <span v-if="(row.reason==='PURCHASE_ADD' || row.reason==='REFUND_DEDUCT')">
              <template v-if="row.purchaseOrderNo">
                <router-link :to="`/orders/no/${encodeURIComponent(String(row.purchaseOrderNo))}`">{{ row.purchaseOrderNo }}</router-link>
              </template>
              <template v-else-if="row.purchaseOrderId">
                <router-link :to="`/orders/${row.purchaseOrderId}`">#{{ row.purchaseOrderId }}</router-link>
              </template>
              <span v-else>—</span>
            </span>
            <span v-else>
              <template v-if="row.serviceOrderNo">
                <router-link :to="`/orders/no/${encodeURIComponent(String(row.serviceOrderNo))}`">{{ row.serviceOrderNo }}</router-link>
              </template>
              <template v-else-if="row.serviceOrderId">
                <router-link :to="`/orders/${row.serviceOrderId}`">#{{ row.serviceOrderId }}</router-link>
              </template>
              <span v-else>—</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      </el-table>
      <div style="margin-top:12px;display:flex;justify-content:flex-end;">
        <el-pagination background layout="prev, pager, next" :total="logsTotal" :page-size="logsPageSize" :current-page="logsPage" @current-change="onLogsPageChange" />
      </div>
      <template #footer>
        <el-button @click="logsVisible=false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
	groupCardControllerAdd,
	groupCardControllerConsume,
	groupCardControllerCreate,
	groupCardControllerList,
	groupCardControllerLogs,
	groupCardControllerRemove,
	groupControllerList,
	groupVehicleControllerList,
} from '@wash/api-client';

const route = useRoute();
const groupId = ref<number | null>(null);
const groupOptions = ref<any[]>([]);
const loadingGroups = ref(false);
const items = ref<any[]>([]);
const createVisible = ref(false);
const form = ref<any>({ name: '集团洗车计次卡', totalTimes: 0, remainingTimes: 0, expiryAt: '' });
const createFormPermanent = ref(true);
const consumeVisible = ref(false);
const consumeForm = ref<any>({ cardId: 0, times: 1, reason: 'SERVICE_DEDUCT', vehicleId: undefined, memberId: undefined, remark: '' });
const consumeVehicles = ref<any[]>([]);
const loadingConsumeVehicles = ref(false);
const addVisible = ref(false);
const addForm = ref<any>({ cardId: 0, count: 1, remark: '' });
const logsVisible = ref(false);
const logs = ref<any[]>([]);
const logsPage = ref(1);
const logsPageSize = ref(10);
const logsTotal = ref(0);

function formatTime(v?: string){ if(!v) return '-'; try{ return new Date(v).toLocaleString(); }catch{ return String(v); } }
function formatDate(v?: string){ if(!v) return ''; try{ const d=new Date(v); if(isNaN(d.getTime())) return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; }catch{ return ''; } }
function formatDateISO(d: Date){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
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

async function load(){
  if(!groupId.value){ items.value = []; return; }
  const res:any = await groupCardControllerList(Number(groupId.value));
  items.value = Array.isArray(res) ? res : [];
}

function openCreate(){ createVisible.value = true; }
async function doCreate(){
  if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
  const payload:any = { ...form.value };
  if (createFormPermanent.value) { payload.expiryAt = null; }
  if (!payload.totalTimes || payload.totalTimes < 1) { ElMessage.error('总次数必须为正整数'); return; }
  if (payload.remainingTimes == null || payload.remainingTimes === '') { payload.remainingTimes = payload.totalTimes; }
  if (payload.remainingTimes < 0) { ElMessage.error('初始剩余次数不能小于0'); return; }
  if (payload.remainingTimes > payload.totalTimes) { ElMessage.error('初始剩余次数不能大于初始总次数'); return; }
  await groupCardControllerCreate(Number(groupId.value), payload as any);
  ElMessage.success('创建成功');
  createVisible.value=false;
  await load();
}

function openAdd(row:any){ addForm.value = { cardId: row.id, count: 1, remark: '' }; addVisible.value = true; }
async function doAdd(){
	if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
	await groupCardControllerAdd(Number(groupId.value), Number(addForm.value.cardId), { count: addForm.value.count, remark: addForm.value.remark||'' } as any);
	ElMessage.success('已增加次数'); addVisible.value=false; await load();
}

function openConsume(row: any){ consumeForm.value = { cardId: row.id, times: 1, reason: 'SERVICE_DEDUCT', vehicleId: undefined, memberId: undefined, remark: '' }; consumeVisible.value = true; searchConsumeVehicles(''); }
async function doConsume(){
  if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
  // 自动拼接备注中的车辆信息
  let remark = consumeForm.value.remark || '';
  const v = consumeVehicles.value.find((x:any)=>x.id===consumeForm.value.vehicleId);
  if (v && !String(remark).includes('服务车辆：')) { remark = `${remark || '服务划扣'}（服务车辆：${v.plateNumber}）`; }
  await groupCardControllerConsume(Number(groupId.value), Number(consumeForm.value.cardId), { times: consumeForm.value.times, reason: consumeForm.value.reason, vehicleId: consumeForm.value.vehicleId || null, memberId: consumeForm.value.memberId || null, remark } as any);
  ElMessage.success('已划扣');
  consumeVisible.value=false;
  await load();
}

async function searchConsumeVehicles(q?: string){
  if(!groupId.value){ consumeVehicles.value = []; return; }
  loadingConsumeVehicles.value = true;
  try{
    const res:any[] = await groupVehicleControllerList(Number(groupId.value), { keyword: (q||'').trim() || undefined, source: 'all' } as any) as any;
    consumeVehicles.value = Array.isArray(res) ? res : [];
  } finally { loadingConsumeVehicles.value = false; }
}

function onConsumeVehicleChange(){
  const v:any = consumeVehicles.value.find((x:any)=>x.id===consumeForm.value.vehicleId);
  if (v && v.memberId) consumeForm.value.memberId = v.memberId; // 若车辆属于集团会员，反填会员ID
}

async function doDelete(row:any){
  if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
  await groupCardControllerRemove(Number(groupId.value), Number(row.id));
  ElMessage.success('已删除');
  await load();
}

function openLogs(row:any){ logsPage.value=1; fetchLogs(row.id); logsVisible.value = true; }
async function fetchLogs(cardId:number){
	if(!groupId.value) return;
	const res:any = await groupCardControllerLogs(Number(groupId.value), Number(cardId), { page: logsPage.value, pageSize: logsPageSize.value } as any);
	logs.value = res?.items||[]; logsTotal.value = res?.total||0;
}
function onLogsPageChange(p:number){ logsPage.value = p; const current = addForm.value.cardId || consumeForm.value.cardId; if (current) fetchLogs(current); }

function applyExpiryDays(days: number){
  try { const d = new Date(); d.setDate(d.getDate() + days); form.value.expiryAt = formatDateISO(d); createFormPermanent.value = false; } catch {}
}
function applyExpiryMonths(months: number){
  try { const d = new Date(); d.setMonth(d.getMonth() + months); form.value.expiryAt = formatDateISO(d); createFormPermanent.value = false; } catch {}
}
function applyExpiryYears(years: number){
  try { const d = new Date(); d.setFullYear(d.getFullYear() + years); form.value.expiryAt = formatDateISO(d); createFormPermanent.value = false; } catch {}
}
function gotoOrderNo(no: string){ const path = `/admin/orders/no/${encodeURIComponent(String(no))}`; try { window.open(path, '_blank'); } catch { location.href = path; } }
onMounted(()=>{ const q = Number(route.query.groupId||0); if (Number.isFinite(q) && q>0) { groupId.value = q; load(); } });

async function searchGroups(q?: string){
  loadingGroups.value = true;
  try{
    const res:any = await groupControllerList({ page: 1, pageSize: 200, keyword: (q||'').trim() || undefined, sortBy: 'name', sortOrder: 'asc' } as any);
    groupOptions.value = Array.isArray(res?.items) ? res.items : [];
  } finally { loadingGroups.value = false; }
}

function onGroupChange(){ load(); }
</script>

<style scoped>
.page { padding: 16px; }
.toolbar { margin-bottom: 12px; }
</style>
