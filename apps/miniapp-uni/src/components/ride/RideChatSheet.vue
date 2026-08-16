<template>
	<view v-if="modelValue" class="mask" @tap="close">
		<view class="sheet" @tap.stop>
			<view class="handle" />
			<view class="head"><view><strong>在线联系</strong><text>消息仅用于本次行程沟通</text></view><text class="close" @tap="close">关闭</text></view>
			<scroll-view scroll-y class="messages" :scroll-into-view="scrollTarget">
				<view v-if="loading" class="state">正在加载消息…</view>
				<view v-else-if="!messages.length" class="state empty"><strong>还没有消息</strong><text>可以发送上车位置、等候说明等信息</text></view>
				<view v-for="message in messages" :id="messageId(message.id)" :key="message.id" class="message-row" :class="{ mine: isMine(message) }">
					<text class="sender">{{ isMine(message) ? '我' : '对方' }} · {{ formatTime(message.createdAt) }}</text>
					<view class="bubble">{{ message.content }}</view>
					<text v-if="isMine(message)" class="read-state" :class="{ unread: !message.readAt }">{{ message.readAt ? '已读' : '未读' }}</text>
				</view>
			</scroll-view>
			<view class="send"><input v-model="content" maxlength="1000" confirm-type="send" placeholder="输入行程消息" @confirm="send" /><button :disabled="sending || !content.trim()" @tap="send">{{ sending ? '发送中' : '发送' }}</button></view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rideApi } from '../../services/ride';
import { onRideRealtime } from '../../services/ride-realtime';

const props = defineProps<{ modelValue: boolean; rideId: number; memberId?: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; 'unread-change': [value: number] }>();
const messages = ref<any[]>([]);
const content = ref('');
const loading = ref(false);
const sending = ref(false);
const scrollTarget = ref('');
const unreadCount = ref(0);
let stopRealtime: (() => void) | null = null;
let markingRead = false;
let markReadAgain = false;
let unreadVersion = 0;

function isMine(message: any) { return Number(message.senderMemberId) === Number(props.memberId || 0); }
function messageId(id: string | number) { return 'ride-message-' + id; }
function formatTime(value?: string) {
	if (!value) return '';
	const date = new Date(value);
	return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}
async function scrollToBottom() {
	await nextTick();
	const last = messages.value[messages.value.length - 1];
	scrollTarget.value = last ? messageId(last.id) : '';
}
function setUnread(value: unknown) { unreadCount.value = Math.max(0, Number(value) || 0); emit('unread-change', unreadCount.value); }
function mergeMessages(incoming: any[]) {
	const merged = new Map<string, any>();
	for (const message of [...messages.value, ...(Array.isArray(incoming) ? incoming : [])]) {
		if (message?.id == null) continue;
		const key = String(message.id);
		merged.set(key, { ...(merged.get(key) || {}), ...message });
	}
	messages.value = Array.from(merged.values()).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
}
function applyReadReceipt(result: any) {
	const ids = new Set((result?.messageIds || []).map((id: unknown) => String(id)));
	if (!ids.size || !result?.readAt) return;
	messages.value = messages.value.map((message) => ids.has(String(message.id)) ? { ...message, readAt: result.readAt } : message);
}
async function syncUnreadCount() {
	if (!props.rideId) { setUnread(0); return; }
	const rideId = props.rideId;
	const version = unreadVersion;
	try {
		const result = await rideApi.messageUnreadCount(rideId);
		if (Number(props.rideId) === Number(rideId) && version === unreadVersion) setUnread(result?.count);
	} catch {}
}
async function markRead() {
	if (!props.modelValue || !props.rideId) return;
	if (markingRead) { markReadAgain = true; return; }
	markingRead = true;
	try {
		let result: any;
		do {
			markReadAgain = false;
			result = await rideApi.markMessagesRead(props.rideId);
			applyReadReceipt(result);
		} while (markReadAgain && props.modelValue);
		unreadVersion += 1;
		setUnread(result?.unreadCount);
	} catch (error: any) {
		void syncUnreadCount();
		uni.showToast({ title: error?.message || '消息已读状态更新失败', icon: 'none' });
	} finally { markingRead = false; }
}
async function load() {
	if (!props.modelValue || !props.rideId || loading.value) return;
	loading.value = true;
	try { mergeMessages(await rideApi.messages(props.rideId)); await markRead(); await scrollToBottom(); }
	catch (error: any) { uni.showToast({ title: error?.message || '消息加载失败', icon: 'none' }); }
	finally { loading.value = false; }
}
async function send() {
	const text = content.value.trim();
	if (!text || sending.value) return;
	sending.value = true;
	try {
		const message = await rideApi.sendMessage(props.rideId, text);
		content.value = '';
		mergeMessages([message]);
		await scrollToBottom();
	} catch (error: any) { uni.showToast({ title: error?.message || '消息发送失败', icon: 'none' }); }
	finally { sending.value = false; }
}
function close() { emit('update:modelValue', false); }
function handleRealtime(event: any) {
	if (Number(event?.data?.rideTripId) !== Number(props.rideId)) return;
	if (event?.type === 'ride:message') {
		mergeMessages([event.data]);
		if (props.modelValue) void markRead();
		else {
			unreadVersion += 1;
			setUnread(Number.isFinite(Number(event.data.unreadCount)) ? event.data.unreadCount : unreadCount.value + 1);
		}
		if (props.modelValue) void scrollToBottom();
		return;
	}
	if (event?.type === 'ride:message-read') applyReadReceipt(event.data);
}
function handleReconnect() {
	void syncUnreadCount();
	if (props.modelValue) void load();
}
watch(() => props.modelValue, (open) => { if (open) void load(); }, { immediate: true });
watch(() => props.rideId, () => {
	messages.value = [];
	content.value = '';
	unreadVersion += 1;
	setUnread(0);
	void syncUnreadCount();
	if (props.modelValue) void load();
});
onMounted(() => {
	stopRealtime = onRideRealtime((event) => {
		handleRealtime(event);
	});
	try { uni.$on('realtime:connected', handleReconnect); } catch {}
	void syncUnreadCount();
});
onBeforeUnmount(() => { stopRealtime?.(); try { uni.$off('realtime:connected', handleReconnect); } catch {} });
</script>

<style scoped>
.mask{position:fixed;z-index:100;inset:0;display:flex;align-items:center;padding:32rpx 24rpx;background:rgba(15,23,42,.45);backdrop-filter:blur(5px);box-sizing:border-box}.sheet{display:flex;width:100%;height:min(68vh,920rpx);max-height:calc(100vh - 160rpx - env(safe-area-inset-bottom));flex-direction:column;padding:14rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));border:1rpx solid rgba(255,255,255,.9);border-radius:36rpx;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 22rpx 70rpx rgba(15,23,42,.28);box-sizing:border-box}.handle{width:72rpx;height:8rpx;flex:none;margin:0 auto 18rpx;border-radius:999rpx;background:#cbd5e1}.head,.send{display:flex;align-items:center;flex:none}.head{justify-content:space-between;padding-bottom:18rpx;border-bottom:1rpx solid #e2e8f0}.head strong,.head text{display:block}.head strong{color:#0f172a;font-size:30rpx}.head view text{margin-top:4rpx;color:#94a3b8;font-size:20rpx}.close{padding:10rpx;color:#2563eb;font-size:23rpx}.messages{min-height:0;flex:1;padding:18rpx 0;box-sizing:border-box}.state{padding:80rpx 20rpx;color:#94a3b8;text-align:center;font-size:23rpx}.state strong,.state text{display:block}.state strong{color:#475569;font-size:28rpx}.state text{margin-top:8rpx}.message-row{display:flex;flex-direction:column;align-items:flex-start;margin:14rpx 0}.message-row.mine{align-items:flex-end}.sender{margin:0 8rpx 6rpx;color:#94a3b8;font-size:19rpx}.bubble{max-width:76%;padding:15rpx 19rpx;border:1rpx solid #e2e8f0;border-radius:8rpx 22rpx 22rpx;background:#fff;box-shadow:0 5rpx 16rpx rgba(15,23,42,.06);color:#334155;font-size:25rpx;line-height:1.55;word-break:break-all}.mine .bubble{border-color:#2563eb;border-radius:22rpx 8rpx 22rpx 22rpx;background:linear-gradient(135deg,#3580ff,#2563eb);color:#fff}.read-state{margin:5rpx 8rpx 0;color:#94a3b8;font-size:18rpx}.read-state.unread{color:#f59e0b}.send{gap:12rpx;padding-top:14rpx;border-top:1rpx solid #e2e8f0}.send input{min-width:0;flex:1;padding:16rpx 20rpx;border-radius:999rpx;background:#eef2f7;color:#0f172a;font-size:24rpx}.send button{flex:none;margin:0;padding:0 25rpx;border:0;border-radius:999rpx;background:#2563eb;color:#fff;font-size:23rpx}.send button[disabled]{background:#cbd5e1;color:#fff}button::after{border:0}
</style>
