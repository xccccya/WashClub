<template>
	<el-drawer
		v-model="visibleLocal"
		class="discount-drawer"
		size="460px"
		:append-to-body="true"
		:close-on-click-modal="true"
		:with-header="false"
	>
		<div class="dd-shell">
			<div class="dd-header">
				<div class="dd-title">
					<div class="dd-title-text">优惠与积分</div>
					<div class="dd-title-sub">
						<span class="k">预计券减</span>
						<b class="v">-¥{{ Number(couponDiscountEst||0).toFixed(2) }}</b>
						<span class="sep">·</span>
						<span class="k">积分抵扣</span>
						<b class="v">-¥{{ Number(pointsAmountYuan||0).toFixed(2) }}</b>
					</div>
				</div>
				<div class="dd-actions">
					<el-button text @click="visibleLocal=false">关闭</el-button>
				</div>
			</div>

			<div class="dd-body">
				<el-card ref="couponCardRef" class="dd-card" shadow="never">
					<template #header>
						<div class="dd-card-hd">
							<div class="dd-card-title">优惠券</div>
							<div class="dd-card-meta">
								<el-tag size="small" effect="plain" type="info">已选 {{ selectedCouponIdsLocal.length }}</el-tag>
								<el-button size="small" @click="clearCoupons" :disabled="selectedCouponIdsLocal.length===0">清空</el-button>
							</div>
						</div>
					</template>

					<div class="coupon-list">
						<template v-if="(memberCoupons||[]).length>0">
							<div v-for="c in memberCoupons" :key="c.id" class="coupon-item">
								<el-check-tag
									:checked="selectedCouponIdsLocal.includes(c.id)"
									:disabled="couponDisabled(c)"
									@change="(v:boolean)=>toggleCoupon(c, v)"
									class="coupon-tag"
								>
									<span class="c-name">{{ c.name || c?.coupon?.name || '优惠券' }}</span>
									<span class="c-discount">-¥{{ Number(c.discountApplied||0).toFixed(2) }}</span>
								</el-check-tag>
								<div class="coupon-meta">
									<el-tag size="small" effect="plain" type="info" v-if="couponFlag(c,'allowCombine')===false">不可叠加其他券</el-tag>
									<el-tag size="small" effect="plain" type="info" v-if="couponFlag(c,'allowStackWithPoints')===false">不可叠加积分</el-tag>
									<el-tag size="small" effect="plain" type="info" v-if="couponFlag(c,'allowStackWithMemberDiscount')===false">不可叠加会员折扣</el-tag>
								</div>
							</div>
						</template>
						<el-empty v-else description="暂无可用优惠券" :image-size="70" />
					</div>
					<div class="hint" v-if="Number(couponDiscountEst||0)>0">预计券减：-¥{{ Number(couponDiscountEst||0).toFixed(2) }}</div>
				</el-card>

				<el-card ref="pointsCardRef" class="dd-card" shadow="never">
					<template #header>
						<div class="dd-card-hd">
							<div class="dd-card-title">积分抵扣</div>
							<div class="dd-card-meta">
								<el-button size="small" @click="setUsedPoints(0)" :disabled="Number(usedPointsLocal||0)<=0">清零</el-button>
								<el-button size="small" @click="setUsedPoints(memberPointsMax||0)" :disabled="Number(memberPointsMax||0)<=0">全用</el-button>
							</div>
						</div>
					</template>

					<div class="points-row">
						<el-input-number
							:model-value="usedPointsLocal"
							:min="0"
							:max="memberPointsMax"
							:step="pointsStep"
							:disabled="!supportsPoints || !pointsAllowedByCoupons"
							@change="onPointsChange"
						/>
						<el-skeleton v-if="pointsLoading" animated :rows="1" style="flex:1; min-width: 0;" />
						<div v-else class="points-hint">
							<div class="hint" v-if="!supportsPoints">该订单内商品不支持积分抵扣</div>
							<div class="hint" v-else-if="!pointsAllowedByCoupons">所选优惠券不可与积分抵扣同享</div>
							<div class="hint" v-else>可用：{{ memberPointsMax }} ｜ 持有：{{ pointsAvailable }}</div>
						</div>
					</div>
					<div class="hint" v-if="Number(pointsAmountYuan||0)>0">预计积分抵扣：-¥{{ Number(pointsAmountYuan||0).toFixed(2) }}</div>
				</el-card>
			</div>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps<{
	modelValue: boolean;
	active?: 'coupon' | 'points';
	memberCoupons: any[];
	selectedCouponIds: number[];
	usedPoints: number;
	memberPointsMax: number;
	pointsStep: number;
	supportsPoints: boolean;
	pointsAllowedByCoupons: boolean;
	pointsAvailable?: number;
	pointsLoading?: boolean;
	couponDiscountEst?: number;
	pointsAmountYuan?: number;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', v: boolean): void;
	(e: 'update:selected-coupon-ids', v: number[]): void;
	(e: 'update:used-points', v: number): void;
	(e: 'normalize-used-points'): void;
}>();

const visibleLocal = computed({
	get() { return props.modelValue; },
	set(v: boolean) { emit('update:modelValue', v); },
});

const selectedCouponIdsLocal = computed(() => Array.isArray(props.selectedCouponIds) ? props.selectedCouponIds : []);
const usedPointsLocal = computed(() => Number(props.usedPoints || 0));
const memberCoupons = computed(() => Array.isArray(props.memberCoupons) ? props.memberCoupons : []);
const pointsAvailable = computed(() => Number(props.pointsAvailable || 0));
const pointsLoading = computed(() => !!props.pointsLoading);

const couponCardRef = ref<any>(null);
const pointsCardRef = ref<any>(null);

function couponFlag(c: any, key: 'allowCombine'|'allowStackWithPoints'|'allowStackWithMemberDiscount'): any {
	try{
		if (c && c[key] !== undefined) return c[key];
		return c?.coupon?.[key];
	}catch{ return undefined; }
}

function pickedCoupons(){
	try{
		const ids = new Set(selectedCouponIdsLocal.value);
		return memberCoupons.value.filter((c: any) => ids.has(Number(c?.id)));
	}catch{ return []; }
}
function couponDisabled(c: any){
	try{
		if (!c) return false;
		if (selectedCouponIdsLocal.value.includes(c.id)) return false;
		const picked = pickedCoupons();
		const hasNonCombine = picked.some((x: any) => couponFlag(x, 'allowCombine') === false);
		if (hasNonCombine) return true;
		if (couponFlag(c, 'allowCombine') === false && picked.length > 0) return true;
		return false;
	}catch{ return false; }
}
function toggleCoupon(c: any, checked: boolean){
	try{
		if (!c) return;
		if (checked && couponDisabled(c)) return;
		const set = new Set<number>(selectedCouponIdsLocal.value.map(Number));
		if (checked) set.add(Number(c.id));
		else set.delete(Number(c.id));
		emit('update:selected-coupon-ids', Array.from(set));
	}catch{}
}
function clearCoupons(){
	emit('update:selected-coupon-ids', []);
}

function onPointsChange(v: any){
	try{
		emit('update:used-points', Math.max(0, Math.floor(Number(v || 0))));
		emit('normalize-used-points');
	}catch{}
}
function setUsedPoints(v: any){
	try{
		emit('update:used-points', Math.max(0, Math.floor(Number(v || 0))));
		emit('normalize-used-points');
	}catch{}
}

async function scrollToActive(){
	try{
		if (!props.active) return;
		await nextTick();
		const el = props.active === 'coupon'
			? (couponCardRef.value?.$el || couponCardRef.value)
			: (pointsCardRef.value?.$el || pointsCardRef.value);
		el?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
	}catch{}
}

watch(() => props.active, () => {
	if (props.modelValue) scrollToActive();
});
watch(() => props.modelValue, (v) => {
	if (v) scrollToActive();
});
</script>

<style scoped>
.discount-drawer{
	--dd-radius: 18px;
	--dd-text: #0f172a;
	--dd-muted: #64748b;
	--dd-hint: #6b7280;
	--dd-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
}

.discount-drawer :deep(.el-drawer){
	border-top-left-radius: var(--dd-radius);
	border-bottom-left-radius: var(--dd-radius);
	overflow: hidden;
	box-shadow: var(--dd-shadow);
}
.discount-drawer :deep(.el-drawer__body){ padding: 0; background: #fff; }
.discount-drawer :deep(.el-overlay){ background-color: rgba(2, 6, 23, 0.28); }

.dd-shell{ height: 100%; display:flex; flex-direction:column; min-height:0; }
.dd-header{
	display:flex;
	align-items:flex-start;
	justify-content:space-between;
	gap: 10px;
	padding: 12px 14px 10px;
	border-bottom: 1px solid rgba(15, 23, 42, 0.06);
	background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.86) 100%);
}
.dd-title{ min-width: 0; display:flex; flex-direction:column; gap:6px; }
.dd-title-text{ font-size: 16px; font-weight: 950; color: var(--dd-text); letter-spacing: .2px; }
.dd-title-sub{ font-size: 12px; color: var(--dd-muted); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dd-title-sub .v{ color: var(--dd-text); font-weight: 950; }
.dd-title-sub .sep{ opacity:.6; }
.dd-actions{ flex: 0 0 auto; }

.dd-body{
	padding: 12px 14px 14px;
	display:flex;
	flex-direction:column;
	gap:12px;
	overflow:auto;
	min-height: 0;
}
.dd-card{
	border-radius: var(--dd-radius);
	border: 0;
	box-shadow: 0 1px 12px rgba(15, 23, 42, 0.06);
	background: rgba(255,255,255,0.96);
}
.dd-card :deep(.el-card__header){
	border-bottom: 0;
	padding: 12px 14px;
	background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.88) 100%);
}
.dd-card :deep(.el-card__body){ padding: 12px 14px 14px; }
.dd-card-hd{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.dd-card-title{ font-weight: 950; color: var(--dd-text); letter-spacing: .2px; }
.dd-card-meta{ display:flex; gap:8px; align-items:center; }
.hint{ color: var(--dd-hint); font-size:12px; margin-top: 8px; }

.coupon-list{ display:flex; flex-direction:column; gap:10px; }
.coupon-item{ display:flex; flex-direction:column; gap:6px; }
.coupon-tag{
	display:inline-flex;
	align-items:center;
	gap:8px;
	padding:10px 14px;
	border-radius:999px;
	border: 0;
	background: rgba(248,250,252,0.90);
	color: var(--dd-text);
	cursor:pointer;
	user-select:none;
	transition: all 0.2s ease;
	box-shadow: 0 1px 10px rgba(15, 23, 42, 0.04);
}
.coupon-tag.is-checked{
	background: linear-gradient(135deg, rgba(59,130,246,1), rgba(139,92,246,1));
	color:#fff;
	box-shadow: 0 10px 22px rgba(59,130,246,.18);
}
.coupon-tag.is-disabled{
	opacity: .55;
	filter: grayscale(0.15);
	cursor:not-allowed;
	box-shadow: none;
}
.coupon-meta{ display:flex; flex-wrap:wrap; gap:6px; }
.c-name{ font-size:12px; font-weight: 900; }
.c-discount{ font-size:12px; font-weight:950; color: #ef4444; }
.coupon-tag.is-checked .c-discount{ color:#fff; }

.points-row{ display:flex; gap:10px; align-items:flex-start; }
.points-hint{ min-width: 0; }
</style>
