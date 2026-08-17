<template>
	<div class="page">
		<h2>内部用车配置</h2>
		<el-card v-loading="loading">
			<el-form :model="form" label-width="180px" style="max-width:760px">
				<el-divider content-position="left">派单与定位</el-divider>
				<el-form-item label="派单半径（米）"><el-input-number v-model="form.dispatchRadiusMeters" :min="100" :max="100000" /></el-form-item>
				<el-form-item label="派单超时（秒）"><el-input-number v-model="form.dispatchTimeoutSeconds" :min="10" :max="1800" /></el-form-item>
				<el-form-item label="位置刷新（秒）"><el-input-number v-model="form.locationIntervalSeconds" :min="5" :max="60" /></el-form-item>

				<el-divider content-position="left">计价规则</el-divider>
				<el-form-item label="起步价"><el-input-number v-model="form.baseFare" :min="0" :precision="2" /></el-form-item>
				<el-form-item label="包含公里数"><el-input-number v-model="form.includedDistanceKm" :min="0" :precision="2" /></el-form-item>
				<el-form-item label="包含时间（分钟）"><el-input-number v-model="form.includedDurationMinutes" :min="0" /></el-form-item>
				<el-form-item label="每公里价格"><el-input-number v-model="form.pricePerKm" :min="0" :precision="2" /></el-form-item>
				<el-form-item label="每分钟价格"><el-input-number v-model="form.pricePerMinute" :min="0" :precision="2" /></el-form-item>
				<el-form-item label="最低价"><el-input-number v-model="form.minimumFare" :min="0" :precision="2" /></el-form-item>
				<el-form-item label="允许停车费"><el-switch v-model="form.allowParkingFee" /></el-form-item>
				<el-form-item label="允许其他费用"><el-switch v-model="form.allowOtherFee" /></el-form-item>

				<el-divider content-position="left">预付与结算</el-divider>
				<el-form-item label="启用自定义预付"><el-switch v-model="form.customPrepayEnabled" /></el-form-item>
				<el-form-item label="固定预付金额（元）">
					<el-input-number v-model="form.customPrepayAmount" :min="0.01" :max="9999999999.99" :precision="2" :step="0.01" :disabled="!form.customPrepayEnabled" />
				</el-form-item>
				<el-alert
					v-if="form.customPrepayEnabled"
					type="warning"
					:closable="false"
					show-icon
					title="启用后，新行程只在线支付上述金额；最终费用高于预付时，司机可确认线下收款直接结束，也可不确认线下收款，按原流程由乘客在线支付差额。"
				/>

				<el-divider content-position="left">数据保留</el-divider>
				<el-form-item label="聊天保留天数"><el-input-number v-model="form.chatRetentionDays" :min="1" :max="3650" /></el-form-item>
				<el-form-item><el-button type="primary" :loading="saving" @click="save">保存配置</el-button></el-form-item>
			</el-form>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { rideAdminControllerSetting, rideAdminControllerUpdateSetting } from '@wash/api-client';

const loading = ref(false);
const saving = ref(false);
const form = reactive<any>({
	dispatchRadiusMeters: 3000,
	dispatchTimeoutSeconds: 90,
	baseFare: 0,
	includedDistanceKm: 0,
	includedDurationMinutes: 0,
	pricePerKm: 0,
	pricePerMinute: 0,
	minimumFare: 0,
	customPrepayEnabled: false,
	customPrepayAmount: 0.01,
	allowParkingFee: false,
	allowOtherFee: false,
	chatRetentionDays: 30,
	locationIntervalSeconds: 5,
});

async function load() {
	loading.value = true;
	try {
		const data = (await rideAdminControllerSetting() as unknown) as any;
		Object.assign(form, data, {
			baseFare: Number(data.baseFare || 0),
			includedDistanceKm: Number(data.includedDistanceKm || 0),
			pricePerKm: Number(data.pricePerKm || 0),
			pricePerMinute: Number(data.pricePerMinute || 0),
			minimumFare: Number(data.minimumFare || 0),
			customPrepayEnabled: Boolean(data.customPrepayEnabled),
			customPrepayAmount: Number(data.customPrepayAmount || 0.01),
		});
	} finally {
		loading.value = false;
	}
}

async function save() {
	if (form.customPrepayEnabled && Number(form.customPrepayAmount) < 0.01) {
		ElMessage.warning('自定义预付金额最低为 0.01 元');
		return;
	}
	saving.value = true;
	try {
		await rideAdminControllerUpdateSetting({ ...form } as any);
		ElMessage.success('配置已保存，仅影响新创建的行程');
	} finally {
		saving.value = false;
	}
}

onMounted(load);
</script>

<style scoped>
.page{display:flex;flex-direction:column;gap:16px}.page h2{margin:0}
</style>
