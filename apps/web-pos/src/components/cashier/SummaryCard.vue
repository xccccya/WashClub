<template>
	<div class="summary-card">
		<div class="sc-row">
			<div class="sc-label">下单对象</div>
			<div class="sc-content">
				<el-radio-group :model-value="identity" size="large" @change="(v: any)=>emit('update:identity', v as any)">
					<el-radio-button label="guest">游客</el-radio-button>
					<el-radio-button label="member">会员</el-radio-button>
				</el-radio-group>
			</div>
		</div>
		<transition name="flip-fade" mode="out-in">
		<div class="sc-row" v-if="identity==='member'" key="member-block">
			<div class="sc-label">会员</div>
			<div class="sc-content">
				<el-autocomplete :model-value="memberKeyword" :fetch-suggestions="queryMembers" placeholder="手机号/姓名" clearable @select="onPickMember" :value-key="'name'" style="width:100%" @update:model-value="(v: any)=>emit('update:memberKeyword', String(v||''))">
					<template #default="{ item }">
						<div class="member-sug">{{ item.name }} <span class="muted">{{ item.phone }}</span></div>
					</template>
				</el-autocomplete>
				<el-button v-if="selectedMember" type="default" @click="emit('clear-member')" plain style="margin-left:8px">清除</el-button>
			</div>
		</div>
		</transition>
		<transition name="flip-fade" mode="out-in">
		<div class="sc-row" v-if="orderKind==='SERVICE'" key="vehicle-block">
			<div class="sc-label">车辆</div>
			<div class="sc-content" style="display:flex; gap:8px; align-items:center;">
				<template v-if="identity==='guest'">
					<div class="plate-wrap">
						<PlateInput ref="plateInputRef" v-model="plateModel" placeholder="点击输入车牌" :inline="true" @confirm="emit('plate-confirm')" @clear="emit('clear-guest-vehicle')" />
					</div>
				</template>
				<template v-else>
					<el-select :model-value="memberVehicleId" filterable clearable placeholder="选择或手输车牌" style="flex:1" @change="(v: any)=>emit('update:memberVehicleId', v as any)">
						<el-option v-for="v in memberVehicles" :key="v.id" :label="v.plateNumber" :value="v.id" />
					</el-select>
				</template>
			</div>
		</div>
		</transition>
		
		<div class="sc-row">
			<div class="sc-label">优惠</div>
			<div class="sc-content sc-benefit">
				<span v-if="(couponDiscountEst||0)>0">优惠券 -¥{{ (couponDiscountEst||0).toFixed(2) }}</span>
				<span v-if="memberDiscountApplied>0">会员折扣 -¥{{ memberDiscountApplied.toFixed(2) }}</span>
				<span v-if="pointsAmountYuan>0">积分抵扣 -¥{{ pointsAmountYuan.toFixed(2) }}</span>
				<span v-if="!memberDiscountApplied && !pointsAmountYuan" class="muted">暂无优惠</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import PlateInput from '../PlateInput.vue';

const props = defineProps<{ 
	orderKind: 'SERVICE'|'SP';
	identity: 'guest'|'member';
	memberKeyword: string;
	selectedMember: any|null;
	memberVehicles: Array<{ id:number; plateNumber:string }>;
	memberVehicleId?: number|undefined;
	guestVehicleId?: number|undefined;
	plateNumber: string;
	couponDiscountEst?: number;
	memberDiscountApplied: number;
	pointsAmountYuan: number;
}>();
const emit = defineEmits<{
	(e:'update:identity', v:'guest'|'member'): void;
	(e:'update:memberKeyword', v:string): void;
	(e:'update:memberVehicleId', v:number|undefined): void;
	(e:'update:plateNumber', v:string): void;
	(e:'clear-member'): void;
	(e:'plate-confirm'): void;
	(e:'quick-plate'): void;
	(e:'edit-guest-plate'): void;
	(e:'clear-guest-vehicle'): void;
	(e:'pick-member', m:any): void;
	(e:'query-members', q:string, cb:(list:any[])=>void): void;
}>();

function onPickMember(m:any){ emit('pick-member', m); }
function queryMembers(q:string, cb:(list:any[])=>void){ emit('query-members', q, cb); }

const plateInputRef = ref<any|null>(null);
const plateModel = computed({
	get(){ return props.plateNumber; },
	set(v:string){ emit('update:plateNumber', v); }
});

function openPlate(){ try{ (plateInputRef.value as any)?.open?.(); }catch{} }
defineExpose({ openPlate });
</script>

<style scoped>
.summary-card{ border:1px solid var(--el-border-color); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:12px; background:#fff; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
.sc-row{ display:grid; grid-template-columns: 88px 1fr; gap:12px; align-items:center; min-height: 56px; }
.sc-label{ color:#666; }
.sc-content{ display:flex; align-items:center; min-height: 56px; overflow:hidden; }
.sc-benefit{ display:flex; gap:10px; flex-wrap:wrap; }
.plate-wrap{ width:100%; flex: 1 1 auto; min-width: 0; }
.plate-wrap :deep(.box){ padding:6px; padding-right:42px; border-radius:10px; width:100%; max-width:100%; box-sizing:border-box; position:relative; }
.plate-wrap :deep(.cells){ display:grid !important; grid-template-columns: repeat(8, minmax(0, 1fr)); gap:2px; overflow:hidden; }
.plate-wrap :deep(.cell){ width:auto !important; height:auto !important; aspect-ratio: 1 / 1; font-size:14px; }
.plate-wrap :deep(.clear-btn){ right:6px; padding:3px 6px; font-size:12px; }
/* 将新能源徽标改为绝对定位，避免撑宽 */
.plate-wrap :deep(.nev-badge){ position:absolute; right:6px; top:6px; transform:none; display:inline-flex; flex-direction:row; gap:2px; padding:2px 4px; border-radius:6px; background:#e6fff4; color:#16a34a; font-size:10px; line-height:1; margin-left:0; pointer-events:none; z-index:1; }
.plate-wrap :deep(.nev-badge-text){ line-height:1; }
.summary-card :deep(.el-radio-button--large .el-radio-button__inner){ padding:10px 18px; }
/* 胶囊切换时轻微流光 */
.summary-card :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner){ position:relative; overflow:hidden; }
.summary-card :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner::after){
  content:''; position:absolute; top:0; bottom:0; left:-30%; width:30%;
  background: linear-gradient(90deg, rgba(255,255,255,.0), rgba(255,255,255,.6), rgba(255,255,255,.0));
  transform: skewX(-20deg);
  animation: shine-quick-2 .18s ease forwards;
}
@keyframes shine-quick-2 { to { left: 130%; } }
.wide-input :deep(.el-input__wrapper){ padding:16px 18px !important; min-height:56px !important; height:auto !important; }
.wide-input :deep(.el-input__inner){ font-size:18px !important; line-height:24px !important; }
.guest-vehicle-chip{ background-color: #f0f0f0; border-radius: 4px; padding: 4px 8px; margin-right: 8px; font-size: 14px; color: #333; }
/* 切换动效 */
.flip-fade-enter-active, .flip-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.flip-fade-enter-from { opacity: 0; transform: rotateX(12deg) translateY(-4px); transform-origin: top; }
.flip-fade-leave-to { opacity: 0; transform: rotateX(-12deg) translateY(4px); transform-origin: top; }
</style>


