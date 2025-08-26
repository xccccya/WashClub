<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="card">
			<view class="header">
				<text class="title">购买洗车卡</text>
				<text class="subtitle">精选虚拟卡券商品</text>
			</view>
			<view v-if="list.length===0" class="empty">暂无可购卡券</view>
			<view class="product-list">
				<view v-for="p in list" :key="p.id" class="product-card">
					<view class="thumb" />
					<view class="info">
						<text class="name">{{ p.name }}</text>
						<text class="desc">{{ p.sellPoint || '洗车计次卡' }}</text>
						<text class="price">¥{{ formatPrice(p.price) }}</text>
					</view>
					<view class="buy-btn" @tap="() => buy(p)">购买</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { createHttp, checkAuthAndRefresh, getToken } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const list = ref<any[]>([]);

function formatPrice(p: any){ const n = Number(p); return isNaN(n) ? p : n.toFixed(2); }

async function fetchList(){
	try {
		const http = createHttp();
		const items = await http<any[]>('/store/products', { method: 'GET', query: { type: 'VIRTUAL_CARD', enabled: true } });
		list.value = Array.isArray(items) ? items : [];
	} catch { list.value = []; }
}

onShow(async () => {
	await fetchList();
});

async function buy(p: any){
	const authed = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!authed) return;
	const http = createHttp();
	let profile: any = null; try { profile = await http<any>('/member/me/profile', { method:'GET' }); } catch {}
	if (!profile?.id) { uni.showToast({ title:'请先登录', icon:'none' }); return; }
	try {
		const body = { type: 'SP', memberId: profile.id, items: [{ productId: p.id, name: p.name, imageUrl: p.imageUrl || null, price: Number(p.price || 0), discount: 0, quantity: 1, barcode: p.barcode || null }] };
		await http<any>('/orders', { method:'POST', body });
		uni.showToast({ title: '下单成功，请到店支付', icon: 'none' });
		setTimeout(()=>{ try { uni.switchTab({ url:'/pages/order/index' }); } catch {} }, 400);
	} catch (e:any) {
		uni.showToast({ title: e?.message || '下单失败', icon:'none' });
	}
}

function goBack(){ try { uni.navigateBack(); } catch {} }
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: #f7fafc; }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,.04); }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.title { font-size: 30rpx; font-weight: 700; color:#111827; }
.subtitle { font-size: 22rpx; color:#6b7280; }
.empty { padding: 24rpx; color: #6b7280; text-align: center; }

.product-list { display:flex; flex-direction: column; gap: 16rpx; margin-top: 12rpx; }
.product-card { background:#f7fbff; border: 2rpx dashed #77bfff; border-radius: 20rpx; padding: 16rpx; display:flex; flex-direction: row; gap: 12rpx; align-items:center; }
.thumb { width: 160rpx; height: 160rpx; border-radius: 16rpx; background: linear-gradient(135deg, #e0f2fe, #ffe4ef); flex-shrink:0; }
.info { display:flex; flex-direction: column; gap: 6rpx; flex:1; }
.name { font-size:26rpx; color:#111827; }
.desc { font-size:22rpx; color:#6b7280; }
.price { font-size:26rpx; color:#ef4444; font-weight:600; }
.buy-btn { margin-left:auto; text-align:center; padding: 18rpx 24rpx; background:#111827; color:#ffffff; border-radius: 16rpx; font-size:24rpx; }
</style>


