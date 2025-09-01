<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 顶部个人信息卡片 -->
		<view class="card profile-card" @tap="onTapProfile">
			<view class="profile-left">
				<!-- #ifdef MP-WEIXIN -->
				<view class="avatar-wrap">
					<image class="avatar" :src="avatarUrl || defaultAvatar" mode="aspectFill" />
					<button v-if="isLoggedIn" class="avatar-btn-abs" open-type="chooseAvatar" hover-class="none" @chooseavatar="onChooseWeixinAvatar" />
				</view>
				<!-- #endif -->
				<!-- #ifdef H5 -->
				<image class="avatar" :src="avatarUrl || defaultAvatar" mode="aspectFill" @tap.stop="onTapAvatar" />
				<!-- #endif -->
				<view class="meta">
					<view class="chips-row">
						<template v-if="isLoggedIn">
							<view class="nickname-text">{{ displayNickname }}</view>
							<view class="vip-chip">{{ vipLevel }}</view>
						</template>
						<template v-else>
							<view class="login-cta">点击登录账号</view>
						</template>
					</view>
					<view v-if="isLoggedIn && uid" class="uid-line">会员号 {{ uid }}</view>
				</view>
			</view>
			<view class="setting-btn" v-if="isLoggedIn" @tap.stop="onTapSetting">设置</view>
		</view>

		<!-- 计次卡 -->
		<view class="me-wash-card">
			<WashCard :card="card" :loggedIn="isLoggedIn" @tap="onTapWashCard" />
		</view>

		<!-- 我的订单区块 -->
		<view class="card orders-card">
			<view class="orders-head">
				<view class="card-title">我的订单</view>
				<view class="link" @tap="onTapAllOrders">点击查看全部订单</view>
			</view>
			<view class="orders-grid">
				<view class="order-icon-btn" @tap="() => goOrdersWith('all','待支付')">
					<view v-if="unpaidCount>0" class="order-badge">{{ unpaidCountText }}</view>
					<image class="order-icon-img" src="/static/icons/unpaid.png" mode="aspectFit" />
					<text class="order-icon-text">待支付</text>
				</view>
				<view class="order-icon-btn" @tap="() => goOrdersWith('product','待收货')">
					<view v-if="pendingReceiptCount>0" class="order-badge">{{ pendingReceiptCountText }}</view>
					<image class="order-icon-img" src="/static/icons/ontheway.png" mode="aspectFit" />
					<text class="order-icon-text">待收货</text>
				</view>
				<view class="order-icon-btn" @tap="() => goOrdersWith('service','待服务')">
					<view v-if="pendingServiceCount>0" class="order-badge">{{ pendingServiceCountText }}</view>
					<image class="order-icon-img" src="/static/icons/service_wait.png" mode="aspectFit" />
					<text class="order-icon-text">待服务</text>
				</view>
			</view>
		</view>

		<!-- 其它功能区块 -->
		<view class="card actions-card gradient-trans">
			<view class="grid icon-grid">
				<view class="icon-btn" @tap="onTapAddress">
					<image class="icon-img" src="/static/icons/address.png" mode="aspectFit" />
					<text class="icon-text">收货地址</text>
				</view>
				<view class="icon-btn" @tap="onTapCoupon">
					<image class="icon-img" src="/static/icons/coupon.png" mode="aspectFit" />
					<text class="icon-text">领券中心</text>
				</view>
				<view class="icon-btn" @tap="onTapAbout">
					<image class="icon-img" src="/static/icons/about.png" mode="aspectFit" />
					<text class="icon-text">关于我们</text>
				</view>
				<view class="icon-btn" @tap="onTapAdmin">
					<image class="icon-img" src="/static/icons/admin.png" mode="aspectFit" />
					<text class="icon-text">商家管理</text>
				</view>
			</view>
		</view>

		<!-- 底部：已切换为系统 tabBar -->
		<view class="logout-wrap" v-if="isLoggedIn">
			<view class="logout-btn" @tap="logout">退出登录</view>
		</view>
		
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import createHttpClient from '@wash/shared-utils/src/http';
import { API_BASE, checkAuthAndRefresh } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
import WashCard from '../../components/WashCard.vue';

const { topSpacerHeight } = useSafeArea();

const card = ref<any|null>(null);
// 订单角标数量
const unpaidCount = ref<number>(0);
const pendingReceiptCount = ref<number>(0);
const pendingServiceCount = ref<number>(0);
const unpaidCountText = computed(()=> unpaidCount.value>99 ? '99+' : String(unpaidCount.value));
const pendingReceiptCountText = computed(()=> pendingReceiptCount.value>99 ? '99+' : String(pendingReceiptCount.value));
const pendingServiceCountText = computed(()=> pendingServiceCount.value>99 ? '99+' : String(pendingServiceCount.value));

// 登录态
const token = ref<string | null>(null);
const nickname = ref('昵称');
const uid = ref<number | null>(null);
const avatarUrl = ref<string>('');
// 基址由 utils/auth 统一提供
const defaultAvatar = `${API_BASE}/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png`;
const vipLevel = ref('会员等级');
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => uni.getStorageSync('token') });
const isLoggedIn = computed(() => !!token.value);

// 展示昵称兜底：超出长度进行省略，避免挤压右侧元素
const MAX_NICK_LEN = 10;
const displayNickname = computed(() => {
	const raw = nickname.value || '';
	const chars = Array.from(raw);
	if (chars.length <= MAX_NICK_LEN) return raw;
	return chars.slice(0, MAX_NICK_LEN).join('') + '…';
});

function toAbs(u?: string){ if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; if (u.startsWith('/')) return API_BASE + u; return API_BASE + '/' + u; }

function loadAuthFromStorage() {
	try {
		token.value = uni.getStorageSync('token') || null;
		const user = uni.getStorageSync('user');
		if (user && typeof user === 'object') {
			nickname.value = user.name || '会员用户';
			vipLevel.value = user?.level?.name || user?.levelName || '普通会员';
			uid.value = user?.uid || null;
            avatarUrl.value = toAbs(user?.avatarUrl) || '';
		}
	} catch {}
}

function handleAuthChanged(){ loadAuthFromStorage();
    try {
        const t = uni.getStorageSync('token');
        if (t) {
            const http = createHttpClient({ baseUrl: API_BASE, getToken: () => t });
            http('/member/me/profile', { method: 'GET' }).then((profile:any)=>{
                if (profile) {
                    uni.setStorageSync('user', profile);
                    nickname.value = profile?.name || nickname.value;
                    vipLevel.value = profile?.level?.name || vipLevel.value;
                }
            }).catch(()=>{});
        }
    } catch {}
}

onMounted(() => {
	loadAuthFromStorage();
	try {
		const t = uni.getStorageSync('token');
		if (t) {
			const http = createHttpClient({ baseUrl: API_BASE, getToken: () => t });
			http('/member/me/profile', { method: 'GET' }).then((profile:any)=>{
				if (profile) {
					uni.setStorageSync('user', profile);
					nickname.value = profile?.name || nickname.value;
					vipLevel.value = profile?.level?.name || vipLevel.value;
					uid.value = profile?.uid || uid.value;
					avatarUrl.value = toAbs(profile?.avatarUrl) || avatarUrl.value;
				}
			}).catch(()=>{});
			try { http('/member/me/active', { method: 'POST' }).catch(()=>{}); } catch {}
		}
	} catch {}
	try { uni.$on?.('auth:changed', handleAuthChanged); } catch {}
});
// 页面展示：检查登录并拉取默认洗车卡
// #ifdef MP-WEIXIN || H5
import { onShow } from '@dcloudio/uni-app';
onShow(async ()=>{ const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (ok) { try { handleAuthChanged(); } catch {} await loadCard(); await loadOrderBadges(); }});
// #endif
onBeforeUnmount(() => { try { uni.$off?.('auth:changed', handleAuthChanged); } catch {} });

function onTapSetting() { try { uni.navigateTo({ url: '/pages/settings/index' }); } catch {} }
// 微信小程序头像更换：与 settings 页面保持一致
function onChooseWeixinAvatar(e: any) {
    if (!isLoggedIn.value) { navigate('/pages/login/index'); return; }
    const tempUrl = e?.detail?.avatarUrl as string | undefined;
    if (!tempUrl) return;
    uni.uploadFile({
        url: `${API_BASE}/file/upload`,
        filePath: tempUrl,
        name: 'file',
        formData: { dir: 'miniapp' },
        header: { Authorization: `Bearer ${uni.getStorageSync('token')||''}` },
        success: async (resUp: any) => {
            try {
                const data = JSON.parse(resUp.data || '{}');
                const url = data?.url || '';
                if (!url) { uni.showToast({ title: '上传失败', icon: 'none' }); return; }
                const userObj:any = uni.getStorageSync('user') || {};
                await http(`/member/${userObj?.id}`, { method: 'PUT', body: { avatarUrl: url } });
                avatarUrl.value = toAbs(url);
                try { const u = uni.getStorageSync('user') || {}; u.avatarUrl = url; uni.setStorageSync('user', u); } catch {}
                uni.showToast({ title: '已更新头像', icon: 'success' });
            } catch (e:any) {
                uni.showToast({ title: e?.message?.slice(0,30) || '保存失败', icon: 'none' });
            }
        },
        fail: ()=> uni.showToast({ title:'上传失败', icon:'none' })
    });
}
function onTapAvatar(){
	if (!isLoggedIn.value) { navigate('/pages/login/index'); return; }
	uni.showActionSheet({
		itemList: ['查看头像', '从相册中选择'],
		success: (res)=>{
			if (res.tapIndex === 0) {
				const src = avatarUrl.value || defaultAvatar;
				uni.previewImage({ urls: [src] });
			} else if (res.tapIndex === 1) {
				uni.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: ['album'],
					success: (r)=>{
						const path = r.tempFilePaths?.[0];
						if (!path) return;
						uni.uploadFile({
							url: `${API_BASE}/file/upload`,
							filePath: path,
							name: 'file',
							formData: { dir: 'miniapp' },
							header: { Authorization: `Bearer ${uni.getStorageSync('token')||''}` },
							success: async (resUp)=>{
								try {
									const data = JSON.parse(resUp.data||'{}');
									const url = data?.url || '';
									if (!url) { uni.showToast({ title:'上传失败', icon:'none' }); return; }
									const userObj:any = uni.getStorageSync('user') || {};
									await http(`/member/${userObj?.id}`, { method: 'PUT', body: { avatarUrl: url } });
									avatarUrl.value = toAbs(url);
									try { const u = uni.getStorageSync('user') || {}; u.avatarUrl = toAbs(url); uni.setStorageSync('user', u); } catch {}
									uni.showToast({ title: '已更新头像', icon: 'success' });
								} catch (e:any) {
									uni.showToast({ title: e?.message?.slice(0,30) || '保存失败', icon: 'none' });
								}
							},
							fail: ()=> uni.showToast({ title:'选择失败', icon:'none' })
						});
					}
				});
			}
		}
	});
}
function onTapAllOrders() { try { uni.switchTab({ url: '/pages/order/index' }); } catch {} }

function goOrdersWith(main:'all'|'product'|'service', filter:'待支付'|'待收货'|'待服务'){
    try {
        uni.setStorageSync('order:preset', { main, filter });
    } catch {}
    try { uni.switchTab({ url: '/pages/order/index' }); } catch {}
}

function onTapProfile() { if (!isLoggedIn.value) navigate('/pages/login/index'); }

async function loadCard(){ try { const t = uni.getStorageSync('token'); if (!t) { card.value = null; return; } const http = createHttpClient({ baseUrl: API_BASE, getToken: () => t }); const cards = await http<any[]>('/wash-card/me/list', { method: 'GET' }); const def = Array.isArray(cards) ? cards.find(c=>c.isDefault) || cards[0] : null; card.value = def || null; } catch { card.value = null; } }

function navigate(url: '/pages/index/index' | '/pages/me/index' | '/pages/store/index' | '/pages/login/index' | '/pages/washcard/index' | '/pages/order/index' | '/pages/address/index' | '/pages/coupon/index') {
	const isTab = url === '/pages/index/index' || url === '/pages/store/index' || url === '/pages/order/index' || url === '/pages/me/index';
	if (isTab) { try { uni.switchTab({ url }); return; } catch {}
	}
	try { uni.navigateTo({ url }); } catch {}
}

// 已切换为系统 tabBar

function logout() { try { uni.removeStorageSync('token'); uni.removeStorageSync('user'); } catch {} token.value = null; nickname.value = '点击登录账号'; vipLevel.value = '点击登录账号'; uni.showToast({ title: '已退出', icon: 'none' }); }

function onTapWashCard(){ if (!isLoggedIn.value) { navigate('/pages/login/index'); return; } navigate('/pages/washcard/index'); }

// 其它功能入口
function onTapAddress(){ if (!isLoggedIn.value) { navigate('/pages/login/index'); return; } navigate('/pages/address/index'); }
function onTapCoupon(){ if (!isLoggedIn.value) { navigate('/pages/login/index'); return; } navigate('/pages/coupon/index'); }
function onTapAdmin(){ uni.showToast({ title: '商家管理开发中', icon: 'none' }); }
function onTapAbout(){ uni.showToast({ title: '关于我们开发中', icon: 'none' }); }

// 统计订单角标：待支付/待收货/待服务
async function loadOrderBadges(){
    try{
        const t = uni.getStorageSync('token');
        if (!t) { unpaidCount.value=0; pendingReceiptCount.value=0; pendingServiceCount.value=0; return; }
        const http = createHttpClient({ baseUrl: API_BASE, getToken: () => t });
        // 仅拉取当前会员的订单，避免统计到其他用户
        const userObj:any = uni.getStorageSync('user') || {};
        const memberIdNum = Number(userObj?.id) || 0;
        const q:any = { memberId: memberIdNum > 0 ? memberIdNum : undefined };
        const list:any[] = await http('/orders', { method:'GET', query: q });
        const orders = Array.isArray(list) ? list : [];
        let unpaid=0, preceipt=0, pservice=0;
        for (const o of orders){
            // 待支付
            if (o?.payStatus === 'UNPAID') unpaid++;
            // 待收货（商品订单，已支付，发货中/已发货未收）
            if (o?.type === 'SP' && o?.payStatus === 'PAID'){
                if (o?.fulfillmentStatus === 'SHIPPED') preceipt++;
            }
            // 待服务（服务订单，IN_SERVICE/PENDING 或 旧字段 PAID）
            if (o?.type === 'SERVICE'){
                const isPaid = o?.payStatus === 'PAID';
                const fs = o?.fulfillmentStatus;
                if (isPaid && (fs === 'IN_SERVICE' || fs === 'PENDING')) pservice++;
                else if (isPaid && (!fs || fs === 'NONE') && o?.status === 'PAID') pservice++;
            }
        }
        unpaidCount.value = unpaid;
        pendingReceiptCount.value = preceipt;
        pendingServiceCount.value = pservice;
    }catch{
        unpaidCount.value=0; pendingReceiptCount.value=0; pendingServiceCount.value=0;
    }
}
</script>

<style>
.page {
	min-height: 100vh;
	padding: 24rpx 24rpx 0 24rpx;
	background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%);
	box-sizing: border-box;
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
}

.card { background: #ffffff; border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); margin-bottom: 24rpx; }
.card-title { font-size: 28rpx; font-weight: 600; color: #2b2f36; }

/* 个人信息 */
.profile-card { display:flex; align-items:center; justify-content: space-between; background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.profile-left { display:flex; align-items:center; gap: 24rpx; flex: 1; min-width: 0; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: linear-gradient(135deg, #a8d8ff, #ffc9de); box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.08); }
.avatar-wrap { position: relative; width: 120rpx; height: 120rpx; }
.avatar-btn-abs { position: absolute; inset: 0; background: transparent; border: none; opacity: 0; }
.avatar-btn-abs::after, .avatar-btn-abs:after { border: none; border-width: 0; content: none; }
.meta { display:flex; flex-direction: column; gap: 10rpx; flex: 1; min-width: 0; }
.chips-row { display:flex; align-items:center; gap: 16rpx; min-width: 0; }
.nickname-text { font-size: 36rpx; font-weight: 800; color: #0b1220; letter-spacing: 1rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60vw; }
.vip-chip { padding: 10rpx 18rpx; border-radius: 999rpx; background: #ffffff; border: 2rpx solid #fbbf24; font-size: 22rpx; color: #92400e; font-weight: 600; }
.setting-btn { padding: 12rpx 20rpx; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); font-size: 24rpx; color: #1f2937; }
.uid-line { font-size: 22rpx; color: #374151; padding: 6rpx 10rpx; background: rgba(255,255,255,.8); border: 2rpx dashed #e5e7eb; border-radius: 999rpx; align-self: flex-start; letter-spacing: 1rpx; }
/* 未登录 CTA */
.login-cta { padding: 12rpx 20rpx; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); color: #0b1220; font-size: 26rpx; font-weight: 700; box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.06); }

/* 计次卡 */
.me-wash-card { margin-bottom: 24rpx; }
.quota-card .quota-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 18rpx; }
.title-row { display:flex; align-items:center; gap: 10rpx; }
.share-badge { font-size: 22rpx; color: #374151; background: #f3f4f6; padding: 4rpx 8rpx; border-radius: 999rpx; }
.quota-usage { font-size: 24rpx; color: #6b7280; }
.progress { width:100%; height:14rpx; border-radius:999rpx; background:#eef2ff; overflow:hidden; margin: 8rpx 0 16rpx 0; }
.progress-inner { height:100%; background: linear-gradient(90deg, #a8d8ff, #ffc9de); }
.quota-footer { font-size: 24rpx; color:#6b7280; }

/* 订单区块 */
.orders-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.orders-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 18rpx; }
.link { font-size: 24rpx; color:#2563eb; }
.orders-grid { display:flex; gap: 24rpx; }
.order-icon-btn { flex:1; display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 24rpx 0; border-radius: 24rpx; background: transparent; border: none; box-shadow: none; }
.order-icon-btn { position: relative; }
.order-badge { position: absolute; right: 12rpx; top: 6rpx; min-width: 28rpx; height: 28rpx; padding: 0 8rpx; border-radius: 999rpx; background: #ef4444; color:#fff; font-size: 20rpx; display:flex; align-items:center; justify-content:center; box-shadow: 0 2rpx 6rpx rgba(239,68,68,0.35); }
.order-icon-img { width: 60rpx; height: 60rpx; margin-bottom: 10rpx; display:block; }
.order-icon-text { font-size: 24rpx; color:#1f2937; }

/* 其它功能 */
.actions-card .grid { display:flex; gap: 24rpx; }
.gradient-trans { background: linear-gradient(180deg, rgba(243,249,255,0.92) 0%, rgba(255,247,251,0.92) 100%); backdrop-filter: blur(2rpx); }
.icon-grid { display:flex; gap: 24rpx; }
.icon-btn { flex:1; display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 28rpx 0; border-radius: 24rpx; background: transparent; border: none; box-shadow: none; }
.icon-img { width: 60rpx; height: 60rpx; margin-bottom: 12rpx; }
.icon-text { font-size: 24rpx; color:#1f2937; }

/* 底部 */
.logout-wrap { padding: 0 24rpx; margin-top: 12rpx; }
.logout-btn { text-align: center; padding: 22rpx 0; border-radius: 999rpx; background: #fff; border: 2rpx solid #ffd6e7; color: #e11d48; }
</style>


