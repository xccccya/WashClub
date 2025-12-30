<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />

		<!-- 左上角返回按钮：登录页返回上一页；重置页返回登录 -->
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="onTapNavBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="screens">
			<!-- 登录 Screen -->
			<view class="screen" :class="{ 'off-left': screen !== 'login' }">
				<view class="card" :class="{ enter: loginEnter }">
					<view class="card-inner">
						<view class="headline">
							<view class="h2">登录</view>
							<text class="headline-sub">{{ mode === 'code' ? '使用短信验证码快速登录' : '输入密码登录' }}</text>
						</view>

						<view class="mode-tabs" role="tablist" aria-label="登录方式">
							<view class="tab" :class="{ active: mode === 'code' }" role="tab" :aria-selected="String(mode === 'code')" @tap="setMode('code')">验证码登录</view>
							<view class="tab" :class="{ active: mode === 'pwd' }" role="tab" :aria-selected="String(mode === 'pwd')" @tap="setMode('pwd')">密码登录</view>
						</view>

						<view class="field">
							<view class="label-row">
								<view class="label">手机号</view>
								<view class="hint">仅用于登录与账号识别</view>
							</view>
							<view class="input-group" :class="{ focused: phoneGroupFocused }">
								<input
									class="input"
									inputmode="numeric"
									maxlength="11"
									:value="phone"
									placeholder="请输入 11 位手机号"
									@input="onPhoneInput"
									@focus="phoneGroupFocused = true"
									@blur="phoneGroupFocused = false"
								/>
								<button class="btn ghost send-code" :class="{ hidden: mode !== 'code' }" :disabled="sendCodeDisabled" @tap="onSendCode">
									{{ sendCodeText }}
								</button>
							</view>
						</view>

						<!-- 模式切换动画（对齐原型）：code/pwd 两个 panel 都在，只切换可见与高度 -->
						<view class="mode-area" :class="mode === 'code' ? 'mode-code' : 'mode-pwd'">
							<view class="panel-wrap code-wrap">
								<view class="mode-panel">
									<view class="field reveal" :class="{ show: codeAreaVisible }" style="margin-top: 0">
										<view class="reveal-inner">
											<view class="label-row">
												<view class="label">验证码</view>
												<view class="hint">6 位短信验证码</view>
											</view>

											<input
												class="hidden-code-input"
												type="number"
												maxlength="6"
												:focus="codeFocus"
												:value="code"
												@input="onCodeInput"
												@focus="isCodeFocused = true"
												@blur="onCodeBlur"
												cursor-spacing="20"
											/>

											<view class="seg-code" :class="{ focused: isCodeFocused }" @tap="focusCodeInput">
												<view
													v-for="i in 6"
													:key="i"
													class="cell"
													:class="{
														filled: i <= code.length,
														caret: i === Math.min(code.length + 1, 6) && code.length < 6 && isCodeFocused
													}"
												>
													<text>{{ code[i - 1] || ' ' }}</text>
												</view>
											</view>
										</view>
									</view>
								</view>
							</view>

							<view class="panel-wrap pwd-wrap">
								<view class="mode-panel">
									<view class="field pwd-field">
										<view class="label-row">
											<view class="label">密码</view>
											<view class="btn link" @tap="goResetScreen">忘记密码</view>
										</view>
										<input class="input" :password="true" :value="pwd" placeholder="请输入登录密码（≥6位）" @input="onPwdInput" />
									</view>
								</view>
							</view>
						</view>

						<view class="agree-row">
							<view class="agree-left">
								<view class="agree-title">同意协议并允许自动注册</view>
								<view class="agree-desc">
									我已阅读并同意 <text class="agree-link" @tap.stop="openTerms">《用户协议》</text>，未注册的手机号将为我自动创建账号。
								</view>
							</view>
							<view class="switch" :class="{ on: agree }" role="switch" :aria-checked="String(agree)" @tap="setAgree(!agree)">
								<view class="knob" />
							</view>
						</view>

						<view class="divider" />

						<view class="actions">
							<button class="primary" :disabled="primaryDisabled" @tap="onTapPrimary">
								<text class="btn-title">{{ primaryText }}</text>
							</button>
						</view>
					</view>
				</view>

				<view class="bottom-actions" :class="{ enter: loginEnter }">
					<!-- #ifdef MP-WEIXIN -->
					<button
						v-if="agree"
						class="wechat"
						open-type="getPhoneNumber"
						@getphonenumber="onGotPhoneNumber"
					>
						<view class="dot" />
						微信一键登录
					</button>
					<button v-else class="wechat" @tap="onTapWechatPrecheck">
						<view class="dot" />
						微信一键登录
					</button>
					<!-- #endif -->
					<!-- #ifndef MP-WEIXIN -->
					<view class="wechat" @tap="wechatLogin">
						<view class="dot" />
						微信一键登录
					</view>
					<!-- #endif -->
				</view>
			</view>

			<!-- 重置密码 Screen -->
			<view class="screen" :class="{ 'off-right': screen !== 'reset' }">
				<view class="card" :class="{ enter: resetEnter }">
					<view class="card-inner">
						<view class="headline">
							<view class="h2">重置登录密码</view>
							<text class="headline-sub">验证手机号后设置新密码</text>
						</view>

						<view class="field">
							<view class="label-row">
								<view class="label">手机号</view>
								<view class="hint">请输入你绑定的手机号</view>
							</view>
							<view class="input-group" :class="{ focused: rPhoneGroupFocused }">
								<input
									class="input"
									inputmode="numeric"
									maxlength="11"
									:value="rPhone"
									placeholder="请输入 11 位手机号"
									@input="onRPhoneInput"
									@focus="rPhoneGroupFocused = true"
									@blur="rPhoneGroupFocused = false"
								/>
								<button class="btn ghost send-code" :disabled="rSendCodeDisabled" @tap="onRSendCode">
									{{ rSendCodeText }}
								</button>
							</view>
						</view>

						<view class="field reveal" :class="{ show: rCodeAreaVisible }">
							<view class="reveal-inner">
								<view class="label-row">
									<view class="label">短信验证码</view>
									<view class="hint">6 位验证码</view>
								</view>

								<view v-if="rCodeLoading" class="skeleton-row" aria-hidden="true">
									<view v-for="i in 6" :key="i" class="skeleton-cell" />
								</view>

								<view v-else>
									<input
										class="hidden-code-input"
										type="number"
										maxlength="6"
										:focus="rCodeFocus"
										:value="rCode"
										@input="onRCodeInput"
										@focus="rIsCodeFocused = true"
										@blur="onRCodeBlur"
										cursor-spacing="20"
									/>

									<view class="seg-code" :class="{ focused: rIsCodeFocused }" @tap="focusRCodeInput">
										<view
											v-for="i in 6"
											:key="i"
											class="cell"
											:class="{
												filled: i <= rCode.length,
												caret: i === Math.min(rCode.length + 1, 6) && rCode.length < 6 && rIsCodeFocused
											}"
										>
											<text>{{ rCode[i - 1] || ' ' }}</text>
										</view>
									</view>
								</view>
							</view>
						</view>

						<view class="field reveal" :class="{ show: rPwd1AreaVisible }">
							<view class="reveal-inner">
								<view class="label-row">
									<view class="label">新密码</view>
									<view class="hint">至少 6 位</view>
								</view>
								<input class="input" :password="true" :value="rPwd1" placeholder="设置新密码" @input="onRPwd1Input" @blur="onRPwd1Blur" />
							</view>
						</view>

						<view class="field reveal" :class="{ show: rPwd2AreaVisible }">
							<view class="reveal-inner">
								<view class="label-row">
									<view class="label">确认新密码</view>
									<view class="hint">请再输入一次</view>
								</view>

								<view v-if="rPwd2Loading" class="skeleton" aria-hidden="true" />
								<input v-else class="input" :password="true" :value="rPwd2" placeholder="再次输入新密码" @input="onRPwd2Input" />
							</view>
						</view>

						<view class="divider" />
						<view class="actions">
							<button class="primary" :disabled="rPrimaryDisabled" @tap="onRSubmit">
								<text class="btn-title">提交并返回登录</text>
							</button>
						</view>
					</view>
				</view>
			</view>
		</view>

		<!-- 自定义确认弹窗：同意协议（MP/H5 风格统一，参考原型） -->
		<view class="modal-mask" :class="{ show: agreeModalVisible }" @tap="onAgreeModalMaskTap">
			<view class="modal" role="dialog" aria-modal="true" @tap.stop>
				<view class="modal-body">
					<view class="modal-title">是否同意协议？</view>
					<view class="modal-text">继续登录需要你同意《用户协议》，并知晓未注册手机号将自动创建账号。</view>
				</view>
				<view class="modal-actions">
					<button class="modal-btn" @tap="onAgreeModalCancel">暂不</button>
					<button class="modal-btn primary" @tap="onAgreeModalOk">同意并继续</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { API_BASE, saveAuth } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
import {
	authControllerLogin,
	authControllerLoginByCode,
	authControllerResetPassword,
	authControllerSendLoginCode,
	authControllerWechatOneTap,
	memberControllerSetActive,
} from '@wash/api-client';

declare const uni: any;

const { topSpacerHeight, statusBarHeight } = useSafeArea();

// 合并页：屏幕切换
const screen = ref<'login' | 'reset'>('login');
const loginEnter = ref(false);
const resetEnter = ref(false);
function triggerEnter(which: 'login' | 'reset') {
	if (which === 'login') loginEnter.value = false;
	if (which === 'reset') resetEnter.value = false;
	setTimeout(() => {
		if (which === 'login') loginEnter.value = true;
		if (which === 'reset') resetEnter.value = true;
		setTimeout(() => {
			if (which === 'login') loginEnter.value = false;
			if (which === 'reset') resetEnter.value = false;
		}, 450);
	}, 0);
}
function setScreen(next: 'login' | 'reset') {
	if (screen.value === next) return;
	screen.value = next;
	triggerEnter(next);
}
function goLoginScreen() {
	setScreen('login');
}
function goResetScreen() {
	// 把登录页手机号带过去，减少重复输入
	if (!rPhone.value && phone.value) rPhone.value = phone.value;
	setScreen('reset');
}

function onTapNavBack() {
	// reset -> login
	if (screen.value === 'reset') {
		goLoginScreen();
		return;
	}
	// login -> back (fallback to /me tab)
	try {
		uni.navigateBack();
		return;
	} catch {}
	try {
		uni.switchTab({ url: '/pages/me/index' });
	} catch {}
}

onLoad((q: any) => {
	const next = String(q?.screen || '').trim();
	if (next === 'reset') setTimeout(() => setScreen('reset'), 0);
	const p = String(q?.phone || '').replace(/\D+/g, '').slice(0, 11);
	if (p) {
		phone.value = p;
		rPhone.value = p;
	}
});

function onlyDigits(s: any) {
	return String(s ?? '').replace(/\D+/g, '');
}

// ====== 登录 ======
const mode = ref<'code' | 'pwd'>('code');
const phone = ref('');
const code = ref('');
const pwd = ref('');
const agree = ref(false);

const phoneGroupFocused = ref(false);
const codeAreaVisible = ref(false);
const codeFocus = ref(false);
const isCodeFocused = ref(false);

const loginCountdown = ref(0);
let loginTimer: ReturnType<typeof setInterval> | null = null;

const phoneOk = computed(() => /^\d{11}$/.test(phone.value));
const codeOk = computed(() => /^\d{6}$/.test(code.value));
const pwdOk = computed(() => (pwd.value || '').length >= 6);

function setAgree(next: boolean) {
	agree.value = next;
}

// ====== 协议确认弹窗（自定义，替代 uni.showModal） ======
const agreeModalVisible = ref(false);
let agreePendingAction: null | (() => Promise<void> | void) = null;
function openAgreeModal(action: () => Promise<void> | void) {
	agreePendingAction = action;
	agreeModalVisible.value = true;
}
function closeAgreeModal() {
	agreeModalVisible.value = false;
	agreePendingAction = null;
}
function onAgreeModalMaskTap() {
	closeAgreeModal();
}
async function onAgreeModalOk() {
	const fn = agreePendingAction;
	closeAgreeModal();
	setAgree(true);
	if (fn) await fn();
}
function onAgreeModalCancel() {
	closeAgreeModal();
	uni.showToast({ title: '已取消', icon: 'none' });
}

function setMode(next: 'code' | 'pwd') {
	if (mode.value === next) return;
	mode.value = next;
	// 切换模式：不保留验证码/密码，且验证码区域回到“发送后再显示”
	code.value = '';
	pwd.value = '';
	codeAreaVisible.value = false;
	codeFocus.value = false;
	isCodeFocused.value = false;
}

function onPhoneInput(e: any) {
	const v = onlyDigits(e?.detail?.value ?? e?.target?.value).slice(0, 11);
	phone.value = v;
	// 改手机号时：验证码区域回到初始状态
	if (!phoneOk.value) {
		codeAreaVisible.value = false;
		code.value = '';
	}
}
function onPwdInput(e: any) {
	pwd.value = String(e?.detail?.value ?? e?.target?.value ?? '');
}

function focusCodeInput() {
	if (mode.value !== 'code') return;
	if (!codeAreaVisible.value) return;
	codeFocus.value = true;
}
function onCodeInput(e: any) {
	const v = onlyDigits(e?.detail?.value ?? e?.target?.value).slice(0, 6);
	code.value = v;
}
function onCodeBlur() {
	isCodeFocused.value = false;
	codeFocus.value = false;
}

async function ensureAgreeThen(action: () => Promise<void> | void) {
	if (agree.value) return await action();
	openAgreeModal(action);
}

const sendCodeDisabled = computed(() => mode.value !== 'code' || !phoneOk.value || loginCountdown.value > 0);
const sendCodeText = computed(() => (loginCountdown.value > 0 ? `${loginCountdown.value}s` : '获取验证码'));

const primaryDisabled = computed(() => {
	if (mode.value === 'code') {
		// 对齐原型：未展开验证码区时主按钮不可点
		if (!phoneOk.value) return true;
		if (!codeAreaVisible.value) return true;
		return !(phoneOk.value && codeOk.value);
	}
	// 密码登录：手机号与密码均满足才可点击
	return !(phoneOk.value && pwdOk.value);
});
const primaryText = computed(() => {
	if (mode.value === 'code') {
		if (!codeAreaVisible.value) return '输入手机号并获取验证码';
		return phoneOk.value && codeOk.value ? '登录' : '输入验证码登录';
	}
	return '登录';
});

async function onTapPrimary() {
	await ensureAgreeThen(async () => {
		if (mode.value === 'code') {
			// 更贴近原型：未展开验证码区域时，点击主按钮可直接触发发送验证码
			if (!codeAreaVisible.value) return await onSendCode();
			return await loginByCode();
		}
		return await loginByPwd();
	});
}

function openTerms() {
	try {
		const url = `${API_BASE}/system/public/miniapp-terms`;
		const encoded = encodeURIComponent(url);
		// #ifdef H5
		if (typeof window !== 'undefined') {
			(window as any).open(url, '_blank');
			return;
		}
		// #endif
		uni.navigateTo({ url: `/pages/webview/index?url=${encoded}&title=${encodeURIComponent('用户协议')}` });
	} catch {}
}

function navigate(url: '/pages/index/index' | '/pages/me/index' | '/pages/store/index') {
	// #ifdef H5
	if (typeof window !== 'undefined') {
		(window as any).location.hash = `#${url}`;
		return;
	}
	// #endif
	const isTab = url === '/pages/index/index' || url === '/pages/store/index' || url === '/pages/me/index';
	if (isTab) {
		try {
			uni.switchTab({ url });
			return;
		} catch {}
	}
	uni.navigateTo({ url });
}

async function onSendCode() {
	if (mode.value !== 'code') return;
	if (!phoneOk.value) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' });
		return;
	}
	if (loginCountdown.value > 0) return;
	try {
		await authControllerSendLoginCode({ phone: phone.value } as any);
		uni.showToast({ title: '验证码已发送', icon: 'success' });
		// 发送成功后：优雅展开验证码区域 + 聚焦
		codeAreaVisible.value = true;
		code.value = '';
		isCodeFocused.value = false;
		codeFocus.value = false;
		setTimeout(() => {
			codeFocus.value = true;
		}, 120);

		if (loginTimer) clearInterval(loginTimer);
		loginCountdown.value = 60;
		loginTimer = setInterval(() => {
			loginCountdown.value -= 1;
			if (loginCountdown.value <= 0) {
				loginCountdown.value = 0;
				if (loginTimer) clearInterval(loginTimer);
				loginTimer = null;
			}
		}, 1000);
	} catch (e: any) {
		uni.showToast({ title: e?.message?.slice(0, 30) || '发送失败', icon: 'none' });
	}
}

async function loginByPwd() {
	if (mode.value !== 'pwd') return;
	if (!phoneOk.value) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' });
		return;
	}
	if (!pwdOk.value) {
		uni.showToast({ title: '密码至少6位', icon: 'none' });
		return;
	}
	try {
		const data = (await authControllerLogin({ phone: phone.value, password: pwd.value } as any)) as unknown as { token: string; user: any };
		saveAuth(data.token, data.user);
		try {
			await memberControllerSetActive({} as any);
		} catch {}
		try {
			uni.$emit?.('auth:changed');
		} catch {}
		uni.showToast({ title: '登录成功', icon: 'success' });
		setTimeout(() => {
			try {
				uni.switchTab({ url: '/pages/me/index' });
			} catch {
				navigate('/pages/me/index');
			}
		}, 300);
	} catch (e: any) {
		uni.showToast({ title: e?.message?.slice(0, 30) || '登录失败', icon: 'none' });
	}
}

async function loginByCode() {
	if (mode.value !== 'code') return;
	if (!phoneOk.value) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' });
		return;
	}
	if (!codeAreaVisible.value) {
		uni.showToast({ title: '请先获取验证码', icon: 'none' });
		return;
	}
	if (!codeOk.value) {
		uni.showToast({ title: '请输入6位验证码', icon: 'none' });
		return;
	}
	try {
		const data = (await authControllerLoginByCode({ phone: phone.value, code: code.value } as any)) as unknown as { token: string; user: any };
		saveAuth(data.token, data.user);
		try {
			await memberControllerSetActive({} as any);
		} catch {}
		try {
			uni.$emit?.('auth:changed');
		} catch {}
		uni.showToast({ title: '登录成功', icon: 'success' });
		setTimeout(() => {
			try {
				uni.switchTab({ url: '/pages/me/index' });
			} catch {
				navigate('/pages/me/index');
			}
		}, 300);
	} catch (e: any) {
		uni.showToast({ title: e?.message?.slice(0, 30) || '登录失败', icon: 'none' });
	}
}

// 非小程序端兜底
function wechatLogin() {
	uni.showToast({ title: '请在微信小程序内使用', icon: 'none' });
}

function onTapWechatPrecheck() {
	// 不同于旧实现：这里走 ensureAgreeThen，保证“同意并继续”按钮真的会生效（并开启开关）
	ensureAgreeThen(async () => {
		uni.showToast({ title: '已同意，请再次点击微信一键登录', icon: 'none' });
	});
}

function pickWechatPhoneCode(e: any): string | null {
	// uniapp/微信事件结构可能有差异：尽可能兼容
	const d = e?.detail ?? e ?? {};
	const c =
		d?.code ||
		d?.phoneCode ||
		d?.data?.code ||
		d?.detail?.code ||
		d?.detail?.data?.code ||
		null;
	return c ? String(c) : null;
}

async function onGotPhoneNumber(e: any) {
	let loadingShown = false;
	if (!agree.value) {
		onTapWechatPrecheck();
		return;
	}
	try {
		const errMsg: string = String(e?.detail?.errMsg || e?.errMsg || '');
		if (!/getPhoneNumber:ok/.test(errMsg)) {
			const errno = e?.detail?.errno;
			if (errno === 1400001) {
				uni.showToast({ title: '超出组件额度，请稍后再试', icon: 'none' });
			} else {
				uni.showToast({ title: '已取消授权', icon: 'none' });
			}
			return;
		}

		const phoneCode = pickWechatPhoneCode(e);
		if (!phoneCode) {
			// 关键修复：给出更明确提示，避免“授权后直接失败”没有线索
			let keys = '';
			try {
				const detailKeys = Object.keys(e?.detail || {}).slice(0, 12);
				keys = detailKeys.length ? `（detail 字段：${detailKeys.join(', ')}）` : '';
			} catch {}
			uni.showModal({
				title: '获取手机号失败',
				content: `未拿到手机号组件返回的 code。请确认微信版本/基础库版本支持手机号能力，或稍后重试。${keys}`,
				showCancel: false,
			});
			return;
		}

		try {
			uni.showLoading({ title: '正在登录…', mask: true });
			loadingShown = true;
		} catch {}

		const loginRes = await new Promise<{ code: string }>((resolve, reject) => {
			uni.login({ provider: 'weixin', success: resolve, fail: reject });
		});
		const jsCode = loginRes?.code;
		if (!jsCode) {
			if (loadingShown) {
				try {
					uni.hideLoading();
				} catch {}
			}
			uni.showToast({ title: '拉取登录码失败', icon: 'none' });
			return;
		}

		const resp = (await authControllerWechatOneTap({ phoneCode, jsCode } as any)) as unknown as any;
		if (resp?.ok === false && resp?.code === 'OPENID_BOUND_CONFLICT') {
			const masked = resp?.maskedPhone || '';
			if (loadingShown) {
				try {
					uni.hideLoading();
				} catch {}
			}
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
			try {
				await memberControllerSetActive({} as any);
			} catch {}
			try {
				uni.$emit?.('auth:changed');
			} catch {}
			if (loadingShown) {
				try {
					uni.hideLoading();
				} catch {}
			}

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

			setTimeout(() => {
				try {
					uni.switchTab({ url: '/pages/me/index' });
				} catch {
					navigate('/pages/me/index');
				}
			}, 300);
			return;
		}
		throw new Error('登录失败');
	} catch (err: any) {
		if (loadingShown) {
			try {
				uni.hideLoading();
			} catch {}
		}
		uni.showToast({ title: err?.message?.slice(0, 30) || '登录失败', icon: 'none' });
	}
}

// ====== 重置密码（合并到同页） ======
const rPhone = ref('');
const rPhoneGroupFocused = ref(false);
const rCode = ref('');
const rPwd1 = ref('');
const rPwd2 = ref('');

const rCodeAreaVisible = ref(false);
const rCodeLoading = ref(false);
const rPwd1AreaVisible = ref(false);
const rPwd2AreaVisible = ref(false);
const rPwd2Loading = ref(false);

const rCodeFocus = ref(false);
const rIsCodeFocused = ref(false);

const rCountdown = ref(0);
let rTimer: ReturnType<typeof setInterval> | null = null;
let rCodeLoadingT: ReturnType<typeof setTimeout> | null = null;
let rPwd2LoadingT: ReturnType<typeof setTimeout> | null = null;

const rPhoneOk = computed(() => /^\d{11}$/.test(rPhone.value));
const rCodeOk = computed(() => /^\d{6}$/.test(rCode.value));
const rPwd1Ok = computed(() => (rPwd1.value || '').length >= 6);
const rPwd2Ok = computed(() => rPwd1Ok.value && rPwd1.value === rPwd2.value);

const rSendCodeDisabled = computed(() => !rPhoneOk.value || rCountdown.value > 0);
const rSendCodeText = computed(() => (rCountdown.value > 0 ? `${rCountdown.value}s` : '获取验证码'));
const rPrimaryDisabled = computed(() => !(rPhoneOk.value && rCodeOk.value && rPwd2Ok.value));

function onRPhoneInput(e: any) {
	rPhone.value = onlyDigits(e?.detail?.value ?? e?.target?.value).slice(0, 11);
	if (!rPhoneOk.value) {
		rCodeAreaVisible.value = false;
		rCode.value = '';
		rPwd1AreaVisible.value = false;
		rPwd2AreaVisible.value = false;
		rPwd1.value = '';
		rPwd2.value = '';
	}
}
function focusRCodeInput() {
	if (!rCodeAreaVisible.value || rCodeLoading.value) return;
	rCodeFocus.value = true;
}
function onRCodeInput(e: any) {
	rCode.value = onlyDigits(e?.detail?.value ?? e?.target?.value).slice(0, 6);
}
function onRCodeBlur() {
	rIsCodeFocused.value = false;
	rCodeFocus.value = false;
}
function onRPwd1Input(e: any) {
	rPwd1.value = String(e?.detail?.value ?? e?.target?.value ?? '');
	if (!rPwd1Ok.value) {
		rPwd2AreaVisible.value = false;
		rPwd2Loading.value = false;
		rPwd2.value = '';
	}
}
function onRPwd1Blur() {
	if (!rPwd1Ok.value) {
		rPwd2AreaVisible.value = false;
		rPwd2Loading.value = false;
		rPwd2.value = '';
		return;
	}
	if (!rPwd2AreaVisible.value) {
		rPwd2AreaVisible.value = true;
		rPwd2Loading.value = true;
		if (rPwd2LoadingT) clearTimeout(rPwd2LoadingT);
		rPwd2LoadingT = setTimeout(() => {
			rPwd2Loading.value = false;
		}, 380);
	}
}
function onRPwd2Input(e: any) {
	rPwd2.value = String(e?.detail?.value ?? e?.target?.value ?? '');
}
watch(rCodeOk, (ok) => {
	if (ok) {
		rPwd1AreaVisible.value = true;
	} else {
		rPwd1AreaVisible.value = false;
		rPwd2AreaVisible.value = false;
		rPwd2Loading.value = false;
		rPwd1.value = '';
		rPwd2.value = '';
	}
});

async function onRSendCode() {
	if (!rPhoneOk.value) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' });
		return;
	}
	if (rCountdown.value > 0) return;
	try {
		await authControllerSendLoginCode({ phone: rPhone.value, purpose: 'resetPwd' } as any);
		uni.showToast({ title: '验证码已发送', icon: 'success' });
		triggerEnter('reset');
		rCodeAreaVisible.value = true;
		rCode.value = '';
		rIsCodeFocused.value = false;
		rCodeFocus.value = false;
		rPwd1AreaVisible.value = false;
		rPwd2AreaVisible.value = false;
		rPwd2Loading.value = false;
		rPwd1.value = '';
		rPwd2.value = '';

		rCodeLoading.value = true;
		if (rCodeLoadingT) clearTimeout(rCodeLoadingT);
		rCodeLoadingT = setTimeout(() => {
			rCodeLoading.value = false;
			setTimeout(() => (rCodeFocus.value = true), 80);
		}, 520);

		if (rTimer) clearInterval(rTimer);
		rCountdown.value = 60;
		rTimer = setInterval(() => {
			rCountdown.value -= 1;
			if (rCountdown.value <= 0) {
				rCountdown.value = 0;
				if (rTimer) clearInterval(rTimer);
				rTimer = null;
			}
		}, 1000);
	} catch (e: any) {
		uni.showToast({ title: e?.message?.slice(0, 30) || '发送失败', icon: 'none' });
	}
}

async function onRSubmit() {
	if (!rPhoneOk.value) {
		uni.showToast({ title: '请输入正确手机号', icon: 'none' });
		return;
	}
	if (!rCodeOk.value) {
		uni.showToast({ title: '请输入 6 位验证码', icon: 'none' });
		return;
	}
	if (!rPwd1Ok.value) {
		uni.showToast({ title: '新密码至少 6 位', icon: 'none' });
		return;
	}
	if (!rPwd2Ok.value) {
		uni.showToast({ title: '两次密码不一致', icon: 'none' });
		return;
	}
	try {
		await authControllerResetPassword({ phone: rPhone.value, code: rCode.value, newPassword: rPwd1.value } as any);
		uni.showToast({ title: '修改成功', icon: 'success' });
		setTimeout(() => {
			setScreen('login');
			// 回到登录后保留手机号，方便直接登录
			phone.value = rPhone.value;
			mode.value = 'pwd';
			pwd.value = '';
			code.value = '';
			codeAreaVisible.value = false;
		}, 450);
	} catch (e: any) {
		uni.showToast({ title: e?.message?.slice(0, 30) || '修改失败', icon: 'none' });
	}
}

onUnmounted(() => {
	if (loginTimer) clearInterval(loginTimer);
	loginTimer = null;
	if (rTimer) clearInterval(rTimer);
	rTimer = null;
	if (rCodeLoadingT) clearTimeout(rCodeLoadingT);
	rCodeLoadingT = null;
	if (rPwd2LoadingT) clearTimeout(rPwd2LoadingT);
	rPwd2LoadingT = null;
});
</script>

<style>
.page {
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	padding: 24rpx;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, #e9f5ff, #fff0f6);
}

.nav-back {
	position: fixed;
	left: 16rpx;
	z-index: 1000;
	padding: 8rpx;
}
.nav-back-icon {
	width: 56rpx;
	height: 56rpx;
}

/* 合并页屏幕切换（对齐原型） */
.screens {
	position: relative;
	flex: 1;
	margin-top: 12rpx;
}
.screen {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 18rpx;
	transform: translateX(0);
	opacity: 1;
	pointer-events: auto;
	transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.2, 1), opacity 0.24s ease;
}
.screen.off-left {
	transform: translateX(-12%);
	opacity: 0;
	pointer-events: none;
}
.screen.off-right {
	transform: translateX(12%);
	opacity: 0;
	pointer-events: none;
}

.card {
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.88);
	border: 2rpx solid rgba(255, 255, 255, 0.8);
	box-shadow: 0 18rpx 46rpx rgba(15, 23, 42, 0.12);
	overflow: hidden;
	width: 100%;
	max-width: 680rpx;
	margin-left: auto;
	margin-right: auto;
}
.card.enter {
	animation: card-enter 0.38s ease both;
}
@keyframes card-enter {
	from {
		opacity: 0;
		transform: translateY(10rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
.card-inner {
	padding: 28rpx;
}

.headline {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 16rpx;
	margin-bottom: 18rpx;
}
.h2 {
	font-size: 40rpx;
	font-weight: 800;
	color: #0b1220;
}
.headline-sub {
	font-size: 24rpx;
	color: #6b7280;
}

.mode-tabs {
	display: flex;
	gap: 12rpx;
	padding: 10rpx;
	border-radius: 999rpx;
	/* 参考原型：更轻的半透明底 + 更克制的描边 + 毛玻璃 */
	background: rgba(255, 255, 255, 0.55);
	border: 2rpx solid rgba(255, 255, 255, 0.7);
	backdrop-filter: blur(12px);
	box-shadow: 0 10rpx 18rpx rgba(15, 23, 42, 0.08);
}
.tab {
	flex: 1;
	height: 72rpx;
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	font-weight: 800;
	color: #374151;
	transition: background 0.16s ease, transform 0.12s ease, color 0.16s ease;
	/* 默认态更像“胶囊内的文字”，不需要强背景 */
	background: transparent;
}
.tab.active {
	color: #0b1220;
	background: linear-gradient(135deg, rgba(99, 179, 255, 0.75), rgba(255, 119, 179, 0.65));
	box-shadow: 0 10rpx 18rpx rgba(15, 23, 42, 0.12);
}
.tab:active {
	transform: scale(0.99);
}

.field {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
	margin-top: 18rpx;
}
.label-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
}
.label {
	font-size: 24rpx;
	color: #374151;
	font-weight: 650;
}
.hint {
	font-size: 24rpx;
	color: #6b7280;
}

.input {
	height: 96rpx;
	width: 100%;
	border-radius: 20rpx;
	border: 2rpx solid rgba(17, 24, 39, 0.1);
	background: rgba(255, 255, 255, 0.92);
	box-shadow: inset 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
	padding: 0 24rpx;
	font-size: 28rpx;
	box-sizing: border-box;
	display: block;
	line-height: 96rpx;
}
.input-group {
	width: 100%;
	display: flex;
	align-items: stretch;
	border-radius: 24rpx;
	overflow: hidden;
	border: 2rpx solid rgba(17, 24, 39, 0.1);
	background: rgba(255, 255, 255, 0.92);
}
.input-group.focused {
	border-color: rgba(37, 99, 235, 0.25);
}
.input-group .input {
	border: 0;
	border-radius: 0;
	box-shadow: none;
	flex: 1;
	min-width: 0;
}

.btn {
	height: 96rpx;
	border-radius: 999rpx;
	border: 2rpx solid rgba(17, 24, 39, 0.1);
	background: rgba(255, 255, 255, 0.82);
	padding: 0 24rpx;
	font-size: 24rpx;
	font-weight: 800;
	display: flex;
	align-items: center;
	justify-content: center;
	white-space: nowrap;
}
.btn::after,
.primary::after,
.wechat::after {
	border: 0 !important;
}
.btn:disabled {
	opacity: 0.55;
}
.btn.link {
	border: 0;
	background: transparent;
	padding: 0;
	height: 48rpx;
	min-height: 48rpx;
	font-weight: 800;
	color: #2563eb;
	line-height: 1;
	display: inline-flex;
	align-items: center;
}
.pwd-field {
	margin-top: 0;
}
.input-group .btn {
	border: 0;
	border-left: 2rpx solid rgba(17, 24, 39, 0.1);
	border-radius: 0;
	background: rgba(255, 255, 255, 0.86);
}
.input-group .send-code {
	max-width: 260rpx;
	opacity: 1;
	transform: translateX(0);
	transition: max-width 0.28s ease, opacity 0.18s ease, transform 0.28s ease, padding 0.28s ease, border-color 0.18s ease;
}
.input-group .send-code.hidden {
	max-width: 0;
	padding-left: 0;
	padding-right: 0;
	opacity: 0;
	transform: translateX(10rpx);
	border-left-color: transparent;
	pointer-events: none;
}

/* 模式切换动画（对齐原型的 panel-wrap） */
.mode-area {
	margin-top: 12rpx;
	/* 让切换区域更像一个“独立模块”（参考原型整体质感） */
	padding: 14rpx;
	/* 关键：抵消左右 padding 造成的“内容变窄”，让内部输入框宽度与手机号输入框一致 */
	margin-left: -14rpx;
	margin-right: -14rpx;
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.55);
	border: 2rpx solid rgba(255, 255, 255, 0.7);
	backdrop-filter: blur(12px);
}
.panel-wrap {
	max-height: 0;
	opacity: 0;
	overflow: hidden;
	transform: translateY(10rpx);
	transition: max-height 0.34s cubic-bezier(0.2, 0.9, 0.2, 1), opacity 0.18s ease, transform 0.34s cubic-bezier(0.2, 0.9, 0.2, 1);
	pointer-events: none;
	will-change: max-height, opacity, transform;
	backface-visibility: hidden;
	transform: translateY(10rpx) translateZ(0);
}
.mode-panel {
	opacity: 1;
	transform: translateY(0);
	pointer-events: auto;
}
.mode-area.mode-code .code-wrap {
	max-height: 420rpx;
	opacity: 1;
	transform: translateY(0);
	pointer-events: auto;
}
.mode-area.mode-pwd .pwd-wrap {
	max-height: 220rpx;
	opacity: 1;
	transform: translateY(0);
	pointer-events: auto;
}

.reveal {
	margin-top: 0;
	max-height: 0;
	opacity: 0;
	overflow: hidden;
	transform: translateY(-8rpx);
	transition: max-height 0.36s ease, opacity 0.22s ease, transform 0.32s ease, margin-top 0.22s ease;
}
.reveal.show {
	margin-top: 18rpx;
	max-height: 300rpx;
	opacity: 1;
	transform: translateY(0);
}
.hidden-code-input {
	position: fixed;
	opacity: 0;
	width: 1px;
	height: 1px;
	left: -9999px;
	top: -9999px;
}
.seg-code {
	display: grid;
	grid-template-columns: repeat(6, 1fr);
	gap: 12rpx;
}
.cell {
	height: 96rpx;
	border-radius: 18rpx;
	border: 2rpx solid rgba(17, 24, 39, 0.1);
	background: rgba(255, 255, 255, 0.92);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 32rpx;
	font-weight: 900;
	color: #111827;
}
.cell.filled {
	border-color: rgba(37, 99, 235, 0.22);
}
.cell.caret {
	border-color: rgba(37, 99, 235, 0.35);
	box-shadow: 0 0 0 6rpx rgba(99, 179, 255, 0.16) inset;
}

.agree-row {
	margin-top: 18rpx;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
	padding: 18rpx;
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.72);
	border: 2rpx solid rgba(17, 24, 39, 0.06);
}
.agree-left {
	flex: 1;
	min-width: 0;
}
.agree-title {
	font-size: 24rpx;
	font-weight: 900;
	color: #111827;
	margin-bottom: 6rpx;
}
.agree-desc {
	font-size: 24rpx;
	color: #6b7280;
	line-height: 1.3;
}
.agree-link {
	color: #2563eb;
	font-weight: 900;
}
.switch {
	width: 92rpx;
	height: 56rpx;
	border-radius: 999rpx;
	background: rgba(17, 24, 39, 0.12);
	border: 2rpx solid rgba(17, 24, 39, 0.1);
	position: relative;
	margin-top: 4rpx;
}
.switch.on {
	background: rgba(7, 193, 96, 0.28);
	/* 原型：开启态外侧有柔和高光圈 */
	box-shadow: 0 0 0 8rpx rgba(7, 193, 96, 0.14);
}
.knob {
	width: 44rpx;
	height: 44rpx;
	border-radius: 50%;
	background: #fff;
	position: absolute;
	top: 50%;
	left: 6rpx;
	transform: translateY(-50%);
	box-shadow: 0 10rpx 18rpx rgba(15, 23, 42, 0.18);
	transition: transform 0.18s ease;
}
.switch.on .knob {
	transform: translate(36rpx, -50%);
}

.divider {
	height: 2rpx;
	background: rgba(17, 24, 39, 0.1);
	margin: 22rpx 0;
}
.actions {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	width: 100%;
	margin-top: 14rpx;
}
.primary {
	height: 104rpx;
	border-radius: 999rpx;
	/* 原型：更克制的描边 */
	border: 2rpx solid rgba(255, 255, 255, 0.55);
	font-weight: 900;
	color: #0b1220;
	background: linear-gradient(135deg, rgba(99, 179, 255, 0.96), rgba(255, 119, 179, 0.94));
	box-shadow:
		0 22rpx 50rpx rgba(99, 179, 255, 0.18),
		0 22rpx 50rpx rgba(255, 119, 179, 0.14),
		0 8rpx 18rpx rgba(15, 23, 42, 0.1);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	transition: transform 0.12s ease, filter 0.12s ease, box-shadow 0.16s ease;
	position: relative;
	overflow: hidden;
	text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35);
	padding: 0 34rpx;
	/* 对齐原型：按钮更克制，不要看起来像居中大块 */
	min-width: 320rpx;
	width: auto;
	margin-left: auto;
	box-sizing: border-box;
}
.primary::before {
	content: '';
	position: absolute;
	inset: -60% -40%;
	background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.65), transparent 55%),
		radial-gradient(circle at 70% 20%, rgba(255, 255, 255, 0.35), transparent 55%);
	transform: rotate(18deg);
	opacity: 0.55;
	pointer-events: none;
}
.primary::after {
	content: '';
	position: absolute;
	/* 原型：内高光更细 */
	inset: 1px;
	border-radius: 999rpx;
	box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.55);
	pointer-events: none;
}
.primary:active {
	transform: translateY(2rpx) scale(0.99);
	filter: brightness(0.98);
	box-shadow:
		0 16rpx 38rpx rgba(99, 179, 255, 0.16),
		0 16rpx 38rpx rgba(255, 119, 179, 0.12),
		0 6rpx 14rpx rgba(15, 23, 42, 0.1);
}
.primary:disabled,
.primary[disabled] {
	cursor: not-allowed;
	filter: grayscale(0.15);
	opacity: 0.62;
	box-shadow: 0 10rpx 22rpx rgba(15, 23, 42, 0.1);
	background: linear-gradient(135deg, rgba(148, 163, 184, 0.55), rgba(203, 213, 225, 0.55));
}
.primary:disabled {
	opacity: 0.62;
	background: linear-gradient(135deg, rgba(148, 163, 184, 0.55), rgba(203, 213, 225, 0.55));
}
.btn-title {
	font-size: 30rpx;
	font-weight: 950;
}

/* 底部区域不再强制贴底，避免小屏“被挤出屏幕” */
.bottom-actions {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
	padding: 0;
	width: 100%;
	max-width: 680rpx;
	margin-left: auto;
	margin-right: auto;
	box-sizing: border-box;
}
.bottom-actions.enter {
	animation: bottom-enter 0.4s ease both;
}
@keyframes bottom-enter {
	from {
		opacity: 0;
		transform: translateY(12rpx);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
.wechat {
	height: 104rpx;
	border-radius: 999rpx;
	border: 2rpx solid rgba(255, 255, 255, 0.55);
	font-weight: 900;
	color: #fff;
	background: #07c160;
	box-shadow: 0 18rpx 34rpx rgba(7, 193, 96, 0.18), 0 8rpx 18rpx rgba(15, 23, 42, 0.08);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	width: 100%;
	position: relative;
	overflow: hidden;
	padding: 0 20rpx;
	transition: transform 0.12s ease, filter 0.12s ease;
	box-sizing: border-box;
}
.wechat:active {
	transform: scale(0.99);
	filter: brightness(0.98);
}
.wechat::before {
	content: '';
	position: absolute;
	inset: -60% -40%;
	background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.26), transparent 55%);
	transform: rotate(18deg);
	opacity: 0.45;
	pointer-events: none;
}
.wechat .dot {
	width: 18rpx;
	height: 18rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.85);
	box-shadow: 0 0 0 10rpx rgba(255, 255, 255, 0.1);
}

/* 重置页骨架（沿用原页面） */
.skeleton {
	height: 96rpx;
	border-radius: 20rpx;
	background: linear-gradient(90deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.55));
	background-size: 180% 100%;
	border: 2rpx solid rgba(17, 24, 39, 0.06);
	animation: shimmer 1.05s ease-in-out infinite;
}
@keyframes shimmer {
	0% {
		background-position: 0% 0;
	}
	100% {
		background-position: 180% 0;
	}
}
.skeleton-row {
	display: grid;
	grid-template-columns: repeat(6, 1fr);
	gap: 12rpx;
}
.skeleton-cell {
	height: 96rpx;
	border-radius: 18rpx;
	background: rgba(255, 255, 255, 0.55);
	border: 2rpx solid rgba(17, 24, 39, 0.04);
}

/* 自定义协议弹窗（参考原型） */
.modal-mask {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	width: 100vw;
	background: rgba(15, 23, 42, 0.38);
	backdrop-filter: blur(8px);
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.18s ease;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding: 24rpx;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	z-index: 2000;
	box-sizing: border-box;
}
.modal-mask.show {
	opacity: 1;
	pointer-events: auto;
}
.modal {
	width: 100%;
	max-width: 680rpx;
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.92);
	border: 2rpx solid rgba(255, 255, 255, 0.85);
	box-shadow: 0 18rpx 46rpx rgba(15, 23, 42, 0.18);
	transform: translateY(14rpx);
	opacity: 0;
	transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.2, 1), opacity 0.18s ease;
	overflow: hidden;
	margin-left: auto;
	margin-right: auto;
	box-sizing: border-box;
}
.modal-mask.show .modal {
	transform: translateY(0);
	opacity: 1;
}
.modal-body {
	padding: 28rpx 28rpx 18rpx 28rpx;
}
.modal-title {
	font-size: 32rpx;
	font-weight: 900;
	color: #111827;
}
.modal-text {
	margin-top: 14rpx;
	font-size: 26rpx;
	color: #374151;
	line-height: 1.5;
}
.modal-actions {
	display: flex;
	gap: 18rpx;
	padding: 18rpx;
	border-top: 2rpx solid rgba(17, 24, 39, 0.08);
}
.modal-btn {
	flex: 1;
	height: 88rpx;
	border-radius: 999rpx;
	border: 2rpx solid rgba(17, 24, 39, 0.1);
	background: rgba(255, 255, 255, 0.72);
	font-weight: 900;
	color: #111827;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}
.modal-btn.primary {
	border: 0;
	background: linear-gradient(135deg, rgba(99, 179, 255, 0.92), rgba(255, 119, 179, 0.92));
	color: #0b1220;
}
</style>


