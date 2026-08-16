<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="header card">
			<view class="header-top">
				<view class="header-left">
					<text class="title">车辆管理</text>
					<text class="subtitle">管理默认车辆与车型信息</text>
				</view>
				<view class="add-btn" @tap="goCreate">
					<text class="add-btn-text">添加车辆</text>
				</view>
			</view>
			<view class="tipbar">
				<image class="tip-icon" src="/static/icons/dp.png" mode="aspectFit" />
				<text class="tip-text">点击卡片进入编辑；右侧可删除或设为默认</text>
			</view>
		</view>

		<view class="list">
			<view v-if="loading" class="loading card">
				<view class="loading-row">
					<view class="skeleton sk-plate" />
					<view class="skeleton sk-pill" />
				</view>
				<view class="skeleton sk-meta" />
			</view>

			<view
				v-for="v in list"
				:key="v.id"
				class="vehicle-card card"
				:class="{
					'is-default': v.isDefault,
					'is-nev': plateLen(v)===8
				}"
				@tap="() => goEdit(v)"
			>
				<view class="card-top">
					<view class="plate-area">
						<view class="plate-chip" :class="{ nev: plateLen(v)===8 }">
							<text class="plate-text">{{ displayPlate(v) }}</text>
						</view>
						<view v-if="v.isDefault" class="default-tag">默认车辆</view>
					</view>

					<view class="ops" @tap.stop="noop">
						<view class="icon-btn danger" @tap.stop="() => onDelete(v)">
							<uni-icons type="trash" :size="20" color="#ef4444" />
						</view>
						<view
							class="pill"
							:class="{ primary: !v.isDefault, disabled: v.isDefault }"
							@tap.stop="() => (v.isDefault ? noop() : onSetDefault(v))"
						>
							{{ v.isDefault ? '已默认' : '设为默认' }}
						</view>
					</view>
				</view>

				<view class="meta">
					<text class="meta-line">{{ (v.brand||'-') + ' / ' + (v.series||'-') }}</text>
					<text class="meta-dot">·</text>
					<text class="meta-line">{{ (v.typeMain||'-') + (v.typeSub?(' / '+v.typeSub):'') }}</text>
					<text class="meta-dot">·</text>
					<text class="meta-line">{{ v.color || '-' }}</text>
				</view>
			</view>

			<view class="empty card" v-if="!loading && list.length===0">
				<view class="empty-title">暂无车辆</view>
				<view class="empty-sub">添加一台爱车，默认车辆会在首页展示</view>
				<view class="empty-cta" @tap="goCreate">添加车辆</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';

/** 动态导入 checkAuthAndRefresh，避免小程序模块解析时序问题 */
async function safeCheckAuthAndRefresh(options: { redirectIfExpired?: boolean } = { redirectIfExpired: true }): Promise<boolean> {
	try {
		const { checkAuthAndRefresh } = await import('../../utils/auth');
		return await checkAuthAndRefresh(options);
	} catch { return true; }
}
import { vehicleControllerMyDelete, vehicleControllerMySetDefault, vehicleControllerMyVehicles } from '@wash/api-client';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

type Vehicle = { id: number; plateNumber: string; vin?: string|null; brand?: string|null; series?: string|null; typeMain: string; typeSub?: string|null; color?: string|null; isDefault: boolean };

const list = ref<Vehicle[]>([]);
const loading = ref(false);

function navigate(url: string){
    uni.navigateTo({ url });
}

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/index/index' });
	} catch { uni.reLaunch({ url: '/pages/index/index' }); }
}

function goCreate(){ navigate('/pages/vehicle/create'); }
function goEdit(v: Vehicle){ navigate(`/pages/vehicle/edit?id=${v.id}`); }
function noop(){}

function cleanPlate(p?: string){ return String(p||'').toUpperCase().replace(/\s+/g,''); }
function plateLen(v: Vehicle){ return cleanPlate(v.plateNumber).length; }
function displayPlate(v: Vehicle){
	const s = cleanPlate(v.plateNumber);
	if (!s) return '-';
	const p = s[0] || '';
	const l = s[1] || '';
	const rest = s.slice(2);
	return `${p}${l}${rest ? '·'+rest : ''}`;
}

async function fetchList(){
	loading.value = true;
	try {
		// token 由 http client 自动从 uni storage 注入到 Authorization
		list.value = await vehicleControllerMyVehicles({} as any) as any;
	} catch (e:any) {
		list.value = [];
		uni.showToast({ title: String(e?.message || '车辆列表加载失败').slice(0, 30), icon: 'none' });
	} finally { loading.value = false; }
}

async function onDelete(v: Vehicle){
	uni.showModal({ title: '提示', content: '确认删除该车辆？', success: async (res:any)=>{
		if (!res.confirm) return;
		try { await vehicleControllerMyDelete(String(v.id)); await fetchList(); uni.showToast({ title: '已删除', icon: 'success' }); } catch (error:any) { uni.showToast({ title:error?.message || '删除失败', icon:'none' }); }
	}});
}

async function onSetDefault(v: Vehicle){
	try { await vehicleControllerMySetDefault(String(v.id)); await fetchList(); uni.showToast({ title: '已设为默认', icon: 'success' }); } catch (error:any) { uni.showToast({ title:error?.message || '设置失败', icon:'none' }); }
}

onShow(async ()=>{ const ok = await safeCheckAuthAndRefresh({ redirectIfExpired: true }); if (ok) fetchList(); });
</script>

<style scoped>
.page {
	min-height: 100vh;
	padding: 24rpx 24rpx 0 24rpx;
	box-sizing: border-box;
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
	overflow-x: hidden;
	/* 对齐首页：克制的蓝粉渐变底 */
	background: linear-gradient(180deg, #eff7ff 0%, #fff3f7 56%, #ffffff 100%);
	--brand-blue: #a8d8ff;
	--brand-pink: #ffc9de;
	--ink: #0f172a;
	--muted: rgba(15, 23, 42, 0.72);
	--border: rgba(148, 163, 184, 0.18);
	--shadow-1: 0 10rpx 24rpx rgba(15, 23, 42, 0.05);
	--shadow-2: 0 2rpx 10rpx rgba(15, 23, 42, 0.03);
}

.card {
	background: rgba(255, 255, 255, 0.96);
	border-radius: 26rpx;
	padding: 26rpx;
	box-shadow: var(--shadow-1), var(--shadow-2);
	border: 1rpx solid var(--border);
	position: relative;
	overflow: hidden;
}
@supports ((-webkit-backdrop-filter: blur(6px)) or (backdrop-filter: blur(6px))) {
	.card { -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
}

.header { margin-bottom: 22rpx; }
.header-top { display:flex; align-items:flex-start; justify-content: space-between; gap: 16rpx; }
.header-left { display:flex; flex-direction: column; gap: 8rpx; min-width: 0; }
.title { font-size: 34rpx; font-weight: 900; color: var(--ink); letter-spacing: .4rpx; }
.subtitle { font-size: 24rpx; color: var(--muted); }

.add-btn {
	flex: 0 0 auto;
	padding: 14rpx 20rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, var(--brand-blue), var(--brand-pink));
	border: 1rpx solid rgba(255,255,255,0.75);
	box-shadow: 0 10rpx 22rpx rgba(15,23,42,0.10);
}
.add-btn:active { transform: translateY(1rpx); opacity: .92; }
.add-btn-text { font-size: 26rpx; font-weight: 800; color: rgba(15,23,42,0.86); }

.tipbar {
	margin-top: 18rpx;
	display:flex;
	align-items:center;
	gap: 10rpx;
	padding: 14rpx 16rpx;
	background: rgba(255,255,255,0.92);
	border: 1rpx solid var(--border);
	border-radius: 18rpx;
	box-shadow: inset 0 2rpx 8rpx rgba(0,0,0,0.03);
	color:#374151;
}
.tip-icon { width: 28rpx; height: 28rpx; display:block; opacity: .92; }
.tip-text { font-size: 24rpx; color: rgba(15,23,42,0.72); }

.list { padding-bottom: 10rpx; }

.vehicle-card { margin-bottom: 18rpx; }
.vehicle-card.is-default::before{
	content:'';
	position:absolute;
	left:0; top:0; right:0;
	height: 6rpx;
	background: linear-gradient(90deg, rgba(59,130,246,0.34), rgba(236,72,153,0.30));
}
.vehicle-card.is-nev{
	background: linear-gradient(135deg, rgba(236, 253, 245, 0.92) 0%, rgba(255,255,255,0.96) 60%);
}

.card-top { display:flex; align-items:center; justify-content: space-between; gap: 14rpx; }
.plate-area { display:flex; align-items:center; gap: 12rpx; min-width: 0; }

.plate-chip {
	padding: 10rpx 14rpx;
	border-radius: 14rpx;
	background: linear-gradient(135deg, #60a5fa, #a8d8ff);
	color:#0b1220;
	border: 1rpx solid rgba(255,255,255,0.72);
	box-shadow: 0 10rpx 20rpx rgba(15,23,42,0.08);
}
.plate-chip.nev { background: linear-gradient(135deg, #34d399, #a7f3d0); }
.plate-text { font-size: 34rpx; font-weight: 900; letter-spacing: 2rpx; }

.default-tag{
	flex: 0 0 auto;
	padding: 8rpx 12rpx;
	border-radius: 999rpx;
	font-size: 22rpx;
	font-weight: 800;
	color: #065f46;
	background: rgba(236, 253, 245, 0.92);
	border: 1rpx solid rgba(134, 239, 172, 0.90);
}

.ops { display:flex; align-items:center; gap: 12rpx; }
.pill {
	padding: 10rpx 16rpx;
	border-radius: 999rpx;
	background: rgba(241, 245, 249, 0.9);
	border: 1rpx solid rgba(148, 163, 184, 0.20);
	color: rgba(15,23,42,0.82);
	font-size: 24rpx;
	font-weight: 800;
}
.pill.primary{
	background: linear-gradient(135deg, rgba(168,216,255,0.45), rgba(255,201,222,0.40));
	border-color: rgba(168,216,255,0.55);
}
.pill.disabled{
	opacity: .62;
}
.pill:active { transform: translateY(1rpx); opacity: .92; }

.icon-btn {
	display:flex;
	align-items:center;
	justify-content:center;
	width: 64rpx;
	height: 64rpx;
	border-radius: 16rpx;
	background: rgba(254, 242, 242, 0.92);
	box-shadow: 0 10rpx 20rpx rgba(239, 68, 68, 0.08);
}
.icon-btn:active { transform: translateY(1rpx); opacity: .92; }

.meta {
	margin-top: 14rpx;
	display:flex;
	align-items:center;
	flex-wrap: wrap;
	gap: 8rpx;
	color: rgba(15,23,42,0.62);
	font-size: 24rpx;
	line-height: 1.35;
}
.meta-line { max-width: 100%; }
.meta-dot { opacity: .5; }

.empty {
	margin-top: 18rpx;
	padding: 40rpx 26rpx;
	text-align:center;
}
.empty-title { font-size: 30rpx; font-weight: 900; color: var(--ink); }
.empty-sub { margin-top: 10rpx; font-size: 24rpx; color: var(--muted); }
.empty-cta{
	margin-top: 18rpx;
	display:inline-flex;
	align-items:center;
	justify-content:center;
	padding: 14rpx 22rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, var(--brand-blue), var(--brand-pink));
	border: 1rpx solid rgba(255,255,255,0.78);
	box-shadow: 0 10rpx 22rpx rgba(15,23,42,0.10);
	font-size: 26rpx;
	font-weight: 900;
	color: rgba(15,23,42,0.86);
}
.empty-cta:active { transform: translateY(1rpx); opacity: .92; }

.loading { margin-bottom: 18rpx; }
.loading-row{ display:flex; align-items:center; justify-content: space-between; gap: 14rpx; }
.skeleton{
	border-radius: 16rpx;
	background: linear-gradient(90deg, rgba(226,232,240,0.75), rgba(241,245,249,0.95), rgba(226,232,240,0.75));
	background-size: 200% 100%;
	animation: sk 1.2s ease-in-out infinite;
}
.sk-plate{ width: 240rpx; height: 64rpx; }
.sk-pill{ width: 160rpx; height: 56rpx; border-radius: 999rpx; }
.sk-meta{ margin-top: 14rpx; width: 92%; height: 34rpx; border-radius: 12rpx; }
@keyframes sk { 0%{ background-position: 0% 0; } 100%{ background-position: -200% 0; } }

/* 统一返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


