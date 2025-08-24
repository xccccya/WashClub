<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="card" v-if="loggedIn">
			<view class="header">
				<text class="title">我的洗车计次卡</text>
			</view>
			<view class="tip">小提示：点击卡片可查看该卡的使用详情</view>
			<view v-if="cards.length===0" class="empty">暂无卡片</view>
			<view v-for="c in cards" :key="c.id" class="card-item">
				<WashCard :card="c" :loggedIn="true" :showCta="false" :clickable="true" @tap="onTapCard(c)" />
				<view class="actions">
					<view v-if="!c.isDefault && !c._shared" class="btn btn-primary" @tap.stop="setDefault(c)">设为默认</view>
					<view v-if="!c._shared" class="btn" @tap.stop="gotoShareConfig(c)">共享</view>
				</view>
			</view>
		</view>
		<view class="card" v-else>
			<view class="row-mid" @tap="gotoLogin"><text>登录以查看洗车卡信息</text></view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { createHttp, getToken } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
import WashCard from '../../components/WashCard.vue';

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const loggedIn = ref(false);
const cards = ref<any[]>([]);

function formatDate(v?: string | null){ if (!v) return ''; try { const d = new Date(v as any); if (isNaN(d.getTime())) return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; } catch { return ''; } }
function gotoLogin(){ uni.navigateTo({ url: '/pages/login/index' }); }
function onTapCard(c: any){ if (!c?.id) return; uni.navigateTo({ url: `/pages/washcard/detail?id=${c.id}` }); }

async function refreshList(){
	try {
		const http = createHttp();
		cards.value = await http<any[]>('/wash-card/me/list', { method: 'GET' });
	} catch { cards.value = []; }
}

async function setDefault(c: any){
	if (!c?.id) return;
	try {
		if (c._shared) { uni.showToast({ title: '共享卡不能设为默认', icon: 'none' }); return; }
		const http = createHttp();
		await http(`/wash-card/me/${c.id}/set-default`, { method: 'POST' });
		uni.showToast({ title: '已设为默认', icon: 'success' });
		await refreshList();
	} catch (e) {
		uni.showToast({ title: '设置失败', icon: 'none' });
	}
}

function gotoShareConfig(c: any){ if (!c?.id) return; uni.navigateTo({ url: `/pages/washcard/share?id=${c.id}` }); }

onShow(async ()=>{
    loggedIn.value = !!getToken();
    if (!loggedIn.value) { cards.value = []; return; }
    await refreshList();
});

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/index/index' });
	} catch { uni.reLaunch({ url: '/pages/index/index' }); }
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: #f7fafc; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,.04); }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.title { font-size: 30rpx; font-weight: 700; color:#111827; }
.tip { margin: 8rpx 0 6rpx 0; font-size: 22rpx; color: #64748b; }
.empty { padding: 24rpx; color: #6b7280; text-align: center; }
.card-item { border: 2rpx solid #eef2ff; border-radius: 16rpx; padding: 18rpx; margin-top: 12rpx; }
.actions { margin-top: 12rpx; display:flex; align-items:center; justify-content:flex-end; gap: 12rpx; }
.btn { font-size: 24rpx; color:#1f2937; background:#f3f4f6; padding: 10rpx 18rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; }
.btn-primary { color:#fff; background:#2563eb; border-color:#2563eb; }
.row-top { display:flex; align-items:center; justify-content: space-between; }
.name { font-size: 28rpx; color: #111827; font-weight: 600; }
.tag { font-size: 22rpx; color: #374151; background: #f3f4f6; padding: 4rpx 8rpx; border-radius: 999rpx; }
.row-mid { margin-top: 8rpx; font-size: 26rpx; color: #1f2937; }
.remain { color: #0ea5e9; font-weight: 700; }
.total { color: #6b7280; margin-left: 4rpx; }
.row-bottom { margin-top: 6rpx; font-size: 22rpx; color: #6b7280; }

/* 统一返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-btn { width: 64rpx; height: 64rpx; border-radius: 999rpx; background: rgba(255,255,255,0.9); box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); display:flex; align-items:center; justify-content:center; border: 2rpx solid #e5e7eb; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


