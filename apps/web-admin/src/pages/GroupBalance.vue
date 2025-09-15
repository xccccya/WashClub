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
import { http } from '../utils/http';

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

const balanceColor = computed(()=> balance.value >= 0 ? '#16a34a' : '#ef4444');

async function load(){ if(!groupId.value){ items.value=[]; balance.value=0; adminOptions.value=[]; return; } await loadSummary(); await loadLedger(); await loadAdmins(); }

async function loadSummary(){
  const res:any = await http(`/group/${groupId.value}/balance`, { method: 'GET' });
  balance.value = Number(res?.balance || 0);
}

async function loadLedger(){
  const res:any = await http(`/group/${groupId.value}/balance/ledger`, { method: 'GET', query: { page: page.value, pageSize: pageSize.value } });
  total.value = res?.total || 0;
  items.value = Array.isArray(res?.items) ? res.items : [];
}

async function loadAdmins(){
  try{
    const res:any[] = await http(`/group/${groupId.value}/members`, { method: 'GET' });
    const list = Array.isArray(res) ? res : [];
    adminOptions.value = list.filter((it:any)=> String(it?.role||'').toUpperCase()==='ADMIN').map((it:any)=>({ id: Number(it?.memberId||it?.member?.id||0), name: it?.member?.name || '-', phone: it?.member?.phone || '' })).filter(it=>it.id>0);
  }catch{ adminOptions.value = []; }
}

function openRecharge(){ rechargeVisible.value = true; }
async function doRecharge(){
  if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
  if(!rechargeForm.value.memberIdForPayment){ ElMessage.error('请选择付款会员'); return; }
  const r:any = await http(`/group/${groupId.value}/balance/recharge`, { method: 'POST', body: { amount: rechargeForm.value.amount, remark: rechargeForm.value.remark, memberIdForPayment: rechargeForm.value.memberIdForPayment } });
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
  await http(`/group/${groupId.value}/balance/adjust`, { method: 'POST', body: { amount: adjustForm.value.amount, note: adjustForm.value.note } });
  ElMessage.success('已调账');
  adjustVisible.value=false;
  await load();
}
onMounted(()=>{ const q = Number(route.query.groupId||0); if (Number.isFinite(q) && q>0) { groupId.value = q; load(); } });

async function searchGroups(q?: string){
  loadingGroups.value = true;
  try{
    const res:any = await http('/group', { method:'GET', query: { page: 1, pageSize: 200, keyword: (q||'').trim() || undefined, sortBy: 'name', sortOrder: 'asc' } });
    groupOptions.value = Array.isArray(res?.items) ? res.items : [];
  } finally { loadingGroups.value = false; }
}

function onGroupChange(){ load(); }
</script>

<style scoped>
.page { padding: 16px; }
.toolbar { margin-bottom: 12px; }
.pagination { display:flex; justify-content:flex-end; padding: 10px 0; }
</style>
