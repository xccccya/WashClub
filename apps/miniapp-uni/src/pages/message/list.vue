<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 左上角返回按钮 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="title-bar"><text class="title">消息中心</text></view>

		<!-- 新消息提示条 -->
		<view v-if="newCount>0" class="new-tip" @tap="scrollTopAndClear">
			<text>有 {{ newCount }} 条新消息</text>
		</view>

    <view class="toolbar">
        <view class="icon-btn" @tap="load">
            <image class="icon" src="/static/icons/reloadmsg.png" />
            <text class="icon-text">刷新</text>
        </view>
        <view class="icon-btn" :class="{ disabled: !hasUnread }" @tap="onTapMarkAllRead">
            <image class="icon" :src="hasUnread ? '/static/icons/read.png' : '/static/icons/read-no.png'" />
            <text class="icon-text">全部已读</text>
        </view>
    </view>
		<view class="cards">
			<view v-for="n in items" :key="n.id" class="card" :data-unread="n.status==='UNREAD'" @tap="goDetail(n)">
				<view class="card-head">
					<view class="head-left">
						<text class="dot" v-if="n.status==='UNREAD'"></text>
						<text class="card-title">{{ n.title }}</text>
					</view>
					<text class="time">{{ formatTime(n.createdAt) }}</text>
				</view>
				<view class="card-content" v-if="n.content">{{ n.content }}</view>
                <view class="card-foot">
                    <button v-if="n.status==='UNREAD'" class="pill" @tap.stop="markReadSingle(n)">
                        <image class="pill-icon" src="/static/icons/readone.png" />
                        <text class="pill-text">标记已读</text>
                    </button>
					<view class="spacer" />
					<view class="link-pill">查看详情</view>
				</view>
			</view>
			<view v-if="!items.length" class="empty">
				<view class="empty-illu"></view>
				<view class="empty-title">暂无消息</view>
				<view class="empty-sub">订单进度、退款到账等会在此展示</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
declare const uni: any;
declare function getCurrentPages(): any[];
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { notificationControllerList, notificationControllerMarkRead, notificationControllerMarkReadAll } from '@wash/api-client';

type Notice = { id:number; title:string; content?:string; linkPath?:string; status:'UNREAD'|'READ'; createdAt:string };
const items = ref<Notice[]>([]);
const { topSpacerHeight, statusBarHeight } = useSafeArea();
const newCount = ref<number>(0);
const hasUnread = computed(()=> items.value.some(x=> x.status === 'UNREAD'));

function formatTime(t:string){ try{ const d = new Date(t); const pad=(n:number)=> String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }catch{ return t; } }
function goDetail(n: Notice){ try { uni.navigateTo({ url: `/pages/message/detail?id=${n.id}` }); } catch {} }

async function load(){
    try{
        const t = uni.getStorageSync('token');
        if (!t){ items.value = []; return; }
        const list:any[] = (await notificationControllerList({} as any) as unknown) as any[];
        items.value = Array.isArray(list) ? list : [];
    }catch{ items.value = []; }
}

async function markReadSingle(n: Notice){
    try{
        const t = uni.getStorageSync('token'); if (!t) return;
        await notificationControllerMarkRead({ id: n.id } as any);
        n.status = 'READ';
        // 同步减少未读角标
        try{ uni.$emit?.('realtime:unread-delta', { delta: -1 }); }catch{}
    }catch{}
}
async function markAllRead(){
    try{
        const t = uni.getStorageSync('token'); if (!t) return;
        await notificationControllerMarkReadAll();
        items.value.forEach(n=>{ if(n.status==='UNREAD') n.status='READ'; });
        // 未读被清空
        try{ uni.$emit?.('realtime:unread', { count: 0 }); }catch{}
    }catch{}
}

function onTapMarkAllRead(){ if (!hasUnread.value) return; markAllRead(); }

onMounted(()=>{
    load();
    try{
        const onRealtimeNotification = (msg:any)=>{
            try{
                const n:any = { id: Number(msg?.id||0), title: String(msg?.title||'新消息'), content: msg?.content??'', linkPath: msg?.linkPath??null, status: 'UNREAD', createdAt: String(msg?.createdAt||new Date().toISOString()) };
                if (!items.value.find(x=> Number(x.id)===Number(n.id))) { items.value.unshift(n); newCount.value += 1; }
            }catch{}
        };
        const onRealtimeUnreadList = (list:any[])=>{
            try{
                const arr = Array.isArray(list)? list: [];
                for (const m of arr){
                    const id = Number(m?.id||0);
                    if (!id) continue;
                    if (!items.value.find(x=> Number(x.id)===id)) items.value.unshift({ id, title:String(m?.title||'新消息'), content:m?.content??'', linkPath:m?.linkPath??null, status: String(m?.status||'UNREAD') as any, createdAt: String(m?.createdAt||new Date().toISOString()) });
                }
            }catch{}
        };
        // 保存引用以便卸载
        try{ const pages:any[] = (getCurrentPages as any)?.()||[]; const cur:any = pages?.[pages.length-1]; if (cur){ cur.__onRealtimeNotification = onRealtimeNotification; cur.__onRealtimeUnreadList = onRealtimeUnreadList; } }catch{}
        uni.$on?.('realtime:notification', onRealtimeNotification);
        uni.$on?.('realtime:unread-list', onRealtimeUnreadList);
    }catch{}
});

onBeforeUnmount(()=>{
    try{
        const pages:any[] = (getCurrentPages as any)?.()||[]; const cur:any = pages?.[pages.length-1];
        const onRealtimeNotification = cur?.__onRealtimeNotification; const onRealtimeUnreadList = cur?.__onRealtimeUnreadList;
        if (onRealtimeNotification) uni.$off?.('realtime:notification', onRealtimeNotification);
        if (onRealtimeUnreadList) uni.$off?.('realtime:unread-list', onRealtimeUnreadList);
    }catch{}
});

function scrollTopAndClear(){ try{ uni.pageScrollTo?.({ scrollTop: 0, duration: 200 }); }catch{} newCount.value = 0; }

function goBack(){ try{ const pages = getCurrentPages(); if (pages && pages.length > 1) uni.navigateBack(); else uni.switchTab({ url:'/pages/me/index' }); }catch{ uni.switchTab({ url:'/pages/me/index' }); } }
</script>

<style>
.page{ min-height:100vh; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.title-bar { display:flex; align-items:center; justify-content:flex-start; padding: 16rpx 24rpx 8rpx 24rpx; }
.title { font-size: 36rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }

.new-tip{ margin: 0 20rpx 8rpx 20rpx; padding: 12rpx 18rpx; border-radius: 999rpx; background: rgba(34,197,94,.12); color:#16a34a; font-size:24rpx; text-align:center; border: 2rpx dashed rgba(34,197,94,.35); }

.toolbar{ display:flex; gap: 16rpx; padding: 8rpx 20rpx 0 20rpx; }
.btn{ 
	flex:1; 
	padding: 18rpx 26rpx; 
	border-radius: 999rpx; 
	background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
	border: 2rpx solid #e5e7eb; 
	color:#0b1220; 
	font-size: 26rpx; 
	font-weight: 600; 
	box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.06);
}
.btn:active{ transform: translateY(1rpx); box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.06); }
.btn.outline{ 
	background: linear-gradient(180deg, rgba(199,210,254,0.12) 0%, rgba(199,210,254,0.06) 100%);
	border-color:#c7d2fe; 
	color:#374151; 
}
.btn.primary{ 
	background: linear-gradient(135deg, #60a5fa, #a78bfa);
	border-color: transparent; 
	color:#ffffff; 
	box-shadow: 0 8rpx 18rpx rgba(99,102,241,0.25);
}
.btn.primary:active{ box-shadow: 0 6rpx 14rpx rgba(99,102,241,0.22); }
.btn[disabled]{ 
	opacity:.7; 
	filter: grayscale(12%);
	box-shadow: none;
}

/* 图标按钮样式 */
.icon-btn{ flex:1; display:flex; flex-direction: column; align-items:center; justify-content:center; gap: 6rpx; padding: 16rpx 0 14rpx; border-radius: 20rpx; background: #fff; border: 2rpx solid #eef2ff; box-shadow: 0 6rpx 16rpx rgba(59,130,246,0.06); }
.icon-btn:active{ transform: translateY(1rpx); box-shadow: 0 4rpx 10rpx rgba(59,130,246,0.06); }
.icon-btn .icon{ width: 44rpx; height: 44rpx; }
.icon-btn .icon-text{ font-size: 22rpx; color:#1f2937; }
.icon-btn.disabled{ opacity:.55; filter: grayscale(14%); }

.cards{ padding: 16rpx 20rpx 20rpx; display:flex; flex-direction:column; gap: 16rpx; }
.card{ background: #ffffff; border-radius: 20rpx; padding: 20rpx; box-shadow: 0 8rpx 20rpx rgba(0,0,0,0.06); border: 2rpx solid #f3f4f6; }
.card[data-unread="true"]{ border-color:#dbeafe; background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%); }
.card-head{ display:flex; align-items:center; justify-content:space-between; gap: 12rpx; }
.head-left{ display:flex; align-items:center; gap: 10rpx; min-width:0; }
.dot{ width: 10rpx; height: 10rpx; border-radius: 999rpx; background:#ef4444; }
.card-title{ font-weight: 800; font-size: 30rpx; color:#111827; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width: 66vw; }
.time{ color:#9ca3af; font-size: 22rpx; }
.card-content{ margin-top: 8rpx; color:#4b5563; font-size: 24rpx; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.card-foot{ display:flex; align-items:center; gap: 12rpx; margin-top: 10rpx; }
.pill{ display:flex; align-items:center; gap: 8rpx; padding: 8rpx 18rpx; border-radius: 999rpx; background: linear-gradient(135deg, #34d399, #10b981); color:#ffffff; font-size: 24rpx; font-weight: 700; box-shadow: 0 6rpx 16rpx rgba(16,185,129,0.25); border: 2rpx solid rgba(16,185,129,0.15); min-height: 56rpx; }
.pill-icon{ width: 28rpx; height: 28rpx; }
.pill-text{ line-height: 1; }
.pill:active{ transform: translateY(1rpx); box-shadow: 0 4rpx 10rpx rgba(16,185,129,0.22); }
.pill[disabled]{ opacity:.55; box-shadow: none; }
.spacer{ flex:1; }
.link-pill{ padding: 10rpx 16rpx; border-radius: 999rpx; background: rgba(37,99,235,.08); color:#2563eb; font-size: 22rpx; border: 2rpx dashed #bfdbfe; }

.empty{ text-align:center; color:#6b7280; padding: 80rpx 0; }
.empty-illu { width: 200rpx; height: 160rpx; border-radius: 16rpx; background: linear-gradient(135deg, rgba(168,216,255,0.4), rgba(255,201,222,0.4)); box-shadow: inset 0 0 0 2rpx rgba(255,255,255,.6), 0 6rpx 16rpx rgba(0,0,0,0.06); margin: 0 auto 16rpx; }
.empty-title { font-size: 28rpx; color:#111827; font-weight: 700; }
.empty-sub { font-size: 24rpx; color:#6b7280; margin-top: 4rpx; }
</style>


