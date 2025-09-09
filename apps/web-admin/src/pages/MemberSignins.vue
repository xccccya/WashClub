<template>
	<BasePage title="签到管理">
		<template #actions>
			<el-button type="primary" @click="openConfig">配置签到奖励</el-button>
		</template>
		<el-form :inline="true" class="toolbar">
			<el-form-item label="会员ID">
				<el-input v-model="q.memberId" placeholder="按会员ID筛选" style="width:180px;" />
			</el-form-item>
			<el-form-item label="日期">
				<el-date-picker v-model="q.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
			</el-form-item>
			<el-button @click="fetchLogs" :loading="loading">查询</el-button>
		</el-form>
		<el-table :data="logs" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column label="会员" width="200">
				<template #default="{ row }">{{ formatMember(row.memberId) }}</template>
			</el-table-column>
			<el-table-column prop="dateStr" label="签到时间" width="180">
				<template #default="{ row }">{{ formatLocal(row.dateStr) }}</template>
			</el-table-column>
			<el-table-column prop="growthGranted" label="成长值" width="100" />
			<el-table-column label="连续天数" width="120">
				<template #default="{ row }">{{ getStreak(row.memberId)?.streakDays ?? '-' }}</template>
			</el-table-column>
			<el-table-column label="总天数" width="120">
				<template #default="{ row }">{{ getStreak(row.memberId)?.totalDays ?? '-' }}</template>
			</el-table-column>
			<el-table-column label="操作" width="140" fixed="right">
				<template #default="{ row }">
					<el-button link type="primary" size="small" @click="openDetail(row.memberId)">查看详情</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="cfgVisible" title="签到奖励配置" width="520px">
			<el-form :model="cfg" label-width="160px">
				<el-form-item label="连续1-7天奖励">
					<div style="display:flex; gap:8px; flex-wrap:wrap;">
						<el-input v-for="i in 7" :key="i" v-model.number="cfg.dayRewards[i-1]" style="width:72px;" />
					</div>
				</el-form-item>
				<el-form-item label="第8天及以后固定奖励">
					<el-input v-model.number="cfg.after7" style="width:180px;" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="cfgVisible=false">取消</el-button>
				<el-button type="primary" @click="saveConfig">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="detailVisible" title="签到详情" width="760px">
			<div v-if="detail">
				<el-card shadow="never" style="margin-bottom:12px;">
					<div style="display:flex; align-items:center; justify-content: space-between; gap:12px;">
						<div style="display:flex; flex-direction:column; gap:4px;">
							<div><b>UID：</b>{{ detailMember?.uid || '-' }}</div>
							<div><b>昵称：</b>{{ detailMember?.name || '-' }}</div>
							<div><b>手机号：</b>{{ detailMember?.phone || '-' }}</div>
						</div>
						<div style="display:flex; gap:16px;">
							<div style="text-align:center;">
								<div style="font-size:22px; font-weight:800; color:#111827;">{{ detail.totalDays }}</div>
								<div style="font-size:12px; color:#6b7280;">累计天数</div>
							</div>
							<div style="width:1px; background:#eee;" />
							<div style="text-align:center;">
								<div style="font-size:22px; font-weight:800; color:#2563eb;">{{ detail.streakDays }}</div>
								<div style="font-size:12px; color:#6b7280;">连续天数</div>
							</div>
							<div style="width:1px; background:#eee;" />
							<div style="text-align:center;">
								<div style="font-size:22px; font-weight:800; color:#16a34a;">{{ detail.totalGrowth }}</div>
								<div style="font-size:12px; color:#6b7280;">总成长值</div>
							</div>
						</div>
					</div>
				</el-card>
				<el-descriptions :column="2" border>
					<el-descriptions-item label="最近一次签到时间">{{ formatLocal(detail.lastSignDate) }}</el-descriptions-item>
					<el-descriptions-item label="今日是否已签">{{ detail.todaySigned ? '是' : '否' }}</el-descriptions-item>
					<el-descriptions-item label="最大连续签到天数">{{ detail.maxStreak ?? '-' }}</el-descriptions-item>
				</el-descriptions>
				<div style="margin-top:12px;">
					<el-table :data="detailLogs" stripe style="width:100%">
						<el-table-column prop="dateStr" label="签到时间" width="180">
							<template #default="{ row }">{{ formatLocal(row.dateStr) }}</template>
						</el-table-column>
						<el-table-column prop="growthGranted" label="成长值" width="120" />
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

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

const q = ref<{ memberId?: string; date?: string }>({});
const loading = ref(false);
const logs = ref<any[]>([]);
const memberMap = ref<Map<number, { id:number; name?:string; phone?:string }>>(new Map());
type StreakInfo = { streakDays:number; totalDays:number };
const streakMap = ref<Map<number, StreakInfo>>(new Map());

async function fetchLogs(){
	loading.value = true;
	try{
		const rows = await http<any[]>('/member-signin/logs', { method:'GET', query: { memberId: q.value.memberId, date: q.value.date } });
		logs.value = rows;
		// 并发获取每个会员的统计数据，去重 memberId
		const ids = Array.from(new Set((rows||[]).map((r:any)=> Number(r.memberId||0)).filter((n:number)=>n>0)));
		const pending = ids.map(async (id:number)=>{
			try{ const s = await http<StreakInfo>('/member-signin/member-status', { method:'GET', query:{ memberId: id } });
				streakMap.value.set(id, { streakDays: Number(s?.streakDays||0), totalDays: Number(s?.totalDays||0) });
			}catch{ streakMap.value.set(id, { streakDays: 0, totalDays: 0 }); }
		});
		const pendingMembers = ids.map(async (id:number)=>{
			try{ const m:any = await http(`/member/${id}`, { method:'GET' }); memberMap.value.set(id, { id, name: m?.name, phone: m?.phone }); }catch{}
		});
		await Promise.all([...pending, ...pendingMembers]);
	} finally { loading.value = false; }
}

const cfgVisible = ref(false);
const cfg = ref<{ dayRewards: number[]; after7: number }>({ dayRewards: [1,1,1,1,1,1,1], after7: 1 });

async function openConfig(){
	try{ const res = await http<{ dayRewards: number[]; after7: number }>('/member-signin/config', { method: 'GET' });
		cfg.value.dayRewards = new Array(7).fill(1).map((_,i)=> Number((res?.dayRewards||[])[i]||1));
		cfg.value.after7 = Number(res?.after7 || cfg.value.dayRewards[6] || 1);
		cfgVisible.value = true;
	}catch(e:any){ ElMessage.error(String(e?.message||e||'加载失败')); }
}

async function saveConfig(){
	try{
		await http('/member-signin/config', { method: 'POST', body: cfg.value });
		ElMessage.success('已保存'); cfgVisible.value = false;
	}catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

onMounted(()=>{ fetchLogs(); });

function formatLocal(dateStr?: string){
	if (!dateStr) return '-';
	try{
		// dateStr 为 YYYY-MM-DD；补充本地时区0点
		const d = new Date(`${dateStr}T00:00:00`);
		const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
		return `${y}-${m}-${dd}`;
	}catch{ return String(dateStr); }
}

const detailVisible = ref(false);
const detail = ref<any>(null);
const detailLogs = ref<any[]>([]);
const detailMember = ref<any>(null);
async function openDetail(memberId: number){
	try{
		const [s, rows, m] = await Promise.all([
			http('/member-signin/member-status', { method:'GET', query:{ memberId } }),
			http<any[]>('/member-signin/logs', { method:'GET', query:{ memberId } }),
			http(`/member/${memberId}`, { method:'GET' }),
		]);
		detail.value = s; detailLogs.value = rows; detailMember.value = m;
		detailVisible.value = true;
	}catch(e:any){ ElMessage.error(String(e?.message||e||'加载失败')); }
}

function getStreak(memberId?: number): StreakInfo | undefined {
  try{
    const id = Number(memberId||0); if (!id) return undefined;
    return streakMap.value.get(id);
  }catch{ return undefined; }
}

function formatMember(memberId?: number){
  const id = Number(memberId||0); if (!id) return '-';
  const m = memberMap.value.get(id); if (!m) return `#${id}`;
  const name = m?.name || '-'; const phone = m?.phone || '-';
  return `${name}（${phone}）`;
}
</script>

<style>
.toolbar { margin: 6px 0 12px 0; }
</style>


