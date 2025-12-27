<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 左上角返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="title-bar"><text class="title-page">消息详情</text></view>

		<view class="card" v-if="item">
			<view class="title">{{ item.title }}</view>
			<view class="time">{{ formatTime(item.createdAt) }}</view>
			<view class="content">{{ item.content }}</view>
			<view class="actions">
				<button v-if="item.linkPath" class="btn" @tap="jump">前往相关页面</button>
			</view>
		</view>
		<view v-else class="empty">加载中或消息不存在</view>
	</view>
</template>

<script setup lang="ts">
declare const uni: any;
declare function getCurrentPages(): any[];
import { ref, onMounted } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { notificationControllerDetail, notificationControllerMarkRead } from '@wash/api-client';

type Notice = { id:number; title:string; content?:string; linkPath?:string; status:'UNREAD'|'READ'; createdAt:string };
const item = ref<Notice|null>(null);
const { topSpacerHeight, statusBarHeight } = useSafeArea();

function formatTime(t:string){ try{ const d = new Date(t); const pad=(n:number)=> String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }catch{ return t; } }

async function load(id:number){
    try{
        const t = uni.getStorageSync('token'); if (!t){ item.value = null; return; }
        const n:any = await notificationControllerDetail(String(id));
        item.value = n || null;
        if (n){ try{ await notificationControllerMarkRead({ id } as any); } catch{} }
    }catch{ item.value = null; }
}

function jump(){ try { if (item.value?.linkPath) uni.navigateTo({ url: item.value.linkPath! }); } catch {} }

onMounted(()=>{
    try{ const q = (getCurrentPages().at(-1) as any)?.options || {}; const id = Number(q?.id||0); if (id) load(id); }catch{}
});

function goBack(){ try{ const pages = getCurrentPages(); if (pages && pages.length > 1) uni.navigateBack(); else uni.switchTab({ url:'/pages/me/index' }); }catch{ uni.switchTab({ url:'/pages/me/index' }); } }
</script>

<style>
.page{ min-height:100vh; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding: 20rpx; padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.title-bar { display:flex; align-items:center; justify-content:flex-start; padding: 8rpx 4rpx 16rpx 4rpx; }
.title-page { font-size: 36rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }

.card{ background:#fff; border-radius: 24rpx; padding: 28rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); }
.title{ font-weight: 800; font-size: 34rpx; color:#111827; }
.time{ margin-top: 8rpx; color:#9ca3af; font-size: 22rpx; }
.content{ margin-top: 16rpx; color:#374151; font-size: 28rpx; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }
.actions{ margin-top: 24rpx; }
.btn{ background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; border-radius: 999rpx; padding: 16rpx 28rpx; font-size: 26rpx; box-shadow: 0 6rpx 16rpx rgba(96,165,250,0.25); }
.empty{ text-align:center; color:#9ca3af; padding: 80rpx 0; }
</style>


