<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="title-bar"><text class="title">评价详情</text></view>

		<view class="card" v-if="detail">
			<view class="sub-title">满意度</view>
			<view class="stars">
				<image v-for="i in 5" :key="i" :src="detail.rating>=i ? '/static/icons/star-fill.png' : '/static/icons/star.png'" class="star-img" mode="aspectFit" />
			</view>
		</view>

		<view class="card" v-if="detail">
			<view class="sub-title">文字评价</view>
			<view class="content">{{ detail.content || '-' }}</view>
			<view v-if="Array.isArray(detail.imagesJson) && detail.imagesJson.length" class="upload-row">
				<view class="u-item" v-for="(img,idx) in detail.imagesJson" :key="idx">
					<image :src="img" class="u-thumb" mode="aspectFill" />
				</view>
			</view>
		</view>

		<view class="card" v-if="detail && detail.replyContent">
			<view class="sub-title">商家回复</view>
			<view class="reply-meta" v-if="detail.replyAt || detail.replyUser">
				<text class="meta">{{ formatTime(detail.replyAt) }}</text>
				<text class="meta" v-if="detail.replyUser && detail.replyUser.name"> · {{ detail.replyUser.name }}</text>
			</view>
			<view class="content">{{ detail.replyContent }}</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { orderControllerGetReview } from '@wash/api-client';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

const orderId = ref<number>(0);
const detail = ref<any>(null);
const lastKey = ref<string>('');

function formatTime(t?: string){ if(!t) return ''; try{ const d=new Date(t); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; }catch{return ''} }

function goBack(){ const pages = getCurrentPages?.() || []; if (pages.length > 1) { uni.navigateBack(); return; } uni.reLaunch({ url: '/pages/order/index' }); }

async function fetchDetail(id: number){
    try{
        // 直接使用 SDK：底层 createHttpClient 已支持小程序 uni.request + uni storage token
        detail.value = await (orderControllerGetReview(Number(id)) as any);
    }catch{ detail.value = null; }
}

onLoad(async (q:any)=>{
    orderId.value = Number(q?.orderId||0) || 0;
    await fetchDetail(orderId.value);
    lastKey.value = `id=${orderId.value||''}`;
});

onShow(async ()=>{
    try{
        const pages = getCurrentPages?.() || [];
        const cur:any = pages[pages.length - 1] || {};
        const opt:any = cur?.options || {};
        const idNum = opt?.orderId ? Number(opt.orderId) : NaN;
        const key = `id=${isNaN(idNum)?'':String(idNum)}`;
        if (key && key !== lastKey.value && !isNaN(idNum)){
            orderId.value = idNum;
            await fetchDetail(idNum);
            lastKey.value = key;
        }
    }catch{}
});

// #ifdef H5
function parseHashParams(): Record<string,string> {
    try{
        const h = String(location.hash || '');
        const q = h.includes('?') ? h.slice(h.indexOf('?') + 1) : '';
        const out: Record<string,string> = {};
        (q.split('&')||[]).forEach(p=>{
            const [k,v] = p.split('=');
            if (k) out[decodeURIComponent(k)] = decodeURIComponent(v||'');
        });
        return out;
    }catch{ return {}; }
}

async function handleHashChange(){
    try{
        const hash = String(location.hash||'');
        if (!hash.includes('/pages/review/view')) return;
        const params = parseHashParams();
        const idNum = params.orderId ? Number(params.orderId) : NaN;
        const key = `id=${isNaN(idNum)?'':String(idNum)}`;
        if (!key || key === lastKey.value || isNaN(idNum)) return;
        orderId.value = idNum;
        await fetchDetail(idNum);
        lastKey.value = key;
    }catch{}
}

onMounted(()=>{ try { window.addEventListener('hashchange', handleHashChange); } catch {} });
onUnmounted(()=>{ try { window.removeEventListener('hashchange', handleHashChange); } catch {} });
// #endif
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; }
.title-bar { padding: 12rpx 8rpx; }
.title { font-size: 32rpx; font-weight: 700; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom:24rpx; }
.sub-title { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.stars { display:flex; gap: 12rpx; justify-content:center; align-items:center; }
.star-img { width: 44rpx; height: 44rpx; }
.content { white-space: pre-wrap; }
.reply-meta { display:flex; align-items:center; gap: 8rpx; color:#6b7280; font-size: 22rpx; margin-bottom: 8rpx; }
.upload-row { display:flex; align-items:center; gap: 12rpx; flex-wrap: wrap; }
.u-item { width: 160rpx; height: 160rpx; border-radius: 16rpx; overflow:hidden; border: 2rpx solid #e5e7eb; }
.u-thumb { width: 100%; height: 100%; display:block; }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


