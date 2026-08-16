<template>
	<div class="page"><div class="head"><h2>内部司机</h2><el-button :loading="loading" @click="load">刷新</el-button></div><el-card><el-table :data="items" v-loading="loading" stripe>
		<el-table-column label="司机"><template #default="{row}">{{row.employee?.name||row.member?.name||'-'}}<div class="sub">{{row.employee?.title||''}}</div></template></el-table-column>
		<el-table-column label="联系电话" prop="member.phone"/><el-table-column label="状态"><template #default="{row}"><el-tag :type="row.availabilityStatus==='AVAILABLE'?'success':row.availabilityStatus==='BUSY'?'warning':'info'">{{statusText(row.availabilityStatus)}}</el-tag></template></el-table-column>
		<el-table-column label="当前车辆"><template #default="{row}">{{row.currentVehicle?.vehicle?.plateNumber||'未选择'}} {{row.currentVehicle?.vehicle?.brand||''}} {{row.currentVehicle?.vehicle?.series||''}}</template></el-table-column>
		<el-table-column label="最后位置"><template #default="{row}">{{row.lastLocationAt?new Date(row.lastLocationAt).toLocaleString():'暂无'}}</template></el-table-column>
		<el-table-column label="当前行程"><template #default="{row}"><el-button v-if="row.member?.rideTripsAsDriver?.[0]" link type="primary" @click="$router.push(`/rides/orders/${row.member.rideTripsAsDriver[0].id}`)">#{{row.member.rideTripsAsDriver[0].id}}</el-button><span v-else>-</span></template></el-table-column>
	</el-table></el-card></div>
</template>
<script setup lang="ts">import{onMounted,ref}from'vue';import{rideAdminControllerDrivers}from'@wash/api-client';const items=ref<any[]>([]);const loading=ref(false);async function load(){loading.value=true;try{const d=(await rideAdminControllerDrivers() as unknown)as any;items.value=Array.isArray(d)?d:[]}finally{loading.value=false}}function statusText(v:string){return({AVAILABLE:'空闲',BUSY:'忙碌',OFFLINE:'离线'}as any)[v]||v}onMounted(load)</script>
<style scoped>.page{display:flex;flex-direction:column;gap:16px}.head{display:flex;justify-content:space-between;align-items:center}.head h2{margin:0}.sub{font-size:12px;color:#94a3b8;margin-top:4px}</style>
