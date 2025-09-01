<template>
	<div class="dashboard">
		<div class="header">
			<div class="title">
				<h2>运营概览</h2>
				<p class="sub">核心指标总览</p>
			</div>
			<el-radio-group v-model="range" size="small" @change="fetchData" class="range-switch">
				<el-radio-button label="today">今日</el-radio-button>
				<el-radio-button label="last7">近七日</el-radio-button>
				<el-radio-button label="last30">近一月</el-radio-button>
				<el-radio-button label="thisMonth">本月</el-radio-button>
			</el-radio-group>
		</div>

		<el-card shadow="never" class="overview-card" v-loading="loading">
			<template #header>
				<div class="card-header">
					<span>关键运营数据</span>
					<small class="timerange">{{ timeText }}</small>
				</div>
			</template>
			<div class="metrics-grid">
				<div class="metric-item">
					<img class="icon-img" :src="iconOrderNum" alt="订单笔数" />
					<div class="meta">
						<div class="label">订单笔数</div>
						<div class="value">{{ data?.orderCount ?? '-' }}</div>
					</div>
				</div>
				<div class="metric-item">
					<img class="icon-img" :src="iconPayAmount" alt="支付金额" />
					<div class="meta">
						<div class="label">支付金额</div>
						<div class="value">{{ formatCurrency(data?.payAmount) }}</div>
					</div>
				</div>
				<div class="metric-item">
					<img class="icon-img" :src="iconWashcardDeduct" alt="洗车卡划扣" />
					<div class="meta">
						<div class="label">洗车卡划扣</div>
						<div class="value">{{ data?.washcardDeductTimes ?? '-' }}</div>
					</div>
				</div>
				<div class="metric-item">
					<img class="icon-img" :src="iconMemberActive" alt="活跃会员数" />
					<div class="meta">
						<div class="label">活跃会员数</div>
						<div class="value">{{ data?.activeMembers ?? '-' }}</div>
					</div>
				</div>
				<div class="metric-item">
					<img class="icon-img" :src="iconMemberAdded" alt="新增会员数" />
					<div class="meta">
						<div class="label">新增会员数</div>
						<div class="value">{{ data?.newMembers ?? '-' }}</div>
					</div>
				</div>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import iconOrderNum from '../static/icons/orderaddnum.png';
import iconPayAmount from '../static/icons/realrecive.png';
import iconWashcardDeduct from '../static/icons/washcardconfirm.png';
import iconMemberActive from '../static/icons/member_active.png';
import iconMemberAdded from '../static/icons/member_added.png';

type RangeKey = 'today' | 'last7' | 'last30' | 'thisMonth';
type OverviewResp = {
	range: RangeKey;
	startAt: string;
	endAt: string;
	orderCount: number;
	payAmount: number;
	washcardDeductTimes: number;
	activeMembers: number;
	newMembers: number;
};

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const range = ref<RangeKey>('today');
const loading = ref(false);
const data = ref<OverviewResp | null>(null);

const timeText = computed(() => {
	if (!data.value) return '';
	const s = new Date(data.value.startAt);
	const e = new Date(data.value.endAt);
	const sText = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}`;
	const eAdj = new Date(e.getTime() - 1);
	const eText = `${eAdj.getFullYear()}-${String(eAdj.getMonth()+1).padStart(2,'0')}-${String(eAdj.getDate()).padStart(2,'0')}`;
	return `${sText} ~ ${eText}`;
});

function formatCurrency(n?: number){
	if (n == null) return '-';
	return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(n);
}

async function fetchData(){
	loading.value = true;
	try{
		const resp = await http<OverviewResp>('/system/metrics/overview', { query: { range: range.value } });
		data.value = resp;
	}catch(e:any){
		ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '加载失败');
	}finally{
		loading.value = false;
	}
}

onMounted(() => { fetchData(); });
</script>

<style scoped>
.dashboard { padding: 12px; display:flex; flex-direction:column; gap:12px; }
.header { display:flex; align-items:center; justify-content:space-between; }
.title h2 { margin:0; font-size:18px; }
.title .sub { margin:2px 0 0; color: var(--el-text-color-secondary); font-size:12px; }
.range-switch :deep(.el-radio-button__inner){ padding:6px 10px; }

.overview-card { --gap: 12px; }
.card-header { display:flex; align-items:center; justify-content:space-between; }
.card-header .timerange { color: var(--el-text-color-secondary); }

.metrics-grid { display:grid; grid-template-columns: repeat(5, 1fr); gap: var(--gap); }
.metric-item { display:flex; align-items:center; gap:10px; padding:12px; border:1px solid color-mix(in oklab, var(--el-color-primary), transparent 78%); border-radius:10px; background: color-mix(in oklab, var(--el-color-primary), transparent 90%); }
.metric-item .icon-img { width:36px; height:36px; display:block; }
.metric-item .meta { display:flex; flex-direction:column; gap:6px; }
.metric-item .label { font-size:12px; color: var(--el-text-color-secondary); }
.metric-item .value { font-size:20px; font-weight:700; line-height:1; }

@media (max-width: 1280px){
	.metrics-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 860px){
	.metrics-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 520px){
	.metrics-grid { grid-template-columns: 1fr; }
}
</style>


