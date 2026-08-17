<template>
	<view class="contact-actions">
		<button class="contact-action" aria-label="拨打电话" @tap.stop="emit('call')">
			<image src="/static/icons/ride-phone.svg" mode="aspectFit" />
		</button>
		<view class="message-action-wrap">
			<button class="contact-action" aria-label="发送消息" @tap.stop="emit('message')">
				<image src="/static/icons/ride-message.svg" mode="aspectFit" />
			</button>
			<text v-if="unreadCount > 0" class="unread-badge">{{ unreadText }}</text>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ unread?: number }>();
const emit = defineEmits<{ call: []; message: [] }>();
const unreadCount = computed(() => Math.max(0, Number(props.unread) || 0));
const unreadText = computed(() => unreadCount.value > 99 ? '99+' : String(unreadCount.value));
</script>

<style scoped>
.contact-actions{position:relative;z-index:3;display:flex;flex:none;align-items:center;gap:10rpx;overflow:visible}.message-action-wrap{position:relative;z-index:4;overflow:visible}.contact-action{display:flex;width:58rpx;height:58rpx;align-items:center;justify-content:center;margin:0;padding:0;border:1rpx solid #dbeafe;border-radius:50%;background:#fff;box-shadow:0 6rpx 16rpx rgba(37,99,235,.1);line-height:1;overflow:visible}.contact-action image{display:block;width:31rpx;height:31rpx}.contact-action:active{background:#eff6ff;transform:scale(.96)}.unread-badge{position:absolute;z-index:20;top:-12rpx;right:-12rpx;display:flex;min-width:32rpx;height:32rpx;align-items:center;justify-content:center;padding:0 7rpx;border:3rpx solid #fff;border-radius:999rpx;background:#ef4444;color:#fff;font-size:16rpx;font-weight:800;line-height:1;box-sizing:border-box;pointer-events:none}.contact-action::after{border:0}
</style>
