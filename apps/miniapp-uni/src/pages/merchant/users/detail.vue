<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="topbar" :style="{ height: topSpacerHeight + 'px', paddingTop: statusBarHeight + 'px' }">
			<view class="topbar-inner" :style="{ height: navBarHeight + 'px' }">
				<view class="topbar-back" @tap="goBack">
					<uni-icons type="left" :size="22" color="rgba(15,23,42,0.86)" />
				</view>
				<text class="topbar-title">用户详情</text>
				<view class="topbar-right" />
			</view>
		</view>

		<view class="card header-card">
			<view class="header">
				<view class="header-left">
					<image class="avatar" :src="avatarOf(member?.avatarUrl)" mode="aspectFill" />
					<view class="header-meta">
						<view class="name-row">
							<text class="name">{{ member?.name || '会员用户' }}</text>
							<view v-if="member?.level?.name" class="pill level-pill">{{ member.level.name }}</view>
						</view>
						<view class="sub">
							<text class="sub-item">ID {{ member?.id ?? memberId ?? '-' }}</text>
							<text class="dot">·</text>
							<text class="sub-item">UID {{ member?.uid ?? '-' }}</text>
						</view>
						<view class="sub">
							<text class="sub-item">{{ member?.phone || '未绑定手机号' }}</text>
						</view>
					</view>
				</view>
				<view class="header-right">
					<view class="call-btn" :class="{ disabled: !member?.phone }" @tap="call(member?.phone)">
						<uni-icons type="phone-filled" :size="18" color="rgba(15,23,42,0.78)" />
						<text class="call-text">拨打</text>
					</view>
					<view class="last-visit">
						<text class="last-visit__label">上次到店</text>
						<text class="last-visit__value">{{ orderStats?.lastVisitAt ? formatTime(orderStats?.lastVisitAt) : '—' }}</text>
					</view>
				</view>
			</view>
		</view>

		<view class="card" v-if="loading">
			<view class="loading-text">加载中…</view>
		</view>
		<view class="card" v-else-if="!member">
			<view class="empty">用户不存在或无权限访问</view>
		</view>

		<template v-else>
			<view class="card">
				<view class="card-title">用户概况</view>
				<view class="stats">
					<view class="stat">
						<text class="k">累计消费金额</text>
						<text class="v">{{ formatMoney(orderStats?.totalPaidAmount) }}</text>
					</view>
					<view class="stat">
						<text class="k">累计洗车次数</text>
						<text class="v">{{ num(orderStats?.totalWashCount) }}</text>
					</view>
					<view class="stat">
						<text class="k">累计划扣次数</text>
						<text class="v">{{ num(washStats?.deductTimes) }}</text>
					</view>
					<view class="stat">
						<text class="k">洗车卡剩余总次数</text>
						<text class="v">{{ num(washStats?.remainingTimes) }}</text>
					</view>
				</view>
			</view>

			<view class="card">
				<view class="section-head">
					<view class="card-title">基础信息</view>
				</view>
				<view class="kv">
					<text class="k">昵称</text>
					<text class="v">{{ member?.name || '-' }}</text>
				</view>
				<view class="kv">
					<text class="k">手机号</text>
					<text class="v">{{ member?.phone || '-' }}</text>
				</view>
				<view class="kv">
					<text class="k">会员等级</text>
					<text class="v">{{ member?.level?.name || '-' }}</text>
				</view>
				<view class="kv">
					<text class="k">会员分类</text>
					<text class="v">{{ member?.category?.name || '-' }}</text>
				</view>
				<view class="kv">
					<text class="k">积分</text>
					<text class="v">{{ num(member?.points) }}</text>
				</view>
				<view class="kv">
					<text class="k">成长值</text>
					<text class="v">{{ num(member?.growthPoints) }}</text>
				</view>
				<view class="kv">
					<text class="k">注册时间</text>
					<text class="v">{{ formatTime(member?.createdAt) }}</text>
				</view>
				<view class="kv">
					<text class="k">活跃时间</text>
					<text class="v">{{ formatTime(member?.lastActiveAt) }}</text>
				</view>
			</view>

			<view class="card">
				<view class="section-head">
					<view class="card-title">用户标签</view>
				</view>
				<view v-if="(member?.tags || []).length" class="tags">
					<view v-for="t in (member?.tags || [])" :key="String(t.id || t.name)" class="tag">{{ t.name }}</view>
				</view>
				<view v-else class="muted">暂无标签</view>
			</view>
		</template>
	</view>
</template>

<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { useSafeArea } from '../../../utils/safe-area';
import { getToken } from '../../../utils/auth';
import { resolveImageUrl } from '../../../utils/url';
import { systemMiniappEmployeeControllerMyEmployeeProfile, systemSettingControllerGetPublicSetting } from '@wash/api-client';
import { getMemberDetail, getMemberOrderStats, getMemberWashCardStats, type MemberLite, type MemberOrderStats, type MemberWashCardStats } from '../../../services/member';

declare const uni: any;

const { topSpacerHeight, statusBarHeight, navBarHeight } = useSafeArea();

/** 动态导入 checkAuthAndRefresh，避免小程序模块解析时序问题 */
async function safeCheckAuthAndRefresh(options: { redirectIfExpired?: boolean } = { redirectIfExpired: true }): Promise<boolean> {
	try {
		const { checkAuthAndRefresh } = await import('../../../utils/auth');
		return await checkAuthAndRefresh(options);
	} catch {
		return true;
	}
}

const memberId = ref<number | null>(null);
const member = ref<MemberLite | null>(null);
const orderStats = ref<MemberOrderStats | null>(null);
const washStats = ref<MemberWashCardStats | null>(null);
const loading = ref(false);

const siteSetting = ref<{ defaultMemberAvatarUrl?: string | null } | null>(null);
async function ensureSiteSetting() {
	if (siteSetting.value) return;
	try {
		siteSetting.value = ((await systemSettingControllerGetPublicSetting()) as any) || null;
	} catch {
		siteSetting.value = { defaultMemberAvatarUrl: null };
	}
}
function avatarOf(url?: string | null) {
	const candidate = url || siteSetting.value?.defaultMemberAvatarUrl || '';
	const abs = resolveImageUrl(candidate);
	return abs || '/static/icons/placeholder.png';
}

async function ensureEmployeeAccess(): Promise<boolean> {
	const ok = await safeCheckAuthAndRefresh({ redirectIfExpired: true });
	if (!ok) return false;
	const token = getToken();
	if (!token) {
		uni.showToast({ title: '请先登录', icon: 'none' });
		try {
			uni.navigateTo({ url: '/pages/login/index' });
		} catch {}
		return false;
	}
	try {
		const r: any = await systemMiniappEmployeeControllerMyEmployeeProfile({} as any);
		if (r?.enabled === true) return true;
	} catch {}
	uni.showToast({ title: '暂无权限访问', icon: 'none' });
	setTimeout(() => {
		try {
			uni.navigateBack();
		} catch {}
	}, 350);
	return false;
}

async function loadDetail() {
	if (!memberId.value) return;
	loading.value = true;
	try {
		await ensureSiteSetting();
		const id = Number(memberId.value);
		const [m, os, ws] = await Promise.all([getMemberDetail(id), getMemberOrderStats(id), getMemberWashCardStats(id)]);
		member.value = m;
		orderStats.value = os;
		washStats.value = ws;
	} finally {
		loading.value = false;
	}
}

function num(v: any): string {
	const n = Number(v || 0);
	if (!Number.isFinite(n)) return '0';
	return String(n);
}
function formatMoney(v: any): string {
	try {
		const n = Number(v || 0);
		if (!Number.isFinite(n)) return '¥0.00';
		return `¥${n.toFixed(2)}`;
	} catch {
		return '¥0.00';
	}
}
function formatTime(v?: string | null) {
	if (!v) return '-';
	try {
		const d = new Date(v as any);
		if (isNaN(d.getTime())) return '-';
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		const hh = String(d.getHours()).padStart(2, '0');
		const mi = String(d.getMinutes()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
	} catch {
		return '-';
	}
}

function call(phone?: string) {
	const p = String(phone || '').trim();
	if (!p) {
		uni.showToast({ title: '用户未绑定手机号', icon: 'none' });
		return;
	}
	try {
		uni.makePhoneCall({ phoneNumber: p });
	} catch {
		uni.showToast({ title: '拨号失败', icon: 'none' });
	}
}

function goBack() {
	try {
		uni.navigateBack();
	} catch {}
}

onLoad((opts: any) => {
	try {
		const id = Number(opts?.id || 0);
		memberId.value = Number.isFinite(id) && id > 0 ? id : null;
	} catch {
		memberId.value = null;
	}
});

onShow(async () => {
	const ok = await ensureEmployeeAccess();
	if (!ok) return;
	await loadDetail();
});
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

.topbar {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	z-index: 20;
	box-sizing: border-box;
	background: rgba(255, 255, 255, 0.78);
	border-bottom: 1rpx solid rgba(148, 163, 184, 0.18);
}
@supports ((-webkit-backdrop-filter: blur(8px)) or (backdrop-filter: blur(8px))) {
	.topbar {
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}
}
.topbar-inner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20rpx;
}
.topbar-back {
	width: 72rpx;
	height: 72rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	box-shadow: none;
}
.topbar-back:active {
	opacity: 0.72;
}
.topbar-title {
	font-size: 30rpx;
	font-weight: 900;
	color: #0f172a;
	letter-spacing: 0.6rpx;
}
.topbar-right {
	width: 72rpx;
	height: 72rpx;
}

.card {
	background: rgba(255, 255, 255, 0.96);
	border-radius: 26rpx;
	padding: 26rpx;
	box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.05), 0 2rpx 10rpx rgba(15, 23, 42, 0.03);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	margin-bottom: 24rpx;
	position: relative;
	overflow: hidden;
}
.header-card {
	background: linear-gradient(135deg, #edf7ff 0%, #fff2f8 58%, rgba(255, 255, 255, 0.98) 100%);
}
.header{
	display:flex;
	align-items:flex-start;
	justify-content: space-between;
	gap: 12rpx;
}
.header-left {
	display: flex;
	align-items: center;
	gap: 14rpx;
	min-width: 0;
}
.header-right {
	flex: 0 0 auto;
	display:flex;
	flex-direction: column;
	align-items:flex-end;
	gap: 12rpx;
}
.avatar {
	width: 96rpx;
	height: 96rpx;
	border-radius: 999rpx;
	background: #f1f5f9;
	flex: 0 0 auto;
}
.header-meta {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}
.name-row {
	display: flex;
	align-items: center;
	gap: 10rpx;
	min-width: 0;
}
.name {
	font-size: 32rpx;
	font-weight: 900;
	color: #0f172a;
	max-width: 52vw;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.pill {
	padding: 6rpx 10rpx;
	border-radius: 999rpx;
	font-size: 20rpx;
	font-weight: 800;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	background: rgba(241, 245, 249, 0.92);
	color: rgba(15, 23, 42, 0.72);
	flex: 0 0 auto;
}
.level-pill {
	background: rgba(239, 246, 255, 0.9);
	border-color: rgba(37, 99, 235, 0.18);
	color: rgba(37, 99, 235, 0.9);
}
.sub {
	font-size: 22rpx;
	color: rgba(15, 23, 42, 0.62);
	font-weight: 700;
	display: flex;
	align-items: center;
	gap: 10rpx;
	min-width: 0;
}
.sub-item {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.dot {
	color: rgba(148, 163, 184, 0.9);
}
.call-btn {
	display: inline-flex;
	align-items: center;
	gap: 8rpx;
	padding: 12rpx 16rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.9);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: 0 6rpx 14rpx rgba(15, 23, 42, 0.04);
}
.call-btn.disabled {
	opacity: 0.4;
}
.call-text {
	font-size: 22rpx;
	font-weight: 900;
	color: #0f172a;
}
.last-visit{
	padding: 10rpx 12rpx;
	border-radius: 18rpx;
	background: rgba(255,255,255,0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: inset 0 2rpx 10rpx rgba(15,23,42,0.03);
	text-align: right;
}
.last-visit__label{
	display:block;
	font-size: 20rpx;
	color: rgba(15, 23, 42, 0.56);
	font-weight: 800;
}
.last-visit__value{
	display:block;
	margin-top: 4rpx;
	font-size: 22rpx;
	color:#0f172a;
	font-weight: 900;
	font-variant-numeric: tabular-nums;
}

.card-title {
	font-size: 28rpx;
	font-weight: 900;
	color: #0f172a;
	letter-spacing: 0.2rpx;
	margin-bottom: 14rpx;
}
.loading-text {
	font-size: 24rpx;
	color: #6b7280;
	padding: 10rpx 0;
}
.empty {
	font-size: 24rpx;
	color: #6b7280;
	padding: 24rpx 0;
	text-align: center;
}

.stats {
	display: flex;
	gap: 12rpx;
	flex-wrap: wrap;
}
.stat {
	flex: 1;
	min-width: 210rpx;
	background: rgba(255, 255, 255, 0.92);
	border-radius: 20rpx;
	padding: 18rpx;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: inset 0 2rpx 10rpx rgba(15, 23, 42, 0.03);
	display: flex;
	flex-direction: column;
	gap: 10rpx;
}
.stat .k {
	font-size: 22rpx;
	color: #6b7280;
	font-weight: 800;
}
.stat .v {
	font-size: 34rpx;
	font-weight: 900;
	color: #0f172a;
	line-height: 1.1;
	font-variant-numeric: tabular-nums;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
}
.kv {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12rpx;
	padding: 14rpx 0;
	border-bottom: 1rpx dashed rgba(148, 163, 184, 0.22);
}
.kv:last-child {
	border-bottom: none;
}
.kv .k {
	font-size: 22rpx;
	color: rgba(15, 23, 42, 0.62);
	font-weight: 800;
	flex: 0 0 auto;
}
.kv .v {
	font-size: 24rpx;
	color: #0f172a;
	font-weight: 900;
	text-align: right;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 58vw;
}
.muted {
	color: rgba(15, 23, 42, 0.62);
	font-size: 22rpx;
	font-weight: 700;
}
.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 10rpx;
}
.tag {
	padding: 8rpx 12rpx;
	border-radius: 999rpx;
	background: rgba(241, 245, 249, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	color: rgba(15, 23, 42, 0.78);
	font-size: 22rpx;
	font-weight: 800;
}
</style>

