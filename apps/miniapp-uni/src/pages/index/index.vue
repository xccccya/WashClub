<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 顶部滚动公告 -->
		<view class="card notice-card" v-if="noticeHome">
			<view class="marquee">
				<text class="marquee-text">{{ noticeHome }}</text>
			</view>
		</view>
		<!-- 顶部欢迎卡片：问候 + 天气 + 洗车建议 -->
		<view class="card header-card">
			<view class="greet-col">
				<text class="greeting">Hi～{{ userName }}，{{ timeGreeting }}！</text>
				<text class="greet-sub" v-if="greetAffix">{{ greetAffix }}</text>
			</view>
			<view class="weather-box" @tap="onTapWeather">
				<view class="weather-row">
					<view class="weather-left">
						<text class="city">威远县</text>
						<text class="desc" v-if="liveWeather">{{ liveWeather.weather }}</text>
						<text class="desc" v-else>天气加载中…</text>
					</view>
					<view class="weather-right">
						<text class="temp" v-if="liveWeather">{{ liveWeather.temperature }}°</text>
					</view>
				</view>
				<view class="mini-metrics" v-if="liveWeather">
					<text class="metric">{{ liveWeather.winddirection }}风 {{ liveWeather.windpower }}级</text>
					<text class="dot">·</text>
					<text class="metric">湿度 {{ liveWeather.humidity }}%</text>
				</view>
			</view>
			<view class="wash-advice" v-if="washAdvice">
				<text class="advice-tag" :class="'level-' + (washAdviceLevel||'good')">洗车建议</text>
				<text class="advice-text">{{ washAdvice }}</text>
			</view>
		</view>

		<!-- 我的爱车 -->
		<view class="card car-card" @tap="onTapCarCard">
			<view class="card-title">我的爱车</view>
			<!-- 已登录且有车辆：展示默认车辆并可进入管理 -->
			<view v-if="loggedIn && hasCar" class="plate-row" @tap.stop="onTapCarManage">
				<view class="plate-left">
					<image v-if="brandImage" :src="abs(brandImage)" class="brand-logo" mode="aspectFit" />
					<view class="plate-info">
						<text class="plate-text">{{ plateNo }}</text>
						<text v-if="brandSeriesText" class="brand-series">{{ brandSeriesText }}</text>
					</view>
				</view>
				<view class="add-btn" @tap.stop="onTapAddCar">
					<view class="plus-v" />
					<view class="plus-h" />
				</view>
			</view>
			<!-- 已登录但暂无车辆：展示空态并引导添加 -->
			<view v-else-if="loggedIn" class="plate-row" @tap.stop="onTapAddCar">
				<text class="empty-text">暂无车辆，点击添加</text>
				<view class="add-btn">
					<view class="plus-v" />
					<view class="plus-h" />
				</view>
			</view>
			<!-- 未登录：引导登录查看爱车 -->
			<view v-else class="plate-row">
				<text class="login-text">点击登录以查看爱车</text>
			</view>
		</view>

		<!-- 洗车计次卡 -->
		<view class="home-wash-card">
			<WashCard :card="washCard" :loggedIn="loggedIn" @tap="onTapWashCard" />
		</view>

		<!-- 排队信息 -->
		<view class="card queue-card">
			<view class="queue-head">
				<view class="queue-title-row">
					<text class="card-title">排队信息</text>
					<view class="queue-status" :class="estimatedWaitMinutes > 0 ? 'busy' : 'free'">
						<text>{{ estimatedWaitMinutes > 0 ? '排队中' : '无需等待' }}</text>
					</view>
				</view>
				<view class="queue-detail-link" @tap="onTapQueueDetail">查看详情 ›</view>
			</view>
			<view class="queue-metrics">
				<view class="metric"><text class="label">服务中</text><text class="value">{{ servingCars }}</text></view>
				<view class="metric"><text class="label">等待中</text><text class="value">{{ waitingCars }}</text></view>
				<view class="eta-tag">预计 {{ estimatedWaitMinutes }} 分钟</view>
			</view>
			<view v-if="estimatedWaitMinutes > 0" class="queue-progress">
				<view class="queue-progress-bar"><view class="queue-progress-inner" :style="{ width: waitTimePercent + '%' }" /></view>
				<text class="queue-progress-text">预计等待：{{ estimatedWaitMinutes }} 分钟</text>
			</view>
			<view v-else class="queue-tips">现在无需等待，欢迎直接前往服务</view>
		</view>

		<!-- 广告横幅（最多展示3条，3秒切换；无启用横幅则隐藏） -->
		<view class="card ad-card" v-if="banners && banners.length">
			<swiper class="ad-swiper" :autoplay="true" :interval="3000" :circular="true" :duration="300" :indicator-dots="true">
				<swiper-item v-for="b in banners" :key="b.id" @tap="onTapBanner(b)">
					<image class="ad-image" :src="abs(b.imageUrl)" mode="aspectFill" />
				</swiper-item>
			</swiper>
		</view>

		<!-- 底部菜单（仅样式） -->
		
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { checkAuthAndRefresh, createHttp, getToken, API_BASE } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
import WashCard from '../../components/WashCard.vue';

const { topSpacerHeight } = useSafeArea();

const userName = ref('朋友');
const timeGreeting = ref('你好');
const greetAffix = ref('欢迎回到巨科汽车美容');
const plateNo = ref('-');
const loggedIn = ref(false);
const hasCar = ref(false);
const washCard = ref<any|null>(null);
const servingCars = ref(0);
const waitingCars = ref(0);
const noticeHome = ref('');
const banners = ref<Array<{ id:number; imageUrl:string; jumpEnabled:boolean; linkPath?:string|null }>>([]);
const brand = ref('');
const series = ref('');
const brandImage = ref<string>('');
const brandSeriesText = computed(()=>{
	const b = (brand.value||'').trim();
	const s = (series.value||'').trim();
	const txt = [b, s].filter(Boolean).join(' / ');
	return txt || '';
});

// 进度计算已移动到 WashCard 组件内部

const liveWeather = ref<any|null>(null);
const forecastWeather = ref<any|null>(null);
const washAdvice = ref('');
const washAdviceLevel = ref<'good'|'fair'|'bad'|''>('');

// 更精确的预计等待时间：基于工位并行模型(E:外观, I:内饰)
const estimatedWaitMinutes = ref(0);
// 进度条：以 60 分钟为满刻度（可根据运营情况调整）
const waitTimePercent = computed(()=>{
	const maxMinutes = 60;
	const pct = Math.round((estimatedWaitMinutes.value / maxMinutes) * 100);
	return Math.max(0, Math.min(100, pct));
});

function onTapWeather() { uni.showToast({ title: '天气信息来源：高德地图API', icon: 'none' }); }
function onTapAddCar() { navigate('/pages/vehicle/create'); }
function onTapQueueDetail() { navigate('/pages/queue/detail'); }

function navigate(url: string) {
    const isTab = url === '/pages/index/index' || url === '/pages/store/index' || url === '/pages/order/index' || url === '/pages/me/index';
    if (isTab) { try { uni.switchTab({ url }); return; } catch {}
    }
    try { uni.navigateTo({ url }); } catch {}
}

function navigateToPath(path: string){
	if (!path) return;
	// #ifdef H5
	if (typeof window !== 'undefined') {
		const hash = path.startsWith('/') ? `#${path}` : `#/${path}`;
		window.location.hash = hash;
		return;
	}
	// #endif
	const isTab = path === '/pages/index/index' || path === '/pages/store/index' || path === '/pages/order/index' || path === '/pages/me/index';
	if (isTab) { try { uni.switchTab({ url: path }); return; } catch {} }
	try { uni.navigateTo({ url: path }); } catch {}
}

// 已切换为系统 tabBar

async function loadDefaultPlate(){
	try {
		const http = createHttp();
		const vehicles = await http<any[]>('/vehicle/me/list', { method: 'GET' });
		const def = Array.isArray(vehicles) ? vehicles.find(v=>v.isDefault) || vehicles[0] : null;
		plateNo.value = def?.plateNumber || '-';
		brand.value = def?.brand || '';
		series.value = def?.series || '';
		brandImage.value = def?.brandImage || '';
		hasCar.value = !!def;
	} catch { plateNo.value = '-'; }
}

// #ifdef MP-WEIXIN || H5
// 首页仅静默刷新资料，不强制登录
onShow(async ()=>{ loggedIn.value = !!getToken(); const ok = await checkAuthAndRefresh({ redirectIfExpired: false }); if (ok) loggedIn.value = true; });
onShow(async ()=>{
	try {
		const http = createHttp();
		const active = await http<any>('/content/notices/active', { method: 'GET', query: { type: 'home' } });
		noticeHome.value = active?.content || '';
	} catch {}
});
// #endif
onShow(async ()=>{ await loadDefaultPlate(); await loadWashCardSummary(); await loadQueueSummary(); });

onShow(async ()=>{
	await loadGreeting();
	await loadWeather();
});

onShow(async ()=>{
	try {
		const http = createHttp();
		const list = await http<any[]>('/content/banners/active', { method: 'GET' });
		banners.value = Array.isArray(list) ? list : [];
	} catch { banners.value = []; }
});

function onTapCarCard(){ if (!loggedIn.value) { navigate('/pages/login/index'); } }
function onTapCarManage(){ navigate('/pages/vehicle/list'); }
function onTapWashCard(){ if (!loggedIn.value) { navigate('/pages/login/index'); return; } navigate('/pages/washcard/index'); }
function abs(u?: string){ if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; return `${API_BASE}${u.startsWith('/')?u:('/'+u)}`; }

function onTapBanner(b:any){ if (b && b.jumpEnabled && b.linkPath) navigateToPath(String(b.linkPath)); }

function pickTimeGreeting(date = new Date()){ const h = date.getHours(); if (h < 5) return '夜深了'; if (h < 9) return '早上好'; if (h < 12) return '上午好'; if (h < 14) return '中午好'; if (h < 18) return '下午好'; if (h < 22) return '晚上好'; return '夜安'; }
async function loadGreeting(){ try { const u = uni.getStorageSync('user') || {}; const name = (u?.name || u?.nickname || '').trim(); userName.value = name || '朋友'; timeGreeting.value = pickTimeGreeting(); const affixes = ['今天也要元气满满','一路顺风，注意安全','生活要有仪式感','愿你今日好心情']; greetAffix.value = affixes[Math.floor(Math.random()*affixes.length)]; } catch { userName.value = '朋友'; timeGreeting.value = pickTimeGreeting(); greetAffix.value = '欢迎回来'; } }

function buildWashAdvice(live: any, forecast: any){
	const w = (live?.weather || '').toString();
	const temp = Number(live?.temperature ?? NaN);
	const humidity = Number(live?.humidity ?? NaN);
	// 未来3天是否有雨
	const casts = forecast?.casts || [];
	const willRain = casts.some((c: any)=>/雨|雪/.test((c?.dayweather||'') + (c?.nightweather||'')));
	// 规则：
	// - 未来有雨 或 当前降水类天气：不建议
	// - 高湿度(>85%)且多云/阴：一般
	// - 温度适中(5~32℃)且晴/多云且未来无雨：推荐
	// - 其余：一般
	if (/雨|雪|雷|雾|霾/.test(w) || willRain) { washAdviceLevel.value = 'bad'; return '近期有降水，建议暂缓洗车，防止刚洗就脏。'; }
	if (!isNaN(humidity) && humidity > 85) { washAdviceLevel.value = 'fair'; return '空气湿度较高，若非刚好有需求，可择时再洗。'; }
	if (!isNaN(temp) && temp >= 5 && temp <= 32 && /晴|多云|阴/.test(w)) { washAdviceLevel.value = 'good'; return '天气稳定，适合洗车，清洁更持久。'; }
	washAdviceLevel.value = 'fair';
	return '天气平稳，可按需安排洗车。';
}

async function loadWeather(){
    try {
        const http = createHttp();
        const data = await http<any>('/content/weather', { method: 'GET', query: { city: '511024' } });
        liveWeather.value = data?.live || null;
        forecastWeather.value = data?.forecast || null;
        washAdvice.value = buildWashAdvice(liveWeather.value, forecastWeather.value);
    } catch (e) {
        liveWeather.value = null;
        forecastWeather.value = null;
        washAdvice.value = '';
        washAdviceLevel.value = '';
    }
}

async function loadWashCardSummary(){
	try {
		if (!getToken()) { washCard.value = null; return; }
		const http = createHttp();
		const cards = await http<any[]>('/wash-card/me/list', { method: 'GET' });
		const def = Array.isArray(cards) ? cards.find(c=>c.isDefault) || cards[0] : null;
		washCard.value = def || null;
	} catch { washCard.value = null; }
}

function computeEtaForNewCar(items: any[]): number {
	// 任务定义：orderIndex 0=外观I(5min), 1=外观II(5min), 2=内饰(10min)
	let totalERemaining = 0;
	for (const it of items) {
		const tasks = Array.isArray(it?.tasks) ? [...it.tasks].sort((a:any,b:any)=>a.orderIndex-b.orderIndex) : [];
		const currentIdx = Number(it?.currentTaskIndex ?? 0);
		const tE1 = tasks.find((t:any)=> t.orderIndex === 0);
		const tE2 = tasks.find((t:any)=> t.orderIndex === 1);
		const e1Dur = Number(tE1?.durationMin ?? 5) || 5;
		const e2Dur = Number(tE2?.durationMin ?? 5) || 5;

		const e1DoneViaIndex = currentIdx > 0; // 任务指针已越过 E1
		const e2DoneViaIndex = currentIdx > 1; // 任务指针已越过 E2
		const e1Status = String(tE1?.status || 'PENDING');
		const e2Status = String(tE2?.status || 'PENDING');

		const isE1Done = e1DoneViaIndex || e1Status === 'DONE';
		const isE2Done = e2DoneViaIndex || e2Status === 'DONE';

		if (!isE1Done) totalERemaining += e1Dur;
		if (!isE2Done) totalERemaining += e2Dur;
	}
	return Math.max(0, Math.round(totalERemaining));
}

async function loadQueueSummary(){
    try {
        const http = createHttp();
        // 统计数量
        const summary = await http<any>('/queue/summary', { method: 'GET' });
        servingCars.value = Number(summary?.servingCars || 0);
        waitingCars.value = Number(summary?.waitingCars || 0);
        // 新 ETA 口径（按类型汇总、按资源组计算），首页取“最短预计等待”
        const etaList = await http<any[]>('/queue/eta-summary', { method: 'GET' });
        const arr = Array.isArray(etaList) ? etaList : [];
        const candidates = arr.filter((t:any)=> t && t.etaConfigured === true && t.excludedFromEta !== true);
        if (!candidates.length) {
            estimatedWaitMinutes.value = 0;
        } else {
            const mins = candidates.map((t:any)=> Number.isFinite(t?.etaForNewCar) ? Number(t.etaForNewCar) : 0);
            estimatedWaitMinutes.value = Math.max(0, Math.min(...mins));
        }
    } catch {
        servingCars.value = 0; waitingCars.value = 0; estimatedWaitMinutes.value = 0;
    }
}
</script>

<style>
.page {
	min-height: 100vh;
	padding: 24rpx 24rpx 0 24rpx;
	background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%);
	box-sizing: border-box;
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
    overflow-x: hidden;
}

.card {
	background: #ffffff;
	border-radius: 24rpx;
	padding: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
	margin-bottom: 24rpx;
}

.car-card {
	background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%);
}

.card-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #2b2f36;
}

/* 顶部公告 */
.notice-card { padding: 16rpx 24rpx; }
.marquee { overflow: hidden; white-space: nowrap; }
.marquee-text { display: inline-block; padding-left: 100%; animation: scroll-left 12s linear infinite; color: #374151; }
@keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

.header-card {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	background: linear-gradient(135deg, #a8d8ff, #ffc9de);
	color: #1f2937;
	padding: 28rpx;
	overflow: hidden;
}
.greet-col { display:flex; flex-direction: column; gap: 8rpx; }
.greeting { font-size: 30rpx; font-weight: 600; }
.greet-sub { font-size: 24rpx; color: #374151; opacity: .9; }
.weather-box { margin-top: 16rpx; width: 100%; background: rgba(255,255,255,.7); border-radius: 20rpx; padding: 18rpx 20rpx; box-shadow: inset 0 2rpx 8rpx rgba(0,0,0,0.04); box-sizing: border-box; }
.weather-row { display:flex; align-items: flex-end; justify-content: space-between; gap: 12rpx; width: 100%; box-sizing: border-box; }
.weather-left { display:flex; flex-direction: column; gap: 6rpx; }
.city { font-size: 26rpx; color: #0f172a; font-weight: 700; letter-spacing: 1rpx; }
.temp { font-size: 56rpx; font-weight: 800; color: #0b1220; line-height: 1; }
.desc { font-size: 24rpx; color: #475569; }
.mini-metrics { margin-top: 8rpx; display:flex; align-items:center; gap: 10rpx; color:#64748b; font-size: 22rpx; }
.dot { opacity: .6; }
.wash-advice { margin-top: 12rpx; display:flex; align-items:center; gap: 10rpx; flex-wrap: wrap; }
.advice-tag { font-size: 22rpx; padding: 6rpx 10rpx; border-radius: 999rpx; background: #fff; border: 2rpx solid #e5e7eb; color:#374151; }
.advice-tag.level-good { border-color: #34d399; color: #065f46; background: #ecfdf5; }
.advice-tag.level-fair { border-color: #fbbf24; color: #78350f; background: #fffbeb; }
.advice-tag.level-bad { border-color: #f87171; color: #7f1d1d; background: #fef2f2; }
.advice-text { font-size: 24rpx; color: #111827; }

.car-card .card-title {
	margin-bottom: 16rpx;
}
.plate-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: #f7fbff;
	border: 2rpx dashed #77bfff;
	border-radius: 20rpx;
	padding: 28rpx;
	position: relative;
}
.plate-left { display:flex; align-items:center; gap: 18rpx; }
.brand-logo { width: 72rpx; height: 72rpx; object-fit: contain; border-radius: 8rpx; background:#fff; border: 2rpx solid #e5e7eb; }
.plate-info { display:flex; flex-direction: column; }
.plate-text {
	font-size: 44rpx;
	font-weight: 700;
	letter-spacing: 4rpx;
	color: #1f2937;
}
.brand-series { margin-top: 6rpx; font-size: 24rpx; color:#6b7280; }
.login-text { font-size: 28rpx; color: #6b7280; }
.empty-text { font-size: 28rpx; color: #6b7280; }
.home-wash-card { margin-bottom: 24rpx; }
.add-btn {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: linear-gradient(135deg, #a8d8ff, #ffc9de);
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.08);
}
.plus-v, .plus-h {
	position: absolute;
	background: #1f2937;
	border-radius: 6rpx;
}
.plus-v { width: 6rpx; height: 36rpx; }
.plus-h { width: 36rpx; height: 6rpx; }

.quota-card .quota-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 18rpx;
}
.quota-usage {
	font-size: 24rpx;
	color: #6b7280;
}
.progress {
	width: 100%;
	height: 14rpx;
	border-radius: 999rpx;
	background: #eef2ff;
	overflow: hidden;
	margin: 8rpx 0 16rpx 0;
}
.progress-inner {
	height: 100%;
	background: linear-gradient(90deg, #a8d8ff, #ffc9de);
}
.quota-footer {
	font-size: 24rpx;
	color: #6b7280;
}

.queue-card .queue-row {
	margin-top: 12rpx;
	font-size: 26rpx;
	color: #111827;
}
.queue-detail {
	margin-top: 16rpx;
	text-align: right;
	font-size: 24rpx;
	color: #2563eb;
}

.queue-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.queue-head { display:flex; align-items:center; justify-content: space-between; }
.queue-title-row { display:flex; align-items:center; gap: 12rpx; }
.queue-status { padding: 8rpx 12rpx; border-radius: 999rpx; font-size: 22rpx; }
.queue-status.free { color:#065f46; background:#ecfdf5; border: 2rpx solid #86efac; }
.queue-status.busy { color:#7c2d12; background:#fff7ed; border: 2rpx solid #fdba74; }
.queue-detail-link { font-size: 24rpx; color:#2563eb; }
.queue-metrics { display:flex; gap: 24rpx; margin-top: 12rpx; }
.metric { display:flex; align-items:center; gap: 8rpx; background:#ffffff; border:2rpx dashed #e5e7eb; border-radius: 999rpx; padding: 8rpx 12rpx; }
.metric .label { font-size: 22rpx; color:#6b7280; }
.metric .value { font-size: 26rpx; color:#111827; font-weight: 600; }
.eta-tag { padding: 8rpx 12rpx; border-radius: 999rpx; font-size: 22rpx; color:#1f2937; background:#ffffff; border: 2rpx dashed #77bfff; }
.queue-progress { margin-top: 12rpx; }
.queue-progress-bar { width:100%; height:16rpx; background:#eef2ff; border-radius: 999rpx; overflow:hidden; }
.queue-progress-inner { height:100%; background: linear-gradient(90deg, #a8d8ff, #ffc9de); }
.queue-progress-text { margin-top: 8rpx; display:block; text-align:right; font-size: 22rpx; color:#6b7280; }
.queue-tips { margin-top: 12rpx; font-size: 24rpx; color:#065f46; background:#ecfdf5; border: 2rpx solid #86efac; padding: 8rpx 12rpx; border-radius: 12rpx; }

.ad-card { padding: 0; overflow: hidden; }
.ad-swiper { width: 100%; height: 220rpx; }
.ad-image { width: 100%; height: 220rpx; display: block; }


</style>

