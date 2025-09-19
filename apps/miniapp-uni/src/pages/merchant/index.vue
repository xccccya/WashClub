<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<!-- 欢迎与今日指标卡片 -->
		<view class="card gradient-card">
			<view class="welcome">{{ greetText }}</view>
			<view class="section-title">今日运营数据</view>
			<view v-if="loadingOverview" class="loading-text">加载中…</view>
			<view class="metrics">
				<view class="metric">
					<view class="metric-label">洗车数量</view>
					<view class="metric-value">{{ overview?.washCount ?? '-' }}</view>
					<view class="metric-delta" v-if="overview?.compare">较{{ baseLabel(overview.compare.base) }} {{ arrow(overview.compare.washCountRate) }} {{ fmtRate(overview.compare.washCountRate) }}</view>
				</view>
				<view class="metric">
					<view class="metric-label">洗车卡划扣</view>
					<view class="metric-value">{{ overview?.washcardDeductTimes ?? '-' }}</view>
					<view class="metric-delta" v-if="overview?.compare">较{{ baseLabel(overview.compare.base) }} {{ arrow(overview.compare.washcardDeductTimesRate) }} {{ fmtRate(overview.compare.washcardDeductTimesRate) }}</view>
				</view>
				<view class="metric">
					<view class="metric-label">支付金额（净）</view>
					<view class="metric-value">{{ formatCurrency(overview?.payAmount) }}</view>
					<view class="metric-delta" v-if="overview?.compare">较{{ baseLabel(overview.compare.base) }} {{ arrow(overview.compare.payAmountRate) }} {{ fmtRate(overview.compare.payAmountRate) }}</view>
				</view>
			</view>
		</view>

		<!-- 逐日数据列表卡片 -->
		<view class="card">
			<view class="list-head">
				<view class="card-title">逐日数据</view>
				<view class="filters">
					<view class="seg" :data-active="range==='last7'" @tap="setRange('last7')">近七日</view>
					<view class="seg" :data-active="range==='last30'" @tap="setRange('last30')">近三十日</view>
					<view class="seg" :data-active="range==='thisMonth'" @tap="setRange('thisMonth')">本月</view>
					<view class="seg" :data-active="range==='lastMonth'" @tap="setRange('lastMonth')">上月</view>
					<view class="seg" :data-active="range==='custom'" @tap="openCustom()">自定义</view>
				</view>
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
						<text v-if="compareTotals" class="total-compare"><text class="cmp-label">{{ compareLabel }}</text> {{ arrow(rates.washCount) }} {{ fmtRate(rates.washCount) }}</text>
					</view>
					<view class="total-metric">
						<text class="metric-label">划扣</text>
						<text class="metric-value">{{ displayTotal.washcardDeductTimes }}</text>
						<text v-if="compareTotals" class="total-compare"><text class="cmp-label">{{ compareLabel }}</text> {{ arrow(rates.washcardDeductTimes) }} {{ fmtRate(rates.washcardDeductTimes) }}</text>
					</view>
					<view class="total-metric">
						<text class="metric-label">净额</text>
						<text class="metric-value">{{ formatCurrency(displayTotal.payAmount) }}</text>
						<text v-if="compareTotals" class="total-compare"><text class="cmp-label">{{ compareLabel }}</text> {{ arrow(rates.payAmount) }} {{ fmtRate(rates.payAmount) }}</text>
					</view>
				</view>
			</view>
			<view v-if="displayItems.length===0" class="empty">暂无数据</view>
			<view v-else class="list">
				<view class="table-head row">
					<text class="col date">日期</text>
					<text class="col">洗车</text>
					<text class="col">划扣</text>
					<text class="col">净额</text>
				</view>
				<view v-for="it in displayItems" :key="it.date" class="row">
					<text class="col date">{{ it.date }}</text>
					<text class="col">{{ it.washCount }}</text>
					<text class="col">{{ it.washcardDeductTimes }}</text>
					<text class="col">{{ formatCurrency(it.payAmount) }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
declare const uni: any;
import { useSafeArea } from '../../utils/safe-area';
import { createHttp } from '../../utils/auth';

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const overview = ref<any|null>(null);
const loadingOverview = ref(false);
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
  try { overview.value = await (createHttp())('/system/miniapp/employee/overview', { method: 'GET', query: { range: 'today' } }); }
  catch{ overview.value = null; }
  finally { loadingOverview.value = false; }
}

async function fetchDaily(){
  try{
    const http = createHttp();
    if (range.value === 'custom' && customRange.value && customRange.value.length===2) {
      const s = String(customRange.value[0]);
      const e = String(customRange.value[1]);
      const { startIso, endIso } = toIsoInclusiveRange(s, e);
      daily.value = await http('/system/miniapp/employee/daily', { method: 'GET', query: { start: startIso, end: endIso } });
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
      daily.value = await http('/system/miniapp/employee/daily', { method: 'GET', query: { start: startIso, end: endIso } });
    } else {
      // 上月等其他区间交由后端处理
      daily.value = await http('/system/miniapp/employee/daily', { method: 'GET', query: { range: range.value } });
    }
    daily.value.items = (daily.value.items||[]).sort((a:any,b:any)=> (a.date < b.date ? 1 : (a.date>b.date?-1:0)));
  } catch{ daily.value = { items: [] }; }
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
    const http = createHttp();
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
    const baseResp = await http('/system/miniapp/employee/daily', { method: 'GET', query: { start: prevIso.startIso, end: prevIso.endIso } }) as { items?: any[] };
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
</script>

 

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); }
.nav-back { position: fixed; left: 16rpx; z-index: 9; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.card { background: #fff; border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,.06); margin-bottom: 16rpx; }
.gradient-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.welcome { font-size: 30rpx; font-weight: 800; color: #0b1220; margin-bottom: 12rpx; }
.section-title { font-size: 24rpx; color:#4b5563; margin-bottom: 12rpx; }
.metrics { display:flex; align-items: stretch; gap: 12rpx; }
.metric { flex:1; background: #fff; border-radius: 16rpx; padding: 16rpx; border: 2rpx solid #eef2ff; }
.metric-label { font-size: 22rpx; color: #6b7280; }
.metric-value { font-size: 34rpx; font-weight: 800; color: #0f172a; margin-top: 6rpx; }
.metric-delta { margin-top: 6rpx; font-size: 22rpx; color: #64748b; }
.list-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.filters { display:flex; gap: 10rpx; }
.seg { padding: 8rpx 14rpx; border-radius: 999rpx; background:#f3f4f6; color:#111827; font-size: 22rpx; }
.seg[data-active="true"] { background: linear-gradient(135deg, #a8d8ff, #ffc9de); }
.range-picker { margin-bottom: 10rpx; }
.range-picker-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.range-tip { font-size: 22rpx; color:#64748b; }
.range-clear { font-size: 22rpx; color:#ef4444; padding: 6rpx 12rpx; }
.total-card { background:#0ea5e9; color:#fff; border-radius: 20rpx; padding: 16rpx; box-shadow: 0 12rpx 24rpx rgba(14,165,233,.18); }
.total-title { display:flex; align-items:center; justify-content: space-between; font-size: 24rpx; opacity:.95; margin-bottom: 8rpx; }
.total-range { font-size: 22rpx; opacity:.85; }
.compare-toggle { display:flex; gap: 10rpx; }
.compare-toggle .seg { background: rgba(255,255,255,.2); color:#fff; border: 2rpx solid rgba(255,255,255,.35); }
.compare-toggle .seg[data-active="true"] { background:#ffffff; color:#0ea5e9; }
.total-metrics { display:flex; gap: 12rpx; }
.total-metric { flex:1; background: rgba(255,255,255,.15); border: 2rpx solid rgba(255,255,255,.25); border-radius: 14rpx; padding: 12rpx; }
.total-metric .metric-label { color:#f0f9ff; font-size: 22rpx; }
.total-metric .metric-value { color:#ffffff; font-size: 32rpx; font-weight: 800; margin-top: 6rpx; }
.total-compare { display:block; margin-top: 6rpx; font-size: 22rpx; color:#e0f2fe; }
.total-compare .cmp-label { opacity:.85; margin-right: 6rpx; }
.list { margin-top: 10rpx; }
.row { display:flex; align-items:center; justify-content: space-between; padding: 12rpx 6rpx; border-bottom: 2rpx dashed #f1f5f9; }
.table-head { background:#f8fafc; border: 2rpx solid #eef2f7; border-radius: 12rpx; }
.table-head .col { color:#475569; font-weight: 600; }
.row:last-child { border-bottom: none; }
.col { width: 25%; font-size: 24rpx; color:#111827; text-align: right; }
.col.date { text-align: left; color:#374151; }
.empty { font-size: 24rpx; color:#6b7280; padding: 20rpx 0; text-align: center; }
</style>


