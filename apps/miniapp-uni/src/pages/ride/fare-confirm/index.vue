<template>
	<view class="page">
		<RidePageHeader title="确认行程费用" subtitle="费用将由服务端重新核算" />
		<view class="card">
			<view v-if="fareDetails" class="settlement-summary">
				<view><text>当前计价参考</text><strong>¥{{ money(estimatedSettlementAmount) }}</strong></view>
				<view><text>已线上预付</text><strong>¥{{ money(fareDetails.prepaidAmount) }}</strong></view>
				<view><text>预计剩余差额</text><strong class="warn">¥{{ money(estimatedDifference) }}</strong></view>
			</view>
			<view class="row"><view><strong>停车费</strong><text>按实际发生填写</text></view><view class="money-input"><text>¥</text><input v-model.number="parking" type="digit" placeholder="0.00" /></view></view>
			<view class="row"><view><strong>其他费用</strong><text>仅填写已向乘客说明的费用</text></view><view class="money-input"><text>¥</text><input v-model.number="other" type="digit" placeholder="0.00" /></view></view>
			<view class="remark"><text>费用备注</text><textarea v-model="remark" maxlength="191" placeholder="选填，例如停车场名称或费用说明" /></view>
			<view v-if="canConfirmOffline" class="offline-option" :class="{ selected: passengerPaidOffline }">
				<view class="offline-head"><view><strong>乘客已线下付清差额</strong><text>现金或转账等线下方式</text></view><switch color="#2563eb" :checked="passengerPaidOffline" @change="setPassengerPaidOffline" /></view>
				<text>开启并确认后，若最终费用高于线上预付，系统将记录司机确认的线下实收差额，不再创建线上补款单，并直接结束行程。</text>
			</view>
			<view class="hint">不勾选线下收款时，仍按原流程生成线上补款单；乘客可在行程详情中支付实际费用高于预付金额的差额。最终距离和时间由服务器根据行程定位记录计算，客户端不能修改行程基础金额。</view>
			<button class="primary" :loading="loading" :disabled="loading" @tap="submit">{{ passengerPaidOffline ? '确认线下已付并完成' : '提交最终费用' }}</button>
		</view>
	</view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import RidePageHeader from '../../../components/ride/RidePageHeader.vue';
import { rideApi } from '../../../services/ride';

let id = 0;
const trip = ref<any>(null);
const parking = ref(0);
const other = ref(0);
const remark = ref('');
const passengerPaidOffline = ref(false);
const loading = ref(false);
const fareDetails = computed(() => trip.value?.fareDetails || null);
const estimatedSettlementAmount = computed(() => Number(fareDetails.value?.amount || 0) + Math.max(0, Number(parking.value || 0)) + Math.max(0, Number(other.value || 0)));
const estimatedDifference = computed(() => Math.max(0, estimatedSettlementAmount.value - Number(fareDetails.value?.prepaidAmount || 0)));
const canConfirmOffline = computed(() => Boolean(trip.value?.customPrepayEnabled));

function money(value: unknown) { return Number(value || 0).toFixed(2); }
function setPassengerPaidOffline(event: any) { passengerPaidOffline.value = canConfirmOffline.value && Boolean(event?.detail?.value); }
watch(canConfirmOffline, (canConfirm) => { if (!canConfirm) passengerPaidOffline.value = false; });

async function load() {
	try {
		trip.value = await rideApi.detail(id);
	} catch (error: any) {
		uni.showToast({ title: error?.message || '行程加载失败', icon: 'none' });
	}
}

async function finalize() {
	loading.value = true;
	try {
		const extraFees: any[] = [];
		if (parking.value > 0) extraFees.push({ type: 'PARKING', amount: Number(parking.value), remark: remark.value });
		if (other.value > 0) extraFees.push({ type: 'OTHER', amount: Number(other.value), remark: remark.value });
		await rideApi.finalize(id, { finalDistanceMeters: 0, finalDurationSeconds: 0, extraFees, passengerPaidOffline: passengerPaidOffline.value });
		uni.redirectTo({ url: '/pages/ride/detail/index?id=' + id + '&driver=1' });
	} catch (error: any) {
		uni.showToast({ title: error?.message || '费用确认失败', icon: 'none' });
	} finally {
		loading.value = false;
	}
}

function submit() {
	if (loading.value) return;
	if (Number(parking.value || 0) < 0 || Number(other.value || 0) < 0) {
		uni.showToast({ title: '附加费用不能小于 0', icon: 'none' });
		return;
	}
	if (passengerPaidOffline.value && !canConfirmOffline.value) {
		uni.showToast({ title: '当前费用无需确认线下差额', icon: 'none' });
		return;
	}
	if (!passengerPaidOffline.value) {
		void finalize();
		return;
	}
	uni.showModal({
		title: '确认已收到线下支付',
		content: '请仅在乘客已通过现金或转账付清最终费用与线上预付的差额后确认。确认后订单将直接完成，不再向乘客发起线上补款。',
		confirmText: '确认已收款',
		confirmColor: '#dc2626',
		success: (result) => { if (result.confirm) void finalize(); },
	});
}

onLoad((query: any) => {
	id = Number(query?.id || 0);
	void load();
});
</script>

<style scoped>
.page{min-height:100vh;padding-bottom:calc(env(safe-area-inset-bottom) + 32rpx);background:linear-gradient(180deg,#eaf5ff 0,#fff1f7 360rpx,#f8fafc 720rpx);box-sizing:border-box}.card{margin:10rpx 24rpx 0;padding:28rpx;border-radius:30rpx;background:rgba(255,255,255,.96);box-shadow:0 14rpx 38rpx rgba(15,23,42,.08)}.settlement-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10rpx;margin-bottom:14rpx}.settlement-summary>view{min-width:0;padding:15rpx 12rpx;border-radius:18rpx;background:#f8fafc}.settlement-summary text,.settlement-summary strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.settlement-summary text{color:#64748b;font-size:18rpx}.settlement-summary strong{margin-top:5rpx;color:#0f172a;font-size:25rpx}.settlement-summary .warn{color:#d97706}.row{display:flex;align-items:center;justify-content:space-between;padding:22rpx 0;border-bottom:1rpx solid #e2e8f0}.row strong,.row text{display:block}.row strong{color:#0f172a;font-size:27rpx}.row view>text{margin-top:5rpx;color:#94a3b8;font-size:20rpx}.money-input{display:flex;align-items:center;gap:6rpx}.money-input text{margin:0;color:#3580ff;font-size:28rpx;font-weight:800}.money-input input{width:150rpx;text-align:right;color:#0f172a;font-size:30rpx;font-weight:800}.remark{padding:24rpx 0}.remark>text{color:#334155;font-size:25rpx;font-weight:700}.remark textarea{width:100%;height:150rpx;margin-top:14rpx;padding:18rpx;border-radius:20rpx;background:#f8fafc;font-size:24rpx;box-sizing:border-box}.offline-option{margin-bottom:18rpx;padding:20rpx;border:1rpx solid #e2e8f0;border-radius:20rpx;background:#f8fafc;transition:.2s ease}.offline-option.selected{border-color:#93c5fd;background:#eff6ff}.offline-head{display:flex;align-items:center;justify-content:space-between;gap:16rpx}.offline-head>view{min-width:0}.offline-head strong,.offline-head text{display:block}.offline-head strong{color:#0f172a;font-size:25rpx}.offline-head text{margin-top:4rpx;color:#64748b;font-size:19rpx}.offline-option>text{display:block;margin-top:12rpx;color:#64748b;font-size:20rpx;line-height:1.55}.hint{padding:18rpx;border-radius:18rpx;background:#eff6ff;color:#475569;font-size:22rpx;line-height:1.6}.primary{margin-top:26rpx;border:0;border-radius:999rpx;background:#0f172a;color:#fff;font-weight:700}button::after{border:0}
</style>
