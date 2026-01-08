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
			<view :class="['tab', active==='pending' ? 'active' : '']" @tap="setTab('pending')">待生效</view>
			<view :class="['tab', active==='used' ? 'active' : '']" @tap="setTab('used')">已使用</view>
			<view :class="['tab', active==='expired' ? 'active' : '']" @tap="setTab('expired')">已失效</view>
		</view>

		<!-- 列表卡片容器：复用券卡UI -->
		<view class="card gradient-trans">
			<view v-if="loading" class="empty">加载中...</view>
			<view v-else-if="list.length === 0" class="empty">暂无优惠券</view>
			<view v-else>
				<view v-for="it in list" :key="it.id" :class="['coupon-card', isDisabled(it) ? 'coupon-card--disabled' : '']">
					<view class="cc-row-wrap">
						<view class="cc-left">
							<template v-if="displayRule(it)">
								<view class="cc-row">
									<text class="cc-currency" v-if="displayRule(it)?.currency">¥</text>
									<text class="cc-amount">{{ displayRule(it)?.main }}</text>
								</view>
								<text class="cc-sub">{{ displayRule(it)?.sub }}</text>
							</template>
							<template v-else>
								<view class="cc-row">
									<text class="cc-currency">¥</text>
									<text class="cc-amount">{{ faceYuan(it) }}</text>
								</view>
								<text class="cc-sub" v-if="it.minOrderAmount != null && Number(it.minOrderAmount)>0">满{{ formatMoney(it.minOrderAmount) }}可用</text>
							</template>
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
					<!-- 展开详情：紧贴卡片下方 -->
					<view class="coupon-detail">
						<view class="detail-toggle" @tap="() => toggleExpand(it.id)">
							<text class="toggle-text">{{ isExpanded(it.id) ? '点击收起详情' : '点击查看优惠详情' }}</text>
						</view>
						<transition name="detail-fade">
							<view v-if="isExpanded(it.id)" class="detail-body">
								<view v-if="detailDesc(it)" class="detail-item">{{ detailDesc(it) }}</view>
								<view v-if="detailScope(it)" class="detail-item">适用范围：{{ detailScope(it) }}</view>
								<view v-if="detailCap(it)" class="detail-item">折扣封顶金额：{{ detailCap(it) }}</view>
								<view v-if="detailMin(it)" class="detail-item">最低可用门槛金额：{{ detailMin(it) }}</view>
								<view v-if="detailCouponStack(it) !== null" class="detail-item">{{ detailCouponStack(it) ? '可与其他券同用' : '不可与其他券同用' }}</view>
								<view v-if="detailPointsStack(it) !== null" class="detail-item">{{ detailPointsStack(it) ? '可与积分同用' : '不可与积分同用' }}</view>
								<view v-if="detailMemberStack(it) !== null" class="detail-item">{{ detailMemberStack(it) ? '可与会员折扣同用' : '不可与会员折扣同用' }}</view>
							</view>
						</transition>
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
import { miniappCouponControllerMyCoupons } from '@wash/api-client';

/** 动态导入 checkAuthAndRefresh，避免小程序模块解析时序问题 */
async function safeCheckAuthAndRefresh(options: { redirectIfExpired?: boolean } = { redirectIfExpired: true }): Promise<boolean> {
	try {
		const { checkAuthAndRefresh } = await import('../../utils/auth');
		return await checkAuthAndRefresh(options);
	} catch { return true; }
}

type MineItem = {
	id: number;
	name?: string|null;
	faceValue?: number|string|null;
	minOrderAmount?: number|string|null;
	ruleKind?: string|null;
	rulePercent?: number|null;
	ruleAmount?: number|null;
	perMemberLimit?: number|null;
	expiryType?: 'FIXED'|'AFTER_RECEIVE'|'PERMANENT';
	startAt?: string|null;
	endAt?: string|null;
	validDays?: number|null;
	usedAt?: string|null;
};

// 详情展示文案
function displayDescription(it: any){ try{ const d = String(it?.description||it?.coupon?.description||'').trim(); return d || '适用于本店指定商品与服务，具体以页面说明为准。'; }catch{ return '适用于本店指定商品与服务，具体以页面说明为准。'; } }
function displayRuleLine(it: any){
    try{
        const kind = String(it?.ruleKind||'').toLowerCase();
        if (kind === 'percent'){
            const pct = Math.max(0, Number(it?.rulePercent||0));
            if (pct>0){ const off = Math.min(9.9, Math.max(0.1, 10 - pct/10)); return `${off.toFixed(1)}折（不与部分活动同享）`; }
        } else if (kind === 'direct'){
            const amt = Number(it?.ruleAmount||0);
            if (amt>0){ return `立减¥${Math.round(amt)}（不与部分活动同享）`; }
        }
        return '';
    }catch{ return ''; }
}
function displayMinLine(it: any){ try{ const v = Number(it?.minOrderAmount||0); return v>0 ? `满¥${v.toFixed(2)}可用` : ''; }catch{ return ''; } }

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const loading = ref<boolean>(false);
const list = ref<MineItem[]>([]);
const active = ref<'all'|'pending'|'used'|'expired'>('all');
// 展开详情状态
const expanded = ref<Set<number>>(new Set());
function toggleExpand(id: number){ if (expanded.value.has(id)) expanded.value.delete(id); else expanded.value.add(id); }
function isExpanded(id: number){ return expanded.value.has(id); }

function goBack(){ try { const pages = getCurrentPages?.() || []; if (pages.length>1){ uni.navigateBack(); return; } uni.reLaunch({ url:'/pages/me/index' }); } catch { uni.reLaunch({ url:'/pages/me/index' }); } }

function formatDate(d?: string|null){ try { if(!d) return ''; const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const dd=String(x.getDate()).padStart(2,'0'); const hh=String(x.getHours()).padStart(2,'0'); const mm=String(x.getMinutes()).padStart(2,'0'); const ss=String(x.getSeconds()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`; } catch { return ''; } }
function formatMoney(n?: any){ const v = Number(n); return isNaN(v) ? '' : v.toFixed(2); }
function faceYuan(it: MineItem){ try { const n = Number(it.faceValue||0); if (!isFinite(n) || n<=0) return ''; return n.toFixed(2); } catch { return ''; } }
function displayRule(it: any): { currency?: boolean; main: string; sub: string } | null {
    try{
        const kind = String(it?.ruleKind||'').toLowerCase();
        if (kind === 'percent'){
            const pct = Math.max(0, Number(it?.rulePercent||0));
            if (pct > 0){
                const off = Math.min(9.9, Math.max(0.1, 10 - pct/10));
                return { currency: false, main: `${off.toFixed(1)}折`, sub: (it.minOrderAmount!=null && Number(it.minOrderAmount)>0) ? `满${formatMoney(it.minOrderAmount)}可用` : '折扣券' };
            }
        } else if (kind === 'direct'){
            const amt = Number(it?.ruleAmount||0);
            if (amt > 0){
                return { currency: true, main: Number(amt).toFixed(2), sub: (it.minOrderAmount!=null && Number(it.minOrderAmount)>0) ? `满${formatMoney(it.minOrderAmount)}可用` : '立减券' };
            }
        }
        return null;
    }catch{ return null; }
}
function displayExpiry(it: MineItem){ try{ const t=String(it.expiryType||'').toUpperCase(); if(t==='PERMANENT') return '有效期：永久有效'; if(t==='FIXED') return `有效期：${formatDate(it.startAt)} ~ ${formatDate(it.endAt)}`; if(t==='AFTER_RECEIVE') return `有效期：领取后${Number(it.validDays||0)}天`; return '有效期：-'; }catch{ return '有效期：-'; } }
function isExpired(it: any){ try { if (!it?.endAt) return false; return new Date(it.endAt) < new Date(); } catch { return false; } }
function isNotStarted(it: any){ try { if (!it?.startAt) return false; return new Date(it.startAt) > new Date(); } catch { return false; } }
function isDisabled(it: any){ return Boolean(it.usedAt) || isExpired(it) || isNotStarted(it); }

// New detail helpers
function detailDesc(it:any){ try{ const s = String(it?.description||it?.coupon?.description||'').trim(); return s || ''; }catch{ return ''; } }
function detailScope(it:any){ try{ const s=String(it?.applyScope||it?.coupon?.applyScope||'').toUpperCase(); if(!s) return ''; return (s==='ALL')?'全店商品':'指定商品'; }catch{ return ''; } }
function detailCap(it:any){ try{ const n=Number((it?.ruleCap ?? it?.coupon?.ruleJson?.cap) || 0); return n>0?`¥${n.toFixed(2)}`:''; }catch{ return ''; } }
function detailMin(it:any){ try{ const n=Number((it?.ruleMinSubtotal ?? it?.coupon?.ruleJson?.minSubtotal ?? it?.minOrderAmount ?? it?.coupon?.minOrderAmount) || 0); return n>0?`¥${n.toFixed(2)}`:''; }catch{ return ''; } }
function detailCouponStack(it:any){ try{ const v = (typeof it?.allowCombine==='boolean') ? it?.allowCombine : it?.coupon?.allowCombine; return typeof v==='boolean' ? !!v : null; }catch{ return null; } }
function detailPointsStack(it:any){ try{ const v = (typeof it?.allowStackWithPoints==='boolean') ? it?.allowStackWithPoints : it?.coupon?.allowStackWithPoints; return typeof v==='boolean' ? !!v : null; }catch{ return null; } }
function detailMemberStack(it:any){ try{ const v = (typeof it?.allowStackWithMemberDiscount==='boolean') ? it?.allowStackWithMemberDiscount : it?.coupon?.allowStackWithMemberDiscount; return typeof v==='boolean' ? !!v : null; }catch{ return null; } }

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
		if (active.value==='pending') q.notStarted = '1';
		const data:any = await miniappCouponControllerMyCoupons(q as any);
		const arr:any[] = Array.isArray(data?.items) ? data.items : [];
		list.value = arr.map((x:any) => ({
			id: x.id,
			name: x.name ?? x.coupon?.name ?? '优惠券',
			faceValue: x.coupon?.faceValue ?? null,
			minOrderAmount: x.coupon?.minOrderAmount ?? null,
			ruleKind: x.coupon?.ruleJson?.kind ?? null,
			rulePercent: (x.coupon?.ruleJson?.percent ?? x.coupon?.ruleJson?.amount) ?? null,
			ruleAmount: x.coupon?.ruleJson?.kind === 'direct' ? (x.coupon?.ruleJson?.amount ?? null) : null,
			// detail fields for expandable section
			description: x.description ?? x.coupon?.description ?? null,
			applyScope: x.coupon?.applyScope ?? null,
			ruleCap: (x.coupon?.ruleJson?.cap ?? null),
			ruleMinSubtotal: (x.coupon?.ruleJson?.minSubtotal ?? null),
			allowCombine: x.coupon?.allowCombine ?? null,
			allowStackWithPoints: x.coupon?.allowStackWithPoints ?? null,
			allowStackWithMemberDiscount: x.coupon?.allowStackWithMemberDiscount ?? null,
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

function setTab(t: 'all'|'pending'|'used'|'expired'){ if (active.value!==t){ active.value = t; } }

watch(active, ()=>{ refresh(); });

onShow(async ()=>{ const ok = await safeCheckAuthAndRefresh({ redirectIfExpired: true }); if (!ok) { list.value=[]; return; } await refresh(); });
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

/* 券卡片：纵向布局，第一行横向显示主体，第二行显示展开详情 */
.coupon-card { display:flex; flex-direction: column; align-items:stretch; justify-content:flex-start; margin: 20rpx 8rpx; border-radius: 24rpx; overflow:hidden; background:#ffffff; box-shadow: 0 10rpx 28rpx rgba(0,0,0,0.06); border: 2rpx solid #f3f4f6; }
.cc-row-wrap { display:flex; align-items:stretch; justify-content:flex-start; }
.coupon-card--disabled { opacity: 0.9; position: relative; }
.coupon-card--disabled .cc-left::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(17,24,39,.48), rgba(17,24,39,.56)); mix-blend-mode: multiply; pointer-events:none; }

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

/* 详情展开样式（与领券中心保持一致的搭配） */
.coupon-detail { margin: -8rpx 8rpx 12rpx 8rpx; border-radius: 20rpx; overflow: hidden; background: #ffffff; border: 2rpx solid #f1f5f9; box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.04); }
.detail-toggle { display:flex; align-items:center; justify-content:flex-end; gap: 8rpx; padding: 12rpx; color:#334155; background: #f8fafc; }
.toggle-text { font-size: 24rpx; }
.toggle-caret { transition: transform .2s ease; display:inline-block; line-height: 1; }
.toggle-caret.open { transform: rotate(180deg); }
.detail-body { padding: 12rpx 16rpx; color:#4b5563; background: #fff; }
.detail-item { font-size: 22rpx; line-height: 1.7; padding: 6rpx 0; }
.detail-fade-enter-active, .detail-fade-leave-active { transition: all .18s ease; }
.detail-fade-enter-from, .detail-fade-leave-to { opacity: 0; transform: translateY(-4rpx); }
</style>


