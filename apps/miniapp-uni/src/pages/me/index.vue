<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<!-- 顶部个人信息卡片 -->
		<view class="card profile-card" @tap="onTapProfile">
			<view class="profile-left">
				<image class="avatar" :src="avatarUrl || defaultAvatar" mode="aspectFill" @tap.stop="onTapAvatar" />
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
				<view class="chip">我的订单</view>
				<view class="link" @tap="onTapAllOrders">点击查看全部订单</view>
			</view>
			<view class="orders-grid">
				<view class="pill">待收货</view>
				<view class="pill">待服务</view>
				<view class="pill">已完成</view>
			</view>
		</view>

		<!-- 其它功能区块 -->
		<view class="card actions-card">
			<view class="grid">
				<view class="pill">收货地址</view>
				<view class="pill">商家管理</view>
				<view class="pill">关于我们</view>
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
onShow(async ()=>{ const ok = await checkAuthAndRefresh({ redirectIfExpired: true }); if (ok) { try { handleAuthChanged(); } catch {} await loadCard(); }});
// #endif
onBeforeUnmount(() => { try { uni.$off?.('auth:changed', handleAuthChanged); } catch {} });

function onTapSetting() {}
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
function onTapAllOrders() {}

function onTapProfile() { if (!isLoggedIn.value) navigate('/pages/login/index'); }

async function loadCard(){ try { const t = uni.getStorageSync('token'); if (!t) { card.value = null; return; } const http = createHttpClient({ baseUrl: API_BASE, getToken: () => t }); const cards = await http<any[]>('/wash-card/me/list', { method: 'GET' }); const def = Array.isArray(cards) ? cards.find(c=>c.isDefault) || cards[0] : null; card.value = def || null; } catch { card.value = null; } }

function navigate(url: '/pages/index/index' | '/pages/me/index' | '/pages/store/index' | '/pages/login/index' | '/pages/washcard/index') {
	const isTab = url === '/pages/index/index' || url === '/pages/store/index' || url === '/pages/me/index';
	if (isTab) { try { uni.switchTab({ url }); return; } catch {}
	}
	try { uni.navigateTo({ url }); } catch {}
}

// 已切换为系统 tabBar

function logout() { try { uni.removeStorageSync('token'); uni.removeStorageSync('user'); } catch {} token.value = null; nickname.value = '点击登录账号'; vipLevel.value = '点击登录账号'; uni.showToast({ title: '已退出', icon: 'none' }); }

function onTapWashCard(){ if (!isLoggedIn.value) { navigate('/pages/login/index'); return; } navigate('/pages/washcard/index'); }
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
.orders-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 18rpx; }
.chip { padding: 12rpx 20rpx; border-radius: 999rpx; background:#f7fbff; border: 2rpx dashed #77bfff; font-size: 24rpx; color:#1f2937; }
.link { font-size: 24rpx; color:#2563eb; }
.orders-grid { display:flex; gap: 24rpx; }
.pill { flex:1; text-align:center; padding: 24rpx 0; border-radius: 24rpx; background:#ffffff; border: 2rpx solid #e5e7eb; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.04); }

/* 其它功能 */
.actions-card .grid { display:flex; gap: 24rpx; }
.actions-card .pill { flex:1; text-align:center; padding: 28rpx 0; border-radius: 24rpx; background:#ffffff; border: 2rpx solid #e5e7eb; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.04); }

/* 底部 */
.logout-wrap { padding: 0 24rpx; margin-top: 12rpx; }
.logout-btn { text-align: center; padding: 22rpx 0; border-radius: 999rpx; background: #fff; border: 2rpx solid #ffd6e7; color: #e11d48; }
</style>


