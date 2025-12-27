<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="card login-card">
			<view class="title">修改密码</view>
			<view class="row"><input class="input" type="number" maxlength="11" v-model="phone" placeholder="手机号" /></view>
			<view class="row">
				<input class="input" type="number" maxlength="6" v-model="code" placeholder="短信验证码" />
				<view class="btn ghost" @tap="onSendCode">{{ countdown>0 ? `${countdown}s` : '获取验证码' }}</view>
			</view>
			<view class="row"><input class="input" :password="true" v-model="pwd" placeholder="新密码(>=6位)" /></view>
			<view class="row"><input class="input" :password="true" v-model="pwd2" placeholder="确认新密码" /></view>
			<view class="submit" @tap="onSubmit">提交</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { authControllerResetPassword, authControllerSendLoginCode } from '@wash/api-client';

declare const uni: any;

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const phone = ref('');
const code = ref('');
const pwd = ref('');
const pwd2 = ref('');
const countdown = ref(0);

function goBack(){
	try { uni.navigateBack(); } catch {}
}

async function onSendCode(){
	if (!/^\d{11}$/.test(phone.value)) { uni.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
	if (countdown.value > 0) return;
	try {
		await authControllerSendLoginCode({ phone: phone.value, purpose: 'resetPwd' } as any);
		uni.showToast({ title: '验证码已发送', icon: 'success' });
		countdown.value = 60;
		const timer = setInterval(()=>{
			countdown.value -= 1; if (countdown.value <= 0) clearInterval(timer);
		}, 1000);
	} catch (e:any) {
		uni.showToast({ title: e?.message?.slice(0,30) || '发送失败', icon: 'none' });
	}
}

async function onSubmit(){
	if (!/^\d{11}$/.test(phone.value)) { uni.showToast({ title: '请输入正确手机号', icon: 'none' }); return; }
	if (!/^\d{6}$/.test(code.value)) { uni.showToast({ title: '请输入6位验证码', icon: 'none' }); return; }
	if (!pwd.value || pwd.value.length < 6) { uni.showToast({ title: '新密码至少6位', icon: 'none' }); return; }
	if (pwd.value !== pwd2.value) { uni.showToast({ title: '两次密码不一致', icon: 'none' }); return; }
	try {
		await authControllerResetPassword({ phone: phone.value, code: code.value, newPassword: pwd.value } as any);
		uni.showToast({ title: '修改成功', icon: 'success' });
		setTimeout(()=>{ try { uni.navigateBack(); } catch {} }, 400);
	} catch (e:any) {
		uni.showToast({ title: e?.message?.slice(0,30) || '修改失败', icon: 'none' });
	}
}
</script>

<style>
.page { min-height:100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff, #fff0f6); }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.login-card { padding: 32rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); }
.title { font-size: 32rpx; font-weight: 700; margin-bottom: 12rpx; }
.row { display:flex; align-items:center; gap: 16rpx; margin-bottom: 16rpx; }
.input { flex:1; height: 80rpx; border-radius: 20rpx; background: rgba(255,255,255,.85); border:2rpx solid #e5e7eb; padding: 0 20rpx; box-shadow: inset 0 2rpx 8rpx rgba(0,0,0,0.04); }
.btn.ghost { padding: 14rpx 20rpx; border-radius: 999rpx; border:2rpx solid #e5e7eb; background: rgba(255,255,255,.92); box-shadow: 0 6rpx 16rpx rgba(0,0,0,.06); }
.submit { margin-top: 16rpx; text-align:center; padding: 22rpx 0; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08); color:#0b1220; font-weight: 600; }
.card { background:#fff; border-radius:24rpx; box-shadow:0 8rpx 24rpx rgba(0,0,0,0.06); }
</style>


