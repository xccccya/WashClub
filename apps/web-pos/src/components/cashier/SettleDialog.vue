<template>
	<el-dialog v-model="visibleLocal" title="结算" width="620px">
		<div class="pay-box">
			<div class="summary">
				<div>类型：{{ orderKind==='SERVICE' ? '服务订单' : (orderKind==='FK' ? '付款订单' : '商品/卡券订单') }}</div>
				<div class="amt">
					<div>小计：¥{{ subtotal.toFixed(2) }}</div>
					<div v-if="orderKind==='SERVICE' && (model as any).groupId" class="hint">集团：{{ (model as any).groupName || '集团' }}（ID：{{ (model as any).groupId }}）</div>
					<div v-if="orderKind==='SP' && couponDiscountEst>0">优惠券：-¥{{ couponDiscountEst.toFixed(2) }}</div>
					<div v-if="orderKind==='SP' && couponOver>0" class="hint">券减溢出 ¥{{ couponOver.toFixed(2) }}</div>
					<div v-if="memberDiscountApplied>0">会员折扣：-¥{{ memberDiscountApplied.toFixed(2) }}</div>
					<div v-if="pointsAmountYuan>0">积分抵扣：-¥{{ pointsAmountYuan.toFixed(2) }}</div>
					<div class="row compact" v-if="orderKind!=='FK'">
						<div class="label">收银立减</div>
						<el-input-number
							v-model="model.cashierDiscountAmount"
							:min="0"
							:max="payAmountCap"
							:step="0.01"
							:precision="2"
							:controls="false"
							size="small"
							style="width: 120px;"
							class="cashier-discount-input"
							@change="onManualDiscountChange"
						/>
						<div class="hint">最多可减至 0 元；0 元仅支持内部支付</div>
					</div>
					<div class="total">应收：<b>¥{{ payAmount.toFixed(2) }}</b></div>
				</div>
			</div>
			<template v-if="orderKind==='SP'">
				<div class="row compact" v-if="hasPhysicalInCart">
					<div class="label">配送方式</div>
					<el-radio-group v-model="model.delivery" size="small">
						<el-radio-button label="PICKUP" :disabled="model.deliveryAllowPickup===false">自提/无需快递</el-radio-button>
						<el-radio-button label="EXPRESS" :disabled="model.deliveryAllowExpress===false">快递配送</el-radio-button>
					</el-radio-group>
				</div>
				<div class="row compact" v-if="hasPhysicalInCart && model.delivery==='EXPRESS' && identity==='member' && selectedMember">
					<div class="label">收货地址</div>
					<el-select v-model="model.shippingAddressId" filterable placeholder="选择收货地址" style="width:100%">
						<el-option v-for="a in model.memberAddresses" :key="a.id" :label="addrDisplay(a)" :value="a.id" />
					</el-select>
					<el-button @click="$emit('open-create-member-address')">新建</el-button>
					<el-button @click="$emit('open-manage-member-address')" type="primary" plain>管理</el-button>
				</div>
				<div class="row compact" v-if="hasPhysicalInCart && model.delivery==='EXPRESS' && identity==='member' && model.showMemberAddrForm">
					<div class="label">新增地址</div>
					<div style="display:flex; flex-direction:column; gap:6px; width:100%">
						<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px;">
							<el-input v-model="model.addrForm.province" placeholder="省" />
							<el-input v-model="model.addrForm.city" placeholder="市" />
							<el-input v-model="model.addrForm.district" placeholder="区/县" />
						</div>
						<el-input v-model="model.addrForm.street" placeholder="街道" />
						<el-input v-model="model.addrForm.detail" placeholder="详细地址" />
						<div style="display:grid; grid-template-columns: 1fr 120px; gap:6px;">
							<el-input v-model="model.addrForm.phone" placeholder="手机号" maxlength="11" />
							<el-input v-model="model.addrForm.label" placeholder="标签(可选)" maxlength="4" />
						</div>
					</div>
				</div>
				<div class="row compact" v-if="hasPhysicalInCart && model.delivery==='EXPRESS' && identity==='guest'">
					<div class="label">收货地址</div>
					<div style="display:flex; flex-direction:column; gap:6px; width:100%">
						<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px;">
							<el-input v-model="model.addrForm.province" placeholder="省" />
							<el-input v-model="model.addrForm.city" placeholder="市" />
							<el-input v-model="model.addrForm.district" placeholder="区/县" />
						</div>
						<el-input v-model="model.addrForm.street" placeholder="街道" />
						<el-input v-model="model.addrForm.detail" placeholder="详细地址" />
						<div style="display:grid; grid-template-columns: 1fr 120px; gap:6px;">
							<el-input v-model="model.addrForm.phone" placeholder="手机号" maxlength="11" />
							<el-input v-model="model.addrForm.label" placeholder="标签(可选)" maxlength="4" />
						</div>
					</div>
				</div>
				<div class="coupon-section" v-if="identity==='member' && selectedMember">
					<div class="section-label">优惠券</div>
					<div class="coupon-list">
						<template v-if="(memberCoupons||[]).length>0">
							<div v-for="c in memberCoupons" :key="c.id" 
								class="coupon-chip" 
								:class="{ active: selectedCouponIds.includes(c.id), disabled: disabledByCombine(c) }" 
								@click="()=>toggleCoupon(c)">
								<span class="c-name">{{ c.name || c?.coupon?.name || '优惠券' }}</span>
								<span class="c-discount">-¥{{ Number(c.discountApplied||0).toFixed(2) }}</span>
								<span class="c-tag" v-if="!isAllowCombine(c)">不可叠加其他券</span>
								<span class="c-tag" v-if="!isAllowStackWithPoints(c)">不可叠加积分抵扣</span>
								<span class="c-tag" v-if="!isAllowStackWithMemberDiscount(c)">不可叠加会员折扣</span>
							</div>
						</template>
						<div class="hint" v-else>暂无可用优惠券</div>
					</div>
					<div class="hint" v-if="orderKind==='SP' && couponDiscountEst>0">预计券减：-¥{{ couponDiscountEst.toFixed(2) }}</div>
				</div>
				<div class="row compact" v-if="identity==='member' && selectedMember">
					<div class="label">积分抵扣</div>
					<el-input-number :model-value="usedPoints" :min="0" :max="memberPointsMax" :step="pointsStep" :disabled="!selectedMember || !supportsPoints || !pointsAllowedByCoupons" @change="onUsedPointsChange" />
					<div class="hint" v-if="!supportsPoints">该订单内商品不支持积分抵扣</div>
					<div class="hint" v-else-if="!pointsAllowedByCoupons">所选优惠券不可与积分抵扣同享</div>
					<div class="hint" v-else>可用：{{ memberPointsMax }} ｜ 持有：{{ pointsAvailable }}</div>
				</div>
				<div class="row compact" v-if="identity==='member' && selectedMember">
					<div class="label">会员折扣</div>
					<el-switch
						:model-value="enableMemberDiscount"
						:disabled="!computedMemberDiscountSupported || !computedMemberDiscountAllowed"
						@change="(v:any)=>$emit('update:enableMemberDiscount', !!v)"
					/>
					<div class="hint" v-if="!computedMemberDiscountSupported">该订单内商品不支持会员折扣</div>
					<div class="hint" v-else-if="!computedMemberDiscountAllowed">所选优惠券不可与会员折扣同享</div>
				</div>
			</template>
			<template v-if="orderKind==='SERVICE'">
				<el-alert v-if="payAfterService" type="info" show-icon :closable="false" title="先服务后付：可入队，支付完成后或服务完成时再结算" />
				<div class="row" v-if="payAfterService">
					<div class="label">队列类型</div>
					<el-select v-model="model.queueTypeId" filterable placeholder="选择队列类型">
						<el-option v-for="qt in queueTypes" :key="qt.id" :label="qt.name" :value="qt.id" />
					</el-select>
				</div>
				<div class="row" v-if="payAfterService">
					<div class="label">服务商品</div>
					<el-select v-model="model.serviceProductIds" multiple filterable placeholder="选择可入队的服务商品">
						<el-option v-for="it in serviceProductsInCart" :key="it.productId" :label="it.name" :value="it.productId" />
					</el-select>
				</div>
			</template>
			<el-tabs v-if="!(orderKind==='SERVICE' && payAfterService)" v-model="model.tab" type="border-card">
				<el-tab-pane label="微信付款码" name="wx">
					<div class="pay-section">
						<el-input v-model="model.wxAuthCode" placeholder="请扫描顾客微信付款码或手动输入授权码" />
						<el-button type="primary" :loading="model.loading" :disabled="Number(payAmount)<=0" @click="$emit('confirm-wx')">提交</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane label="现金/线下" name="manual">
					<div class="pay-section">
						<div class="row"><el-radio-group v-model="model.manualMethod"><el-radio label="CASH">现金</el-radio><el-radio label="OFFLINE">线下</el-radio><el-radio label="SHOUQIANBA">收钱吧</el-radio></el-radio-group></div>
						<el-button type="primary" :loading="model.loading" @click="$emit('confirm-manual')">确认收款</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane v-if="orderKind==='SERVICE'" label="洗车卡划扣" name="wash">
					<div class="pay-section">
						<div class="row">
							<div class="label">划扣优先</div>
							<el-radio-group v-model="model.washPrefer">
								<el-radio label="AUTO">自动</el-radio>
								<el-radio label="MEMBER">个人卡优先</el-radio>
								<el-radio label="GROUP">集团卡优先</el-radio>
							</el-radio-group>
						</div>
						<el-button type="primary" :loading="model.loading" @click="$emit('confirm-wash')">确认划扣</el-button>
						<div class="hint">仅服务订单支持洗车卡划扣</div>
					</div>
				</el-tab-pane>
			</el-tabs>
		</div>
		<template #footer>
			<template v-if="orderKind==='SERVICE' && payAfterService">
				<el-button @click="visibleLocal=false">取消</el-button>
				<el-button type="primary" :loading="model.loading" @click="$emit('confirm-enqueue')">确认入队</el-button>
			</template>
			<template v-else>
				<el-button @click="visibleLocal=false">关闭</el-button>
			</template>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
const props = defineProps<{ 
	modelValue: boolean;
	model: any;
	orderKind: 'SERVICE'|'SP'|'FK';
	subtotal: number;
	payAmount: number;
	payAmountCap?: number;
	couponDiscountEst: number;
	couponOver: number;
	memberDiscountApplied: number;
	pointsAmountYuan: number;
	hasPhysicalInCart: boolean;
	identity: 'guest'|'member';
	selectedMember: any|null;
	memberCoupons: any[];
	selectedCouponIds: number[];
	usedPoints: number;
	memberPointsMax: number;
	pointsStep: number;
	supportsPoints: boolean;
	pointsAllowedByCoupons: boolean;
	enableMemberDiscount: boolean;
	supportsMemberDiscount?: boolean;
	serviceProductsInCart: any[];
	queueTypes: any[];
	addrDisplay: (a:any)=>string;
	payAfterService?: boolean;
	pointsAvailable?: number;
}>();
const emit = defineEmits<{ 
	(e:'update:modelValue', v:boolean): void;
	(e:'update:selectedCouponIds', v:number[]): void;
	(e:'update:usedPoints', v:number): void;
	(e:'update:enableMemberDiscount', v:boolean): void;
	(e:'confirm-manual'): void;
	(e:'confirm-wx'): void;
	(e:'confirm-wash'): void;
	(e:'confirm-enqueue'): void;
	(e:'open-create-member-address'): void;
	(e:'open-manage-member-address'): void;
	(e:'normalize-used-points'): void;
}>();

const visibleLocal = computed({ get(){ return props.modelValue; }, set(v:boolean){ emit('update:modelValue', v); } });
const model = computed(()=> props.model);

function couponLabel(c:any){ const name = c?.name || c?.coupon?.name || '优惠券'; const fv = Number(c?.coupon?.faceValue || c?.faceValue || 0); return `${name}（¥${fv}）`; }
function isCouponOptionDisabled(c:any){ if (!c) return false; if (props.selectedCouponIds.includes(c.id)) return false; const picked = (props.memberCoupons||[]).filter((x:any)=> props.selectedCouponIds.includes(x.id)); const allAllow = picked.every((x:any)=> x?.allowCombine !== false); if (!allAllow) return true; return false; }
function onCouponsChange(v:any){ emit('update:selectedCouponIds', Array.isArray(v)? v as number[] : []); }

function onUsedPointsChange(v:any){ emit('update:usedPoints', Number(v||0)); emit('normalize-used-points'); }

const addrDisplay = props.addrDisplay;
const queueTypes = computed(()=> props.queueTypes);
const serviceProductsInCart = computed(()=> props.serviceProductsInCart);
const orderKind = computed(()=> props.orderKind);
const subtotal = computed(()=> props.subtotal);
const couponDiscountEst = computed(()=> props.couponDiscountEst);
const couponOver = computed(()=> props.couponOver);
const memberDiscountApplied = computed(()=> props.memberDiscountApplied);
const pointsAmountYuan = computed(()=> props.pointsAmountYuan);
const payAmountCap = computed(()=> {
  try{ return Number(props.payAmountCap ?? props.payAmount ?? 0); }catch{ return 0; }
});
const payAmount = computed(()=> props.payAmount);
const hasPhysicalInCart = computed(()=> props.hasPhysicalInCart);
const identity = computed(()=> props.identity);
const selectedMember = computed(()=> props.selectedMember);
const memberCoupons = computed(()=> props.memberCoupons);
const selectedCouponIds = computed(()=> props.selectedCouponIds);
const usedPoints = computed(()=> props.usedPoints);
const memberPointsMax = computed(()=> props.memberPointsMax);
const pointsStep = computed(()=> props.pointsStep);
const supportsPoints = computed(()=> props.supportsPoints);
const pointsAllowedByCoupons = computed(()=> props.pointsAllowedByCoupons);
const enableMemberDiscount = computed(()=> props.enableMemberDiscount);
const payAfterService = computed(()=> !!props.payAfterService);
const pointsAvailable = computed(()=> Number(props.pointsAvailable||0));

// 钳制手动立减：不得小于0，不得超过当前应收
function onManualDiscountChange(){
  try{
    let v = Number((model as any).value?.cashierDiscountAmount||0);
    if (!Number.isFinite(v)) v = 0;
    v = Math.floor(v * 100) / 100; // 去除多位小数
    const cap = Number(payAmountCap.value||0);
    const n = Math.max(0, Math.min(v, cap));
    (model as any).value.cashierDiscountAmount = Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  }catch{}
}

// 当上限变化（如选券/改积分/改清单）时，自动钳制已填的立减金额
watch(payAmountCap, (cap)=>{
  try{
    const cur = Number((model as any).value?.cashierDiscountAmount||0);
    if (!Number.isFinite(cur)) { (model as any).value.cashierDiscountAmount = 0; return; }
    const n = Math.max(0, Math.min(cur, Number(cap||0)));
    (model as any).value.cashierDiscountAmount = Number(n.toFixed(2));
  }catch{}
});

// 在弹窗内部也给出会员折扣与所选券的互斥计算，避免直接依赖父层的 computed 名称
const computedMemberDiscountAllowed = computed(()=>{
  try{
    const ids = Array.isArray(props.selectedCouponIds) ? props.selectedCouponIds : [];
    const list = Array.isArray(props.memberCoupons) ? props.memberCoupons : [];
    const picked = list.filter((c:any)=> ids.includes(c.id));
    return picked.every((c:any)=> isAllowStackWithMemberDiscount(c));
  }catch{ return true; }
});
const computedMemberDiscountSupported = computed(()=> !!props.supportsMemberDiscount);

// 修复：与小程序逻辑保持一致，只有明确为 false 时才禁止叠加
function isAllowCombine(c:any){ 
  try{ 
    return (c?.allowCombine !== false);
  }catch{ return true; } 
}
function isAllowStackWithPoints(c:any){ 
  try{ 
    return (c?.allowStackWithPoints !== false);
  }catch{ return true; } 
}
function isAllowStackWithMemberDiscount(c:any){ 
  try{ 
    return (c?.allowStackWithMemberDiscount !== false);
  }catch{ return true; } 
}

function disabledByCombine(c:any){
  try{
    if (!c) return false;
    // 如果当前券已选中，不禁用（允许取消选择）
    if (props.selectedCouponIds.includes(c.id)) return false;
    
    const picked = (props.memberCoupons||[]).filter((x:any)=> props.selectedCouponIds.includes(x.id));
    
    // 如果已选择的券中有不允许叠加的，则禁用当前券
    const hasNonCombine = picked.some((x:any)=> !isAllowCombine(x));
    if (hasNonCombine) return true;
    
    // 如果当前券不允许叠加且已有其他券被选择，则禁用当前券
    if (!isAllowCombine(c) && picked.length > 0) return true;
    
    return false;
  }catch{ return false; }
}

function toggleCoupon(c:any){
  try{
    if (!c) return;
    if (disabledByCombine(c)) return;
    
    
    const set = new Set<number>(Array.isArray(props.selectedCouponIds) ? props.selectedCouponIds : []);
    const wasSelected = set.has(c.id);
    
    if (wasSelected) {
      set.delete(c.id);
    } else {
      set.add(c.id);
    }
    
    const newIds = Array.from(set);
    emit('update:selectedCouponIds', newIds);
    
    // 选择券后检查叠加规则，自动调整积分和会员折扣
    checkAndAdjustForCouponChanges(newIds);
    
  }catch{}
}

// 检查券变化后的叠加规则调整
function checkAndAdjustForCouponChanges(selectedIds: number[]){
  try{
    const picked = (props.memberCoupons||[]).filter((x:any)=> selectedIds.includes(x.id));
    
    // 检查是否允许积分叠加
    const pointsAllowed = picked.every((x:any)=> isAllowStackWithPoints(x));
    if (!pointsAllowed && props.usedPoints > 0) {
      // 自动清空积分
      emit('update:usedPoints', 0);
    }
    
    // 检查是否允许会员折扣叠加
    const memberDiscountAllowed = picked.every((x:any)=> isAllowStackWithMemberDiscount(x));
    if (!memberDiscountAllowed && props.enableMemberDiscount) {
      // 自动关闭会员折扣
      emit('update:enableMemberDiscount', false);
    }
  }catch{}
}
</script>

<style scoped>
.pay-box{ display:flex; flex-direction:column; gap:10px; }
.pay-box .summary{ background:#f9fafb; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; }
.pay-box .amt{ display:flex; flex-direction:column; gap:6px; }
.hint{ color:#909399; font-size:12px; }
.row{ display:grid; grid-template-columns: 92px auto 1fr; gap:8px; align-items:center; }
.row.compact{ grid-template-columns: 72px auto 1fr; }
.label{ color:#666; }
.total b{ color: var(--el-color-primary); font-size:18px; }
.pay-section{ display:flex; flex-direction:column; gap:10px; }
/* 优惠券标签样式（对齐小程序风格） */
.coupon-section{ margin: 10px 0; }
.section-label{ color:#666; font-size:14px; margin-bottom:8px; }
.coupon-list{ display:flex; flex-wrap:wrap; gap:8px; }
.coupon-chip{ 
  display:inline-flex; 
  align-items:center; 
  gap:8px; 
  padding:10px 14px; 
  border-radius:999px; 
  border:2px solid #e5e7eb; 
  background:#fff; 
  color:#111827; 
  cursor:pointer; 
  user-select:none;
  transition: all 0.2s ease;
}
.coupon-chip.active{ 
  background: linear-gradient(135deg, #60a5fa, #a78bfa); 
  color:#fff; 
  border-color: transparent; 
}
.coupon-chip.disabled{ 
  opacity: .6; 
  cursor:not-allowed; 
}
.coupon-chip .c-name{ font-size:12px; }
.coupon-chip .c-discount{ font-size:12px; font-weight:700; color:#ef4444; }
.coupon-chip.active .c-discount{ color:#fff; }
.coupon-chip .c-tag{ 
  font-size:10px; 
  color:#374151; 
  background:#f3f4f6; 
  padding:2px 8px; 
  border-radius:999px; 
  margin-left:4px;
}
.coupon-chip.active .c-tag{ 
  color:#111827; 
  background:rgba(255,255,255,0.3); 
}

/* 放大收银立减输入框中的数字 */
.cashier-discount-input :deep(.el-input__wrapper){ padding: 6px 10px; }
.cashier-discount-input :deep(.el-input__inner){ font-size: 18px; font-weight: 700; }
</style>




