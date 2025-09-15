<template>
	<BasePage title="收银">
		<template #actions>
			<div class="actions">
				<el-button type="primary" @click="resetAll"><el-icon><Refresh /></el-icon> 重置</el-button>
				<el-button @click="openHangDrawer"><el-icon><Collection /></el-icon> 挂单/取单</el-button>
			</div>
		</template>

		<div class="layout">
			<ProductBrowser
				:order-kind="orderKind"
				:categories-display="categoriesDisplay"
				:active-category-id="activeCategoryId"
				:keyword="keyword"
				:show-only-enabled="showOnlyEnabled"
				:products="products"
				:products-loading="productsLoading"
				:highlight-id="highlightProductId"
				@update:orderKind="v=>orderKind=v as any"
				@order-kind-change="onOrderKindChange"
				@update:activeCategoryId="v=>{ activeCategoryId=v as any; }"
				@update:keyword="v=>{ keyword=v; }"
				@update:showOnlyEnabled="v=>{ showOnlyEnabled=v; }"
				@search="loadProducts"
				@product-click="onProductCardClick"
			/>
				<!-- 右侧：下单区 -->
				<div class="right">
					<div class="panel">
						<div class="panel-body">
							<div class="section">
								<!-- 顾客信息卡片 -->
								<SummaryCard
									ref="summaryRef"
									:order-kind="orderKind"
									:identity="identity"
									:member-keyword="memberKeyword"
									:selected-member="selectedMember"
									:member-vehicles="memberVehicles"
									:member-vehicle-id="memberVehicleId"
									:guest-vehicle-id="guestVehicleId"
									:plate-number="plateNumber"
									:pay-after-service="payAfterService"
									:coupon-discount-est="couponDiscountEst"
									:member-discount-applied="memberDiscountApplied"
									:points-amount-yuan="pointsAmountYuan"
									@update:identity="(v: any)=>identity=v as any"
									@update:payAfterService="(v: any)=>payAfterService=v"
									@update:memberKeyword="(v: any)=>memberKeyword=v"
									@pick-member="onPickMember"
									@clear-member="clearMember"
									@update:memberVehicleId="(v: any)=>memberVehicleId=v as any"
									@update:plateNumber="(v: any)=>plateNumber=v"
									@plate-confirm="onPlateConfirmed"
									@quick-plate="quickPlateInput"
									@edit-guest-plate="editGuestPlate"
									@clear-guest-vehicle="clearGuestVehicle"
									@query-members="queryMembers"
								/>
							</div>

							<CartList
								:items="cartItems"
								@remove="idx=>removeItem(idx)"
								@clear="clearCart"
								@update-qty="(p:any)=>{ const { index, quantity } = p||{}; cartItems[index].quantity=Number(quantity); recompute(); reloadCouponsIfNeeded(); }"
							/>
						</div>

						<!-- 右侧面板不再提供结算控件，统一在结算弹窗中处理 -->

						<div class="footer">
							<div class="amounts">
								<div class="line"><span>小计</span><b>¥{{ subtotal.toFixed(2) }}</b></div>
								<div class="line" v-if="couponDiscountEst>0"><span>优惠券</span><b>-¥{{ couponDiscountEst.toFixed(2) }}</b></div>
								<div class="line" v-if="memberDiscountApplied>0"><span>会员折扣</span><b>-¥{{ memberDiscountApplied.toFixed(2) }}</b></div>
								<div class="line" v-if="pointsAmountYuan>0"><span>积分抵扣</span><b>-¥{{ pointsAmountYuan.toFixed(2) }}</b></div>
								<div class="line"><span>优惠合计</span><b>-¥{{ discountTotal.toFixed(2) }}</b></div>
								<div class="line total"><span>应收</span><b>¥{{ payAmount.toFixed(2) }}</b></div>
							</div>
							<div class="buttons">
								<el-button size="large" @click="saveToHang" :disabled="cartItems.length===0"><el-icon><CollectionTag /></el-icon> 挂单</el-button>
								<template v-if="cartItems.length>0">
									<el-button size="large" type="primary" :disabled="!canOpenSettle" @click="openSettleDialog">
										<el-icon><CreditCard /></el-icon> 结算
									</el-button>
								</template>
								<template v-else>
									<el-button size="large" type="primary" @click="openFkDialog">
										<el-icon><CreditCard /></el-icon> 无商品收款
									</el-button>
								</template>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- SKU 选择弹窗 -->
			<el-dialog v-model="skuDialog.visible" title="选择规格" width="520px">
				<template v-if="skuDialog.product">
					<div class="sku-list">
						<div v-for="s in skuDialog.product.skus" :key="s.id" class="sku-row" @click="chooseSku(s)">
							<div class="sku-name">{{ s.name }}</div>
							<div class="sku-price">¥{{ Number(s.price||0).toFixed(2) }}</div>
							<div class="sku-stock" :class="{ zero: Number(s.stockQuantity||0)===0 }">库存：{{ s.stockQuantity ?? 0 }}</div>
						</div>
					</div>
				</template>
				<template #footer>
					<el-button @click="skuDialog.visible=false">取消</el-button>
				</template>
			</el-dialog>

			<!-- 挂单抽屉 -->
			<HangDrawer v-model="hangDrawer" :hang-slots="hangSlots" @load="loadFromHang" @clear="clearHang" />

			<!-- 无商品收款弹窗 -->
			<el-dialog v-model="fkDialog.visible" title="无商品收款" width="560px" class="fk-dialog">
				<div class="fk-form">
					<div class="fk-row">
						<div class="fk-label">收款金额</div>
						<div class="fk-field">
							<div class="fk-amount-input">
								<el-input-number v-model="fkDialog.amount" :min="0.01" :step="0.01" :precision="2" :controls="false" />
								<div class="fk-amount-large">¥ {{ Number(fkDialog.amount||0).toFixed(2) }}</div>
							</div>
							<div class="fk-quick">
								<el-button size="small" @click="fkDialog.amount=10">¥10</el-button>
								<el-button size="small" @click="fkDialog.amount=20">¥20</el-button>
								<el-button size="small" @click="fkDialog.amount=50">¥50</el-button>
								<el-button size="small" @click="fkDialog.amount=100">¥100</el-button>
								<el-button size="small" @click="fkDialog.amount=200">¥200</el-button>
							</div>
						</div>
					</div>
					<div class="fk-row">
						<div class="fk-label">备注</div>
						<div class="fk-field">
							<el-input v-model="fkDialog.remark" placeholder="请输入付款说明（必填）" maxlength="60" show-word-limit type="textarea" :rows="3" />
							<div class="fk-hint">将作为付款订单的付款说明展示</div>
						</div>
					</div>
				</div>
				<template #footer>
					<div class="fk-footer">
						<el-button @click="fkDialog.visible=false">取消</el-button>
						<el-button type="primary" @click="confirmFkCollect">确认收款</el-button>
					</div>
				</template>
			</el-dialog>

			<!-- 统一结算弹窗（商品/服务/付款） -->
			<SettleDialog
				v-model="settleDialog.visible"
				:model="settleDialog"
				:order-kind="orderKindForDialog"
				:subtotal="dialogSubtotal"
				:pay-amount="dialogPayAmount"
				:pay-amount-cap="dialogPayAmount"
				:coupon-discount-est="couponDiscountEst"
				:coupon-over="couponOver"
				:member-discount-applied="memberDiscountApplied"
				:points-amount-yuan="pointsAmountYuan"
				:has-physical-in-cart="hasPhysicalInCart"
				:identity="identity"
				:selected-member="selectedMember"
				:member-coupons="applicableCouponsForCart"
				:selected-coupon-ids="selectedCouponIds"
				:used-points="usedPoints"
				:member-points-max="memberPointsMax"
				:points-step="pointsStep"
				:supports-points="supportsPoints"
				:points-allowed-by-coupons="pointsAllowedByCoupons"
				:enable-member-discount="enableMemberDiscount"
				:supports-member-discount="supportsMemberDiscount"
				:service-products-in-cart="serviceProductsInCart"
				:queue-types="queueTypes"
				:addr-display="addrDisplay"
				:pay-after-service="payAfterService"
				:points-available="pointsAvailable"
				@confirm-enqueue="onConfirmEnqueue"
				@update:selected-coupon-ids="onSelectedCouponIdsChange"
				@update:used-points="onUsedPointsChangeTpl"
				@update:enable-member-discount="onEnableMemberDiscountChange"
				@confirm-manual="confirmSettleManual"
				@confirm-wx="confirmSettleWx"
				@confirm-wash="confirmSettleWash"
				@open-create-member-address="openCreateMemberAddress"
				@open-manage-member-address="openManageMemberAddress"
				@normalize-used-points="normalizeUsedPoints"
			/>

			<!-- 管理收货地址（会员） -->
			<AddressManager
				v-model="addrDialog.visible"
				:model="addrDialog"
				:addr-display="addrDisplay"
				@begin-create="beginCreateAddress"
				@begin-edit="beginEditAddress"
				@save="saveAddress"
				@delete="deleteAddress"
			/>

			<!-- 车辆主类选择对话框（游客新建车辆） -->
			<TypeMainDialog v-model="typeMainDialog.visible" :value="typeMainDialog.value" :options="typeMainOptions" @update:value="(v:any)=> typeMainDialog.value=v" @confirm="confirmTypeMain" @cancel="cancelTypeMain" />
	</BasePage>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { httpWrap as http } from '../utils/http';
import { resolveGuestMemberId } from '../config';
import ProductBrowser from '../components/cashier/ProductBrowser.vue';
import SummaryCard from '../components/cashier/SummaryCard.vue';
import CartList from '../components/cashier/CartList.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Collection, CollectionTag, CreditCard } from '@element-plus/icons-vue';
import HangDrawer from '../components/cashier/HangDrawer.vue';
import AddressManager from '../components/cashier/AddressManager.vue';
import TypeMainDialog from '../components/cashier/TypeMainDialog.vue';
import SettleDialog from '../components/cashier/SettleDialog.vue';

// 扫码枪输入缓冲（避免影响输入框）
const scanBuf = reactive({ s: '', t: 0 });
function onGlobalKeydown(ev: KeyboardEvent){
	const target = ev.target as HTMLElement | null;
	if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
	const now = Date.now();
	if (now - scanBuf.t > 300) scanBuf.s = '';
	scanBuf.t = now;
	const k = ev.key;
	if (k === 'Enter'){
		const code = scanBuf.s.trim();
		scanBuf.s = '';
		if (code) handleScanCode(code);
		return;
	}
	if (/^[\w-]$/.test(k)) scanBuf.s += k;
}
async function handleScanCode(code: string){
	if (orderKind.value !== 'SP'){ ElMessage.warning('扫码仅用于商品/卡券订单'); return; }
	try{
		const en = 'true';
		const build = (t: string) => { const u = new URL('/store/products', location.origin); u.searchParams.set('type', t); u.searchParams.set('enabled', en); u.searchParams.set('keyword', code); return http<any[]>(u.pathname + '?' + u.searchParams.toString(), { method:'GET' }); };
		const [pa, pb] = await Promise.allSettled([build('PHYSICAL'), build('VIRTUAL_CARD')]);
		const arrA = pa.status==='fulfilled' ? (pa.value||[]) : []; const arrB = pb.status==='fulfilled' ? (pb.value||[]) : [];
		const list = [...arrA, ...arrB];
		if (list.length === 1){
			const p = list[0];
			if (isProductDisabled(p)) { ElMessage.warning('该商品不可售'); return; }
			if (p.specType === 'MULTI') { skuDialog.product = p; skuDialog.visible = true; return; }
			const item: CartItem = { productId: p.id, skuId: null, name: p.name, imageUrl: p.imageUrl ?? null, specsText: null, barcode: p.barcode ?? null, price: Number(p.price||0), quantity: 1, productType: p.type, pointsDeductible: !!p.pointsDeductible, memberDiscount: !!p.memberDiscount, shipAllowExpress: p?.shipAllowExpress !== false, shipAllowPickup: p?.shipAllowPickup !== false }
			const idx = cartItems.value.findIndex(x=> (x.productId||null)===(item.productId||null) && (x.skuId||null)===(item.skuId||null));
			if (idx>=0) cartItems.value[idx].quantity = Number(cartItems.value[idx].quantity||0) + 1; else cartItems.value.push(item);
			recompute();
			return;
		}
		keyword.value = code; await loadProducts();
	}catch(e:any){ ElMessage.error(String(e?.message||'扫码失败')); }
}

// ============ 订单类型 ============
// SERVICE: 服务订单（互斥于 SP 商品订单）
// SP: 实物/虚拟卡券商品订单
const orderKind = ref<'SERVICE'|'SP'>('SP');
const summaryRef = ref<any|null>(null);
function onOrderKindChange(){
	if (cartItems.value.length > 0) {
		ElMessageBox.confirm('切换订单类型将清空当前清单，是否继续？', '确认', { type: 'warning' }).then(()=>{
			clearCart();
		}).catch(()=>{
			orderKind.value = orderKind.value === 'SERVICE' ? 'SP' : 'SERVICE';
		});
	}
	loadCategories();
	loadProducts();
}

// ============ 分类与商品 ============
const categoriesService = ref<any[]>([]);
const categoriesGoods = ref<any[]>([]);
const activeCategoryId = ref<number|undefined>();
const keyword = ref('');
const showOnlyEnabled = ref(true);
const categoriesDisplay = computed(()=> orderKind.value==='SERVICE' ? categoriesService.value : categoriesGoods.value);

const products = ref<any[]>([]);
const productsLoading = ref(false);

function displayPrice(p: any): string { if (p.specType === 'MULTI') return p.priceRange || ''; return Number(p.price||0).toFixed(2); }

async function loadCategories(){
	try{
		if (orderKind.value==='SERVICE'){
			categoriesService.value = await http<any[]>('/store/categories?type=SERVICE', { method: 'GET' }).catch(()=>[]);
		}else{
			const a = await http<any[]>('/store/categories?type=PHYSICAL', { method: 'GET' }).catch(()=>[]);
			const b = await http<any[]>('/store/categories?type=VIRTUAL_CARD', { method: 'GET' }).catch(()=>[]);
			const map = new Map<number, any>();
			[...(a||[]), ...(b||[])].forEach((c:any)=>{ if (!map.has(c.id)) map.set(c.id, c); });
			categoriesGoods.value = Array.from(map.values());
		}
	}catch{}
}

async function loadProducts(){
	productsLoading.value = true;
	try{
		const cat = activeCategoryId.value; const kw = keyword.value.trim(); const en = showOnlyEnabled.value ? 'true' : undefined;
		if (orderKind.value==='SERVICE'){
			const url = new URL('/store/products', location.origin);
			url.searchParams.set('type','SERVICE'); if (cat!=null) url.searchParams.set('categoryId', String(cat)); if (kw) url.searchParams.set('keyword', kw); if (en) url.searchParams.set('enabled', en);
			products.value = await http<any[]>(url.pathname + '?' + url.searchParams.toString(), { method: 'GET' });
		}else{
			const build = (t: string) => { const u = new URL('/store/products', location.origin); u.searchParams.set('type', t); if (cat!=null) u.searchParams.set('categoryId', String(cat)); if (kw) u.searchParams.set('keyword', kw); if (en) u.searchParams.set('enabled', en); return http<any[]>(u.pathname + '?' + u.searchParams.toString(), { method: 'GET' }); };
			const [pa, pb] = await Promise.allSettled([build('PHYSICAL'), build('VIRTUAL_CARD')]);
			const arrA = pa.status==='fulfilled' ? (pa.value||[]) : []; const arrB = pb.status==='fulfilled' ? (pb.value||[]) : [];
			products.value = [...arrA, ...arrB];
		}
	} catch(e:any){ ElMessage.error(String(e?.message||'加载失败')); } finally { productsLoading.value = false; }
}

// ============ 购物车与互斥 ============
interface CartItem { productId?: number|null; skuId?: number|null; name: string; imageUrl?: string|null; specsText?: string|null; barcode?: string|null; price: number; quantity: number; productType?: 'SERVICE'|'PHYSICAL'|'VIRTUAL_CARD'; pointsDeductible?: boolean; memberDiscount?: boolean; shipAllowExpress?: boolean; shipAllowPickup?: boolean; }
const cartItems = ref<CartItem[]>([]);
function clearCart(){ cartItems.value = []; recompute(); reloadCouponsIfNeeded(); }
function removeItem(i: number){ cartItems.value.splice(i,1); recompute(); reloadCouponsIfNeeded(); }

const skuDialog = reactive({ visible: false, product: null as any|null });
const highlightProductId = ref<number|undefined>(undefined);
let highlightTimer: any = null;
function isProductDisabled(p:any): boolean {
	if (!p?.enabled) return true;
	if (orderKind.value==='SERVICE'){
		return p.type !== 'SERVICE';
	} else {
		if (p.type === 'SERVICE') return true;
		const stock = Number(p.totalStock||0);
		if (Number.isFinite(stock) && stock <= 0) return true;
		return false;
	}
}
function disabledReason(p:any): string {
	if (!p?.enabled) return '已下架';
	if (orderKind.value==='SERVICE' && p.type!=='SERVICE') return '仅服务可选';
	if (orderKind.value==='SP' && p.type==='SERVICE') return '仅商品/卡券可选';
	if (orderKind.value==='SP' && p.type!=='SERVICE' && Number(p.totalStock||0)===0) return '售罄';
	return '不可选';
}
function onProductCardClick(p: any){
	if (isProductDisabled(p)) { ElMessage.info(disabledReason(p)); return; }
	if (orderKind.value==='SERVICE' && p.type!=='SERVICE') { ElMessage.warning('服务订单不可添加商品/卡券'); return; }
	if (orderKind.value==='SP' && p.type==='SERVICE') { ElMessage.warning('商品订单不可添加服务项目'); return; }
	if (p.specType === 'MULTI') { skuDialog.product = p; skuDialog.visible = true; return; }
	const item: CartItem = { productId: p.id, skuId: null, name: p.name, imageUrl: p.imageUrl ?? null, specsText: null, barcode: p.barcode ?? null, price: Number(p.price||0), quantity: 1, productType: p.type, pointsDeductible: !!p.pointsDeductible, memberDiscount: !!p.memberDiscount, shipAllowExpress: p?.shipAllowExpress !== false, shipAllowPickup: p?.shipAllowPickup !== false }
	// 合并重复项：同 productId 与 skuId 的叠加数量
	const idx = cartItems.value.findIndex(x=> (x.productId||null)===(item.productId||null) && (x.skuId||null)===(item.skuId||null));
	if (idx>=0) { cartItems.value[idx].quantity = Number(cartItems.value[idx].quantity||0) + 1; }
	else { cartItems.value.push(item); }
	try{ if (highlightTimer) clearTimeout(highlightTimer); }catch{}
	highlightProductId.value = Number(p.id||0) || undefined;
	highlightTimer = setTimeout(()=>{ highlightProductId.value = undefined; }, 400);
	recompute();
	reloadCouponsIfNeeded();
}
function chooseSku(sku: any){ if (!skuDialog.product) return; const p = skuDialog.product; const item: CartItem = { productId: p.id, skuId: sku.id, name: p.name, imageUrl: sku.imageUrl || p.imageUrl || null, specsText: sku.name, barcode: sku.barcode || p.barcode || null, price: Number(sku.price||0), quantity: 1, productType: p.type, pointsDeductible: !!(sku.pointsDeductible ?? p.pointsDeductible), memberDiscount: !!(sku.memberDiscount ?? p.memberDiscount), shipAllowExpress: p?.shipAllowExpress !== false, shipAllowPickup: p?.shipAllowPickup !== false }; const idx = cartItems.value.findIndex(x=> (x.productId||null)===(item.productId||null) && (x.skuId||null)===(item.skuId||null)); if (idx>=0) { cartItems.value[idx].quantity = Number(cartItems.value[idx].quantity||0) + 1; } else { cartItems.value.push(item); } skuDialog.visible=false; skuDialog.product=null; recompute(); reloadCouponsIfNeeded(); }

// 结算弹窗事件桥接（避免模板里直接 .value）
function onSelectedCouponIdsChange(v:any){ 
    try{ 
        selectedCouponIds.value = Array.isArray(v) ? (v as number[]) : []; 
        // 券选择变化时触发叠加规则检查
        onCouponsChange();
    }catch{} 
}
function onUsedPointsChangeTpl(v:any){ try{ usedPoints.value = Number(v||0); }catch{} }
function onEnableMemberDiscountChange(v:any){ try{ enableMemberDiscount.value = !!v; recompute(); }catch{} }

// ============ 会员/车辆/队列 ============
const memberKeyword = ref('');
const selectedMember = ref<any|null>(null);
async function queryMembers(q: string, cb: (list:any[])=>void){ try{ const kw = String(q||'').trim(); if (!kw) { cb([]); return; } const url = new URL('/member/list', location.origin); url.searchParams.set('page','1'); url.searchParams.set('pageSize','20'); url.searchParams.set('keyword', kw); const res:any = await http(url.pathname + '?' + url.searchParams.toString(), { method: 'GET' }); cb((res?.items)||[]); }catch{ cb([]); } }
function onPickMember(m:any){ selectedMember.value = m; loadMemberCouponsAndPoints(); }
function clearMember(){ selectedMember.value = null; selectedCouponIds.value = []; usedPoints.value = 0; memberPoints.value = 0; recompute(); }
watch(selectedMember, async(val)=>{
	try{
		memberVehicles.value = [];
		memberVehicleId.value = undefined;
		if (val && val.id){
			const list = await http<any[]>(`/vehicle/member/${val.id}`, { method:'GET' }).catch(()=>[]);
			memberVehicles.value = Array.isArray(list) ? list : [];
		}
	}catch{}
});

const plateNumber = ref('');
let settingPlateProgrammatically = false;
const payAfterService = ref(true);
const identity = ref<'guest'|'member'>('guest');
const GUEST_MEMBER_ID_CONST = resolveGuestMemberId();
const memberVehicles = ref<Array<{ id:number; plateNumber:string }>>([]);
const memberVehicleId = ref<number|undefined>();
const typeMainOptions = ['轿车', 'SUV', 'MPV', '卡车', '跑车'];
const typeMainDialog = reactive({ visible: false, value: '轿车' as string });
let typeMainResolve: ((val: string|null)=>void) | null = null;
function openTypeMainDialog(): Promise<string|null>{
    return new Promise((resolve)=>{
        typeMainDialog.visible = true;
        typeMainDialog.value = '轿车';
        typeMainResolve = resolve;
    });
}
function confirmTypeMain(){ if (typeMainResolve) typeMainResolve(typeMainDialog.value || '轿车'); typeMainResolve = null; typeMainDialog.visible = false; }
function cancelTypeMain(){ if (typeMainResolve) typeMainResolve(null); typeMainResolve = null; typeMainDialog.visible = false; }
// 游客快速输入后解析车辆归属
const resolvedVehicleId = ref<number|undefined>();
const resolvedOwnerType = ref<'guest'|'member'|'group'|null>(null);
async function onPlateConfirmed(){
    const plate = String(plateNumber.value||'').trim(); if (!plate) return;
    try{
        // 以搜索接口精确匹配判断归属
        const list:any[] = await http(`/vehicle/search?q=${encodeURIComponent(plate)}&limit=20`, { method:'GET' }).catch(()=>[]) as any[];
        const upper = plate.toUpperCase();
        const match = Array.isArray(list) ? list.find((it:any)=> String(it?.plateNumber||'').toUpperCase()===upper) : null;
        if (!match){
            // 不存在：提示是否创建游客车辆（并选择车辆主类）
            const typeMain = await openTypeMainDialog();
            if (!typeMain) return;
            const created = await http('/vehicle/guest/create', { method:'POST', body:{ plateNumber: plate, typeMain } });
            resolvedVehicleId.value = Number((created as any)?.id||0)||undefined; resolvedOwnerType.value='guest';
            ElMessage.success('已创建游客车辆');
            return;
        }
        // 存在：根据 memberId 判断归属
        resolvedVehicleId.value = Number(match.id||0)||undefined;
        if (match.memberId){
            // 会员车辆：确认是否切换为该会员下单
            await ElMessageBox.confirm('该车辆已绑定会员，是否切换为该会员下单？', '切换会员', { type:'info', confirmButtonText:'切换', cancelButtonText:'取消' });
            // 切换身份并选中会员
            identity.value = 'member';
            try{
                const prof = await http(`/member/${Number(match.memberId)}`, { method:'GET' });
                selectedMember.value = prof;
                const vs = await http<any[]>(`/vehicle/member/${Number(match.memberId)}`, { method:'GET' }).catch(()=>[]);
                memberVehicles.value = Array.isArray(vs) ? vs : [];
                const found = memberVehicles.value.find(v=> String(v.plateNumber||'').toUpperCase()===upper);
                if (found) memberVehicleId.value = Number(found.id);
            }catch{}
            resolvedOwnerType.value='member';
        } else {
            // 可能为集团车辆（groupId 非空）或游客车辆
            if (match.groupId){
                await ElMessageBox.confirm('该车辆为集团车辆，是否切换为集团订单占位会员下单？', '集团车辆', { type:'info', confirmButtonText:'切换', cancelButtonText:'取消' });
                // 切为"会员"身份，并指向集团的占位会员（后端在下单时会按 groupId 归属）
                identity.value = 'member';
                let groupDetail:any = null;
                try{
                    // 通过 group 详情拿占位会员
                    groupDetail = await http(`/group/${Number(match.groupId)}`, { method:'GET' });
                    const ownerId = Number((groupDetail as any)?.orderOwnerMemberId||0);
                    if (ownerId){ const prof = await http(`/member/${ownerId}`, { method:'GET' }); selectedMember.value = prof; }
                }catch{}
                // 保存 groupId 与显示集团名称
                try{ (settleDialog as any).groupId = Number(match.groupId); (settleDialog as any).groupName = (groupDetail as any)?.name || '集团'; }catch{}
                resolvedOwnerType.value='group';
            } else {
                // 游客车辆
                await ElMessageBox.confirm('检测到游客车辆，是否直接使用该车辆？', '确认', { type:'info', confirmButtonText:'使用', cancelButtonText:'取消' });
                guestVehicleId.value = resolvedVehicleId.value; resolvedOwnerType.value='guest';
            }
        }
    }catch(e:any){ ElMessage.error(String(e?.message||'校验车辆失败')); }
}

// ============ 结算试算（前端仅做展示，实际以后端为准） ============
const subtotal = computed(()=> cartItems.value.reduce((s,it)=> s + Number(it.price||0)*Number(it.quantity||0), 0));
const discountTotal = ref(0);
// 优惠券详情缓存，用于 SPECIFIED 范围与 ruleJson/applyBase
const couponDetailsMap = ref<Map<number, any>>(new Map());
async function ensureCouponDetailsLoaded(){
    try{
        const list = (memberCoupons.value||[]) as any[];
        const needIds = list.map(x=> Number((x?.coupon?.id)||x?.couponId||x?.id||0)).filter(id=>id>0);
        const uniq = Array.from(new Set(needIds)).filter(id=> !couponDetailsMap.value.has(id));
        if (!uniq.length) return false;
        const results = await Promise.allSettled(uniq.map(id=> http(`/coupons/${id}`, { method:'GET' })));
        let loaded = false;
        results.forEach((r, idx)=>{ const id = uniq[idx]; if (r.status==='fulfilled' && r.value){ couponDetailsMap.value.set(id, r.value); loaded = true; } });
        if (loaded) { recompute(); }
        return loaded;
    }catch{}
    return false;
}
function calcCouponDiscountFor(mc:any): number{
    try{
        const c:any = mc?.coupon || mc;
        const couponId = Number(c?.id || mc?.couponId || 0);
        const total = subtotal.value;
        let discountBase = total;
        const detail:any = couponId ? (couponDetailsMap.value.get(couponId) || c) : c;
        const applyScope = String(detail?.applyScope||c?.applyScope||'ALL');
        if (applyScope === 'SPECIFIED'){
            try{
                const arr:any[] = Array.isArray(detail?.applicableProducts) ? detail.applicableProducts : [];
                const ids = new Set(arr.map((ap:any)=> Number(ap?.productId || ap?.product?.id || 0)).filter((x:number)=>x>0));
                const applicableItems = cartItems.value.filter(it=> ids.has(Number(it.productId||0)));
                if (applicableItems.length===0) return 0;
                discountBase = applicableItems.reduce((s,it)=> s + Number(it.price||0)*Number(it.quantity||0), 0);
            }catch{}
        }
        let discount = 0;
        const rule:any = (detail?.ruleJson ?? c?.ruleJson) || null;
        if (rule && typeof rule==='object'){
            const baseForRule = (rule.applyBase === 'order') ? total : discountBase;
            if (rule.kind === 'percent'){
                const pct = Number(rule.percent||rule.amount||0)/100; if (pct>0) discount = baseForRule * pct; if (rule.cap!=null) discount = Math.min(discount, Number(rule.cap||0));
            } else if (rule.kind === 'direct') { discount = Number(rule.amount||0); }
            if (rule.minSubtotal!=null){ const minS=Number(rule.minSubtotal||0); const baseUse = (rule.applyBase === 'order') ? total : discountBase; if (baseUse < minS) discount = 0; }
            discount = Math.min(discount, baseForRule);
        } else {
            discount = Math.min(Number((detail?.faceValue ?? c?.faceValue) || 0), discountBase);
        }
        return Number((discount||0).toFixed(2));
    }catch{ return 0; }
}
const couponDiscountEst = computed(()=>{
    if (orderKind.value!=='SP') return 0;
    if (!selectedMember.value) return 0;
    const picked = (applicableCouponsForCart.value||[]).filter((x:any)=> selectedCouponIds.value.includes(x.id));
    if (picked.length<=0) return 0;
    const allowCombine = picked.every((x:any)=> x?.allowCombine !== false);
    if (!allowCombine){ return Math.max(...picked.map((mc:any)=> Number(mc.discountApplied||0))); }
    return picked.reduce((s:any, mc:any)=> s + Number(mc.discountApplied||0), 0);
});
const couponOver = computed(()=> Math.max(0, Number(couponDiscountEst.value||0) - subtotal.value));
// 立减上限：不含"收银立减"的应收基数
// 由于弹窗内由 props.payAmount 提供最终应收，这里不再单独复算 cap，防止重复叠加导致上限异常
const payAmountCap = computed(()=> Number((subtotal.value - discountTotal.value - Number(couponDiscountEst.value||0)).toFixed(2)));
// 应收：在上限基础上减去"收银立减"，允许到 0 元
const payAmount = computed(()=>{
    const baseAfterMdPts = Math.max(0, Number((subtotal.value - discountTotal.value).toFixed(2)));
    const afterCoupon = Math.max(0, baseAfterMdPts - Number(couponDiscountEst.value||0));
    const manual = Math.max(0, Number((settleDialog as any)?.cashierDiscountAmount||0));
    const afterManual = Math.max(0, afterCoupon - manual);
    return Number(afterManual.toFixed(2));
});

// 选择券互斥：通过禁用选项防止产生非法组合（参考小程序）

const selectedCouponIds = ref<number[]>([]);
const enableMemberDiscount = ref(true);
const usedPoints = ref(0);
// 原有：
// const memberPoints = ref(0);
// const memberPointsMax = computed(()=> memberPoints.value );
// const pointsStep = computed(()=> 10 );
// 调整为基于站点配置与可用积分
const memberPoints = ref(0);
const pointsStep = computed(()=> minPointsUnit.value );
const memberPointsMax = computed(()=> maxUsablePoints.value );

// 优惠明细展示用
const memberDiscountApplied = computed(()=> Number((enableMemberDiscount.value && memberDiscountAllowedByCoupons.value) ? (memberDiscountEstYuan.value||0) : 0));

const memberCoupons = ref<any[]>([]);
const applicableCouponsForCart = computed(()=>{
    const list = (memberCoupons.value||[]).map((mc:any)=> ({ ...mc, discountApplied: calcCouponDiscountFor(mc) }))
        .filter((mc:any)=> Number(mc.discountApplied||0) > 0);
    list.sort((a:any,b:any)=> Number(b.discountApplied||0) - Number(a.discountApplied||0));
    return list;
});
function couponLabel(c:any){ const name = c?.name || c?.coupon?.name || '优惠券'; const fv = Number(c?.coupon?.faceValue || c?.faceValue || 0); return `${name}（¥${fv}）`; }
function isCouponOptionDisabled(c:any){ 
    if (!c) return false; 
    // 如果当前券已选中，不禁用（允许取消选择）
    if (selectedCouponIds.value.includes(c.id)) return false; 
    
    const picked = (applicableCouponsForCart.value||[]).filter((x:any)=> selectedCouponIds.value.includes(x.id)); 
    
    // 如果已选择的券中有不允许叠加的，则禁用当前券
    const hasNonCombine = picked.some((x:any)=> x?.allowCombine === false);
    if (hasNonCombine) return true;
    
    // 如果当前券不允许叠加且已有其他券被选择，则禁用当前券
    if (c?.allowCombine === false && picked.length > 0) return true;
    
    return false; 
}

async function onCouponsChange(){
    try{
        const picked = (memberCoupons.value||[]).filter((x:any)=> selectedCouponIds.value.includes(x.id));
        
        // 修复：使用与小程序一致的逻辑，只检查券本身属性
        const pointsAllowed = picked.every((x:any)=> x?.allowStackWithPoints !== false);
        if (!pointsAllowed){ 
            usedPoints.value = 0; 
        }
        
        const mdAllowed = picked.every((x:any)=> x?.allowStackWithMemberDiscount !== false);
        if (!mdAllowed && enableMemberDiscount.value){ 
            enableMemberDiscount.value = false; 
        }
        
        await ensureCouponDetailsLoaded();
        recompute();
    }catch{}
}
async function loadMemberCouponsAndPoints(){ 
    if (!selectedMember.value) { 
        memberCoupons.value=[]; 
        memberPoints.value=0; 
        usedPoints.value=0; 
        return; 
    } 
    try{ 
        const mid = Number(selectedMember.value?.id||0); 
        const list = await http<any[]>(`/member-coupons?memberId=${mid}&used=0&expired=0`, { method:'GET' }).catch(()=>[]); 
        const items = Array.isArray((list as any)?.items) ? (list as any).items : (Array.isArray(list) ? list : []); 
        
        // 修复后的API返回包含了正确的优惠券属性，直接使用
        memberCoupons.value = items.map((x:any)=>({ 
            ...x,
            // 从嵌套的 coupon 对象中提取属性到顶层，便于访问
            allowCombine: x?.coupon?.allowCombine,
            allowStackWithPoints: x?.coupon?.allowStackWithPoints, 
            allowStackWithMemberDiscount: x?.coupon?.allowStackWithMemberDiscount,
            // 计算折扣金额
            discountApplied: calcCouponDiscountFor(x)
        })); 
        
        await loadPointsMeta(); 
        recompute(); 
    }catch{ 
        memberCoupons.value=[]; 
    } 
}

// 防抖重新加载优惠券（购物车变化时）
let reloadCouponsTimer: any = null;
function reloadCouponsIfNeeded(){
    if (!selectedMember.value) return;
    try { if (reloadCouponsTimer) clearTimeout(reloadCouponsTimer); } catch {}
    reloadCouponsTimer = setTimeout(()=>{ 
        try { loadMemberCouponsAndPoints(); } catch {} 
    }, 300);
}

const supportsMemberDiscount = computed(()=> cartItems.value.some(it => !!it.memberDiscount));
const supportsPoints = computed(()=> cartItems.value.some(it => !!it.pointsDeductible));

// 券叠加规则：若任何券禁止积分/会员折扣，则置为不可叠加
const memberDiscountAllowedByCoupons = computed(()=>{
	const picked = (memberCoupons.value||[]).filter((c:any)=> selectedCouponIds.value.includes(c.id));
	return picked.every((c:any)=> c?.allowStackWithMemberDiscount !== false);
});
const pointsAllowedByCoupons = computed(()=>{
	const picked = (memberCoupons.value||[]).filter((c:any)=> selectedCouponIds.value.includes(c.id));
	return picked.every((c:any)=> c?.allowStackWithPoints !== false);
});

// 会员折扣百分比（从会员资料取）与可折金额（仅计算标记为 memberDiscount 的行小计）
const memberPayDiscountPercent = ref<number>(0);
const memberDiscountEligibleYuan = computed(()=> supportsMemberDiscount.value ? cartItems.value.reduce((sum,it)=> sum + (it.memberDiscount ? Number(it.price||0)*Number(it.quantity||0) : 0), 0) : 0);
const memberDiscountEstYuan = computed(()=> (memberDiscountEligibleYuan.value * Math.max(0, Number(memberPayDiscountPercent.value||0))) / 100);

// 积分换算元数据
const pointsLoading = ref(false);
const pointsAvailable = ref(0);
const fenPerPoint = ref(0); // 100积分对应的分值（分）
const maxFenPerOrder = ref(0);
const minPointsUnit = computed(()=>{ const v = Math.max(0, Number(fenPerPoint.value||0)); if (!v) return 100; return Math.ceil(100 / v); });
const pointsAmountFenBy = (pts:number)=>{ const v = Math.max(0, Number(fenPerPoint.value||0)); return Math.floor(pts * (v/100)); };
const maxUsablePoints = computed(()=>{
	try{
		if (!supportsPoints.value) return 0;
		if (!pointsAllowedByCoupons.value) return 0;
		const available = Math.max(0, Number(pointsAvailable.value||0));
		// 对齐小程序：积分上限按 (小计-券减) 的分值计算
		const baseYuan = Math.max(0, Number(subtotal.value) - Number(couponDiscountEst.value||0));
		const baseFen = Math.max(0, Math.floor(baseYuan * 100));
		const orderCapFen = Math.max(0, Number(maxFenPerOrder.value||0));
		const minUnit = minPointsUnit.value;
		const capFen = orderCapFen>0 ? Math.min(orderCapFen, baseFen) : baseFen;
		const maxPointsByAmount = fenPerPoint.value>0 ? Math.floor(capFen * 100 / fenPerPoint.value) : 0;
		const availableAligned = Math.floor(available / minUnit) * minUnit;
		const maxAligned = Math.floor(maxPointsByAmount / minUnit) * minUnit;
		return Math.max(0, Math.min(availableAligned, maxAligned));
	}catch{ return 0; }
});

// 重新定义优惠合计：积分与会员折扣叠加（遵守券的叠加限制），券本身减免展示由后端为准，这里仅展示积分与会员折的预计
const pointsAmountYuan = computed(()=>{
	if (!supportsPoints.value || !pointsAllowedByCoupons.value) return 0;
	const pts = Math.max(0, Math.floor(Number(usedPoints.value||0)));
	const minUnit = minPointsUnit.value; const aligned = Math.floor(pts/minUnit)*minUnit; const fen = pointsAmountFenBy(aligned); return Number((fen/100).toFixed(2));
});
const memberDiscountEstYuanApplied = computed(()=> memberDiscountAllowedByCoupons.value ? memberDiscountEstYuan.value : 0);

watch(selectedMember, async(val)=>{
	try{
		memberPayDiscountPercent.value = 0;
		if (val && val.id){
			const prof:any = await http(`/member/${val.id}`, { method:'GET' });
			memberPayDiscountPercent.value = Math.max(0, Number((prof as any)?.level?.payDiscountPercent||0));
		}
	}catch{ memberPayDiscountPercent.value = 0; }
	recompute();
});

async function loadPointsMeta(){
	pointsLoading.value = true;
	try{
		const profile = selectedMember.value ? await http<any>(`/member/${Number(selectedMember.value.id)}`, { method:'GET' }) : null;
		pointsAvailable.value = Math.max(0, Number(profile?.points||0));
		const ss = await http<any>('/system/public/site-setting', { method:'GET' });
		fenPerPoint.value = Math.max(0, Number(ss?.pointsFenPerPoint||0));
		maxFenPerOrder.value = Math.max(0, Number(ss?.pointsMaxDeductFenPerOrder||0));
	}catch{ pointsAvailable.value = 0; fenPerPoint.value = 0; maxFenPerOrder.value = 0; }
	finally{ pointsLoading.value = false; }
}

watch([selectedCouponIds, cartItems, orderKind], ()=>{ normalizeUsedPoints(); recompute(); });
watch(memberCoupons, async ()=>{ await ensureCouponDetailsLoaded(); recompute(); });
watch(memberDiscountAllowedByCoupons, (allowed)=>{ if (!allowed && enableMemberDiscount.value){ enableMemberDiscount.value = false; } });

function normalizeUsedPoints(){
	let pts = Math.max(0, Math.floor(Number(usedPoints.value||0)));
	const minUnit = minPointsUnit.value; pts = Math.floor(pts/minUnit)*minUnit; pts = Math.min(pts, maxUsablePoints.value); usedPoints.value = pts;
}

onMounted(()=>{ loadPointsMeta(); });

function recompute(){
	let discount = 0;
	// 券预计显示在汇总处，不计入 discountTotal，以避免与后端真实抵扣重复
	// 会员折扣预计（受开关与叠加规则约束）
	const md = Number(memberDiscountEstYuan.value||0);
	if (supportsMemberDiscount.value && memberDiscountAllowedByCoupons.value && enableMemberDiscount.value) discount += md;
	// 积分预计
	const pa = Number(pointsAmountYuan.value||0);
	if (supportsPoints.value && pointsAllowedByCoupons.value) discount += pa;
	discountTotal.value = Math.min(subtotal.value, Number(discount.toFixed(2)));
}
watch([selectedCouponIds, usedPoints, enableMemberDiscount], recompute);

// ============ 创建订单 ============
const creating = ref(false);
const hasPhysicalInCart = computed(()=> cartItems.value.some(it=> it.productType==='PHYSICAL'));
const canCreateServiceOrder = computed(()=>{
    if (orderKind.value!=='SERVICE') return false;
    if (cartItems.value.length<=0) return false;
    if (identity.value==='guest'){
        return !!(guestVehicleId.value || plateNumber.value);
    }
    return !!(selectedMember.value && memberVehicleId.value);
});
const canCreateProductOrder = computed(()=> orderKind.value==='SP' && cartItems.value.length>0 && (identity.value==='guest' || !!selectedMember.value) );
const canOpenSettle = computed(()=> (orderKind.value==='SP' ? canCreateProductOrder.value : canCreateServiceOrder.value));

async function submitServiceOrder(){
    if (!cartItems.value.length){ ElMessage.error('请添加至少一个服务商品'); return; }
    // 车辆校验
    let vehicleIdResolved: number|undefined;
    if (identity.value==='guest'){
        if (guestVehicleId.value){ vehicleIdResolved = guestVehicleId.value; }
        else {
            if (!plateNumber.value){ ElMessage.error('请输入车牌号'); return; }
            const v = await ensureVehicleForPlate(plateNumber.value, null);
            if (!v?.id){ ElMessage.error('创建/获取车辆失败'); return; }
            vehicleIdResolved = v.id;
        }
    } else {
        if (!selectedMember.value){ ElMessage.error('请选择会员'); return; }
        if (!memberVehicleId.value){ ElMessage.error('请选择会员车辆'); return; }
        vehicleIdResolved = Number(memberVehicleId.value);
    }
    creating.value = true;
    try{
        const items = cartItems.value.map(it=>({ productId: it.productId ?? null, skuId: it.skuId ?? null, name: it.name, imageUrl: it.imageUrl ?? null, specsText: it.specsText ?? null, barcode: it.barcode ?? null, price: it.price, discount: 0, quantity: it.quantity }));
        const memberIdResolved = identity.value==='member' && selectedMember.value ? Number(selectedMember.value.id) : (GUEST_MEMBER_ID_CONST || await ensureGuestMemberId());
        const payload:any = { type: 'SERVICE', memberId: memberIdResolved, items, userRemark: null, vehicleId: vehicleIdResolved, payAfterService: !!payAfterService.value } as any;
        try{ if ((settleDialog as any).groupId) payload.groupId = Number((settleDialog as any).groupId); }catch{}
        const res:any = await http('/orders', { method:'POST', body: payload });
        if (res?.id){
            ElMessage.success('服务订单已创建');
            if (!payAfterService.value) {
                // 新策略：非先付服务单立即在结算弹窗内完成支付
                settleDialog.visible = true; settleDialog.isService = true; settleDialog.createdOrderId = Number(res.id); settleDialog.tab = 'wx';
            }
        }
        clearCart(); plateNumber.value=''; guestVehicleId.value=undefined; guestVehicleKeyword.value='';
    } catch(e:any){ ElMessage.error(String(e?.message||'创建失败')); }
    finally { creating.value = false; }
}

async function submitProductOrder(){ if (orderKind.value!=='SP') return; if (!cartItems.value.length){ ElMessage.error('请添加商品'); return; } if (identity.value==='member' && !selectedMember.value){ ElMessage.error('请选择会员'); return; } // 不立即创建订单，仅打开结算弹窗
    settleDialog.createdOrderId = null; settleDialog.isService=false; settleDialog.tab='wx'; settleDialog.manualMethod='CASH'; settleDialog.wxAuthCode=''; settleDialog.visible=true; }

// ============ 统一结算弹窗（新增） ============
const queueTypes = ref<any[]>([]);
const settleDialog = reactive({ visible:false, tab:'wx' as 'manual'|'wx'|'wash', manualMethod:'CASH' as 'CASH'|'OFFLINE'|'SHOUQIANBA', wxAuthCode:'', loading:false, isService:false, isFk:false, fkAmount: 0 as number, createdOrderId: null as number|null, queueTypeId: undefined as number|undefined, serviceProductIds: [] as number[], washPrefer:'AUTO' as 'AUTO'|'MEMBER'|'GROUP', delivery: 'PICKUP' as 'EXPRESS'|'PICKUP', shippingAddressId: undefined as number|undefined, memberAddresses: [] as any[], showMemberAddrForm: false, addrForm: { province:'', city:'', district:'', street:'', detail:'', phone:'', label:'' }, groupId: undefined as number|undefined, groupName: '' as string, cashierDiscountAmount: 0 as number });
const serviceProductsInCart = computed(()=> cartItems.value.filter(it=> it.productType==='SERVICE' && Number(it.productId||0)>0));
async function loadQueueTypes(){ try{ queueTypes.value = await http<any[]>('/queue-types', { method:'GET' }).catch(()=>[]); }catch{ queueTypes.value = []; } }
function openSettleDialog(){ if (!canOpenSettle.value) return; settleDialog.visible=true; settleDialog.isService = (orderKind.value==='SERVICE'); settleDialog.createdOrderId=null; settleDialog.tab='wx'; settleDialog.manualMethod='CASH'; settleDialog.wxAuthCode='';
    // 配送方式默认与限制：优先自提，其次快递；仅在自提不可用时选择快递
    settleDialog.delivery = hasPhysicalInCart.value ? 'PICKUP' : 'PICKUP';
    // 计算禁用项（需要在商品数据中带出 shipAllow*，此处做容错：未知视为可用）
    try{
        const phys = cartItems.value.filter(it=> it.productType==='PHYSICAL');
        const allAllowExpress = phys.every(it=> (it as any)?.shipAllowExpress !== false);
        const allAllowPickup = phys.every(it=> (it as any)?.shipAllowPickup !== false);
        (settleDialog as any).deliveryAllowExpress = allAllowExpress;
        (settleDialog as any).deliveryAllowPickup = allAllowPickup;
        if (phys.length){
            if (!allAllowPickup && allAllowExpress) settleDialog.delivery = 'EXPRESS';
            else settleDialog.delivery = 'PICKUP';
        }
    }catch{ (settleDialog as any).deliveryAllowExpress = true; (settleDialog as any).deliveryAllowPickup = true; }
    // 打开时清理上次集团信息与收银立减
    (settleDialog as any).groupId = undefined; (settleDialog as any).groupName = '';
    (settleDialog as any).cashierDiscountAmount = 0;
    (settleDialog as any).isFk = false; (settleDialog as any).fkAmount = 0;
    settleDialog.shippingAddressId = undefined; settleDialog.memberAddresses = []; settleDialog.showMemberAddrForm=false; settleDialog.addrForm = { province:'', city:'', district:'', street:'', detail:'', phone:'', label:'' };
    if (orderKind.value==='SERVICE' && payAfterService.value){ loadQueueTypes(); }
    if (orderKind.value==='SP' && identity.value==='member' && selectedMember.value && hasPhysicalInCart.value){ loadMemberAddresses(Number(selectedMember.value.id)); }
    // 打开时确保已加载券详情，保证弹窗中的预计显示正确
    try{ ensureCouponDetailsLoaded(); }catch{}
}
async function confirmSettleManual(){ try{ if (orderKind.value==='SERVICE' && payAfterService.value){ await createServiceOrderAndEnqueue(); settleDialog.visible=false; clearCart(); return; } let oid = settleDialog.createdOrderId; if (!oid){ oid = await ensureOrderForSettle(); } if (!oid){ ElMessage.error('未找到订单'); return; } settleDialog.loading=true; await http(`/orders/${oid}/pay/manual`, { method:'POST', body:{ method: settleDialog.manualMethod } }); ElMessage.success('支付已标记'); settleDialog.visible=false; clearCart(); selectedCouponIds.value=[]; usedPoints.value=0; } catch(e:any){ ElMessage.error(String(e?.message||'支付失败')); } finally { settleDialog.loading=false; } }
async function confirmSettleWx(){ try{ if (orderKind.value==='SERVICE' && payAfterService.value){ await createServiceOrderAndEnqueue(); settleDialog.visible=false; clearCart(); return; } let oid = settleDialog.createdOrderId; if (!oid){ oid = await ensureOrderForSettle(); } if (!oid){ ElMessage.error('未找到订单'); return; } const code = String(settleDialog.wxAuthCode||'').trim(); if (!code){ ElMessage.error('请输入授权码'); return; } settleDialog.loading=true; await http(`/orders/${oid}/pay/wx-micropay`, { method:'POST', body:{ authCode: code } }); ElMessage.success('微信付款成功'); settleDialog.visible=false; clearCart(); selectedCouponIds.value=[]; usedPoints.value=0; } catch(e:any){ ElMessage.error(String(e?.message||'支付失败')); } finally { settleDialog.loading=false; } }
async function confirmSettleWash(){ try{ if (orderKind.value!=='SERVICE'){ ElMessage.error('仅服务订单支持划扣'); return; } if (payAfterService.value){ await createServiceOrderAndEnqueue(); settleDialog.visible=false; clearCart(); return; } let oid = settleDialog.createdOrderId; if (!oid){ oid = await ensureOrderForSettle(); } if (!oid){ ElMessage.error('未找到订单'); return; } settleDialog.loading=true; const prefer = settleDialog.washPrefer==='AUTO' ? undefined : (settleDialog.washPrefer as any); await http(`/orders/${oid}/pay/wash-card`, { method:'POST', body:{ prefer } }); ElMessage.success('洗车卡划扣成功'); settleDialog.visible=false; clearCart(); } catch(e:any){ ElMessage.error(String(e?.message||'划扣失败')); } finally { settleDialog.loading=false; } }

function onConfirmEnqueue(){ createServiceOrderAndEnqueue().then(()=>{ try{ settleDialog.visible=false; clearCart(); }catch{} }); }

// 在结算弹窗内按需创建订单（SP 或 非先付的服务单）
async function ensureOrderForSettle(): Promise<number|null>{
    try{
        // 互斥前置校验：若所选券不允许叠加会员折扣而开关仍为开，先提示并中断
        if (!memberDiscountAllowedByCoupons.value && enableMemberDiscount.value){
            ElMessage.error('所选优惠券不可与会员折扣同享，请先关闭会员折扣或更换优惠券');
            return null;
        }
        if (!pointsAllowedByCoupons.value && Number(usedPoints.value||0)>0){
            ElMessage.error('所选优惠券不可与积分同享，请清空积分或更换优惠券');
            return null;
        }
        if (settleDialog.createdOrderId){ return Number(settleDialog.createdOrderId); }
        const items = cartItems.value.map(it=>({ productId: it.productId ?? null, skuId: it.skuId ?? null, name: it.name, imageUrl: it.imageUrl ?? null, specsText: it.specsText ?? null, barcode: it.barcode ?? null, price: it.price, discount: 0, quantity: it.quantity }));
        if (!items.length){ ElMessage.error('请添加商品/服务'); return null; }
        if (orderKind.value === 'SP'){
            const memberIdForSp = identity.value==='member' && selectedMember.value ? Number(selectedMember.value.id) : (GUEST_MEMBER_ID_CONST || await ensureGuestMemberId());
            // 配送与地址
            const requiresAddress = hasPhysicalInCart.value && settleDialog.delivery==='EXPRESS';
            let shippingAddressId: number|undefined = undefined;
            if (requiresAddress){
                if (identity.value==='member'){
                    if (settleDialog.shippingAddressId){ shippingAddressId = Number(settleDialog.shippingAddressId); }
                    else if (settleDialog.showMemberAddrForm){
                        const id = await ensureMemberAddressCreated(Number(selectedMember.value!.id));
                        if (!id){ ElMessage.error('请完善收货地址'); return null; }
                        shippingAddressId = id;
                    } else {
                        ElMessage.error('请选择收货地址'); return null;
                    }
                } else {
                    const id = await ensureGuestAddressCreated();
                    if (!id){ ElMessage.error('请完善收货地址'); return null; }
                    shippingAddressId = id;
                }
            }
            const isGuest = !(identity.value==='member' && selectedMember.value);
            const payload:any = { type: 'SP', memberId: memberIdForSp, items, usedPoints: isGuest ? 0 : (pointsAllowedByCoupons.value ? (usedPoints.value || 0) : 0), memberCouponIds: isGuest ? undefined : (selectedCouponIds.value.length ? selectedCouponIds.value : undefined), disableMemberDiscount: isGuest ? true : !(enableMemberDiscount.value && memberDiscountAllowedByCoupons.value), noExpress: !requiresAddress, shippingAddressId };
            try{ const v = Math.max(0, Number((settleDialog as any).cashierDiscountAmount||0)); if (v>0) (payload as any).cashierDiscountAmount = Number(v.toFixed(2)); }catch{}
            const res:any = await http('/orders', { method:'POST', body: payload });
            if (res?.id){ settleDialog.createdOrderId = Number(res.id); return Number(res.id); }
            return null;
        } else {
            // 服务单（非先服务后付）
            let vehicleIdResolved: number|undefined;
            if (identity.value==='guest'){
                if (guestVehicleId.value){ vehicleIdResolved = guestVehicleId.value; }
                else {
                    if (!plateNumber.value){ ElMessage.error('请输入车牌号'); return null; }
                    const v = await ensureVehicleForPlate(plateNumber.value, null);
                    if (!v?.id){ ElMessage.error('创建/获取车辆失败'); return null; }
                    vehicleIdResolved = v.id;
                }
            } else {
                if (!selectedMember.value){ ElMessage.error('请选择会员'); return null; }
                if (!memberVehicleId.value){ ElMessage.error('请选择会员车辆'); return null; }
                vehicleIdResolved = Number(memberVehicleId.value);
            }
            const memberIdResolved = identity.value==='member' && selectedMember.value ? Number(selectedMember.value.id) : (GUEST_MEMBER_ID_CONST || await ensureGuestMemberId());
            const payload:any = { type: 'SERVICE', memberId: memberIdResolved, items, userRemark: null, vehicleId: vehicleIdResolved, payAfterService: false } as any;
            try{ const v = Math.max(0, Number((settleDialog as any).cashierDiscountAmount||0)); if (v>0) (payload as any).cashierDiscountAmount = Number(v.toFixed(2)); }catch{}
            // 若为集团车辆，显式传 groupId
            try{ if ((settleDialog as any).groupId) payload.groupId = Number((settleDialog as any).groupId); }catch{}
            const res:any = await http('/orders', { method:'POST', body: payload });
            if (res?.id){ settleDialog.createdOrderId = Number(res.id); return Number(res.id); }
            return null;
        }
    }catch(e:any){ ElMessage.error(String(e?.message||'创建订单失败')); return null; }
}
async function createServiceOrderAndEnqueue(){ if (!payAfterService.value) return; if (!settleDialog.queueTypeId){ ElMessage.error('请选择队列类型'); return; } const pids = settleDialog.serviceProductIds.length ? settleDialog.serviceProductIds : serviceProductsInCart.value.map(it=> Number(it.productId)); if (!pids.length){ ElMessage.error('请选择服务商品'); return; } let vehicleIdResolved: number|undefined; if (identity.value==='guest'){ if (guestVehicleId.value) vehicleIdResolved = guestVehicleId.value; else { if (!plateNumber.value){ ElMessage.error('请输入车牌号'); return; } const v = await ensureVehicleForPlate(plateNumber.value, null); if (!v?.id){ ElMessage.error('创建/获取车辆失败'); return; } vehicleIdResolved = v.id; } } else { if (!selectedMember.value){ ElMessage.error('请选择会员'); return; } if (!memberVehicleId.value){ ElMessage.error('请选择会员车辆'); return; } vehicleIdResolved = Number(memberVehicleId.value); } const body:any = { queueTypeId: settleDialog.queueTypeId, productIds: pids, vehicleId: vehicleIdResolved, plateNumber: vehicleIdResolved? undefined : plateNumber.value || undefined, userRemark: null }; try{ if ((settleDialog as any).groupId) body.groupId = Number((settleDialog as any).groupId); }catch{} await http('/queue/create-service-order-and-enqueue', { method:'POST', body }); ElMessage.success('已创建服务订单并入队'); }

// ============ 挂单/取单（8 槽） ============
const hangDrawer = ref(false);
const hangSlots = ref<Array<any|null>>([null,null,null,null,null,null,null,null]);
const HANG_KEY = 'pos_hang_slots_v1';
function loadHangFromStorage(){ try{ const raw = localStorage.getItem(HANG_KEY); if (!raw) return; const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length===8) hangSlots.value = arr; }catch{} }
function saveHangToStorage(){ try{ localStorage.setItem(HANG_KEY, JSON.stringify(hangSlots.value)); }catch{} }
function openHangDrawer(){ hangDrawer.value = true; }
function snapshotSummary(): string { const kind = orderKind.value==='SERVICE' ? '服务' : '商品'; const count = cartItems.value.reduce((s,it)=> s+Number(it.quantity||0), 0); return `${kind}｜${count}件｜应收¥${payAmount.value.toFixed(2)}`; }
function saveToHang(){ ElMessageBox.prompt('为挂单填写名称或标签（如 皖A88XX/张三）', '挂单', { inputPlaceholder:'例如：张三-黑AT8888', inputPattern:/^.{1,20}$/ , inputErrorMessage:'1~20个字符' }).then(({ value }: any)=>{ const idx = hangSlots.value.findIndex(s=> !s); const slotIdx = idx>=0 ? idx : 0; hangSlots.value[slotIdx] = { label: String(value||'挂单'), orderKind: orderKind.value, items: cartItems.value, member: selectedMember.value, plateNumber: plateNumber.value, coupons: selectedCouponIds.value, usedPoints: usedPoints.value, enableMemberDiscount: enableMemberDiscount.value, summary: snapshotSummary(), payAfterService: payAfterService.value, // 扩展快照字段
		identity: identity.value, guestVehicleId: guestVehicleId.value, memberVehicleId: memberVehicleId.value, delivery: settleDialog.delivery, shippingAddressId: settleDialog.shippingAddressId, queueTypeId: settleDialog.queueTypeId, serviceProductIds: settleDialog.serviceProductIds };
	saveHangToStorage(); ElMessage.success(`已挂单：${value}`); }).catch(()=>{}); }
function loadFromHang(idx: number){ const s = hangSlots.value[idx]; if (!s) return; orderKind.value = s.orderKind || 'SERVICE'; cartItems.value = Array.isArray(s.items) ? s.items : []; selectedMember.value = s.member || null; identity.value = s.identity || (selectedMember.value ? 'member' : 'guest'); plateNumber.value = s.plateNumber || ''; selectedCouponIds.value = Array.isArray(s.coupons) ? s.coupons : []; usedPoints.value = Number(s.usedPoints||0); enableMemberDiscount.value = !!s.enableMemberDiscount; payAfterService.value = !!s.payAfterService; // 恢复扩展字段
	guestVehicleId.value = s.guestVehicleId; memberVehicleId.value = s.memberVehicleId; settleDialog.delivery = s.delivery || (hasPhysicalInCart.value ? 'EXPRESS' : 'PICKUP'); settleDialog.shippingAddressId = s.shippingAddressId; settleDialog.queueTypeId = s.queueTypeId; settleDialog.serviceProductIds = Array.isArray(s.serviceProductIds) ? s.serviceProductIds : []; recompute(); ElMessage.success(s.label ? `已取单：${s.label}` : `已取单 ${idx+1}`); }
function clearHang(idx: number){ hangSlots.value[idx] = null; saveHangToStorage(); }

function resetAll(){ orderKind.value = 'SERVICE'; activeCategoryId.value = undefined; keyword.value = ''; showOnlyEnabled.value = true; clearCart(); selectedMember.value = null; plateNumber.value = ''; selectedCouponIds.value = []; usedPoints.value = 0; enableMemberDiscount.value = true; payAfterService.value = true; loadCategories(); loadProducts(); }

onMounted(async ()=>{ loadHangFromStorage(); await Promise.all([loadCategories(), loadProducts()]); window.addEventListener('keydown', onGlobalKeydown); });
onBeforeUnmount(()=>{ try{ window.removeEventListener('keydown', onGlobalKeydown); }catch{} });
async function ensureGuestMemberId(): Promise<number>{
	// 后端已通过环境变量配置游客会员ID，这里不再读取，仅返回 0 交由后端自动归属
	return 0;
}
async function ensureVehicleForPlate(plate: string, memberId?: number|null): Promise<any|null>{
	const p = String(plate||'').trim(); if (!p) return null;
	// 直接尝试创建游客车辆（后端存在即返回），若传入 memberId 则不绑定，只作为服务订单车辆
	try{ const v = await http<any>('/vehicle/guest/create', { method:'POST', body: { plateNumber: p } }); return v||null; }catch{ return null; }
}
function setGuestMode(){ identity.value = 'guest'; selectedMember.value = null; memberVehicles.value = []; memberVehicleId.value = undefined; }

// ============ 游客车辆搜索 ============
const guestVehicleKeyword = ref('');
const guestVehicleId = ref<number|undefined>();
async function queryGuestVehicles(q: string, cb: (list:any[])=>void){
	try{
		const kw = String(q||'').trim(); if (!kw) { cb([]); return; }
		const res = await http<any[]>(`/vehicle/list?guest=1&keyword=${encodeURIComponent(kw)}&page=1&pageSize=20`, { method:'GET' }).catch(()=>[]);
		const items = Array.isArray((res as any)?.items) ? (res as any).items : (Array.isArray(res) ? res : []);
		cb(items);
	}catch{ cb([]); }
}
function onPickGuestVehicle(v:any){ try{ guestVehicleId.value = Number(v?.id||0)||undefined; settingPlateProgrammatically = true; plateNumber.value = String(v?.plateNumber||''); nextTick().then(()=>{ settingPlateProgrammatically=false; }); }catch{} }
function clearGuestVehicle(){ guestVehicleId.value = undefined; guestVehicleKeyword.value = ''; }

// ============ 会员地址管理 ============
async function loadMemberAddresses(memberId: number){ try{ const list = await http<any[]>(`/address/member/${memberId}`, { method:'GET' }).catch(()=>[]); settleDialog.memberAddresses = Array.isArray(list) ? list : []; }catch{ settleDialog.memberAddresses = []; } }
function openCreateMemberAddress(){ settleDialog.showMemberAddrForm = true; }
function validateAddrForm(): boolean { const f = settleDialog.addrForm; if (!f.province || !f.city || !f.district || !f.street) return false; if (!f.detail || !/\S+/.test(f.detail)) return false; if (!/^1\d{10}$/.test(String(f.phone||''))) return false; return true; }
async function ensureGuestAddressCreated(): Promise<number|null>{ try{ const f = settleDialog.addrForm; if (!validateAddrForm()) return null; const res:any = await http('/address/admin/create', { method:'POST', body: { useGuest: true, input: { province:f.province, city:f.city, district:f.district, street:f.street, detail:f.detail, phone:f.phone, label: f.label||null } } }); return Number(res?.id||0) || null; }catch{ return null; } }
async function ensureMemberAddressCreated(memberId:number): Promise<number|null>{ try{ const f = settleDialog.addrForm; if (!validateAddrForm()) return null; const res:any = await http('/address/admin/create', { method:'POST', body: { memberId, input: { province:f.province, city:f.city, district:f.district, street:f.street, detail:f.detail, phone:f.phone, label: f.label||null } } }); return Number(res?.id||0) || null; }catch{ return null; } }
function addrDisplay(a:any){ if(!a) return ''; const label = a.label ? `（${a.label}）` : ''; return `${a.province}${a.city}${a.district}${a.street}${a.detail}${label} ${a.phone}`; }

// 管理地址对话框（统一实现）
const addrDialog = reactive({ visible:false, list: [] as any[], editing: false, saving: false, currentId: null as number|null, form: { province:'', city:'', district:'', street:'', detail:'', phone:'', label:'' } });
function openManageMemberAddress(){ if (!selectedMember.value) { ElMessage.error('请先选择会员'); return; } addrDialog.visible=true; addrDialog.editing=false; loadAddressList(); }
async function loadAddressList(){ try{ const mid = Number(selectedMember.value?.id||0); const list = await http<any[]>(`/address/member/${mid}`, { method:'GET' }).catch(()=>[]); addrDialog.list = Array.isArray(list) ? list : []; }catch{ addrDialog.list = []; } }
function beginCreateAddress(){ addrDialog.editing=true; addrDialog.currentId=null; addrDialog.form = { province:'', city:'', district:'', street:'', detail:'', phone:'', label:'' }; }
function beginEditAddress(row:any){ addrDialog.editing=true; addrDialog.currentId = Number(row?.id||0)||null; addrDialog.form = { province: row.province||'', city: row.city||'', district: row.district||'', street: row.street||'', detail: row.detail||'', phone: row.phone||'', label: row.label||'' }; }
async function saveAddress(){ try{ if (!selectedMember.value){ ElMessage.error('缺少会员'); return; } const f = addrDialog.form; if (!/^1\d{10}$/.test(String(f.phone||''))) { ElMessage.error('手机号格式不正确'); return; } if (!f.province||!f.city||!f.district||!f.street||!f.detail){ ElMessage.error('请完善地址信息'); return; } addrDialog.saving=true; if (addrDialog.currentId){ await http(`/address/admin/${addrDialog.currentId}`, { method:'PUT', body: { ...f } }); ElMessage.success('已保存'); } else { await http('/address/admin/create', { method:'POST', body: { memberId: Number(selectedMember.value.id), input: { ...f } } }); ElMessage.success('已新增'); } addrDialog.editing=false; await loadAddressList(); await loadMemberAddresses(Number(selectedMember.value.id)); }
catch(e:any){ ElMessage.error(String(e?.message||'保存失败')); }
finally{ addrDialog.saving=false; } }
async function deleteAddress(row:any){ try{ const id = Number(row?.id||0)||0; if (!id) return; await http(`/address/admin/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await loadAddressList(); await loadMemberAddresses(Number(selectedMember.value!.id)); if (settleDialog.shippingAddressId===id) settleDialog.shippingAddressId=undefined; } catch(e:any){ ElMessage.error(String(e?.message||'删除失败')); } }

const currentPlate = computed(()=>{
    if (orderKind.value==='SERVICE'){
        if (identity.value==='guest') return plateNumber.value || '';
        const v = memberVehicles.value.find(x=> x.id===memberVehicleId.value);
        return v?.plateNumber || '';
    }
    return '';
});
async function quickPlateInput(){
    if (orderKind.value!=='SERVICE') return;
    identity.value = 'guest';
    await nextTick();
    try{ (summaryRef.value as any)?.openPlate?.(); }catch{}
}
function editGuestPlate(){ try{ guestVehicleId.value = undefined; nextTick().then(()=>{ try{ (summaryRef.value as any)?.openPlate?.(); }catch{} }); }catch{} }
// 若用户在游客模式直接修改了输入框中的车牌，自动清空已选游客车辆，避免误用
watch(plateNumber, (val)=>{
    try{
        if (identity.value !== 'guest') return;
        if (!guestVehicleId.value) return;
        if (settingPlateProgrammatically) return;
        guestVehicleId.value = undefined;
        guestVehicleKeyword.value = '';
    }catch{}
});

// ============ 无商品收款弹窗 ============
const fkDialog = reactive({ visible: false, amount: 0 as number, remark: '' });
const orderKindForDialog = computed(()=> (settleDialog as any).isFk ? 'FK' : orderKind.value);
const dialogSubtotal = computed(()=> (settleDialog as any).isFk ? Math.max(0, Number(((settleDialog as any).fkAmount||0))) : subtotal.value);
const dialogPayAmount = computed(()=> (settleDialog as any).isFk ? Math.max(0, Number(((settleDialog as any).fkAmount||0))) : payAmount.value);
function openFkDialog(){ fkDialog.visible = true; fkDialog.amount = 0; fkDialog.remark=''; }
async function confirmFkCollect(){
    try{
        const amt = Math.max(0, Number(fkDialog.amount||0));
        const remark = String(fkDialog.remark||'').trim();
        if (!Number.isFinite(amt) || amt<=0){ ElMessage.error('请填写大于0的收款金额'); return; }
        if (!remark){ ElMessage.error('请填写备注'); return; }
        const body:any = { amount: Number(amt.toFixed(2)), remark };
        if (identity.value==='member' && selectedMember.value){ body.memberId = Number(selectedMember.value.id); }
        const res:any = await http('/orders/_create-fk', { method:'POST', body });
        if (!res?.id){ ElMessage.error('创建付款订单失败'); return; }
        // 打开统一结算弹窗（付款订单）
        (settleDialog as any).isFk = true; (settleDialog as any).fkAmount = Number(amt.toFixed(2));
        settleDialog.isService = false; settleDialog.createdOrderId = Number(res.id); settleDialog.tab = 'wx'; settleDialog.visible = true;
        fkDialog.visible = false;
    }catch(e:any){ ElMessage.error(String(e?.message||'提交失败')); }
}
</script>

<style scoped>
.layout{ display:flex; gap:12px; height:100%; min-height:0; overflow:hidden; contain: layout size paint; }
.left{ flex: 1 1 auto; min-width: 0; display:flex; flex-direction: column; gap:8px; }
.right{ width: 520px; flex: 0 0 auto; display:flex; flex-direction: column; gap:8px; min-height:0; overflow:hidden; }
.actions{ display:flex; gap:8px; }
.toolbar{ display:flex; flex-direction: column; gap:8px; }
.filters{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.products{ flex:1 1 auto; min-height: 200px; }
.grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
.prod{ background:#fff; border:1px solid var(--el-border-color); border-radius:8px; overflow:hidden; cursor:pointer; user-select:none; position:relative; }
.thumb{ position:relative; width:100%; padding-top: 70%; background:#fafafa; display:flex; align-items:center; justify-content:center; }
.thumb img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.noimg{ position:absolute; color:#999; }
.badges{ position:absolute; left:6px; top:6px; display:flex; gap:4px; flex-wrap:wrap; }
.mask{ position:absolute; inset:0; background:rgba(255,255,255,0.6); display:flex; align-items:center; justify-content:center; color:#666; font-weight:600; font-size:14px; }
.info{ padding:8px; display:flex; flex-direction:column; gap:6px; }
.name{ font-weight:600; line-height:1.2; height: 38px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; line-clamp: 2; -webkit-box-orient:vertical; }
.price{ color:#333; display:flex; align-items:baseline; gap:6px; }
.price .num{ font-size:16px; font-weight:700; }
.price .range{ color:#999; font-size:12px; }
.stock{ color:#909399; font-size:12px; }

.panel{ background:#fff; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:10px; flex:1 1 auto; min-height:0; overflow:hidden; }
.panel-body{ flex: 1 1 auto; min-height: 0; overflow: auto; display:flex; flex-direction:column; gap:10px; padding-bottom: 12px; }
.section{ display:flex; flex-direction:column; gap:10px; }
.row{ display:grid; grid-template-columns: 92px 1fr auto; gap:8px; align-items:center; }
.row.compact{ grid-template-columns: 72px 1fr auto; }
.label{ color:#666; }
.member-sug .muted{ color:#999; margin-left:6px; }

.cart{ background:#fff; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px; max-height: 360px; overflow:auto; }
.cart-head{ display:flex; justify-content:space-between; align-items:center; }
.cart-item{ border-bottom:1px dashed var(--el-border-color); padding:8px 0; display:flex; flex-direction:column; gap:6px; }
.ci-name{ font-weight:600; }
.specs{ color:#999; font-weight:400; }
.ci-ops{ display:flex; align-items:center; gap:8px; justify-content:space-between; }
.ci-price{ font-weight:700; }

.settle{ background:#fff; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:10px; }
.footer{ background:#fff; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; display:flex; align-items:flex-end; justify-content:space-between; gap:10px; box-shadow: 0 -4px 12px rgba(0,0,0,0.04); }
.amounts{ display:flex; flex-direction:column; gap:6px; }
.amounts .line{ display:flex; justify-content:space-between; gap:12px; }
.amounts .total b{ color: var(--el-color-primary); font-size:18px; }
.buttons{ display:flex; gap:8px; }
/* 禁用卡片态 */
.prod.disabled{ opacity: 0.6; cursor: not-allowed; }

/* SKU */
.sku-list{ display:flex; flex-direction:column; gap:8px; max-height:50vh; overflow:auto; }
.sku-row{ display:grid; grid-template-columns: 1fr auto auto; gap:8px; padding:8px; border:1px solid var(--el-border-color); border-radius:6px; cursor:pointer; }
.sku-stock.zero{ color: #d03050; }

/* 挂单 */
.hang-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:10px; }
.hang-slot{ border:1px dashed var(--el-border-color); border-radius:8px; padding:10px; min-height:100px; display:flex; flex-direction:column; gap:8px; }
.slot-title{ font-weight:700; }
.slot-empty{ color:#999; }
.slot-actions{ display:flex; gap:6px; }

/* 平板触控优化（12.7英寸） */
:deep(.el-button--large){ padding:14px 18px; }
:deep(.el-input__wrapper){ padding:10px 12px; }
.pay-box{ display:flex; flex-direction:column; gap:10px; }
.pay-box .summary{ background:#f9fafb; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; }
.pay-box .amt{ display:flex; flex-direction:column; gap:6px; }
.hint{ color:#909399; font-size:12px; }
@media (max-width: 1440px){ .right{ width: 440px; } .grid{ grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); } }

.addr-form-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }

.summary-card{ border:1px solid var(--el-border-color); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:12px; background:#fff; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
.sc-row{ display:grid; grid-template-columns: 88px 1fr; gap:12px; align-items:center; min-height: 56px; }
.sc-label{ color:#666; }
.sc-content{ display:flex; align-items:center; min-height: 56px; }
.sc-benefit{ display:flex; gap:10px; flex-wrap:wrap; }
/* 统一由 SummaryCard 控制尺寸，移除此处放大规则 */
.summary-card :deep(.el-radio-button--large .el-radio-button__inner){ padding:10px 18px; }
/* 放大已有车辆自动完成输入框视觉尺寸 */
.wide-input :deep(.el-input__wrapper){ padding:16px 18px !important; min-height:56px !important; height:auto !important; }
.wide-input :deep(.el-input__inner){ font-size:18px !important; line-height:24px !important; }

.guest-vehicle-chip{
    background-color: #f0f0f0;
    border-radius: 4px;
    padding: 4px 8px;
    margin-right: 8px;
    font-size: 14px;
    color: #333;
}

.edit-button{
    margin-left: 8px;
    background-color: #409eff;
    color: #fff;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
}

.clear-button{
    background-color: #f56c6c;
    color: #fff;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
}

/* 无商品收款弹窗样式（适配12.7英寸平板） */
.fk-dialog :deep(.el-dialog__header){ padding: 14px 16px; }
.fk-form{ display:flex; flex-direction:column; gap:14px; padding: 4px 2px; }
.fk-row{ display:grid; grid-template-columns: 96px 1fr; gap:12px; align-items:flex-start; }
.fk-label{ color:#555; font-weight:600; line-height:36px; }
.fk-field{ display:flex; flex-direction:column; gap:8px; }
.fk-amount-input{ display:grid; grid-template-columns: 220px 1fr; gap:16px; align-items:center; }
.fk-amount-input :deep(.el-input__wrapper){ padding: 8px 10px; }
.fk-amount-input :deep(.el-input__inner){ font-size:18px; font-weight:700; }
.fk-amount-large{ font-size:28px; font-weight:800; color:#111827; letter-spacing:0.5px; }
.fk-quick{ display:flex; gap:8px; flex-wrap:wrap; }
.fk-quick :deep(.el-button--small){ padding: 6px 10px; }
.fk-hint{ color:#909399; font-size:12px; }
.fk-footer{ display:flex; justify-content:flex-end; gap:10px; width:100%; }

@media (max-width: 1440px){
  .fk-amount-input{ grid-template-columns: 200px 1fr; }
  .fk-amount-large{ font-size:24px; }
}
</style>


