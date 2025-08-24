<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view v-if="showNotice" class="card notice-card" :style="{ top: (statusBarHeight + 64) + 'px' }">
			<text class="notice-close" @tap="showNotice=false">×</text>
			<image class="notice-icon" src="/static/icons/warning.png" mode="widthFix" />
			<view class="notice-body">
				<view class="notice-title">重要提醒</view>
				<view class="notice-paragraph">
					<text class="notice-text">首次使用新版小程序且有洗车计次卡未用完的老用户，请务必使用</text>
					<text class="highlight">微信一键登录</text>
					<text class="notice-text">并授权选择</text>
					<text class="highlight">购买洗车卡时登记的手机号</text>
					<text class="notice-text">，否则洗车卡数据无法正常同步。如有疑问请咨询店员处理。</text>
				</view>
			</view>
		</view>
		<view class="center">
			<view class="card login-card" :class="{ pulse: cardPulse }">
				<view class="title">登录</view>
				<view class="hint">请输入手机号</view>

				<!-- 手机号 + 验证码/密码 切换 -->
				<view class="row">
					<input class="input" type="number" maxlength="11" v-model="phone" placeholder="手机号" />
					<view v-if="mode==='code'" class="btn ghost" @tap="onSendCode">{{ countdown>0 ? `${countdown}s` : '获取验证码' }}</view>
				</view>
				<transition name="mode-fade-slide">
					<view v-if="mode==='code'" key="code" class="row code-row">
						<text class="label">验证码</text>
						<view class="code-input" @tap="focusCodeInput">
							<input class="hidden-code-input" type="number" maxlength="6" :focus="codeFocus" :value="secret" @input="onCodeInput" @focus="isCodeFocused=true" @blur="onCodeBlur" cursor-spacing="20" />
							<view class="code-cells">
								<view v-for="i in 6" :key="i" class="code-cell" :class="{ filled: i <= secret.length, caret: i === secret.length + 1 && isCodeFocused }">
									<text class="digit">{{ secret[i-1] || '' }}</text>
								</view>
							</view>
						</view>
					</view>
					<view v-else key="pwd" class="row">
						<text class="label">密码</text>
						<input class="input flex1" :password="true" v-model="secret" placeholder="登录密码" />
					</view>
				</transition>

				<view class="switch-row">
					<view class="link pill" @tap="toggleMode">切换{{ mode==='code' ? '密码' : '验证码' }}登录</view>
					<view v-if="mode==='pwd'" class="link soft" @tap="onTapForgot">忘记密码</view>
				</view>

				<view class="agreements" @tap="agreeTerms = !agreeTerms">
					<view class="dot" :class="{ checked: agreeTerms }" />
					<text>已阅读并同意《用户协议》</text>
				</view>
				<view class="agreements" @tap="agreeAuto = !agreeAuto">
					<view class="dot" :class="{ checked: agreeAuto }" />
					<text>未注册账号将自动注册账号</text>
				</view>

				<!-- 独立登录按钮（支持验证码/密码） -->
				<view class="primary" @tap="mode==='code' ? loginByCode() : loginByPwd()">登录</view>
			</view>
		</view>

		<!-- 底部独立：微信一键登录 -->
		<view class="bottom">
			<!-- 仅微信小程序端展示真实按钮 -->
			<!-- #ifdef MP-WEIXIN -->
			<button v-if="agreeTerms && agreeAuto" class="wechat-btn" open-type="getPhoneNumber" @getphonenumber="onGotPhoneNumber"><image class="wechat-icon" src="/static/icons/wechat.png" />微信一键登录</button>
			<button v-else class="wechat-btn" @tap="onTapWechatPrecheck"><image class="wechat-icon" src="/static/icons/wechat.png" />微信一键登录</button>
			<!-- #endif -->
			<!-- #ifndef MP-WEIXIN -->
			<view class="wechat-btn" @tap="wechatLogin"><image class="wechat-icon" src="/static/icons/wechat.png" />微信一键登录</view>
			<!-- #endif -->
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import createHttpClient from '@wash/shared-utils/src/http';
import { API_BASE, saveAuth } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';

// 兼容 TS 识别 uni 全局对象
declare const uni: any;

const { topSpacerHeight, statusBarHeight } = useSafeArea();

const mode = ref<'code'|'pwd'>('code');
const phone = ref('');
const secret = ref('');
const agreeTerms = ref(false);
const agreeAuto = ref(false);
const countdown = ref(0);
const showNotice = ref(true);

// 分段验证码输入与动画控制
const codeFocus = ref(false);
const isCodeFocused = ref(false);
const cardPulse = ref(false);

function focusCodeInput(){ codeFocus.value = true; }
function onCodeInput(e: any){
    const v: string = String(e?.detail?.value ?? e?.target?.value ?? '');
    const digits = v.replace(/\D+/g, '').slice(0, 6);
    secret.value = digits;
}
function onCodeBlur(){ isCodeFocused.value = false; codeFocus.value = false; }

function toggleMode(){
    mode.value = mode.value === 'pwd' ? 'code' : 'pwd';
    // 切换时清空密钥并触发轻微卡片动画
    secret.value = '';
    cardPulse.value = true; setTimeout(()=>{ cardPulse.value = false; }, 220);
}
function onTapForgot(){
	// 仅跳转到修改密码占位页（页面仅界面即可）
	cardPulse.value = true; setTimeout(()=>{ cardPulse.value = false; navigate('/pages/reset-password/index'); }, 200);
}

function navigate(url: '/pages/index/index' | '/pages/me/index' | '/pages/reset-password/index' | '/pages/store/index'){
	// #ifdef H5
	if (typeof window !== 'undefined') { window.location.hash = `#${url}`; return; }
	// #endif
	const isTab = url === '/pages/index/index' || url === '/pages/store/index' || url === '/pages/me/index';
	if (isTab) { try { uni.switchTab({ url }); return; } catch {} }
	uni.navigateTo({ url });
}

const http = createHttpClient({ baseUrl: API_BASE });

async function onSendCode(){
	if (mode.value !== 'code') return;
	if (!/^\d{11}$/.test(phone.value)) { uni.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
	if (countdown.value > 0) return;
	try {
		await http('/auth/send-code', { method: 'POST', body: { phone: phone.value } } as any);
		uni.showToast({ title: '验证码已发送', icon: 'success' });
		countdown.value = 60;
		const timer = setInterval(()=>{
			countdown.value -= 1;
			if (countdown.value <= 0) clearInterval(timer);
		}, 1000);
	} catch (e:any) {
		uni.showToast({ title: e?.message?.slice(0,30) || '发送失败', icon: 'none' });
	}
}

async function loginByPwd(){
	if (!agreeTerms.value || !agreeAuto.value) {
		uni.showModal({ title: '提示', content: '请先勾选同意《用户协议》并确认“未注册账号将自动注册账号”。', showCancel: false });
		return;
	}
	if (mode.value !== 'pwd') return;
	if (!/^\d{11}$/.test(phone.value)) { uni.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
	if (secret.value.length < 6) { uni.showToast({ title: '密码至少6位', icon: 'none' }); return; }
	try {
		const data = await http<{ token: string; user: any }>( '/auth/login', { method: 'POST', body: { phone: phone.value, password: secret.value } } as any);
		saveAuth(data.token, data.user);
		// 登录后立即上报活跃
		try { const httpAuth = createHttpClient({ baseUrl: API_BASE, getToken: () => data.token }); httpAuth('/member/me/active', { method: 'POST' }).catch(()=>{}); } catch {}
		// 通知全局刷新（H5/小程序兼容）
		try { uni.$emit?.('auth:changed'); } catch {}
		uni.showToast({ title: '登录成功', icon: 'success' });
		// 返回我的页面，避免清栈，tab 页使用 switchTab
		setTimeout(()=>{
			try { uni.switchTab({ url: '/pages/me/index' }); } catch { navigate('/pages/me/index'); }
		}, 300);
	} catch (e:any) {
		uni.showToast({ title: e?.message?.slice(0,30) || '登录失败', icon: 'none' });
	}
}

// 短信验证码登录
async function loginByCode(){
    if (!agreeTerms.value || !agreeAuto.value) {
        uni.showModal({ title: '提示', content: '请先勾选同意《用户协议》并确认“未注册账号将自动注册账号”。', showCancel: false });
        return;
    }
    if (mode.value !== 'code') return;
    if (!/^\d{11}$/.test(phone.value)) { uni.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
    if (!/^\d{6}$/.test(secret.value)) { uni.showToast({ title: '请输入6位验证码', icon: 'none' }); return; }
    try {
        const data = await http<{ token: string; user: any; createdNew?: boolean }>( '/auth/login/code', { method: 'POST', body: { phone: phone.value, code: secret.value } } as any);
        saveAuth(data.token, data.user);
        try { const httpAuth = createHttpClient({ baseUrl: API_BASE, getToken: () => data.token }); httpAuth('/member/me/active', { method: 'POST' }).catch(()=>{}); } catch {}
        try { uni.$emit?.('auth:changed'); } catch {}
        uni.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(()=>{ try { uni.switchTab({ url: '/pages/me/index' }); } catch { navigate('/pages/me/index'); } }, 300);
    } catch (e:any) {
        uni.showToast({ title: e?.message?.slice(0,30) || '登录失败', icon: 'none' });
    }
}

// 非小程序端兜底
function wechatLogin(){ uni.showToast({ title: '请在微信小程序内使用', icon: 'none' }); }

function onTapWechatPrecheck(){
	uni.showModal({ title: '提示', content: '请先勾选同意《用户协议》并确认“未注册账号将自动注册账号”。', showCancel: false });
}

// 微信一键登录流程
async function onGotPhoneNumber(e: any){
	let loadingShown = false;
	// 必须先勾选协议与自动注册
	if (!agreeTerms.value || !agreeAuto.value) {
		uni.showModal({ title: '提示', content: '请先勾选同意《用户协议》并确认“未注册账号将自动注册账号”。', showCancel: false });
		return;
	}
	try {
		const errMsg: string = e?.detail?.errMsg || '';
		if (!/getPhoneNumber:ok/.test(errMsg)) {
			const errno = e?.detail?.errno;
			if (errno === 1400001) {
				uni.showToast({ title: '超出组件额度，请稍后再试', icon: 'none' });
			} else {
				uni.showToast({ title: '已取消授权', icon: 'none' });
			}
			return;
		}
		const phoneCode: string = e?.detail?.code;
		if (!phoneCode) { uni.showToast({ title: '获取手机号失败', icon: 'none' }); return; }
		try { uni.showLoading({ title: '正在登录…', mask: true }); loadingShown = true; } catch {}

		// 获取 jsCode（wx.login）
		const loginRes = await new Promise<{ code: string }>((resolve, reject) => {
			uni.login({ provider: 'weixin', success: resolve, fail: reject });
		});
		const jsCode = loginRes?.code;
		if (!jsCode) { if (loadingShown) { try { uni.hideLoading(); } catch {} } uni.showToast({ title: '拉取登录码失败', icon: 'none' }); return; }

		// 调用后端一键登录接口
		const resp = await http<any>('/auth/wechat/one-tap', { method: 'POST', body: { phoneCode, jsCode } } as any);
		if (resp?.ok === false && resp?.code === 'OPENID_BOUND_CONFLICT') {
			const masked = resp?.maskedPhone || '';
			if (loadingShown) { try { uni.hideLoading(); } catch {} }
			await new Promise<void>((resolve) => {
				uni.showModal({
					title: '登录失败',
					content: `该微信号已绑定其他手机号：${masked}，请使用该手机号登录或更换微信。`,
					showCancel: false,
					success: () => resolve(),
				});
			});
			return;
		}
		if (resp?.ok && resp?.token) {
			saveAuth(resp.token, resp.user);
			try { const httpAuth = createHttpClient({ baseUrl: API_BASE, getToken: () => resp.token }); httpAuth('/member/me/active', { method: 'POST' }).catch(()=>{}); } catch {}
			try { uni.$emit?.('auth:changed'); } catch {}
			if (loadingShown) { try { uni.hideLoading(); } catch {} }

			const needWelcome = resp?.createdNew === false && resp?.justBoundOpenId === true;
			if (needWelcome) {
				await new Promise<void>((resolve) => {
					uni.showModal({
						title: '欢迎回来',
						content: '欢迎回到巨科，若您的账号存在未使用完洗车卡则已经迁移到新版小程序，快去看看吧~',
						showCancel: false,
						success: () => resolve(),
					});
				});
			} else {
				uni.showToast({ title: '登录成功', icon: 'success' });
			}

			setTimeout(()=>{ try { uni.switchTab({ url: '/pages/me/index' }); } catch { navigate('/pages/me/index'); } }, 300);
			return;
		}
		throw new Error('登录失败');
	} catch (err: any) {
		if (loadingShown) { try { uni.hideLoading(); } catch {} }
		uni.showToast({ title: err?.message?.slice(0,30) || '登录失败', icon: 'none' });
	}
}
function goBack(){
	try { uni.navigateBack(); return; } catch {}
	try { uni.switchTab({ url: '/pages/me/index' }); } catch {}
}
</script>

<style>
.page { min-height:100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff, #fff0f6); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.center { min-height: calc(100vh - 220rpx); display:flex; align-items:center; justify-content:center; }
.login-card { width: 88%; max-width: 680rpx; padding: 32rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); }
.login-card.pulse { animation: card-pulse .22s ease; }
.title { font-size: 32rpx; font-weight: 700; margin-bottom: 12rpx; }
.hint { color:#6b7280; margin-bottom: 16rpx; }
.row { display:flex; align-items:center; gap: 16rpx; margin-bottom: 16rpx; }
.label { width: 120rpx; color:#374151; }
.input { flex:1; height: 80rpx; border-radius: 20rpx; background: rgba(255,255,255,.85); border:2rpx solid #e5e7eb; padding: 0 20rpx; box-shadow: inset 0 2rpx 8rpx rgba(0,0,0,0.04); }
.input.flex1 { flex:1; }
.btn.ghost { padding: 14rpx 20rpx; border-radius: 999rpx; border:2rpx solid #e5e7eb; background: rgba(255,255,255,.92); box-shadow: 0 6rpx 16rpx rgba(0,0,0,.06); }
.switch-row { display:flex; justify-content: space-between; margin: 8rpx 0 16rpx; color:#2563eb; }
.link { color:#2563eb; }
.link.pill { padding: 8rpx 16rpx; border-radius: 999rpx; background: rgba(255,255,255,.92); border:2rpx solid #bfdbfe; box-shadow: 0 4rpx 12rpx rgba(0,0,0,.05); }
.link.soft { color:#374151; opacity:.9; }
.agreements { display:flex; align-items:center; gap: 12rpx; margin: 8rpx 0; color:#374151; }
.dot { width: 28rpx; height: 28rpx; border-radius: 50%; border:2rpx solid #e5e7eb; background:#fff; box-shadow: inset 0 0 0 0 #a8d8ff; transition: box-shadow .15s ease; }
.dot.checked { box-shadow: inset 0 0 0 12rpx #a8d8ff; }
.primary { margin-top: 16rpx; text-align:center; padding: 22rpx 0; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08); color:#0b1220; font-weight: 600; }
.bottom { position: fixed; left: 24rpx; right: 24rpx; bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.wechat-btn { text-align:center; padding: 22rpx 0; border-radius: 999rpx; background: #07c160; color: #fff; box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, .25); display:flex; align-items:center; justify-content:center; gap: 12rpx; }
.wechat-icon { width: 36rpx; height: 36rpx; }
.card { background:#fff; border-radius:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); }
.card.login-card { background: linear-gradient(135deg, #a8d8ff, #ffc9de); }
@keyframes card-pulse { 0% { transform: scale(1); } 50% { transform: scale(0.995); } 100% { transform: scale(1); } }
/* 提醒卡片 */
.notice-card { position: fixed; left: 24rpx; right: 24rpx; padding: 28rpx 28rpx 24rpx 28rpx; margin: 0; border-radius: 24rpx; background: linear-gradient(180deg, #fffbea, #fffaf0); border: 2rpx solid #fde68a; box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.12); z-index: 900; }
.notice-icon { width: 48rpx; height: 48rpx; }
.notice-close { position: absolute; top: 12rpx; right: 12rpx; width: 48rpx; height: 48rpx; line-height: 48rpx; text-align: center; color: #92400e; background: rgba(253, 230, 138, .6); border-radius: 999rpx; font-size: 32rpx; }
.notice-body { padding-left: 96rpx; margin-left: 0; }
.notice-title { font-size: 30rpx; font-weight: 700; color: #92400e; }
.notice-paragraph { margin-top: 8rpx; line-height: 1.6; color: #7c2d12; }
.notice-text { color: #7c2d12; }
.highlight { color: #b45309; font-weight: 700; }
.notice-icon { position: absolute; left: 28rpx; top: 28rpx; width: 56rpx; height: 56rpx; }
/* 验证码分段输入 */
.code-row { align-items: center; }
.code-row .label { line-height: 84rpx; }
.code-input { position: relative; flex:1; }
.hidden-code-input { position: fixed; opacity:0; width:1px; height:1px; left:-9999px; top:-9999px; background: transparent; border: 0; outline: none; color: transparent; caret-color: transparent; -webkit-text-fill-color: transparent; -webkit-tap-highlight-color: transparent; }
.code-cells { display:flex; align-items:center; justify-content: space-between; gap: 12rpx; }
.code-cell { flex:1; height: 84rpx; border-radius: 16rpx; background: rgba(255,255,255,.85); border:2rpx solid #e5e7eb; display:flex; align-items:center; justify-content:center; box-shadow: inset 0 2rpx 8rpx rgba(0,0,0,0.04); }
.code-cell.filled { border-color:#93c5fd; background:#ffffff; }
.code-cell.caret { border-color:#2563eb; box-shadow: 0 0 0 4rpx rgba(37,99,235,.12) inset; }
.digit { font-size: 34rpx; font-weight: 700; color:#111827; }
/* 切换动效 */
.mode-fade-slide-enter-active, .mode-fade-slide-leave-active { transition: all .2s ease; }
.mode-fade-slide-enter-from { opacity: 0; transform: translateY(6rpx); }
.mode-fade-slide-leave-to { opacity: 0; transform: translateY(-6rpx); }
</style>


