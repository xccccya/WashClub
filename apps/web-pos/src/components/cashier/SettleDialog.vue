<template>
	<el-dialog
		v-model="visibleLocal"
		title="结算"
		width="820px"
		class="settle-dialog"
		:close-on-click-modal="false"
		@closed="stopScan"
	>
		<div class="settle">
			<div class="settle-head">
				<el-card class="sd-card sd-order" shadow="never">
					<template #header>
						<div class="sd-card-hd">
							<div class="tags">
								<el-tag effect="plain" type="info">
									{{ orderKind==='SERVICE' ? '服务订单' : (orderKind==='FK' ? '付款订单' : '商品/卡券订单') }}
								</el-tag>
								<el-tag v-if="orderKind==='SERVICE' && (model as any).groupId" effect="plain" type="warning">
									集团：{{ (model as any).groupName || '集团' }}
								</el-tag>
							</div>
							<div v-if="orderKind==='SERVICE' && (model as any).groupId" class="hint mono">集团ID：{{ (model as any).groupId }}</div>
						</div>
					</template>

					<el-descriptions :column="2" border class="sd-desc">
						<el-descriptions-item label="小计">
							<span class="money">¥{{ subtotal.toFixed(2) }}</span>
						</el-descriptions-item>
						<el-descriptions-item v-if="orderKind!=='FK' && couponDiscountEst>0" label="优惠券">
							<span class="money neg">-¥{{ couponDiscountEst.toFixed(2) }}</span>
						</el-descriptions-item>
						<el-descriptions-item v-if="memberDiscountApplied>0" label="会员折扣">
							<span class="money neg">-¥{{ memberDiscountApplied.toFixed(2) }}</span>
						</el-descriptions-item>
						<el-descriptions-item v-if="pointsAmountYuan>0" label="积分抵扣">
							<span class="money neg">-¥{{ pointsAmountYuan.toFixed(2) }}</span>
						</el-descriptions-item>
					</el-descriptions>

					<el-alert
						v-if="orderKind!=='FK' && couponOver>0"
						class="sd-alert"
						type="warning"
						show-icon
						:closable="false"
						title=""
						:description="`券减溢出 ¥${couponOver.toFixed(2)}（已按规则处理）`"
					/>

					<div class="settle-form" v-if="orderKind!=='FK'">
						<div class="field">
							<div class="field-label">收银立减</div>
							<div class="field-control">
								<div class="discount-row">
									<el-input-number
										v-model="model.cashierDiscountAmount"
										:min="0"
										:max="payAmountCap"
										:step="0.01"
										:precision="2"
										:controls="false"
										size="large"
										style="width: 190px;"
										class="cashier-discount-input"
										@change="onManualDiscountChange"
									/>
									<el-button-group class="quick-btns">
										<el-button size="large" @click="setCashierDiscount(0)">清零</el-button>
										<el-button size="large" @click="setCashierDiscount(payAmountCap)">全免</el-button>
									</el-button-group>
									<div class="hint">最多可减至 0 元；0 元仅支持内部支付</div>
								</div>
							</div>
						</div>
					</div>
				</el-card>

				<el-card class="sd-card sd-amount" shadow="never">
					<template #header>
						<div class="sd-card-hd">
							<div class="sd-amount-label">应收</div>
							<el-tag v-if="Number(payAmount||0) <= 0" effect="plain" type="warning">零元</el-tag>
						</div>
					</template>
					<div class="sd-amount-value">¥{{ payAmount.toFixed(2) }}</div>
					<div class="sd-amount-tip hint">核对金额后再确认收款</div>
					<el-alert
						v-if="Number(payAmount||0) <= 0"
						class="sd-alert"
						type="info"
						show-icon
						:closable="false"
						title=""
						description="零元订单不支持微信付款码，请使用“现金/线下”或其他内部方式。"
					/>
				</el-card>
			</div>

			<template v-if="orderKind!=='FK'">
				<!-- 仅商品/卡券订单需要配送信息 -->
				<el-card class="sd-card" shadow="never" v-if="orderKind==='SP' && hasPhysicalInCart">
					<template #header>
						<div class="panel-title">配送信息</div>
					</template>
					<div class="row compact">
						<div class="label">配送方式</div>
						<el-radio-group v-model="model.delivery" size="large">
							<el-radio-button value="PICKUP" :disabled="model.deliveryAllowPickup===false">自提/无需快递</el-radio-button>
							<el-radio-button value="EXPRESS" :disabled="model.deliveryAllowExpress===false">快递配送</el-radio-button>
						</el-radio-group>
					</div>
					<div class="row compact" v-if="model.delivery==='EXPRESS' && identity==='member' && selectedMember">
						<div class="label">收货地址</div>
						<el-select v-model="model.shippingAddressId" filterable placeholder="选择收货地址" style="width:100%">
							<el-option v-for="a in model.memberAddresses" :key="a.id" :label="addrDisplay(a)" :value="a.id" />
						</el-select>
						<el-button size="large" @click="$emit('open-create-member-address')">新建</el-button>
						<el-button size="large" @click="$emit('open-manage-member-address')" type="primary" plain>管理</el-button>
					</div>
					<div class="row compact" v-if="model.delivery==='EXPRESS' && identity==='member' && model.showMemberAddrForm">
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
					<div class="row compact" v-if="model.delivery==='EXPRESS' && identity==='guest'">
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
				</el-card>

				<el-card class="sd-card" shadow="never" v-if="identity==='member' && selectedMember">
					<template #header>
						<div class="panel-title">优惠</div>
					</template>
					<div class="coupon-section">
						<div class="section-label">优惠券</div>
						<div class="coupon-list">
							<template v-if="(memberCoupons||[]).length>0">
								<div v-for="c in memberCoupons" :key="c.id" class="coupon-item">
									<el-check-tag
										:checked="selectedCouponIds.includes(c.id)"
										:disabled="disabledByCombine(c)"
										@change="(v:boolean)=>onToggleCoupon(c, v)"
										class="coupon-tag"
									>
										<span class="c-name">{{ c.name || c?.coupon?.name || '优惠券' }}</span>
										<span class="c-discount">-¥{{ Number(c.discountApplied||0).toFixed(2) }}</span>
									</el-check-tag>
									<div class="coupon-meta">
										<el-tag size="small" effect="plain" type="info" v-if="!isAllowCombine(c)">不可叠加其他券</el-tag>
										<el-tag size="small" effect="plain" type="info" v-if="!isAllowStackWithPoints(c)">不可叠加积分</el-tag>
										<el-tag size="small" effect="plain" type="info" v-if="!isAllowStackWithMemberDiscount(c)">不可叠加会员折扣</el-tag>
									</div>
								</div>
							</template>
							<div class="hint" v-else>暂无可用优惠券</div>
						</div>
						<div class="hint" v-if="couponDiscountEst>0">预计券减：-¥{{ couponDiscountEst.toFixed(2) }}</div>
					</div>
					<div class="row compact">
						<div class="label">积分抵扣</div>
						<el-input-number :model-value="usedPoints" :min="0" :max="memberPointsMax" :step="pointsStep" :disabled="!selectedMember || !supportsPoints || !pointsAllowedByCoupons" @change="onUsedPointsChange" />
						<div class="hint" v-if="!supportsPoints">该订单内商品不支持积分抵扣</div>
						<div class="hint" v-else-if="!pointsAllowedByCoupons">所选优惠券不可与积分抵扣同享</div>
						<div class="hint" v-else>可用：{{ memberPointsMax }} ｜ 持有：{{ pointsAvailable }}</div>
					</div>
					<div class="row compact">
						<div class="label">会员折扣</div>
						<el-switch
							:model-value="enableMemberDiscount"
							:disabled="!computedMemberDiscountSupported || !computedMemberDiscountAllowed"
							@change="(v:any)=>$emit('update:enableMemberDiscount', !!v)"
						/>
						<div class="hint" v-if="!computedMemberDiscountSupported">该订单内商品不支持会员折扣</div>
						<div class="hint" v-else-if="!computedMemberDiscountAllowed">所选优惠券不可与会员折扣同享</div>
					</div>
				</el-card>
			</template>

			<el-card class="sd-card" shadow="never">
				<template #header>
					<div class="panel-title">支付方式</div>
				</template>
				<el-tabs v-model="model.tab" class="settle-tabs" stretch>
					<el-tab-pane label="微信付款码" name="wx" :disabled="!wxPayEnabled">
						<div class="pay-section">
							<div class="field">
								<div class="field-label">付款码</div>
								<div class="field-control">
									<el-input
										ref="wxInputRef"
										v-model="model.wxAuthCode"
										inputmode="numeric"
										size="large"
										placeholder="请扫描/输入顾客微信付款码（18-24位数字）"
										maxlength="24"
										:disabled="!wxPayEnabled"
									/>
								</div>
							</div>
							<div class="wx-actions">
								<el-button size="large" @click="openScan" :disabled="!wxPayEnabled">打开摄像头识别</el-button>
								<el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="onSelectImage" :disabled="!wxPayEnabled">
									<el-button size="large">从图片识别</el-button>
								</el-upload>
								<div v-if="wxCodeTail" class="wx-ok">已识别尾号 {{ wxCodeTail }}</div>
							</div>
							<div class="note">提示：仅用于线下收银；识别成功后会自动填入付款码，你也可以手动修改。</div>
						</div>
					</el-tab-pane>
					<el-tab-pane label="现金/线下" name="manual">
						<div class="pay-section">
							<div class="row no-label">
								<el-radio-group v-model="model.manualMethod" size="large">
									<el-radio value="CASH">现金</el-radio>
									<el-radio value="OFFLINE">线下</el-radio>
									<el-radio value="SHOUQIANBA">收钱吧</el-radio>
								</el-radio-group>
							</div>
						</div>
					</el-tab-pane>
					<el-tab-pane v-if="orderKind==='SERVICE'" label="洗车卡划扣" name="wash">
						<div class="pay-section">
							<div class="field">
								<div class="field-label">划扣优先</div>
								<div class="field-control">
									<el-radio-group v-model="model.washPrefer" size="large">
										<el-radio value="AUTO">自动</el-radio>
										<el-radio value="MEMBER">个人卡优先</el-radio>
										<el-radio value="GROUP">集团卡优先</el-radio>
									</el-radio-group>
								</div>
							</div>
							<div class="hint">仅服务订单支持洗车卡划扣</div>
						</div>
					</el-tab-pane>
				</el-tabs>
			</el-card>

			<div class="settle-actions">
				<el-button size="large" @click="visibleLocal=false">取消</el-button>
				<el-button
					size="large"
					type="primary"
					:loading="model.loading"
					:disabled="primaryDisabled"
					@click="doPrimaryAction"
				>
					{{ primaryLabel }}
				</el-button>
			</div>
		</div>
		<el-dialog v-model="showScan" title="摄像头识别付款码" width="820px" @closed="stopScan" append-to-body>
			<div class="scan-wrap">
				<video ref="videoRef" class="video" playsinline muted></video>
				<canvas ref="canvasRef" style="display:none;"></canvas>
				<div class="scan-tip">将顾客付款码对准摄像头，系统会自动识别</div>
			</div>
			<template #footer>
				<el-button @click="showScan=false">关闭</el-button>
			</template>
		</el-dialog>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
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
	addrDisplay: (a:any)=>string;
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
	(e:'open-create-member-address'): void;
	(e:'open-manage-member-address'): void;
	(e:'normalize-used-points'): void;
}>();

const visibleLocal = computed({ get(){ return props.modelValue; }, set(v:boolean){ emit('update:modelValue', v); } });
const model = computed(()=> props.model);

function onUsedPointsChange(v:any){ emit('update:usedPoints', Number(v||0)); emit('normalize-used-points'); }

const addrDisplay = props.addrDisplay;
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
const pointsAvailable = computed(()=> Number(props.pointsAvailable||0));

const wxInputRef = ref<any>(null);
const wxPayEnabled = computed(()=> Number(payAmount.value||0) > 0);

const primaryLabel = computed(()=>{
	try{
		const tab = String((model as any).value?.tab || 'wx');
		if (tab === 'manual') return '确认收款';
		if (tab === 'wash') return '确认划扣';
		return '发起收款';
	}catch{ return '确认'; }
});
const primaryDisabled = computed(()=>{
	try{
		// 零元订单：微信不允许；其他方式由后端校验
		const tab = String((model as any).value?.tab || 'wx');
		if (tab === 'wx') return Number(payAmount.value||0) <= 0;
		return false;
	}catch{ return false; }
});
function doPrimaryAction(){
	try{
		const tab = String((model as any).value?.tab || 'wx');
		if (tab === 'manual') { emit('confirm-manual'); return; }
		if (tab === 'wash') { emit('confirm-wash'); return; }
		emit('confirm-wx');
	}catch{}
}

// 摄像头/图片识别付款码（与后台标记支付一致）
const showScan = ref(false);
const videoRef = ref<HTMLVideoElement|null>(null);
const canvasRef = ref<HTMLCanvasElement|null>(null);
let mediaStream: MediaStream | null = null;
let scanTimer: any = null;
let decoding = false;
const wxCodeTail = computed(()=>{
  try{
    const s = String((model as any).value?.wxAuthCode||'').trim();
    return (/^\d{18,24}$/.test(s)) ? s.slice(-4) : '';
  }catch{ return ''; }
});
async function openScan(){
  try{
    showScan.value = true;
    await nextTick();
    await startCamera();
  }catch{}
}
async function startCamera(){
  try{
    await stopScan();
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (!videoRef.value) return;
    videoRef.value.srcObject = mediaStream as any;
    await videoRef.value.play();
    startDecodeLoop();
  }catch(e:any){
    showScan.value = false;
    ElMessage.error('无法打开摄像头：' + String(e?.message||e||''));
  }
}
function startDecodeLoop(){
  const br = new BrowserMultiFormatReader();
  scanTimer = setInterval(async ()=>{
    if (decoding) return;
    decoding = true;
    try{
      if (!videoRef.value) return;
      const video:any = videoRef.value;
      const canvas = canvasRef.value;
      if (!canvas) return;
      const w = video.videoWidth; const h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const res = await br.decodeFromImage(undefined as any, canvas.toDataURL('image/png'));
      const text = String((res as any)?.getText?.()||'').trim();
      if (/^\d{18,24}$/.test(text)){
        (model as any).value.wxAuthCode = text;
        ElMessage.success('识别成功');
        showScan.value = false;
        stopScan();
      }
    }catch(err:any){
      if (!(err instanceof NotFoundException)){
        // 非 NotFound 时也不弹错（避免频繁刷屏），交由用户手动关闭或改用图片识别
      }
    }finally{
      decoding = false;
    }
  }, 450);
}
function stopScan(){
  try{ if (scanTimer){ clearInterval(scanTimer); scanTimer = null; } }catch{}
  try{ decoding = false; }catch{}
  try{ if (videoRef.value){ videoRef.value.pause(); (videoRef.value as any).srcObject = null; } }catch{}
  try{ if (mediaStream){ mediaStream.getTracks().forEach(t=> t.stop()); mediaStream = null; } }catch{}
}
async function onSelectImage(file: any){
  try{
    const f = file?.raw || file?.target?.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async ()=>{
      try{
        const img = new Image();
        img.onload = async ()=>{
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d'); if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          const br = new BrowserMultiFormatReader();
          const res = await br.decodeFromImage(undefined as any, canvas.toDataURL('image/png'));
          const text = String((res as any)?.getText?.()||'').trim();
          if (/^\d{18,24}$/.test(text)) { (model as any).value.wxAuthCode = text; ElMessage.success('识别成功'); }
          else { ElMessage.error('未检测到有效付款码'); }
        };
        img.onerror = ()=> ElMessage.error('图片读取失败');
        img.src = String(reader.result||'');
      }catch{ ElMessage.error('识别失败'); }
    };
    reader.onerror = ()=> ElMessage.error('图片读取失败');
    reader.readAsDataURL(f);
  }catch{ ElMessage.error('识别失败'); }
}
onUnmounted(()=>{ stopScan(); });

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

function setCashierDiscount(v:any){
  try{
    const cap = Number(payAmountCap.value||0);
    let n = Number(v||0);
    if (!Number.isFinite(n)) n = 0;
    n = Math.max(0, Math.min(n, cap));
    (model as any).value.cashierDiscountAmount = Number(n.toFixed(2));
    onManualDiscountChange();
  }catch{}
}

// 已移除先服务后付与入队逻辑

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

function onToggleCoupon(c:any, checked:boolean){
  try{
    if (!c) return;
    if (checked && disabledByCombine(c)) return;
    const set = new Set<number>(Array.isArray(props.selectedCouponIds) ? props.selectedCouponIds : []);
    if (checked) set.add(c.id);
    else set.delete(c.id);
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

// 零元订单：禁用微信 tab；必要时自动切到可用方式；可用时自动聚焦输入
watch([wxPayEnabled, visibleLocal], async ([enabled, vis])=>{
  try{
    if (!vis) return;
    const tab = String((model as any).value?.tab || 'wx');
    if (!enabled && tab === 'wx') (model as any).value.tab = 'manual';
    if (enabled && ((model as any).value?.tab || 'wx') === 'wx') {
      await nextTick();
      try{ wxInputRef.value?.focus?.(); }catch{}
    }
  }catch{}
});
</script>

<style scoped>
/* 结算弹窗：美术升级（高级感 / 触控友好 / 信息层级清晰） */
.settle-dialog{
	--sd-radius: 16px;
	--sd-radius-sm: 12px;
	--sd-label-w: 92px;
	--sd-label-w-compact: 72px;
	--sd-border: rgba(15, 23, 42, 0.10);
	--sd-border-soft: rgba(15, 23, 42, 0.08);
	--sd-text: #0f172a;
	--sd-muted: #64748b;
	--sd-hint: #6b7280;
	--sd-bg: #ffffff;
	--sd-bg-soft: #f8fafc;
	--sd-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
	--sd-shadow-soft: 0 1px 12px rgba(15, 23, 42, 0.06);
	--sd-accent: #3b82f6;
	--sd-accent2: #8b5cf6;
	--sd-danger: #ef4444;
	--sd-success: #10b981;
}

.settle-dialog :deep(.el-dialog){
	border-radius: var(--sd-radius);
	overflow: hidden;
	box-shadow: var(--sd-shadow);
}
.settle-dialog :deep(.el-dialog__header){
	padding: 14px 16px 10px;
	background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
	border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}
.settle-dialog :deep(.el-dialog__title){
	color: var(--sd-text);
	font-weight: 900;
	letter-spacing: .2px;
}
.settle-dialog :deep(.el-dialog__body){
	padding: 12px 16px 16px;
	background:
		radial-gradient(1200px 520px at 14% 0%, rgba(59,130,246,.08) 0%, rgba(139,92,246,.06) 40%, rgba(255,255,255,0) 70%),
		var(--sd-bg);
}

.settle{ display:flex; flex-direction:column; gap:12px; }
.settle-head{
	display:grid;
	grid-template-columns: 1fr 280px;
	gap:12px;
	align-items:stretch;
}
.sd-card{
	border-radius: var(--sd-radius);
	border: 1px solid var(--sd-border-soft);
	background: rgba(255,255,255,0.92);
	box-shadow: var(--sd-shadow-soft);
	backdrop-filter: blur(6px);
}
.sd-card :deep(.el-card__header){
	padding: 12px 14px;
	border-bottom: 1px solid rgba(15, 23, 42, 0.06);
	background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.90) 100%);
}
.sd-card :deep(.el-card__body){ padding: 12px 14px 14px; }
.sd-card-hd{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.sd-desc{ margin-top: 2px; }
.sd-desc :deep(.el-descriptions__label){ color: var(--sd-muted); font-weight: 900; }
.sd-desc :deep(.el-descriptions__content){ font-weight: 900; color: var(--sd-text); }
.sd-alert{ margin-top: 10px; }
.money{ font-weight: 950; letter-spacing: .2px; }
.money.neg{ color: var(--sd-danger); }
.tags{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.mono{
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	font-weight: 800;
	color: var(--sd-muted);
}
.sd-card.sd-amount{
	border: 1px solid rgba(59,130,246,.28);
	background:
		radial-gradient(120% 140% at 18% 14%, rgba(59,130,246,.22) 0%, rgba(139,92,246,.12) 42%, rgba(255,255,255,1) 100%);
	box-shadow: 0 10px 24px rgba(59,130,246,.10);
	position: relative;
	overflow:hidden;
}
.sd-card.sd-amount::before{
	content:"";
	position:absolute;
	inset:-2px;
	background:
		linear-gradient(120deg, rgba(59,130,246,.16), rgba(139,92,246,.10), rgba(16,185,129,.08));
	filter: blur(18px);
	opacity:.55;
	pointer-events:none;
}
.sd-card.sd-amount :deep(.el-card__header),
.sd-card.sd-amount :deep(.el-card__body){
	position: relative;
	background: transparent;
}
.sd-amount-label{ font-size: 13px; color: #475569; font-weight: 900; }
.sd-amount-value{ margin-top:6px; font-size: 36px; font-weight: 950; color: var(--sd-text); letter-spacing: .3px; text-align:right; }
.sd-amount-tip{ margin-top:8px; font-size: 12px; text-align:right; }
.panel-title{
	font-weight: 950;
	color: var(--sd-text);
	margin-bottom: 0;
	letter-spacing: .2px;
	display:flex;
	align-items:center;
	gap:8px;
}
.panel-title::before{
	content:"";
	width: 8px;
	height: 18px;
	border-radius: 999px;
	background: linear-gradient(180deg, var(--sd-accent) 0%, var(--sd-accent2) 100%);
	box-shadow: 0 6px 14px rgba(59,130,246,.22);
}

.settle-form{ margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(15, 23, 42, 0.10); }
.field{ display:flex; gap:12px; align-items:flex-start; }
.field-label{ flex: 0 0 var(--sd-label-w); color:#334155; font-weight: 900; padding-top: 10px; }
.field-control{ flex: 1; min-width: 0; }
.discount-row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.quick-btns{ margin-right: 4px; }

.hint{ color: var(--sd-hint); font-size:12px; }
/* 统一表单行：原 grid(固定3列) 会在“有4个子元素/或只有1个子元素”时产生错位。
   改为 flex + label 宽度变量，保证 1/3/4 列都能稳定对齐，hint 自动缩进。 */
.row{
	--row-label-w: var(--sd-label-w);
	display:flex;
	flex-wrap:wrap;
	align-items:center;
	gap:10px;
}
.row.compact{ --row-label-w: var(--sd-label-w-compact); }
.row.no-label{ --row-label-w: 0px; }
.row > .label{
	flex: 0 0 var(--row-label-w);
	color:#475569;
	font-weight: 900;
	line-height: 1.2;
	padding-top: 2px;
}
/* 第一个控件：尽量占满剩余空间；避免被右侧按钮挤到很窄导致错位感 */
.row > .label + *{
	flex: 1 1 240px;
	min-width: 220px;
}
/* 其余控件（如“新建/管理”按钮）保持自适应宽度，必要时换行 */
.row > .label ~ *{ flex: 0 0 auto; }
/* 提示文案：单独占一行并缩进到控件下方（对齐视觉更干净） */
.row > .hint{
	flex: 1 1 100%;
	margin-left: calc(var(--row-label-w) + 10px);
}
.row.no-label > .hint{ margin-left: 0; }
.label{ color:#475569; font-weight: 800; }
.pay-section{ display:flex; flex-direction:column; gap:10px; }
.wx-actions{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top: 8px; }
.wx-ok{ font-size:12px; color:#059669; font-weight:700; background: rgba(16,185,129,.10); border: 1px solid rgba(16,185,129,.18); padding: 6px 10px; border-radius: 999px; }
.note{
	color:#475569;
	font-size:13px;
	line-height:1.65;
	background: linear-gradient(180deg, rgba(248,250,252,.92) 0%, rgba(255,255,255,.92) 100%);
	padding:10px 12px;
	border-radius: 12px;
	border:1px solid rgba(15, 23, 42, 0.08);
}
.scan-wrap{ display:flex; flex-direction:column; gap:10px; align-items:center; }
.video{ width:100%; max-height:460px; background:#000; border-radius: var(--sd-radius); box-shadow: 0 10px 26px rgba(0,0,0,.22); }
.scan-tip{ color:#909399; font-size:12px; }

.settle-tabs :deep(.el-tabs__header){ margin: 0 0 10px; }
.settle-tabs :deep(.el-tabs__nav-wrap::after){ height: 0; }
.settle-tabs :deep(.el-tabs__nav){
	background: rgba(248,250,252,0.85);
	border: 1px solid rgba(15, 23, 42, 0.08);
	border-radius: 14px;
	padding: 6px;
	backdrop-filter: blur(6px);
}
.settle-tabs :deep(.el-tabs__item){
	font-size: 14px;
	font-weight: 800;
	border-radius: 12px;
	margin: 0 4px;
	color: #475569;
}
.settle-tabs :deep(.el-tabs__item.is-active){
	background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
	box-shadow: 0 1px 12px rgba(15, 23, 42, 0.08);
	color: var(--sd-text);
}
.settle-tabs :deep(.el-tabs__active-bar){ display:none; }

.settle-actions{
	position: sticky;
	bottom: 0;
	background: linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,1) 45%);
	backdrop-filter: blur(6px);
	border-top: 1px solid rgba(15, 23, 42, 0.08);
	padding-top: 12px;
	margin-top: 2px;
	display:flex;
	justify-content:flex-end;
	gap:10px;
}

@media (max-width: 860px){
	.settle-head{ grid-template-columns: 1fr; }
	.sd-amount-value,
	.sd-amount-tip{ text-align:left; }
}
/* 优惠券标签样式（对齐小程序风格） */
.coupon-section{ margin: 10px 0; }
.section-label{ color:#666; font-size:14px; margin-bottom:8px; }
.coupon-list{ display:flex; flex-direction:column; gap:10px; }
.coupon-item{ display:flex; flex-direction:column; gap:6px; }
.coupon-tag{
	display:inline-flex;
	align-items:center;
	gap:8px;
	padding:10px 14px;
	border-radius:999px;
	border:1px solid rgba(15, 23, 42, 0.12);
	background: rgba(255,255,255,0.88);
	color: var(--sd-text);
	cursor:pointer;
	user-select:none;
	transition: all 0.2s ease;
	box-shadow: 0 1px 10px rgba(15, 23, 42, 0.04);
}
.coupon-tag.is-checked{
	background: linear-gradient(135deg, rgba(59,130,246,1), rgba(139,92,246,1));
	color:#fff;
	border-color: rgba(255,255,255,0.0);
	box-shadow: 0 10px 22px rgba(59,130,246,.18);
}
.coupon-tag.is-disabled{
	opacity: .55;
	filter: grayscale(0.15);
	cursor:not-allowed;
	box-shadow: none;
}
.coupon-meta{ display:flex; flex-wrap:wrap; gap:6px; }
.c-name{ font-size:12px; }
.c-discount{ font-size:12px; font-weight:950; color: var(--sd-danger); }
.coupon-tag.is-checked .c-discount{ color:#fff; }

/* 放大收银立减输入框中的数字 */
.cashier-discount-input :deep(.el-input__wrapper){
	padding: 6px 10px;
	border-radius: 12px;
	box-shadow: 0 1px 10px rgba(15, 23, 42, 0.06);
}
.cashier-discount-input :deep(.el-input__inner){ font-size: 18px; font-weight: 900; }

/* Element Plus 细节：按钮/输入的触控密度与状态 */
.settle-dialog :deep(.el-button){
	border-radius: 12px;
	font-weight: 800;
}
.settle-dialog :deep(.el-button--primary){
	box-shadow: 0 10px 20px rgba(59,130,246,.18);
}
.settle-dialog :deep(.el-input__wrapper){
	border-radius: 12px;
}
.settle-dialog :deep(.el-input.is-focus .el-input__wrapper),
.settle-dialog :deep(.el-textarea.is-focus .el-textarea__inner){
	box-shadow: 0 0 0 3px rgba(59,130,246,.18);
}
</style>




