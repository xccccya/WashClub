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
			<el-table-column prop="memberId" label="会员ID" width="100" />
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

		<el-dialog v-model="cfgVisible" title="积分规则配置" width="520px">
			<el-form :model="cfg" label-width="220px">
				<el-form-item label="每1元获取积分（整数）">
					<el-input-number v-model="cfg.pointsPerYuan" :min="0" :step="1" :precision="0" style="width:180px;" />
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

async function fetchLogs(){
  loading.value = true;
  try{
    logs.value = await http<any[]>('/member-points/logs', { method:'GET', query: { memberId: q.value.memberId, source: q.value.source } });
  } finally { loading.value = false; }
}

const cfgVisible = ref(false);
const cfg = ref<{ pointsPerYuan:number; pointsFenPerPoint:number; pointsMaxDeductFenPerOrder:number; pointsFenPerPointYuan:number; pointsMaxDeductYuan:number }>({ pointsPerYuan: 1, pointsFenPerPoint: 0, pointsMaxDeductFenPerOrder: 0, pointsFenPerPointYuan: 0, pointsMaxDeductYuan: 0 });

async function openConfig(){
  try{
    const res:any = await http('/member-points/config', { method:'GET' });
    const fenPerPoint = Number(res?.pointsFenPerPoint || 0);
    const maxFen = Number(res?.pointsMaxDeductFenPerOrder || 0);
    // 允许配置为 0（关闭消费得积分），因此不能用 || 1 作为回退
    cfg.value.pointsPerYuan = Number(res?.pointsPerYuan ?? 1);
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
      pointsPerYuan: cfg.value.pointsPerYuan,
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
</script>

<style>
.toolbar { margin: 6px 0 12px 0; }
</style>


