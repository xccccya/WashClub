<template>
	<div class="dashboard">
		<div class="header">
			<div class="title">
				<h2>运营概览</h2>
				<p class="sub">核心指标总览</p>
			</div>
			<el-space wrap alignment="center" size="small" class="filters">
				<el-segmented v-model="filterMode" :options="filterModeOptions" size="small" @change="onModeChange" />

				<template v-if="filterMode === 'preset'">
					<el-segmented v-model="presetRange" :options="presetOptions" size="small" @change="applyFilter" />
				</template>

				<template v-else-if="filterMode === 'month'">
					<el-date-picker
						v-model="monthValue"
						type="month"
						placeholder="选择月份"
						format="YYYY-MM"
						value-format="YYYY-MM"
						teleported
						clearable
						@change="onFilterAutoApply"
					/>
				</template>

				<template v-else>
					<el-date-picker
						v-model="dateRangeValue"
						type="daterange"
						unlink-panels
						range-separator="~"
						start-placeholder="开始日期"
						end-placeholder="结束日期"
						format="YYYY-MM-DD"
						value-format="YYYY-MM-DD"
						teleported
						clearable
						:shortcuts="rangeShortcuts"
						@change="onFilterAutoApply"
					/>
				</template>

				<el-space :size="10" alignment="center" class="filter-actions">
					<el-button round type="primary" :icon="RefreshRight" :loading="loading || seriesLoading" @click="applyFilter">
						刷新
					</el-button>
					<el-button round plain :icon="RefreshLeft" :disabled="loading || seriesLoading" @click="resetFilter">重置</el-button>
				</el-space>
			</el-space>
		</div>

		<el-card shadow="never" class="overview-card" v-loading="loading">
			<template #header>
				<div class="card-header">
					<span>关键运营数据</span>
					<small class="timerange">{{ timeText }}</small>
				</div>
			</template>
			<el-row :gutter="12">
				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon">
							<el-icon size="32" color="#409eff"><ShoppingBag /></el-icon>
						</div>
						<div class="meta">
							<div class="label">订单笔数</div>
							<div class="value">{{ data?.orderCount ?? '-' }}</div>
							<div class="delta" :data-up="(data?.compare?.orderCountRate||0) > 0" :data-down="(data?.compare?.orderCountRate||0) < 0">
								<span class="arrow" v-if="data?.compare">
									{{ arrow(data.compare.orderCountRate) }}
								</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data.compare.orderCountRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data.compare.base) }}</span>
							</div>
						</div>
					</div>
				</el-col>

				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon">
							<el-icon size="32" color="#409eff"><Tickets /></el-icon>
						</div>
						<div class="meta">
							<div class="label">洗车数量(总)</div>
							<div class="value">{{ data?.washCount ?? '-' }}</div>
							<div class="delta" :data-up="(data?.compare?.washCountRate||0) > 0" :data-down="(data?.compare?.washCountRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data.compare.washCountRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data.compare.washCountRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data.compare.base) }}</span>
							</div>
						</div>
					</div>
				</el-col>

				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon">
							<el-icon size="32" color="#67c23a"><Money /></el-icon>
						</div>
						<div class="meta">
							<div class="label">支付金额(净)</div>
							<div class="value">{{ formatCurrency(data?.payAmount) }}</div>
							<div class="delta" :data-up="(data?.compare?.payAmountRate||0) > 0" :data-down="(data?.compare?.payAmountRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data.compare.payAmountRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data.compare.payAmountRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data.compare.base) }}</span>
							</div>
						</div>
					</div>
				</el-col>

				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon">
							<el-icon size="32" color="#e6a23c"><CreditCard /></el-icon>
						</div>
						<div class="meta">
							<div class="label">洗车卡划扣</div>
							<div class="value">{{ data?.washcardDeductTimes ?? '-' }}</div>
							<div class="delta" :data-up="(data?.compare?.washcardDeductTimesRate||0) > 0" :data-down="(data?.compare?.washcardDeductTimesRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data.compare.washcardDeductTimesRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data.compare.washcardDeductTimesRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data.compare.base) }}</span>
							</div>
						</div>
					</div>
				</el-col>

				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon">
							<el-icon size="32" color="#f56c6c"><User /></el-icon>
						</div>
						<div class="meta">
							<div class="label">活跃会员数</div>
							<div class="value">{{ data?.activeMembers ?? '-' }}</div>
							<div class="delta" :data-up="(data?.compare?.activeMembersRate||0) > 0" :data-down="(data?.compare?.activeMembersRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data.compare.activeMembersRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data.compare.activeMembersRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data.compare.base) }}</span>
							</div>
						</div>
					</div>
				</el-col>

				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon">
							<el-icon size="32" color="#909399"><UserFilled /></el-icon>
						</div>
						<div class="meta">
							<div class="label">新增会员数</div>
							<div class="value">{{ data?.newMembers ?? '-' }}</div>
							<div class="delta" :data-up="(data?.compare?.newMembersRate||0) > 0" :data-down="(data?.compare?.newMembersRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data.compare.newMembersRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data.compare.newMembersRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data.compare.base) }}</span>
							</div>
						</div>
					</div>
				</el-col>
			</el-row>
		</el-card>

		<!-- 累计数据卡片 -->
		<el-card shadow="never">
			<template #header>
				<div class="card-header">
					<span>累计数据</span>
				</div>
			</template>
			<el-row :gutter="12">
				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#67c23a"><Money /></el-icon></div>
						<div class="meta">
							<div class="label">累计交易金额(净)</div>
							<div class="value">{{ formatCurrency(data?.cumulative?.transactionAmount ?? 0) }}</div>
						</div>
					</div>
				</el-col>
				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#409eff"><Tickets /></el-icon></div>
						<div class="meta">
							<div class="label">累计订单数</div>
							<div class="value">{{ data?.cumulative?.orderCount ?? '-' }}</div>
						</div>
					</div>
				</el-col>
				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#409eff"><Tickets /></el-icon></div>
						<div class="meta">
							<div class="label">累计洗车数量</div>
							<div class="value">{{ data?.cumulative?.washCount ?? '-' }}</div>
						</div>
					</div>
				</el-col>
				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#e6a23c"><CreditCard /></el-icon></div>
						<div class="meta">
							<div class="label">累计洗车卡划扣(次)</div>
							<div class="value">{{ data?.cumulative?.washcardDeductTimes ?? '-' }}</div>
						</div>
					</div>
				</el-col>
				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#f56c6c"><User /></el-icon></div>
						<div class="meta">
							<div class="label">总会员数</div>
							<div class="value">{{ data?.cumulative?.totalMembers ?? '-' }}</div>
						</div>
					</div>
				</el-col>
				<el-col :xs="24" :sm="12" :md="8" :lg="4">
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#e6a23c"><OfficeBuilding /></el-icon></div>
						<div class="meta">
							<div class="label">总集团客户数</div>
							<div class="value">{{ data?.cumulative?.totalGroups ?? '-' }}</div>
						</div>
					</div>
				</el-col>
			</el-row>
		</el-card>

		<!-- 折线图报表 -->
		<el-card shadow="never">
			<template #header>
				<div class="card-header">
					<span>数据报表</span>
					<small class="timerange">{{ timeText }}</small>
				</div>
			</template>
			<el-skeleton :loading="seriesLoading" animated :throttle="200">
				<template #template>
					<div class="charts-grid">
						<el-skeleton-item variant="rect" class="echart" />
						<el-skeleton-item variant="rect" class="echart" />
						<el-skeleton-item variant="rect" class="echart" />
					</div>
				</template>
				<template #default>
					<el-row :gutter="12">
						<el-col :xs="24" :md="8">
							<div class="chart">
								<div class="chart-title">订单笔数</div>
								<el-empty v-if="ordersEmpty" description="暂无数据" />
								<v-chart v-else autoresize :option="ordersOption" class="echart" />
							</div>
						</el-col>
						<el-col :xs="24" :md="8">
							<div class="chart">
								<div class="chart-title">支付金额(净)</div>
								<el-empty v-if="paymentsEmpty" description="暂无数据" />
								<v-chart v-else autoresize :option="paymentsOption" class="echart" />
							</div>
						</el-col>
						<el-col :xs="24" :md="8">
							<div class="chart">
								<div class="chart-title">洗车卡划扣(次)</div>
								<el-empty v-if="washcardEmpty" description="暂无数据" />
								<v-chart v-else autoresize :option="washcardOption" class="echart" />
							</div>
						</el-col>
					</el-row>
				</template>
			</el-skeleton>
		</el-card>

		<!-- 每日明细 -->
		<el-card shadow="never" class="daily-card">
			<template #header>
				<div class="card-header">
					<span>每日明细</span>
					<el-space wrap size="small" alignment="center" class="daily-header-right">
						<small class="timerange">{{ timeText }}</small>
						<template v-if="dailyRows.length">
							<el-tag round effect="light" type="info">订单：{{ dailySummary.orders }}</el-tag>
							<el-tag round effect="light" type="info">洗车：{{ dailySummary.washcount }}</el-tag>
							<el-tag round effect="light" type="info">卡扣：{{ dailySummary.washcard }}</el-tag>
							<el-tag round effect="light" type="success">净支付：{{ formatCurrency(dailySummary.payments) }}</el-tag>
						</template>
					</el-space>
				</div>
			</template>

			<el-table
				class="daily-table"
				:data="dailyRows"
				size="small"
				stripe
				highlight-current-row
				:row-style="{ cursor: 'default' }"
				:max-height="420"
				:empty-text="dailyEmptyText"
			>
				<el-table-column prop="date" label="日期" width="120" fixed />
				<el-table-column prop="orders" label="订单" align="right" width="110" />
				<el-table-column prop="washcount" label="洗车(总)" align="right" width="120" />
				<el-table-column prop="washcard" label="卡扣(次)" align="right" width="120" />
				<el-table-column prop="payments" label="净支付金额" align="right" min-width="160">
					<template #default="{ row }">
						<span class="money">{{ formatCurrency(row.payments) }}</span>
					</template>
				</el-table-column>
			</el-table>

			<div class="daily-footer" v-if="dailyRows.length">
				<el-space wrap size="small" alignment="center">
					<el-statistic title="订单合计" :value="dailySummary.orders" />
					<el-statistic title="洗车合计" :value="dailySummary.washcount" />
					<el-statistic title="卡扣合计" :value="dailySummary.washcard" />
					<el-statistic title="净支付合计" :value="dailySummary.payments" :formatter="(v:number)=>formatCurrency(v)" />
				</el-space>
			</div>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { ShoppingBag, Money, CreditCard, User, UserFilled, Tickets, OfficeBuilding, RefreshRight, RefreshLeft } from '@element-plus/icons-vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { metricsControllerOverview, metricsControllerSeries } from '@wash/api-client';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent]);

type PresetRangeKey = 'today' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth';
type FilterMode = 'preset' | 'month' | 'range';
type OverviewResp = {
	range: string;
	startAt: string;
	endAt: string;
	orderCount: number;
	payAmount: number;
	washCount: number;
	washcardDeductTimes: number;
	activeMembers: number;
	newMembers: number;
  cumulative?: { transactionAmount: number; orderCount: number; totalMembers: number; totalGroups: number; washCount: number; washcardDeductTimes: number };
  compare?: {
    base: 'yesterday'|'prev7'|'prev30'|'lastMonth'|'prevMonth'|'prevPeriod';
    orderCountPrev: number; orderCountRate: number|null;
    payAmountPrev: number; payAmountRate: number|null;
    washcardDeductTimesPrev: number; washcardDeductTimesRate: number|null;
    washCountPrev: number; washCountRate: number|null;
    activeMembersPrev: number; activeMembersRate: number|null;
    newMembersPrev: number; newMembersRate: number|null;
  };
};

type MetricsTimeQuery = {
	range?: PresetRangeKey;
	start?: string;
	end?: string;
	month?: string;
};

const filterMode = ref<FilterMode>('preset');
const filterModeOptions = [
	{ label: '预置', value: 'preset' },
	{ label: '指定月', value: 'month' },
	{ label: '日期区间', value: 'range' },
];

const presetRange = ref<PresetRangeKey>('today');
const presetOptions = [
	{ label: '今日', value: 'today' },
	{ label: '近七日', value: 'last7' },
	{ label: '近一月', value: 'last30' },
	{ label: '本月', value: 'thisMonth' },
	{ label: '上月', value: 'lastMonth' },
];

const monthValue = ref<string>('');
const dateRangeValue = ref<[string, string] | null>(null);
const lastQuery = ref<MetricsTimeQuery>({ range: 'today' });

const loading = ref(false);
const data = ref<OverviewResp | null>(null);
const seriesLoading = ref(false);
const ordersOption = ref<any>({});
const paymentsOption = ref<any>({});
const washcardOption = ref<any>({});
const ordersPoints = ref<any[]>([]);
const paymentsPoints = ref<any[]>([]);
const washcardPoints = ref<any[]>([]);
const washcountPoints = ref<any[]>([]);
const ordersEmpty = computed(()=>!ordersPoints.value?.length || ordersPoints.value.every((p:any)=>Number(p.value||0)===0));
const paymentsEmpty = computed(()=>!paymentsPoints.value?.length || paymentsPoints.value.every((p:any)=>Number(p.value||0)===0));
const washcardEmpty = computed(()=>!washcardPoints.value?.length || washcardPoints.value.every((p:any)=>Number(p.value||0)===0));
const dailyEmptyText = computed(()=> seriesLoading.value ? '加载中…' : '暂无数据');

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

function baseLabel(b: 'yesterday'|'prev7'|'prev30'|'lastMonth'|'prevMonth'|'prevPeriod'){
  return b==='yesterday' ? '昨日'
	: b==='prev7' ? '前七日'
	: b==='prev30' ? '前一月'
	: b==='lastMonth' ? '昨月'
	: b==='prevMonth' ? '上上月'
	: '上一周期';
}

function fmtRate(rate: number|null|undefined){
  if (rate===null || rate===undefined) return '—';
  return `${(rate*100).toFixed(1)}%`;
}

function arrow(rate: number|null|undefined){
  if (rate===null || rate===undefined) return '';
  if (rate>0) return '↑';
  if (rate<0) return '↓';
  return '→';
}

function addDays(dateOnly: string, days: number): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateOnly || '').trim());
	if (!m) return dateOnly;
	const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
	const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
	dt.setDate(dt.getDate() + days);
	const yy = dt.getFullYear();
	const mm = String(dt.getMonth() + 1).padStart(2, '0');
	const dd = String(dt.getDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}

function fmtDateOnlyLocal(dt: Date): string {
	const yy = dt.getFullYear();
	const mm = String(dt.getMonth() + 1).padStart(2, '0');
	const dd = String(dt.getDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}

const rangeShortcuts = [
	{
		text: '近七日',
		value: () => {
			const end = new Date();
			end.setHours(0, 0, 0, 0);
			const start = new Date(end);
			start.setDate(start.getDate() - 6);
			return [fmtDateOnlyLocal(start), fmtDateOnlyLocal(end)] as [string, string];
		},
	},
	{
		text: '近一月',
		value: () => {
			const end = new Date();
			end.setHours(0, 0, 0, 0);
			const start = new Date(end);
			start.setDate(start.getDate() - 29);
			return [fmtDateOnlyLocal(start), fmtDateOnlyLocal(end)] as [string, string];
		},
	},
	{
		text: '本月',
		value: () => {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
			const end = new Date();
			end.setHours(0, 0, 0, 0);
			return [fmtDateOnlyLocal(start), fmtDateOnlyLocal(end)] as [string, string];
		},
	},
	{
		text: '上月',
		value: () => {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
			const end = new Date(now.getFullYear(), now.getMonth(), 0, 0, 0, 0, 0);
			return [fmtDateOnlyLocal(start), fmtDateOnlyLocal(end)] as [string, string];
		},
	},
];

function buildQuery(): MetricsTimeQuery | null {
	if (filterMode.value === 'preset') return { range: presetRange.value };
	if (filterMode.value === 'month') {
		if (!monthValue.value) return null;
		return { month: monthValue.value };
	}
	// range: dateRangeValue 为 [startDate, endDate]（包含 endDate），后端是 [start, end) 所以 end + 1 天
	if (!dateRangeValue.value?.[0] || !dateRangeValue.value?.[1]) return null;
	return {
		start: dateRangeValue.value[0],
		end: addDays(dateRangeValue.value[1], 1),
	};
}

function onFilterAutoApply(){
	// month / range：选择完成后自动触发一次；也允许用户手动点“刷新”
	const q = buildQuery();
	if (!q) return;
	applyFilter();
}

function onModeChange(){
	// 切换到预置：直接刷新；切换到其他：等待用户选值后自动应用/手动刷新
	if (filterMode.value === 'preset') applyFilter();
}

function applyFilter(){
	const q = buildQuery();
	if (!q) {
		ElMessage.warning(filterMode.value === 'month' ? '请选择月份' : filterMode.value === 'range' ? '请选择日期区间' : '请选择时间范围');
		return;
	}
	lastQuery.value = q;
	fetchData(q);
	fetchSeries(q);
}

function resetFilter(){
	filterMode.value = 'preset';
	presetRange.value = 'today';
	monthValue.value = '';
	dateRangeValue.value = null;
	applyFilter();
}

async function fetchData(q: MetricsTimeQuery = lastQuery.value){
	loading.value = true;
	try{
		// 注意：openapi 对返回体未完整建模，这里按后端实际返回结构使用
		const resp = (await metricsControllerOverview(q as any) as unknown) as OverviewResp;
		data.value = resp as any;
	}catch(e:any){
		ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '加载失败');
	}finally{
		loading.value = false;
	}
}

async function fetchSeries(q: MetricsTimeQuery = lastQuery.value){
  seriesLoading.value = true;
  try{
    const [orders, payments, washcard, washcount] = await Promise.all([
      metricsControllerSeries({ metric: 'orders', ...(q as any) } as any) as any,
      metricsControllerSeries({ metric: 'payments', ...(q as any) } as any) as any,
      metricsControllerSeries({ metric: 'washcard', ...(q as any) } as any) as any,
      metricsControllerSeries({ metric: 'washcount', ...(q as any) } as any) as any,
    ]);
    const xDates = (orders?.points||[]).map((p:any)=>p.date);
    ordersPoints.value = orders?.points||[];
    paymentsPoints.value = payments?.points||[];
    washcardPoints.value = washcard?.points||[];
    washcountPoints.value = washcount?.points||[];
    const primary = getPrimaryColor();
    ordersOption.value = buildLineOption(xDates, ordersPoints.value.map((p:any)=>p.value), '订单笔数', 'default', primary);
    paymentsOption.value = buildLineOption(xDates, paymentsPoints.value.map((p:any)=>p.value), '支付金额(净)', 'currency', primary);
    washcardOption.value = buildLineOption(xDates, washcardPoints.value.map((p:any)=>p.value), '洗车卡划扣(次)', 'default', primary);
  }catch(e:any){ ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '加载图表失败'); }
  finally{ seriesLoading.value = false; }
}

type DailyRow = { date: string; orders: number; payments: number; washcard: number; washcount: number };
const dailyRows = computed<DailyRow[]>(() => {
	const dates = new Set<string>();
	for (const p of ordersPoints.value || []) dates.add(String(p?.date || ''));
	if (!dates.size) {
		for (const p of paymentsPoints.value || []) dates.add(String(p?.date || ''));
		for (const p of washcardPoints.value || []) dates.add(String(p?.date || ''));
		for (const p of washcountPoints.value || []) dates.add(String(p?.date || ''));
	}
	const mapOf = (points: any[]) => {
		const m = new Map<string, number>();
		for (const p of points || []) m.set(String(p?.date || ''), Number(p?.value || 0) || 0);
		return m;
	};
	const mOrders = mapOf(ordersPoints.value);
	const mPayments = mapOf(paymentsPoints.value);
	const mWashcard = mapOf(washcardPoints.value);
	const mWashcount = mapOf(washcountPoints.value);

	return Array.from(dates)
		.filter(Boolean)
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
		.map((date) => ({
			date,
			orders: mOrders.get(date) ?? 0,
			payments: mPayments.get(date) ?? 0,
			washcard: mWashcard.get(date) ?? 0,
			washcount: mWashcount.get(date) ?? 0,
		}));
});

const dailySummary = computed(() => {
	let orders = 0; let washcount = 0; let washcard = 0; let payments = 0;
	for (const r of dailyRows.value) {
		orders += Number(r.orders || 0);
		washcount += Number(r.washcount || 0);
		washcard += Number(r.washcard || 0);
		payments += Number(r.payments || 0);
	}
	return { orders, washcount, washcard, payments };
});

function getPrimaryColor(){
  try{ const c = getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim(); return c || '#409eff'; }catch{ return '#409eff'; }
}

function hexToRgba(hex:string, alpha:number){
  const h = hex.replace('#','').trim();
  const full = h.length===3 ? h.split('').map(ch=>ch+ch).join('') : h;
  const r = parseInt(full.slice(0,2),16)||0; const g = parseInt(full.slice(2,4),16)||0; const b = parseInt(full.slice(4,6),16)||0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function buildLineOption(x:any[], y:number[], name:string, valueType: 'default'|'currency' = 'default', primary:string = '#409eff'){
  const area = hexToRgba(primary, 0.12);
  return {
    color: [primary],
    tooltip: { trigger: 'axis', valueFormatter: (v:number)=> valueType==='currency' ? formatCurrency(v) : String(v) },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: x, boundaryGap: false },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [{
      name,
      type: 'line',
      data: y,
      smooth: true,
      showSymbol: true,
      symbolSize: 6,
      areaStyle: { color: area },
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' },
      markPoint: {
        symbolSize: 48,
        label: { color: '#fff', formatter: '{b}' },
        data: [
          { type: 'max', name: '最大值' },
          { type: 'min', name: '最小值' },
          ...(x.length && y.length ? [{ name: '最新', coord: [x.length-1, y[y.length-1]] }] : [])
        ]
      },
      markLine: { data: [{ type: 'average', name: '平均值' }], lineStyle: { type: 'dashed' } }
    }],
  };
}

onMounted(() => { applyFilter(); });
</script>

<style scoped>
.dashboard {
	padding: 14px;
	display:flex;
	flex-direction:column;
	gap:12px;
	--gap: 12px;
	background:
		radial-gradient(1200px 320px at 20% 0%, color-mix(in oklab, var(--el-color-primary), transparent 90%) 0%, transparent 60%),
		radial-gradient(900px 260px at 80% 0%, color-mix(in oklab, var(--el-color-success), transparent 92%) 0%, transparent 55%);
	border-radius: 12px;
}
.header {
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap: 12px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 12px;
	background: color-mix(in oklab, var(--el-bg-color), transparent 0%);
	backdrop-filter: blur(6px);
}
.title h2 { margin:0; font-size:18px; }
.title .sub { margin:2px 0 0; color: var(--el-text-color-secondary); font-size:12px; }
.filters :deep(.el-segmented){
	--el-segmented-padding: 2px;
	border-radius: 999px;
	overflow: hidden;
}
.filters :deep(.el-segmented__group){
	border-radius: 999px;
	overflow: hidden;
}
.filters :deep(.el-segmented__item:first-child){
	border-top-left-radius: 999px;
	border-bottom-left-radius: 999px;
}
.filters :deep(.el-segmented__item:last-child){
	border-top-right-radius: 999px;
	border-bottom-right-radius: 999px;
}
.filters :deep(.el-date-editor){ width: 240px; }
.filter-actions :deep(.el-button){
	border-radius: 999px;
	padding-inline: 12px;
}
.filter-actions :deep(.el-button--primary){
	box-shadow: 0 8px 20px color-mix(in oklab, var(--el-color-primary), transparent 78%);
}

.overview-card { --gap: 12px; }
.card-header { display:flex; align-items:center; justify-content:space-between; }
.card-header .timerange { color: var(--el-text-color-secondary); }

.metric-item { display:flex; align-items:center; gap:10px; padding:12px; border:1px solid color-mix(in oklab, var(--el-color-primary), transparent 78%); border-radius:12px; background: linear-gradient(180deg, color-mix(in oklab, var(--el-color-primary), transparent 92%) 0%, color-mix(in oklab, var(--el-bg-color), transparent 0%) 70%); }
.metric-item .metric-icon { width:36px; height:36px; display:flex; align-items:center; justify-content:center; }
.metric-item .meta { display:flex; flex-direction:column; gap:6px; }
.metric-item .label { font-size:12px; color: var(--el-text-color-secondary); }
.metric-item .value { font-size:20px; font-weight:700; line-height:1; }
.metric-item .delta { margin-top:6px; display:flex; align-items:center; gap:6px; font-size:12px; }
.metric-item .delta .arrow { font-weight:700; }
.metric-item .delta .pct { font-variant-numeric: tabular-nums; }
.metric-item .delta .base { color: var(--el-text-color-secondary); }
.metric-item .delta[data-up="true"] { color:#67c23a; }
.metric-item .delta[data-down="true"] { color:#f56c6c; }

.chart { background: var(--el-bg-color); border:1px solid var(--el-border-color); border-radius: 10px; padding: 8px; }
.chart-title { font-weight: 600; margin: 0 0 8px; }
.echart { width: 100%; height: 240px; }

.charts-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

.daily-card :deep(.el-table){ border-radius: 10px; overflow: hidden; }
.daily-card :deep(.el-card__header){
	border-bottom: 1px solid var(--el-border-color-lighter);
	background: linear-gradient(180deg, color-mix(in oklab, var(--el-color-primary), transparent 93%) 0%, transparent 85%);
}
.daily-header-right :deep(.el-tag){
	border-radius: 999px;
}
.daily-table :deep(.el-table__header-wrapper th){
	background: color-mix(in oklab, var(--el-fill-color-light), transparent 0%);
}
.daily-table :deep(.el-table__row:hover td){
	background: color-mix(in oklab, var(--el-color-primary), transparent 94%);
}
.daily-footer{ padding-top: 10px; border-top: 1px solid var(--el-border-color-lighter); margin-top: 10px; }
.daily-footer{
	padding: 10px 12px;
	border-radius: 12px;
	background: color-mix(in oklab, var(--el-fill-color-lighter), transparent 0%);
}
.money{ font-variant-numeric: tabular-nums; }

@media (max-width: 1280px){
	.header { flex-direction: column; align-items: flex-start; gap: 10px; }
	.filters :deep(.el-date-editor){ width: 220px; }
	.charts-grid{ grid-template-columns: 1fr; }
}
</style>


