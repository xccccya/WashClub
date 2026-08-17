<template>
	<div v-loading="loading" class="page">
		<div class="head">
			<div><el-button link @click="$router.back()">← 返回</el-button><h2>行程订单 {{ trip?.order?.no || '' }}</h2></div>
			<el-tag v-if="trip">{{ trip.status }}</el-tag>
		</div>
		<RideAdminMap
			v-if="track"
			:origin="origin"
			:destination="destination"
			:planned-points="plannedPoints"
			:pickup-points="pickupPoints"
			:passenger-points="passengerPoints"
			:settlement-points="settlementPoints"
			height="520px"
		/>
		<div v-if="trip" class="grid">
			<el-card header="行程信息">
				<el-descriptions :column="1" border>
					<el-descriptions-item label="乘客">{{ trip.passenger?.name }}</el-descriptions-item>
					<el-descriptions-item label="司机">{{ trip.driverEmployee?.name || '待接单' }}</el-descriptions-item>
					<el-descriptions-item label="车辆">{{ vehicleText }}</el-descriptions-item>
					<el-descriptions-item label="起点">{{ trip.originAddress }}</el-descriptions-item>
					<el-descriptions-item label="终点">{{ trip.destinationAddress }}</el-descriptions-item>
					<el-descriptions-item label="创建时间">{{ formatTime(trip.createdAt) }}</el-descriptions-item>
					<el-descriptions-item label="派单截止">{{ formatTime(trip.dispatchExpireAt) }}</el-descriptions-item>
					<el-descriptions-item label="到达上车点">{{ formatTime(trip.arrivedPickupAt) }}</el-descriptions-item>
						<el-descriptions-item label="开始行程">{{ formatTime(trip.startedAt) }}</el-descriptions-item>
						<el-descriptions-item label="到达目的地">{{ formatTime(trip.arrivedDestinationAt) }}</el-descriptions-item>
						<el-descriptions-item label="固定预付模式">{{ trip.customPrepayEnabled ? '已启用' : '未启用' }}</el-descriptions-item>
						<el-descriptions-item v-if="Number(trip.offlinePaidAmount || 0)" label="线下确认金额">¥{{ money(trip.offlinePaidAmount) }}</el-descriptions-item>
						<el-descriptions-item v-if="trip.offlinePaidAt" label="线下确认时间">{{ formatTime(trip.offlinePaidAt) }}</el-descriptions-item>
						<el-descriptions-item label="完成/取消">{{ formatTime(trip.completedAt || trip.cancelledAt) }}</el-descriptions-item>
					<el-descriptions-item v-if="trip.cancelReason" label="异常/取消原因">{{ trip.cancelReason }}</el-descriptions-item>
				</el-descriptions>
			</el-card>
			<el-card class="fare-card">
				<template #header><div class="card-title"><span>费用与结算</span><el-tag v-if="fare" effect="light" round>{{ fareModeLabel }}</el-tag></div></template>
				<div v-if="fare" class="fare-content">
					<div class="fare-total">
						<div><span>{{ fare.mode === 'FINAL' ? '最终费用' : fare.mode === 'LIVE' ? '当前实时费用' : '预估费用' }}</span><strong>¥{{ money(fare.amount) }}</strong></div>
						<div class="journey-total"><span>{{ distanceText(fare.distanceMeters) }}</span><i></i><span>{{ durationText(fare.durationSeconds) }}</span></div>
					</div>
					<div class="fee-section">
						<div class="section-title">计价组成</div>
						<div class="fee-grid">
							<div class="fee-item"><span>起步价</span><strong>¥{{ money(fare.baseFare) }}</strong><small>含 {{ distanceNumber(fare.includedDistanceKm) }} km / {{ distanceNumber(fare.includedDurationMinutes) }} 分钟</small></div>
							<div class="fee-item"><span>里程费</span><strong>¥{{ money(fare.distanceFare) }}</strong><small>超出 {{ distanceNumber(fare.chargeableDistanceKm) }} km × ¥{{ money(fare.pricePerKm) }}/km</small></div>
							<div class="fee-item"><span>时长费</span><strong>¥{{ money(fare.durationFare) }}</strong><small>超出 {{ distanceNumber(fare.chargeableDurationMinutes) }} 分钟 × ¥{{ money(fare.pricePerMinute) }}/分钟</small></div>
							<div class="fee-item"><span>附加费用</span><strong>¥{{ money(fare.extraAmount) }}</strong><small>过路 ¥{{ money(fare.tollAmount) }} · 停车 ¥{{ money(fare.parkingAmount) }} · 其他 ¥{{ money(fare.otherAmount) }}</small></div>
						</div>
						<div class="subtotal-row"><span>计价小计</span><strong>¥{{ money(fare.subtotal) }}</strong></div>
						<div v-if="fare.minimumApplied" class="minimum-note">计价小计低于最低消费，本单按最低消费 ¥{{ money(fare.minimumFare) }} 结算</div>
					</div>
					<div class="settlement-grid">
						<div><span>{{ fare.customPrepayEnabled ? '线上预付金额' : '预付金额' }}</span><strong>¥{{ money(fare.prepaidAmount) }}</strong></div>
						<div v-if="Number(fare.offlinePaidAmount || 0)"><span>已确认线下支付</span><strong class="success">¥{{ money(fare.offlinePaidAmount) }}</strong></div>
						<div><span>需补款</span><strong :class="{ warning: Number(fare.supplementAmount) > 0 }">¥{{ money(fare.supplementAmount) }}</strong></div>
						<div><span>应退金额</span><strong :class="{ success: Number(fare.refundableAmount) > 0 }">¥{{ money(fare.refundableAmount) }}</strong></div>
						<div><span>已退金额</span><strong>¥{{ money(fare.refundedAmount) }}</strong></div>
					</div>
					<div v-if="trip.supplementOrder?.no" class="supplement-order">补款单号：{{ trip.supplementOrder.no }}</div>
					<template v-if="trip.extraFees?.length">
						<div class="section-title extra-title">附加费记录</div>
						<el-table :data="trip.extraFees" size="small">
							<el-table-column prop="type" label="费用类型" />
							<el-table-column label="金额"><template #default="{ row }">¥{{ money(row.amount) }}</template></el-table-column>
							<el-table-column prop="remark" label="备注" />
						</el-table>
					</template>
				</div>
				<el-empty v-else description="暂无计价详情" />
			</el-card>
		</div>
		<el-card v-if="trip" class="messages-card" header="行程聊天记录">
			<div v-if="messages.length" class="messages">
				<div v-for="message in messages" :key="message.id" class="message">
					<div class="message-meta"><strong>{{ senderName(message) }}</strong><span>{{ formatTime(message.createdAt) }}</span><el-tag size="small" :type="message.readAt ? 'success' : 'info'">{{ message.readAt ? '已读' : '未读' }}</el-tag></div>
					<div class="message-content">{{ message.content }}</div>
				</div>
			</div>
			<el-empty v-else description="本次行程暂无聊天消息" />
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { rideAdminControllerDetail, rideAdminControllerMessages, rideAdminControllerTrack } from '@wash/api-client';
import RideAdminMap from '../components/ride/RideAdminMap.vue';

const route = useRoute();
const loading = ref(false);
const trip = ref<any>(null);
const track = ref<any>(null);
const messages = ref<any[]>([]);
const fare = computed(() => trip.value?.fareDetails || null);
const fareModeLabel = computed(() => ({ ESTIMATED: '预估计价', LIVE: '实时计价', FINAL: '最终计价' } as Record<string, string>)[fare.value?.mode] || '计价详情');
const origin = computed(() => track.value ? { longitude: Number(track.value.originLongitude), latitude: Number(track.value.originLatitude), address: track.value.originAddress } : null);
const destination = computed(() => track.value ? { longitude: Number(track.value.destinationLongitude), latitude: Number(track.value.destinationLatitude), address: track.value.destinationAddress } : null);
const plannedPoints = computed(() => Array.isArray(track.value?.selectedRouteSnapshot?.points) ? track.value.selectedRouteSnapshot.points : []);
function segmentPoints(name: 'pickup' | 'passenger' | 'settlement') {
	const points = track.value?.segments?.[name];
	return Array.isArray(points) ? points.map((point: any) => ({ longitude: Number(point.longitude), latitude: Number(point.latitude) })) : [];
}
const pickupPoints = computed(() => segmentPoints('pickup'));
const passengerPoints = computed(() => segmentPoints('passenger'));
const settlementPoints = computed(() => segmentPoints('settlement'));
const vehicleText = computed(() => {
	const vehicle = trip.value?.vehicle;
	if (!vehicle) return '-';
	return [vehicle.plateNumber, vehicle.brand, vehicle.series].filter((value) => value && value !== '-').join(' · ');
});

async function load() {
	loading.value = true;
	try {
		const id = Number(route.params.id);
		[trip.value, track.value, messages.value] = await Promise.all([
			rideAdminControllerDetail(id) as any,
			rideAdminControllerTrack(id) as any,
			rideAdminControllerMessages(id) as any,
		]);
	} finally {
		loading.value = false;
	}
}
function money(value: any) { return Number(value || 0).toFixed(2); }
function distanceNumber(value: any) { return Number(value || 0).toFixed(3).replace(/\.?0+$/, ''); }
function distanceText(value: any) { const meters = Number(value || 0); return meters < 1000 ? `${Math.round(meters)} 米` : `${(meters / 1000).toFixed(2)} 公里`; }
function durationText(value: any) { return `${Math.max(0, Math.ceil(Number(value || 0) / 60))} 分钟`; }
function formatTime(value?: string) { return value ? new Date(value).toLocaleString() : '-'; }
function senderName(message: any) {
	const senderId = Number(message?.senderMemberId);
	if (senderId === Number(trip.value?.passengerMemberId)) return `乘客 · ${message?.senderMember?.name || trip.value?.passenger?.name || '未命名'}`;
	if (senderId === Number(trip.value?.driverMemberId)) return `司机 · ${message?.senderMember?.name || trip.value?.driverEmployee?.name || '未命名'}`;
	return message?.senderMember?.name || `成员 #${senderId}`;
}
onMounted(load);
</script>

<style scoped>
.page{display:flex;flex-direction:column;gap:18px}.head{display:flex;justify-content:space-between;align-items:center}.head h2{display:inline;margin:0 0 0 12px}.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:18px}.card-title{display:flex;align-items:center;justify-content:space-between;font-weight:600}.fare-content{display:flex;flex-direction:column;gap:18px}.fare-total{display:flex;align-items:flex-end;justify-content:space-between;padding:22px 24px;border-radius:18px;background:linear-gradient(135deg,#172554,#1d4ed8);box-shadow:0 12px 28px rgba(29,78,216,.18);color:#fff}.fare-total span,.fare-total strong{display:block}.fare-total span{color:#bfdbfe;font-size:13px}.fare-total strong{margin-top:4px;font-size:36px;line-height:1.1}.journey-total{display:flex;align-items:center;gap:12px;padding-bottom:3px;color:#dbeafe}.journey-total span{color:inherit;font-size:14px}.journey-total i{width:4px;height:4px;border-radius:50%;background:#93c5fd}.fee-section{padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:#f8fafc}.section-title{color:#334155;font-size:14px;font-weight:700}.fee-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:13px}.fee-item{padding:14px;border-radius:12px;background:#fff;box-shadow:0 3px 12px rgba(15,23,42,.04)}.fee-item span,.fee-item strong,.fee-item small{display:block}.fee-item span{color:#64748b;font-size:13px}.fee-item strong{margin-top:5px;color:#0f172a;font-size:20px}.fee-item small{margin-top:5px;color:#94a3b8;line-height:1.45}.subtotal-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px dashed #cbd5e1;color:#475569}.subtotal-row strong{color:#0f172a;font-size:18px}.minimum-note{margin-top:12px;padding:10px 12px;border-radius:10px;background:#fff7ed;color:#c2410c;font-size:13px;line-height:1.5}.settlement-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.settlement-grid>div{padding:14px;border-radius:13px;background:#f1f5f9}.settlement-grid span,.settlement-grid strong{display:block}.settlement-grid span{color:#64748b;font-size:12px}.settlement-grid strong{margin-top:6px;color:#0f172a;font-size:17px}.settlement-grid strong.warning{color:#c2410c}.settlement-grid strong.success{color:#15803d}.supplement-order{padding:11px 13px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:13px}.extra-title{margin-top:2px}.messages{display:flex;max-height:420px;flex-direction:column;gap:12px;overflow:auto;padding-right:6px}.message{padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc}.message-meta{display:flex;align-items:center;gap:10px;color:#64748b;font-size:13px}.message-meta strong{margin-right:auto;color:#1f2937}.message-content{margin-top:9px;color:#334155;line-height:1.65;white-space:pre-wrap;word-break:break-word}@media(max-width:1180px){.settlement-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:960px){.grid{grid-template-columns:1fr}}@media(max-width:560px){.fare-total{align-items:flex-start;flex-direction:column;gap:16px}.fee-grid,.settlement-grid{grid-template-columns:1fr}}
</style>
