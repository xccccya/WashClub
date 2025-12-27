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
			<div class="metrics-grid metrics-grid--6">
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
				<!-- 新增：洗车数量(总) -->
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
			</div>
		</el-card>

		<!-- 累计数据卡片 -->
		<el-card shadow="never">
			<template #header>
				<div class="card-header">
					<span>累计数据</span>
				</div>
			</template>
			<div class="metrics-grid metrics-grid--6">
				<div class="metric-item">
					<div class="metric-icon"><el-icon size="28" color="#67c23a"><Money /></el-icon></div>
					<div class="meta">
						<div class="label">累计交易金额(净)</div>
						<div class="value">{{ formatCurrency(data?.cumulative?.transactionAmount ?? 0) }}</div>
					</div>
				</div>
				<div class="metric-item">
					<div class="metric-icon"><el-icon size="28" color="#409eff"><Tickets /></el-icon></div>
					<div class="meta">
						<div class="label">累计订单数</div>
						<div class="value">{{ data?.cumulative?.orderCount ?? '-' }}</div>
					</div>
				</div>
				<!-- 新增：累计洗车数量 -->
				<div class="metric-item">
					<div class="metric-icon"><el-icon size="28" color="#409eff"><Tickets /></el-icon></div>
					<div class="meta">
						<div class="label">累计洗车数量</div>
						<div class="value">{{ data?.cumulative?.washCount ?? '-' }}</div>
					</div>
				</div>
				<!-- 新增：累计洗车卡划扣(次) -->
				<div class="metric-item">
					<div class="metric-icon"><el-icon size="28" color="#e6a23c"><CreditCard /></el-icon></div>
					<div class="meta">
						<div class="label">累计洗车卡划扣(次)</div>
						<div class="value">{{ data?.cumulative?.washcardDeductTimes ?? '-' }}</div>
					</div>
				</div>
				<div class="metric-item">
					<div class="metric-icon"><el-icon size="28" color="#f56c6c"><User /></el-icon></div>
					<div class="meta">
						<div class="label">总会员数</div>
						<div class="value">{{ data?.cumulative?.totalMembers ?? '-' }}</div>
					</div>
				</div>
				<div class="metric-item">
					<div class="metric-icon"><el-icon size="28" color="#e6a23c"><OfficeBuilding /></el-icon></div>
					<div class="meta">
						<div class="label">总集团客户数</div>
						<div class="value">{{ data?.cumulative?.totalGroups ?? '-' }}</div>
					</div>
				</div>
			</div>
		</el-card>

		<!-- 折线图报表 -->
		<el-card shadow="never">
			<template #header>
				<div class="card-header">
					<span>数据报表</span>
					<div>
						<el-radio-group v-model="seriesRange" size="small" @change="fetchSeries">
							<el-radio-button label="last7">近七日</el-radio-button>
							<el-radio-button label="last30">近一月</el-radio-button>
							<el-radio-button label="thisMonth">本月</el-radio-button>
						</el-radio-group>
					</div>
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
					<div class="charts-grid">
						<div class="chart">
							<div class="chart-title">订单笔数</div>
							<el-empty v-if="ordersEmpty" description="暂无数据" />
							<v-chart v-else autoresize :option="ordersOption" class="echart" />
						</div>
						<div class="chart">
							<div class="chart-title">支付金额(净)</div>
							<el-empty v-if="paymentsEmpty" description="暂无数据" />
							<v-chart v-else autoresize :option="paymentsOption" class="echart" />
						</div>
						<div class="chart">
							<div class="chart-title">洗车卡划扣(次)</div>
							<el-empty v-if="washcardEmpty" description="暂无数据" />
							<v-chart v-else autoresize :option="washcardOption" class="echart" />
						</div>
					</div>
				</template>
			</el-skeleton>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { ShoppingBag, Money, CreditCard, User, UserFilled, Tickets, OfficeBuilding } from '@element-plus/icons-vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { metricsControllerOverview, metricsControllerSeries } from '@wash/api-client';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent]);

type RangeKey = 'today' | 'last7' | 'last30' | 'thisMonth';
type OverviewResp = {
	range: RangeKey;
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
    base: 'yesterday'|'prev7'|'prev30'|'lastMonth';
    orderCountPrev: number; orderCountRate: number|null;
    payAmountPrev: number; payAmountRate: number|null;
    washcardDeductTimesPrev: number; washcardDeductTimesRate: number|null;
    washCountPrev: number; washCountRate: number|null;
    activeMembersPrev: number; activeMembersRate: number|null;
    newMembersPrev: number; newMembersRate: number|null;
  };
};

const range = ref<RangeKey>('today');
const loading = ref(false);
const data = ref<OverviewResp | null>(null);
const seriesRange = ref<'last7'|'last30'|'thisMonth'>('last7');
const seriesLoading = ref(false);
const ordersOption = ref<any>({});
const paymentsOption = ref<any>({});
const washcardOption = ref<any>({});
const ordersPoints = ref<any[]>([]);
const paymentsPoints = ref<any[]>([]);
const washcardPoints = ref<any[]>([]);
const ordersEmpty = computed(()=>!ordersPoints.value?.length || ordersPoints.value.every((p:any)=>Number(p.value||0)===0));
const paymentsEmpty = computed(()=>!paymentsPoints.value?.length || paymentsPoints.value.every((p:any)=>Number(p.value||0)===0));
const washcardEmpty = computed(()=>!washcardPoints.value?.length || washcardPoints.value.every((p:any)=>Number(p.value||0)===0));

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

function baseLabel(b: 'yesterday'|'prev7'|'prev30'|'lastMonth'){
  return b==='yesterday' ? '昨日' : b==='prev7' ? '前七日' : b==='prev30' ? '前一月' : '昨月';
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

async function fetchData(){
	loading.value = true;
	try{
		// 注意：openapi 对返回体未完整建模，这里按后端实际返回结构使用
		const resp = (await metricsControllerOverview({ range: range.value } as any) as unknown) as OverviewResp;
		data.value = resp as any;
	}catch(e:any){
		ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '加载失败');
	}finally{
		loading.value = false;
	}
}

async function fetchSeries(){
  seriesLoading.value = true;
  try{
    const [orders, payments, washcard, washcount] = await Promise.all([
      metricsControllerSeries({ metric: 'orders', range: seriesRange.value } as any) as any,
      metricsControllerSeries({ metric: 'payments', range: seriesRange.value } as any) as any,
      metricsControllerSeries({ metric: 'washcard', range: seriesRange.value } as any) as any,
      metricsControllerSeries({ metric: 'washcount', range: seriesRange.value } as any) as any,
    ]);
    const xDates = (orders?.points||[]).map((p:any)=>p.date);
    ordersPoints.value = orders?.points||[];
    paymentsPoints.value = payments?.points||[];
    washcardPoints.value = washcard?.points||[];
    const washcountPoints = washcount?.points||[];
    const primary = getPrimaryColor();
    ordersOption.value = buildLineOption(xDates, ordersPoints.value.map((p:any)=>p.value), '订单笔数', 'default', primary);
    paymentsOption.value = buildLineOption(xDates, paymentsPoints.value.map((p:any)=>p.value), '支付金额(净)', 'currency', primary);
    washcardOption.value = buildLineOption(xDates, washcardPoints.value.map((p:any)=>p.value), '洗车卡划扣(次)', 'default', primary);
  }catch(e:any){ ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '加载图表失败'); }
  finally{ seriesLoading.value = false; }
}

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

onMounted(() => { fetchData(); fetchSeries(); });
</script>

<style scoped>
.dashboard { padding: 12px; display:flex; flex-direction:column; gap:12px; --gap: 12px; }
.header { display:flex; align-items:center; justify-content:space-between; }
.title h2 { margin:0; font-size:18px; }
.title .sub { margin:2px 0 0; color: var(--el-text-color-secondary); font-size:12px; }
.range-switch :deep(.el-radio-button__inner){ padding:6px 10px; }

.overview-card { --gap: 12px; }
.card-header { display:flex; align-items:center; justify-content:space-between; }
.card-header .timerange { color: var(--el-text-color-secondary); }

.metrics-grid { display:grid; grid-template-columns: repeat(6, 1fr); gap: var(--gap); }
.metrics-grid--6 { grid-template-columns: repeat(6, 1fr); }
.metric-item { display:flex; align-items:center; gap:10px; padding:12px; border:1px solid color-mix(in oklab, var(--el-color-primary), transparent 78%); border-radius:10px; background: color-mix(in oklab, var(--el-color-primary), transparent 90%); }
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

.charts-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.chart { background: var(--el-bg-color); border:1px solid var(--el-border-color); border-radius: 10px; padding: 8px; }
.chart-title { font-weight: 600; margin: 0 0 8px; }
.echart { width: 100%; height: 240px; }

@media (max-width: 1280px){
	.metrics-grid { grid-template-columns: repeat(3, 1fr); }
	.charts-grid { grid-template-columns: 1fr; }
}
@media (max-width: 860px){
	.metrics-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 520px){
	.metrics-grid { grid-template-columns: 1fr; }
}
</style>


