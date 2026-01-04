<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 顶部滚动公告 -->
		<view class="card notice-card" v-if="noticeHome">
			<view class="notice-row">
				<uni-icons class="notice-speaker" type="sound" :size="18" color="rgba(15,23,42,0.72)" />
				<view class="marquee">
					<text class="marquee-text">{{ noticeHome }}</text>
				</view>
			</view>
		</view>
		<!-- 顶部欢迎卡片：问候 + 天气 + 洗车建议 + 营业状态 -->
		<view class="card header-card">
			<view class="header-top">
				<view class="greet-col">
					<text class="greeting">Hi～{{ userName }}，{{ timeGreeting }}！</text>
					<text class="greet-sub" v-if="greetAffix">{{ greetAffix }}</text>
				</view>
				<view class="biz-badge" :data-type="businessType">
					<text class="dot"></text>
					<text class="text">{{ businessLabel }}</text>
				</view>
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
			<!-- 休息/暂停：展示运营文案 -->
			<view v-if="businessType==='REST'" class="queue-tips">店铺打烊，欢迎明天再来～</view>
			<view v-else-if="businessType==='PAUSED'" class="queue-tips" style="color:#7f1d1d;background:#fef2f2;border-color:#fecaca;">暂时停业，敬请谅解</view>
			<!-- 正常/忙碌：展示排队数据 -->
			<view v-else>
				<view class="queue-head">
					<view class="queue-title-row">
						<text class="card-title">排队信息</text>
						<view class="queue-status" :class="waitingCars > 0 ? 'busy' : 'free'">
							<text>{{ waitingCars > 0 ? '排队中' : '无需等待' }}</text>
						</view>
					</view>
					<view class="queue-detail-link" @tap="onTapQueueDetail">查看详情 ›</view>
				</view>
				<view class="queue-metrics">
					<view class="metric"><text class="label">服务中</text><text class="value">{{ servingCars }}</text></view>
					<view class="metric"><text class="label">等待中</text><text class="value">{{ waitingCars }}</text></view>
					<view class="eta-tag">最快预计 {{ estimatedWaitMinutes }} 分钟</view>
				</view>
				<view v-if="estimatedWaitMinutes > 0" class="queue-progress">
					<view class="queue-progress-bar"><view class="queue-progress-inner" :style="{ width: waitTimePercent + '%' }" /></view>
					<text class="queue-progress-text">最快预计：{{ estimatedWaitMinutes }} 分钟</text>
				</view>
				<view v-else class="queue-tips">现在无需等待，欢迎直接前往服务</view>
			</view>
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
import { checkAuthAndRefresh, getToken, API_BASE } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
import WashCard from '../../components/WashCard.vue';
import { adBannerControllerActive, queueControllerEtaSummary, queueControllerSummary, scrollNoticeControllerActive, systemSettingControllerGetPublicBusinessStatus, vehicleControllerMyVehicles, washCardControllerMyList, weatherControllerGetWeather } from '@wash/api-client';

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

// 营业状态（展示）
type BizStatus = 'OPEN'|'REST'|'BUSY'|'PAUSED';
const businessType = ref<BizStatus>('REST');
const businessLabel = ref<string>('休息中');
async function loadBusiness(){
  try{
    const j:any = await systemSettingControllerGetPublicBusinessStatus();
    businessType.value = (j?.status||'REST') as BizStatus;
    businessLabel.value = String(j?.label||'休息中');
  }catch{}
}

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
	// 未登录时不请求“我的车辆列表”，避免产生 401 噪音
	const t = getToken();
	if (!t) {
		plateNo.value = '-';
		brand.value = '';
		series.value = '';
		brandImage.value = '';
		hasCar.value = false;
		return;
	}
	try {
		// token 已由 @wash/shared-utils 自动从 uni storage 注入到 Authorization 头中，无需 query 传参
		const vehicles = (await vehicleControllerMyVehicles({} as any) as unknown as any[]);
		const def = Array.isArray(vehicles) ? vehicles.find(v=>v.isDefault) || vehicles[0] : null;
		plateNo.value = def?.plateNumber || '-';
		brand.value = def?.brand || '';
		series.value = def?.series || '';
		brandImage.value = def?.brandImage || '';
		hasCar.value = !!def;
	} catch (e:any) {
		plateNo.value = '-';
		hasCar.value = false;
		// 仅在已登录时提示一次，避免首页频繁打扰
		try {
			const authed = !!getToken();
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const g: any = globalThis as any;
			if (authed && !g.__VEHICLE_LOAD_TOASTED__) {
				g.__VEHICLE_LOAD_TOASTED__ = true;
				uni.showToast({ title: String(e?.message || '车辆加载失败').slice(0, 30), icon: 'none' });
			}
		} catch {}
	}
}

// #ifdef MP-WEIXIN || H5
// 首页仅静默刷新资料，不强制登录
onShow(async ()=>{ loggedIn.value = !!getToken(); const ok = await checkAuthAndRefresh({ redirectIfExpired: false }); if (ok) loggedIn.value = true; });
function normalizeNotice(s: unknown): string {
	return String(s ?? '')
		.replace(/\r?\n+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
onShow(async ()=>{
	try {
		const active = await scrollNoticeControllerActive({ type: 'home' } as any) as any;
		noticeHome.value = normalizeNotice(active?.content || '');
	} catch {}
});
// #endif
onShow(async ()=>{ await loadBusiness(); await loadDefaultPlate(); await loadWashCardSummary(); await loadQueueSummary(); });

onShow(async ()=>{
	await loadGreeting();
	await loadWeather();
});

onShow(async ()=>{
	try {
		const list = await adBannerControllerActive() as any;
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
	const nowWeather = String(live?.weather || '').trim();
	const temp = Number(live?.temperature ?? NaN);
	const humidity = Number(live?.humidity ?? NaN);
	const windPowerText = String(live?.windpower ?? ''); // 可能是 "3" 或 "3级"
	const parseWind = (s:string)=>{ const n = parseInt(String(s).replace(/[^0-9]/g,''), 10); return Number.isFinite(n) ? n : NaN; };
	const wind = parseWind(windPowerText);

	let score = 80; // 0~100，越高越适合洗车
	const casts = Array.isArray(forecast?.casts) ? forecast.casts : [];

	// 当前降水/能见度类天气影响
	if (/暴雪|大雪|中雪|小雪|雨夹雪|冰雹/.test(nowWeather)) score -= 50;
	else if (/暴雨|大雨|雷阵雨|阵雨/.test(nowWeather)) score -= 45;
	else if (/中雨/.test(nowWeather)) score -= 35;
	else if (/小雨/.test(nowWeather)) score -= 25;
	if (/沙|尘|雾|霾/.test(nowWeather)) score -= 20;

	// 湿度影响
	if (!isNaN(humidity)) {
		if (humidity >= 90) score -= 20; // 极高湿度，干燥慢
		else if (humidity >= 80) score -= 10; // 偏高
	}

	// 温度影响
	if (!isNaN(temp)) {
		if (temp <= 0) score -= 25; // 可能结冰
		else if (temp < 5) score -= 15; // 偏低
		else if (temp > 38) score -= 20; // 炎热
		else if (temp > 32) score -= 10; // 偏高
	}

	// 风力影响（≥5级有明显体感与扬尘可能）
	if (Number.isFinite(wind)) {
		if (wind >= 7) score -= 20;
		else if (wind >= 5) score -= 10;
	}

	// 短期（~36h）与中期（~72h）降水预报权重
	let heavyRainSoon = false; // 短期强降水
	let rainWithin36h = false; // 短期任意降水
	let rainLater = false; // 更晚降水
	for (let i = 0; i < casts.length; i++) {
		const c:any = casts[i] || {};
		const text = String((c?.dayweather||'') + (c?.nightweather||'')).trim();
		const hasRain = /雨|雪/.test(text);
		const isHeavy = /(暴雨|大雨|雷阵雨|雨夹雪|暴雪|大雪)/.test(text);
		if (hasRain) {
			if (i === 0 || i === 1) { // 约等于未来 0~36 小时
				rainWithin36h = true;
				if (isHeavy) heavyRainSoon = true;
			} else {
				rainLater = true;
			}
		}
	}
	if (heavyRainSoon) score -= 35;
	else if (rainWithin36h) score -= 18;
	else if (rainLater) score -= 8;

	// 得分映射到等级
	score = Math.max(0, Math.min(100, Math.round(score)));
	let level: 'good'|'fair'|'bad';
	if (score >= 70) level = 'good';
	else if (score >= 40) level = 'fair';
	else level = 'bad';

	// 生成提示文案（简洁、面向用户）
	let advice = '';
	if (level === 'good') {
		advice = '天气稳定，适合洗车，清洁效果更持久。';
		if (rainLater && !rainWithin36h) advice = '短期天气较好，适合洗车，注意两天后可能降水。';
	} else if (level === 'fair') {
		advice = '条件一般，可按需安排洗车。';
		if (rainWithin36h) advice = '未来一天可能有降水，如非刚需可择时洗车。';
		if (/雾|霾|沙|尘/.test(nowWeather)) advice = '能见度较差且空气质量一般，洗车效果可能受影响。';
	} else {
		if (heavyRainSoon || /雨|雪/.test(nowWeather)) advice = '当前或短期有明显降水，建议暂缓洗车。';
		else if (!isNaN(temp) && temp <= 0) advice = '气温过低可能结冰，建议暂缓洗车。';
		else advice = '当前条件不佳，建议暂缓洗车或择时进行。';
	}
	washAdviceLevel.value = level;
	return advice;
}

async function loadWeather(){
    try {
        const data = await weatherControllerGetWeather({ city: '511024' } as any) as any;
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
		const cards = await washCardControllerMyList({} as any) as any;
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
        // 统计数量
        const summary = await queueControllerSummary() as any;
        servingCars.value = Number(summary?.servingCars || 0);
        waitingCars.value = Number(summary?.waitingCars || 0);
        // 新 ETA 口径（按类型汇总、按资源组计算），首页取“最短预计等待”
        const etaList = await queueControllerEtaSummary() as any;
        const arr = Array.isArray(etaList) ? etaList : [];
        const candidates = arr.filter((t:any)=> t && t.etaConfigured === true && t.excludedFromEta !== true);
        if (!candidates.length) {
            estimatedWaitMinutes.value = 0;
        } else {
            const mins = candidates
                .map((t:any)=> Number(t?.etaForNewCar))
                .filter((m:number)=> Number.isFinite(m) && m > 0);
            estimatedWaitMinutes.value = mins.length ? Math.max(0, Math.min(...mins)) : 0;
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
	/* 更克制的品牌渐变：降低饱和与对比，让内容更“高级” */
	background: linear-gradient(180deg, #eff7ff 0%, #fff3f7 56%, #ffffff 100%);
	box-sizing: border-box;
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
    overflow-x: hidden;
}

.card {
	/* 统一卡片语言：干净、克制的白底 + 轻边框 + 轻阴影（避免高光影响可读性） */
	background: rgba(255, 255, 255, 0.96);
	border-radius: 26rpx;
	padding: 26rpx;
	box-shadow:
		0 10rpx 24rpx rgba(15, 23, 42, 0.05),
		0 2rpx 10rpx rgba(15, 23, 42, 0.03);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	margin-bottom: 24rpx;
	position: relative;
	overflow: hidden; /* 兼容内部圆角裁切（不再叠加高光层） */
}
/* H5 支持时增加轻微磨砂（小程序会忽略，不影响） */
@supports ((-webkit-backdrop-filter: blur(6px)) or (backdrop-filter: blur(6px))) {
	.card { -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
}

.car-card {
	/* 更低对比的柔和底色，保证文字对比度 */
	background: linear-gradient(
		135deg,
		rgba(168, 216, 255, 0.16) 0%,
		rgba(255, 209, 232, 0.12) 55%,
		rgba(255, 255, 255, 0.96) 100%
	);
}

.card-title {
	font-size: 28rpx;
	font-weight: 700;
	color: #0f172a;
	letter-spacing: .2rpx;
}

/* 顶部公告 */
/* 滚动公告：与页面卡片风格一致的“轻质感”，并增加克制的视觉引导 */
.notice-card {
	padding: 16rpx 20rpx 16rpx 24rpx;
	/* 用“顶部细渐变描边”替代左侧强调条，更克制耐看 */
	background: linear-gradient(
		180deg,
		rgba(59, 130, 246, 0.06) 0%,
		rgba(236, 72, 153, 0.04) 24%,
		rgba(255, 255, 255, 0.92) 70%
	);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.05);
	overflow: hidden;
	position: relative;
}
.notice-card::before{
	content: '';
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	height: 6rpx;
	background: linear-gradient(90deg, rgba(59, 130, 246, 0.32), rgba(236, 72, 153, 0.26));
}
.notice-row{
	display:flex;
	align-items:center;
	gap: 12rpx;
}
.notice-speaker{
	flex: 0 0 auto;
	opacity: .92;
	transform: translateY(0.5rpx);
}
.marquee { flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; }
.marquee-text {
	display: inline-block;
	padding-left: 100%;
	animation: scroll-left 14s linear infinite;
	color: #1f2937;
	font-size: 24rpx;
	font-weight: 700;
	white-space: nowrap !important;
	word-break: keep-all;
	overflow-wrap: normal;
}
@keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

.header-card {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	/* 去除高光光斑，降低底色饱和度，增强可读性 */
	background: linear-gradient(135deg, #edf7ff 0%, #fff2f8 58%, rgba(255,255,255,0.98) 100%);
	color: #1f2937;
	padding: 28rpx;
	overflow: hidden;
	position: relative;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.header-top{ width:100%; display:flex; align-items:flex-start; justify-content:space-between; gap: 16rpx; }
.biz-badge{ display:inline-flex; align-items:center; gap:8rpx; padding: 6rpx 12rpx; border-radius: 999rpx; background: rgba(255,255,255,0.92); border: 1rpx solid rgba(148,163,184,0.22); box-shadow: 0 6rpx 14rpx rgba(15,23,42,0.05); }
.biz-badge .dot{ width: 12rpx; height: 12rpx; border-radius: 50%; }
.biz-badge .text{ font-size: 22rpx; font-weight: 800; letter-spacing: .2rpx; }
.biz-badge[data-type="OPEN"]{ background:#ecfdf5; border-color:#86efac; color:#065f46; }
.biz-badge[data-type="OPEN"] .dot{ background:#16a34a; }
.biz-badge[data-type="REST"]{ background:#f1f5f9; border-color:#cbd5e1; color:#334155; }
.biz-badge[data-type="REST"] .dot{ background:#64748b; }
.biz-badge[data-type="BUSY"]{ background:#fff7ed; border-color:#fdba74; color:#7c2d12; }
.biz-badge[data-type="BUSY"] .dot{ background:#f59e0b; }
.biz-badge[data-type="PAUSED"]{ background:#fef2f2; border-color:#fecaca; color:#7f1d1d; }
.biz-badge[data-type="PAUSED"] .dot{ background:#ef4444; }
.greet-col { display:flex; flex-direction: column; gap: 8rpx; }
.greeting { font-size: 34rpx; font-weight: 900; line-height: 1.22; letter-spacing: .6rpx; }
.greet-sub { font-size: 24rpx; color: rgba(15, 23, 42, 0.72); line-height: 1.38; }
.weather-box {
	margin-top: 16rpx;
	width: 100%;
	background: rgba(255,255,255,0.90);
	border-radius: 22rpx;
	padding: 18rpx 20rpx;
	box-shadow: inset 0 2rpx 8rpx rgba(0,0,0,0.035);
	box-sizing: border-box;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.weather-row { display:flex; align-items: flex-end; justify-content: space-between; gap: 12rpx; width: 100%; box-sizing: border-box; }
.weather-left { display:flex; flex-direction: column; gap: 6rpx; }
.city { font-size: 26rpx; color: #0f172a; font-weight: 800; letter-spacing: 1rpx; }
.temp { font-size: 58rpx; font-weight: 900; color: #0b1220; line-height: 1; }
.desc { font-size: 24rpx; color: #475569; line-height: 1.35; }
.mini-metrics { margin-top: 10rpx; display:flex; align-items:center; gap: 10rpx; color:#64748b; font-size: 22rpx; flex-wrap: wrap; }
.dot { opacity: .6; }
.wash-advice {
	margin-top: 14rpx;
	width: 100%;
	display:flex;
	/* 两行文本时更自然：tag 与第一行基线对齐 */
	align-items: baseline;
	gap: 10rpx;
	/* 关键：容器不换行；文本在自身盒子内多行换行，避免 H5 下 tag/内容“断开” */
	flex-wrap: nowrap;
	padding: 10rpx 14rpx;
	background: rgba(255,255,255,0.90);
	border-radius: 18rpx;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-sizing: border-box;
}
.advice-tag {
	flex: 0 0 auto;
	display: inline-flex;
	align-items: center;
	font-size: 22rpx;
	padding: 6rpx 10rpx;
	border-radius: 999rpx;
	background: #fff;
	border: 1rpx solid rgba(148, 163, 184, 0.22);
	color:#374151;
	line-height: 1.15;
	white-space: nowrap;
}
.advice-tag.level-good { border-color: rgba(52, 211, 153, 0.8); color: #065f46; background: rgba(236, 253, 245, 0.92); }
.advice-tag.level-fair { border-color: rgba(251, 191, 36, 0.85); color: #78350f; background: rgba(255, 251, 235, 0.95); }
.advice-tag.level-bad { border-color: rgba(248, 113, 113, 0.85); color: #7f1d1d; background: rgba(254, 242, 242, 0.95); }
.advice-text {
	flex: 1 1 auto;
	min-width: 0;
	font-size: 24rpx;
	color: #111827;
	line-height: 1.5;
	word-break: break-word;
	overflow-wrap: anywhere;
	/* 最多两行，避免卡片过高（H5/小程序均生效，非支持环境会自然换行） */
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	overflow: hidden;
}

.car-card .card-title {
	margin-bottom: 16rpx;
}
.plate-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: rgba(255,255,255,0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	border-radius: 22rpx;
	padding: 28rpx;
	position: relative;
	box-shadow: inset 0 2rpx 10rpx rgba(15,23,42,0.03);
}
.plate-left { display:flex; align-items:center; gap: 18rpx; }
.brand-logo { width: 72rpx; height: 72rpx; object-fit: contain; border-radius: 12rpx; background:#fff; border: 1rpx solid rgba(148, 163, 184, 0.22); }
.plate-info { display:flex; flex-direction: column; }
.plate-text {
	font-size: 44rpx;
	font-weight: 900;
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
	background: linear-gradient(135deg, rgba(168, 216, 255, 0.95), rgba(255, 201, 222, 0.95));
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 10rpx 22rpx rgba(15,23,42,0.10);
	border: 1rpx solid rgba(255,255,255,0.75);
}
.plus-v, .plus-h {
	position: absolute;
	background: rgba(15, 23, 42, 0.86);
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

.queue-card {
	/* 更克制的底色，避免在排队数据区域产生“眩光感” */
	background: linear-gradient(
		135deg,
		rgba(168, 216, 255, 0.14) 0%,
		rgba(255, 209, 232, 0.10) 55%,
		rgba(255, 255, 255, 0.96) 100%
	);
}
.queue-head { display:flex; align-items:center; justify-content: space-between; }
.queue-title-row { display:flex; align-items:center; gap: 12rpx; }
.queue-status { padding: 8rpx 12rpx; border-radius: 999rpx; font-size: 22rpx; font-weight: 700; }
.queue-status.free { color:#065f46; background:#ecfdf5; border: 2rpx solid #86efac; }
.queue-status.busy { color:#7c2d12; background:#fff7ed; border: 2rpx solid #fdba74; }
.queue-detail-link { font-size: 24rpx; color:#2563eb; font-weight: 700; }
.queue-metrics { display:flex; gap: 20rpx; margin-top: 12rpx; flex-wrap: wrap; }
.metric { display:flex; align-items:center; gap: 8rpx; background: rgba(255,255,255,0.92); border: 1rpx solid rgba(148, 163, 184, 0.18); border-radius: 999rpx; padding: 8rpx 12rpx; box-shadow: 0 6rpx 14rpx rgba(15,23,42,0.04); }
.metric .label { font-size: 22rpx; color:#6b7280; }
.metric .value { font-size: 26rpx; color:#111827; font-weight: 600; }
.eta-tag { padding: 8rpx 12rpx; border-radius: 999rpx; font-size: 22rpx; color:#0f172a; font-weight: 700; background: rgba(255,255,255,0.92); border: 1rpx solid rgba(148, 163, 184, 0.18); box-shadow: 0 6rpx 14rpx rgba(15,23,42,0.04); }
.queue-progress { margin-top: 12rpx; }
.queue-progress-bar { width:100%; height:16rpx; background: rgba(226, 232, 240, 0.8); border-radius: 999rpx; overflow:hidden; border: 1rpx solid rgba(148, 163, 184, 0.14); }
.queue-progress-inner { height:100%; background: linear-gradient(90deg, #a8d8ff, #ffc9de); }
.queue-progress-text { margin-top: 8rpx; display:block; text-align:right; font-size: 22rpx; color:#6b7280; }
.queue-tips { margin-top: 12rpx; font-size: 24rpx; color:#065f46; background: rgba(236,253,245,0.8); border: 2rpx solid rgba(134,239,172,0.9); padding: 10rpx 12rpx; border-radius: 14rpx; }

.ad-card { padding: 0; overflow: hidden; }
/* 本次不调整广告横幅卡片（避免受全局 card 风格影响） */
.ad-card{
	border: 2rpx solid rgba(255, 255, 255, 0.68);
	box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.08);
	background: rgba(255, 255, 255, 0.86);
}
.ad-swiper { width: 100%; height: 220rpx; }
.ad-image { width: 100%; height: 220rpx; display: block; }


</style>

