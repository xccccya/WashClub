<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<!-- 顶部提示卡片 -->
		<view class="card notice-card">
			<text class="notice-emoji">⚠️</text>
			<text class="notice-text">排队信息仅参考，如需获取准确的等待时间请联系我们</text>
		</view>
		<view class="card">
			<view class="card-title">服务队列</view>
			<view class="legend">
				<view class="legend-chip done">已完成</view>
				<view class="legend-chip active">进行中</view>
				<view class="legend-chip wait">未开始</view>
			</view>
			<view v-if="list.length===0" class="empty">当前无需排队，欢迎光临～</view>
			<view v-else>
				<view v-for="(item,idx) in list" :key="item.id" class="queue-item">
					<view class="row">
						<view class="plate-wrap">
							<image v-if="item?.vehicle?.brandImage" class="brand-icon" :src="toAbs(item.vehicle.brandImage)" />
							<text class="plate">{{ maskPlate(item.plateNumber) }}</text>
							<text class="brand-series" v-if="item?.vehicle">{{ (item?.vehicle?.brand||'-') + ' / ' + (item?.vehicle?.series||'-') }}</text>
						</view>
						<text class="tag" :class="item.guest?'guest':'member'">{{ item.guest ? '游客' : ('会员' + last4(item?.vehicle?.member?.phone)) }}</text>
					</view>
					<view class="row">
						<text class="small">前方 {{ idx }} 辆 · 预计等待 {{ aheadMinutesModel(idx) }} 分钟</text>
						<text class="small">本车剩余约 {{ combinedRemainingModel(item, idx) }} 分钟</text>
					</view>
					<view class="steps">
						<view v-for="(t,i) in item.tasks" :key="t.id" class="step" :class="stepClass(item, i, t)">
							<text class="step-name">{{ t.name }}</text>
							<text class="step-time">{{ t.durationMin }}分钟</text>
						</view>
					</view>
				</view>
			</view>
		</view>
		<!-- 新增车辆预计等待时间卡片 -->
		<view v-if="list.length>0" class="card eta-card">
			<view class="eta-title">新增车辆预计等待</view>
			<view class="eta-row">
				<text class="eta-value">{{ etaForNewCar }}</text>
				<text class="eta-unit">分钟</text>
			</view>
			<view class="eta-hint">基于当前排队实时估算，实际以现场为准</view>
            <view class="eta-hint">预计等待时间为新增车辆开始服务所需等待的时间</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import { createHttp, API_BASE } from '../../utils/auth';

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const list = ref<any[]>([]);
const etaForNewCar = computed(()=> computeEtaForNewCar(list.value));

function toAbs(u?: string | null){ if (!u) return ''; if (/^https?:\/\//i.test(String(u))) return String(u); return `${API_BASE}${String(u).startsWith('/')?u:('/'+u)}`; }

function maskPlate(plate: string){
    const s = String(plate||'');
    if (s.length <= 2) return s + '**';
    // 保留首尾，其余用 *
    const head = s.slice(0, 2);
    const tail = s.slice(-1);
    return head + '***' + tail;
}

function last4(phone?: string | null){ const s = String(phone||'').trim(); return s ? s.slice(-4) : ''; }

function stepClass(item: any, index: number, t: any){
    const arr = ['step'];
    const doneByIndex = Number(item?.currentTaskIndex ?? 0) > index;
    const status = String(t?.status || 'PENDING');
    if (doneByIndex || status === 'DONE') arr.push('done');
    else if (Number(item?.currentTaskIndex ?? 0) === index || status === 'DOING') arr.push('active');
    return arr;
}

async function fetchList(){
    try {
        const http = createHttp();
        const arr = await http<any[]>('/queue/list', { method: 'GET' });
        list.value = Array.isArray(arr) ? arr : [];
    } catch { list.value = []; }
}

onShow(fetchList);

function goBack(){
    try {
        const pages = getCurrentPages?.() || [];
        if (pages.length > 1) { uni.navigateBack(); return; }
        uni.reLaunch({ url: '/pages/index/index' });
    } catch { uni.reLaunch({ url: '/pages/index/index' }); }
}

function aheadMinutesModel(index: number): number {
    const items = (list.value || []).slice(0, index);
    return computeEtaForNewCar(items);
}

function combinedRemainingModel(row: any, index: number): number {
    const waitAhead = aheadMinutesModel(index);
    const selfRemain = remainingMinutesModel(row);
    return Math.max(0, Math.round(waitAhead + selfRemain));
}

function computeEtaForNewCar(items: any[]): number {
    let total = 0;
    for (const it of (items || [])) {
        const tasks = Array.isArray(it?.tasks) ? [...it.tasks].sort((a:any,b:any)=>a.orderIndex-b.orderIndex) : [] as any[];
        const idx = Number(it?.currentTaskIndex ?? 0);
        const tE1: any = tasks.find((t:any)=> t.orderIndex === 0);
        const tE2: any = tasks.find((t:any)=> t.orderIndex === 1);
        const e1Dur = Number(tE1?.durationMin ?? 5) || 5;
        const e2Dur = Number(tE2?.durationMin ?? 5) || 5;
        const e1Done = idx > 0 || String(tE1?.status||'') === 'DONE';
        const e2Done = idx > 1 || String(tE2?.status||'') === 'DONE';
        if (!e1Done) total += e1Dur;
        if (!e2Done) total += e2Dur;
    }
    return Math.max(0, Math.round(total));
}

function remainingMinutesModel(row: any): number {
    const tasks = Array.isArray(row?.tasks) ? [...row.tasks].sort((a:any,b:any)=>a.orderIndex-b.orderIndex) : [] as any[];
    const idx = Number(row?.currentTaskIndex ?? 0);
    let total = 0;
    for (let i = 0; i < tasks.length; i++) {
        const t:any = tasks[i];
        const doneByIndex = idx > i;
        if (doneByIndex || String(t?.status||'') === 'DONE') continue;
        total += Number(t?.durationMin || 0);
    }
    return Math.max(0, Math.round(total));
}
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); box-sizing: border-box; }
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
.card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); border-radius: 20rpx; padding: 20rpx; box-shadow: 0 6rpx 18rpx rgba(0,0,0,.06); }
.notice-card { display:flex; align-items:center; gap: 10rpx; border: 2rpx dashed #fbbf24; background: #fffbeb; color:#78350f; }
.notice-emoji { font-size: 28rpx; }
.notice-text { font-size: 24rpx; line-height: 1.6; }
.card-title { font-size: 28rpx; font-weight: 600; color: #111827; margin-bottom: 12rpx; }
.legend { display:flex; align-items:center; gap: 10rpx; margin-bottom: 10rpx; }
.legend-chip { font-size: 20rpx; padding: 6rpx 10rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx dashed #e5e7eb; color:#374151; }
.legend-chip.active { background:#e6f0ff; color:#1d4ed8; border-color:#77bfff; }
.legend-chip.done { background:#ecfdf5; color:#065f46; border-color:#86efac; }
.legend-chip.wait { background:#f3f4f6; color:#6b7280; border-color:#e5e7eb; }
.empty { padding: 120rpx 0; text-align: center; color: #6b7280; }
.queue-item { padding: 16rpx 0; border-bottom: 1rpx solid #eef2f7; }
.queue-item:last-child { border-bottom: none; }
.row { display:flex; align-items:center; justify-content: space-between; margin: 6rpx 0; }
.plate-wrap { display:flex; align-items:center; gap: 12rpx; flex: 1; min-width: 0; }
.plate { font-size: 32rpx; font-weight: 700; letter-spacing: 2rpx; color:#0b1220; }
.brand-icon { width: 28rpx; height: 28rpx; border-radius: 6rpx; background:#ffffff; border: 2rpx solid #eef2f7; object-fit: contain; }
.brand-series { font-size: 22rpx; color:#6b7280; }
.tag { font-size: 22rpx; padding: 4rpx 8rpx; border-radius: 999rpx; background:#ffffff; border: 2rpx dashed #e5e7eb; }
.tag.member { background:#ecfdf5; color:#065f46; border-color:#86efac; }
.tag.guest { background:#fffbeb; color:#78350f; border-color:#fbbf24; }
.small { font-size: 22rpx; color:#6b7280; }
.steps { display:flex; gap: 10rpx; margin-top: 8rpx; flex-wrap: wrap; }
.step { padding: 8rpx 10rpx; border-radius: 12rpx; background:#ffffff; border: 2rpx dashed #e5e7eb; color:#374151; display:flex; align-items:center; gap: 8rpx; }
.step.active { background:#e6f0ff; color:#1d4ed8; }
.step.done { background:#ecfdf5; color:#065f46; }
.step-name { font-size: 22rpx; }
.step-time { font-size: 20rpx; opacity:.8; }

/* 新增车辆预计等待 卡片样式 */
.eta-card { margin-top: 16rpx; background: linear-gradient(180deg, #eef7ff 0%, #f7fbff 100%); border: 2rpx dashed #cfe8ff; text-align: center; }
.eta-title { font-size: 26rpx; color:#1e40af; margin-bottom: 8rpx; font-weight: 600; }
.eta-row { display:flex; align-items: baseline; justify-content: center; gap: 8rpx; margin: 6rpx 0 2rpx; }
.eta-value { font-size: 48rpx; color:#1d4ed8; font-weight: 800; letter-spacing: 1rpx; }
.eta-unit { font-size: 22rpx; color:#2563eb; opacity: .9; }
.eta-hint { font-size: 20rpx; color:#6b7280; margin-top: 6rpx; }
</style>


