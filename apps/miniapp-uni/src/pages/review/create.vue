<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="title-bar"><text class="title">发表评价</text></view>

		<view class="card">
			<view class="sub-title">满意度</view>
			<view class="stars">
				<image v-for="i in 5" :key="i" :src="rating>=i ? '/static/icons/star-fill.png' : '/static/icons/star.png'" class="star-img" mode="aspectFit" @tap="setRating(i)" />
			</view>
		</view>

		<view class="card">
			<view class="sub-title">文字评价（可选）</view>
			<textarea class="textarea" v-model="content" placeholder="写点想说的..." />
		</view>

		<view class="card">
			<view class="sub-title">图片（可选）</view>
			<view class="upload-row">
				<view class="u-item" v-for="(img,idx) in images" :key="idx">
					<image :src="img" class="u-thumb" mode="aspectFill" />
				</view>
				<view class="u-add" @tap="chooseImages">+</view>
			</view>
		</view>

		<view class="fixed-bar"><view class="btn primary" @tap="submit">提交评价</view></view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { createHttp, checkAuthAndRefresh, API_BASE, getToken } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

const orderId = ref<number>(0);
const rating = ref<number>(5);
const content = ref<string>('');
const images = ref<string[]>([]);

function goBack(){ const pages = getCurrentPages?.() || []; if (pages.length > 1) { uni.navigateBack(); return; } uni.reLaunch({ url: '/pages/order/index' }); }
function setRating(n:number){ rating.value = n; }

onLoad((q:any)=>{ orderId.value = Number(q?.orderId||0) || 0; });

async function chooseImages(){
    try{
        const r:any = await new Promise((resolve)=> uni.chooseImage({ count: 6, success: resolve, fail: ()=>resolve(null) }));
        if (!r || !Array.isArray(r.tempFilePaths)) return;
        const http = createHttp();
        const joinUrl = (base:string, pathStr:string) => {
            if (!pathStr) return '';
            if (/^https?:\/\//i.test(pathStr)) return pathStr;
            const b = String(base||'').replace(/\/+$/, '');
            const p = String(pathStr||'').replace(/^\/+/, '');
            return b + '/' + p;
        };
        for (const filePath of r.tempFilePaths){
            await new Promise<void>((resolve)=>{
                const base = API_BASE || '';
                const token = getToken() || '';
                uni.uploadFile({
                    url: base + '/file/upload',
                    filePath,
                    name: 'file',
                    formData: { dir: 'miniapp' },
                    header: { Authorization: token ? ('Bearer ' + token) : '' },
                    success: (res:any)=>{
                        try{
                            const j = JSON.parse(res.data||'{}');
                            const u = j?.url || '';
                            const full = joinUrl(base, u);
                            if (full) images.value.push(full);
                        }catch{}
                        resolve();
                    },
                    fail: ()=> resolve(),
                });
            });
        }
    }catch{}
}

async function submit(){
    try{
        const authed = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!authed) return;
        const http = createHttp();
        await http(`/orders/${orderId.value}/review`, { method:'POST', body: { rating: rating.value, content: content.value, images: images.value } });
        uni.showToast({ title:'已提交', icon:'success' });
        setTimeout(()=>{ uni.reLaunch({ url: '/pages/order/index' }); }, 600);
    }catch{ uni.showToast({ title:'提交失败，请稍后再试', icon:'none' }); }
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; padding-bottom: calc(env(safe-area-inset-bottom) + 120rpx); }
.title-bar { padding: 12rpx 8rpx; }
.title { font-size: 32rpx; font-weight: 700; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius:24rpx; padding:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); margin:0 2rpx 24rpx 2rpx; }
.sub-title { font-size: 28rpx; font-weight: 600; margin-bottom: 12rpx; }
.stars { display:flex; gap: 12rpx; justify-content:center; align-items:center; }
.star-img { width: 44rpx; height: 44rpx; }
.textarea { width: 100%; max-width: 100%; min-height: 180rpx; padding: 16rpx; box-sizing: border-box; display:block; background:#fff; border-radius: 12rpx; border: 2rpx solid #e5e7eb; overflow: hidden; }
.upload-row { display:flex; align-items:center; gap: 12rpx; flex-wrap: wrap; }
.u-item { width: 160rpx; height: 160rpx; border-radius: 16rpx; overflow:hidden; border: 2rpx solid #e5e7eb; }
.u-thumb { width: 100%; height: 100%; display:block; }
.u-add { width: 160rpx; height: 160rpx; border-radius: 16rpx; background:#fff; border: 2rpx dashed #9ca3af; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size: 40rpx; }
.fixed-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 16rpx 24rpx; background: rgba(255,255,255,0.9); box-shadow: 0 -8rpx 24rpx rgba(0,0,0,0.06); }
.btn { padding: 16rpx 24rpx; border-radius: 999rpx; text-align:center; }
.btn.primary { color: #fff; background: linear-gradient(135deg, #60a5fa, #a78bfa); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
/* #ifdef H5 */
.textarea { width: calc(100% - 30rpx); }
/* #endif */
</style>


