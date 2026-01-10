<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="topbar" :style="{ height: topSpacerHeight + 'px', paddingTop: statusBarHeight + 'px' }">
			<view class="topbar-inner" :style="{ height: navBarHeight + 'px' }">
				<view class="topbar-back" @tap="goBack">
					<uni-icons type="left" :size="22" color="rgba(15,23,42,0.86)" />
				</view>
				<text class="topbar-title">用户管理</text>
				<view class="topbar-right" />
			</view>
		</view>

		<view class="card">
			<view class="search-row">
				<view class="search-box">
					<uni-icons type="search" :size="18" color="rgba(15,23,42,0.56)" />
					<input
						v-model="keyword"
						class="search-input"
						placeholder="按昵称/手机号模糊搜索（如手机号后四位）"
						confirm-type="search"
						@confirm="onSearch"
					/>
					<view v-if="keyword" class="search-clear" @tap="clearKeyword">
						<uni-icons type="closeempty" :size="18" color="rgba(15,23,42,0.56)" />
					</view>
				</view>
				<view class="search-btn" :class="{ disabled: loading }" @tap="onSearch">搜索</view>
			</view>

			<view class="filters">
				<text class="filter-label">筛选</text>
				<view class="seg" :data-active="washCardFilter==='all'" @tap="setWashCardFilter('all')">全部</view>
				<view class="seg" :data-active="washCardFilter==='hasRemaining'" @tap="setWashCardFilter('hasRemaining')">未用完洗车卡</view>
				<text v-if="washCardFilter==='hasRemaining' && statsWarming" class="filter-tip">筛选中…</text>
			</view>

			<view class="sort-row">
				<text class="sort-label">排序</text>
				<view class="sort-pill" @tap="openSortSheet">
					<text class="sort-pill-text">{{ sortDisplayText }}</text>
					<text class="sort-pill-arrow">›</text>
				</view>
			</view>
		</view>

		<view class="card">
			<view class="list-head">
				<text class="card-title">用户列表</text>
				<text class="muted">{{ totalText }}</text>
			</view>

			<view v-if="loading && members.length===0" class="loading-text">加载中…</view>
			<view v-else-if="members.length===0" class="empty">暂无用户</view>

			<view v-else class="list">
				<view v-for="m in displayMembers" :key="String(m.id || m.uid || Math.random())" class="row">
					<image class="avatar" :src="avatarOf(m.avatarUrl)" mode="aspectFill" />
					<view class="meta">
						<view class="name-row">
							<text class="name">{{ m.name || '未命名用户' }}</text>
							<view v-if="m.level?.name" class="pill level-pill">{{ m.level.name }}</view>
							<view v-if="remainingTimesOf(m) !== null" class="pill washcard-pill" :class="{ 'washcard-pill--empty': (remainingTimesOf(m) || 0) <= 0 }">
								余次 {{ remainingTimesOf(m) }}
							</view>
						</view>
						<view class="sub">
							<text class="sub-item">UID {{ m.uid ?? '-' }}</text>
							<text class="dot">·</text>
							<text class="sub-item">{{ m.phone || '未绑定手机号' }}</text>
						</view>
						<view v-if="sortBy" class="sort-hint">
							<text class="sort-hint-label">{{ sortHintLabel }}</text>
							<text class="sort-hint-value">{{ sortHintValue(m) }}</text>
						</view>
					</view>
					<view class="actions">
						<view class="icon-btn" :class="{ disabled: !m.phone }" @tap.stop="() => call(m.phone)">
							<uni-icons type="phone-filled" :size="18" color="rgba(15,23,42,0.78)" />
						</view>
						<view class="icon-btn primary" @tap.stop="() => goDetail(m)">
							<uni-icons type="right" :size="18" color="rgba(15,23,42,0.78)" />
						</view>
					</view>
				</view>
			</view>

			<view v-if="members.length>0" class="list-footer">
				<text v-if="noMore" class="muted">已加载全部</text>
				<text v-else-if="loading" class="muted">加载中…</text>
				<text v-else class="muted">上滑加载更多</text>
			</view>
		</view>

		<!-- 排序弹层（与筛选分离） -->
		<view v-if="sortSheetVisible" class="sheet-mask" @tap="closeSortSheet">
			<view class="sheet" @tap.stop>
				<view class="sheet-head">
					<text class="sheet-title">排序</text>
					<view class="sheet-close" @tap="closeSortSheet">
						<uni-icons type="closeempty" :size="20" color="rgba(15,23,42,0.72)" />
					</view>
				</view>

				<view class="sheet-section">
					<text class="sheet-section-title">排序字段</text>
					<view class="sheet-grid">
						<view
							v-for="opt in sortOptions"
							:key="opt.value"
							class="sheet-chip"
							:data-active="pendingSortBy===opt.value"
							@tap="() => (pendingSortBy = opt.value)"
						>
							<text class="sheet-chip-text">{{ opt.label }}</text>
						</view>
					</view>
				</view>

				<view class="sheet-section">
					<text class="sheet-section-title">排序方向</text>
					<view class="sheet-grid">
						<view class="sheet-chip" :data-active="pendingSortOrder==='desc'" @tap="() => (pendingSortOrder = 'desc')">
							<text class="sheet-chip-text">倒序</text>
						</view>
						<view class="sheet-chip" :data-active="pendingSortOrder==='asc'" @tap="() => (pendingSortOrder = 'asc')">
							<text class="sheet-chip-text">正序</text>
						</view>
					</view>
				</view>

				<view class="sheet-actions">
					<view class="sheet-btn ghost" @tap="clearSortPending">清除排序</view>
					<view class="sheet-btn primary" @tap="applySortPending">确定</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../../utils/safe-area';
import { getToken } from '../../../utils/auth';
import { resolveImageUrl } from '../../../utils/url';
import { systemMiniappEmployeeControllerMyEmployeeProfile, systemSettingControllerGetPublicSetting } from '@wash/api-client';
import { getMemberWashCardStats, listMembers, type MemberLite, type MemberWashCardStats, type MemberSortBy, type SortOrder } from '../../../services/member';

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

const keyword = ref('');
const washCardFilter = ref<'all' | 'hasRemaining'>('all');
const members = ref<MemberLite[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const noMore = ref(false);
const statsWarming = ref(false);

// 排序（与筛选分离）
const sortBy = ref<MemberSortBy | ''>('');
const sortOrder = ref<SortOrder>('desc');
const sortSheetVisible = ref(false);
const pendingSortBy = ref<MemberSortBy | ''>('');
const pendingSortOrder = ref<SortOrder>('desc');

const sortOptions = [
	{ value: 'createdAt', label: '注册时间' },
	{ value: 'totalPaidAmount', label: '累计消费金额' },
	{ value: 'totalWashCount', label: '累计洗车次数' },
	{ value: 'lastVisitAt', label: '到店时间' },
	{ value: 'lastActiveAt', label: '登录时间' },
] as const;

const sortDisplayText = computed(() => {
	if (!sortBy.value) return '默认';
	const opt = sortOptions.find((o) => o.value === sortBy.value);
	const dir = sortOrder.value === 'asc' ? '↑' : '↓';
	return `${opt?.label || '排序'} ${dir}`;
});
const sortHintLabel = computed(() => {
	if (!sortBy.value) return '';
	const opt = sortOptions.find((o) => o.value === sortBy.value);
	return `${opt?.label || '排序依据'}：`;
});

function openSortSheet() {
	pendingSortBy.value = sortBy.value || '';
	pendingSortOrder.value = sortOrder.value || 'desc';
	sortSheetVisible.value = true;
}
function closeSortSheet() {
	sortSheetVisible.value = false;
}
function clearSortPending() {
	pendingSortBy.value = '';
	pendingSortOrder.value = 'desc';
}
async function applySortPending() {
	sortBy.value = pendingSortBy.value || '';
	sortOrder.value = pendingSortOrder.value || 'desc';
	closeSortSheet();
	await fetchList(true);
	if (washCardFilter.value === 'hasRemaining') await applyWashCardFilterWarmup();
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
function sortHintValue(m: MemberLite): string {
	const key = sortBy.value;
	if (!key) return '';
	if (key === 'createdAt') return formatTime(m.createdAt);
	if (key === 'totalPaidAmount') return formatMoney((m as any).totalPaidAmount);
	if (key === 'totalWashCount') return `${num((m as any).totalWashCount)} 次`;
	if (key === 'lastVisitAt') return formatTime((m as any).lastVisitAt);
	if (key === 'lastActiveAt') return formatTime(m.lastActiveAt);
	return '-';
}

// 洗车卡统计（用于“未用完洗车卡”筛选）
const washStats = ref<Record<string, MemberWashCardStats | null>>({});
const washStatsLoading = ref<Record<string, boolean>>({});

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

async function setWashCardFilter(v: 'all' | 'hasRemaining') {
	if (washCardFilter.value === v) return;
	washCardFilter.value = v;
	if (v === 'hasRemaining') {
		// 启用筛选后，从第一页开始更稳定（避免“加载了很多但筛选结果很少”的体验）
		await fetchList(true);
		await applyWashCardFilterWarmup();
	}
}

function memberIdOf(m: MemberLite): number | null {
	const id = Number(m?.id || 0);
	return Number.isFinite(id) && id > 0 ? id : null;
}
function remainingTimesOf(m: MemberLite): number | null {
	const id = memberIdOf(m);
	if (!id) return null;
	const s = washStats.value[String(id)];
	if (!s) return null;
	return Number(s.remainingTimes || 0) || 0;
}

const displayMembers = computed(() => {
	const arr = members.value || [];
	if (washCardFilter.value === 'hasRemaining') {
		return arr.filter((m) => {
			const id = memberIdOf(m);
			if (!id) return false;
			const st = washStats.value[String(id)];
			// 统计未就绪时先不展示，避免筛选结果“闪动”
			if (!st) return false;
			return Number(st.remainingTimes || 0) > 0;
		});
	}
	return arr;
});

// 顶部“共 xxx 条”展示：筛选属于前端本地过滤，需要跟随展示列表变化
const totalText = computed(() => {
	if (washCardFilter.value === 'hasRemaining') {
		// 这是“当前已加载范围内”的筛选结果数量；若后续加载更多会自动更新
		const n = displayMembers.value.length;
		return n > 0 ? `共 ${n} 条` : '';
	}
	return total.value > 0 ? `共 ${total.value} 条` : '';
});

async function runPool<T>(items: T[], limit: number, worker: (it: T) => Promise<void>) {
	const queue = items.slice();
	const n = Math.max(1, Math.min(8, Number(limit || 4) || 4));
	const runners = Array.from({ length: n }).map(async () => {
		while (queue.length) {
			const it = queue.shift();
			if (it === undefined) return;
			try {
				await worker(it);
			} catch {}
		}
	});
	await Promise.all(runners);
}

async function ensureWashStatsForMembers(list: MemberLite[]) {
	const ids = (list || [])
		.map(memberIdOf)
		.filter((v): v is number => typeof v === 'number' && v > 0);
	const uniq = Array.from(new Set(ids));
	const need = uniq.filter((id) => washStats.value[String(id)] === undefined && !washStatsLoading.value[String(id)]);
	if (!need.length) return;
	await runPool(
		need,
		4,
		async (id) => {
			washStatsLoading.value[String(id)] = true;
			try {
				const st = await getMemberWashCardStats(id);
				washStats.value[String(id)] = st;
			} finally {
				washStatsLoading.value[String(id)] = false;
			}
		},
	);
}

async function applyWashCardFilterWarmup() {
	if (statsWarming.value) return;
	statsWarming.value = true;
	try {
		// 先补齐当前已加载成员的统计
		await ensureWashStatsForMembers(members.value);
		// 若筛选后数量太少，自动再翻几页“填充”结果（有上限，避免无限请求）
		let rounds = 0;
		const maxRounds = 5;
		while (!noMore.value && displayMembers.value.length < Math.min(12, pageSize.value) && rounds < maxRounds) {
			rounds += 1;
			page.value += 1;
			await fetchList(false);
			await ensureWashStatsForMembers(members.value);
		}
	} finally {
		statsWarming.value = false;
	}
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

async function fetchList(reset = false) {
	if (loading.value) return;
	if (reset) {
		page.value = 1;
		members.value = [];
		total.value = 0;
		noMore.value = false;
	}
	if (noMore.value) return;

	loading.value = true;
	try {
		await ensureSiteSetting();
		const res = await listMembers({
			page: page.value,
			pageSize: pageSize.value,
			keyword: keyword.value,
			sortBy: sortBy.value,
			sortOrder: sortOrder.value,
		});
		total.value = Number(res.total || 0);
		const rows = Array.isArray(res.items) ? res.items : [];
		if (page.value === 1) members.value = rows;
		else members.value = members.value.concat(rows);
		if (!rows.length) noMore.value = true;
		else if (total.value > 0 && members.value.length >= total.value) noMore.value = true;
		// 轻量预热：仅当开启“未用完洗车卡”筛选时补齐统计
		if (washCardFilter.value === 'hasRemaining') {
			await ensureWashStatsForMembers(rows);
		}
	} finally {
		loading.value = false;
	}
}

async function onSearch() {
	await fetchList(true);
	if (washCardFilter.value === 'hasRemaining') await applyWashCardFilterWarmup();
}
async function clearKeyword() {
	keyword.value = '';
	await fetchList(true);
	if (washCardFilter.value === 'hasRemaining') await applyWashCardFilterWarmup();
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

function goDetail(m: MemberLite) {
	const id = Number(m?.id || 0);
	if (!id) {
		uni.showToast({ title: '用户ID无效', icon: 'none' });
		return;
	}
	try {
		uni.navigateTo({ url: `/pages/merchant/users/detail?id=${encodeURIComponent(String(id))}` });
	} catch {}
}

function goBack() {
	try {
		uni.navigateBack();
	} catch {}
}

onLoad(() => {
	// noop
});

onShow(async () => {
	const ok = await ensureEmployeeAccess();
	if (!ok) return;
	await fetchList(true);
	if (washCardFilter.value === 'hasRemaining') await applyWashCardFilterWarmup();
});

onPullDownRefresh(async () => {
	try {
		const ok = await ensureEmployeeAccess();
		if (!ok) return;
		await fetchList(true);
		if (washCardFilter.value === 'hasRemaining') await applyWashCardFilterWarmup();
	} finally {
		try {
			uni.stopPullDownRefresh();
		} catch {}
	}
});

onReachBottom(async () => {
	if (loading.value || noMore.value) return;
	page.value += 1;
	await fetchList(false);
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

.search-row {
	display: flex;
	align-items: center;
	gap: 12rpx;
}
.search-box {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 14rpx 14rpx;
	border-radius: 999rpx;
	background: rgba(241, 245, 249, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.search-input {
	flex: 1;
	font-size: 24rpx;
	color: #0f172a;
}
.search-clear {
	width: 44rpx;
	height: 44rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.search-btn {
	flex: 0 0 auto;
	padding: 14rpx 22rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, rgba(168, 216, 255, 0.95), rgba(255, 201, 222, 0.95));
	border: 1rpx solid rgba(255, 255, 255, 0.75);
	color: #0f172a;
	font-size: 24rpx;
	font-weight: 900;
}
.search-btn.disabled {
	opacity: 0.6;
}

.filters {
	margin-top: 14rpx;
	display: flex;
	align-items: center;
	gap: 10rpx;
	flex-wrap: wrap;
}
.filter-label{
	font-size: 22rpx;
	color: rgba(15, 23, 42, 0.56);
	font-weight: 900;
	padding-right: 2rpx;
}
.filter-tip{
	font-size: 22rpx;
	color: rgba(15, 23, 42, 0.56);
	font-weight: 700;
	padding-left: 6rpx;
}
.seg {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 10rpx 14rpx;
	border-radius: 999rpx;
	background: #f1f5f9;
	color: #0f172a;
	font-size: 22rpx;
	font-weight: 800;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.seg[data-active='true'] {
	border-color: rgba(255, 255, 255, 0.75);
	background: linear-gradient(135deg, rgba(168, 216, 255, 0.95), rgba(255, 201, 222, 0.95));
}

.sort-row{
	margin-top: 14rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
}
.sort-label{
	font-size: 22rpx;
	color: rgba(15, 23, 42, 0.56);
	font-weight: 900;
}
.sort-pill{
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10rpx;
	padding: 10rpx 14rpx;
	border-radius: 999rpx;
	background: rgba(241, 245, 249, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.sort-pill:active{
	opacity: 0.78;
}
.sort-pill-text{
	font-size: 22rpx;
	font-weight: 900;
	color: rgba(15, 23, 42, 0.86);
}
.sort-pill-arrow{
	font-size: 24rpx;
	color: rgba(15, 23, 42, 0.42);
	font-weight: 900;
}

.list-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12rpx;
	margin-bottom: 10rpx;
}
.card-title {
	font-size: 28rpx;
	font-weight: 900;
	color: #0f172a;
}
.muted {
	color: rgba(15, 23, 42, 0.62);
	font-size: 22rpx;
	font-weight: 700;
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

.list {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}
.row {
	display: flex;
	align-items: center;
	gap: 14rpx;
	padding: 18rpx;
	border-radius: 22rpx;
	background: rgba(255, 255, 255, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: inset 0 2rpx 10rpx rgba(15, 23, 42, 0.03);
}
.avatar {
	width: 84rpx;
	height: 84rpx;
	border-radius: 999rpx;
	background: #f1f5f9;
	flex: 0 0 auto;
}
.meta {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 6rpx;
}
.name-row {
	display: flex;
	align-items: center;
	gap: 10rpx;
	min-width: 0;
}
.name {
	font-size: 28rpx;
	font-weight: 900;
	color: #0f172a;
	max-width: 44vw;
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
.washcard-pill{
	background: rgba(240, 253, 250, 0.92);
	border-color: rgba(16, 185, 129, 0.16);
	color: rgba(5, 150, 105, 0.95);
}
.washcard-pill--empty{
	background: rgba(241, 245, 249, 0.92);
	border-color: rgba(148, 163, 184, 0.18);
	color: rgba(100, 116, 139, 0.95);
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
.sort-hint{
	margin-top: 2rpx;
	font-size: 22rpx;
	color: rgba(15, 23, 42, 0.62);
	font-weight: 800;
	display: flex;
	align-items: center;
	gap: 8rpx;
	min-width: 0;
}
.sort-hint-label{
	color: rgba(15, 23, 42, 0.56);
	font-weight: 900;
	flex: 0 0 auto;
}
.sort-hint-value{
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.sub-item {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.dot {
	color: rgba(148, 163, 184, 0.9);
}
.actions {
	display: flex;
	align-items: center;
	gap: 10rpx;
	flex: 0 0 auto;
}
.icon-btn {
	width: 66rpx;
	height: 66rpx;
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(241, 245, 249, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.icon-btn.primary {
	background: rgba(255, 255, 255, 0.9);
}
.icon-btn.disabled {
	opacity: 0.4;
}

.list-footer {
	margin-top: 12rpx;
	display: flex;
	justify-content: center;
}

/* ===== 排序弹层 ===== */
.sheet-mask{
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 50;
	background: rgba(15, 23, 42, 0.42);
	display: flex;
	align-items: flex-end;
}
.sheet{
	width: 100%;
	background: rgba(255, 255, 255, 0.98);
	border-top-left-radius: 26rpx;
	border-top-right-radius: 26rpx;
	padding: 22rpx 22rpx calc(env(safe-area-inset-bottom) + 20rpx);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
	box-shadow: 0 -16rpx 40rpx rgba(15, 23, 42, 0.12);
}
.sheet-head{
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
	margin-bottom: 14rpx;
}
.sheet-title{
	font-size: 28rpx;
	font-weight: 900;
	color: #0f172a;
}
.sheet-close{
	width: 64rpx;
	height: 64rpx;
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(241, 245, 249, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.sheet-section{
	margin-top: 14rpx;
}
.sheet-section-title{
	font-size: 22rpx;
	color: rgba(15, 23, 42, 0.62);
	font-weight: 900;
}
.sheet-grid{
	margin-top: 12rpx;
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}
.sheet-chip{
	padding: 12rpx 14rpx;
	border-radius: 999rpx;
	background: rgba(241, 245, 249, 0.92);
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.sheet-chip[data-active='true']{
	border-color: rgba(255, 255, 255, 0.75);
	background: linear-gradient(135deg, rgba(168, 216, 255, 0.95), rgba(255, 201, 222, 0.95));
}
.sheet-chip-text{
	font-size: 22rpx;
	font-weight: 900;
	color: rgba(15, 23, 42, 0.86);
}
.sheet-actions{
	margin-top: 18rpx;
	display: flex;
	gap: 12rpx;
}
.sheet-btn{
	flex: 1;
	padding: 16rpx 16rpx;
	border-radius: 18rpx;
	text-align: center;
	font-size: 24rpx;
	font-weight: 900;
	border: 1rpx solid rgba(148, 163, 184, 0.18);
}
.sheet-btn.ghost{
	background: rgba(241, 245, 249, 0.92);
	color: rgba(15, 23, 42, 0.86);
}
.sheet-btn.primary{
	background: linear-gradient(135deg, rgba(168, 216, 255, 0.95), rgba(255, 201, 222, 0.95));
	border-color: rgba(255, 255, 255, 0.75);
	color: #0f172a;
}
</style>

