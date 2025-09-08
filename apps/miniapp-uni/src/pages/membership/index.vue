<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 左上角返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="title-bar"><text class="title">会员中心</text></view>

		<!-- 等级轮播卡片 -->
		<swiper class="level-swiper" :current="currentIndex" :circular="false" :indicator-dots="false" previous-margin="48rpx" next-margin="48rpx" @change="onSwiperChange">
			<swiper-item v-for="(lv, idx) in levels" :key="lv.id">
				<view class="swiper-card-wrap">
					<view class="card level-card">
						<view class="level-head">
							<view class="level-name">{{ lv.name }}</view>
						</view>
						<image v-if="lv.iconUrl" class="level-icon-float" :src="toAbs(lv.iconUrl)" mode="aspectFill" />
						<view class="progress"><view class="progress-inner" :style="{ width: Math.round(progressOf(idx)*100)+'%' }"></view></view>
						<view class="level-sub">
							<text class="level-remaining">{{ hintOf(idx) }}</text>
							<text class="level-progress-num">{{ growthPoints }} / {{ totalOf(idx) }}</text>
						</view>
					</view>
				</view>
			</swiper-item>
		</swiper>

		<!-- 会员等级权益卡片 -->
		<view class="card benefit-card" v-if="selectedLevel">
			<view class="benefit-head"><text class="benefit-title">{{ selectedLevel?.name }}权益</text></view>
			<view class="benefit-grid">
				<view class="benefit-item">
					<image class="benefit-icon" :src="benefitPointsIcon" mode="aspectFit" />
					<text class="benefit-text" v-if="!isNoPointsBoost">享积分{{ pointsMultiText }}倍获取</text>
					<text class="benefit-text" v-else>当前等级无积分加倍</text>
				</view>
				<view class="benefit-item">
					<image class="benefit-icon" :src="benefitDiscountIcon" mode="aspectFit" />
					<text class="benefit-text" v-if="!isNoDiscount">享订单支付{{ discountZhe }}折优惠</text>
					<text class="benefit-text" v-else>当前等级无支付折扣</text>
				</view>
			</view>
		</view>

		<!-- 签到卡片：进度条 + 图标 + 数值 + 日历 -->
		<view class="card sign-card" style="margin-top: 28rpx;">
			<view class="sign-head">
				<text class="sign-title">签到日历</text>
				<view class="sign-cta" @tap="doSignIn" :class="{ disabled: status.todaySigned }">{{ status.todaySigned ? ('已连续签到' + status.streakDays + '天') : '点此签到' }}</view>
			</view>
			<view class="sign-progress" style="margin-top: 36rpx;">
				<view class="sign-steps">
					<view v-for="(r, i) in stepRewards" :key="i" class="sign-step">
						<image class="sign-step-icon" :src="iconOf(i, reached(i))" mode="aspectFit" />
						<text class="sign-step-num">+{{ r }}</text>
					</view>
				</view>
				<view class="sign-hint">
					<text class="sign-hint-text">第8天及以后固定 +{{ finalReward }}/天</text>
				</view>
			</view>
			<view class="sign-calendar" @touchstart="onTouchStart" @touchend="onTouchEnd" style="margin-top: 20rpx;">
				<view class="cal-head">
					<text class="cal-title">{{ curYm }}</text>
				</view>
				<view class="cal-grid" :class="calAnim">
					<view v-for="d in calDays" :key="d.key" class="cal-cell" :class="{ today: d.isToday, signed: d.isSigned }">
						<text class="cal-day">{{ d.day }}</text>
						<view v-if="d.isToday" class="dot" />
						<view v-if="d.isSigned" class="tick">✓</view>
					</view>
				</view>
			</view>
			<view class="sign-footnote">签到可获取奖励成长值</view>
		</view>

		<!-- 成长值日志 -->
		<view class="card logs-card">
			<view class="logs-head"><text class="logs-title">成长值记录</text></view>
			<view v-if="logs.length===0" class="empty">暂无记录</view>
			<view v-else class="logs-list">
				<view class="log-item" v-for="(g, i) in logs" :key="i" @tap="openOrderFromLog(g)">
					<view class="desc-wrap">
						<text class="log-desc">{{ baseDesc(g) }}</text>
						<text v-if="g.orderNo" class="order-no">{{ g.orderNo }}</text>
					</view>
					<text class="log-change" :class="{ minus: Number(g.change)<0 }">{{ Number(g.change)>=0?('+'+g.change):g.change }}</text>
					<text class="log-time">{{ fmtTime(g.createdAt) }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import createHttpClient from '@wash/shared-utils/src/http';
import { API_BASE, checkAuthAndRefresh } from '../../utils/auth';

// 全局 uni 与小程序页面栈声明，避免 TS 报错（运行时由 uni-app 注入）
declare const uni: any;
declare function getCurrentPages(): any[];

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => uni.getStorageSync('token') });

const growthPoints = ref<number>(0);
const levels = ref<Array<{ id:number; name:string; iconUrl?: string|null; level:number; requiredGrowth:number; pointsMultiplier?: number; payDiscountPercent?: number }>>([]);
const currentIndex = ref<number>(0); // swiper 当前选中卡片索引
const userLevelIndex = ref<number>(0); // 用户实际当前等级索引（稳定用于文案/进度判断）
const currentRequired = ref<number>(0);
const nextRequired = ref<number>(0);

function toAbs(u?: string|null){ if(!u) return ''; const s=String(u); if(/^https?:\/\//i.test(s)) return s; if (s.startsWith('/')) return API_BASE + s; return API_BASE + '/' + s; }

function progressOf(idx: number){
	// 按右下角“成长值/目标值”文案中的目标值来计算
	const total = Math.max(1, Number(totalOf(idx) || 0));
	const gp = Math.max(0, Number(growthPoints.value||0));
	return Math.max(0, Math.min(1, gp / total));
}
function hintOf(idx: number){
	const gp = Math.max(0, Number(growthPoints.value||0));
	const lv = levels.value[idx]; if (!lv) return '';
	if (idx < userLevelIndex.value) return '您已超过该等级';
	if (idx === userLevelIndex.value){ if (!nextRequired.value || nextRequired.value<=0) return '已达最大等级'; const remain = Math.max(0, nextRequired.value - gp); return remain>0 ? `距下一等级还差${remain}成长值` : '已达最大等级'; }
	const need = Math.max(0, Number(lv.requiredGrowth||0)); const diff = Math.max(0, need - gp); return `距离此等级还需${diff}成长值`;
}
function totalOf(idx: number){
	// 例：105 / 120；上一等级：105 / 0；当前等级：105 / nextRequired；下一等级：105 / 该等级需求
	const lv = levels.value[idx]; if (!lv) return 0;
	if (idx < userLevelIndex.value) return Math.max(0, Number(lv.requiredGrowth||0));
	if (idx === userLevelIndex.value){ const t = Math.max(0, Number(nextRequired.value||0)); return t>0 ? t : Math.max(0, Number(growthPoints.value||0)); }
	return Math.max(0, Number(lv.requiredGrowth||0));
}

// 选中等级的权益展示（跟随 swiper 当前项）
const selectedLevel = computed(()=> levels.value[currentIndex.value] || null);
const pointsMultiText = computed(()=>{
    const pm = Number((selectedLevel as any)?.value?.pointsMultiplier ?? (selectedLevel as any)?.value?.pointsMultiplier ?? (selectedLevel as any)?.pointsMultiplier ?? 1);
    return Math.max(1, Math.floor(pm));
});
const discountZhe = computed(()=>{
    const p = Number((selectedLevel as any)?.value?.payDiscountPercent ?? (selectedLevel as any)?.value?.payDiscountPercent ?? (selectedLevel as any)?.payDiscountPercent ?? 0);
    if (!p || p <= 0) return '';
    const z = Math.max(0, 100 - Math.min(100, Math.floor(p)));
    const zh = (z/10).toFixed(1).replace(/\.0$/, '');
    return zh;
});

const isNoPointsBoost = computed(()=> pointsMultiText.value <= 1);
const isNoDiscount = computed(()=> !discountZhe.value);
const benefitPointsIcon = computed(()=> isNoPointsBoost.value ? '/static/icons/no-jifenjs.png' : '/static/icons/jifenjs.png');
const benefitDiscountIcon = computed(()=> isNoDiscount.value ? '/static/icons/no-huiyuanoff.png' : '/static/icons/huiyuanoff.png');

const logs = ref<Array<{ createdAt:string; desc:string; change:number; orderId?: number|null; orderNo?: string|null }>>([]);
function fmtTime(t:any){ try{ const d=new Date(t); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; }catch{ return ''; } }
function baseDesc(g:any){
    try{
        const d = String(g?.desc||'');
        const no = String(g?.orderNo||'').trim();
        if (!no) return d;
        const re = new RegExp(no.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const s = d.replace(re, '').replace(/\s{2,}/g,' ').trim();
        return s || d;
    }catch{ return String(g?.desc||''); }
}

function goBack(){ try{ const pages = getCurrentPages?.()||[]; if (pages.length>1){ uni.navigateBack(); return; } uni.reLaunch({ url: '/pages/me/index' }); }catch{ uni.reLaunch({ url: '/pages/me/index' }); } }
function onSwiperChange(e:any){ try{ currentIndex.value = Number(e?.detail?.current||0); }catch{} }

// ===== 签到：状态/进度/日历 =====
const status = ref<{ todaySigned: boolean; streakDays: number; rewardConfig: { dayRewards:number[]; after7:number }; todayReward: number }>({ todaySigned: false, streakDays: 0, rewardConfig: { dayRewards:[1,1,1,1,1,1,1], after7:1 }, todayReward: 1 });
const stepRewards = computed(()=>{
    const base = status.value.rewardConfig?.dayRewards || [1,1,1,1,1,1,1];
    return [...base, status.value.rewardConfig?.after7 || base[6] || 1];
});
const finalReward = computed(()=> status.value.rewardConfig?.after7 || stepRewards.value[7] || stepRewards.value[6] || 1);
function reached(i:number){
    const s = Number(status.value.streakDays||0);
    if (i < 7) return s >= (i+1);
    return s >= 8;
}
function iconOf(i:number, ok:boolean){
    if (i < 7) return ok ? '/static/icons/singre.png' : '/static/icons/prsingre.png';
    return ok ? '/static/icons/singrefinal.png' : '/static/icons/prsingrefinal.png';
}
async function fetchSignStatus(){
    try{ const res:any = await http('/member-signin/me/status', { method:'GET' }); status.value = res || status.value; }catch{}
}
async function doSignIn(){ if (status.value.todaySigned) return; try{ await http('/member-signin/me', { method:'POST' }); await fetchSignStatus(); await fetchMonth(curYm.value); uni.showToast({ title:'签到成功', icon:'success' }); }catch(e:any){ uni.showToast({ title: String(e?.message||e||'签到失败'), icon:'none' }); } }

const curYm = ref('');
const calDays = ref<Array<{ key:string; day:number; isToday:boolean; isSigned:boolean }>>([]);
const calAnim = ref('');
function buildMonthDays(ym:string, signedDays:number[]){
    const [y,m] = ym.split('-').map(n=>Number(n));
    const today = new Date();
    const isCur = (today.getFullYear()===y) && (today.getMonth()+1===m);
    const total = new Date(y, m, 0).getDate();
    const days:number[] = Array.from({ length: total }, (_,i)=> i+1);
    const set = new Set(signedDays);
    calDays.value = days.map(d => ({ key: ym+'-'+String(d).padStart(2,'0'), day: d, isToday: isCur && d===today.getDate(), isSigned: set.has(d) }));
}
async function fetchMonth(ym?: string){
    const now = new Date();
    const defaultYm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const req = ym || defaultYm;
    // 限制：不可超过当前月
    if (req > defaultYm) { curYm.value = defaultYm; ym = defaultYm; }
    else { curYm.value = req; }
    try{ const res:any = await http('/member-signin/me/month', { method:'GET', query: { ym: req } }); const days:number[] = Array.isArray(res?.signedDays)?res.signedDays:[]; buildMonthDays(res?.ym||req, days); }catch{ buildMonthDays(req, []); }
}
function prevMonth(){ const [y,m]=curYm.value.split('-').map(n=>Number(n)); const d = new Date(y, m-2, 1); const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; fetchMonth(ym); }

// 手势滑动切换月份：只允许向左滑查看更早月份，向右滑回到更近月份，直到当前月
let touchStartX = 0; let touchStartTime = 0;
function onTouchStart(e:any){ try{ touchStartX = Number(e?.changedTouches?.[0]?.clientX||0); touchStartTime = Date.now(); }catch{ touchStartX = 0; touchStartTime = Date.now(); } }
function onTouchEnd(e:any){
    try{
        const endX = Number(e?.changedTouches?.[0]?.clientX||0);
        const dx = endX - touchStartX;
        const dt = Date.now() - touchStartTime;
        if (dt > 500) return; // 仅响应快速滑动
        const threshold = 40; // 滑动阈值
        if (dx > threshold){ // 右滑：上一月（更早）
            calAnim.value = 'slide-right';
            setTimeout(()=>{ calAnim.value = ''; }, 220);
            const [y,m]=curYm.value.split('-').map(n=>Number(n)); const d = new Date(y, m-2, 1); const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; fetchMonth(ym);
        } else if (dx < -threshold){ // 左滑：下一月（更近），不得超过当前月
            const now = new Date();
            const defaultYm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            // 计算下一月，若超出当前月则直接回到当前月
            const [y,m]=curYm.value.split('-').map(n=>Number(n)); const d = new Date(y, m, 1); const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            calAnim.value = 'slide-left';
            setTimeout(()=>{ calAnim.value = ''; }, 220);
            fetchMonth(ym > defaultYm ? defaultYm : ym);
        }
    }catch{}
}

onMounted(async ()=>{
	const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!ok) { return; }
	const prof:any = await http('/member/me/profile', { method: 'GET' });
	growthPoints.value = Number(prof?.growthPoints||0);
	currentRequired.value = Number(prof?.currentRequiredGrowth||0);
	nextRequired.value = Number(prof?.nextRequiredGrowth||0);
	const list:any[] = await http('/member-level', { method:'GET' });
	levels.value = (Array.isArray(list)?list:[]).sort((a:any,b:any)=> Number(a.level)-Number(b.level));
	// 定位到当前会员等级
	const curId = Number(prof?.level?.id||0);
	const idx = Math.max(0, levels.value.findIndex(l=> Number(l.id)===curId));
	userLevelIndex.value = idx>=0 ? idx : 0;
	currentIndex.value = userLevelIndex.value; // 初始展示定位到当前等级
	// 加载成长日志（持久化接口）
	try{ const lg:any[] = await http('/member/me/growth-logs', { method:'GET', query:{ limit: 50 } }); logs.value = Array.isArray(lg)?lg:[]; }catch{ logs.value = []; }
	await fetchSignStatus();
	await fetchMonth(curYm.value);
});

function openOrderFromLog(g:any){
    try{
        const id = Number(g?.orderId||0);
        const no = String(g?.orderNo||'').trim();
        if (id) { uni.navigateTo({ url: `/pages/order/detail?id=${id}` }); return; }
        if (no) { uni.navigateTo({ url: `/pages/order/detail?no=${encodeURIComponent(no)}` }); return; }
    }catch{}
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.title-bar { display:flex; align-items:center; justify-content:flex-start; padding: 8rpx 4rpx 16rpx 4rpx; }
.title { font-size: 36rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }
.card { background: linear-gradient(180deg, rgba(243,249,255,0.92) 0%, rgba(255,247,251,0.92) 100%); border-radius: 24rpx; padding: 16rpx 16rpx 20rpx 16rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); backdrop-filter: blur(2rpx); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }

.level-swiper { height: 220rpx; margin-bottom: 0; overflow: visible; }
.swiper-card-wrap { position: relative; padding: 36rpx 8rpx 0 8rpx; overflow: visible; }
.level-card { position: relative; overflow: visible; z-index: 2; }
.level-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.level-name { font-size: 30rpx; font-weight: 800; color:#1f2937; }
.level-icon-float { position: absolute; right: -12rpx; top: -12rpx; width: 72rpx; height: 72rpx; border: none; border-radius: 0; box-shadow: none; background: transparent; }
.progress { width:100%; height:14rpx; border-radius:999rpx; background:#eef2ff; overflow:hidden; margin: 8rpx 0 10rpx 0; }
.progress-inner { height:100%; background: linear-gradient(90deg, #a8d8ff, #ffc9de); }
.level-sub { font-size: 24rpx; color:#6b7280; display:flex; align-items:center; justify-content: space-between; }
.level-progress-num { color:#374151; font-weight: 700; }

/* 权益卡片 */
.benefit-card { margin-top: 0rpx; margin-bottom: 4rpx; position: relative; z-index: 1; }
.benefit-head { margin-bottom: 12rpx; }
.benefit-title { font-size: 28rpx; font-weight: 800; color:#0b1220; letter-spacing: 0.5rpx; }
.benefit-grid { display:flex; align-items: stretch; justify-content: center; gap: 24rpx; }
.benefit-item { flex: 1; display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 16rpx 0; }
.benefit-icon { width: 64rpx; height: 64rpx; margin-bottom: 8rpx; }
.benefit-text { font-size: 24rpx; color:#1f2937; }

/* 签到卡片 */
.sign-card { margin-top: 22rpx; }
.sign-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 10rpx; }
.sign-title { font-size: 28rpx; font-weight: 800; color:#0b1220; letter-spacing: 0.5rpx; }
.sign-cta { font-size: 24rpx; color: #2563eb; padding: 6rpx 12rpx; border-radius: 999rpx; background: #e0f2fe; }
.sign-cta.disabled { color:#9ca3af; background:#f3f4f6; }
.sign-progress { margin: 8rpx 0 12rpx 0; }
.sign-steps { display:flex; align-items:center; justify-content: space-between; gap: 8rpx; }
.sign-step { display:flex; flex-direction: column; align-items:center; justify-content:center; flex:1; }
.sign-step-icon { width: 44rpx; height: 44rpx; }
.sign-step-num { font-size: 20rpx; color:#374151; margin-top: 4rpx; }
.sign-hint { display:flex; align-items:center; justify-content: flex-end; margin-top: 8rpx; color:#6b7280; }
.sign-hint-text { font-size: 22rpx; text-align:right; }
.sign-footnote { margin-top: 10rpx; font-size: 22rpx; color:#6b7280; text-align: right; }

.sign-calendar { margin-top: 6rpx; }
.cal-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.cal-nav { font-size: 24rpx; color:#2563eb; }
.cal-nav.disabled { color:#9ca3af; }
.cal-title { font-size: 24rpx; font-weight: 700; color:#111827; }
.cal-grid { display:grid; grid-template-columns: repeat(7, 1fr); gap: 10rpx; }
.cal-grid.slide-left { animation: cal-slide-left 200ms ease-out; }
.cal-grid.slide-right { animation: cal-slide-right 200ms ease-out; }
@keyframes cal-slide-left {
  from { transform: translateX(30rpx); opacity: .6; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes cal-slide-right {
  from { transform: translateX(-30rpx); opacity: .6; }
  to { transform: translateX(0); opacity: 1; }
}
.cal-cell { position: relative; height: 72rpx; border-radius: 12rpx; background:#f8fafc; display:flex; align-items:center; justify-content:center; }
.cal-cell.today { box-shadow: inset 0 0 0 2rpx #a7f3d0; }
.cal-cell.signed { background: #ecfeff; }
.cal-day { font-size: 26rpx; color:#111827; }
.dot { position:absolute; bottom: 6rpx; width: 8rpx; height: 8rpx; border-radius: 50%; background:#10b981; }
.tick { position:absolute; left: 6rpx; top: 6rpx; width: 22rpx; height: 22rpx; font-size: 20rpx; color:#10b981; }

.logs-head { margin-top: 0; margin-bottom: 12rpx; }
.logs-card { margin-top: 22rpx; }
.logs-title { font-size: 28rpx; font-weight: 700; color:#1f2937; letter-spacing: 0.5rpx; }
.logs-list { display:flex; flex-direction: column; gap: 12rpx; }
.log-item { display:grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; gap: 4rpx 12rpx; padding: 12rpx; border-radius: 16rpx; background:#fff; border: 2rpx solid #eef2f7; }
.desc-wrap { grid-column: 1 / 2; display:inline-flex; align-items:center; gap: 8rpx; }
.log-desc { color:#111827; font-size: 26rpx; font-weight: 600; }
.order-no { font-size: 20rpx; font-weight: 500; color:#6b7280; padding: 2rpx 8rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#fafafa; }
.order-no::after { content: '›'; display:inline-block; margin-left: 6rpx; color:#9ca3af; font-weight: 700; }
.log-change { grid-column: 2 / 3; color:#16a34a; font-size: 26rpx; font-weight: 700; justify-self: end; }
.log-time { grid-column: 1 / 3; color:#6b7280; font-size: 22rpx; }
.log-item .log-change.minus { color:#ef4444; }
.log-item.clickable { border-color:#e5e7eb; background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%); }
</style>
