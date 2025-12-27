<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="card">
			<view class="header">
				<text class="title">我的收货地址</text>
				<view class="btn-primary" @tap="gotoCreate">新增地址</view>
			</view>
			<view v-if="list.length===0" class="empty">暂无收货地址，点击“新增地址”添加</view>
			<view v-for="a in list" :key="a.id" class="addr-item">
				<view class="row-top">
					<text class="name">{{ a.province }} {{ a.city }} {{ a.district }} {{ a.street }}</text>
					<text v-if="a.label" class="tag">{{ a.label }}</text>
				</view>
				<view class="row-mid">{{ a.detail }}</view>
				<view class="row-bottom">{{ a.phone }}</view>
				<view class="actions">
					<view class="btn" @tap="openEdit(a)">编辑</view>
					<view class="btn danger" @tap="remove(a)">删除</view>
				</view>
			</view>
		</view>

		<!-- 已移除编辑抽屉，改为跳转编辑页 -->
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import { getToken } from '../../utils/auth';
import { addressControllerMyDelete, addressControllerMyList } from '@wash/api-client';

type Addr = { id?: number; province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null };

type DistrictItem = { name: string; adcode?: string; districts?: DistrictItem[] };

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const list = ref<Addr[]>([]);

const showEdit = ref(false);
const editing = ref<Addr | null>(null);

function goBack(){
    try {
        const pages = getCurrentPages?.() || [];
        if (pages.length > 1) { uni.navigateBack(); return; }
        uni.reLaunch({ url: '/pages/me/index' });
    } catch { uni.reLaunch({ url: '/pages/me/index' }); }
}

async function refresh(){
    try { list.value = await addressControllerMyList({} as any) as any; } catch { list.value = []; }
}

function gotoCreate(){ try { uni.navigateTo({ url: '/pages/address/create' }); } catch {} }
function openEdit(a: Addr){ try { uni.navigateTo({ url: `/pages/address/edit?id=${a.id}` }); } catch {} }

async function remove(a: Addr){
    if (!a?.id) return;
    try {
        await addressControllerMyDelete(String(a.id));
        uni.showToast({ title:'已删除', icon:'success' });
        await refresh();
    } catch { uni.showToast({ title:'删除失败', icon:'none' }); }
}

onShow(async ()=>{ if (!getToken()){ list.value = []; return; } await refresh(); });
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.card { background: linear-gradient(180deg, rgba(243,249,255,0.92) 0%, rgba(255,247,251,0.92) 100%); border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); backdrop-filter: blur(2rpx); }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.title { font-size: 32rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }
.empty { padding: 24rpx; color: #6b7280; text-align: center; }
.addr-item { border: 2rpx solid #e5e7eb; border-radius: 20rpx; padding: 20rpx; margin-top: 16rpx; background: #ffffff; box-shadow: 0 6rpx 18rpx rgba(0,0,0,0.06); }
.row-top { display:flex; align-items:center; justify-content: space-between; gap: 12rpx; }
.name { font-size: 30rpx; color: #111827; font-weight: 700; }
.tag { font-size: 22rpx; color: #374151; background: linear-gradient(135deg, #a8d8ff, #ffc9de); padding: 6rpx 12rpx; border-radius: 999rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06); }
.row-mid { margin-top: 8rpx; font-size: 26rpx; color:#1f2937; }
.row-bottom { margin-top: 6rpx; font-size: 24rpx; color:#6b7280; }
.actions { margin-top: 12rpx; display:flex; align-items:center; justify-content:flex-end; gap: 12rpx; }
.btn { font-size: 24rpx; color:#1f2937; padding: 12rpx 20rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background: #fff; }
.btn-primary { color:#fff; padding: 12rpx 20rpx; border-radius: 999rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); border: none; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08); }

/* 统一返回按钮样式（复用洗车卡页风格） */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


