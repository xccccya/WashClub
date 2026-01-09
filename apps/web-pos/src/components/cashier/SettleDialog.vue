<template>
	<el-drawer
		v-model="visibleLocal"
		class="settle-drawer"
		size="860px"
		:append-to-body="true"
		:close-on-click-modal="true"
		:with-header="false"
		@closed="stopScan"
	>
		<div class="sd-shell">
			<div class="sd-header">
				<div class="sd-header-row">
					<div class="sd-title-text">结算</div>
					<div class="sd-title-meta">
						<el-tag size="small" effect="plain" type="info">
							{{ orderKind==='SERVICE' ? '服务订单' : (orderKind==='FK' ? '付款订单' : '商品/卡券订单') }}
						</el-tag>
						<el-tag size="small" v-if="orderKind==='SERVICE' && (model as any).groupId" effect="plain" type="warning">
							集团：{{ (model as any).groupName || '集团' }}
						</el-tag>
						<el-tag size="small" v-if="Number(payAmount||0) <= 0" effect="plain" type="warning">零元</el-tag>
						<div v-if="orderKind==='SERVICE' && (model as any).groupId" class="sd-inline-hint mono">集团ID：{{ (model as any).groupId }}</div>
					</div>
				</div>
			</div>

			<div class="sd-body">
				<div class="sd-main">
					<el-card class="sd-card sd-order" shadow="never">
						<template #header>
							<div class="sd-card-hd">
								<div class="panel-title">订单金额</div>
								<div class="hint">请核对金额与优惠规则</div>
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
							<el-descriptions-item v-if="orderKind!=='FK' && cashierDiscountApplied>0" label="收银立减">
								<span class="money neg">-¥{{ cashierDiscountApplied.toFixed(2) }}</span>
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
							<el-divider content-position="left">收银立减</el-divider>
							<div class="field">
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
											style="width: 200px;"
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
								<div class="hint" v-if="model.delivery==='PICKUP'">无需填写收货地址</div>
							</div>
							<div class="row compact" v-if="model.delivery==='EXPRESS' && identity==='member' && selectedMember">
								<div class="label">收货地址</div>
								<div class="addr-select">
									<el-select v-model="model.shippingAddressId" filterable placeholder="选择收货地址" style="width:100%">
										<el-option v-for="a in model.memberAddresses" :key="a.id" :label="addrDisplay(a)" :value="a.id" />
									</el-select>
									<div class="addr-actions">
										<el-button size="large" @click="$emit('open-create-member-address'); (model as any).value.showMemberAddrForm=true">新增</el-button>
										<el-button size="large" @click="$emit('open-manage-member-address')" type="primary" plain>管理</el-button>
									</div>
								</div>
								<div class="hint" v-if="model.memberAddresses?.length">建议选择常用地址，或点击“新增”快速录入</div>
								<div class="hint" v-else>暂无地址，请点击“新增”录入或“管理”批量维护</div>
							</div>

							<!-- 新增地址（会员/游客共用一套更紧凑的表单样式） -->
							<div class="row compact" v-if="model.delivery==='EXPRESS' && ((identity==='member' && model.showMemberAddrForm) || identity==='guest')">
								<div class="label">{{ identity==='guest' ? '收货地址' : '新增地址' }}</div>
								<div class="addr-form">
									<div class="addr-form-hd" v-if="identity==='member'">
										<div class="t">快速新增</div>
										<el-button text @click="(model as any).value.showMemberAddrForm=false">收起</el-button>
									</div>
									<div class="addr-grid-3">
										<el-input v-model="model.addrForm.province" placeholder="省" clearable />
										<el-input v-model="model.addrForm.city" placeholder="市" clearable />
										<el-input v-model="model.addrForm.district" placeholder="区/县" clearable />
									</div>
									<el-input v-model="model.addrForm.street" placeholder="街道/乡镇" clearable />
									<el-input v-model="model.addrForm.detail" placeholder="详细地址（门牌号等）" clearable />
									<div class="addr-grid-2">
										<el-input v-model="model.addrForm.phone" placeholder="手机号" maxlength="11" inputmode="numeric" clearable />
										<el-input v-model="model.addrForm.label" placeholder="标签(可选)" maxlength="6" clearable />
									</div>
									<div class="hint">提交时会校验地址完整性（手机号需为 11 位）。</div>
								</div>
							</div>
						</el-card>
					</template>
				</div>

				<div class="sd-aside">
					<el-card class="sd-card sd-amount" shadow="never">
						<template #header>
							<div class="sd-card-hd">
								<div class="sd-amount-label">应收</div>
								<div class="hint">核对金额后再确认收款</div>
							</div>
						</template>
						<div class="sd-amount-value">¥{{ payAmount.toFixed(2) }}</div>
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

					<el-card class="sd-card" shadow="never">
						<template #header>
							<div class="panel-title">支付方式</div>
						</template>

						<!-- 会员折扣：改为内联，不再单独占一整块卡片，减少左侧滚动 -->
						<div v-if="orderKind!=='FK' && identity==='member' && selectedMember" class="md-inline">
							<div class="md-left">
								<div class="md-title">会员折扣</div>
								<div class="md-hint" v-if="!computedMemberDiscountSupported">该订单内商品不支持会员折扣</div>
								<div class="md-hint" v-else-if="!computedMemberDiscountAllowed">所选优惠券不可与会员折扣同享</div>
								<div class="md-hint" v-else>可与“收银立减”叠加；优惠券/积分请在右侧快捷按钮中设置</div>
							</div>
							<el-switch
								:model-value="enableMemberDiscount"
								:disabled="!computedMemberDiscountSupported || !computedMemberDiscountAllowed"
								@change="(v:any)=>$emit('update:enableMemberDiscount', !!v)"
							/>
						</div>

						<div class="pay-switch">
							<el-radio-group v-model="model.tab" size="default" class="pay-switch-group">
								<el-radio-button value="wx" :disabled="!wxPayEnabled">微信付款码</el-radio-button>
								<el-radio-button value="manual">现金/线下</el-radio-button>
								<el-radio-button v-if="orderKind==='SERVICE'" value="wash">洗车卡划扣</el-radio-button>
							</el-radio-group>
						</div>

						<div class="pay-section" v-show="activeTab==='wx'">
							<div class="field">
								<div class="field-label">付款码</div>
								<div class="field-control">
									<el-input
										ref="wxInputRef"
										v-model="model.wxAuthCode"
										inputmode="numeric"
										size="large"
										placeholder="请扫描/输入顾客微信付款码"
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

						<div class="pay-section" v-show="activeTab==='manual'">
							<div class="row no-label">
								<el-radio-group v-model="model.manualMethod" size="large">
									<el-radio value="CASH">现金</el-radio>
									<el-radio value="OFFLINE">线下</el-radio>
									<el-radio value="SHOUQIANBA">收钱吧</el-radio>
								</el-radio-group>
							</div>
						</div>

						<div class="pay-section" v-show="activeTab==='wash' && orderKind==='SERVICE'">
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
					</el-card>
				</div>
			</div>

			<div class="sd-footer">
				<el-button class="sd-footer-btn" size="default" @click="visibleLocal=false">取消</el-button>
				<el-button
					class="sd-footer-btn"
					size="default"
					type="primary"
					:loading="model.loading"
					:disabled="primaryDisabled"
					@click="doPrimaryAction"
				>
					{{ primaryLabel }}
				</el-button>
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
		</div>
	</el-drawer>
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
const enableMemberDiscount = computed(()=> props.enableMemberDiscount);

const wxInputRef = ref<any>(null);
const wxPayEnabled = computed(()=> Number(payAmount.value||0) > 0);

// 注意：模板会自动解包 ref，不要在模板里用 (model as any).value
// 统一用这个派生值判断当前 tab，保证切换“现金/线下/洗车卡”时下方子项同步切换
const activeTab = computed(()=>{
	try{ return String((model as any).value?.tab || 'wx'); }catch{ return 'wx'; }
});

// 仅展示：当前“收银立减”输入的金额（已钳制/取两位）
const cashierDiscountApplied = computed(()=>{
	try{
		const v = Number((model as any).value?.cashierDiscountAmount || 0);
		if (!Number.isFinite(v) || v <= 0) return 0;
		return Number(v.toFixed(2));
	}catch{ return 0; }
});

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

function isAllowStackWithMemberDiscount(c:any){ 
  try{ 
    return ((c?.allowStackWithMemberDiscount ?? c?.coupon?.allowStackWithMemberDiscount) !== false);
  }catch{ return true; } 
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
/* 结算抽屉：高级感 / 触控友好 / 信息层级清晰 */
.settle-drawer{
	--sd-radius: 18px;
	--sd-radius-sm: 12px;
	--sd-label-w: 92px;
	--sd-label-w-compact: 72px;
	--sd-border: rgba(15, 23, 42, 0.10);
	--sd-border-soft: rgba(15, 23, 42, 0.05);
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

.settle-drawer :deep(.el-drawer){
	border-top-left-radius: var(--sd-radius);
	border-bottom-left-radius: var(--sd-radius);
	overflow: hidden;
	box-shadow: var(--sd-shadow);
}
.settle-drawer :deep(.el-overlay){
	background-color: rgba(2, 6, 23, 0.28);
}
.settle-drawer :deep(.el-drawer__body){
	padding: 0;
	background:
		radial-gradient(1200px 520px at 14% 0%, rgba(59,130,246,.08) 0%, rgba(139,92,246,.06) 40%, rgba(255,255,255,0) 70%),
		var(--sd-bg);
}

.sd-shell{
	height: 100%;
	display:flex;
	flex-direction:column;
	min-height: 0;
}
.sd-header{
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap: 10px;
	padding: 10px 16px 8px;
	border-bottom: 1px solid rgba(15, 23, 42, 0.06);
	background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.86) 100%);
}
.sd-header-row{
	display:flex;
	align-items:center;
	gap: 12px;
	min-width: 0;
	flex: 1 1 auto;
}
.sd-title-text{
	font-size: 16px;
	font-weight: 950;
	letter-spacing: .2px;
	color: var(--sd-text);
	flex: 0 0 auto;
}
.sd-title-meta{
	display:flex;
	align-items:center;
	gap:8px;
	flex: 1 1 auto;
	min-width: 0;
	white-space: nowrap;
	overflow: auto;
	padding-bottom: 2px;
	scrollbar-width: none;
}
.sd-title-meta::-webkit-scrollbar{ height: 0; }
.settle-drawer :deep(.el-tag){
	border-radius: 999px;
	font-weight: 900;
}
.sd-inline-hint{ font-size: 12px; opacity: .85; }
.sd-inline-hint{ font-size:12px; }
.sd-header-actions{ flex: 0 0 auto; }

.sd-body{
	padding: 12px 16px 14px;
	display:flex;
	gap: 12px;
	flex: 1 1 auto;
	min-height: 0;
	/* 单滚动：避免左右两列各自出现滚动条造成割裂感 */
	overflow: auto;
}
.sd-main{
	flex: 1 1 auto;
	min-width: 0;
	display:flex;
	flex-direction:column;
	gap:12px;
	overflow: visible;
	padding-right: 2px;
}
.sd-aside{
	flex: 0 0 320px;
	display:flex;
	flex-direction:column;
	gap:12px;
	min-width: 0;
	overflow: visible;
	padding-right: 2px;
	/* 右侧关键操作尽量固定在视野内（随 .sd-body 滚动容器生效） */
	position: sticky;
	top: 12px;
	align-self: flex-start;
}
.sd-card{
	border-radius: var(--sd-radius);
	border: 0;
	background: rgba(255,255,255,0.92);
	box-shadow: var(--sd-shadow-soft);
	backdrop-filter: blur(6px);
}
.sd-card :deep(.el-card__header){
	padding: 12px 14px;
	border-bottom: 0;
	background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.90) 100%);
}
.sd-card :deep(.el-card__body){ padding: 12px 14px 14px; }
.sd-card-hd{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.sd-desc{ margin-top: 2px; }
.sd-desc :deep(.el-descriptions__label){ color: var(--sd-muted); font-weight: 900; }
.sd-desc :deep(.el-descriptions__content){ font-weight: 900; color: var(--sd-text); }
.sd-desc :deep(.el-descriptions__body){
	border-radius: 14px;
	overflow: hidden;
	background: rgba(248,250,252,0.85);
}
.sd-desc :deep(.el-descriptions__table){
	border-radius: 14px;
	overflow: hidden;
}
.sd-desc :deep(.el-descriptions__cell){
	border: 0 !important;
}
.sd-desc :deep(.el-descriptions__label),
.sd-desc :deep(.el-descriptions__content){
	background: transparent !important;
}
.sd-alert{ margin-top: 10px; }
.money{ font-weight: 950; letter-spacing: .2px; }
.money.neg{ color: var(--sd-danger); }
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
	width: 10px;
	height: 10px;
	border-radius: 999px;
	background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.95) 0%, rgba(255,255,255,.0) 38%),
		linear-gradient(135deg, var(--sd-accent) 0%, var(--sd-accent2) 100%);
	box-shadow:
		0 0 0 4px rgba(59,130,246,.12),
		0 10px 18px rgba(59,130,246,.18);
}

.settle-form{ margin-top: 12px; }
.settle-form :deep(.el-divider__text){ font-weight: 950; color: #334155; }
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
	border: 0;
}
.scan-wrap{ display:flex; flex-direction:column; gap:10px; align-items:center; }
.video{ width:100%; max-height:460px; background:#000; border-radius: var(--sd-radius); box-shadow: 0 10px 26px rgba(0,0,0,.22); }
.scan-tip{ color:#909399; font-size:12px; }

.pay-switch{ margin-bottom: 10px; }
.pay-switch{
	background: rgba(248,250,252,0.92);
	border: 1px solid rgba(15, 23, 42, 0.06);
	border-radius: 16px;
	padding: 6px;
	box-shadow: 0 1px 12px rgba(15, 23, 42, 0.05);
}

/* 会员折扣（内联到支付卡片，减少左侧滚动） */
.md-inline{
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap: 12px;
	padding: 10px 10px;
	margin-bottom: 10px;
	border-radius: 14px;
	border: 1px solid rgba(15, 23, 42, 0.06);
	background: rgba(248,250,252,0.82);
}
.md-left{ min-width: 0; display:flex; flex-direction:column; gap:4px; }
.md-title{ font-weight: 950; color: var(--sd-text); letter-spacing: .2px; }
.md-hint{ font-size: 12px; color: var(--sd-hint); line-height: 1.35; }

/* 地址选择与新增表单 */
.addr-select{
	flex: 1 1 100%;
	min-width: 0;
	display:flex;
	gap:10px;
	align-items:stretch;
}
.addr-actions{
	flex: 0 0 auto;
	display:flex;
	gap:10px;
}
.addr-form{
	width: 100%;
	display:flex;
	flex-direction:column;
	gap:8px;
	padding: 10px 12px;
	border-radius: 14px;
	border: 1px solid rgba(15, 23, 42, 0.06);
	background: linear-gradient(180deg, rgba(248,250,252,.92) 0%, rgba(255,255,255,.92) 100%);
	box-shadow: 0 1px 12px rgba(15, 23, 42, 0.04);
}
.addr-form-hd{
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap:10px;
}
.addr-form-hd .t{
	font-weight: 950;
	color: #334155;
	letter-spacing: .2px;
}
.addr-grid-3{
	display:grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}
.addr-grid-2{
	display:grid;
	grid-template-columns: minmax(0, 1fr) 140px;
	gap: 8px;
}
.addr-form :deep(.el-input__wrapper){
	border-radius: 12px;
}
.pay-switch-group{
	display:flex;
	width: 100%;
	gap: 6px;
}
.pay-switch-group :deep(.el-radio-button){
	flex: 1 1 0;
}
.pay-switch-group :deep(.el-radio-button__inner){
	width: 100%;
	border: 0;
	border-radius: 14px;
	font-weight: 900;
	padding: 10px 12px;
	background: transparent;
	color: #475569;
	box-shadow: none;
}
.pay-switch-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner){
	background: linear-gradient(135deg, rgba(59,130,246,1), rgba(139,92,246,1));
	color: #fff;
	box-shadow: 0 10px 22px rgba(59,130,246,.18);
}
.pay-switch-group :deep(.el-radio-button__original-radio:disabled + .el-radio-button__inner){
	opacity: .55;
	filter: grayscale(0.15);
}

.sd-footer{
	position: sticky;
	bottom: 0;
	z-index: 2;
	background: linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,1) 45%);
	backdrop-filter: blur(6px);
	border-top: 1px solid rgba(15, 23, 42, 0.08);
	padding: 8px 16px 10px;
	display:flex;
	justify-content:flex-end;
	gap:10px;
}
.sd-footer-btn{
	height: 40px;
	padding: 0 18px;
	font-weight: 900;
	border-radius: 12px;
}

@media (max-width: 860px){
	.sd-body{ flex-direction:column; }
	.sd-aside{ flex: 0 0 auto; position: static; }
	.sd-amount-value,
	.sd-amount-tip{ text-align:left; }
}

/* 放大收银立减输入框中的数字 */
.cashier-discount-input :deep(.el-input__wrapper){
	padding: 6px 10px;
	border-radius: 12px;
	box-shadow: 0 1px 10px rgba(15, 23, 42, 0.06);
}
.cashier-discount-input :deep(.el-input__inner){ font-size: 18px; font-weight: 900; }

/* Element Plus 细节：按钮/输入的触控密度与状态 */
.settle-drawer :deep(.el-button){
	border-radius: 12px;
	font-weight: 800;
}
.settle-drawer :deep(.el-button--primary){
	box-shadow: 0 10px 20px rgba(59,130,246,.18);
}
.settle-drawer :deep(.el-input__wrapper){
	border-radius: 12px;
}
.settle-drawer :deep(.el-input.is-focus .el-input__wrapper),
.settle-drawer :deep(.el-textarea.is-focus .el-textarea__inner){
	box-shadow: 0 0 0 3px rgba(59,130,246,.18);
}
</style>




