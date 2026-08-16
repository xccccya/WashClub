<template>
	<view class="slide" :class="{ disabled, confirmed, dragging }" @touchstart="start" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="cancel">
		<view class="progress" :style="{ width: progressWidth }" />
		<view class="thumb" :style="{ transform: 'translateX(' + offset + 'px)' }"><text>{{ confirmed ? '✓' : '›' }}</text></view>
		<text class="label">{{ confirmed ? '已确认' : label }}</text>
	</view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue';

const props = defineProps<{ label: string; disabled?: boolean }>();
const emit = defineEmits<{ confirm: [] }>();
const instance = getCurrentInstance();
const offset = ref(0);
const maxOffset = ref(0);
const dragging = ref(false);
const confirmed = ref(false);
let startX = 0;

const progressWidth = computed(() => (offset.value + 46) + 'px');
async function measure() {
	await nextTick();
	const query = uni.createSelectorQuery().in(instance?.proxy);
	query.select('.slide').boundingClientRect();
	query.select('.thumb').boundingClientRect();
	query.exec((rects: any[]) => {
		const slide = rects?.[0];
		const thumb = rects?.[1];
		if (slide?.width && thumb?.width) maxOffset.value = Math.max(0, slide.width - thumb.width - 8);
	});
}
function start(event: any) {
	if (props.disabled || confirmed.value) return;
	dragging.value = true;
	startX = Number(event.touches?.[0]?.clientX || 0) - offset.value;
	if (!maxOffset.value) void measure();
}
function move(event: any) {
	if (!dragging.value || props.disabled) return;
	offset.value = Math.max(0, Math.min(maxOffset.value, Number(event.touches?.[0]?.clientX || 0) - startX));
}
function end() {
	if (!dragging.value) return;
	dragging.value = false;
	if (!props.disabled && maxOffset.value > 0 && offset.value >= maxOffset.value * .82) {
		offset.value = maxOffset.value;
		confirmed.value = true;
		emit('confirm');
		setTimeout(() => { confirmed.value = false; offset.value = 0; }, 900);
		return;
	}
	offset.value = 0;
}
function cancel() { dragging.value = false; offset.value = 0; }
onMounted(measure);
</script>

<style scoped>
.slide{position:relative;display:flex;height:92rpx;align-items:center;justify-content:center;overflow:hidden;border:1rpx solid #dbe4f0;border-radius:999rpx;background:linear-gradient(180deg,#f8fafc,#edf2f7);box-shadow:inset 0 2rpx 5rpx rgba(15,23,42,.05);color:#475569;font-weight:750;touch-action:none;user-select:none}.progress{position:absolute;top:0;bottom:0;left:0;border-radius:999rpx;background:linear-gradient(90deg,#dbeafe,#bfdbfe);transition:width .18s}.dragging .progress,.dragging .thumb{transition:none}.thumb{position:absolute;z-index:2;left:8rpx;display:grid;width:76rpx;height:76rpx;place-items:center;border-radius:50%;background:linear-gradient(135deg,#0f172a,#334155);box-shadow:0 7rpx 18rpx rgba(15,23,42,.26);color:#fff;font-size:48rpx;transition:transform .22s cubic-bezier(.2,.8,.2,1)}.thumb text{transform:translateY(-2rpx)}.label{position:relative;z-index:1;padding:0 92rpx;font-size:24rpx;letter-spacing:1rpx}.confirmed{color:#166534}.confirmed .progress{background:#bbf7d0}.confirmed .thumb{background:linear-gradient(135deg,#16a34a,#22c55e)}.disabled{opacity:.48}
</style>
