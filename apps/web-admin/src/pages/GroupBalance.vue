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
      <el-divider direction="vertical" />
      <el-button type="success" :disabled="!groupId" @click="openRecharge">充值</el-button>
      <el-button type="warning" :disabled="!groupId" @click="openAdjust">手工调账</el-button>
    </div>

    <el-card style="margin-bottom:12px;">
      <div>
        余额：<b :style="{ color: balanceColor }">¥ {{ balance.toFixed(2) }}</b>
      </div>
      <div v-if="balance < 0" style="margin-top:6px;color:#b91c1c;">余额为负，请尽快核对</div>
    </el-card>

    <el-card class="consume-card" shadow="never" style="margin-bottom:12px;" v-loading="consumeLoading">
      <template #header>
        <div class="consume-header">
          <div class="consume-title">
            <div class="t">按月累计消费</div>
            <div class="s">统计口径：集团余额支付扣减</div>
          </div>
          <div class="consume-actions">
            <el-date-picker v-model="consumeStartMonth" type="month" placeholder="开始月" format="YYYY-MM" value-format="YYYY-MM" teleported clearable @change="loadConsumption" />
            <span class="sep">~</span>
            <el-date-picker v-model="consumeEndMonth" type="month" placeholder="结束月" format="YYYY-MM" value-format="YYYY-MM" teleported clearable @change="loadConsumption" />
            <el-button-group>
              <el-button size="small" :disabled="!groupId" @click="presetLast12">近12个月</el-button>
              <el-button size="small" :disabled="!groupId" @click="presetThisYear">本年</el-button>
            </el-button-group>
            <el-button size="small" type="primary" :disabled="!groupId" @click="loadConsumption">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="12" style="margin-bottom:8px;">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat">
            <div class="label">区间累计</div>
            <div class="value">¥ {{ consumeTotal.toFixed(2) }}</div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat">
            <div class="label">月均消费</div>
            <div class="value">¥ {{ consumeAvg.toFixed(2) }}</div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat">
            <div class="label">最近月份</div>
            <div class="value">{{ consumeLatestMonth || '-' }}</div>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="stat">
            <div class="label">最近月消费</div>
            <div class="value">¥ {{ consumeLatestAmount.toFixed(2) }}</div>
          </div>
        </el-col>
      </el-row>

      <div class="consume-body">
        <el-empty v-if="consumeEmpty" description="暂无消费数据" />
        <v-chart v-else autoresize :option="consumeOption" class="consume-chart" />
      </div>

      <el-table v-if="consumeRows.length" :data="consumeRows" size="small" stripe style="margin-top:10px;">
        <el-table-column prop="month" label="月份" width="120" />
        <el-table-column prop="amount" label="累计消费金额" align="right" min-width="180">
          <template #default="{ row }"><span class="money">¥ {{ Number(row.amount||0).toFixed(2) }}</span></template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-table :data="items" height="calc(100vh - 260px)">
      <el-table-column prop="id" label="#" width="80" />
      <el-table-column label="类型" width="120">
        <template #default="{ row }">{{ zhType(row.type) }}</template>
      </el-table-column>
      <el-table-column label="金额" width="160">
        <template #default="{ row }">
          <span :style="{ color: Number(row.amount||0) >= 0 ? '#16a34a' : '#ef4444' }">{{ (row.amount || 0) >= 0 ? '+' : '' }}¥ {{ Number(row.amount||0).toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" width="260">
        <template #default="{ row }">
          <span v-if="row.orderNo">
            <router-link :to="`/orders/no/${encodeURIComponent(String(row.orderNo))}`">{{ row.orderNo }}</router-link>
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" />
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination :current-page="page" :page-size="pageSize" :total="total" @current-change="(p:number)=>{page=p;loadLedger()}" layout="prev, pager, next, ->, total" />
    </div>

    <!-- 充值 -->
    <el-dialog v-model="rechargeVisible" title="集团余额充值" width="520px">
      <el-form label-width="100px">
        <el-form-item label="金额(元)"><el-input-number v-model="rechargeForm.amount" :min="0.01" :precision="2" :step="1" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="rechargeForm.remark" /></el-form-item>
        <el-form-item label="付款会员">
          <el-select v-model="rechargeForm.memberIdForPayment" filterable placeholder="选择集团管理员" style="width:100%;">
            <el-option v-for="a in adminOptions" :key="a.id" :label="`${a.name}（${a.phone||'-'}）`" :value="a.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rechargeVisible=false">取消</el-button>
        <el-button type="primary" @click="doRecharge">创建订单</el-button>
      </template>
    </el-dialog>

    <!-- 调账 -->
    <el-dialog v-model="adjustVisible" title="手工调账" width="520px">
      <el-form label-width="100px">
        <el-form-item label="金额(元)"><el-input-number v-model="adjustForm.amount" :step="1" :precision="2" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="adjustForm.note" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible=false">取消</el-button>
        <el-button type="primary" @click="doAdjust">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import {
	groupBalanceControllerAdjust,
	groupBalanceControllerCreateRecharge,
	groupBalanceControllerLedger,
	groupBalanceControllerSummary,
	groupBalanceControllerMonthlyConsumption,
	groupControllerList,
	groupMemberControllerList,
} from '@wash/api-client';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent]);

const route = useRoute();
const router = useRouter();
const groupId = ref<number | null>(null);
const groupOptions = ref<any[]>([]);
const loadingGroups = ref(false);
const balance = ref(0);
const items = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

// monthly consumption
const consumeLoading = ref(false);
const consumeStartMonth = ref<string | null>(null);
const consumeEndMonth = ref<string | null>(null);
const consumeRows = ref<Array<{ month: string; amount: number }>>([]);
const consumeTotal = ref(0);
const consumeAvg = ref(0);
const consumeLatestMonth = ref<string | null>(null);
const consumeLatestAmount = ref(0);
const consumeEmpty = computed(() => !consumeRows.value.length || consumeRows.value.every(it => Number(it.amount || 0) <= 0));

const rechargeVisible = ref(false);
const rechargeForm = ref<any>({ amount: 100, remark: '', memberIdForPayment: undefined });
const adjustVisible = ref(false);
const adjustForm = ref<any>({ amount: 0, note: '' });
const adminOptions = ref<Array<{ id:number; name:string; phone?:string }>>([]);

function formatTime(v?: string){ if(!v) return '-'; try{ return new Date(v).toLocaleString(); }catch{ return String(v); } }
function zhType(t?: string){
  const v = String(t||'').toUpperCase();
  if (v === 'RECHARGE') return '充值';
  if (v === 'DEDUCT') return '扣减';
  if (v === 'ADJUST') return '调账';
  if (v === 'REFUND') return '退款';
  return t || '-';
}

function ymOf(d: Date){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  return `${y}-${m}`;
}
function parseYm(s?: string | null){
  const v = String(s||'').trim();
  if (!/^\d{4}-\d{2}$/.test(v)) return null;
  const y = Number(v.slice(0,4));
  const m = Number(v.slice(5,7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m<1 || m>12) return null;
  return { y, m };
}
function addMonths(ym: { y:number; m:number }, delta: number){
  const base = ym.y*12 + (ym.m-1);
  const v = base + delta;
  return { y: Math.floor(v/12), m: (v%12)+1 };
}
function ymToStr(ym: { y:number; m:number }){
  return `${String(ym.y).padStart(4,'0')}-${String(ym.m).padStart(2,'0')}`;
}
function presetLast12(){
  const now = new Date();
  const end = { y: now.getFullYear(), m: now.getMonth()+1 };
  consumeEndMonth.value = ymToStr(end);
  consumeStartMonth.value = ymToStr(addMonths(end, -11));
  loadConsumption();
}
function presetThisYear(){
  const now = new Date();
  const end = { y: now.getFullYear(), m: now.getMonth()+1 };
  consumeEndMonth.value = ymToStr(end);
  consumeStartMonth.value = `${now.getFullYear()}-01`;
  loadConsumption();
}

const balanceColor = computed(()=> balance.value >= 0 ? '#16a34a' : '#ef4444');

async function load(){
  if(!groupId.value){
    items.value=[]; balance.value=0; adminOptions.value=[]; consumeRows.value=[]; consumeTotal.value=0; consumeAvg.value=0; consumeLatestMonth.value=null; consumeLatestAmount.value=0;
    return;
  }
  await loadSummary();
  await loadConsumption();
  await loadLedger();
  await loadAdmins();
}

async function loadSummary(){
  const res:any = await groupBalanceControllerSummary(Number(groupId.value));
  balance.value = Number(res?.balance || 0);
}

const consumeOption = computed(()=>{
  const xs = consumeRows.value.map(it=> it.month);
  const ys = consumeRows.value.map(it=> Number(it.amount||0));
  return {
    grid: { left: 40, right: 18, top: 20, bottom: 30, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v: any)=> `¥ ${Number(v||0).toFixed(2)}` },
    xAxis: { type: 'category', data: xs, axisLabel: { color: '#64748b' } },
    yAxis: { type: 'value', axisLabel: { formatter: (v:number)=> `¥${Number(v||0).toFixed(0)}` , color: '#64748b' } },
    series: [{ type: 'line', data: ys, smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' }, areaStyle: { color: 'rgba(59,130,246,0.12)' } }],
  } as any;
});

async function loadConsumption(){
  if(!groupId.value) return;
  consumeLoading.value = true;
  try{
    const now = new Date();
    const endDefault = ymOf(now);
    const end = parseYm(consumeEndMonth.value) ? consumeEndMonth.value! : endDefault;
    const start = parseYm(consumeStartMonth.value) ? consumeStartMonth.value! : (()=>{ const e = parseYm(end)!; return ymToStr(addMonths(e, -11)); })();
    consumeStartMonth.value = start;
    consumeEndMonth.value = end;
    const res:any = await groupBalanceControllerMonthlyConsumption(Number(groupId.value), { startMonth: start, endMonth: end } as any);
    const list = Array.isArray(res?.months) ? res.months : [];
    consumeRows.value = list.map((it:any)=>({ month: String(it?.month||''), amount: Number(it?.amount||0) })).filter(it=>!!it.month);
    consumeTotal.value = Number(res?.total || consumeRows.value.reduce((s,it)=> s + Number(it.amount||0), 0));
    consumeAvg.value = Number(res?.avg || (consumeRows.value.length ? consumeTotal.value/consumeRows.value.length : 0));
    consumeLatestMonth.value = res?.latestMonth ?? (consumeRows.value.length ? consumeRows.value[consumeRows.value.length-1].month : null);
    consumeLatestAmount.value = Number(res?.latestAmount || (consumeRows.value.length ? consumeRows.value[consumeRows.value.length-1].amount : 0));
  }catch(e:any){
    consumeRows.value = [];
    consumeTotal.value = 0;
    consumeAvg.value = 0;
    consumeLatestMonth.value = null;
    consumeLatestAmount.value = 0;
    ElMessage.error(e?.message || '加载月度消费失败');
  } finally {
    consumeLoading.value = false;
  }
}

async function loadLedger(){
  const res:any = await groupBalanceControllerLedger(Number(groupId.value), { page: page.value, pageSize: pageSize.value } as any);
  total.value = res?.total || 0;
  items.value = Array.isArray(res?.items) ? res.items : [];
}

async function loadAdmins(){
  try{
    const res:any[] = (await groupMemberControllerList(Number(groupId.value)) as any) || [];
    const list = Array.isArray(res) ? res : [];
    adminOptions.value = list.filter((it:any)=> String(it?.role||'').toUpperCase()==='ADMIN').map((it:any)=>({ id: Number(it?.memberId||it?.member?.id||0), name: it?.member?.name || '-', phone: it?.member?.phone || '' })).filter(it=>it.id>0);
  }catch{ adminOptions.value = []; }
}

function openRecharge(){ rechargeVisible.value = true; }
async function doRecharge(){
  if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
  if(!rechargeForm.value.memberIdForPayment){ ElMessage.error('请选择付款会员'); return; }
  const r:any = await groupBalanceControllerCreateRecharge(Number(groupId.value), { amount: rechargeForm.value.amount, remark: rechargeForm.value.remark, memberIdForPayment: rechargeForm.value.memberIdForPayment } as any);
  ElMessage.success(`已创建充值订单：${r?.no}`);
  rechargeVisible.value=false;
  try{
    if (r && r.no) { router.push(`/orders/no/${encodeURIComponent(String(r.no))}`); return; }
  }catch{}
  await loadLedger();
}

function openAdjust(){ adjustVisible.value = true; }
async function doAdjust(){
  if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
  await groupBalanceControllerAdjust(Number(groupId.value), { amount: adjustForm.value.amount, note: adjustForm.value.note } as any);
  ElMessage.success('已调账');
  adjustVisible.value=false;
  await load();
}
onMounted(()=>{
  // 默认：近12个月
  presetLast12();
  const q = Number(route.query.groupId||0);
  if (Number.isFinite(q) && q>0) { groupId.value = q; load(); }
});

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
.pagination { display:flex; justify-content:flex-end; padding: 10px 0; }
.consume-card :deep(.el-card__header){ padding: 10px 14px; }
.consume-header{ display:flex; align-items:flex-end; justify-content:space-between; gap: 12px; flex-wrap: wrap; }
.consume-title .t{ font-weight: 700; color:#0f172a; line-height: 1.1; }
.consume-title .s{ font-size: 12px; color:#64748b; margin-top: 2px; }
.consume-actions{ display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
.consume-actions .sep{ color:#94a3b8; }
.stat{ padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
.stat .label{ font-size: 12px; color:#64748b; }
.stat .value{ margin-top: 4px; font-size: 18px; font-weight: 700; color:#0f172a; }
.consume-body{ min-height: 240px; }
.consume-chart{ height: 260px; width: 100%; }
.money{ font-variant-numeric: tabular-nums; color:#0f172a; }
</style>
