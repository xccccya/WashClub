<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="topbar" :style="{ height: topSpacerHeight + 'px', paddingTop: statusBarHeight + 'px' }">
			<view class="topbar-inner" :style="{ height: navBarHeight + 'px' }">
				<view class="topbar-back" @tap="goBack">
						<uni-icons type="left" :size="22" color="rgba(15,23,42,0.86)" />
				</view>
				<text class="topbar-title">商家中心</text>
				<view class="topbar-right" />
			</view>
		</view>

		<!-- 欢迎与今日指标卡片 -->
		<view class="card header-card">
			<view class="header-top">
				<view class="greet-col">
					<text class="welcome">{{ greetText }}</text>
					<text class="section-title">今日运营概览</text>
				</view>
				<view class="date-pill">
					<uni-icons type="calendar" :size="16" color="rgba(15,23,42,0.70)" />
					<text class="date-text">{{ todayStr }}</text>
				</view>
			</view>

			<view v-if="loadingOverview" class="loading-text">加载中…</view>

			<view v-else class="metrics">
				<view class="metric">
					<view class="metric-head">
						<uni-icons type="compose" :size="18" color="rgba(37,99,235,0.9)" />
						<text class="metric-label">洗车数量</text>
					</view>
					<view class="metric-value">{{ overview?.washCount ?? '-' }}</view>
					<view v-if="overview?.compare" class="metric-delta" :class="deltaClass(overview.compare.washCountRate)">
						较{{ baseLabel(overview.compare.base) }} {{ arrow(overview.compare.washCountRate) }} {{ fmtRate(overview.compare.washCountRate) }}
					</view>
				</view>
				<view class="metric">
					<view class="metric-head">
						<uni-icons type="checkbox-filled" :size="18" color="rgba(236,72,153,0.9)" />
						<text class="metric-label">洗车卡划扣</text>
					</view>
					<view class="metric-value">{{ overview?.washcardDeductTimes ?? '-' }}</view>
					<view v-if="overview?.compare" class="metric-delta" :class="deltaClass(overview.compare.washcardDeductTimesRate)">
						较{{ baseLabel(overview.compare.base) }} {{ arrow(overview.compare.washcardDeductTimesRate) }} {{ fmtRate(overview.compare.washcardDeductTimesRate) }}
					</view>
				</view>
				<view class="metric">
					<view class="metric-head">
						<uni-icons type="wallet-filled" :size="18" color="rgba(14,165,233,0.9)" />
						<text class="metric-label">支付净额</text>
					</view>
					<view class="metric-value">{{ formatCurrency(overview?.payAmount) }}</view>
					<view v-if="overview?.compare" class="metric-delta" :class="deltaClass(overview.compare.payAmountRate)">
						较{{ baseLabel(overview.compare.base) }} {{ arrow(overview.compare.payAmountRate) }} {{ fmtRate(overview.compare.payAmountRate) }}
					</view>
				</view>
			</view>
		</view>

		<!-- 管理功能卡片（置于逐日数据上方） -->
		<view class="card manage-card">
			<view class="list-head">
				<view class="card-title">管理功能</view>
				<view class="manage-sub">快捷入口</view>
			</view>
			<view class="manage-grid">
				<view class="manage-item" @tap="goUserManage">
					<view class="manage-icon">
						<uni-icons type="person-filled" :size="20" color="rgba(37,99,235,0.9)" />
					</view>
					<view class="manage-texts">
						<text class="manage-name">用户管理</text>
						<text class="manage-desc">搜索/筛选用户，查看详情</text>
					</view>
					<uni-icons type="right" :size="18" color="rgba(15,23,42,0.56)" />
				</view>
			</view>
		</view>

		<!-- 逐日数据列表卡片 -->
		<view class="card">
			<view class="list-head">
				<view class="card-title">逐日数据</view>
				<scroll-view scroll-x="true" class="filters" show-scrollbar="false">
					<view class="seg" :data-active="range==='last7'" @tap="setRange('last7')">近七日</view>
					<view class="seg" :data-active="range==='last30'" @tap="setRange('last30')">近三十日</view>
					<view class="seg" :data-active="range==='thisMonth'" @tap="setRange('thisMonth')">本月</view>
					<view class="seg" :data-active="range==='lastMonth'" @tap="setRange('lastMonth')">上月</view>
					<view class="seg" :data-active="range==='custom'" @tap="openCustom()">自定义</view>
				</scroll-view>
			</view>
			<view class="range-picker" v-if="range==='custom'">
				<view class="range-picker-head">
					<text class="range-tip">请选择日期范围</text>
					<view v-if="customRange && customRange.length===2" class="range-clear" @tap="clearCustom">清除</view>
				</view>
				<uni-datetime-picker ref="dtPickerRef" type="daterange" v-model="customRange" :end="todayStr" @change="onPickRange" />
			</view>
			<view v-if="displayItems.length>0" class="total-card">
				<view class="total-title">
					<text>区间合计</text>
					<text class="total-range">{{ displayDateSpan }}</text>
					<view class="compare-toggle">
						<view class="seg" :data-active="compareMode==='mom'" @tap="setCompare('mom')">环比</view>
						<view class="seg" :data-active="compareMode==='yoy'" @tap="setCompare('yoy')">同比</view>
					</view>
				</view>
				<view class="total-metrics">
					<view class="total-metric">
						<text class="metric-label">洗车</text>
						<text class="metric-value">{{ displayTotal.washCount }}</text>
						<text v-if="compareTotals" class="total-compare" :class="deltaClass(rates.washCount)"><text class="cmp-label">{{ compareLabel }}</text> {{ arrow(rates.washCount) }} {{ fmtRate(rates.washCount) }}</text>
					</view>
					<view class="total-metric">
						<text class="metric-label">划扣</text>
						<text class="metric-value">{{ displayTotal.washcardDeductTimes }}</text>
						<text v-if="compareTotals" class="total-compare" :class="deltaClass(rates.washcardDeductTimes)"><text class="cmp-label">{{ compareLabel }}</text> {{ arrow(rates.washcardDeductTimes) }} {{ fmtRate(rates.washcardDeductTimes) }}</text>
					</view>
					<view class="total-metric">
						<text class="metric-label">净额</text>
						<text class="metric-value">{{ formatCurrency(displayTotal.payAmount) }}</text>
						<text v-if="compareTotals" class="total-compare" :class="deltaClass(rates.payAmount)"><text class="cmp-label">{{ compareLabel }}</text> {{ arrow(rates.payAmount) }} {{ fmtRate(rates.payAmount) }}</text>
					</view>
				</view>
			</view>
			<view v-if="loadingDaily" class="loading-text">加载中…</view>
			<view v-else-if="displayItems.length===0" class="empty">暂无数据</view>
			<view v-else class="daily-list">
				<view v-for="it in displayItems" :key="it.date" class="day-item">
					<view class="day-head">
						<text class="day-date">{{ it.date }}</text>
						<text class="day-amount">{{ formatCurrency(it.payAmount) }}</text>
					</view>
					<view class="day-foot">
						<view class="day-pill">
							<text class="k">洗车</text>
							<text class="v">{{ it.washCount }}</text>
						</view>
						<view class="day-pill">
							<text class="k">划扣</text>
							<text class="v">{{ it.washcardDeductTimes }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
declare const uni: any;
import { useSafeArea } from '../../utils/safe-area';
import { systemMiniappEmployeeControllerDaily, systemMiniappEmployeeControllerOverview } from '@wash/api-client';

const { topSpacerHeight, statusBarHeight, navBarHeight } = useSafeArea();
const overview = ref<any|null>(null);
const loadingOverview = ref(false);
const loadingDaily = ref(false);
const daily = ref<{ items: any[]; total?: { washCount:number; washcardDeductTimes:number; payAmount:number } }>({ items: [] });
const range = ref<'last7'|'last30'|'thisMonth'|'lastMonth'|'custom'>('last7');
const customRange = ref<string[]>([]);
const dtPickerRef = ref<any>(null);

const greetText = computed(()=>{
  const name = String(overview.value?.employee?.name || '');
  const hour = new Date().getHours();
  const time = (hour>=5 && hour<11) ? '早上好' : (hour>=11 && hour<13) ? '中午好' : (hour>=13 && hour<19) ? '晚上好' : '夜深了';
  return `Hi~${name||'伙伴'}，${time}`;
});

function baseLabel(b: 'yesterday'|'prev7'|'prev30'|'lastMonth'){ return b==='yesterday' ? '昨日' : b==='prev7' ? '前七日' : b==='prev30' ? '前一月' : '昨月'; }
function fmtRate(r: number|null|undefined){ if (r==null) return '—'; return `${(r*100).toFixed(1)}%`; }
function arrow(r: number|null|undefined){ if (r==null) return '→'; return r>0?'↑':(r<0?'↓':'→'); }
function deltaClass(r: number|null|undefined){ if (r==null || r===0) return 'delta-flat'; return r>0 ? 'delta-up' : 'delta-down'; }
function formatCurrency(n?: number){
  if (n==null) return '-';
  try {
    // @ts-ignore
    if (typeof Intl !== 'undefined' && (Intl as any).NumberFormat) {
      return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(n as number);
    }
  } catch {}
  const v = Number(n);
  if (!isFinite(v)) return '-';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const fixed = abs.toFixed(2);
  const parts = fixed.split('.');
  const intPart = parts[0];
  const fracPart = parts[1] ? '.' + parts[1] : '';
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '￥' + withSep + fracPart;
}

async function fetchOverview(){
  loadingOverview.value = true;
  try { overview.value = await systemMiniappEmployeeControllerOverview({ range: 'today' } as any) as any; }
  catch{ overview.value = null; }
  finally { loadingOverview.value = false; }
}

async function fetchDaily(){
  loadingDaily.value = true;
  try{
    if (range.value === 'custom' && customRange.value && customRange.value.length===2) {
      const s = String(customRange.value[0]);
      const e = String(customRange.value[1]);
      const { startIso, endIso } = toIsoInclusiveRange(s, e);
      daily.value = await systemMiniappEmployeeControllerDaily({ start: startIso, end: endIso } as any) as any;
    } else if (range.value === 'last7' || range.value === 'last30' || range.value === 'thisMonth') {
      const today = new Date();
      const endStr = formatDateLocal(today);
      let startStr = endStr;
      if (range.value === 'last7') {
        startStr = formatDateLocal(addDaysLocal(today, -6));
      } else if (range.value === 'last30') {
        startStr = formatDateLocal(addDaysLocal(today, -29));
      } else {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        startStr = formatDateLocal(firstDay);
      }
      const { startIso, endIso } = toIsoInclusiveRange(startStr, endStr);
      daily.value = await systemMiniappEmployeeControllerDaily({ start: startIso, end: endIso } as any) as any;
    } else {
      // 上月等其他区间交由后端处理
      daily.value = await systemMiniappEmployeeControllerDaily({ range: range.value } as any) as any;
    }
    daily.value.items = (daily.value.items||[]).sort((a:any,b:any)=> (a.date < b.date ? 1 : (a.date>b.date?-1:0)));
  } catch{ daily.value = { items: [] }; }
  finally { loadingDaily.value = false; }
}

function setRange(r: 'last7'|'last30'|'thisMonth'|'lastMonth'|'custom'){ range.value = r; if (r!=='custom') { customRange.value = []; } fetchDaily(); }
function onPickRange(e: any){
  try {
    const raw = e && typeof e === 'object' ? (e.detail?.value ?? e.value ?? e) : e;
    const v = Array.isArray(raw) ? raw : [];
    customRange.value = v as any;
    range.value = 'custom';
    fetchDaily();
  } catch {}
}

function openCustom(){
  const end = new Date();
  const start = new Date(end.getTime() - 6*86400000);
  const s = formatDateLocal(start);
  const e = formatDateLocal(end);
  customRange.value = [s, e] as any;
  range.value = 'custom';
  nextTick(()=>{
    try {
      setTimeout(()=>{ try { (dtPickerRef as any).value?.show?.(); } catch {} }, 50);
    } catch {}
  });
}

function clearCustom(){
  customRange.value = [] as any;
  range.value = 'last7';
  fetchDaily();
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function addDaysLocal(d: Date, delta: number): Date { const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate()+delta); return nd; }

const todayStr = computed(()=> formatDateLocal(new Date()));
const displayItems = computed(()=>{
  const items = (daily.value.items||[]).slice();
  if (range.value === 'thisMonth') {
    return items.filter((it:any)=> String(it.date) <= todayStr.value);
  }
  return items;
});

const displayTotal = computed(()=>{
  const init = { washCount: 0, washcardDeductTimes: 0, payAmount: 0 } as { washCount:number; washcardDeductTimes:number; payAmount:number };
  return displayItems.value.reduce((acc:any, it:any)=>{
    acc.washCount += Number(it.washCount||0);
    acc.washcardDeductTimes += Number(it.washcardDeductTimes||0);
    acc.payAmount += Number(it.payAmount||0);
    return acc;
  }, init);
});

const displayDateSpan = computed(()=>{
  if (!displayItems.value.length) return '';
  const dates = displayItems.value.map((i:any)=> String(i.date));
  const min = dates[dates.length-1];
  const max = dates[0];
  return `${min} ~ ${max}`;
});

const compareMode = ref<'mom'|'yoy'>('mom');
function setCompare(mode: 'mom'|'yoy'){ compareMode.value = mode; computeCompare(); }

const compareTotals = ref<{ washCount:number; washcardDeductTimes:number; payAmount:number }|null>(null);
const rates = ref<{ washCount:number|null; washcardDeductTimes:number|null; payAmount:number|null}>({ washCount: null, washcardDeductTimes: null, payAmount: null });
const compareLabel = computed(()=> compareMode.value==='mom' ? '环比' : '同比');

function addDays(dateStr: string, days: number){ const d = new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+days); return formatDateLocal(d); }
function dateDiffInDays(a: string, b: string){ const d1 = new Date(a+'T00:00:00'); const d2 = new Date(b+'T00:00:00'); return Math.round((d2.getTime()-d1.getTime())/86400000); }

// 将本地日期字符串区间（闭区间）转为本地时区 ISO 边界（半开区间）
function toIsoInclusiveRange(startDate: string, endDate: string){
  const s = new Date(startDate+'T00:00:00');
  const ePlus1 = new Date(endDate+'T00:00:00'); ePlus1.setDate(ePlus1.getDate()+1);
  const pad = (n:number)=> String(n).padStart(2,'0');
  const toIso = (d:Date)=> `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${formatTzOffset(d)}`;
  return { startIso: toIso(s), endIso: toIso(ePlus1) };
}
function formatTzOffset(d: Date){
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs/60)).padStart(2,'0');
  const mm = String(abs%60).padStart(2,'0');
  return `${sign}${hh}:${mm}`;
}

async function computeCompare(){
  try{
    if (!displayItems.value.length) { compareTotals.value = null; rates.value = { washCount:null, washcardDeductTimes:null, payAmount:null }; return; }
    const start = displayItems.value[displayItems.value.length-1].date;
    const end = displayItems.value[0].date;
    const days = Math.max(1, dateDiffInDays(start, end)+1);

    let baseStart = '';
    let baseEnd = '';
    if (compareMode.value === 'mom') {
      baseEnd = addDays(start, -1);
      baseStart = addDays(baseEnd, -days+1);
    } else {
      const s = new Date(start+'T00:00:00');
      const e = new Date(end+'T00:00:00');
      s.setFullYear(s.getFullYear()-1); e.setFullYear(e.getFullYear()-1);
      baseStart = s.toISOString().slice(0,10);
      baseEnd = e.toISOString().slice(0,10);
    }

    const prevIso = toIsoInclusiveRange(baseStart, baseEnd);
    const baseResp = await systemMiniappEmployeeControllerDaily({ start: prevIso.startIso, end: prevIso.endIso } as any) as any as { items?: any[] };
    const baseItems = ((baseResp && baseResp.items) ? baseResp.items : []).sort((a:any,b:any)=> (a.date < b.date ? 1 : (a.date>b.date?-1:0)));
    const baseTotal = baseItems.reduce((acc:any, it:any)=>{
      acc.washCount += Number(it.washCount||0);
      acc.washcardDeductTimes += Number(it.washcardDeductTimes||0);
      acc.payAmount += Number(it.payAmount||0);
      return acc;
    }, { washCount:0, washcardDeductTimes:0, payAmount:0 });
    compareTotals.value = baseTotal;

    function calcRate(cur:number, prev:number){ if (!prev) return cur ? 1 : 0; return (cur - prev) / prev; }
    rates.value = {
      washCount: calcRate(displayTotal.value.washCount, baseTotal.washCount),
      washcardDeductTimes: calcRate(displayTotal.value.washcardDeductTimes, baseTotal.washcardDeductTimes),
      payAmount: calcRate(displayTotal.value.payAmount, baseTotal.payAmount)
    };
  }catch{
    compareTotals.value = null;
    rates.value = { washCount:null, washcardDeductTimes:null, payAmount:null };
  }
}

onMounted(async ()=>{ await fetchOverview(); await fetchDaily(); await computeCompare(); });

watch([displayItems, compareMode], ()=>{ computeCompare(); });
watch(customRange, (v)=>{
  if (range.value==='custom' && Array.isArray(v) && v.length===2) {
    fetchDaily();
  }
});

function goBack(){ try { uni.navigateBack(); } catch {} }
function goUserManage(){ try { uni.navigateTo({ url: '/pages/merchant/users/index' }); } catch {} }
</script>

 

<style>
.page {
	min-height: 100vh;
	padding: 24rpx;
	box-sizing: border-box;
	background: linear-gradient(180deg, #eff7ff 0%, #fff3f7 56%, #ffffff 100%);
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
	overflow-x: hidden;
}

.topbar{
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	z-index: 20;
	box-sizing: border-box;
	background: rgba(255,255,255,0.78);
	border-bottom: 1rpx solid rgba(148, 163, 184, 0.18);
}
@supports ((-webkit-backdrop-filter: blur(8px)) or (backdrop-filter: blur(8px))) {
	.topbar{ -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
}
.topbar-inner{
	display:flex;
	align-items:center;
	justify-content: space-between;
	padding: 0 20rpx;
}
.topbar-back{
	width: 72rpx;
	height: 72rpx;
	border-radius: 999rpx;
	display:flex;
	align-items:center;
	justify-content: center;
	background: transparent;
	border: none;
	box-shadow: none;
}
.topbar-back:active{ opacity: .72; }
.topbar-title{ font-size: 30rpx; font-weight: 900; color:#0f172a; letter-spacing: .6rpx; }
.topbar-right{ width: 72rpx; height: 72rpx; }

.card {
	background: rgba(255, 255, 255, 0.96);
	border-radius: 26rpx;
	padding: 26rpx;
	box-shadow:
		0 10rpx 24rpx rgba(15, 23, 42, 0.05),
		0 2rpx 10rpx rgba(15, 23, 42, 0.03);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	margin-bottom: 24rpx;
	position: relative;
	overflow: hidden;
}

.header-card{
	background: linear-gradient(135deg, #edf7ff 0%, #fff2f8 58%, rgba(255,255,255,0.98) 100%);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.header-top{ display:flex; align-items:flex-start; justify-content: space-between; gap: 16rpx; margin-bottom: 14rpx; }
.greet-col{ display:flex; flex-direction: column; gap: 8rpx; }
.welcome { font-size: 34rpx; font-weight: 900; color: #0b1220; line-height: 1.22; letter-spacing: .6rpx; }
.section-title { font-size: 24rpx; color: rgba(15, 23, 42, 0.72); line-height: 1.38; }
.date-pill{
	display:inline-flex;
	align-items:center;
	gap: 8rpx;
	padding: 8rpx 12rpx;
	border-radius: 999rpx;
	background: rgba(255,255,255,0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: 0 6rpx 14rpx rgba(15,23,42,0.05);
}
.date-text{ font-size: 22rpx; font-weight: 800; color:#0f172a; }

.loading-text { font-size: 24rpx; color:#6b7280; padding: 6rpx 0; }

.metrics { display:flex; align-items: stretch; gap: 12rpx; flex-wrap: wrap; }
.metric {
	flex:1;
	min-width: 210rpx;
	background: rgba(255,255,255,0.92);
	border-radius: 20rpx;
	padding: 18rpx;
	border: 1rpx solid rgba(148,163,184,0.18);
	box-shadow: inset 0 2rpx 10rpx rgba(15,23,42,0.03);
}
.metric-head{ display:flex; align-items:center; gap: 10rpx; }
.metric-label { font-size: 22rpx; color: #6b7280; font-weight: 700; }
.metric-value { font-size: 34rpx; font-weight: 900; color: #0f172a; margin-top: 8rpx; line-height: 1.1; }
.metric-delta { margin-top: 8rpx; font-size: 22rpx; color: #64748b; }
.delta-up{ color:#16a34a; }
.delta-down{ color:#ef4444; }
.delta-flat{ color:#64748b; }

.list-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; gap: 12rpx; }
.card-title { font-size: 28rpx; font-weight: 800; color:#0f172a; letter-spacing: .2rpx; flex: 0 0 auto; }
.manage-sub{ font-size: 22rpx; color: rgba(15, 23, 42, 0.62); font-weight: 700; }
.manage-card{
	background: linear-gradient(
		135deg,
		rgba(168, 216, 255, 0.16) 0%,
		rgba(255, 201, 222, 0.12) 55%,
		rgba(255, 255, 255, 0.94) 100%
	);
}
.manage-grid{ display:flex; flex-direction: column; gap: 12rpx; margin-top: 8rpx; }
.manage-item{
	display:flex;
	align-items:center;
	gap: 14rpx;
	padding: 18rpx;
	border-radius: 22rpx;
	background: rgba(255,255,255,0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: inset 0 2rpx 10rpx rgba(15,23,42,0.03);
}
.manage-item:active{ opacity: .86; }
.manage-icon{
	width: 64rpx;
	height: 64rpx;
	border-radius: 18rpx;
	display:flex;
	align-items:center;
	justify-content:center;
	background: rgba(239, 246, 255, 0.9);
	border: 1rpx solid rgba(37, 99, 235, 0.12);
	flex: 0 0 auto;
}
.manage-texts{ flex: 1; min-width: 0; display:flex; flex-direction: column; gap: 6rpx; }
.manage-name{ font-size: 26rpx; font-weight: 900; color:#0f172a; letter-spacing: .2rpx; }
.manage-desc{ font-size: 22rpx; color: rgba(15,23,42,0.62); font-weight: 700; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.filters { flex: 1 1 auto; white-space: nowrap; overflow: hidden; }
.seg {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 10rpx 14rpx;
	border-radius: 999rpx;
	background:#f1f5f9;
	color:#0f172a;
	font-size: 22rpx;
	font-weight: 800;
	border: 1rpx solid rgba(148,163,184,0.18);
	margin-left: 10rpx;
}
.seg:first-child{ margin-left: 0; }
.seg[data-active="true"] { border-color: rgba(255,255,255,0.75); background: linear-gradient(135deg, rgba(168, 216, 255, 0.95), rgba(255, 201, 222, 0.95)); }

.range-picker { margin: 6rpx 0 16rpx 0; }
.range-picker-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.range-tip { font-size: 22rpx; color:#64748b; }
.range-clear { font-size: 22rpx; color:#ef4444; padding: 6rpx 12rpx; }

.total-card {
	/* 更贴合整体的“浅色渐变白卡”，避免强对比彩底 */
	background: linear-gradient(
		135deg,
		rgba(168, 216, 255, 0.22) 0%,
		rgba(255, 201, 222, 0.18) 55%,
		rgba(255, 255, 255, 0.92) 100%
	);
	color:#0f172a;
	border-radius: 24rpx;
	padding: 18rpx;
	box-shadow:
		0 12rpx 26rpx rgba(15, 23, 42, 0.06),
		inset 0 2rpx 10rpx rgba(15, 23, 42, 0.03);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	margin-bottom: 16rpx;
}
.total-title { display:flex; align-items:center; justify-content: space-between; font-size: 24rpx; margin-bottom: 10rpx; gap: 12rpx; font-weight: 800; }
.total-range { font-size: 22rpx; color: rgba(15, 23, 42, 0.62); font-weight: 700; }
.compare-toggle { display:flex; gap: 10rpx; }
.compare-toggle .seg {
	background: rgba(255,255,255,0.80);
	color:#0f172a;
	border: 1rpx solid rgba(148,163,184,0.18);
	box-shadow: 0 6rpx 14rpx rgba(15,23,42,0.04);
}
.compare-toggle .seg[data-active="true"] {
	border-color: rgba(255,255,255,0.75);
	background: linear-gradient(135deg, rgba(168, 216, 255, 0.95), rgba(255, 201, 222, 0.95));
}
.total-metrics { display:flex; gap: 12rpx; }
.total-metric {
	flex:1;
	background: rgba(255,255,255,0.86);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	border-radius: 18rpx;
	padding: 14rpx;
	box-shadow: inset 0 2rpx 10rpx rgba(15,23,42,0.03);
}
.total-metric .metric-label { color: rgba(15, 23, 42, 0.62); font-size: 22rpx; font-weight: 800; }
.total-metric .metric-value { color:#0f172a; font-size: 32rpx; font-weight: 900; margin-top: 6rpx; }
.total-compare { display:block; margin-top: 6rpx; font-size: 22rpx; }
.total-compare .cmp-label { opacity:.85; margin-right: 6rpx; }

.daily-list { margin-top: 10rpx; display:flex; flex-direction: column; gap: 12rpx; }
.day-item{
	background: rgba(255,255,255,0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	border-radius: 22rpx;
	padding: 18rpx 18rpx 16rpx 18rpx;
	box-shadow: inset 0 2rpx 10rpx rgba(15,23,42,0.03);
}
.day-head{ display:flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.day-date{ font-size: 26rpx; font-weight: 900; color:#0f172a; letter-spacing: .2rpx; }
.day-amount{ font-size: 28rpx; font-weight: 900; color:#0b1220; }
.day-foot{ margin-top: 12rpx; display:flex; gap: 10rpx; flex-wrap: wrap; }
.day-pill{
	display:inline-flex;
	align-items:center;
	gap: 8rpx;
	padding: 8rpx 12rpx;
	border-radius: 999rpx;
	background: rgba(241, 245, 249, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.day-pill .k{ font-size: 22rpx; color:#64748b; font-weight: 700; }
.day-pill .v{ font-size: 24rpx; color:#0f172a; font-weight: 900; }

.empty { font-size: 24rpx; color:#6b7280; padding: 20rpx 0; text-align: center; }
</style>


