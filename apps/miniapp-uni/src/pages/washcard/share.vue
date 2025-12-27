<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="card">
			<view class="header">
				<text class="title">共享设置</text>
			</view>
			<view class="subtip">可添加共享用户手机号，对方可使用该卡</view>
			<view class="form-row">
				<input class="input" type="number" placeholder="输入对方手机号" v-model="phone" maxlength="11" />
				<view class="btn btn-primary" @tap="addShare">添加</view>
			</view>
			<view class="list-header">已共享用户</view>
			<view v-if="loading" class="empty">加载中...</view>
			<view v-else-if="shares.length===0" class="empty">暂无共享用户</view>
			<view v-else>
				<view class="share-item" v-for="s in shares" :key="s.memberId">
					<view class="info">
						<text class="name">{{ s.member?.name || '未命名' }}</text>
						<text class="phone">{{ s.member?.phone }}</text>
					</view>
					<view class="btn btn-danger" @tap="removeShare(s.memberId)">移除</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import { onShow } from '@dcloudio/uni-app';
import { memberControllerList, washCardControllerAdminAddShare, washCardControllerAdminRemoveShare, washCardControllerAdminShares } from '@wash/api-client';

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const cardId = ref<number | null>(null);
const shares = ref<any[]>([]);
const loading = ref(false);
const phone = ref('');

async function fetchShares(){
	if (!cardId.value) return;
	loading.value = true;
	try {
		const res = (await washCardControllerAdminShares(String(cardId.value))) as any;
		shares.value = (Array.isArray(res) ? res : []) as any[];
	} catch { shares.value = []; }
	finally { loading.value = false; }
}

function validPhone(p: string){ return /^1\d{10}$/.test(String(p||'').trim()); }

async function addShare(){
	if (!cardId.value) return;
	const p = String(phone.value||'').trim();
	if (!validPhone(p)) { uni.showToast({ title: '手机号格式不正确', icon: 'none' }); return; }
	try {
		// 先查会员ID
		const member = (await memberControllerList({ page: 1, pageSize: 20, keyword: p } as any)) as any;
		const match = Array.isArray(member?.items) ? member.items.find((x:any)=> x.phone === p) : null;
		if (!match?.id) { uni.showToast({ title: '未找到该会员', icon: 'none' }); return; }
		await washCardControllerAdminAddShare(String(cardId.value), { body: JSON.stringify({ memberId: match.id }) });
		uni.showToast({ title: '添加成功', icon: 'success' });
		phone.value = '';
		await fetchShares();
	} catch (e) { uni.showToast({ title: '添加失败', icon: 'none' }); }
}

async function removeShare(memberId: number){
	if (!cardId.value) return;
	try {
		await washCardControllerAdminRemoveShare(String(cardId.value), String(memberId));
		uni.showToast({ title: '已移除', icon: 'success' });
		await fetchShares();
	} catch { uni.showToast({ title: '操作失败', icon: 'none' }); }
}

onLoad((q: any)=>{ cardId.value = q?.id ? Number(q.id) : null; fetchShares(); });
onShow(()=>{ fetchShares(); });

function goBack(){
	try { uni.navigateBack(); } catch {}
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: #f7fafc; }
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,.04); }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.title { font-size: 30rpx; font-weight: 700; color:#111827; }
.subtip { margin: 8rpx 0 12rpx 0; font-size: 22rpx; color:#64748b; }
.form-row { display:flex; align-items:center; gap: 12rpx; }
.input { flex:1; background:#f9fafb; border:2rpx solid #e5e7eb; border-radius: 12rpx; padding: 12rpx 16rpx; font-size: 26rpx; color:#111827; }
.list-header { margin-top: 16rpx; font-size: 24rpx; color:#6b7280; }
.empty { padding: 24rpx; color: #6b7280; text-align: center; }
.share-item { display:flex; align-items:center; justify-content: space-between; padding: 16rpx 0; border-bottom: 2rpx solid #f3f4f6; }
.info { display:flex; flex-direction: column; }
.name { font-size: 26rpx; color:#111827; }
.phone { font-size: 24rpx; color:#6b7280; }
.btn { font-size: 24rpx; color:#1f2937; background:#f3f4f6; padding: 10rpx 18rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; }
.btn-primary { color:#fff; background:#2563eb; border-color:#2563eb; }
.btn-danger { color:#fff; background:#ef4444; border-color:#ef4444; }

/* 统一返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


