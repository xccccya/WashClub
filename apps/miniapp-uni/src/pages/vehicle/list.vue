<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="header">
			<text class="title">车辆管理</text>
			<view class="add-btn" @tap="goCreate">添加车辆</view>
		</view>
		<view class="tipbar">
			<image class="tip-icon" src="/static/icons/dp.png" mode="aspectFit" />
			<text class="tip-text">点击车辆卡片可进行编辑</text>
		</view>
		<view v-for="v in list" :key="v.id" class="vehicle-card" :class="plateLen(v)===8 ? 'bg-nev' : 'bg-std'" @tap="() => goEdit(v)">
			<view class="row">
				<view class="plate-chip" :class="{ nev: plateLen(v)===8 }">
					<text class="plate-text">{{ displayPlate(v) }}</text>
				</view>
				<view class="ops" @tap.stop="noop">
					<view class="icon-btn danger" @tap.stop="() => onDelete(v)"><image class="icon-img" src="/static/icons/delete.png" mode="aspectFit" /></view>
					<view class="pill" :class="{ primary: !v.isDefault }" @tap.stop="() => onSetDefault(v)">{{ v.isDefault ? '默认' : '设为默认' }}</view>
				</view>
			</view>
			<view class="meta">{{ (v.brand||'-') + ' / ' + (v.series||'-') }} · {{ (v.typeMain||'-') + (v.typeSub?(' / '+v.typeSub):'') }} · {{ v.color || '-' }}</view>
		</view>
		<view class="empty" v-if="!loading && list.length===0">暂无车辆，点击右上角添加</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { createHttp, checkAuthAndRefresh } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

type Vehicle = { id: number; plateNumber: string; vin?: string|null; brand?: string|null; series?: string|null; typeMain: string; typeSub?: string|null; color?: string|null; isDefault: boolean };

const list = ref<Vehicle[]>([]);
const loading = ref(false);

function navigate(url: string){
	// #ifdef H5
	if (typeof window !== 'undefined') { window.location.hash = url.startsWith('/') ? `#${url}` : `#/${url}`; return; }
	// #endif
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
		const http = createHttp();
		list.value = await http<Vehicle[]>('/vehicle/me/list', { method: 'GET' });
	} finally { loading.value = false; }
}

async function onDelete(v: Vehicle){
	uni.showModal({ title: '提示', content: '确认删除该车辆？', success: async (res:any)=>{
		if (!res.confirm) return;
		try { const http = createHttp(); await http(`/vehicle/${v.id}`, { method: 'DELETE' }); await fetchList(); uni.showToast({ title: '已删除', icon: 'success' }); } catch {}
	}});
}

async function onSetDefault(v: Vehicle){
	try { const http = createHttp(); await http(`/vehicle/${v.id}/set-default`, { method: 'POST' }); await fetchList(); uni.showToast({ title: '已设为默认', icon: 'success' }); } catch {}
}

onShow(async ()=>{ const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (ok) fetchList(); });
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: #f8fafc; box-sizing: border-box; }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 20rpx; }
.title { font-size: 32rpx; font-weight: 700; }
.add-btn { padding: 14rpx 20rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); border-radius: 999rpx; }
.tipbar { display:flex; align-items:center; gap: 10rpx; padding: 14rpx 16rpx; background: #f3f4f6; border-radius: 16rpx; color:#374151; margin-bottom: 16rpx; }
.tip-icon { width: 28rpx; height: 28rpx; display:block; }
.tip-text { font-size: 26rpx; }
.vehicle-card { border-radius: 20rpx; padding: 20rpx; box-shadow: 0 6rpx 20rpx rgba(0,0,0,0.06); margin-bottom: 16rpx; }
.vehicle-card.bg-std { background: #f5faff; }
.vehicle-card.bg-nev { background: #eefcf5; }
.row { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.plate-chip { padding: 10rpx 14rpx; border-radius: 10rpx; background: #2563eb; color:#fff; }
.plate-chip.nev { background: #16a34a; }
.plate-text { font-size: 34rpx; font-weight: 800; letter-spacing: 2rpx; }
.ops { display:flex; gap: 12rpx; }
.pill { padding: 10rpx 16rpx; border-radius: 999rpx; background:#f3f4f6; }
.pill.primary { background:#e0f2fe; }
.icon-btn { display:flex; align-items:center; justify-content:center; background: transparent; width: auto; height: auto; border-radius: 0; overflow: visible; }
.icon-img { width: 40rpx; height: 40rpx; display:block; }
.meta { color:#6b7280; font-size: 24rpx; }
.empty { text-align:center; color:#9ca3af; margin-top: 120rpx; }

/* 统一返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


