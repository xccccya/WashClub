<template>
	<div class="ride-page">
		<div class="page-head"><div><h2>内部用车 · 实时总览</h2><p>全部司机位置与状态，实时事件到达后自动校准。</p></div><el-button :loading="loading" @click="load">刷新</el-button></div>
		<div class="stats">
			<el-card><strong>{{ drivers.length }}</strong><span>全部司机</span></el-card>
			<el-card><strong class="available">{{ count('AVAILABLE') }}</strong><span>空闲</span></el-card>
			<el-card><strong class="busy">{{ count('BUSY') }}</strong><span>忙碌</span></el-card>
			<el-card><strong>{{ count('OFFLINE') }}</strong><span>离线</span></el-card>
		</div>
		<div class="overview-grid">
			<RideAdminMap
				:drivers="mapDrivers"
				:highlighted-driver-id="highlightedDriverId"
				height="max(460px, calc(100vh - 330px))"
				fit-mode="initial"
				@driver-click="openDriver"
				@driver-hover="onMapDriverHover"
			/>
			<el-card class="driver-panel" shadow="never">
				<div class="driver-panel-head"><div><strong>司机列表</strong><span>悬停可定位并高亮地图标记</span></div><el-tag type="info" effect="plain">{{ overviewDrivers.length }} 人</el-tag></div>
				<div v-if="overviewDrivers.length" class="driver-list">
					<button
						v-for="driver in overviewDrivers"
						:key="driver.memberId"
						type="button"
						class="driver-item"
						:class="{ 'is-highlighted': highlightedDriverId === driver.memberId }"
						@mouseenter="highlightDriver(driver.memberId)"
						@mouseleave="clearDriverHighlight(driver.memberId)"
						@focus="highlightDriver(driver.memberId)"
						@blur="clearDriverHighlight(driver.memberId)"
						@click="openDriver(driver)"
					>
						<span class="driver-status-dot" :class="String(driver.status).toLowerCase()" />
						<span class="driver-item-copy"><strong>{{ driver.driverName }}</strong><small>{{ driver.vehicle?.plateNumber || '未选择车辆' }} · {{ formatTime(driver.lastLocationAt) }}</small></span>
						<span class="driver-item-side"><el-tag size="small" :type="tagType(driver.status)">{{ statusText(driver.status) }}</el-tag><small v-if="driver.activeTripId">行程 #{{ driver.activeTripId }}</small><small v-else-if="!driver.hasLocation">暂无定位</small></span>
					</button>
				</div>
				<el-empty v-else description="暂无内部司机" :image-size="72" />
			</el-card>
		</div>
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
const mapHoveredDriverId = ref<number | null>(null);
const listHoveredDriverId = ref<number | null>(null);
let poll: number | undefined;
let refreshTimer: number | undefined;

const normalizedDrivers = computed(() => drivers.value.map((item) => ({
	memberId: Number(item.memberId),
	longitude: Number(item.longitude), latitude: Number(item.latitude),
	status: item.availabilityStatus, driverName: item.employee?.name || item.member?.name || `司机${item.memberId}`,
	lastLocationAt: item.lastLocationAt, currentVehicle: item.currentVehicle,
	vehicle: item.currentVehicle?.vehicle || null,
	activeTripId: item.member?.rideTripsAsDriver?.[0]?.id || null,
	hasLocation: Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)),
})));
const statusOrder: Record<string, number> = { AVAILABLE: 0, BUSY: 1, OFFLINE: 2 };
const overviewDrivers = computed(() => [...normalizedDrivers.value].sort((left, right) => {
	const statusDiff = (statusOrder[left.status] ?? 9) - (statusOrder[right.status] ?? 9);
	return statusDiff || left.driverName.localeCompare(right.driverName, 'zh-CN');
}));
const mapDrivers = computed(() => normalizedDrivers.value.filter((item) => item.hasLocation));
const highlightedDriverId = computed(() => listHoveredDriverId.value ?? mapHoveredDriverId.value);

async function load() {
	loading.value = true;
	try {
		const data = (await rideAdminControllerDrivers() as unknown) as any;
		drivers.value = Array.isArray(data) ? data : [];
		if (mapHoveredDriverId.value != null && !drivers.value.some((item) => Number(item.memberId) === mapHoveredDriverId.value)) mapHoveredDriverId.value = null;
		if (listHoveredDriverId.value != null && !drivers.value.some((item) => Number(item.memberId) === listHoveredDriverId.value)) listHoveredDriverId.value = null;
		if (selected.value) selected.value = normalizedDrivers.value.find((item) => item.memberId === selected.value.memberId) || null;
	}
	finally { loading.value = false; }
}
function count(status: string) { return drivers.value.filter((item) => String(item.availabilityStatus) === status).length; }
function openDriver(driver: any) { selected.value = driver; drawer.value = true; }
function highlightDriver(memberId: number) { listHoveredDriverId.value = Number(memberId); }
function clearDriverHighlight(memberId: number) { if (listHoveredDriverId.value === Number(memberId)) listHoveredDriverId.value = null; }
function onMapDriverHover(driver: any | null) { mapHoveredDriverId.value = driver?.memberId != null ? Number(driver.memberId) : null; }
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
.ride-page{display:flex;flex-direction:column;gap:18px}.page-head{display:flex;align-items:flex-start;justify-content:space-between}.page-head h2{margin:0;color:#0f172a}.page-head p{margin:6px 0 0;color:#64748b}.stats{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:14px}.stats :deep(.el-card__body){display:flex;align-items:baseline;gap:10px}.stats strong{font-size:28px}.stats span{color:#64748b}.available{color:#16a34a}.busy{color:#d97706}.overview-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:stretch}.driver-panel{height:max(460px,calc(100vh - 330px));border-color:#dbe3ee}.driver-panel :deep(.el-card__body){display:flex;height:100%;min-height:0;flex-direction:column;padding:0;box-sizing:border-box}.driver-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid #e2e8f0}.driver-panel-head strong,.driver-panel-head span{display:block}.driver-panel-head strong{color:#0f172a;font-size:16px}.driver-panel-head span{margin-top:4px;color:#64748b;font-size:12px}.driver-list{min-height:0;flex:1;overflow-y:auto;padding:10px}.driver-item{display:grid;width:100%;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:10px;margin:0;padding:12px;border:1px solid transparent;border-radius:12px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease}.driver-item:hover,.driver-item:focus-visible,.driver-item.is-highlighted{outline:0;border-color:#93c5fd;background:#eff6ff;box-shadow:0 4px 14px rgba(37,99,235,.1)}.driver-status-dot{width:9px;height:9px;border-radius:50%;background:#64748b;box-shadow:0 0 0 4px rgba(100,116,139,.12)}.driver-status-dot.available{background:#16a34a;box-shadow:0 0 0 4px rgba(22,163,74,.12)}.driver-status-dot.busy{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.14)}.driver-item-copy{min-width:0}.driver-item-copy strong,.driver-item-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.driver-item-copy strong{color:#0f172a;font-size:14px}.driver-item-copy small{margin-top:5px;color:#64748b;font-size:11px}.driver-item-side{display:flex;align-items:flex-end;flex-direction:column;gap:5px}.driver-item-side small{color:#64748b;font-size:11px;white-space:nowrap}.open-trip{margin-top:20px;width:100%}
@media (max-width:1100px){.overview-grid{grid-template-columns:1fr}.driver-panel{height:360px}}
@media (max-width:720px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.page-head{gap:12px}.overview-grid{gap:12px}}
</style>
