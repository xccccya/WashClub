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
			<el-table-column prop="memberId" label="会员ID" width="100" />
			<el-table-column prop="dateStr" label="日期" width="140" />
			<el-table-column prop="growthGranted" label="成长值" width="100" />
			<el-table-column prop="createdAt" label="创建时间" />
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

async function fetchLogs(){
	loading.value = true;
	try{ logs.value = await http<any[]>('/member-signin/logs', { method:'GET', query: { memberId: q.value.memberId, date: q.value.date } }); }
	finally{ loading.value = false; }
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
</script>

<style>
.toolbar { margin: 6px 0 12px 0; }
</style>


