<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 左上角返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<!-- 标题 + 筛选 -->
		<view class="title-bar">
			<text class="title">我的优惠券</text>
		</view>
		<view class="filters card">
			<view :class="['tab', active==='all' ? 'active' : '']" @tap="setTab('all')">全部</view>
			<view :class="['tab', active==='used' ? 'active' : '']" @tap="setTab('used')">已使用</view>
			<view :class="['tab', active==='expired' ? 'active' : '']" @tap="setTab('expired')">已失效</view>
		</view>

		<!-- 列表卡片容器：复用券卡UI -->
		<view class="card gradient-trans">
			<view v-if="loading" class="empty">加载中...</view>
			<view v-else-if="list.length === 0" class="empty">暂无优惠券</view>
			<view v-else>
				<view v-for="it in list" :key="it.id" :class="['coupon-card', isDisabled(it) ? 'coupon-card--disabled' : '']">
					<view class="cc-left">
						<view class="cc-row">
							<text class="cc-currency">¥</text>
							<text class="cc-amount">{{ faceYuan(it) }}</text>
						</view>
						<text class="cc-sub" v-if="it.minOrderAmount != null && Number(it.minOrderAmount)>0">满{{ formatMoney(it.minOrderAmount) }}可用</text>
					</view>
					<view class="cc-divider">
						<view class="cc-notch cc-notch--top"></view>
						<view class="cc-dash"></view>
						<view class="cc-notch cc-notch--bottom"></view>
					</view>
					<view class="cc-right">
						<view class="cc-name">{{ it.name }}</view>
						<view class="cc-meta">{{ displayExpiry(it) }}</view>
						<view class="cc-limit-row">
							<text class="cc-limit" v-if="it.perMemberLimit != null">每人限领 {{ it.perMemberLimit }} 张</text>
						</view>
						<view class="cc-actions">
							<view v-if="Boolean(it.usedAt)" class="status-tag limit">已使用</view>
							<view v-else-if="isExpired(it)" class="status-tag soldout">已失效</view>
							<view v-else-if="isNotStarted(it)" class="status-tag" style="background:#eef2ff;color:#312e81;border:2rpx solid #c7d2fe;">未生效</view>
							<view v-else class="status-tag" style="background:#ecfeff;color:#0e7490;border:2rpx solid #a5f3fc;">可使用</view>
						</view>
						<view v-if="expiryTo(it)" class="cc-expire-bottom"><text class="cc-expire-to">{{ expiryTo(it) }}</text></view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import { createHttp, checkAuthAndRefresh } from '../../utils/auth';

type MineItem = {
	id: number;
	name?: string|null;
	faceValue?: number|string|null;
	minOrderAmount?: number|string|null;
	perMemberLimit?: number|null;
	expiryType?: 'FIXED'|'AFTER_RECEIVE'|'PERMANENT';
	startAt?: string|null;
	endAt?: string|null;
	validDays?: number|null;
	usedAt?: string|null;
};

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const http = createHttp();
const loading = ref<boolean>(false);
const list = ref<MineItem[]>([]);
const active = ref<'all'|'used'|'expired'>('all');

function goBack(){ try { const pages = getCurrentPages?.() || []; if (pages.length>1){ uni.navigateBack(); return; } uni.reLaunch({ url:'/pages/me/index' }); } catch { uni.reLaunch({ url:'/pages/me/index' }); } }

function formatDate(d?: string|null){ try { if(!d) return ''; const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const dd=String(x.getDate()).padStart(2,'0'); const hh=String(x.getHours()).padStart(2,'0'); const mm=String(x.getMinutes()).padStart(2,'0'); const ss=String(x.getSeconds()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`; } catch { return ''; } }
function formatMoney(n?: any){ const v = Number(n); return isNaN(v) ? '' : v.toFixed(2); }
function faceYuan(it: MineItem){ try { const n = Number(it.faceValue||0); if (isNaN(n) || n<=0) return ''; return String(Math.round(n)); } catch { return ''; } }
function displayExpiry(it: MineItem){ try{ const t=String(it.expiryType||'').toUpperCase(); if(t==='PERMANENT') return '有效期：永久有效'; if(t==='FIXED') return `有效期：${formatDate(it.startAt)} ~ ${formatDate(it.endAt)}`; if(t==='AFTER_RECEIVE') return `有效期：领取后${Number(it.validDays||0)}天`; return '有效期：-'; }catch{ return '有效期：-'; } }
function isExpired(it: any){ try { if (!it?.endAt) return false; return new Date(it.endAt) < new Date(); } catch { return false; } }
function isNotStarted(it: any){ try { if (!it?.startAt) return false; return new Date(it.startAt) > new Date(); } catch { return false; } }
function isDisabled(it: any){ return Boolean(it.usedAt) || isExpired(it); }

function expiryTo(it: MineItem){
	try{
		const t=String(it.expiryType||'').toUpperCase();
		if (t==='PERMANENT') return '';
		const end = it.endAt ? formatDate(it.endAt) : '';
		return end ? `有效期至：${end}` : '';
	}catch{ return ''; }
}

async function refresh(){
	loading.value = true;
	try{
		const q:any = {};
		if (active.value==='used') q.used = '1';
		if (active.value==='expired') q.expired = '1';
		const data:any = await http('/coupon/miniapp/mine', { method:'GET', query: q });
		const arr:any[] = Array.isArray(data?.items) ? data.items : [];
		list.value = arr.map((x:any)=>({
			id: x.id,
			name: x.name ?? x.coupon?.name ?? '优惠券',
			faceValue: x.coupon?.faceValue ?? null,
			minOrderAmount: x.coupon?.minOrderAmount ?? null,
			perMemberLimit: x.coupon?.perMemberLimit ?? null,
			expiryType: x.expiryType ?? x.coupon?.expiryType ?? 'PERMANENT',
			startAt: x.startAt ?? x.coupon?.startAt ?? null,
			endAt: x.endAt ?? x.coupon?.endAt ?? null,
			validDays: x.coupon?.validDays ?? null,
			usedAt: x.usedAt ?? null,
		}));
		// 排序：可使用优先（已生效且未用且未过期）> 未生效 > 已使用 > 已失效
		list.value.sort((a:any,b:any)=>{
			const sa = isExpired(a)?3:(a.usedAt?2:(isNotStarted(a)?1:0));
			const sb = isExpired(b)?3:(b.usedAt?2:(isNotStarted(b)?1:0));
			return sa - sb;
		});
	} catch { list.value = []; }
	finally { loading.value = false; }
}

function setTab(t: 'all'|'used'|'expired'){ if (active.value!==t){ active.value = t; } }

watch(active, ()=>{ refresh(); });

onShow(async ()=>{ const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!ok) { list.value=[]; return; } await refresh(); });
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.title-bar { display:flex; align-items:center; justify-content:flex-start; padding: 8rpx 4rpx 8rpx 4rpx; }
.title { font-size: 36rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }
.card { background: linear-gradient(180deg, rgba(243,249,255,0.92) 0%, rgba(255,247,251,0.92) 100%); border-radius: 24rpx; padding: 16rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); backdrop-filter: blur(2rpx); }
.empty { padding: 24rpx; color: #6b7280; text-align: center; }

/* 筛选 Tabs */
.filters { display:flex; align-items:center; gap: 12rpx; margin-bottom: 16rpx; padding: 12rpx; }
.filters .tab { flex:1; text-align:center; padding: 14rpx 0; border-radius: 999rpx; background:#fff; border: 2rpx solid #e5e7eb; color:#1f2937; }
.filters .tab.active { color:#fff; background: linear-gradient(135deg, #60a5fa, #a78bfa); border:none; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08); }

/* 券卡片：复用样式，与领券中心保持一致 */
.coupon-card { display:flex; align-items:stretch; justify-content:flex-start; margin: 20rpx 8rpx; border-radius: 24rpx; overflow:hidden; background:#ffffff; box-shadow: 0 10rpx 28rpx rgba(0,0,0,0.06); border: 2rpx solid #f3f4f6; }
.coupon-card--disabled { opacity: 0.85; filter: grayscale(10%); }

.cc-left { flex: 0 0 auto; min-width: 180rpx; padding: 16rpx 14rpx; background: linear-gradient(135deg, #fca5a5, #c084fc); color:#fff; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; position: relative; }
.cc-row { display:flex; align-items:baseline; gap: 4rpx; }
.cc-currency { font-size: 24rpx; line-height: 1; opacity: .95; }
.cc-amount { font-size: 44rpx; font-weight: 900; line-height: 1.05; letter-spacing: 1rpx; }
.cc-amount-text { font-size: 40rpx; font-weight: 800; letter-spacing: 1rpx; }
.cc-sub { margin-top: 4rpx; font-size: 20rpx; opacity: .95; }

.cc-divider { width: 42rpx; position: relative; display:flex; align-items:center; justify-content:center; background: #fff; }
.cc-notch { position:absolute; left:-14rpx; width: 28rpx; height: 28rpx; background:#f3f4f6; border-radius: 50%; box-shadow: inset 0 0 0 2rpx #e5e7eb; }
.cc-notch--top { top: -14rpx; }
.cc-notch--bottom { bottom: -14rpx; }
.cc-dash { width: 0; height: 64%; border-left: 4rpx dashed #e5e7eb; }

.cc-right { flex: 1; padding: 16rpx 18rpx; display:flex; flex-direction:column; gap: 6rpx; justify-content:center; }
.cc-name { font-size: 30rpx; font-weight: 800; color:#0b1220; letter-spacing: .5rpx; }
.cc-meta { font-size: 24rpx; color:#6b7280; }
.cc-expire-to { font-size: 20rpx; color:#374151; margin-right: 12rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-limit-row { display:flex; gap: 12rpx; flex-wrap: wrap; }
.cc-limit { font-size: 22rpx; color:#374151; background:#f3f4f6; padding: 4rpx 10rpx; border-radius: 999rpx; }
.cc-actions { margin-top: 4rpx; display:flex; align-items:center; justify-content:flex-end; }
.status-tag { padding: 10rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; }
.status-tag.soldout { background: #fee2e2; color: #991b1b; border: 2rpx solid #fecaca; }
.status-tag.limit { background: #fef9c3; color: #854d0e; border: 2rpx solid #fde68a; }
.cc-expire-bottom { margin-top: 6rpx; display:flex; align-items:center; justify-content:flex-end; }

/* 返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


