<template>
	<view class="wash-card" :class="{ clickable }" @tap.stop="onTap">
		<view class="head">
			<view class="title-row">
				<text class="title-text">{{ displayTitle }}</text>
				<text v-if="card && card.isDefault" class="default-badge">默认</text>
				<text v-if="card && card._shared" class="share-badge">共享</text>
			</view>
			<text class="usage-text" v-if="loggedIn && card">
				剩余 {{ remainingTimes }}/{{ totalTimes }} 次
			</text>
			<text class="usage-text" v-else>
				{{ loggedIn ? '暂无卡片' : '登录以查看洗车卡信息' }}
			</text>
		</view>
		<view v-if="loggedIn && card" class="progress">
			<view class="progress-inner" :style="{ width: usedPercent + '%' }" />
		</view>
		<view class="foot-row">
			<text class="expiry-text" v-if="loggedIn && card">有效期：{{ expiryText }}</text>
			<view class="cta" v-if="showCta && loggedIn">
				<text class="cta-text">点击查看详情</text>
				<text class="arrow">›</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
	card?: any | null;
	loggedIn?: boolean;
	title?: string;
	showCta?: boolean;
	clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	card: null,
	loggedIn: false,
	title: '洗车计次卡',
	showCta: true,
	clickable: true,
});

const emit = defineEmits<{ (e: 'tap'): void }>();

const displayTitle = computed(()=> (props.card?.name && String(props.card.name).trim()) || props.title);

const totalTimes = computed(() => Math.max(1, Number(props.card?.totalTimes || 0)));
const remainingTimes = computed(() => Math.max(0, Number(props.card?.remainingTimes || 0)));
const usedTimes = computed(() => Math.max(0, totalTimes.value - remainingTimes.value));
const usedPercent = computed(() => Math.max(0, Math.min(100, Math.round((usedTimes.value / totalTimes.value) * 100))));

const expiryText = computed(() => {
	try {
		const v = props.card?.expiryAt;
		if (!v) return '永久';
		const d = new Date(v);
		if (isNaN(d.getTime())) return '';
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	} catch {
		return '';
	}
});

function onTap(){ if (props.clickable) emit('tap'); }
</script>

<style>
.wash-card {
	background: linear-gradient(180deg, #ffffff 0%, #fff7fb 100%);
	border-radius: 24rpx;
	padding: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06);
	border: 2rpx solid #ffe3ef;
}
.wash-card.clickable { transition: transform .05s ease; }
.wash-card.clickable:active { transform: scale(0.99); }

.head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 18rpx; }
.title-row { display:flex; align-items:center; gap: 10rpx; }
.title-text { font-size: 28rpx; font-weight: 700; color: #111827; }
.wash-card .default-badge { font-size: 22rpx; color: #1d4ed8; background: #eff6ff; border: 2rpx solid #bfdbfe; padding: 4rpx 8rpx; border-radius: 999rpx; }
.wash-card .share-badge { font-size: 22rpx; color: #065f46; background: #ecfdf5; border: 2rpx solid #86efac; padding: 4rpx 8rpx; border-radius: 999rpx; }
.usage-text { font-size: 24rpx; color: #6b7280; }

.progress { width:100%; height: 16rpx; border-radius: 999rpx; background: #eef2ff; overflow:hidden; position: relative; }
.progress-inner { height:100%; background: linear-gradient(90deg, #a8d8ff, #ffc9de); }

.foot-row { margin-top: 14rpx; display:flex; align-items:center; justify-content: space-between; }
.expiry-text { font-size: 24rpx; color:#6b7280; }
.cta { display:flex; align-items:center; gap: 6rpx; }
.cta-text { font-size: 24rpx; color:#2563eb; }
.arrow { font-size: 28rpx; color:#2563eb; line-height: 1; }
</style>


