<template>
	<div class="page"><div class="head"><h2>内部司机</h2><el-button :loading="loading" @click="load">刷新</el-button></div><el-card><el-table :data="items" v-loading="loading" stripe>
		<el-table-column label="司机"><template #default="{row}">{{row.employee?.name||row.member?.name||'-'}}<div class="sub">{{row.employee?.title||''}}</div></template></el-table-column>
		<el-table-column label="联系电话" prop="member.phone"/><el-table-column label="状态"><template #default="{row}"><el-tag :type="row.availabilityStatus==='AVAILABLE'?'success':row.availabilityStatus==='BUSY'?'warning':'info'">{{statusText(row.availabilityStatus)}}</el-tag></template></el-table-column>
		<el-table-column label="当前车辆"><template #default="{row}">{{row.currentVehicle?.vehicle?.plateNumber||'未选择'}} {{row.currentVehicle?.vehicle?.brand||''}} {{row.currentVehicle?.vehicle?.series||''}}</template></el-table-column>
		<el-table-column label="最后位置"><template #default="{row}">{{row.lastLocationAt?new Date(row.lastLocationAt).toLocaleString():'暂无'}}</template></el-table-column>
		<el-table-column label="当前行程"><template #default="{row}"><el-button v-if="row.member?.rideTripsAsDriver?.[0]" link type="primary" @click="$router.push(`/rides/orders/${row.member.rideTripsAsDriver[0].id}`)">#{{row.member.rideTripsAsDriver[0].id}}</el-button><span v-else>-</span></template></el-table-column>
		<el-table-column label="操作" width="110" fixed="right"><template #default="{row}"><el-button link type="danger" :loading="deletingMemberId===row.memberId" :disabled="!!row.member?.rideTripsAsDriver?.[0]" @click="removeDriver(row)">解除司机</el-button></template></el-table-column>
	</el-table></el-card></div>
</template>
<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { onMounted, ref } from 'vue';
import { rideAdminControllerDeleteDriver, rideAdminControllerDrivers } from '@wash/api-client';

const items = ref<any[]>([]);
const loading = ref(false);
const deletingMemberId = ref<number | null>(null);

async function load() {
	loading.value = true;
	try {
		const data = (await rideAdminControllerDrivers() as unknown) as any;
		items.value = Array.isArray(data) ? data : [];
	} finally {
		loading.value = false;
	}
}
async function removeDriver(row: any) {
	const name = row.employee?.name || row.member?.name || `司机${row.memberId}`;
	try {
		await ElMessageBox.confirm(`确认解除“${name}”的内部司机配置？历史行程、员工和会员资料会保留。`, '解除司机', { type: 'warning', confirmButtonText: '确认解除', cancelButtonText: '取消' });
	} catch {
		return;
	}
	deletingMemberId.value = Number(row.memberId);
	try {
		await rideAdminControllerDeleteDriver(Number(row.memberId));
		ElMessage.success('司机配置已解除');
		await load();
	} catch (error: any) {
		ElMessage.error(error?.message || '解除司机失败，请稍后重试');
	} finally {
		deletingMemberId.value = null;
	}
}
function statusText(value: string) { return ({ AVAILABLE: '空闲', BUSY: '忙碌', OFFLINE: '离线' } as any)[value] || value; }
onMounted(load);
</script>
<style scoped>.page{display:flex;flex-direction:column;gap:16px}.head{display:flex;justify-content:space-between;align-items:center}.head h2{margin:0}.sub{font-size:12px;color:#94a3b8;margin-top:4px}</style>
