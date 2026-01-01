<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="card">
			<view class="header">
				<text class="title">{{ card?.name || '洗车计次卡' }}</text>
				<view v-if="card?._shared" class="share-badge">
					<text class="share">共享</text>
				</view>
			</view>
			<view class="meta">
				<text>总次数：{{ card?.totalTimes ?? '-' }}</text>
				<text>剩余：{{ card?.remainingTimes ?? '-' }}</text>
				<text>有效期：{{ expiryText || '永久' }}</text>
			</view>
			<view class="meta sub"><text>卡号：{{ card?.cardNo || '-' }}</text></view>
			<view class="progress"><view class="progress-inner" :style="{ width: usedPercent + '%' }" /></view>
			<view v-if="card?._shared && card?.owner" class="owner-row">
				<text class="owner">共享人：{{ card.owner?.name || '会员' }}（{{ card.owner?.phone }}）</text>
			</view>
			<view class="sub-card" :class="{ disabled: !wxappEnabled }">
				<view class="sub-left">
					<text class="sub-title">次卡消费微信通知</text>
					<text class="sub-desc">{{ wxappStatusDesc }}</text>
				</view>
				<view class="sub-right">
					<view class="sub-badge" :class="wxappBadgeClass">{{ wxappStatusLabel }}</view>
					<button class="sub-btn" :disabled="!wxappEnabled || wxappLoading" @tap="onSubscribeWxapp">
						<text v-if="wxappLoading">加载中</text>
						<text v-else>{{ wxappActionLabel }}</text>
					</button>
				</view>
			</view>
		</view>
		<view class="card">
			<view class="subhead">使用与共享记录</view>
			<view v-if="logs.length === 0" class="empty">暂无记录</view>
			<view v-else class="log-timeline">
				<view v-for="l in logs" :key="l.id" class="log-node" :class="nodeClass(l)">
					<view class="log-axis">
						<view class="log-dot" />
						<view class="log-line" />
					</view>
					<view class="log-body">
						<view class="log-title-row">
							<text class="log-title">{{ logTitle(l) }}</text>
							<text class="log-time">{{ formatTime(l.createdAt) }}</text>
						</view>
						<view class="log-subrow">
							<text class="chip">{{ reasonText(l.reason) }}</text>
							<text v-if="l.action!=='SHARE'" class="muted">变更 {{ changeText(l) }} · 余 {{ l.beforeRemaining }}→{{ l.afterRemaining }}</text>
							<text v-else-if="l.member" class="muted">对象：{{ l.member?.name || '会员' }}（{{ l.member?.phone }}）</text>
						</view>
						<view v-if="((l.reason==='PURCHASE_ADD' && l.purchaseOrderId) || (l.reason==='REFUND_DEDUCT' && l.purchaseOrderId) || l.serviceOrderId)" class="log-actions">
							<text v-if="(l.reason==='PURCHASE_ADD' && l.purchaseOrderId) || (l.reason==='REFUND_DEDUCT' && l.purchaseOrderId)" class="link" @tap="gotoOrder(l.purchaseOrderId)">查看订单详情 ›</text>
							<text v-else-if="l.serviceOrderId" class="link" @tap="gotoOrder(l.serviceOrderId)">服务订单详情 ›</text>
						</view>
						<view v-if="l.remark" class="log-remark">{{ renderRemark(l) }}</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { onShow } from '@dcloudio/uni-app';
import { API_BASE, getToken } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
import { washCardControllerMyGet, washCardControllerMyLogs } from '@wash/api-client';

// 对于 TS 编译环境下的全局 wx 声明（MP-微信）
declare const wx: any;

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const card = ref<any|null>(null);
const logs = ref<any[]>([]);
const isOwner = ref(false);

// WXAPP 订阅消息：次卡消费通知（由后台配置开关与 TemplateId）
const wxappEnabled = ref(false);
const wxappTemplateId = ref<string>('');
const wxappLoading = ref(false);
const wxappServerKnownStatus = ref<string>('');
const wxappClientStatus = ref<string>(''); // 来自 wx.getSetting 的 itemSettings

const wxappStatus = computed(()=> wxappClientStatus.value || wxappServerKnownStatus.value || '');
const wxappStatusLabel = computed(()=>{
	if (!wxappEnabled.value) return '未启用';
	const st = wxappStatus.value;
	if (!st) return '未订阅';
	if (st === 'reject') return '已拒绝';
	if (st === 'ban') return '已禁用';
	if (st === 'accept') return '已订阅';
	if (st === 'acceptWithAudio') return '已订阅(语音)';
	if (st === 'acceptWithAlert') return '已订阅(提醒)';
	return '未知';
});
const wxappBadgeClass = computed(()=>{
	if (!wxappEnabled.value) return 'off';
	const st = wxappStatus.value;
	if (st && st.startsWith('accept')) return 'on';
	if (st === 'reject' || st === 'ban') return 'warn';
	return 'off';
});
const wxappStatusDesc = computed(()=>{
	if (!wxappEnabled.value) return '该通知暂未开放';
	const st = wxappStatus.value;
	if (!st) return '未订阅，建议开启以接收扣次提醒';
	if (st && st.startsWith('accept')) return '已允许接收（通常仅对下一次发送生效）';
	if (st === 'reject') return '你已选择不接收，可再次尝试订阅';
	if (st === 'ban') return '被系统禁用（微信限制），可稍后再试';
	return '状态未知，可尝试重新订阅';
});
const wxappActionLabel = computed(()=>{
	if (!wxappEnabled.value) return '不可用';
	const st = wxappStatus.value;
	if (st && st.startsWith('accept')) return '重新订阅';
	return '订阅';
});

async function loadWxappClientStatus(){
	// #ifdef MP-WEIXIN
	try{
		const tid = String(wxappTemplateId.value||'').trim();
		if (!tid) { wxappClientStatus.value = ''; return; }
		const wxAny: any = (typeof wx !== 'undefined' ? (wx as any) : null);
		if (!wxAny?.getSetting) { wxappClientStatus.value = ''; return; }
		wxAny.getSetting({
			withSubscriptions: true,
			success: (r: any)=>{
				const st = String(r?.subscriptionsSetting?.itemSettings?.[tid] || '').trim();
				wxappClientStatus.value = st || '';
			},
			fail: ()=>{ wxappClientStatus.value = ''; },
		});
	}catch{ wxappClientStatus.value = ''; }
	// #endif
	// #ifndef MP-WEIXIN
	wxappClientStatus.value = '';
	// #endif
}

async function loadWxappTemplate(){
	const token = getToken();
	if (!token) { wxappEnabled.value = false; wxappTemplateId.value = ''; return; }
	wxappLoading.value = true;
	try{
		const res:any = await new Promise((resolve, reject)=>{
			uni.request({
				url: `${API_BASE}/notification/wxapp/template?typeKey=WASH_CARD_CONSUME`,
				method: 'GET',
				header: { Authorization: `Bearer ${token}` },
				success: (r:any)=> resolve(r?.data),
				fail: (e:any)=> reject(e),
			});
		});
		wxappEnabled.value = !!res?.enabled;
		wxappTemplateId.value = String(res?.templateId || '').trim();
		wxappServerKnownStatus.value = String(res?.serverKnownStatus || '').trim();
		await loadWxappClientStatus();
	}catch{
		wxappEnabled.value = false;
		wxappTemplateId.value = '';
		wxappServerKnownStatus.value = '';
		wxappClientStatus.value = '';
	} finally {
		wxappLoading.value = false;
	}
}

async function reportWxappSubscribe(status: string){
	const token = getToken();
	const templateId = String(wxappTemplateId.value||'').trim();
	if (!token || !templateId || !status) return;
	try{
		await new Promise((resolve)=>{
			uni.request({
				url: `${API_BASE}/notification/wxapp/subscribe-report`,
				method: 'POST',
				header: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				data: { templateId, status },
				success: ()=> resolve(true),
				fail: ()=> resolve(false),
			});
		});
	}catch{}
}

async function onSubscribeWxapp(){
	try{
		if (!wxappEnabled.value || !wxappTemplateId.value) {
			uni.showToast({ title: '消费通知未启用', icon: 'none' });
			return;
		}
		// 必须由用户手势触发
		const tid = String(wxappTemplateId.value).trim();
		if (!tid) return;
		// #ifdef MP-WEIXIN
		const wxAny: any = (typeof wx !== 'undefined' ? (wx as any) : null);
		if (!wxAny?.requestSubscribeMessage) {
			uni.showToast({ title: '当前环境不支持订阅消息', icon: 'none' });
			return;
		}
		wxAny.requestSubscribeMessage({
			tmplIds: [tid],
			success: async (r: any)=>{
				// r: { [templateId]: 'accept'|'reject'|'ban'|'acceptWithAudio'|'acceptWithAlert' }
				const st = String(r?.[tid] || '').trim();
				if (st) await reportWxappSubscribe(st);
				// 本地立即更新状态展示
				wxappServerKnownStatus.value = st || wxappServerKnownStatus.value;
				await loadWxappClientStatus();
				uni.showToast({ title: st && st.startsWith('accept') ? '订阅成功' : '已处理', icon: 'none' });
			},
			fail: async (_e: any)=>{
				// 用户取消或系统错误（不强制上报）
				uni.showToast({ title: '未完成订阅', icon: 'none' });
			},
		});
		// #endif
		// #ifndef MP-WEIXIN
		uni.showToast({ title: '仅微信小程序支持订阅消息', icon: 'none' });
		// #endif
	}catch{
		uni.showToast({ title: '订阅失败', icon: 'none' });
	}
}

const expiryText = computed(()=>{ try { const v = card.value?.expiryAt; if (!v) return ''; const d = new Date(v); if (isNaN(d.getTime())) return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; } catch { return ''; } });
const usedPercent = computed(()=>{ const total = Math.max(1, Number(card.value?.totalTimes||0)); const remain = Math.max(0, Number(card.value?.remainingTimes||0)); const used = Math.max(0, total - remain); return Math.max(0, Math.min(100, Math.round((used/total)*100))); });

function formatTime(v?: string){ if (!v) return ''; try { const d = new Date(v as any); if (isNaN(d.getTime())) return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; } catch { return ''; } }
function mapAction(a: string){ if (a === 'ADD') return '+ 次数变更'; if (a === 'DEDUCT') return '- 划扣使用'; return a; }

function logTitle(l: any){
    if (!l) return '';
    if (l.action === 'ADD') return `增加次数 ${changeText(l)}`;
    if (l.action === 'DEDUCT') return `划扣次数 ${changeText(l)}`;
    if (l.action === 'SHARE') {
        if (l.reason === 'SHARE_ADD') return '新增共享';
        if (l.reason === 'SHARE_REMOVE') return '移除共享';
        return '共享变更';
    }
    return String(l.action || '记录');
}

function reasonText(r?: string){
    switch(r){
        case 'BACKEND_ADD': return '后台增加';
        case 'PURCHASE_ADD': return '购买入账';
        case 'SERVICE_DEDUCT': return '服务划扣';
        case 'REFUND_DEDUCT': return '退款回退';
        case 'BACKEND_DEDUCT': return '后台划扣';
        case 'SHARE_ADD': return '新增共享';
        case 'SHARE_REMOVE': return '移除共享';
        default: return r || '';
    }
}

function changeText(l: any){ const c = Number(l?.change||0); return c>0?(`+${c}`):String(c); }

function nodeClass(l: any){
    if (!l) return '';
    if (l.action === 'ADD') return 'add';
    if (l.action === 'DEDUCT') return 'deduct';
    if (l.action === 'SHARE') return (l.reason === 'SHARE_ADD' ? 'share_add' : (l.reason === 'SHARE_REMOVE' ? 'share_remove' : 'share'));
    return '';
}

function gotoOrder(orderId: number){
    try { uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` }); } catch {}
}

function renderRemark(l: any){
	const raw = String(l?.remark || '');
	if (!raw) return '';
	// 优先使用后端返回的 operatorUser 信息替换“操作人#id”
	const name = String(l?.operatorUser?.name || '').trim();
	const phone = String(l?.operatorUser?.phone || '').trim();
	const best = name || phone;
	if (!best) return raw;
	return raw.replace(/操作人#\\d+/g, `操作人：${best}`);
}

onLoad(async (query)=>{
	try {
		const id = Number((query as any)?.id || NaN);
		if (!Number.isFinite(id)) { uni.showToast({ title: '参数错误', icon: 'none' }); return; }
		if (!getToken()) { try { uni.navigateTo({ url: '/pages/login/index' }); } catch {} return; }
		card.value = await washCardControllerMyGet(String(id), {} as any) as any;
		isOwner.value = !!card.value && card.value.ownerMemberId && typeof card.value._shared === 'undefined';
		const res = await washCardControllerMyLogs(String(id), { page: 1, pageSize: 20 } as any) as any;
		logs.value = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
		loadWxappTemplate();
	} catch { card.value = null; logs.value = []; }
});

onShow(async ()=>{
	try {
		const pages = getCurrentPages?.() || [];
		const cur: any = pages[pages.length - 1] || {};
		const id = Number(cur?.options?.id || NaN);
		if (!Number.isFinite(id)) return;
		if (!getToken()) return;
		card.value = await washCardControllerMyGet(String(id), {} as any) as any;
		isOwner.value = !!card.value && card.value.ownerMemberId && typeof card.value._shared === 'undefined';
		const res = await washCardControllerMyLogs(String(id), { page: 1, pageSize: 20 } as any) as any;
		logs.value = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
		loadWxappTemplate();
	} catch {}
});

function goBack(){
	try { uni.navigateBack(); } catch {}
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: #f7fafc; }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,.04); margin-bottom: 16rpx; }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 10rpx; }
.title { font-size: 30rpx; font-weight: 700; color:#111827; }
.share-badge { display:flex; align-items:center; }
.share { font-size: 22rpx; color: #065f46; background: #ecfdf5; border: 2rpx solid #86efac; padding: 4rpx 8rpx; border-radius: 999rpx; }
.meta { display:flex; gap: 16rpx; font-size: 24rpx; color: #374151; margin-bottom: 12rpx; }
.meta.sub { margin-top: -6rpx; margin-bottom: 8rpx; }
.owner-row { margin-top: 8rpx; display:flex; justify-content:flex-end; }
.owner { font-size: 22rpx; color:#334155; background:#f8fafc; border:2rpx dashed #e2e8f0; padding: 6rpx 10rpx; border-radius: 8rpx; }
.progress { width:100%; height: 16rpx; border-radius: 999rpx; background: #eef2ff; overflow:hidden; }
.progress-inner { height:100%; background: linear-gradient(90deg, #a8d8ff, #ffc9de); }

/* 订阅模块 */
.sub-card{
	margin-top: 16rpx;
	padding: 18rpx 16rpx;
	border-radius: 16rpx;
	background: linear-gradient(135deg, #eef2ff, #fdf2f8);
	border: 2rpx solid #e5e7eb;
	display:flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
}
.sub-card.disabled{
	background: #f8fafc;
	border-color: #e5e7eb;
}
.sub-left{ display:flex; flex-direction: column; gap: 6rpx; }
.sub-title{ font-size: 26rpx; font-weight: 700; color:#0f172a; }
.sub-desc{ font-size: 22rpx; color:#475569; }
.sub-right{ display:flex; flex-direction: column; align-items: flex-end; gap: 10rpx; }
.sub-badge{
	font-size: 20rpx;
	padding: 4rpx 10rpx;
	border-radius: 999rpx;
	border: 2rpx solid transparent;
}
.sub-badge.on{ background:#ecfdf5; color:#065f46; border-color:#86efac; }
.sub-badge.off{ background:#f1f5f9; color:#334155; border-color:#e2e8f0; }
.sub-badge.warn{ background:#fff7ed; color:#9a3412; border-color:#fdba74; }
.sub-btn{
	font-size: 24rpx;
	line-height: 1;
	padding: 12rpx 16rpx;
	border-radius: 999rpx;
	background: #111827;
	color:#fff;
}
.sub-card.disabled .sub-btn{ background:#e5e7eb; color:#6b7280; }
.sub-btn[disabled]{ background:#e5e7eb; color:#6b7280; }
.subhead { font-size: 26rpx; color:#111827; font-weight: 600; margin-bottom: 10rpx; }
.empty { font-size: 24rpx; color: #6b7280; padding: 10rpx 0; }
.log-timeline { position: relative; }
.log-node { display:flex; gap: 16rpx; padding: 16rpx 0; }
.log-axis { width: 24rpx; display:flex; flex-direction: column; align-items: center; }
.log-dot { width: 12rpx; height: 12rpx; border-radius: 999rpx; background: #94a3b8; margin-top: 6rpx; }
.log-line { flex:1; width: 2rpx; background: #e2e8f0; margin-top: 6rpx; }
.log-body { flex:1; border: 2rpx solid #eef2ff; border-radius: 12rpx; padding: 12rpx; background: #fafcff; }
.log-title-row { display:flex; align-items:center; justify-content: space-between; }
.log-title { font-size: 26rpx; color:#0f172a; font-weight: 600; }
.log-time { font-size: 22rpx; color:#94a3b8; }
.log-subrow { margin-top: 6rpx; display:flex; align-items:center; gap: 10rpx; }
.chip { font-size: 20rpx; color:#1e293b; background:#e2e8f0; padding: 2rpx 8rpx; border-radius: 999rpx; }
.muted { font-size: 22rpx; color:#64748b; }
.log-remark { margin-top: 8rpx; font-size: 22rpx; color:#334155; background:#f8fafc; border: 2rpx dashed #e2e8f0; border-radius: 8rpx; padding: 8rpx 10rpx; }
.log-actions { margin-top: 6rpx; }
.link { font-size: 22rpx; color: #2563eb; }

/* 状态色 */
.log-node.add .log-dot { background: #10b981; }
.log-node.deduct .log-dot { background: #ef4444; }
.log-node.share_add .log-dot { background: #3b82f6; }
.log-node.share_remove .log-dot { background: #f59e0b; }
</style>


