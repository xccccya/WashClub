<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 左上角返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="title-bar"><text class="title">积分中心</text></view>

		<!-- 顶部积分概览卡片：与首页相同风格，去除跳转文案 -->
		<view class="card points-card">
			<view class="points-head">
				<view class="card-title">我的积分</view>
				<view v-if="multiplier>1" class="bonus-badge">
					<image class="bonus-icon" src="/static/icons/jifenjs.png" />
					<text class="bonus-text">当前享受{{ multiplier }}倍积分加成</text>
				</view>
			</view>
			<view class="points-body">
				<view class="metric">
					<view class="metric-val primary">{{ stats.currentPoints }}</view>
					<view class="metric-label">当前积分</view>
				</view>
				<view class="divider" />
				<view class="metric">
					<view class="metric-val">{{ stats.monthUsed }}</view>
					<view class="metric-label">本月使用</view>
				</view>
				<view class="divider" />
				<view class="metric">
					<view class="metric-val">{{ stats.monthGained }}</view>
					<view class="metric-label">本月获得</view>
				</view>
			</view>
		</view>

		<!-- 积分记录卡片：参照成长值记录样式 -->
		<view class="card logs-card">
			<view class="logs-head"><text class="logs-title">积分记录</text></view>
			<view v-if="logs.length===0" class="empty">
				<view class="empty-illu"></view>
				<view class="empty-title">暂无积分记录</view>
				<view class="empty-sub">完成消费或参与活动可获得积分</view>
				<view class="empty-btn" @tap="goToOrders">去下单赚积分</view>
			</view>
			<view v-else class="logs-list">
				<view class="log-item" v-for="(g, i) in logs" :key="i" @tap="openOrderFromLog(g)">
					<view class="desc-col">
						<view class="desc-row">
							<text class="log-desc">{{ displayDesc(g) }}</text>
							<text v-if="shouldShowOrderNo(g)" class="order-no">{{ g.orderNo }}</text>
						</view>
						<text class="log-time">{{ fmtTime(g.createdAt) }}</text>
					</view>
					<text class="log-change" :class="{ minus: Number(g.change)<0 }">{{ Number(g.change)>=0?('+'+g.change):g.change }}</text>
				</view>
			</view>
		</view>

		<!-- 积分兑换占位卡片 -->
		<view class="card exchange-card">
			<view class="ex-head"><text class="ex-title">积分兑换</text></view>
			<view class="ex-body">
				<view class="ex-text">积分商城即将上线，敬请期待</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
// 声明 uni 与页面栈API（运行时由 uni-app 注入）
declare const uni: any;
declare function getCurrentPages(): any[];
import { ref, onMounted } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { memberControllerGetPointsLogs, memberControllerGetPointsStats, memberControllerMe } from '@wash/api-client';

/** 动态导入 checkAuthAndRefresh，避免小程序模块解析时序问题 */
async function safeCheckAuthAndRefresh(options: { redirectIfExpired?: boolean } = { redirectIfExpired: true }): Promise<boolean> {
	try {
		const { checkAuthAndRefresh } = await import('../../utils/auth');
		return await checkAuthAndRefresh(options);
	} catch { return true; }
}

const { topSpacerHeight, statusBarHeight } = useSafeArea();

const stats = ref<{ currentPoints:number; monthUsed:number; monthGained:number }>({ currentPoints:0, monthUsed:0, monthGained:0 });
const multiplier = ref<number>(1);
const logs = ref<any[]>([]);

onMounted(async ()=>{
  const ok = await safeCheckAuthAndRefresh({ redirectIfExpired: true }); if (!ok) { uni.navigateTo({ url:'/pages/login/index' }); return; }
  await fetchStats(); await fetchLogs(); await fetchProfileLevel();
});

async function fetchStats(){ try{ const s:any = await memberControllerGetPointsStats({} as any); stats.value = { currentPoints: Number(s?.currentPoints||0), monthUsed: Number(s?.monthUsed||0), monthGained: Number(s?.monthGained||0) }; }catch{ stats.value = { currentPoints:0, monthUsed:0, monthGained:0 }; } }
async function fetchLogs(){ try{ const rows:any[] = (await memberControllerGetPointsLogs({ limit: 100 } as any) as unknown) as any[]; logs.value = Array.isArray(rows)?rows:[]; }catch{ logs.value = []; } }
async function fetchProfileLevel(){
  try{
    const p:any = await memberControllerMe();
    const m = Number(p?.level?.pointsMultiplier || 1);
    multiplier.value = Number.isFinite(m) && m >= 1 ? Math.floor(m) : 1;
  }catch{ multiplier.value = 1; }
}

function fmtTime(t?: string){ try{ return new Date(String(t||'')).toLocaleString(); }catch{ return String(t||'-'); } }
function escapeRegExp(s: string){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function displayDesc(g:any){
  let raw = String(g?.desc||'变动');
  const no = String(g?.orderNo||'').trim();
  if (no) {
    raw = raw.replace(new RegExp(`（\\s*订单\\s*${escapeRegExp(no)}\\s*）`, 'g'), '');
    raw = raw.replace(new RegExp(`\\(\\s*订单\\s*${escapeRegExp(no)}\\s*\\)`, 'g'), '');
    raw = raw.replace(new RegExp(`订单\\s*${escapeRegExp(no)}`, 'g'), '订单');
    raw = raw.replace(new RegExp(`${escapeRegExp(no)}`, 'g'), '').replace(/\s{2,}/g, ' ').trim();
  }
  return raw;
}
function shouldShowOrderNo(g:any){
  const no = String(g?.orderNo||'').trim();
  return !!no;
}
function openOrderFromLog(g:any){ try{ const id = Number(g?.orderId||0); const no = String(g?.orderNo||''); if(id){ uni.navigateTo({ url:`/pages/order/detail?id=${id}` }); return; } if(no){ uni.navigateTo({ url:`/pages/order/detail?no=${encodeURIComponent(no)}` }); return; } }catch{} }

function goBack(){ try{ const pages = getCurrentPages(); if (pages && pages.length > 1) uni.navigateBack(); else uni.switchTab({ url:'/pages/me/index' }); }catch{ uni.switchTab({ url:'/pages/me/index' }); } }
function goToOrders(){ try{ uni.switchTab({ url:'/pages/order/index' }); }catch{ uni.switchTab({ url:'/pages/me/index' }); } }
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.title-bar { display:flex; align-items:center; justify-content:flex-start; padding: 8rpx 4rpx 16rpx 4rpx; }
.title { font-size: 36rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }

.card { background: #ffffff; border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom: 24rpx; }
.card-title { font-size: 28rpx; font-weight: 600; color: #2b2f36; }
.points-card { background: linear-gradient(180deg, #ecfeff 0%, #fff7fb 100%); position: relative; overflow: hidden; }
.points-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.bonus-badge { display:inline-flex; align-items:center; gap: 8rpx; padding: 6rpx 12rpx; border-radius: 999rpx; background: rgba(255,255,255,.9); box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.06); border: 2rpx dashed #e5e7eb; }
.bonus-icon { width: 28rpx; height: 28rpx; display:block; }
.bonus-text { font-size: 22rpx; color:#0b1220; font-weight: 700; }
.points-body { display:flex; align-items:stretch; justify-content: space-between; gap: 16rpx; }
.metric { flex:1; display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 12rpx 0; }
.metric-val { font-size: 34rpx; font-weight: 800; color:#0b1220; }
.metric-val.primary { background: linear-gradient(90deg, #60a5fa, #a78bfa); background-clip: text; -webkit-background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }
.metric-label { font-size: 22rpx; color:#6b7280; margin-top: 6rpx; }
.divider { width: 2rpx; background: linear-gradient(180deg, rgba(148,163,184,0.2), rgba(148,163,184,0.06)); border-radius: 999rpx; }

.logs-head { margin-bottom: 12rpx; }
.logs-title { font-size: 28rpx; font-weight: 700; color:#0b1220; }
/* 日志卡片采用页面同款柔和渐变底色 */
.logs-card { background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); backdrop-filter: blur(2rpx); }
.logs-list { display:flex; flex-direction: column; gap: 8rpx; }
.log-item { display:flex; align-items:center; justify-content: space-between; padding: 16rpx 8rpx; border-bottom: 2rpx dashed #e5e7eb; }
.desc-col { display:flex; flex-direction: column; align-items:flex-start; justify-content:center; max-width: 70%; gap: 6rpx; }
/* 保持同一行不换行，并对超出部分省略 */
.desc-row { display:flex; align-items:center; gap: 10rpx; flex-wrap: nowrap; min-width: 0; overflow: hidden; }
.log-desc { font-size: 24rpx; color:#1f2937; flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 小胶囊不换行，视觉增强 */
.order-no { font-size: 22rpx; color:#374151; padding: 4rpx 12rpx; border: 2rpx dashed #e5e7eb; border-radius: 999rpx; background: rgba(255,255,255,.85); display: inline-flex; align-items: center; gap: 6rpx; white-space: nowrap; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
/* 跳转箭头提示 */
.order-no::after { content: '›'; display: inline-block; transform: translateY(-2rpx); color:#9ca3af; margin-left: 4rpx; }
.log-time { font-size: 22rpx; color:#6b7280; }
.log-change { width: 180rpx; text-align: right; font-size: 26rpx; color:#16a34a; font-weight: 700; flex: 0 0 auto; }
.log-change.minus { color:#ef4444; }

/* 空状态 */
.empty { display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 40rpx 0; gap: 12rpx; color:#6b7280; }
.empty-illu { width: 200rpx; height: 160rpx; border-radius: 16rpx; background: linear-gradient(135deg, rgba(168,216,255,0.4), rgba(255,201,222,0.4)); box-shadow: inset 0 0 0 2rpx rgba(255,255,255,.6), 0 6rpx 16rpx rgba(0,0,0,0.06); }
.empty-title { font-size: 28rpx; color:#111827; font-weight: 700; margin-top: 8rpx; }
.empty-sub { font-size: 24rpx; color:#6b7280; }
.empty-btn { margin-top: 8rpx; padding: 12rpx 24rpx; border-radius: 999rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#ffffff; font-size: 24rpx; box-shadow: 0 6rpx 16rpx rgba(96,165,250,0.25); }

/* 积分兑换（移除图片后居中间距优化） */
.exchange-card { background: linear-gradient(180deg, #fff8f0 0%, #f3f9ff 100%); text-align:center; }
.exchange-card .ex-body { padding: 28rpx 0; }
.ex-head { margin-bottom: 10rpx; }
.ex-title { font-size: 28rpx; font-weight: 700; color:#0b1220; }
.ex-body { display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 24rpx 0; gap: 12rpx; }
.ex-text { font-size: 24rpx; color:#6b7280; }
</style>


