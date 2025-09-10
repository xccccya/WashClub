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

		<!-- 等级信息卡片（展示等级名称、图标、以及升级进度） -->
		<view v-if="isLoggedIn" class="card level-card" @tap="goMembership">
			<view class="level-head">
				<view class="level-row">
					<view class="level-name">{{ levelInfo?.name || '会员' }}</view>
				</view>
			</view>
			<image v-if="levelInfo?.iconUrl" class="level-icon-float" :src="toAbs(levelInfo?.iconUrl as any)" mode="aspectFill" />
			<view class="progress">
				<view class="progress-inner" :style="{ width: Math.round(levelProgress*100) + '%' }"></view>
			</view>
			<view class="level-sub">
				<text class="level-remaining" v-if="!isMaxLevel">距下一等级还差{{ remainingGrowth }}成长值</text>
				<text class="level-remaining" v-else>已达最大等级</text>
				<text class="level-progress-num">{{ growthPoints }} / {{ displayTotal }}</text>
			</view>
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

		<!-- 计次卡 -->
		<view class="me-wash-card">
			<WashCard :card="card" :loggedIn="isLoggedIn" @tap="onTapWashCard" />
		</view>

		<!-- 积分卡片（未登录不展示） -->
		<view v-if="isLoggedIn" class="card points-card">
			<view class="points-head">
				<view class="card-title">我的积分</view>
				<view class="link" @tap="goPointsCenter">点击查看积分明细</view>
			</view>
			<view class="points-body" @tap="goPointsCenter">
				<view class="metric">
					<view class="metric-val primary">{{ pointsStats.currentPoints }}</view>
					<view class="metric-label">当前积分</view>
				</view>
				<view class="divider" />
				<view class="metric">
					<view class="metric-val">{{ pointsStats.monthUsed }}</view>
					<view class="metric-label">本月使用</view>
				</view>
				<view class="divider" />
				<view class="metric">
					<view class="metric-val">{{ pointsStats.monthGained }}</view>
					<view class="metric-label">本月获得</view>
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
				<!-- 将“关于我们”删除；仅当已绑定集团显示“集团客户”入口 -->
				<view v-if="hasGroup" class="icon-btn" @tap="onTapGroup">
					<image class="icon-img" src="/static/icons/jtuser.png" mode="aspectFit" />
					<text class="icon-text">集团客户</text>
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
import { API_BASE, checkAuthAndRefresh, createHttp } from '../../utils/auth';
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
// 站点默认头像（动态读取）
const siteSetting = ref<{ defaultMemberAvatarUrl?: string|null }|null>(null);
async function ensureSiteSetting(){ if (siteSetting.value) return; try { const httpS = createHttpClient({ baseUrl: API_BASE, getToken: () => uni.getStorageSync('token') }); siteSetting.value = await httpS('/system/public/site-setting', { method:'GET' }); } catch { siteSetting.value = { defaultMemberAvatarUrl: null }; } }
// 基址由 utils/auth 统一提供
const defaultAvatar = computed(()=> siteSetting.value?.defaultMemberAvatarUrl ? toAbs(siteSetting.value?.defaultMemberAvatarUrl as any) : '');
const http = createHttpClient({ baseUrl: API_BASE, getToken: () => uni.getStorageSync('token') });
const isLoggedIn = computed(() => !!token.value);

// 积分统计
const pointsStats = ref<{ currentPoints:number; monthUsed:number; monthGained:number }>({ currentPoints: 0, monthUsed: 0, monthGained: 0 });
async function loadPoints(){
    try{
        const t = uni.getStorageSync('token'); if (!t) { pointsStats.value = { currentPoints: 0, monthUsed: 0, monthGained: 0 }; return; }
        const http = createHttpClient({ baseUrl: API_BASE, getToken: () => t });
        const s:any = await http('/member/me/points-stats', { method:'GET' });
        pointsStats.value = { currentPoints: Number(s?.currentPoints||0), monthUsed: Number(s?.monthUsed||0), monthGained: Number(s?.monthGained||0) };
    }catch{ pointsStats.value = { currentPoints: 0, monthUsed: 0, monthGained: 0 }; }
}

// 展示昵称兜底：超出长度进行省略，避免挤压右侧元素
const MAX_NICK_LEN = 10;
const displayNickname = computed(() => {
	const raw = nickname.value || '';
	const chars = Array.from(raw);
	if (chars.length <= MAX_NICK_LEN) return raw;
	return chars.slice(0, MAX_NICK_LEN).join('') + '…';
});

function toAbs(u?: string){ if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; if (u.startsWith('/')) return API_BASE + u; return API_BASE + '/' + u; }

// 等级数据与进度
const levelInfo = ref<{ name?: string; iconUrl?: string|null; level?: number; requiredGrowth?: number }|null>(null);
const growthPoints = ref<number>(0);
const currentRequired = ref<number>(0);
const levelProgress = computed(()=>{
    if (isMaxLevel.value) return 1;
    const next = Math.max(0, Number(nextRequired.value||0));
    const base = Math.max(0, Number(currentRequired.value||0));
    const gp = Math.max(0, Number(growthPoints.value||0));
    const span = Math.max(1, next - base);
    const progressed = Math.max(0, gp - base);
    return Math.max(0, Math.min(1, progressed / span));
});
const isMaxLevel = ref<boolean>(false);
const nextRequired = ref<number>(0);
const remainingGrowth = computed(()=>{
    const need = Math.max(0, Number(nextRequired.value||0));
    const gp = Math.max(0, Number(growthPoints.value||0));
    return need > gp ? (need - gp) : 0;
});
const segmentCurrent = computed(()=>{
    if (isMaxLevel.value) return Math.max(0, Number(growthPoints.value||0));
    const base = Math.max(0, Number(currentRequired.value||0));
    const gp = Math.max(0, Number(growthPoints.value||0));
    return Math.max(0, gp - base);
});
const displayTotal = computed(()=>{
    // 分母展示：
    // - 非最大等级：下一等级所需总成长值 nextRequired
    // - 已达最大等级：当前等级的升级需求成长值（即该最大等级的 requiredGrowth）
    const next = Math.max(0, Number(nextRequired.value||0));
    if (isMaxLevel.value) return Math.max(0, Number(levelInfo.value?.requiredGrowth||0));
    return next > 0 ? next : Math.max(0, Number(levelInfo.value?.requiredGrowth||0));
});

function loadAuthFromStorage() {
	try {
		token.value = uni.getStorageSync('token') || null;
		const user = uni.getStorageSync('user');
		if (user && typeof user === 'object') {
			nickname.value = user.name || '会员用户';
			uid.value = user?.uid || null;
            avatarUrl.value = toAbs(user?.avatarUrl) || '';
			// level 展示数据
			growthPoints.value = Number(user?.growthPoints||0);
			levelInfo.value = { name: user?.level?.name || '会员', iconUrl: user?.level?.iconUrl || null, level: user?.level?.level || undefined, requiredGrowth: user?.level?.requiredGrowth || 0 };
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
                    uid.value = profile?.uid || uid.value;
                    avatarUrl.value = toAbs(profile?.avatarUrl) || avatarUrl.value;
					growthPoints.value = Number(profile?.growthPoints||0);
					levelInfo.value = { name: profile?.level?.name || '会员', iconUrl: profile?.level?.iconUrl || null, level: profile?.level?.level || undefined, requiredGrowth: profile?.level?.requiredGrowth || 0 };
					isMaxLevel.value = !!profile?.isMaxLevel;
					nextRequired.value = Number(profile?.nextRequiredGrowth || levelInfo.value?.requiredGrowth || 0);
					currentRequired.value = Number(profile?.currentRequiredGrowth || 0);
                }
            }).catch(()=>{});
        }
    } catch {}
}

onMounted(() => {
    ensureSiteSetting();
	loadAuthFromStorage();
	try {
		const t = uni.getStorageSync('token');
		if (t) {
			const http = createHttpClient({ baseUrl: API_BASE, getToken: () => t });
			http('/member/me/profile', { method: 'GET' }).then((profile:any)=>{
				if (profile) {
					uni.setStorageSync('user', profile);
					nickname.value = profile?.name || nickname.value;
					uid.value = profile?.uid || uid.value;
					avatarUrl.value = toAbs(profile?.avatarUrl) || avatarUrl.value;
					growthPoints.value = Number(profile?.growthPoints||0);
					levelInfo.value = { name: profile?.level?.name || '会员', iconUrl: profile?.level?.iconUrl || null, level: profile?.level?.level || undefined, requiredGrowth: profile?.level?.requiredGrowth || 0 };
					isMaxLevel.value = !!profile?.isMaxLevel;
					nextRequired.value = Number(profile?.nextRequiredGrowth || levelInfo.value?.requiredGrowth || 0);
					currentRequired.value = Number(profile?.currentRequiredGrowth || 0);
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
// 加载积分
onShow(async ()=>{ try{ await loadPoints(); }catch{} });
// #endif
onBeforeUnmount(() => { try { uni.$off?.('auth:changed', handleAuthChanged); } catch {} });

function onTapSetting() { try { uni.navigateTo({ url: '/pages/settings/index' }); } catch {} }
// 微信小程序头像更换：与 settings 页面保持一致
function onChooseWeixinAvatar(e: any) {
    if (!isLoggedIn.value) { navigate('/pages/login/index'); return; }
    const tempUrl = e?.detail?.avatarUrl as string | undefined;
    if (!tempUrl) return;
    uni.uploadFile({
        url: `${API_BASE}/assets/upload`,
        filePath: tempUrl,
        name: 'file',
        formData: { dir: 'miniapp', source: 'avatar' },
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
				const fallback:any = (defaultAvatar as any)?.value !== undefined ? (defaultAvatar as any).value : (defaultAvatar as any);
				const src = avatarUrl.value || fallback;
				uni.previewImage({ urls: [String(src)] });
			} else if (res.tapIndex === 1) {
				uni.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: ['album'],
					success: (r)=>{
						const path = r.tempFilePaths?.[0];
						if (!path) return;
						uni.uploadFile({
							url: `${API_BASE}/assets/upload`,
							filePath: path,
							name: 'file',
							formData: { dir: 'miniapp', source: 'avatar' },
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

async function loadCard(){ try { const t = uni.getStorageSync('token'); if (!t) { card.value = null; return; } const http = createHttp(); const cards = await http<any[]>('/wash-card/me/list', { method: 'GET' }); const def = Array.isArray(cards) ? cards.find(c=>c.isDefault) || cards[0] : null; card.value = def || null; } catch { card.value = null; } }

function navigate(url: '/pages/index/index' | '/pages/me/index' | '/pages/store/index' | '/pages/login/index' | '/pages/washcard/index' | '/pages/order/index' | '/pages/address/index' | '/pages/coupon/index' | '/pages/group/index') {
	const isTab = url === '/pages/index/index' || url === '/pages/store/index' || url === '/pages/order/index' || url === '/pages/me/index';
	if (isTab) { try { uni.switchTab({ url }); return; } catch {}
	}
	try { uni.navigateTo({ url }); } catch {}
}

// 已切换为系统 tabBar

function logout() { try { uni.removeStorageSync('token'); uni.removeStorageSync('user'); } catch {} token.value = null; nickname.value = '点击登录账号'; uni.showToast({ title: '已退出', icon: 'none' }); }

function onTapWashCard(){ if (!isLoggedIn.value) { navigate('/pages/login/index'); return; } navigate('/pages/washcard/index'); }

function goMembership(){ try { uni.navigateTo({ url: '/pages/membership/index' }); } catch {} }

function goPointsCenter(){ try { uni.navigateTo({ url: '/pages/points/index' }); } catch {} }

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

const hasGroup = ref(false);
async function loadGroupFlag(){
	try {
		const t = uni.getStorageSync('token');
		if (!t) { hasGroup.value = false; return; }
		const http = createHttp();
		const me: any = await http('/member/me/profile', { method: 'GET' });
		// 后端已补充 groupId/group 字段
		hasGroup.value = !!(me?.groupId || me?.group?.id);
		try{ const u = uni.getStorageSync('user') || {}; u.groupId = me?.groupId || (me?.group?.id || null); u.group = me?.group || null; uni.setStorageSync('user', u); }catch{}
	} catch { hasGroup.value = false; }
}

function onTapGroup(){ navigate('/pages/group/index'); }

onMounted(()=>{ try { token.value = uni.getStorageSync('token'); } catch {}; loadGroupFlag(); });
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
.setting-btn { padding: 12rpx 20rpx; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); font-size: 24rpx; color: #1f2937; }
.uid-line { font-size: 22rpx; color: #374151; padding: 6rpx 10rpx; background: rgba(255,255,255,.8); border: 2rpx dashed #e5e7eb; border-radius: 999rpx; align-self: flex-start; letter-spacing: 1rpx; }
/* 未登录 CTA */
.login-cta { padding: 12rpx 20rpx; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); color: #0b1220; font-size: 26rpx; font-weight: 700; box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.06); }

/* 等级卡片 */
.level-card { position: relative; background: linear-gradient(180deg, #fff8f0 0%, #f3f9ff 100%); overflow: visible; }
.level-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 14rpx; }
.level-row { display:flex; align-items:center; gap: 12rpx; }
.level-name { font-size: 30rpx; font-weight: 700; color:#1f2937; }
.level-tip-max { font-size: 22rpx; color:#16a34a; background:#ecfdf5; padding: 6rpx 12rpx; border-radius: 999rpx; }
.level-sub { font-size: 24rpx; color:#6b7280; display:flex; align-items:center; justify-content: space-between; }
.level-progress-num { color:#374151; font-weight: 700; }
.level-icon-float { position: absolute; right: -12rpx; top: -12rpx; width: 72rpx; height: 72rpx; border: none; border-radius: 0; box-shadow: none; background: transparent; }
.progress { width:100%; height:14rpx; border-radius:999rpx; background:#eef2ff; overflow:hidden; margin: 8rpx 0 10rpx 0; }
.progress-inner { height:100%; background: linear-gradient(90deg, #a8d8ff, #ffc9de); }

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

/* 积分卡片 */
.points-card { background: linear-gradient(180deg, #ecfeff 0%, #fff7fb 100%); position: relative; overflow: hidden; }
.points-head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.points-head .sub { font-size: 22rpx; color:#6b7280; }
.points-body { display:flex; align-items:stretch; justify-content: space-between; gap: 16rpx; }
.metric { flex:1; display:flex; flex-direction: column; align-items:center; justify-content:center; padding: 12rpx 0; }
.metric-val { font-size: 34rpx; font-weight: 800; color:#0b1220; }
.metric-val.primary { background: linear-gradient(90deg, #60a5fa, #a78bfa); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
.metric-label { font-size: 22rpx; color:#6b7280; margin-top: 6rpx; }
.divider { width: 2rpx; background: linear-gradient(180deg, rgba(148,163,184,0.2), rgba(148,163,184,0.06)); border-radius: 999rpx; }
</style>


