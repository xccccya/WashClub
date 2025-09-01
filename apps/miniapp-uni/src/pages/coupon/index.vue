<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 左上角返回按钮（与地址页一致） -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<!-- 标题条 -->
		<view class="title-bar">
			<text class="title">领券中心</text>
		</view>

		<!-- 列表卡片容器 -->
		<view class="card gradient-trans">
			<view v-if="loading" class="empty">加载中...</view>
			<view v-else-if="list.length === 0" class="empty">暂时没有可领取优惠券</view>
			<view v-else>
				<view v-for="it in list" :key="it.id" :class="['coupon-card', it.soldOut || it.reachedLimit ? 'coupon-card--disabled' : '']">
					<!-- 左侧金额色块（支持直减/折扣展示） -->
					<view class="cc-left">
						<template v-if="displayRule(it)">
							<view class="cc-row">
								<text class="cc-currency" v-if="displayRule(it).currency">¥</text>
								<text class="cc-amount">{{ displayRule(it).main }}</text>
							</view>
							<text class="cc-sub">{{ displayRule(it).sub }}</text>
						</template>
						<template v-else>
							<view class="cc-row">
								<text class="cc-currency">¥</text>
								<text class="cc-amount">{{ faceYuan(it) }}</text>
							</view>
							<text class="cc-sub" v-if="it.minOrderAmount != null && Number(it.minOrderAmount)>0">满{{ formatMoney(it.minOrderAmount) }}可用</text>
						</template>
					</view>
					<!-- 中间虚线撕口分隔 -->
					<view class="cc-divider">
						<view class="cc-notch cc-notch--top"></view>
						<view class="cc-dash"></view>
						<view class="cc-notch cc-notch--bottom"></view>
					</view>
					<!-- 右侧信息区 -->
					<view class="cc-right">
						<view class="cc-name">{{ it.name }}</view>
						<view class="cc-meta">{{ displayExpiry(it) }}</view>
						<view class="cc-limit-row">
							<text class="cc-limit" v-if="it.perMemberLimit != null">每人限领 {{ it.perMemberLimit }} 张</text>
						</view>
						<view class="cc-actions">
							<view v-if="it.soldOut" class="status-tag soldout">已领完</view>
							<view v-else-if="it.reachedLimit" class="status-tag limit">达到上限</view>
							<view v-else class="btn-claim" :class="{ disabled: claimingIds.has(it.id) || it.notStarted || it.expired }" @tap="() => (!it.notStarted && !it.expired) ? claim(it) : null">{{ it.notStarted ? '未开始' : (it.expired ? '已过期' : '领取') }}</view>
						</view>
					</view>
				</view>
			</view>
		</view>

		<!-- 底部跳转：查看我的优惠券 -->
		<view style="height: 24rpx;"></view>
		<view class="actions-bottom">
			<view class="btn-my-coupons" @tap="goMyCoupons">查看我的优惠券</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import { createHttp, checkAuthAndRefresh } from '../../utils/auth';

type CouponItem = {
	id: number;
	name: string;
	imageUrl?: string|null;
	description?: string|null;
	expiryType?: 'FIXED'|'AFTER_RECEIVE'|'PERMANENT';
	startAt?: string|null;
	endAt?: string|null;
	validDays?: number|null;
	faceValue?: number|string|null;
	minOrderAmount?: number|string|null;
	perMemberLimit?: number|null;
	issueTotal?: number|null;
	allowMiniappClaim?: boolean;
	issuedCount?: number;
	ownedCount?: number;
	soldOut?: boolean;
	reachedLimit?: boolean;
	canClaim?: boolean;
};

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const http = createHttp();
const loading = ref<boolean>(false);
const list = ref<CouponItem[]>([]);
const claimingIds = ref<Set<number>>(new Set());

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/me/index' });
	} catch { uni.reLaunch({ url: '/pages/me/index' }); }
}

function formatDate(d?: string|null){ try { if(!d) return ''; const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const dd=String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; } catch { return ''; } }
function formatMoney(n?: any){ const v = Number(n); return isNaN(v) ? '' : v.toFixed(2); }

function faceYuan(it: CouponItem){ try { const n = Number(it.faceValue||0); if (isNaN(n) || n<=0) return ''; const intv = Math.round(n); return String(intv); } catch { return ''; } }
// 展示直减/折扣规则，不改变卡片高度
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
                return { currency: true, main: String(Math.round(amt)), sub: (it.minOrderAmount!=null && Number(it.minOrderAmount)>0) ? `满${formatMoney(it.minOrderAmount)}可用` : '立减券' };
            }
        }
        return null;
    }catch{ return null; }
}
function displayExpiry(it: CouponItem){
	try{
		const t = String(it.expiryType||'').toUpperCase();
		if (t === 'PERMANENT') return '有效期：永久有效';
		if (t === 'FIXED') return `有效期：${formatDate(it.startAt)} ~ ${formatDate(it.endAt)}`;
		if (t === 'AFTER_RECEIVE') return `有效期：领取后${Number(it.validDays||0)}天`;
		return '有效期：-';
	}catch{ return '有效期：-'; }
}


async function refresh(){
	loading.value = true;
	try{
		const data:any = await http('/coupon/miniapp/claimable', { method:'GET' });
		const arr:any[] = Array.isArray(data?.items) ? data.items : [];
		// 排序：可领取（可领）> 未开始 > 已过期；并将已达上限/售罄置后
		arr.sort((a:any,b:any)=>{
			const ra = (a.soldOut||a.reachedLimit) ? 3 : (a.expired ? 2 : (a.notStarted ? 1 : 0));
			const rb = (b.soldOut||b.reachedLimit) ? 3 : (b.expired ? 2 : (b.notStarted ? 1 : 0));
			return ra - rb;
		});
		list.value = arr;
	}catch{ list.value = []; }
	finally{ loading.value = false; }
}

async function claim(it: CouponItem){
	if (!it || it.soldOut || it.reachedLimit) return;
	if (claimingIds.value.has(it.id)) return;
	try{
		claimingIds.value.add(it.id);
		await http(`/coupon/miniapp/${it.id}/claim`, { method:'POST' });
		uni.showToast({ title:'领取成功', icon:'success' });
		await refresh();
	}catch(e:any){ uni.showToast({ title: (e?.message||'领取失败').slice(0,20), icon:'none' }); }
	finally{ claimingIds.value.delete(it.id); }
}

onShow(async ()=>{ const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!ok) { list.value = []; return; } await refresh(); });

function goMyCoupons(){ try { uni.navigateTo({ url: '/pages/coupon/mine' }); } catch {} }
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.title-bar { display:flex; align-items:center; justify-content:flex-start; padding: 8rpx 4rpx 16rpx 4rpx; }
.title { font-size: 36rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }
.card { background: linear-gradient(180deg, rgba(243,249,255,0.92) 0%, rgba(255,247,251,0.92) 100%); border-radius: 24rpx; padding: 16rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); backdrop-filter: blur(2rpx); }
.empty { padding: 24rpx; color: #6b7280; text-align: center; }

/* 券卡片全新布局：左金额色块 + 中间撕口 + 右信息与操作 */
.coupon-card { display:flex; align-items:stretch; justify-content:flex-start; margin: 20rpx 8rpx; border-radius: 24rpx; overflow:hidden; background:#ffffff; box-shadow: 0 10rpx 28rpx rgba(0,0,0,0.06); border: 2rpx solid #f3f4f6; }
.coupon-card--disabled { opacity: 0.85; filter: grayscale(10%); }

/* 左侧金额色块：粉紫渐变 */
.cc-left { flex: 0 0 auto; min-width: 180rpx; padding: 16rpx 14rpx; background: linear-gradient(135deg, #fca5a5, #c084fc); color:#fff; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; position: relative; }
.cc-row { display:flex; align-items:baseline; gap: 4rpx; }
.cc-currency { font-size: 24rpx; line-height: 1; opacity: .95; }
.cc-amount { font-size: 44rpx; font-weight: 900; line-height: 1.05; letter-spacing: 1rpx; }
.cc-amount-text { font-size: 40rpx; font-weight: 800; letter-spacing: 1rpx; }
.cc-sub { margin-top: 4rpx; font-size: 20rpx; opacity: .95; }

/* 中间撕口分隔 */
.cc-divider { width: 42rpx; position: relative; display:flex; align-items:center; justify-content:center; background: #fff; }
.cc-notch { position:absolute; left:-14rpx; width: 28rpx; height: 28rpx; background:#f3f4f6; border-radius: 50%; box-shadow: inset 0 0 0 2rpx #e5e7eb; }
.cc-notch--top { top: -14rpx; }
.cc-notch--bottom { bottom: -14rpx; }
.cc-dash { width: 0; height: 64%; border-left: 4rpx dashed #e5e7eb; }

/* 右侧信息 */
.cc-right { flex: 1; padding: 16rpx 18rpx; display:flex; flex-direction:column; gap: 6rpx; justify-content:center; }
.cc-name { font-size: 30rpx; font-weight: 800; color:#0b1220; letter-spacing: .5rpx; }
.cc-meta { font-size: 24rpx; color:#6b7280; }
.cc-limit-row { display:flex; gap: 12rpx; flex-wrap: wrap; }
.cc-limit { font-size: 22rpx; color:#374151; background:#f3f4f6; padding: 4rpx 10rpx; border-radius: 999rpx; }
.cc-issue { font-size: 22rpx; color:#374151; background:#f3f4f6; padding: 4rpx 10rpx; border-radius: 999rpx; }
.cc-actions { margin-top: 4rpx; display:flex; align-items:center; justify-content:flex-end; }

.status-tag { padding: 10rpx 18rpx; border-radius: 999rpx; font-size: 22rpx; }
.status-tag.soldout { background: #fee2e2; color: #991b1b; border: 2rpx solid #fecaca; }
.status-tag.limit { background: #fef9c3; color: #854d0e; border: 2rpx solid #fde68a; }
.btn-claim { padding: 8rpx 20rpx; border-radius: 999rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08); }
.btn-claim.disabled { opacity: 0.6; }

/* 返回按钮样式复用地址页 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }

/* 底部查看我的优惠券 */
.actions-bottom { padding: 0 8rpx; }
.btn-my-coupons { text-align:center; padding: 20rpx 0; border-radius: 999rpx; background: #fff; border: 2rpx solid #e5e7eb; color:#111827; box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.04); }
</style>


