<template>
	<BasePage title="收银台首页">

		<div class="home">
			<!-- 关键运营数据（与管理后台一致的六项） -->
			<el-card shadow="never" class="overview-card" v-loading="loading">
				<template #header>
					<div class="card-header">
						<div class="card-title">关键运营数据</div>
						<div class="header-right">
							<small class="timerange">{{ timeText }}</small>
							<el-radio-group v-model="range" size="small" @change="fetchData" class="range-switch">
								<el-radio-button value="today">今日</el-radio-button>
								<el-radio-button value="last7">近七日</el-radio-button>
								<el-radio-button value="last30">近一月</el-radio-button>
								<el-radio-button value="thisMonth">本月</el-radio-button>
							</el-radio-group>
						</div>
					</div>
				</template>
				<div class="metrics-grid">
					<div class="metric-item" v-ripple @click="onMetricClick('orders')">
						<div class="metric-icon"><el-icon size="28" color="#409eff"><ShoppingBag /></el-icon></div>
						<div class="meta">
							<div class="label">订单笔数</div>
							<div class="value">{{ formatInt(orderCountDisp) }}</div>
							<div class="delta" :data-up="(data?.compare?.orderCountRate||0) > 0" :data-down="(data?.compare?.orderCountRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data!.compare!.orderCountRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data!.compare!.orderCountRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data!.compare!.base) }}</span>
							</div>
						</div>
					</div>
					<div class="metric-item" v-ripple @click="onMetricClick('washcount')">
						<div class="metric-icon"><el-icon size="28" color="#409eff"><Tickets /></el-icon></div>
						<div class="meta">
							<div class="label">洗车数量(总)</div>
							<div class="value">{{ formatInt(washCountDisp) }}</div>
							<div class="delta" :data-up="(data?.compare?.washCountRate||0) > 0" :data-down="(data?.compare?.washCountRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data!.compare!.washCountRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data!.compare!.washCountRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data!.compare!.base) }}</span>
							</div>
						</div>
					</div>
					<div class="metric-item" v-ripple @click="onMetricClick('pay')">
						<div class="metric-icon"><el-icon size="28" color="#67c23a"><Money /></el-icon></div>
						<div class="meta">
							<div class="label">支付金额(净)</div>
							<div class="value">{{ formatCurrency(payAmountDisp) }}</div>
							<div class="delta" :data-up="(data?.compare?.payAmountRate||0) > 0" :data-down="(data?.compare?.payAmountRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data!.compare!.payAmountRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data!.compare!.payAmountRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data!.compare!.base) }}</span>
							</div>
						</div>
					</div>
					<div class="metric-item" v-ripple @click="onMetricClick('washcard')">
						<div class="metric-icon"><el-icon size="28" color="#e6a23c"><CreditCard /></el-icon></div>
						<div class="meta">
							<div class="label">洗车卡划扣</div>
							<div class="value">{{ formatInt(washcardDisp) }}</div>
							<div class="delta" :data-up="(data?.compare?.washcardDeductTimesRate||0) > 0" :data-down="(data?.compare?.washcardDeductTimesRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data!.compare!.washcardDeductTimesRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data!.compare!.washcardDeductTimesRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data!.compare!.base) }}</span>
							</div>
						</div>
					</div>
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#f56c6c"><User /></el-icon></div>
						<div class="meta">
							<div class="label">活跃会员数</div>
							<div class="value">{{ formatInt(activeMembersDisp) }}</div>
							<div class="delta" :data-up="(data?.compare?.activeMembersRate||0) > 0" :data-down="(data?.compare?.activeMembersRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data!.compare!.activeMembersRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data!.compare!.activeMembersRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data!.compare!.base) }}</span>
							</div>
						</div>
					</div>
					<div class="metric-item">
						<div class="metric-icon"><el-icon size="28" color="#909399"><UserFilled /></el-icon></div>
						<div class="meta">
							<div class="label">新增会员数</div>
							<div class="value">{{ formatInt(newMembersDisp) }}</div>
							<div class="delta" :data-up="(data?.compare?.newMembersRate||0) > 0" :data-down="(data?.compare?.newMembersRate||0) < 0">
								<span class="arrow" v-if="data?.compare">{{ arrow(data!.compare!.newMembersRate) }}</span>
								<span class="pct" v-if="data?.compare">{{ fmtRate(data!.compare!.newMembersRate) }}</span>
								<span class="base" v-if="data?.compare">较{{ baseLabel(data!.compare!.base) }}</span>
							</div>
						</div>
					</div>
				</div>
			</el-card>

			<!-- 快捷入口 -->
			<el-card shadow="never" class="quick-card">
				<template #header>
					<div class="card-header">
						<div class="card-title">快捷操作</div>
					</div>
				</template>
				<div class="quick-grid">
					<button class="quick" @click="goCashier">
						<el-icon size="26"><ShoppingCart /></el-icon>
						<span>新建订单</span>
					</button>
					<button class="quick" @click="goQueue">
						<el-icon size="26"><Tickets /></el-icon>
						<span>服务队列</span>
					</button>
					<button class="quick" @click="goOrders">
						<el-icon size="26"><Tickets /></el-icon>
						<span>订单列表</span>
					</button>
				</div>
			</el-card>

			<!-- 实时提醒条 -->
			<el-card shadow="never" class="realtime-card">
				<div class="realtime">
					<div class="realtime-label">实时提醒</div>
					<div class="pill-list">
					<button class="pill" :data-hot="reminders.pendingPayment>0" :disabled="remLoading" @click="openOrdersScene('PENDING_PAYMENT')">
						<span class="dot dot-warn"></span>
						<span>待支付</span>
						<b>{{ reminders.pendingPayment }}</b>
					</button>
					<button class="pill" :data-hot="reminders.pendingDelivery>0" :disabled="remLoading" @click="openOrdersScene('PENDING_DELIVERY')">
						<span class="dot dot-info"></span>
						<span>待发货</span>
						<b>{{ reminders.pendingDelivery }}</b>
					</button>
					<button class="pill" :data-hot="reminders.pendingService>0" :disabled="remLoading" @click="openOrdersScene('PENDING_SERVICE')">
						<span class="dot dot-primary"></span>
						<span>待服务</span>
						<b>{{ reminders.pendingService }}</b>
					</button>
					</div>
				</div>
			</el-card>

			<!-- 服务队列（精简看板） -->
			<el-card shadow="never" class="queue-card" v-loading="queueLoading">
				<template #header>
					<div class="card-header">
						<div class="card-title">服务队列</div>
						<el-button size="small" @click="goQueue">查看全部</el-button>
					</div>
				</template>
				<div class="queue-grid">
					<div v-for="t in queueSummary" :key="t.typeId" class="queue-item" :style="t.displayColor ? { borderColor: t.displayColor } : {}">
						<div class="qi-head">
							<div class="qi-left">
								<span class="name" :style="t.displayColor ? { color: t.displayColor } : {}">{{ t.typeName }}</span>
								<span class="sep">·</span>
								<span class="eta" v-if="t.etaConfigured && !t.excludedFromEta">新车≈{{ t.etaForNewCar }} 分</span>
								<span class="muted" v-else-if="t.excludedFromEta">不计等待</span>
								<span class="muted" v-else>ETA未配置</span>
							</div>
							<div class="qi-right">
								<el-tag size="small" effect="dark">{{ t.count }} 排队</el-tag>
							</div>
						</div>
						<div class="qi-bars">
							<div class="bar-track">
								<div class="bar-fill" :style="{ width: Math.min(100, Math.round((t.count||0)/8*100)) + '%', backgroundColor: t.displayColor||'#409eff' }"></div>
							</div>
							<div class="bar-legend">相对排队强度</div>
						</div>
					</div>
				</div>
			</el-card>
		</div>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { useRouter } from 'vue-router';
import { metricsControllerOverview, orderControllerList, queueControllerEtaSummary, queueControllerList } from '@wash/api-client';
import { ShoppingBag, Money, CreditCard, User, UserFilled, Tickets, ShoppingCart } from '@element-plus/icons-vue';

const router = useRouter();
function goCashier(){ router.push('/cashier'); }
function goQueue(){ router.push('/service-queue'); }
function goOrders(){ router.push('/orders'); }
function openOrdersScene(scene: 'PENDING_PAYMENT'|'PENDING_DELIVERY'|'PENDING_SERVICE'){ router.push({ path:'/orders', query: { scene } }); }
function goOrdersWithPreset(preset: { type?: string; payStatus?: string; start?: string; end?: string }){ const q:any = {}; if (preset.type) q.type=preset.type; if (preset.payStatus) q.payStatus=preset.payStatus; if (preset.start) q.start=preset.start; if (preset.end) q.end=preset.end; router.push({ path:'/orders', query: q }); }

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
	compare?: {
		base: 'yesterday'|'prev7'|'prev30'|'lastMonth';
		orderCountRate: number|null;
		payAmountRate: number|null;
		washcardDeductTimesRate: number|null;
		washCountRate: number|null;
		activeMembersRate: number|null;
		newMembersRate: number|null;
	};
};

const range = ref<RangeKey>('today');
const loading = ref(false);
const data = ref<OverviewResp | null>(null);

const timeText = computed(() => {
	if (!data.value) return '';
	try{
		const s = new Date(data.value.startAt);
		const e = new Date(data.value.endAt);
		const sText = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}`;
		const eAdj = new Date(e.getTime() - 1);
		const eText = `${eAdj.getFullYear()}-${String(eAdj.getMonth()+1).padStart(2,'0')}-${String(eAdj.getDate()).padStart(2,'0')}`;
		return `${sText} ~ ${eText}`;
	}catch{ return ''; }
});

function formatCurrency(n?: number){ if (n == null) return '-'; return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(n); }
function formatInt(n?: number){ if (n == null) return '0'; return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(n)); }
function fmtRate(rate: number|null|undefined){ if (rate===null || rate===undefined) return '—'; return `${(rate*100).toFixed(1)}%`; }
function arrow(rate: number|null|undefined){ if (rate===null || rate===undefined) return ''; if (rate>0) return '↑'; if (rate<0) return '↓'; return '→'; }
function baseLabel(b: 'yesterday'|'prev7'|'prev30'|'lastMonth'){ return b==='yesterday' ? '昨日' : b==='prev7' ? '前七日' : b==='prev30' ? '前一月' : '昨月'; }

async function fetchData(){
	loading.value = true;
	try{
		const resp = await metricsControllerOverview({ range: range.value } as any) as any;
		data.value = resp as OverviewResp;
		updateCounters();
	}catch{ data.value = null; }
	finally{ loading.value = false; }
}

onMounted(()=>{ fetchData(); });

// ========== 指标卡点击跳转 ==========
function onMetricClick(kind: 'orders'|'washcount'|'pay'|'washcard'){
	const s = data.value?.startAt; const e = data.value?.endAt;
	if (kind === 'orders'){ goOrdersWithPreset({ payStatus:'PAID', start: s, end: e }); return; }
	if (kind === 'pay'){ goOrdersWithPreset({ payStatus:'PAID', start: s, end: e }); return; }
	if (kind === 'washcount'){ goOrdersWithPreset({ type:'SERVICE', payStatus:'PAID', start: s, end: e }); return; }
	if (kind === 'washcard'){ goOrdersWithPreset({ type:'SERVICE', start: s, end: e }); return; }
}

// ========== 实时提醒条（定时刷新） ==========
const reminders = ref({ pendingPayment: 0, pendingDelivery: 0, pendingService: 0 });
const remLoading = ref(false);
let remTimer: any = null;
function getOrderListCount(resp: unknown): number {
	try {
		if (Array.isArray(resp)) return resp.length;
		const r: any = resp as any;
		if (Array.isArray(r?.items)) return r.items.length;
		if (Array.isArray(r?.data?.items)) return r.data.items.length;
		if (Array.isArray(r?.data)) return r.data.length;
		return 0;
	} catch {
		return 0;
	}
}
async function fetchReminders(){
	remLoading.value = true;
	try{
		const [a,b,c] = await Promise.all([
			(orderControllerList({ scene:'PENDING_PAYMENT' } as any) as any).catch(()=>[]),
			(orderControllerList({ scene:'PENDING_DELIVERY' } as any) as any).catch(()=>[]),
			(orderControllerList({ scene:'PENDING_SERVICE' } as any) as any).catch(()=>[]),
		]);
		reminders.value = { pendingPayment: getOrderListCount(a), pendingDelivery: getOrderListCount(b), pendingService: getOrderListCount(c) };
	}catch{ reminders.value = { pendingPayment: 0, pendingDelivery: 0, pendingService: 0 }; }
	finally{ remLoading.value = false; }
}

// ========== 服务队列精简看板 ==========
type EtaSummary = { typeId:number; typeName:string; displayColor?: string|null; etaConfigured:boolean; excludedFromEta:boolean; etaForNewCar: number|null };
const queueSummary = ref<Array<EtaSummary & { count:number }>>([]);
const queueLoading = ref(false);
let queueTimer: any = null;
async function fetchQueueSummary(){
	queueLoading.value = true;
	try{
		const [eta, list] = await Promise.all([
			(queueControllerEtaSummary() as any).catch(()=>[]),
			(queueControllerList() as any).catch(()=>[]),
		]);
		const counts = new Map<number, number>();
		(list||[]).forEach((x:any)=>{ const id = Number(x?.queueTypeId || x?.queueType?.id || 0); if (!id) return; counts.set(id, (counts.get(id)||0)+1); });
		queueSummary.value = (eta||[]).map(t=> ({ ...t, count: counts.get(Number(t.typeId)) || 0 }));
	}catch{ queueSummary.value = []; }
	finally{ queueLoading.value = false; }
}

onMounted(()=>{
	try{ fetchReminders(); remTimer = setInterval(fetchReminders, 30000); }catch{}
	try{ fetchQueueSummary(); queueTimer = setInterval(fetchQueueSummary, 15000); }catch{}
});
onBeforeUnmount(()=>{ try{ if (remTimer) clearInterval(remTimer); }catch{} try{ if (queueTimer) clearInterval(queueTimer); }catch{} });

// ========== 轻微“涟漪”点击动效（指令） ==========
type RippleEl = HTMLElement & { __rippleCleanup?: () => void };
const vRipple = {
    mounted(el: RippleEl){ attachRipple(el); },
    updated(el: RippleEl){ attachRipple(el); }
} as any;
function attachRipple(el: RippleEl){
    try{
        el.style.position = el.style.position || 'relative';
        el.style.overflow = 'hidden';
        el.addEventListener('click', (ev: MouseEvent)=>{
            try { if ((ev as any).__rippleHandled) return; (ev as any).__rippleHandled = true; } catch {}
            const rect = el.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 1.2;
            const span = document.createElement('span');
            span.className = 'ripple';
            span.style.width = span.style.height = size + 'px';
            const x = ev.clientX - rect.left - size/2;
            const y = ev.clientY - rect.top - size/2;
            span.style.left = x + 'px';
            span.style.top = y + 'px';
            el.appendChild(span);
            setTimeout(()=>{ try{ el.removeChild(span); }catch{} }, 450);
        }, { passive: true });
    }catch{}
}

// ========== 数字计数过渡动画 ==========
const orderCountDisp = ref(0);
const washCountDisp = ref(0);
const payAmountDisp = ref(0);
const washcardDisp = ref(0);
const activeMembersDisp = ref(0);
const newMembersDisp = ref(0);

function animateNumber(targetRef: any, to: number, duration = 600){
    const from = Number(targetRef.value||0);
    if (!isFinite(to)) to = 0;
    if (!isFinite(from)) targetRef.value = 0;
    const start = performance.now();
    function step(now: number){
        const p = Math.min(1, (now - start)/duration);
        const eased = 1 - Math.pow(1 - p, 3);
        targetRef.value = from + (to - from) * eased;
        if (p < 1) requestAnimationFrame(step);
        else targetRef.value = to;
    }
    requestAnimationFrame(step);
}
function updateCounters(){
    const d = data.value; if (!d) return;
    animateNumber(orderCountDisp, Number(d.orderCount||0));
    animateNumber(washCountDisp, Number(d.washCount||0));
    animateNumber(payAmountDisp, Number(d.payAmount||0));
    animateNumber(washcardDisp, Number(d.washcardDeductTimes||0));
    animateNumber(activeMembersDisp, Number(d.activeMembers||0));
    animateNumber(newMembersDisp, Number(d.newMembers||0));
}
watch(()=> data.value && (data.value as any).range, ()=> updateCounters());
</script>

<style scoped>
.home{ display:flex; flex-direction:column; gap:12px; }
/* 仅首页：使用 BasePage__content 作为滚动容器，保证内容可滚动且不影响其它页面 */
:deep(.base-page){ height: 100% !important; overflow: hidden !important; }
:deep(.base-page__content){ overflow: auto !important; min-height: 0 !important; }
.overview-card{ --gap: 12px; border-radius:16px; overflow:hidden; }
.card-header{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.card-title{ font-weight:700; }
.header-right{ display:flex; align-items:center; gap:10px; }
.timerange{ color: var(--el-text-color-secondary); }
.range-switch :deep(.el-radio-button__inner){ padding:6px 10px; }

/* 12.7英寸平板：默认 3 列布局 */
.metrics-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.metric-item{ display:flex; align-items:center; gap:12px; padding:16px; border:1px solid color-mix(in oklab, var(--el-color-primary), transparent 82%); border-radius:14px; background: linear-gradient(180deg, color-mix(in oklab, var(--el-color-primary), transparent 94%), #fff 40%); box-shadow: 0 2px 8px rgba(0,0,0,.04); cursor: pointer; transition: transform .12s ease, box-shadow .12s ease, background .12s ease; }
.metric-item:hover{ transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.06); }
.metric-item:active{ transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,.05); }
.metric-icon{ width:38px; height:38px; display:flex; align-items:center; justify-content:center; }
.meta{ display:flex; flex-direction:column; gap:6px; }
.label{ font-size:13px; color: var(--el-text-color-secondary); }
.value{ font-size:24px; font-weight:800; line-height:1; letter-spacing:.2px; }
.delta{ margin-top:4px; display:flex; align-items:center; gap:6px; font-size:12px; }
.delta .arrow{ font-weight:700; }
.delta .pct{ font-variant-numeric: tabular-nums; }
.delta .base{ color: var(--el-text-color-secondary); }
.delta[data-up="true"]{ color:#67c23a; }
.delta[data-down="true"]{ color:#f56c6c; }

/* 涟漪动效元素 */
.ripple{ position:absolute; border-radius:50%; transform: scale(0); background: color-mix(in oklab, var(--el-color-primary), transparent 70%); opacity: .35; animation: ripple .45s ease-out forwards; pointer-events: none; }
@keyframes ripple{ to { transform: scale(1); opacity: 0; } }

.quick-card{ border-radius:16px; overflow:hidden; }
.quick-grid{ display:grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap:12px; }
.quick{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:18px 14px; background:linear-gradient(180deg, #fff, #fafafa); border:1px solid var(--el-border-color); border-radius:14px; cursor:pointer; user-select:none; transition: all .15s ease; box-shadow: 0 2px 8px rgba(0,0,0,.03); }
.quick:hover{ background:#f5f9ff; border-color: color-mix(in oklab, var(--el-color-primary), transparent 60%); }
.quick span{ font-size:15px; font-weight:700; letter-spacing:.3px; color:#111827; }

.realtime-card{ border-radius:16px; overflow:hidden; }
.realtime{ display:grid; grid-template-columns: auto 1fr; align-items:center; gap:10px; }
.realtime-label{ font-weight:800; letter-spacing:.3px; color:#111827; white-space:nowrap; padding-right:8px; }
.realtime .pill-list{ display:flex; gap:12px; flex-wrap:wrap; }
.pill{ display:flex; align-items:center; gap:10px; background:linear-gradient(180deg, #ffffff, #fafafa); border:1px solid var(--el-border-color); border-radius:999px; padding:10px 16px; cursor:pointer; user-select:none; transition: box-shadow .12s ease, transform .12s ease, border-color .12s ease; box-shadow: 0 2px 8px rgba(0,0,0,.03); }
.pill:hover{ box-shadow: 0 4px 12px rgba(0,0,0,.06); transform: translateY(-1px); }
.pill b{ font-variant-numeric: tabular-nums; font-weight:800; min-width: 2ch; text-align:right; }
.pill .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
.dot-warn{ background:#f59e0b; }
.dot-info{ background:#06b6d4; }
.dot-primary{ background: var(--el-color-primary); }

/* 呼吸动画：数值非零时 */
.pill[data-hot="true"]{ border-color: color-mix(in oklab, var(--el-color-primary), transparent 40%); box-shadow: 0 0 0 0 color-mix(in oklab, var(--el-color-primary), transparent 75%); animation: pill-breath 1.8s ease-in-out infinite; }
@keyframes pill-breath{ 0%{ box-shadow: 0 0 0 0 color-mix(in oklab, var(--el-color-primary), transparent 75%); } 70%{ box-shadow: 0 0 0 8px rgba(64,158,255,0); } 100%{ box-shadow: 0 0 0 0 rgba(64,158,255,0); } }

.queue-card{ border-radius:16px; }
.queue-card :deep(.el-card__body){ padding-bottom: 20px; }
.queue-grid{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: stretch; min-height: 1px; margin-bottom: 2px; }
.queue-item{ border:1px solid #e5e7eb; border-radius:14px; padding:14px; background:linear-gradient(180deg, #fff, #fafafa); display:flex; flex-direction:column; gap:10px; box-shadow: 0 2px 8px rgba(0,0,0,.03); min-height: 116px; contain: layout paint; }
.qi-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; flex: 0 0 auto; }
.qi-left{ display:flex; align-items:center; gap:8px; min-width:0; }
.qi-left .name{ font-weight:800; letter-spacing:.3px; white-space:nowrap; }
.qi-left .sep{ color:#d1d5db; }
.qi-right{ display:flex; align-items:center; gap:8px; }
.qi-meta{ color:#606266; font-size:12px; }
.qi-meta .muted{ color:#909399; }
.qi-meta .eta{ color:#16a34a; font-weight:700; }
.qi-bars{ display:flex; flex-direction:column; gap:6px; flex: 0 0 auto; }
.bar-track{ position:relative; height:8px; background:#eef2f7; border-radius:999px; overflow:hidden; }
.bar-fill{ position:absolute; left:0; top:0; bottom:0; border-radius:999px; transition: width .25s ease; background:#409eff; }
.bar-legend{ color:#909399; font-size:12px; margin-top: 2px; }

@media (max-width: 1440px){
	.metrics-grid{ grid-template-columns: repeat(3, 1fr); }
	.quick-grid{ grid-template-columns: repeat(3, 1fr); }
	.queue-grid{ grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1100px){
	.metrics-grid{ grid-template-columns: repeat(2, 1fr); }
	.quick-grid{ grid-template-columns: repeat(2, 1fr); }
	.queue-grid{ grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 720px){
	.metrics-grid{ grid-template-columns: 1fr; }
	.quick-grid{ grid-template-columns: 1fr; }
	.queue-grid{ grid-template-columns: 1fr; }
}
</style>

