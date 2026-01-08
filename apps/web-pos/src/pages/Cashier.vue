<template>
	<div class="cashier-page">
		<div class="layout">
			<!-- 左侧：用户选择/购物车 + 快捷操作 -->
			<div class="left-area">
				<div class="left-card">
					<div class="left-main">
						<!-- 区域1：会员信息（固定不滚动） -->
						<div class="member-section">
							<SummaryCard
								ref="summaryRef"
								:order-kind="orderKind"
								:identity="identity"
								:member-keyword="memberKeyword"
								:selected-member="selectedMember"
								:points-available="pointsAvailable"
								:member-vehicles="memberVehicles"
								:member-vehicle-id="memberVehicleId"
								:plate-number="plateNumber"
								@update:identity="(v: any)=>identity=v as any"
								@update:memberKeyword="(v: any)=>memberKeyword=v"
								@pick-member="onPickMember"
								@clear-member="clearMember"
								@open-member-drawer="openMemberDetailDrawer"
								@update:memberVehicleId="(v: any)=>memberVehicleId=v as any"
								@update:plateNumber="(v: any)=>plateNumber=v"
								@plate-confirm="onPlateConfirmed"
								@clear-guest-vehicle="clearGuestVehicle"
								@query-members="queryMembers"
							/>
						</div>

						<!-- 区域2：购物车（仅列表滚动） -->
						<div class="cart-section">
							<CartList
								class="cart-list"
								:embedded="true"
								:items="cartItems"
								@remove="idx=>removeItem(idx)"
								@clear="clearCart"
								@update-qty="(p:any)=>{ const { index, quantity } = p||{}; setCartItemQty(Number(index), Number(quantity)); }"
								@change-sku="idx=>openSkuDialogForCartIndex(Number(idx))"
							/>
						</div>

						<!-- 区域3：优惠明细 + 收款按钮（固定不滚动） -->
						<div class="checkout-section">
							<div class="settle-card">
								<div class="settle-top">
									<div class="settle-amt">
										<div class="settle-amt-label">应收</div>
										<div class="settle-amt-value">¥{{ payAmount.toFixed(2) }}</div>
									</div>
									<div
										class="settle-pill"
										role="button"
										tabindex="0"
										@click="discountDialog.visible=true"
										@keydown.enter.prevent="discountDialog.visible=true"
										@keydown.space.prevent="discountDialog.visible=true"
									>
										<span class="k">已优惠</span>
										<b class="v">¥{{ discountTotalDisplay.toFixed(2) }}</b>
										<span class="link">明细</span>
									</div>
								</div>
								<div class="settle-meta">
									<div class="m-item">
										<span class="k">小计</span>
										<b class="v">¥{{ subtotal.toFixed(2) }}</b>
									</div>
									<div class="m-item">
										<span class="k">件数</span>
										<b class="v">{{ cartQty }}</b>
									</div>
									<div class="m-item">
										<span class="k">类型</span>
										<b class="v">{{ orderKind==='SERVICE' ? '服务' : '商品' }}</b>
									</div>
									<div class="m-item muted">
										<span class="k">提示</span>
										<span class="v">收款后可选券/积分/折扣</span>
									</div>
								</div>
							</div>
							<template v-if="cartItems.length>0">
								<el-button class="pay-btn" size="large" type="primary" round :disabled="!canOpenSettle" @click="openSettleDialog">
									确认收款
								</el-button>
							</template>
							<template v-else>
								<el-button class="pay-btn" size="large" type="primary" round @click="openFkDialog" :disabled="identity==='member' && !selectedMember">
									无商品收款
								</el-button>
							</template>
						</div>
					</div>

					<!-- 区域4：右侧快捷操作（合并到左侧卡片内） -->
					<div class="ops-section">
						<el-space direction="vertical" :size="16" fill>
							<el-button size="large" @click="openHangDrawer"><el-icon><Collection /></el-icon> 挂单/取单</el-button>
							<el-button size="large" @click="openSettleDialogAt('coupon')" :disabled="cartItems.length===0"><el-icon><CollectionTag /></el-icon> 优惠券</el-button>
							<el-button size="large" @click="openSettleDialogAt('points')" :disabled="cartItems.length===0"><el-icon><CreditCard /></el-icon> 积分</el-button>
							<el-button size="large" @click="resetAll"><el-icon><Refresh /></el-icon> 重置</el-button>
						</el-space>
					</div>
				</div>
			</div>

			<!-- 右侧：选商品/服务（上）+ 分类商品（下） -->
			<div class="right-area">
				<ProductBrowser
					:order-kind="orderKind"
					:categories-display="categoriesDisplay"
					:active-category-id="activeCategoryId"
					:keyword="keyword"
					:products="products"
					:products-loading="productsLoading"
					:highlight-id="highlightProductId"
					@update:orderKind="v=>orderKind=v as any"
					@order-kind-change="onOrderKindChange"
					@update:activeCategoryId="v=>{ activeCategoryId=v as any; }"
					@update:keyword="v=>{ keyword=v; }"
					@search="loadProducts"
					@product-click="onProductCardClick"
				/>
			</div>
		</div>

			<!-- SKU 选择弹窗 -->
			<el-dialog v-model="skuDialog.visible" title="选择规格" width="520px">
				<template v-if="skuDialog.product">
					<div class="sku-list">
						<div
							v-for="s in skuDialog.product.skus"
							:key="s.id"
							class="sku-row"
							:class="{ 'no-stock': skuDialog.product?.type==='SERVICE', active: Number(skuDialog.currentSkuId||0)===Number(s.id||0) }"
							@click="chooseSku(s)"
						>
							<div class="sku-name">{{ s.name }}</div>
							<div class="sku-price">¥{{ Number(s.price||0).toFixed(2) }}</div>
							<div v-if="skuDialog.product?.type!=='SERVICE'" class="sku-stock" :class="{ zero: Number(s.stockQuantity||0)===0 }">库存：{{ s.stockQuantity ?? 0 }}</div>
						</div>
					</div>
				</template>
				<template #footer>
					<el-button @click="closeSkuDialog()">取消</el-button>
				</template>
			</el-dialog>

			<!-- 挂单抽屉 -->
			<HangDrawer
				v-model="hangDrawer"
				:hang-slots="hangSlots"
				:can-hang="canHangNow"
				:current-summary="snapshotSummarySafe"
				@hang="saveToHang"
				@load="loadFromHang"
				@rename="renameHang"
				@clear="clearHangConfirm"
				@clear-all="clearAllHang"
			/>

			<!-- 会员详情抽屉（点击会员头像） -->
			<MemberDetailDrawer
				v-model="memberDetailVisible"
				:member-id="memberDetailMemberId"
				:base-member="selectedMember"
			/>

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
                :pay-amount-cap="dialogPayAmountCap"
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
				:addr-display="addrDisplay"
					:points-available="pointsAvailable"
					
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

			<!-- 优惠明细弹窗 -->
			<el-dialog v-model="discountDialog.visible" title="优惠明细" width="520px" append-to-body>
				<div class="discount-dialog">
					<div class="dd-group">
						<div class="dd-title">优惠券</div>
						<template v-if="pickedCouponsForDetail.length">
							<div class="dd-row" v-for="c in pickedCouponsForDetail" :key="c.id">
								<span class="k">{{ c.name }}</span>
								<b class="v">-¥{{ c.amount.toFixed(2) }}</b>
							</div>
							<div class="dd-row dd-subtotal">
								<span class="k">优惠券合计</span>
								<b class="v">-¥{{ Number(couponDiscountEst||0).toFixed(2) }}</b>
							</div>
						</template>
						<div v-else class="dd-empty">未使用优惠券</div>
					</div>

					<div class="dd-group" v-if="memberDiscountApplied>0">
						<div class="dd-title">会员折扣</div>
						<div class="dd-row">
							<span class="k">折扣金额</span>
							<b class="v">-¥{{ memberDiscountApplied.toFixed(2) }}</b>
						</div>
					</div>

					<div class="dd-group" v-if="pointsAmountYuan>0">
						<div class="dd-title">积分抵扣</div>
						<div class="dd-row">
							<span class="k">抵扣金额</span>
							<b class="v">-¥{{ pointsAmountYuan.toFixed(2) }}</b>
						</div>
					</div>

					<div class="dd-group" v-if="cashierDiscountAmountApplied>0">
						<div class="dd-title">收银立减</div>
						<div class="dd-row">
							<span class="k">立减金额</span>
							<b class="v">-¥{{ cashierDiscountAmountApplied.toFixed(2) }}</b>
						</div>
					</div>

					<div class="dd-total">
						<span>已优惠合计</span>
						<b>¥{{ discountTotalDisplay.toFixed(2) }}</b>
					</div>
					<div v-if="couponOver>0" class="dd-hint">提示：优惠超过小计的部分以实际结算为准</div>
				</div>
				<template #footer>
					<el-button @click="discountDialog.visible=false">关闭</el-button>
				</template>
			</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { resolveGuestMemberId } from '../config';
import {
	addressControllerAdminCreate,
	addressControllerAdminDelete,
	addressControllerAdminUpdate,
	addressControllerListByMember,
	couponControllerGet,
	groupControllerGet,
	memberControllerGet,
	memberControllerList,
	memberCouponAdminControllerList,
	orderControllerCreateFk,
	orderControllerCreate,
	orderControllerMarkPaid,
	orderControllerWechatMicropay,
	orderControllerPayByWashCard,
	storeCategoryControllerList,
	storeProductControllerList,
	vehicleControllerAdminList,
	systemSettingControllerGetPublicSetting,
	vehicleControllerCreateGuest,
	vehicleControllerListByMember,
	vehicleControllerSearch,
} from '@wash/api-client';
import ProductBrowser from '../components/cashier/ProductBrowser.vue';
import SummaryCard from '../components/cashier/SummaryCard.vue';
import CartList from '../components/cashier/CartList.vue';
import MemberDetailDrawer from '../components/cashier/MemberDetailDrawer.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, Collection, CollectionTag, CreditCard } from '@element-plus/icons-vue';
import HangDrawer from '../components/cashier/HangDrawer.vue';
import AddressManager from '../components/cashier/AddressManager.vue';
import TypeMainDialog from '../components/cashier/TypeMainDialog.vue';
import SettleDialog from '../components/cashier/SettleDialog.vue';

async function withPosAuthGuard<T>(fn: () => Promise<T>): Promise<T> {
	// 对齐 ../utils/http.ts 的 httpWrap 行为：token 过期预判 + 401 兜底跳转
	try{
		const raw = localStorage.getItem('token') || '';
		const payload = JSON.parse(atob((raw.split('.')[1]||'').replace(/-/g,'+').replace(/_/g,'/'))||'{}');
		const exp = Number(payload?.exp || 0);
		if (exp && Date.now()/1000 > exp - 10) {
			localStorage.removeItem('token');
			localStorage.removeItem('user');
			if (typeof window !== 'undefined') {
				try {
					if (!(window as any).__HAS_SHOWN_401__) {
						(window as any).__HAS_SHOWN_401__ = true;
						ElMessage.error('登录已过期，请重新登录');
					}
				} catch {}
				window.location.href = '/pos/login';
			}
			throw new Error('登录已过期');
		}
	}catch{}
	try{
		return await fn();
	}catch(e:any){
		const msg = String(e?.message||'');
		if (/^HTTP\s*401/.test(msg) || /unauthorized/i.test(msg)){
			try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
			if (typeof window !== 'undefined') {
				try {
					if (!(window as any).__HAS_SHOWN_401__) {
						(window as any).__HAS_SHOWN_401__ = true;
						ElMessage.error('登录已过期，请重新登录');
					}
				} catch {}
				window.location.href = '/pos/login';
			}
		}
		throw e;
	}
}

// 扫码枪输入缓冲（避免影响输入框）
const scanBuf = reactive({ s: '', t: 0 });
function onGlobalKeydown(ev: KeyboardEvent){
	const target = ev.target as HTMLElement | null;
	if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
	// 快捷键（避免影响扫码枪缓冲）
	try{
		if (ev.ctrlKey || ev.metaKey){
			const k0 = String(ev.key||'').toLowerCase();
			if (k0 === 'h'){
				ev.preventDefault();
				openHangDrawer();
				return;
			}
		}
	}catch{}
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
		// 默认全部展示：扫码不额外加 enabled=true 过滤，后续会走 isProductDisabled 判定不可售
		const build = (t: string) => storeProductControllerList({ type: t, keyword: code } as any) as any;
		const [pa, pb] = await Promise.allSettled([build('PHYSICAL'), build('VIRTUAL_CARD')]);
		const arrA = pa.status==='fulfilled' ? (pa.value||[]) : []; const arrB = pb.status==='fulfilled' ? (pb.value||[]) : [];
		const list = [...arrA, ...arrB];
		if (list.length === 1){
			const p = list[0];
			if (isProductDisabled(p)) { ElMessage.warning('该商品不可售'); return; }
			if (p.specType === 'MULTI') { skuDialog.product = p; skuDialog.visible = true; skuDialog.cartIndex=null; skuDialog.currentSkuId=null; return; }
			const maxQuantity = getMaxQtyForProduct(p);
			if (maxQuantity === 0) { ElMessage.warning('库存不足'); return; }
			const item: CartItem = { productId: p.id, skuId: null, name: p.name, imageUrl: p.imageUrl ?? null, specsText: null, barcode: p.barcode ?? null, price: Number(p.price||0), quantity: 1, maxQuantity, specType: 'SINGLE', skuOptions: null, productType: p.type, pointsDeductible: !!p.pointsDeductible, memberDiscount: !!p.memberDiscount, shipAllowExpress: p?.shipAllowExpress !== false, shipAllowPickup: p?.shipAllowPickup !== false }
			const idx = cartItems.value.findIndex(x=> (x.productId||null)===(item.productId||null) && (x.skuId||null)===(item.skuId||null));
			if (idx>=0) {
				const cur = cartItems.value[idx];
				if (item.maxQuantity != null) cur.maxQuantity = item.maxQuantity;
				const next = Number(cur.quantity||0) + 1;
				const { qty, capped, cap } = clampQty(cur, next);
				if (capped) ElMessage.warning(`库存不足，最多可选 ${cap} 件`);
				cur.quantity = qty;
			} else {
				cartItems.value.push(item);
			}
			recompute();
			return;
		}
		keyword.value = code; await loadProducts();
	}catch(e:any){ ElMessage.error(String(e?.message||'扫码失败')); }
}

// ============ 订单类型 ============
// SERVICE: 服务订单（互斥于 SP 商品订单）
// SP: 实物/虚拟卡券商品订单
// 说明：服务订单同样支持优惠券/积分/会员折扣（由后端按规则校验），前端不应写死仅 SP 可用。
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
const categoriesDisplay = computed(()=> orderKind.value==='SERVICE' ? categoriesService.value : categoriesGoods.value);

const products = ref<any[]>([]);
const productsLoading = ref(false);

function displayPrice(p: any): string { if (p.specType === 'MULTI') return p.priceRange || ''; return Number(p.price||0).toFixed(2); }

async function loadCategories(){
	try{
		if (orderKind.value==='SERVICE'){
			categoriesService.value = (await storeCategoryControllerList({ type: 'SERVICE' } as any) as any) || [];
		}else{
			const [a, b] = await Promise.all([
				(storeCategoryControllerList({ type: 'PHYSICAL' } as any) as any).catch(()=>[]),
				(storeCategoryControllerList({ type: 'VIRTUAL_CARD' } as any) as any).catch(()=>[]),
			]);
			const map = new Map<number, any>();
			[...(a||[]), ...(b||[])].forEach((c:any)=>{ if (!map.has(c.id)) map.set(c.id, c); });
			categoriesGoods.value = Array.from(map.values());
		}
	}catch{}
}

async function loadProducts(){
	productsLoading.value = true;
	try{
		const cat = activeCategoryId.value;
		const kw = keyword.value.trim();
		if (orderKind.value==='SERVICE'){
			products.value = await storeProductControllerList({
				type: 'SERVICE',
				categoryId: cat ?? undefined,
				keyword: kw || undefined,
			} as any) as any;
		}else{
			const build = (t: string) => storeProductControllerList({
				type: t,
				categoryId: cat ?? undefined,
				keyword: kw || undefined,
			} as any) as any;
			const [pa, pb] = await Promise.allSettled([build('PHYSICAL'), build('VIRTUAL_CARD')]);
			const arrA = pa.status==='fulfilled' ? (pa.value||[]) : []; const arrB = pb.status==='fulfilled' ? (pb.value||[]) : [];
			products.value = [...arrA, ...arrB];
		}
	} catch(e:any){ ElMessage.error(String(e?.message||'加载失败')); } finally { productsLoading.value = false; }
}

// ============ 购物车与互斥 ============
interface CartItem { productId?: number|null; skuId?: number|null; name: string; imageUrl?: string|null; specsText?: string|null; barcode?: string|null; price: number; quantity: number; maxQuantity?: number|null; specType?: 'SINGLE'|'MULTI'|string|null; skuOptions?: any[]|null; productType?: 'SERVICE'|'PHYSICAL'|'VIRTUAL_CARD'; pointsDeductible?: boolean; memberDiscount?: boolean; shipAllowExpress?: boolean; shipAllowPickup?: boolean; }
const cartItems = ref<CartItem[]>([]);
function clearCart(){ cartItems.value = []; recompute(); reloadCouponsIfNeeded(); }
function removeItem(i: number){ cartItems.value.splice(i,1); recompute(); reloadCouponsIfNeeded(); }

function toInt(v: any, fallback = 0): number {
	const n = Number(v);
	if (!Number.isFinite(n)) return fallback;
	return Math.trunc(n);
}
function clampQty(item: CartItem, desired: number): { qty: number; capped: boolean; cap?: number } {
	const want = Math.max(1, toInt(desired, 1));
	const cap = item?.maxQuantity;
	if (cap == null) return { qty: want, capped: false };
	const c = Math.max(0, toInt(cap, 0));
	if (!c) return { qty: want, capped: false };
	if (want > c) return { qty: c, capped: true, cap: c };
	return { qty: want, capped: false, cap: c };
}
function setCartItemQty(index: number, desired: number){
	try{
		if (!Number.isFinite(index) || index < 0) return;
		const it = cartItems.value[index];
		if (!it) return;
		const { qty, capped, cap } = clampQty(it, desired);
		if (capped) ElMessage.warning(`库存不足，最多可选 ${cap} 件`);
		it.quantity = qty;
		recompute();
		reloadCouponsIfNeeded();
	}catch{}
}
function getMaxQtyForProduct(p:any): number|null {
	try{
		if (!p) return null;
		if (String(p?.type||'') === 'SERVICE') return null;
		const n = Number(p?.totalStock ?? p?.stockQuantity ?? p?.stock ?? 0);
		if (!Number.isFinite(n)) return null;
		if (n <= 0) return 0;
		return Math.trunc(n);
	}catch{ return null; }
}
function getMaxQtyForSku(p:any, sku:any): number|null {
	try{
		if (String(p?.type||'') === 'SERVICE') return null;
		const n = Number(sku?.stockQuantity ?? sku?.stock ?? p?.totalStock ?? p?.stockQuantity ?? 0);
		if (!Number.isFinite(n)) return null;
		if (n <= 0) return 0;
		return Math.trunc(n);
	}catch{ return null; }
}

function openSkuDialogForCartIndex(index: number){
	try{
		if (!Number.isFinite(index) || index < 0) return;
		const it = cartItems.value[index];
		if (!it) return;
		if (String(it.specType||'') !== 'MULTI' || !Array.isArray(it.skuOptions) || it.skuOptions.length<=0) return;
		skuDialog.cartIndex = index;
		skuDialog.currentSkuId = Number(it.skuId||0) || null;
		skuDialog.product = {
			id: it.productId,
			name: it.name,
			type: it.productType,
			specType: 'MULTI',
			skus: it.skuOptions,
			imageUrl: it.imageUrl || null,
		} as any;
		skuDialog.visible = true;
	}catch{}
}

function closeSkuDialog(){
	try{
		skuDialog.visible = false;
		skuDialog.product = null;
		skuDialog.cartIndex = null;
		skuDialog.currentSkuId = null;
	}catch{}
}

const skuDialog = reactive({ visible: false, product: null as any|null, cartIndex: null as number|null, currentSkuId: null as number|null });
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
	if (p.specType === 'MULTI') { skuDialog.product = p; skuDialog.visible = true; skuDialog.cartIndex=null; skuDialog.currentSkuId=null; return; }
	const maxQuantity = getMaxQtyForProduct(p);
	if (maxQuantity === 0) { ElMessage.warning('库存不足'); return; }
	const item: CartItem = { productId: p.id, skuId: null, name: p.name, imageUrl: p.imageUrl ?? null, specsText: null, barcode: p.barcode ?? null, price: Number(p.price||0), quantity: 1, maxQuantity, specType: 'SINGLE', skuOptions: null, productType: p.type, pointsDeductible: !!p.pointsDeductible, memberDiscount: !!p.memberDiscount, shipAllowExpress: p?.shipAllowExpress !== false, shipAllowPickup: p?.shipAllowPickup !== false }
	// 合并重复项：同 productId 与 skuId 的叠加数量
	const idx = cartItems.value.findIndex(x=> (x.productId||null)===(item.productId||null) && (x.skuId||null)===(item.skuId||null));
	if (idx>=0) {
		const cur = cartItems.value[idx];
		if (item.maxQuantity != null) cur.maxQuantity = item.maxQuantity;
		const next = Number(cur.quantity||0) + 1;
		const { qty, capped, cap } = clampQty(cur, next);
		if (capped) ElMessage.warning(`库存不足，最多可选 ${cap} 件`);
		cur.quantity = qty;
	}
	else { cartItems.value.push(item); }
	try{ if (highlightTimer) clearTimeout(highlightTimer); }catch{}
	highlightProductId.value = Number(p.id||0) || undefined;
	highlightTimer = setTimeout(()=>{ highlightProductId.value = undefined; }, 400);
	recompute();
	reloadCouponsIfNeeded();
}
function chooseSku(sku: any){
	if (!skuDialog.product) return;
	const p = skuDialog.product;
	const maxQuantity = getMaxQtyForSku(p, sku);
	if (maxQuantity === 0) { ElMessage.warning('库存不足'); return; }
	const item: CartItem = {
		productId: p.id,
		skuId: sku.id,
		name: p.name,
		imageUrl: sku.imageUrl || p.imageUrl || null,
		specsText: sku.name,
		barcode: sku.barcode || p.barcode || null,
		price: Number(sku.price||0),
		quantity: 1,
		maxQuantity,
		specType: 'MULTI',
		skuOptions: Array.isArray(p?.skus) ? p.skus : null,
		productType: p.type,
		pointsDeductible: !!(sku.pointsDeductible ?? p.pointsDeductible),
		memberDiscount: !!(sku.memberDiscount ?? p.memberDiscount),
		shipAllowExpress: p?.shipAllowExpress !== false,
		shipAllowPickup: p?.shipAllowPickup !== false
	};

	// 购物车内“换规格”
	if (skuDialog.cartIndex != null && Number.isFinite(Number(skuDialog.cartIndex))) {
		const fromIdx = Number(skuDialog.cartIndex);
		const from = cartItems.value[fromIdx];
		if (from) {
			const keepQty = Math.max(1, Number(from.quantity||1));
			const dupIdx = cartItems.value.findIndex((x, i)=> i!==fromIdx && (x.productId||null)===(item.productId||null) && (x.skuId||null)===(item.skuId||null));
			if (dupIdx>=0) {
				// 合并到已有同 SKU 行
				const dup = cartItems.value[dupIdx];
				dup.productType = item.productType;
				dup.specType = 'MULTI';
				dup.skuOptions = item.skuOptions;
				dup.imageUrl = item.imageUrl;
				dup.specsText = item.specsText;
				dup.barcode = item.barcode;
				dup.price = item.price;
				dup.pointsDeductible = item.pointsDeductible;
				dup.memberDiscount = item.memberDiscount;
				dup.shipAllowExpress = item.shipAllowExpress;
				dup.shipAllowPickup = item.shipAllowPickup;
				if (item.maxQuantity != null) dup.maxQuantity = item.maxQuantity;

				const combined = Number(dup.quantity||0) + keepQty;
				const { qty, capped, cap } = clampQty(dup, combined);
				if (capped) ElMessage.warning(`库存不足，最多可选 ${cap} 件`);
				dup.quantity = qty;
				// 删除原行（注意下标变化）
				cartItems.value.splice(fromIdx, 1);
			} else {
				// 原地替换 SKU 字段并钳制数量
				from.productType = item.productType;
				from.specType = 'MULTI';
				from.skuOptions = item.skuOptions;
				from.skuId = item.skuId;
				from.imageUrl = item.imageUrl;
				from.specsText = item.specsText;
				from.barcode = item.barcode;
				from.price = item.price;
				from.pointsDeductible = item.pointsDeductible;
				from.memberDiscount = item.memberDiscount;
				from.shipAllowExpress = item.shipAllowExpress;
				from.shipAllowPickup = item.shipAllowPickup;
				from.maxQuantity = item.maxQuantity;
				const { qty, capped, cap } = clampQty(from, keepQty);
				if (capped) ElMessage.warning(`库存不足，最多可选 ${cap} 件`);
				from.quantity = qty;
			}
		}
		closeSkuDialog();
		recompute();
		reloadCouponsIfNeeded();
		return;
	}

	// 新增：与已有行合并（同 productId+skuId）
	const idx = cartItems.value.findIndex(x=> (x.productId||null)===(item.productId||null) && (x.skuId||null)===(item.skuId||null));
	if (idx>=0) {
		const cur = cartItems.value[idx];
		if (item.maxQuantity != null) cur.maxQuantity = item.maxQuantity;
		cur.specType = 'MULTI';
		cur.skuOptions = item.skuOptions;
		cur.imageUrl = item.imageUrl;
		cur.specsText = item.specsText;
		cur.barcode = item.barcode;
		cur.price = item.price;
		cur.pointsDeductible = item.pointsDeductible;
		cur.memberDiscount = item.memberDiscount;
		cur.shipAllowExpress = item.shipAllowExpress;
		cur.shipAllowPickup = item.shipAllowPickup;
		const next = Number(cur.quantity||0) + 1;
		const { qty, capped, cap } = clampQty(cur, next);
		if (capped) ElMessage.warning(`库存不足，最多可选 ${cap} 件`);
		cur.quantity = qty;
	} else {
		cartItems.value.push(item);
	}
	closeSkuDialog();
	recompute();
	reloadCouponsIfNeeded();
}

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
const memberDetailVisible = ref(false);
const memberDetailMemberId = ref<number|null>(null);
function openMemberDetailDrawer(){
	if (identity.value !== 'member') return;
	const id = Number((selectedMember.value as any)?.id || 0);
	if (!Number.isFinite(id) || id <= 0){
		ElMessage.warning('请先选择会员');
		return;
	}
	memberDetailMemberId.value = id;
	memberDetailVisible.value = true;
}
async function queryMembers(q: string, cb: (list:any[])=>void){
	try{
		const kw = String(q||'').trim();
		if (!kw) { cb([]); return; }
		const res:any = await memberControllerList({ page: 1, pageSize: 20, keyword: kw } as any) as any;
		cb((res?.items)||[]);
	}catch{ cb([]); }
}
function onPickMember(m:any){ selectedMember.value = m; loadMemberCouponsAndPoints(); }
function clearMember(){ selectedMember.value = null; selectedCouponIds.value = []; usedPoints.value = 0; memberPoints.value = 0; recompute(); }
watch(selectedMember, async(val)=>{
	try{
		if (!val || !val.id){
			memberDetailVisible.value = false;
			memberDetailMemberId.value = null;
		}
		memberVehicles.value = [];
		memberVehicleId.value = undefined;
		if (val && val.id){
			const list = await vehicleControllerListByMember(String(val.id)) as any;
			memberVehicles.value = Array.isArray(list) ? list : [];
		}
	}catch{}
});

const plateNumber = ref('');
let settingPlateProgrammatically = false;
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
        const list:any[] = await (vehicleControllerSearch({ q: plate, limit: 20 } as any) as any).catch(()=>[]) as any[];
        const upper = plate.toUpperCase();
        const match = Array.isArray(list) ? list.find((it:any)=> String(it?.plateNumber||'').toUpperCase()===upper) : null;
        if (!match){
            // 不存在：提示是否创建游客车辆（并选择车辆主类）
            const typeMain = await openTypeMainDialog();
            if (!typeMain) return;
            const created = await vehicleControllerCreateGuest({ plateNumber: plate, typeMain } as any) as any;
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
                const prof = await memberControllerGet(String(Number(match.memberId))) as any;
                selectedMember.value = prof;
                const vs = await (vehicleControllerListByMember(String(Number(match.memberId))) as any).catch(()=>[]);
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
                    groupDetail = await groupControllerGet(Number(match.groupId)) as any;
                    const ownerId = Number((groupDetail as any)?.orderOwnerMemberId||0);
                    if (ownerId){ const prof = await memberControllerGet(String(ownerId)) as any; selectedMember.value = prof; }
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
const cartQty = computed(()=> cartItems.value.reduce((s,it)=> s + Number(it.quantity||0), 0));
const discountTotal = ref(0);
const discountDialog = reactive({ visible: false });
const cashierDiscountAmountApplied = computed(()=> Math.max(0, Number((settleDialog as any)?.cashierDiscountAmount||0)));
const pickedCouponsForDetail = computed(()=> {
	try{
		const list = (applicableCouponsForCart.value||[]).filter((x:any)=> selectedCouponIds.value.includes(Number(x.id)));
		return list.map((mc:any)=> ({
			id: Number(mc.id),
			name: String(mc?.coupon?.name || mc?.name || '优惠券'),
			amount: Math.max(0, Number(mc.discountApplied||0)),
		})).filter((x:any)=> x.id>0 && x.amount>0);
	}catch{
		return [] as Array<{ id:number; name:string; amount:number }>;
	}
});
const discountTotalDisplay = computed(()=>{
	const sum = Number(couponDiscountEst.value||0)
		+ Number(memberDiscountApplied.value||0)
		+ Number(pointsAmountYuan.value||0)
		+ Number(cashierDiscountAmountApplied.value||0);
	return Math.min(subtotal.value, Math.max(0, Number(sum.toFixed(2))));
});
// 优惠券详情缓存，用于 SPECIFIED 范围与 ruleJson/applyBase
const couponDetailsMap = ref<Map<number, any>>(new Map());
async function ensureCouponDetailsLoaded(){
    try{
        const list = (memberCoupons.value||[]) as any[];
        const needIds = list.map(x=> Number((x?.coupon?.id)||x?.couponId||x?.id||0)).filter(id=>id>0);
        const uniq = Array.from(new Set(needIds)).filter(id=> !couponDetailsMap.value.has(id));
        if (!uniq.length) return false;
        const results = await Promise.allSettled(uniq.map(id=> couponControllerGet(Number(id))));
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
    // FK（无商品收款）不参与优惠券/积分/会员折扣逻辑
    if (orderKindForDialog.value === 'FK') return 0;
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
        const resp:any = await memberCouponAdminControllerList({ memberId: String(mid), used: '0', expired: '0' } as any).catch(()=>null);
        const items = Array.isArray(resp?.items) ? resp.items : (Array.isArray(resp) ? resp : []); 
        
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
			const prof:any = await memberControllerGet(String(val.id)) as any;
			memberPayDiscountPercent.value = Math.max(0, Number((prof as any)?.level?.payDiscountPercent||0));
		}
	}catch{ memberPayDiscountPercent.value = 0; }
	recompute();
});

async function loadPointsMeta(){
	pointsLoading.value = true;
	try{
		const profile = selectedMember.value ? await memberControllerGet(String(Number(selectedMember.value.id))) as any : null;
		pointsAvailable.value = Math.max(0, Number(profile?.points||0));
		const ss = await systemSettingControllerGetPublicSetting() as any;
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
    // 说明：服务订单同样支持优惠券/积分/会员折扣，但这些通常是在“结算弹窗”里选择。
    // 因此不在此处提前创建订单，避免先创建后无法再应用优惠的问题。
    if (orderKind.value !== 'SERVICE') return;
    if (!cartItems.value.length){ ElMessage.error('请添加至少一个服务商品'); return; }
    openSettleDialog();
}

async function submitProductOrder(){ if (orderKind.value!=='SP') return; if (!cartItems.value.length){ ElMessage.error('请添加商品'); return; } if (identity.value==='member' && !selectedMember.value){ ElMessage.error('请选择会员'); return; } // 不立即创建订单，仅打开结算弹窗
    settleDialog.createdOrderId = null; settleDialog.isService=false; settleDialog.tab='wx'; settleDialog.manualMethod='CASH'; settleDialog.wxAuthCode=''; settleDialog.visible=true; }

// ============ 统一结算弹窗（新增） ============
const settleDialog = reactive({ visible:false, tab:'wx' as 'manual'|'wx'|'wash', manualMethod:'CASH' as 'CASH'|'OFFLINE'|'SHOUQIANBA', wxAuthCode:'', loading:false, isService:false, isFk:false, fkAmount: 0 as number, createdOrderId: null as number|null, washPrefer:'AUTO' as 'AUTO'|'MEMBER'|'GROUP', delivery: 'PICKUP' as 'EXPRESS'|'PICKUP', shippingAddressId: undefined as number|undefined, memberAddresses: [] as any[], showMemberAddrForm: false, addrForm: { province:'', city:'', district:'', street:'', detail:'', phone:'', label:'' }, groupId: undefined as number|undefined, groupName: '' as string, cashierDiscountAmount: 0 as number });
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
    
    if (orderKind.value==='SP' && identity.value==='member' && selectedMember.value && hasPhysicalInCart.value){ loadMemberAddresses(Number(selectedMember.value.id)); }
    // 打开时确保已加载券详情，保证弹窗中的预计显示正确
    try{ ensureCouponDetailsLoaded(); }catch{}
}
function openSettleDialogAt(type: 'coupon'|'points'){
	try{
		if (cartItems.value.length<=0) return;
		openSettleDialog();
		nextTick(()=>{
			try{
				// 轻量“定位”：滚动到对应区域（不改变既有业务逻辑）
				const body = document.querySelector('.el-dialog__body') as HTMLElement | null;
				if (!body) return;
				if (type === 'coupon'){
					const el = body.querySelector('.coupon-section') as any;
					el?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
					return;
				}
				// “积分抵扣”所在行没有唯一 class，用文本做一次匹配
				const rows = Array.from(body.querySelectorAll('.row')) as HTMLElement[];
				const hit = rows.find(r => (r.textContent || '').includes('积分抵扣'));
				hit?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
			}catch{}
		});
	}catch{}
}
async function confirmSettleManual(){ try{ let oid = settleDialog.createdOrderId; if (!oid){ oid = await ensureOrderForSettle(); } if (!oid){ ElMessage.error('未找到订单'); return; } settleDialog.loading=true; await withPosAuthGuard(()=> orderControllerMarkPaid(Number(oid), { body:{ method: settleDialog.manualMethod } } as any) as any); ElMessage.success('支付已标记'); settleDialog.visible=false; clearCart(); selectedCouponIds.value=[]; usedPoints.value=0; } catch(e:any){ ElMessage.error(String(e?.message||'支付失败')); } finally { settleDialog.loading=false; } }
async function confirmSettleWx(){ try{ let oid = settleDialog.createdOrderId; if (!oid){ oid = await ensureOrderForSettle(); } if (!oid){ ElMessage.error('未找到订单'); return; } const code = String(settleDialog.wxAuthCode||'').trim(); if (!/^\d{18,24}$/.test(code)){ ElMessage.error('请输入有效的微信付款码（18-24位数字）'); return; } settleDialog.loading=true; await withPosAuthGuard(()=> orderControllerWechatMicropay(Number(oid), { body:{ authCode: code } } as any) as any); ElMessage.success('微信付款成功'); settleDialog.visible=false; clearCart(); selectedCouponIds.value=[]; usedPoints.value=0; } catch(e:any){ ElMessage.error(String(e?.message||'支付失败')); } finally { settleDialog.loading=false; } }
async function confirmSettleWash(){ try{ if (orderKind.value!=='SERVICE'){ ElMessage.error('仅服务订单支持划扣'); return; } let oid = settleDialog.createdOrderId; if (!oid){ oid = await ensureOrderForSettle(); } if (!oid){ ElMessage.error('未找到订单'); return; } settleDialog.loading=true; const prefer = settleDialog.washPrefer==='AUTO' ? undefined : (settleDialog.washPrefer as any); await withPosAuthGuard(()=> orderControllerPayByWashCard(Number(oid), { body:{ prefer } } as any) as any); ElMessage.success('洗车卡划扣成功'); settleDialog.visible=false; clearCart(); } catch(e:any){ ElMessage.error(String(e?.message||'划扣失败')); } finally { settleDialog.loading=false; } }

 

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
            const res:any = await withPosAuthGuard(()=> orderControllerCreate({ body: payload } as any) as any);
            if (res?.id){ settleDialog.createdOrderId = Number(res.id); return Number(res.id); }
            return null;
        } else {
            // 服务单（仅支持立即收款）
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
            const isGuest = !(identity.value==='member' && selectedMember.value);
            const memberIdResolved = !isGuest ? Number(selectedMember.value!.id) : (GUEST_MEMBER_ID_CONST || await ensureGuestMemberId());
            const payload:any = {
                type: 'SERVICE',
                memberId: memberIdResolved,
                items,
                userRemark: null,
                vehicleId: vehicleIdResolved,
                payAfterService: false,
                // 服务订单同样支持优惠券/积分/会员折扣（后端会按规则校验）
                usedPoints: isGuest ? 0 : (pointsAllowedByCoupons.value ? (usedPoints.value || 0) : 0),
                memberCouponIds: isGuest ? undefined : (selectedCouponIds.value.length ? selectedCouponIds.value : undefined),
                disableMemberDiscount: isGuest ? true : !(enableMemberDiscount.value && memberDiscountAllowedByCoupons.value),
            } as any;
            try{ const v = Math.max(0, Number((settleDialog as any).cashierDiscountAmount||0)); if (v>0) (payload as any).cashierDiscountAmount = Number(v.toFixed(2)); }catch{}
            // 若为集团车辆，显式传 groupId
            try{ if ((settleDialog as any).groupId) payload.groupId = Number((settleDialog as any).groupId); }catch{}
            const res:any = await withPosAuthGuard(()=> orderControllerCreate({ body: payload } as any) as any);
            if (res?.id){ settleDialog.createdOrderId = Number(res.id); return Number(res.id); }
            return null;
        }
    }catch(e:any){ ElMessage.error(String(e?.message||'创建订单失败')); return null; }
}
// 已移除先服务后付的排队与入队逻辑

// ============ 挂单/取单（8 槽） ============
const hangDrawer = ref(false);
const hangSlots = ref<Array<any|null>>([null,null,null,null,null,null,null,null]);
const HANG_KEY = 'pos_hang_slots_v1';
function loadHangFromStorage(){ try{ const raw = localStorage.getItem(HANG_KEY); if (!raw) return; const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length===8) hangSlots.value = arr; }catch{} }
function saveHangToStorage(){ try{ localStorage.setItem(HANG_KEY, JSON.stringify(hangSlots.value)); }catch{} }
function openHangDrawer(){ hangDrawer.value = true; }
const canHangNow = computed(()=> cartItems.value.length > 0);
function snapshotSummary(): string { const kind = orderKind.value==='SERVICE' ? '服务' : '商品'; const count = cartItems.value.reduce((s,it)=> s+Number(it.quantity||0), 0); return `${kind}｜${count}件｜应收¥${payAmount.value.toFixed(2)}`; }
const snapshotSummarySafe = computed(()=>{ try{ return snapshotSummary(); }catch{ return '—'; } });
function deepClone<T>(v: T): T { try{ return JSON.parse(JSON.stringify(v)); } catch { return v; } }
function buildHangSlot(label: string){
	return {
		label: String(label||'挂单'),
		ts: Date.now(),
		orderKind: orderKind.value,
		items: deepClone(cartItems.value),
		member: deepClone(selectedMember.value),
		identity: identity.value,
		plateNumber: plateNumber.value,
		coupons: deepClone(selectedCouponIds.value),
		usedPoints: Number(usedPoints.value||0),
		enableMemberDiscount: !!enableMemberDiscount.value,
		guestVehicleId: guestVehicleId.value,
		memberVehicleId: memberVehicleId.value,
		delivery: (settleDialog as any).delivery,
		shippingAddressId: (settleDialog as any).shippingAddressId,
		summary: snapshotSummary()
	};
}
function clearForNextOrder(){
	try{
		cartItems.value = [];
		selectedCouponIds.value = [];
		usedPoints.value = 0;
		enableMemberDiscount.value = true;
		selectedMember.value = null;
		identity.value = 'guest';
		plateNumber.value = '';
		guestVehicleId.value = undefined;
		guestVehicleKeyword.value = '';
		memberVehicles.value = [];
		memberVehicleId.value = undefined;
		try{ (settleDialog as any).groupId = undefined; (settleDialog as any).groupName = undefined; }catch{}
		try{ (settleDialog as any).shippingAddressId = undefined; }catch{}
		recompute();
	}catch{}
}
async function saveToHang(targetIdx?: number){
	if (cartItems.value.length === 0){
		ElMessage.warning('当前清单为空，无法挂单');
		return;
	}
	try{
		const { value } = await ElMessageBox.prompt(
			'为挂单填写名称或标签（如 皖A88XX/张三）',
			'挂单',
			{ inputPlaceholder:'例如：张三-黑AT8888', inputPattern:/^.{1,20}$/ , inputErrorMessage:'1~20个字符' }
		);
		const label = String(value||'挂单').trim() || '挂单';
		const autoIdx = hangSlots.value.findIndex(s=> !s);
		const slotIdx = (typeof targetIdx === 'number' && Number.isFinite(targetIdx)) ? Math.max(0, Math.min(7, Number(targetIdx))) : (autoIdx>=0 ? autoIdx : 0);
		if (hangSlots.value[slotIdx]){
			await ElMessageBox.confirm(`挂单 ${slotIdx+1} 已存在，是否覆盖？`, '覆盖挂单', { type:'warning', confirmButtonText:'覆盖', cancelButtonText:'取消' });
		}
		hangSlots.value[slotIdx] = buildHangSlot(label);
		saveHangToStorage();
		hangDrawer.value = false;
		clearForNextOrder();
		ElMessage.success(`已挂单：${label}`);
	}catch{ /* 取消 */ }
}
async function loadFromHang(idx: number){
	const s = hangSlots.value[idx];
	if (!s) return;
	try{
		if (cartItems.value.length > 0){
			await ElMessageBox.confirm('取单将覆盖当前清单，是否继续？', '确认取单', { type:'warning', confirmButtonText:'继续', cancelButtonText:'取消' });
		}
	}catch{ return; }
	orderKind.value = s.orderKind || 'SERVICE';
	cartItems.value = Array.isArray(s.items) ? s.items : [];
	selectedMember.value = s.member || null;
	identity.value = s.identity || (selectedMember.value ? 'member' : 'guest');
	plateNumber.value = s.plateNumber || '';
	selectedCouponIds.value = Array.isArray(s.coupons) ? s.coupons : [];
	usedPoints.value = Number(s.usedPoints||0);
	enableMemberDiscount.value = !!s.enableMemberDiscount;
	guestVehicleId.value = s.guestVehicleId;
	memberVehicleId.value = s.memberVehicleId;
	(settleDialog as any).delivery = s.delivery || (hasPhysicalInCart.value ? 'EXPRESS' : 'PICKUP');
	(settleDialog as any).shippingAddressId = s.shippingAddressId;
	recompute();
	hangDrawer.value = false;
	ElMessage.success(s.label ? `已取单：${s.label}` : `已取单 ${idx+1}`);
}
async function clearHangConfirm(idx: number){
	if (!hangSlots.value[idx]) return;
	try{
		await ElMessageBox.confirm(`确定清空挂单 ${idx+1} 吗？`, '清空挂单', { type:'warning' });
		hangSlots.value[idx] = null;
		saveHangToStorage();
		ElMessage.success('已清空');
	}catch{}
}
async function clearAllHang(){
	const hasAny = hangSlots.value.some(Boolean);
	if (!hasAny) { ElMessage.info('暂无挂单'); return; }
	try{
		await ElMessageBox.confirm('确定清空全部挂单吗？此操作不可撤销。', '清空全部', { type:'warning', confirmButtonText:'清空', cancelButtonText:'取消' });
		hangSlots.value = [null,null,null,null,null,null,null,null];
		saveHangToStorage();
		ElMessage.success('已清空全部挂单');
	}catch{}
}
async function renameHang(idx: number){
	const s = hangSlots.value[idx];
	if (!s) return;
	try{
		const { value } = await ElMessageBox.prompt('修改挂单名称', '改名', { inputValue: String(s.label||''), inputPattern:/^.{1,20}$/, inputErrorMessage:'1~20个字符' });
		const label = String(value||'').trim();
		if (!label) return;
		s.label = label;
		s.ts = Date.now();
		saveHangToStorage();
		ElMessage.success('已改名');
	}catch{}
}

function resetAll(){ orderKind.value = 'SERVICE'; activeCategoryId.value = undefined; keyword.value = ''; clearCart(); selectedMember.value = null; plateNumber.value = ''; selectedCouponIds.value = []; usedPoints.value = 0; enableMemberDiscount.value = true; loadCategories(); loadProducts(); }

onMounted(async ()=>{ loadHangFromStorage(); await Promise.all([loadCategories(), loadProducts()]); window.addEventListener('keydown', onGlobalKeydown); });
onBeforeUnmount(()=>{ try{ window.removeEventListener('keydown', onGlobalKeydown); }catch{} });
async function ensureGuestMemberId(): Promise<number>{
	// 后端已通过环境变量配置游客会员ID，这里不再读取，仅返回 0 交由后端自动归属
	return 0;
}
async function ensureVehicleForPlate(plate: string, memberId?: number|null): Promise<any|null>{
	const p = String(plate||'').trim(); if (!p) return null;
	// 直接尝试创建游客车辆（后端存在即返回），若传入 memberId 则不绑定，只作为服务订单车辆
	try{ const v = await vehicleControllerCreateGuest({ plateNumber: p } as any); return v||null; }catch{ return null; }
}
function setGuestMode(){ identity.value = 'guest'; selectedMember.value = null; memberVehicles.value = []; memberVehicleId.value = undefined; }

// ============ 游客车辆搜索 ============
const guestVehicleKeyword = ref('');
const guestVehicleId = ref<number|undefined>();
async function queryGuestVehicles(q: string, cb: (list:any[])=>void){
	try{
		const kw = String(q||'').trim(); if (!kw) { cb([]); return; }
		const res:any = await vehicleControllerAdminList({ guest: 1, keyword: kw, page: 1, pageSize: 20 } as any).catch(()=>null) as any;
		const items = Array.isArray((res as any)?.items) ? (res as any).items : (Array.isArray(res) ? res : []);
		cb(items);
	}catch{ cb([]); }
}
function onPickGuestVehicle(v:any){ try{ guestVehicleId.value = Number(v?.id||0)||undefined; settingPlateProgrammatically = true; plateNumber.value = String(v?.plateNumber||''); nextTick().then(()=>{ settingPlateProgrammatically=false; }); }catch{} }
function clearGuestVehicle(){ guestVehicleId.value = undefined; guestVehicleKeyword.value = ''; }

// ============ 会员地址管理 ============
async function loadMemberAddresses(memberId: number){
	try{
		const list = await addressControllerListByMember(String(memberId)) as any;
		settleDialog.memberAddresses = Array.isArray(list) ? list : [];
	}catch{ settleDialog.memberAddresses = []; }
}
function openCreateMemberAddress(){ settleDialog.showMemberAddrForm = true; }
function validateAddrForm(): boolean { const f = settleDialog.addrForm; if (!f.province || !f.city || !f.district || !f.street) return false; if (!f.detail || !/\S+/.test(f.detail)) return false; if (!/^1\d{10}$/.test(String(f.phone||''))) return false; return true; }
async function ensureGuestAddressCreated(): Promise<number|null>{
	try{
		const f = settleDialog.addrForm;
		if (!validateAddrForm()) return null;
		const res:any = await addressControllerAdminCreate({
			useGuest: true,
			input: { province:f.province, city:f.city, district:f.district, street:f.street, detail:f.detail, phone:f.phone, label: f.label||null }
		} as any) as any;
		return Number(res?.id||0) || null;
	}catch{ return null; }
}
async function ensureMemberAddressCreated(memberId:number): Promise<number|null>{
	try{
		const f = settleDialog.addrForm;
		if (!validateAddrForm()) return null;
		const res:any = await addressControllerAdminCreate({
			memberId,
			input: { province:f.province, city:f.city, district:f.district, street:f.street, detail:f.detail, phone:f.phone, label: f.label||null }
		} as any) as any;
		return Number(res?.id||0) || null;
	}catch{ return null; }
}
function addrDisplay(a:any){ if(!a) return ''; const label = a.label ? `（${a.label}）` : ''; return `${a.province}${a.city}${a.district}${a.street}${a.detail}${label} ${a.phone}`; }

// 管理地址对话框（统一实现）
const addrDialog = reactive({ visible:false, list: [] as any[], editing: false, saving: false, currentId: null as number|null, form: { province:'', city:'', district:'', street:'', detail:'', phone:'', label:'' } });
function openManageMemberAddress(){ if (!selectedMember.value) { ElMessage.error('请先选择会员'); return; } addrDialog.visible=true; addrDialog.editing=false; loadAddressList(); }
async function loadAddressList(){
	try{
		const mid = Number(selectedMember.value?.id||0);
		const list = await addressControllerListByMember(String(mid)) as any;
		addrDialog.list = Array.isArray(list) ? list : [];
	}catch{ addrDialog.list = []; }
}
function beginCreateAddress(){ addrDialog.editing=true; addrDialog.currentId=null; addrDialog.form = { province:'', city:'', district:'', street:'', detail:'', phone:'', label:'' }; }
function beginEditAddress(row:any){ addrDialog.editing=true; addrDialog.currentId = Number(row?.id||0)||null; addrDialog.form = { province: row.province||'', city: row.city||'', district: row.district||'', street: row.street||'', detail: row.detail||'', phone: row.phone||'', label: row.label||'' }; }
async function saveAddress(){ try{ if (!selectedMember.value){ ElMessage.error('缺少会员'); return; } const f = addrDialog.form; if (!/^1\d{10}$/.test(String(f.phone||''))) { ElMessage.error('手机号格式不正确'); return; } if (!f.province||!f.city||!f.district||!f.street||!f.detail){ ElMessage.error('请完善地址信息'); return; } addrDialog.saving=true; if (addrDialog.currentId){ await addressControllerAdminUpdate(String(addrDialog.currentId), { ...f } as any); ElMessage.success('已保存'); } else { await addressControllerAdminCreate({ memberId: Number(selectedMember.value.id), input: { ...f } } as any); ElMessage.success('已新增'); } addrDialog.editing=false; await loadAddressList(); await loadMemberAddresses(Number(selectedMember.value.id)); }
catch(e:any){ ElMessage.error(String(e?.message||'保存失败')); }
finally{ addrDialog.saving=false; } }
async function deleteAddress(row:any){ try{ const id = Number(row?.id||0)||0; if (!id) return; await addressControllerAdminDelete(String(id)); ElMessage.success('已删除'); await loadAddressList(); await loadMemberAddresses(Number(selectedMember.value!.id)); if (settleDialog.shippingAddressId===id) settleDialog.shippingAddressId=undefined; } catch(e:any){ ElMessage.error(String(e?.message||'删除失败')); } }

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
// 结算弹窗内用于钳制“收银立减”的上限：按去除其他优惠后的应收基数（不含收银立减）
const dialogPayAmountCap = computed(()=>{
    if ((settleDialog as any).isFk) return Math.max(0, Number(((settleDialog as any).fkAmount||0)));
    const baseAfterMdPts = Math.max(0, Number((subtotal.value - discountTotal.value).toFixed(2)));
    const afterCoupon = Math.max(0, baseAfterMdPts - Number(couponDiscountEst.value||0));
    return Number(afterCoupon.toFixed(2));
});
function openFkDialog(){ 
    if (identity.value==='member' && !selectedMember.value){ ElMessage.error('请选择会员后再进行无商品收款'); return; }
    fkDialog.visible = true; fkDialog.amount = 0; fkDialog.remark=''; 
}
async function confirmFkCollect(){
    try{
        const amt = Math.max(0, Number(fkDialog.amount||0));
        const remark = String(fkDialog.remark||'').trim();
        if (!Number.isFinite(amt) || amt<=0){ ElMessage.error('请填写大于0的收款金额'); return; }
        if (!remark){ ElMessage.error('请填写备注'); return; }
        const body:any = { amount: Number(amt.toFixed(2)), remark };
        if (identity.value==='member' && selectedMember.value){ body.memberId = Number(selectedMember.value.id); }
        const res:any = await withPosAuthGuard(()=> orderControllerCreateFk({ body } as any) as any);
        if (!res?.id){ ElMessage.error('创建付款订单失败'); return; }
        // 打开统一结算弹窗（付款订单）
        (settleDialog as any).isFk = true; (settleDialog as any).fkAmount = Number(amt.toFixed(2));
        settleDialog.isService = false; settleDialog.createdOrderId = Number(res.id); settleDialog.tab = 'wx'; settleDialog.visible = true;
        fkDialog.visible = false;
    }catch(e:any){ ElMessage.error(String(e?.message||'提交失败')); }
}
</script>

<style scoped>
.cashier-page{
	height: 100%;
	min-height: 0;
	overflow: hidden;
	/* 保留与其它页面一致的边距，但不占用额外高度（box-sizing） */
	padding: 12px;
	box-sizing: border-box;
}
.layout{ display:flex; gap:12px; height:100%; min-height:0; overflow:hidden; contain: layout size paint; }
.left-area{ width: 560px; flex: 0 0 auto; display:flex; min-height:0; }
.left-card{
	flex: 1 1 auto;
	min-width:0;
	background:#fff;
	/* 与右侧卡片统一：细边框 + 无阴影，避免视觉上“更粗更重” */
	border: 1px solid #eef1f5;
	border-radius: 18px;
	display:flex;
	flex-direction:row;
	min-height:0;
	overflow:hidden;
	box-shadow: none;
}
.left-main{ flex: 1 1 auto; min-width:0; display:flex; flex-direction:column; min-height:0; }
.member-section{ padding:10px; border-bottom:none; background: transparent; }
.cart-section{
	flex: 1 1 auto;
	min-height:0;
	/* 让“已选购/清空”下方分割线能贴紧两端：移除左右 padding */
	padding: 10px 0;
}
.cart-section :deep(.cart){ height: 100%; }
.cart-section :deep(.cart-head),
.cart-section :deep(.cart-body){
	/* 内容保持与原来一致的左右内边距 */
	padding-left: 10px;
	padding-right: 10px;
}
.checkout-section{
	border-top:1px solid #eef1f5;
	padding: 10px;
	display:flex;
	flex-direction:column;
	gap:10px;
	background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
}
.settle-card{
	border-radius: 16px;
	border: 1px solid #eef1f5;
	background: radial-gradient(120% 160% at 20% 20%, rgba(64,158,255,.10) 0%, rgba(255,255,255,1) 55%, rgba(255,255,255,1) 100%);
	box-shadow: 0 1px 10px rgba(15, 23, 42, 0.05);
	padding: 12px 12px;
}
.settle-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.settle-amt{ display:flex; flex-direction:column; gap:4px; min-width:0; }
.settle-amt-label{ font-size: 13px; font-weight: 800; color:#4b5563; }
.settle-amt-value{ font-size: 30px; font-weight: 900; letter-spacing: .2px; color:#0f172a; line-height: 1.05; }
.settle-pill{
	flex: 0 0 auto;
	display:inline-flex;
	align-items:center;
	gap:8px;
	padding: 8px 10px;
	border-radius: 999px;
	background: rgba(64,158,255,0.08);
	border: 1px solid rgba(64,158,255,0.22);
	cursor:pointer;
	user-select:none;
	transition: transform .08s ease, background .15s ease, border-color .15s ease;
}
.settle-pill:hover{ background: rgba(64,158,255,0.11); border-color: rgba(64,158,255,0.28); }
.settle-pill:active{ transform: scale(0.99); }
.settle-pill .k{ color:#374151; font-weight: 800; }
.settle-pill .v{ color:#111827; font-weight: 900; }
.settle-pill .link{ color: var(--el-color-primary); font-weight: 900; }
.settle-meta{
	margin-top: 10px;
	padding-top: 10px;
	border-top: 1px dashed #e5e7eb;
	display:grid;
	grid-template-columns: 1fr 1fr;
	gap:8px 12px;
}
.m-item{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.m-item .k{ color:#6b7280; font-size: 13px; font-weight: 700; }
.m-item .v{ color:#111827; font-weight: 900; font-size: 13px; }
.m-item.muted .v{ color:#6b7280; font-weight: 700; }
.discount-detail{ display:flex; flex-direction:column; gap:6px; }
.discount-detail .dline{ display:flex; justify-content:space-between; gap:12px; color:#606266; }
.discount-detail .dline b{ color:#303133; }
.discount-detail .dline.total{ color:#303133; }
.discount-detail .dline.total b{ color: var(--el-color-primary); font-size:16px; }
.discount-compact{
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap:12px;
	background: rgba(64,158,255,0.06);
	border: 1px solid rgba(64,158,255,0.18);
	border-radius: 14px;
	padding: 10px 12px;
}
.dc-left{ display:flex; align-items:baseline; gap:10px; min-width:0; }
.dc-label{ color:#374151; font-weight:800; }
.dc-amt{ color:#111827; font-weight:900; font-size:18px; letter-spacing:.2px; }
.dc-link{ font-weight:800; }
.discount-dialog{ display:flex; flex-direction:column; gap:14px; }
.dd-group{ border: 1px solid #eef1f5; border-radius: 12px; padding: 10px 12px; background:#fff; }
.dd-title{ font-weight:900; color:#111827; margin-bottom: 8px; }
.dd-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 6px 0; color:#4b5563; }
.dd-row .k{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dd-row .v{ color:#111827; font-weight:900; }
.dd-subtotal{ border-top: 1px dashed #eef1f5; margin-top: 6px; padding-top: 10px; }
.dd-empty{ color:#9ca3af; font-size:13px; padding: 6px 0; }
.dd-total{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding: 10px 12px; border-radius: 12px; background: #f9fafb; border: 1px solid #eef1f5; font-weight:900; }
.dd-total b{ color: var(--el-color-primary); font-size: 18px; }
.dd-hint{ color:#9ca3af; font-size:12px; padding: 0 2px; }
.pay-btn{
	width:100%;
	height: 56px;
	font-size:20px;
	font-weight:900;
	letter-spacing:.5px;
	box-shadow: 0 10px 20px rgba(64,158,255,.18);
}
.pay-btn:active{ transform: translateY(0.5px); }
.ops-section{
	width: 104px;
	flex: 0 0 auto;
	display:flex;
	flex-direction:column;
	padding:10px;
	border-left:1px solid #eef1f5;
	background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
}
.ops-section :deep(.el-button--large){
	width:100%;
	justify-content:center;
	border-radius:999px;
	padding: 10px 8px;
	font-size: 14px;
}
.right-area{
	flex: 1 1 auto;
	min-width:0;
	min-height:0;
	overflow:hidden;
	display:flex;
	flex-direction: column;
	gap: 12px;
	padding: 0;
	background: transparent;
	border: none;
	border-radius: 0;
	box-shadow: none;
}
.amounts{ display:flex; flex-direction:column; gap:6px; }
.amounts .line{ display:flex; justify-content:space-between; gap:12px; }
.amounts .total b{ color: var(--el-color-primary); font-size:18px; }
.buttons{ display:flex; gap:8px; }
/* 禁用卡片态 */
.prod.disabled{ opacity: 0.6; cursor: not-allowed; }

/* SKU */
.sku-list{ display:flex; flex-direction:column; gap:8px; max-height:50vh; overflow:auto; }
.sku-row{ display:grid; grid-template-columns: 1fr auto auto; gap:8px; padding:8px; border:1px solid var(--el-border-color); border-radius:6px; cursor:pointer; }
.sku-row.active{
	border-color: rgba(64,158,255,.55);
	background: rgba(64,158,255,.06);
}
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
@media (max-width: 1440px){
  .left-area{ width: 520px; }
  .ops-section{ width: 96px; }
  .pay-btn{ height: 52px; font-size:18px; }
}

.addr-form-grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }

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


