<template>
	<div class="ride-page">
		<div class="page-head"><div><h2>内部用车 · 实时总览</h2><p>全部司机位置与状态，实时事件到达后自动校准。</p></div><el-button :loading="loading" @click="load">刷新</el-button></div>
		<div class="stats">
			<el-card><strong>{{ drivers.length }}</strong><span>全部司机</span></el-card>
			<el-card><strong class="available">{{ count('AVAILABLE') }}</strong><span>空闲</span></el-card>
			<el-card><strong class="busy">{{ count('BUSY') }}</strong><span>忙碌</span></el-card>
			<el-card><strong>{{ count('OFFLINE') }}</strong><span>离线</span></el-card>
		</div>
		<RideAdminMap :drivers="mapDrivers" height="calc(100vh - 330px)" @driver-click="openDriver" />
		<el-drawer v-model="drawer" title="司机信息" size="420px">
			<el-descriptions v-if="selected" :column="1" border>
				<el-descriptions-item label="司机">{{ selected.driverName }}</el-descriptions-item>
				<el-descriptions-item label="状态"><el-tag :type="tagType(selected.status)">{{ statusText(selected.status) }}</el-tag></el-descriptions-item>
				<el-descriptions-item label="车辆">{{ selected.vehicle?.plateNumber || '未选择' }}</el-descriptions-item>
				<el-descriptions-item label="最后位置">{{ formatTime(selected.lastLocationAt) }}</el-descriptions-item>
			</el-descriptions>
			<el-button v-if="selected?.activeTripId" class="open-trip" type="primary" @click="$router.push(`/rides/orders/${selected.activeTripId}`)">查看当前行程</el-button>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { rideAdminControllerDrivers } from '@wash/api-client';
import RideAdminMap from '../components/ride/RideAdminMap.vue';

const loading = ref(false);
const drivers = ref<any[]>([]);
const drawer = ref(false);
const selected = ref<any>(null);
let poll: number | undefined;
let refreshTimer: number | undefined;

const mapDrivers = computed(() => drivers.value.map((item) => ({
	memberId: item.memberId,
	longitude: Number(item.longitude), latitude: Number(item.latitude),
	status: item.availabilityStatus, driverName: item.employee?.name || item.member?.name || `司机${item.memberId}`,
	lastLocationAt: item.lastLocationAt, currentVehicle: item.currentVehicle,
	vehicle: item.currentVehicle?.vehicle || null,
	activeTripId: item.member?.rideTripsAsDriver?.[0]?.id || null,
})).filter((item) => Number.isFinite(item.longitude) && Number.isFinite(item.latitude)));

async function load() {
	loading.value = true;
	try { const data = (await rideAdminControllerDrivers() as unknown) as any; drivers.value = Array.isArray(data) ? data : []; }
	finally { loading.value = false; }
}
function count(status: string) { return drivers.value.filter((item) => String(item.availabilityStatus) === status).length; }
function openDriver(driver: any) { selected.value = driver; drawer.value = true; }
function statusText(status: string) { return ({ AVAILABLE: '空闲', BUSY: '忙碌', OFFLINE: '离线' } as any)[status] || status; }
function tagType(status: string) { return status === 'AVAILABLE' ? 'success' : status === 'BUSY' ? 'warning' : 'info'; }
function formatTime(value?: string) { return value ? new Date(value).toLocaleString() : '暂无位置'; }
function onRealtime(event: Event) {
	const type = String((event as CustomEvent)?.detail?.type || '');
	if (!type.startsWith('ride:')) return;
	if (refreshTimer) window.clearTimeout(refreshTimer);
	refreshTimer = window.setTimeout(load, 250);
}
onMounted(() => { load(); window.addEventListener('admin:realtime', onRealtime); poll = window.setInterval(load, 15000); });
onBeforeUnmount(() => { window.removeEventListener('admin:realtime', onRealtime); if (poll) window.clearInterval(poll); if (refreshTimer) window.clearTimeout(refreshTimer); });
</script>

<style scoped>
.ride-page{display:flex;flex-direction:column;gap:18px}.page-head{display:flex;align-items:flex-start;justify-content:space-between}.page-head h2{margin:0;color:#0f172a}.page-head p{margin:6px 0 0;color:#64748b}.stats{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:14px}.stats :deep(.el-card__body){display:flex;align-items:baseline;gap:10px}.stats strong{font-size:28px}.stats span{color:#64748b}.available{color:#16a34a}.busy{color:#d97706}.open-trip{margin-top:20px;width:100%}
</style>
