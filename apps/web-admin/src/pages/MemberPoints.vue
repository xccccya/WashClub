<template>
	<BasePage title="积分管理">
		<template #actions>
			<el-button type="primary" @click="openConfig">积分规则配置</el-button>
			<el-button @click="openAdjust">手动增减积分</el-button>
		</template>
		<el-form :inline="true" class="toolbar">
			<el-form-item label="会员ID">
				<el-input v-model="q.memberId" placeholder="按会员ID筛选" style="width:180px;" />
			</el-form-item>
			<el-form-item label="来源">
				<el-select v-model="q.source" placeholder="全部" style="width:180px;">
					<el-option label="全部" :value="''" />
					<el-option label="支付入账" value="PAY" />
					<el-option label="后台调整" value="ADMIN" />
					<el-option label="退款扣减/返还" value="REFUND" />
					<el-option label="订单使用" value="USE" />
				</el-select>
			</el-form-item>
			<el-button @click="fetchLogs" :loading="loading">查询</el-button>
		</el-form>
		<el-table :data="logs" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column label="会员" width="200">
				<template #default="{ row }">{{ formatMember(row.memberId) }}</template>
			</el-table-column>
			<el-table-column prop="createdAt" label="时间" width="180">
				<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column prop="change" label="变动" width="120">
				<template #default="{ row }"><span :style="{ color: row.change>0?'#16a34a':'#ef4444' }">{{ row.change>0? '+'+row.change : row.change }}</span></template>
			</el-table-column>
			<el-table-column prop="source" label="来源" width="120" />
			<el-table-column label="关联订单" width="180">
				<template #default="{ row }">
					<template v-if="row.orderNo">
						<el-link type="primary" :underline="false" @click="goOrder(row)">{{ row.orderNo }}</el-link>
					</template>
					<template v-else>-</template>
				</template>
			</el-table-column>
			<el-table-column prop="desc" label="备注" />
			<el-table-column label="操作" width="120" fixed="right">
				<template #default="{ row }">
					<el-button link type="primary" size="small" @click="openDetail(row.memberId)">查看详情</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="cfgVisible" title="积分规则配置" width="520px">
			<el-form :model="cfg" label-width="220px">
				<el-form-item label="每1分获取积分（整数）">
					<el-input-number v-model="cfg.pointsPerFen" :min="0" :step="1" :precision="0" style="width:180px;" />
				</el-form-item>
				<el-form-item label="1积分抵扣金额（元）">
					<el-input-number v-model="cfg.pointsFenPerPointYuan" :min="0" :step="0.01" :precision="2" style="width:180px;" />
				</el-form-item>
				<el-form-item label="单笔订单最多抵扣（元，0不限）">
					<el-input-number v-model="cfg.pointsMaxDeductYuan" :min="0" :step="0.01" :precision="2" style="width:180px;" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="cfgVisible=false">取消</el-button>
				<el-button type="primary" @click="saveConfig">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="adjustVisible" title="手动增减积分" width="520px">
			<el-form :model="adjust" label-width="120px">
				<el-form-item label="选择会员">
					<el-select v-model="adjust.memberId" filterable remote reserve-keyword placeholder="输入昵称/手机号搜索" :remote-method="remoteSearchMembers" :loading="memberLoading" style="width:320px;">
						<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name || '-'}（${m.phone}）#${m.id}`" :value="m.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="增减值（可负）">
					<el-input-number v-model="adjust.delta" :step="1" :precision="0" style="width:220px;" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="adjust.remark" style="width:320px;" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="adjustVisible=false">取消</el-button>
				<el-button type="primary" @click="submitAdjust">提交</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="detailVisible" title="积分详情" width="760px">
			<div v-if="detailMember">
				<el-card shadow="never" style="margin-bottom:12px;">
					<div style="display:flex; align-items:center; justify-content: space-between; gap:12px;">
						<div style="display:flex; flex-direction:column; gap:4px;">
							<div><b>UID：</b>{{ detailMember?.uid || '-' }}</div>
							<div><b>昵称：</b>{{ detailMember?.name || '-' }}</div>
							<div><b>手机号：</b>{{ detailMember?.phone || '-' }}</div>
						</div>
						<div style="display:flex; gap:16px;">
							<div style="text-align:center;">
								<div style="font-size:22px; font-weight:800; color:#111827;">{{ detailStats.currentPoints }}</div>
								<div style="font-size:12px; color:#6b7280;">当前积分</div>
							</div>
							<div style="width:1px; background:#eee;" />
							<div style="text-align:center;">
								<div style="font-size:22px; font-weight:800; color:#ef4444;">{{ detailStats.monthUsed }}</div>
								<div style="font-size:12px; color:#6b7280;">本月使用</div>
							</div>
							<div style="width:1px; background:#eee;" />
							<div style="text-align:center;">
								<div style="font-size:22px; font-weight:800; color:#16a34a;">{{ detailStats.monthGained }}</div>
								<div style="font-size:12px; color:#6b7280;">本月获得</div>
							</div>
							<div style="width:1px; background:#eee;" />
							<div style="text-align:center;">
								<div style="font-size:22px; font-weight:800; color:#2563eb;">{{ detailStats.totalDeductYuan.toFixed(2) }}</div>
								<div style="font-size:12px; color:#6b7280;">累计抵扣(元)</div>
							</div>
						</div>
					</div>
				</el-card>

				<div>
					<el-table :data="detailLogs" stripe style="width:100%">
						<el-table-column prop="createdAt" label="时间" width="180">
							<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
						</el-table-column>
						<el-table-column prop="change" label="变动" width="120">
							<template #default="{ row }"><span :style="{ color: row.change>0?'#16a34a':'#ef4444' }">{{ row.change>0? '+'+row.change : row.change }}</span></template>
						</el-table-column>
						<el-table-column prop="source" label="来源" width="120" />
						<el-table-column label="关联订单" width="180">
							<template #default="{ row }">
								<template v-if="row.orderNo">
									<el-link type="primary" :underline="false" @click="goOrder(row)">{{ row.orderNo }}</el-link>
								</template>
								<template v-else>-</template>
							</template>
						</el-table-column>
						<el-table-column prop="desc" label="备注" />
					</el-table>
				</div>
			</div>
			<template #footer>
				<el-button @click="detailVisible=false">关闭</el-button>
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
import router from '../router';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

const q = ref<{ memberId?: string; source?: string }>({});
const loading = ref(false);
const logs = ref<any[]>([]);
const memberMap = ref<Map<number, { id:number; name?:string; phone?:string }>>(new Map());

async function fetchLogs(){
  loading.value = true;
  try{
    const rows = await http<any[]>('/member-points/logs', { method:'GET', query: { memberId: q.value.memberId, source: q.value.source } });
    logs.value = rows;
    const ids = Array.from(new Set((rows||[]).map((r:any)=> Number(r.memberId||0)).filter((n:number)=>n>0)));
    const pending = ids.map(async (id:number)=>{ try{ const m:any = await http(`/member/${id}`, { method:'GET' }); memberMap.value.set(id, { id, name: m?.name, phone: m?.phone }); }catch{} });
    await Promise.all(pending);
  } finally { loading.value = false; }
}

const cfgVisible = ref(false);
const cfg = ref<{ pointsPerFen:number; pointsFenPerPoint:number; pointsMaxDeductFenPerOrder:number; pointsFenPerPointYuan:number; pointsMaxDeductYuan:number }>({ pointsPerFen: 1, pointsFenPerPoint: 0, pointsMaxDeductFenPerOrder: 0, pointsFenPerPointYuan: 0, pointsMaxDeductYuan: 0 });

async function openConfig(){
  try{
    const res:any = await http('/member-points/config', { method:'GET' });
    const fenPerPoint = Number(res?.pointsFenPerPoint || 0);
    const maxFen = Number(res?.pointsMaxDeductFenPerOrder || 0);
    // 允许配置为 0（关闭消费得积分），因此不能用 || 1 作为回退
    cfg.value.pointsPerFen = Number(res?.pointsPerFen ?? 1);
    cfg.value.pointsFenPerPoint = fenPerPoint;
    cfg.value.pointsMaxDeductFenPerOrder = maxFen;
    cfg.value.pointsFenPerPointYuan = +(fenPerPoint / 100).toFixed(2);
    cfg.value.pointsMaxDeductYuan = +(maxFen / 100).toFixed(2);
    cfgVisible.value = true;
  }catch(e:any){ ElMessage.error(String(e?.message||e||'加载失败')); }
}
async function saveConfig(){
  try{
    const payload = {
      pointsPerFen: cfg.value.pointsPerFen,
      pointsFenPerPoint: Math.round((cfg.value.pointsFenPerPointYuan || 0) * 100),
      pointsMaxDeductFenPerOrder: Math.round((cfg.value.pointsMaxDeductYuan || 0) * 100),
    };
    await http('/member-points/config', { method:'POST', body: payload });
    ElMessage.success('已保存'); cfgVisible.value=false;
  }catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

const adjustVisible = ref(false);
const adjust = ref<{ memberId?: number; delta?: number; remark?: string }>({});
function openAdjust(){ adjust.value = {}; adjustVisible.value = true; }
const memberOptions = ref<any[]>([]);
const memberLoading = ref(false);
async function remoteSearchMembers(keyword: string){
  memberLoading.value = true;
  try{
    const res:any = await http('/member/list', { method:'GET', query:{ page: 1, pageSize: 20, keyword } });
    memberOptions.value = Array.isArray(res?.items) ? res.items : [];
  } finally { memberLoading.value = false; }
}
async function submitAdjust(){
  try{
    await http('/member-points/adjust', { method:'POST', body: { ...adjust.value, operatorUserId: getUserId() } });
    ElMessage.success('已调整'); adjustVisible.value=false; fetchLogs();
  }catch(e:any){ ElMessage.error(String(e?.message||e||'提交失败')); }
}

onMounted(()=>{ fetchLogs(); });

function formatTime(t?: string){ try{ return new Date(t||'').toLocaleString(); }catch{ return String(t||'-'); } }
function getUserId(): number | null { try{ const s = localStorage.getItem('user')||'{}'; const u = JSON.parse(s); return Number(u?.id||0) || null; }catch{ return null; } }
function goOrder(row:any){
  try{
    const id = Number(row?.orderId || 0);
    const no = String(row?.orderNo || '');
    if (id) { router.push('/orders/' + id); return; }
    if (no) { router.push('/orders/no/' + encodeURIComponent(no)); return; }
  }catch(e){}
}

function formatMember(memberId?: number){
  const id = Number(memberId||0); if (!id) return '-';
  const m = memberMap.value.get(id); if (!m) return `#${id}`;
  const name = m?.name || '-'; const phone = m?.phone || '-';
  return `${name}（${phone}）`;
}

const detailVisible = ref(false);
const detailMember = ref<any>(null);
const detailLogs = ref<any[]>([]);
const detailStats = ref<{ currentPoints:number; monthUsed:number; monthGained:number; totalDeductFen:number; totalDeductYuan:number }>({ currentPoints:0, monthUsed:0, monthGained:0, totalDeductFen:0, totalDeductYuan:0 });
async function openDetail(memberId: number){
  try{
    const [m, rows, cfg]: any = await Promise.all([
      http(`/member/${memberId}`, { method:'GET' }),
      http<any[]>('/member-points/logs', { method:'GET', query:{ memberId } }),
      http('/member-points/config', { method:'GET' }),
    ]);
    const logsArr:any[] = Array.isArray(rows) ? rows : [];
    detailMember.value = m || null;
    detailLogs.value = logsArr;

    const currentPoints = Math.max(0, Number(m?.points || 0));
    const fenPerPoint = Math.max(0, Number(cfg?.pointsFenPerPoint || 0));

    // 本月范围
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 1, 0, 0, 0, 0);
    let monthUsed = 0, monthGained = 0, refundReturnedPos = 0;
    for (const r of logsArr){
      const createdAt = new Date(r?.createdAt || 0);
      if (!(createdAt >= start && createdAt < end)) continue;
      const ch = Number(r?.change || 0);
      const src = String(r?.source || '');
      if (src === 'USE' && ch < 0) monthUsed += Math.abs(ch);
      if (src === 'REFUND' && ch > 0) refundReturnedPos += ch; // 退款返还
      if ((src === 'PAY' || src === 'ADMIN') && ch > 0) monthGained += ch;
      if (src === 'REFUND' && ch < 0) monthGained += ch; // 扣除本月获得
    }
    monthUsed = Math.max(0, monthUsed - refundReturnedPos);
    if (monthGained < 0) monthGained = 0;

    // 累计抵扣金额（元）：净使用积分 * 单位面值
    let totalUse = 0, totalRefundReturn = 0;
    for (const r of logsArr){
      const ch = Number(r?.change || 0);
      const src = String(r?.source || '');
      if (src === 'USE' && ch < 0) totalUse += Math.abs(ch);
      if (src === 'REFUND' && ch > 0) totalRefundReturn += ch;
    }
    const netUsedPoints = Math.max(0, totalUse - totalRefundReturn);
    const totalDeductFen = Math.max(0, Math.floor(netUsedPoints * fenPerPoint));
    const totalDeductYuan = +(totalDeductFen / 100).toFixed(2);

    detailStats.value = { currentPoints, monthUsed, monthGained, totalDeductFen, totalDeductYuan };
    detailVisible.value = true;
  }catch(e:any){ ElMessage.error(String(e?.message||e||'加载失败')); }
}
</script>

<style>
.toolbar { margin: 6px 0 12px 0; }
</style>


