<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="card gradient-card">
			<view class="card-title">基础资料修改</view>
			<view class="row">
				<view class="label">头像</view>
				<view class="value">
					<!-- #ifdef MP-WEIXIN -->
					<view class="avatar-wrap">
						<image class="avatar" :src="avatarPreview || defaultAvatar" mode="aspectFill" />
						<button class="avatar-btn-abs" open-type="chooseAvatar" hover-class="none" @chooseavatar="onChooseWeixinAvatar" />
					</view>
					<!-- #endif -->
					<!-- #ifdef H5 -->
					<image class="avatar" :src="avatarPreview || defaultAvatar" mode="aspectFill" @tap="onTapAvatar" />
					<!-- #endif -->
				</view>
			</view>

			<view class="row">
				<view class="label">昵称</view>
				<view class="value nickname-wrap">
					<input type="nickname" class="nick-input" placeholder="请输入昵称" :value="nickname" @input="onNickInput" @blur="onNickBlur" />
				</view>
			</view>

			<view class="row">
				<view class="label">手机号</view>
				<view class="value phone-row">
					<text class="phone-text">{{ pendingPhone || currentPhone || '未绑定' }}</text>
					<!-- #ifdef MP-WEIXIN -->
					<button class="phone-btn" open-type="getRealtimePhoneNumber" @getrealtimephonenumber="onGetRealtimePhoneNumber">选择手机号</button>
					<!-- #endif -->
					<!-- #ifdef H5 -->
					<view class="phone-btn h5" @tap="openH5PhoneDialog">修改手机号</view>
					<!-- #endif -->
				</view>
			</view>
		</view>

		<!-- 底部保存按钮 -->
		<view class="footer" :style="{ bottom: (bottomInsetPx + 24) + 'px' }">
			<view class="save-btn" @tap="saveChanges">保存</view>
		</view>


		<!-- 头像操作弹层（仅 H5 使用） -->
		<!-- #ifdef H5 -->
		<view v-if="showAvatarSheet" class="avatar-sheet">
			<view class="dialog-mask" @tap="closeAvatarSheet" />
			<view class="sheet-panel">
				<view class="sheet-item" @tap="onSheetPickAlbum">从相册选择</view>
				<view class="sheet-item" @tap="onSheetTakePhoto">拍照</view>
				<view class="sheet-cancel" @tap="closeAvatarSheet">取消</view>
			</view>
		</view>
		<!-- #endif -->

		<!-- H5 更换手机号弹层 -->
		<!-- #ifdef H5 -->
		<view v-if="showH5PhoneDialog" class="h5-phone-dialog">
			<view class="dialog-mask" @tap="closeH5PhoneDialog" />
			<view class="dialog-panel">
				<view class="dialog-title">更换手机号</view>
				<view class="form-item">
					<view class="form-label">新手机号</view>
					<input class="form-input" type="number" maxlength="11" placeholder="请输入新的手机号" :value="h5NewPhone" @input="onH5NewPhoneInput" />
				</view>
				<view class="form-item code-row">
					<view class="form-label">验证码</view>
					<input class="form-input" type="number" maxlength="6" placeholder="请输入验证码" :value="h5Code" @input="onH5CodeInput" />
					<view class="code-btn" :class="{ disabled: sendingCode || cd>0 }" @tap="sendH5Code">{{ cd>0 ? cd+'s' : '发送验证码' }}</view>
				</view>
				<view class="dialog-actions">
					<view class="action-cancel" @tap="closeH5PhoneDialog">取消</view>
					<view class="action-ok" @tap="confirmH5PhoneChange">确认更换</view>
				</view>
			</view>
		</view>
		<!-- #endif -->
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import createHttpClient from '@wash/shared-utils/src/http';
import { API_BASE } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';

// 声明 uni
declare const uni: any;
declare function getCurrentPages(): any[];

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => uni.getStorageSync('token') });
const { topSpacerHeight, statusBarHeight } = useSafeArea();
const bottomInsetPx = ref(0);

const defaultAvatar = `${API_BASE}/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png`;
const user = ref<any>({});
const avatarPreview = ref<string>('');
const nickname = ref<string>('');
const currentPhone = ref<string>('');
const pendingPhone = ref<string>('');
const showAvatarSheet = ref(false);
// #ifdef H5
const showH5PhoneDialog = ref(false);
const h5NewPhone = ref('');
const h5Code = ref('');
const cd = ref(0);
let cdTimer: any = null;
const sendingCode = ref(false);
// #endif

function toAbs(u?: string){ if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; if (u.startsWith('/')) return API_BASE + u; return API_BASE + '/' + u; }

onMounted(() => {
	try {
		const u = uni.getStorageSync('user') || {};
		user.value = u;
		nickname.value = u?.name || '';
		avatarPreview.value = toAbs(u?.avatarUrl) || '';
		currentPhone.value = u?.phone || '';
	} catch {}
    try {
        // #ifdef MP-WEIXIN
        const sys = uni.getSystemInfoSync?.() || {};
        const screenH = Number(sys.screenHeight || 0);
        const safeBottom = Number(sys.safeArea?.bottom || 0);
        bottomInsetPx.value = screenH && safeBottom ? Math.max(0, screenH - safeBottom) : 0;
        // #endif
        // #ifdef H5
        bottomInsetPx.value = (function readH5SafeAreaInsetBottomPx(){
            try {
                const probe = document.createElement('div');
                probe.style.position = 'absolute';
                probe.style.bottom = '0';
                probe.style.height = 'constant(safe-area-inset-bottom)';
                probe.style.height = 'env(safe-area-inset-bottom)';
                probe.style.width = '0';
                probe.style.padding = '0';
                probe.style.margin = '0';
                probe.style.visibility = 'hidden';
                probe.style.pointerEvents = 'none';
                document.body.appendChild(probe);
                const h = probe.getBoundingClientRect().height || 0;
                document.body.removeChild(probe);
                return Math.max(0, Math.round(h));
            } catch { return 0; }
        })();
        // #endif
    } catch {}
});

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/me/index' });
	} catch { uni.reLaunch({ url: '/pages/me/index' }); }
}

function onTapAvatar(){
	showAvatarSheet.value = true;
}

function closeAvatarSheet(){ showAvatarSheet.value = false; }
function onSheetPickAlbum(){ closeAvatarSheet(); pickFromAlbum(); }
function onSheetTakePhoto(){ closeAvatarSheet(); takePhoto(); }

// 微信头像选择
function onChooseWeixinAvatar(e: any) {
	const tempUrl = e?.detail?.avatarUrl as string | undefined;
	if (!tempUrl) return;
	// 将临时文件上传到后端
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
				avatarPreview.value = toAbs(url);
				// 立即更新后端头像
				await http(`/member/${user.value?.id}`, { method: 'PUT', body: { avatarUrl: url } as any });
				try { const u = uni.getStorageSync('user') || {}; u.avatarUrl = url; uni.setStorageSync('user', u); } catch {}
				uni.showToast({ title: '头像已更新', icon: 'success' });
				closeAvatarSheet();
			} catch (e:any) {
				uni.showToast({ title: e?.message?.slice(0,30) || '保存失败', icon: 'none' });
			}
		},
		fail: ()=> uni.showToast({ title:'上传失败', icon:'none' })
	});
}

function pickFromAlbum(){
	uni.chooseImage({ count:1, sizeType:['compressed'], sourceType:['album'], success: onChooseLocalImage });
}
function takePhoto(){
	uni.chooseImage({ count:1, sizeType:['compressed'], sourceType:['camera'], success: onChooseLocalImage });
}
function onChooseLocalImage(r: any){
	const path = r?.tempFilePaths?.[0]; if (!path) return;
	uni.uploadFile({
		url: `${API_BASE}/file/upload`,
		filePath: path,
		name: 'file',
		formData: { dir: 'miniapp' },
		header: { Authorization: `Bearer ${uni.getStorageSync('token')||''}` },
		success: async (resUp:any)=>{
			try {
				const data = JSON.parse(resUp.data||'{}');
				const url = data?.url || '';
				if (!url) { uni.showToast({ title:'上传失败', icon:'none' }); return; }
				avatarPreview.value = toAbs(url);
				await http(`/member/${user.value?.id}`, { method: 'PUT', body: { avatarUrl: url } as any });
				try { const u = uni.getStorageSync('user') || {}; u.avatarUrl = url; uni.setStorageSync('user', u); } catch {}
				uni.showToast({ title: '头像已更新', icon: 'success' });
			} catch (e:any) { uni.showToast({ title: e?.message?.slice(0,30) || '保存失败', icon: 'none' }); }
		},
		fail: ()=> uni.showToast({ title:'选择失败', icon:'none' })
	});
}

function onNickBlur(){
	// 微信在 onBlur 进行内容安全校验，若失败会被清空，这里无需额外处理
}

// 实时手机号能力回调
async function onGetRealtimePhoneNumber(e: any){
	// 兼容：真机返回 detail.code，开发工具可能直接给 phone_info/phoneNumber
	let phone: string | undefined = e?.detail?.phoneNumber || e?.detail?.phone_info?.phoneNumber;
	const code = e?.detail?.code;
	if (!phone && code) {
		try {
			const r = await http<{ phone: string }>('/auth/wechat/resolve-phone', { method: 'POST', body: { code } as any });
			phone = (r as any)?.phone || '';
		} catch (err:any) {
			uni.showToast({ title: err?.message?.slice(0,30) || '手机号解析失败', icon: 'none' });
			return;
		}
	}
	if (!phone) { uni.showToast({ title: '未获取到手机号', icon: 'none' }); return; }
	// 一致性校验
	if (String(phone) === String(currentPhone.value || '')) { uni.showToast({ title: '新旧手机号一致，请重新选择', icon: 'none' }); return; }
	// 唯一性校验（后端）
	try {
		const exists = await http<boolean>('/member/list', { method: 'GET', query: { keyword: phone, page: 1, pageSize: 1 } }) as any;
		const occupied = Array.isArray((exists as any)?.items) && (exists as any).items.some((m:any)=> String(m?.phone)===String(phone));
		if (occupied) { uni.showToast({ title: '该手机号已被其他账号绑定', icon: 'none' }); return; }
		pendingPhone.value = phone;
		uni.showToast({ title: `已选择：${phone}`, icon: 'none' });
	} catch (err:any) {
		uni.showToast({ title: err?.message?.slice(0,30) || '校验失败', icon: 'none' });
	}
}

// #ifdef H5
function openH5PhoneDialog(){ showH5PhoneDialog.value = true; }
function closeH5PhoneDialog(){ showH5PhoneDialog.value = false; clearInterval(cdTimer); cd.value = 0; sendingCode.value = false; }
function validPhone(p?: string){ return /^1\d{10}$/.test(String(p||'')); }
async function sendH5Code(){
	if (cd.value > 0 || sendingCode.value) return;
	const phone = String(h5NewPhone.value||'').trim();
	if (!validPhone(phone)) { uni.showToast({ title: '请输入有效手机号', icon: 'none' }); return; }
	// 一致性校验
	if (String(phone) === String(currentPhone.value||'')) { uni.showToast({ title: '新旧手机号一致', icon: 'none' }); return; }
	// 唯一性校验
	try {
		const exists = await http<any>('/member/list', { method: 'GET', query: { keyword: phone, page: 1, pageSize: 1 } });
		const occupied = Array.isArray(exists?.items) && exists.items.some((m:any)=> String(m?.phone)===String(phone));
		if (occupied) { uni.showToast({ title: '该手机号已被其他账号绑定', icon: 'none' }); return; }
	} catch {}
	try {
		sendingCode.value = true;
		await http('/auth/send-code', { method: 'POST', body: { phone, purpose: 'changePhone' } as any });
		uni.showToast({ title: '验证码已发送', icon: 'none' });
		cd.value = 60;
		cdTimer = setInterval(()=>{ cd.value = Math.max(0, cd.value - 1); if (cd.value === 0) { clearInterval(cdTimer); } }, 1000);
	} catch (e:any) { uni.showToast({ title: e?.message?.slice(0,30) || '发送失败', icon: 'none' }); }
	finally { sendingCode.value = false; }
}
async function confirmH5PhoneChange(){
	const phone = String(h5NewPhone.value||'').trim();
	if (!validPhone(phone)) { uni.showToast({ title: '请输入有效手机号', icon: 'none' }); return; }
	if (!h5Code.value) { uni.showToast({ title: '请填写验证码', icon: 'none' }); return; }
	// 与微信端一致：一致性/占用校验
	if (String(phone) === String(currentPhone.value||'')) { uni.showToast({ title: '新旧手机号一致', icon: 'none' }); return; }
	try {
		const exists = await http<any>('/member/list', { method: 'GET', query: { keyword: phone, page: 1, pageSize: 1 } });
		const occupied = Array.isArray(exists?.items) && exists.items.some((m:any)=> String(m?.phone)===String(phone));
		if (occupied) { uni.showToast({ title: '该手机号已被其他账号绑定', icon: 'none' }); return; }
		// 使用后端 changePhone purpose 的验证码进行更换
		await http('/auth/change-phone', { method: 'POST', body: { oldPhone: currentPhone.value, newPhone: phone, code: h5Code.value } as any });
		const updated = await http('/member/me/profile', { method: 'GET' });
		uni.setStorageSync('user', updated);
		currentPhone.value = (updated as any)?.phone || phone;
		closeH5PhoneDialog();
		uni.showToast({ title: '手机号已更新', icon: 'success' });
	} catch (e:any) { uni.showToast({ title: e?.message?.slice(0,30) || '更新失败', icon: 'none' }); }
}
// #endif

async function saveChanges(){
	try {
		const body: any = {};
		if (nickname.value && nickname.value !== user.value?.name) body.name = nickname.value;
		if (pendingPhone.value) body.phone = pendingPhone.value;
		if (Object.keys(body).length === 0) { uni.showToast({ title: '没有修改项', icon: 'none' }); return; }
		await http(`/member/${user.value?.id}`, { method: 'PUT', body: body as any });
		const updated = await http('/member/me/profile', { method:'GET' });
		uni.setStorageSync('user', updated);
		currentPhone.value = (updated as any)?.phone || currentPhone.value;
		uni.showToast({ title: '保存成功', icon: 'success' });
		setTimeout(()=>{ try { uni.navigateBack(); } catch {} }, 400);
	} catch (e:any) {
		uni.showToast({ title: e?.message?.slice(0,30) || '保存失败', icon: 'none' });
	}
}

// 输入事件：避免 $event.detail 类型报错
function onNickInput(e: any){ nickname.value = e?.detail?.value || ''; }
// #ifdef H5
function onH5NewPhoneInput(e: any){ h5NewPhone.value = e?.detail?.value || ''; }
function onH5CodeInput(e: any){ h5Code.value = e?.detail?.value || ''; }
// #endif
</script>

<style>
.page {
	min-height: 100vh;
	padding: 24rpx 24rpx 0 24rpx;
	background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%);
	box-sizing: border-box;
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
}
.card { background:#fff; border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); }
.gradient-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.card-title { font-size: 28rpx; font-weight: 600; color: #2b2f36; margin: 4rpx 8rpx 8rpx 8rpx; }
.row { display:flex; align-items:center; justify-content: space-between; padding: 22rpx 8rpx; border-bottom: 2rpx dashed #eef2ff; }
.row:last-child { border-bottom: none; }
.label { color:#2b2f36; font-size: 28rpx; width: 180rpx; font-weight: 600; }
.value { flex:1; display:flex; align-items:center; gap: 16rpx; justify-content: flex-end; }
.value .avatar-btn, .value .avatar { border: none; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: linear-gradient(135deg, #a8d8ff, #ffc9de); box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.08); display:block; border: none; }
.avatar-btn { padding: 0; margin: 0; background: transparent; border: none; line-height: 0; display: inline-block; border-radius: 50%; outline: none; box-shadow: none; -webkit-tap-highlight-color: rgba(0,0,0,0); overflow: visible; }
.avatar-btn::after, .avatar-btn:after { border: none; border-width: 0; content: none; }
.avatar-wrap { position: relative; width: 120rpx; height: 120rpx; }
.avatar-btn-abs { position: absolute; inset: 0; background: transparent; border: none; opacity: 0; }
.avatar-btn-abs::after, .avatar-btn-abs:after { border: none; border-width: 0; content: none; }
.nick-input { flex:1; background:#ffffff; border-radius: 12rpx; padding: 12rpx 16rpx; min-height: 64rpx; border: 2rpx solid #eef2ff; font-size: 26rpx; }
.nickname-wrap { gap: 12rpx; }
.phone-row { gap: 12rpx; }
.phone-text { font-size: 32rpx; color:#111827; font-weight: 700; letter-spacing: 1rpx; }
.phone-btn { padding: 12rpx 22rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); border-radius: 999rpx; font-size: 24rpx; color:#0b1220; box-shadow: 0 6rpx 16rpx rgba(0,0,0,0.08); }

/* 底部保存按钮 */
.footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 12rpx 24rpx; background: transparent; box-sizing: border-box; }
.save-btn { text-align:center; padding: 24rpx 0; border-radius: 16rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); color:#0b1220; font-weight: 700; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); }

/* 返回按钮 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }

/* 头像选择弹层 */
.wx-avatar-dialog { position: fixed; inset: 0; z-index: 2000; }
.dialog-mask { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
.dialog-panel { position: absolute; left: 0; right: 0; bottom: 0; background: #fff; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx; padding: 24rpx; }
.dialog-title { font-size: 28rpx; color:#111827; font-weight: 700; margin-bottom: 12rpx; }
.dialog-cancel { text-align:center; padding: 18rpx 0; color:#6b7280; }

/* H5 手机号弹层 */
.h5-phone-dialog { position: fixed; inset: 0; z-index: 2100; }
.form-item { display:flex; align-items:center; gap: 12rpx; margin-top: 12rpx; }
.form-label { width: 160rpx; color:#374151; font-size: 26rpx; }
.form-input { flex:1; background:#f7f8fa; border-radius: 12rpx; padding: 14rpx 16rpx; border: 2rpx solid #eef2ff; font-size: 28rpx; }
.code-row { align-items: center; }
.code-btn { padding: 12rpx 16rpx; border-radius: 12rpx; background:#f7fbff; border: 2rpx dashed #77bfff; color:#1f2937; }
.code-btn.disabled { opacity: .6; }
.dialog-actions { margin-top: 16rpx; display:flex; align-items:center; justify-content:flex-end; gap: 12rpx; }
.action-cancel { padding: 12rpx 18rpx; border-radius: 12rpx; background:#f3f4f6; color:#374151; }
.action-ok { padding: 12rpx 18rpx; border-radius: 12rpx; background:#2563eb; color:#fff; }

/* 头像操作底部弹层样式 */
.avatar-sheet { position: fixed; inset: 0; z-index: 2200; }
.sheet-panel { position: absolute; left: 0; right: 0; bottom: 0; background: #fff; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx; padding: 12rpx; }
.sheet-item { text-align:center; padding: 24rpx 0; border-bottom: 2rpx solid #f3f4f6; font-size: 28rpx; color:#111827; }
.sheet-item:last-child { border-bottom: none; }
.sheet-item.wx { background:#f7fbff; border-radius: 12rpx; margin: 8rpx; border: none; }
.sheet-cancel { text-align:center; padding: 22rpx 0; color:#6b7280; }
</style>


