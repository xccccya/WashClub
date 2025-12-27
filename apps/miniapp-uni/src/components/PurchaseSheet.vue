<template>
	<view v-if="visible" class="sheet-backdrop" @tap="onBackdrop">
		<view class="sheet" @tap.stop>
			<view class="sheet-header">
				<text class="title">确认下单</text>
				<view class="close" @tap="close">×</view>
			</view>

			<!-- 地址（仅实物商品且选择快递时显示） -->
			<view v-if="isPhysical && delivery==='EXPRESS'" class="block">
				<view class="block-title">收货地址</view>
				<view v-if="addresses.length===0" class="addr-empty" @tap="gotoAddress">去新增收货地址</view>
				<scroll-view v-else scroll-y class="addr-list">
					<view v-for="a in addresses" :key="a.id" class="addr-card" :class="{ active: a.id===selectedAddressId }" :data-id="a.id" @tap="onSelectAddress">
						<text class="addr-line1">{{ a.province }} {{ a.city }} {{ a.district }} {{ a.street }}</text>
						<text class="addr-line2">{{ a.detail }}</text>
						<text class="addr-line3">{{ a.phone }}</text>
					</view>
				</scroll-view>
				<view class="addr-manage" @tap="gotoAddress">管理地址</view>
			</view>

			<!-- 车辆（仅服务类显示） -->
			<view v-if="isService" class="block">
				<view class="block-title">选择车辆</view>
				<view v-if="vehicles.length===0" class="addr-empty" @tap="gotoAddVehicle">去添加车辆</view>
				<scroll-view v-else scroll-y class="vehicle-list">
					<view v-for="v in vehicles" :key="v.id" class="vehicle-card" :class="{ active: v.id===selectedVehicleId }" @tap="() => selectVehicle(v.id)">
						<image class="vehicle-logo" :src="vehicleBrandIcon(v)" mode="aspectFit" />
						<view class="vehicle-info">
							<text class="vehicle-line1">{{ v.brand || '品牌' }} {{ v.series || '' }}</text>
							<text class="vehicle-line2">{{ v.plateNumber || '' }}</text>
						</view>
					</view>
				</scroll-view>
			</view>

			<!-- 规格选择（多规格） -->
			<view v-if="product?.specType==='MULTI'" class="block">
				<view class="block-title">选择规格</view>
				<view v-if="specKeys.length" v-for="key in specKeys" :key="key" class="spec-group">
					<text class="spec-key">{{ key }}</text>
					<view class="spec-row">
						<view v-for="val in specOptions[key]" :key="val" class="spec-chip" :class="{ active: selectedSpecValues[key]===val, disabled: isOptionDisabled(key, val) }" @tap="() => onSelectSpec(key, val)">{{ val }}</view>
					</view>
				</view>
				<view v-else class="tip">暂无可选规格</view>
			</view>

			<!-- 数量 -->
			<view class="block qty-block">
				<view class="block-title">购买数量</view>
				<view class="stepper">
					<view class="btn" @tap="dec">-</view>
					<text class="num">{{ quantity }}</text>
					<view class="btn" @tap="inc">+</view>
				</view>
			</view>

			<!-- 配送方式（仅实物显示；隐藏不可用方式） -->
			<view class="block" v-if="product?.type==='PHYSICAL' && (shipAllowExpress || shipAllowPickup)">
				<view class="block-title">配送方式</view>
				<view class="pay-row">
					<view v-if="shipAllowExpress" class="pay-chip" :class="{ active: delivery==='EXPRESS' }" @tap="() => setDelivery('EXPRESS')">快递配送</view>
					<view v-if="shipAllowPickup" class="pay-chip" :class="{ active: delivery==='PICKUP' }" @tap="() => setDelivery('PICKUP')">到店自提</view>
				</view>
				<view class="tip" v-if="delivery==='PICKUP'">自提无需填写收货地址</view>
			</view>

			<!-- 优惠券选择（在支付方式前） -->
			<view class="block">
				<view class="block-title">优惠券</view>
				<view v-if="couponLoading" class="tip">加载可用优惠券...</view>
				<view v-else-if="applicableCoupons.length===0" class="tip">暂无可用优惠券</view>
				<view v-else class="coupon-list">
					<view v-for="c in applicableCoupons" :key="c.id" class="coupon-chip" :class="{ active: selectedCouponIds.has(c.id), disabled: disabledByCombine(c) }" @tap="() => toggleCoupon(c)">
						<text class="c-name">{{ c.name }}</text>
						<text class="c-discount">-¥{{ formatPrice(c.discountApplied) }}</text>
						<text v-if="c.allowCombine===false" class="c-tag">不可叠加其他券</text>
						<text v-if="c.allowStackWithPoints===false" class="c-tag">不可叠加积分抵扣</text>
						<text v-if="c.allowStackWithMemberDiscount===false" class="c-tag">不可叠加会员折扣</text>
					</view>
				</view>
				<view class="tip" v-if="couponDiscount>0">预计优惠：¥{{ formatPrice(couponDiscount) }}，应付：¥{{ payAmountWithCouponText }}</view>
			</view>

			<!-- 积分抵扣 -->
			<view class="block">
				<view class="block-title">积分抵扣</view>
				<view v-if="pointsLoading" class="tip">加载中...</view>
				<view v-else-if="!supportsPoints" class="tip">该商品暂不支持积分抵扣</view>
				<view v-else-if="!pointsAllowedByCoupons" class="tip">已选择的优惠券不可叠加积分抵扣</view>
				<view v-else class="points-card">
					<view class="meta-row">
						<view class="meta-tag">当前剩余 {{ pointsAvailable }} 积分</view>
						<view class="meta-tag success" v-if="pointsAmountYuan>0">预计抵扣 ¥{{ pointsAmountYuanText }}</view>
					</view>
					<view class="points-input">
						<view class="step-btn" @tap="decPoints">-</view>
						<input class="points-field" type="number" inputmode="numeric" v-model.lazy="usedPointsText" placeholder="输入使用积分" @blur="normalizeUsedPoints" />
						<view class="step-btn" @tap="incPoints">+</view>
						<view class="points-apply" @tap="applyMaxPoints">全部使用</view>
					</view>
					<view class="tip fine" v-if="pointsNote">{{ pointsNote }}</view>
				</view>
			</view>

			<!-- 支付方式选择：支持 微信支付 / 线下支付 -->
			<view class="block">
				<view class="block-title">支付方式</view>
				<view class="pay-row">
					<!-- #ifdef MP-WEIXIN -->
					<view class="pay-chip" :class="{ active: payMethod==='WECHAT' }" @tap="() => setPayMethod('WECHAT')">微信支付</view>
					<!-- #endif -->
					<view class="pay-chip" :class="{ active: payMethod==='OFFLINE' }" @tap="() => setPayMethod('OFFLINE')">线下支付（现金/收钱吧）</view>
				</view>
				<view class="tip" v-if="payMethod==='OFFLINE'">支付后由门店在后台确认收款</view>
			</view>

			<!-- 备注 -->
			<view class="block">
				<view class="block-title">备注</view>
				<textarea class="remark" v-model="remark" placeholder="选填：如需特别说明" maxlength="120" />
			</view>

			<view class="footer">
				<view class="price-area">
					<text class="label">应付金额</text>
					<text class="amount amount-lg">¥{{ payAmountFinalText }}</text>
					<text class="coupon-save" v-if="couponDiscount>0">(含券减 ¥{{ Number(couponDiscount||0).toFixed(2) }})</text>
					<text class="coupon-save" v-if="supportsMemberDiscount && memberPayDiscountPercent>0 && memberDiscountAllowedByCoupons && memberDiscountEstYuan>0">(含会员折扣 ¥{{ memberDiscountEstText }})</text>
					<text class="coupon-save" v-if="pointsAllowedByCoupons && pointsAmountYuan>0">(含积分抵扣 ¥{{ pointsAmountYuanText }})</text>
					<text class="coupon-over" v-if="couponOver>0">券减溢出 ¥{{ Number(couponOver||0).toFixed(2) }}</text>
				</view>
				<view class="submit" @tap="submit">立即支付¥{{ payAmountFinalText }}</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
declare const uni: any;
import { computed, reactive, ref, watch } from 'vue';
import { checkAuthAndRefresh } from '../utils/auth';
import { resolveImageUrl } from '../utils/url';
import { addressControllerMyList, memberControllerMe, miniappCouponControllerApplicable, orderControllerCreate, orderControllerWechatJsapi, systemSettingControllerGetPublicSetting } from '@wash/api-client';

type Sku = { id: number; name?: string; price: number; stockQuantity?: number; enabled?: boolean; specsJson?: Array<{ key: string; value: string }>|null };

type Product = {
	id: number;
	type: 'SERVICE'|'PHYSICAL'|'VIRTUAL_CARD'|'OTHER'|'SP';
	specType: 'SINGLE'|'MULTI';
	name: string;
	price?: number|null;
	listPrice?: number|null;
	stockQuantity?: number|null;
	skus?: Sku[];
	imageUrl?: string|null;
	imagesJson?: string[]|null;
	totalSales?: number;
	minPrice?: number; maxPrice?: number;
	priceRange?: string|null;
};

type Address = { id: number; province: string; city: string; district: string; street: string; detail: string; phone: string };

type Vehicle = { id: number; plateNumber?: string|null; brand?: string|null };
// 如后端有品牌图标与车系字段请补充：brandLogo/series
type VehicleEx = Vehicle & { brandLogo?: string|null; series?: string|null };

const props = defineProps<{ visible: boolean; product: Product|null; preselectedSkuId?: number|undefined; preselectedSpecValues?: Record<string,string>|undefined }>();
const emit = defineEmits<{ (e:'update:visible', v:boolean):void; (e:'submitted', order: any):void }>();

const visible = computed({ get: () => props.visible, set: (v:boolean) => emit('update:visible', v) });
const product = computed(() => props.product);

const selectedSkuId = ref<number|undefined>(undefined);
const quantity = ref<number>(1);
const remark = ref<string>('');
const payMethod = ref<'WECHAT'|'OFFLINE'|undefined>(undefined);
// #ifdef MP-WEIXIN
payMethod.value = 'WECHAT';
// #endif

// 发货形式（仅 PHYSICAL 使用）
const delivery = ref<'EXPRESS'|'PICKUP'>('PICKUP');
const shipAllowExpress = computed(()=> (product.value?.type==='PHYSICAL') ? ((product.value as any)?.shipAllowExpress !== false) : true);
const shipAllowPickup = computed(()=> (product.value?.type==='PHYSICAL') ? ((product.value as any)?.shipAllowPickup !== false) : true);
function setDelivery(v: 'EXPRESS'|'PICKUP'){ delivery.value = v; }


const enabledSkus = computed(() => (product.value?.skus||[]).filter(s => s.enabled!==false));

// 规格归一化：兼容多种形态
function normalizeSpecs(specsRaw: any): Array<{ key: string; value: string }>{
	try{
		if (Array.isArray(specsRaw)) {
			const out: Array<{key:string; value:string}> = [];
			for (const it of specsRaw) {
				if (it && typeof it === 'object' && !Array.isArray(it)) {
					const keyLike = (it as any).key ?? (it as any).k ?? (it as any).name ?? (it as any).label;
					const valLike = (it as any).value ?? (it as any).v ?? (it as any).val;
					const key = String(keyLike||'').trim();
					const value = String(valLike||'').trim();
					if (key && value) { out.push({ key, value }); continue; }
					const keys = Object.keys(it);
					if (keys.length === 1) {
						const k = String(keys[0]||'').trim();
						const v = String((it as any)[keys[0]]||'').trim();
						if (k && v) { out.push({ key:k, value:v }); continue; }
					}
				}
				if (Array.isArray(it) && it.length >= 2) {
					const k = String(it[0]||'').trim();
					const v = String(it[1]||'').trim();
					if (k && v) { out.push({ key:k, value:v }); continue; }
				}
				if (typeof it === 'string') {
					const m = it.split(/[:：]/);
					if (m.length >= 2) {
						const k = String(m[0]||'').trim();
						const v = String(m.slice(1).join(':')||'').trim();
						if (k && v) { out.push({ key:k, value:v }); continue; }
					}
				}
			}
			return out.filter(it=>it.key && it.value);
		}
		if (typeof specsRaw === 'string') {
			try { const parsed = JSON.parse(specsRaw); return normalizeSpecs(parsed); } catch {}
			const out: Array<{key:string; value:string}> = [];
			const pairs = specsRaw.split(/[;；,/，\n]+/).map(s=>s.trim()).filter(Boolean);
			for (const p of pairs) {
				const m = p.split(/[:：]/);
				if (m.length >= 2) {
					const k = String(m[0]||'').trim();
					const v = String(m.slice(1).join(':')||'').trim();
					if (k && v) out.push({ key:k, value:v });
				}
			}
			return out;
		}
		if (specsRaw && typeof specsRaw === 'object') {
			const out: Array<{key:string; value:string}> = [];
			Object.keys(specsRaw).forEach(k => {
				const v = (specsRaw as any)[k];
				const key = String(k||'').trim(); const value = String(v||'').trim();
				if (key && value) out.push({ key, value });
			});
			return out;
		}
		return [];
	}catch { return []; }
}

function guessProductSpecKeys(): string[]{
	const keys: string[] = [];
	for (const s of enabledSkus.value) {
		const specs = normalizeSpecs((s as any)?.specsJson) || normalizeSpecs((s as any)?.specs);
		for (const it of specs) { if (!keys.includes(it.key)) keys.push(it.key); }
	}
	if (keys.length) return keys;
	const prodSpecs = normalizeSpecs((product.value as any)?.specsJson || (product.value as any)?.specs);
	for (const it of prodSpecs) { if (!keys.includes(it.key)) keys.push(it.key); }
	return keys;
}

function normalizeSpecsFromSku(s: any, productKeys?: string[]): Array<{key:string; value:string}>{
	const primary = normalizeSpecs(s?.specsJson) || [];
	if (primary.length) return primary;
	const secondary = normalizeSpecs(s?.specs) || [];
	if (secondary.length) return secondary;
	const name = String(s?.name||'').trim();
	if (!name) return [];
	const parts = name.split(/[\s/|,，]+/).map(p=>p.trim()).filter(Boolean);
	if (!parts.length) return [];
	const keys = (productKeys && productKeys.length===parts.length) ? productKeys : parts.map((_,i)=>`规格${i+1}`);
	return keys.map((k,idx)=>({ key: k, value: parts[idx] || '' })).filter(it=>it.key && it.value);
}

const specOptions = computed<Record<string, string[]>>(() => {
	const map: Record<string, Set<string>> = {} as any;
	for (const s of enabledSkus.value) {
		const specs = normalizeSpecs((s as any)?.specsJson) || normalizeSpecs((s as any)?.specs);
		for (const it of specs) {
			const k = it.key; const v = it.value;
			if (!k || !v) continue;
			if (!map[k]) map[k] = new Set<string>();
			map[k].add(v);
		}
	}
	if (Object.keys(map).length === 0) {
		const guessedKeys = guessProductSpecKeys();
		for (const s of enabledSkus.value) {
			const specs = normalizeSpecsFromSku(s, guessedKeys);
			for (const it of specs) {
				const k = it.key; const v = it.value;
				if (!k || !v) continue;
				if (!map[k]) map[k] = new Set<string>();
				map[k].add(v);
			}
		}
	}
	const out: Record<string, string[]> = {};
	Object.keys(map).forEach(k => { out[k] = Array.from(map[k]); });
	return out;
});
const specKeys = computed<string[]>(() => Object.keys(specOptions.value));
const selectedSpecValues = ref<Record<string, string>>({});

function getSkuSpecValue(s: Sku, key: string){
	let arr = normalizeSpecs((s as any)?.specsJson) || normalizeSpecs((s as any)?.specs);
	if (!arr.length) arr = normalizeSpecsFromSku(s, specKeys.value);
	const f = arr.find(it => it.key === key);
	return String(f?.value||'');
}

function isSkuMatchSelection(s: Sku, sel: Record<string,string>){
	for (const k of Object.keys(sel)) {
		const v = sel[k]; if (!v) continue;
		if (getSkuSpecValue(s, k) !== v) return false;
	}
	return true;
}

function isOptionDisabled(key: string, value: string){
	const candidate: Record<string,string> = { ...selectedSpecValues.value, [key]: value };
	return enabledSkus.value.filter(s => isSkuMatchSelection(s, candidate)).length === 0;
}

function onSelectSpec(key: string, value: string){
	if (isOptionDisabled(key, value)) return;
	selectedSpecValues.value = { ...selectedSpecValues.value, [key]: value };
	const matches = enabledSkus.value.filter(s => isSkuMatchSelection(s, selectedSpecValues.value));
	selectedSkuId.value = matches.length === 1 ? matches[0].id : undefined;
	scheduleCouponReload();
}

const isPhysical = computed(() => product.value?.type === 'PHYSICAL');
const isService = computed(() => product.value?.type === 'SERVICE');

const addresses = ref<Address[]>([]);
const selectedAddressId = ref<number|undefined>(undefined);
const vehicles = ref<VehicleEx[]>([]);
const selectedVehicleId = ref<number|undefined>(undefined);

watch(() => props.product, async () => {
	quantity.value = 1;
	remark.value = '';
	selectedSkuId.value = undefined;
	selectedSpecValues.value = {};
	// 选择默认配送方式
	if (product.value?.type === 'PHYSICAL'){
		if (shipAllowExpress.value && !shipAllowPickup.value) delivery.value = 'EXPRESS';
		else if (!shipAllowExpress.value && shipAllowPickup.value) delivery.value = 'PICKUP';
		else delivery.value = 'EXPRESS';
	} else { delivery.value = 'PICKUP'; }
	const authed = await checkAuthAndRefresh({ redirectIfExpired: true });
	if (!authed) { addresses.value = []; vehicles.value = []; applicableCoupons.value = []; selectedCouponIds.value = new Set(); return; }
	if (isPhysical.value) { loadAddresses(); }
	if (isService.value) { loadVehicles(); }
	// 若仅唯一 SKU，自动填充
	if (product.value?.specType === 'MULTI' && enabledSkus.value.length === 1) {
		const only = enabledSkus.value[0] as any;
		selectedSkuId.value = only?.id;
		let specs = normalizeSpecs((only as any)?.specsJson) || normalizeSpecs((only as any)?.specs);
		if (!specs.length) specs = normalizeSpecsFromSku(only, specKeys.value);
		specs.forEach(it => { if (it?.key && it?.value) selectedSpecValues.value[it.key] = it.value; });
	}
	// 预选规格（来自详情页）
	if (product.value?.specType === 'MULTI') {
		if (props.preselectedSpecValues && Object.keys(props.preselectedSpecValues).length) {
			selectedSpecValues.value = { ...props.preselectedSpecValues };
			const matches = enabledSkus.value.filter(s => isSkuMatchSelection(s, selectedSpecValues.value));
			selectedSkuId.value = matches.length === 1 ? matches[0].id : (props.preselectedSkuId || undefined);
		} else if (typeof props.preselectedSkuId === 'number') {
			selectedSkuId.value = props.preselectedSkuId;
		}
	}
	try { await loadApplicableCoupons(); await loadPointsMeta(); await loadMemberMeta(); } catch {}
});

watch(visible, async (v)=>{
	if (v) {
		const authed = await checkAuthAndRefresh({ redirectIfExpired: true });
		if (!authed) { addresses.value = []; vehicles.value = []; applicableCoupons.value = []; selectedCouponIds.value = new Set(); return; }
		if (isService.value) loadVehicles();
		if (isPhysical.value) loadAddresses();
		// 可见时再次校正预选
		if (product.value?.specType === 'MULTI') {
			if (props.preselectedSpecValues && Object.keys(props.preselectedSpecValues).length) {
				selectedSpecValues.value = { ...props.preselectedSpecValues };
				const matches = enabledSkus.value.filter(s => isSkuMatchSelection(s, selectedSpecValues.value));
				selectedSkuId.value = matches.length === 1 ? matches[0].id : (props.preselectedSkuId || selectedSkuId.value);
			} else if (typeof props.preselectedSkuId === 'number' && !selectedSkuId.value) {
				selectedSkuId.value = props.preselectedSkuId;
			}
		}
		try { await loadApplicableCoupons(); await loadPointsMeta(); await loadMemberMeta(); } catch {}
	}
});

function skuName(s: Sku){
	const n = String(s?.name||'').trim();
	if (n) return n;
	const arr = Array.isArray(s?.specsJson) ? s.specsJson.map(it => it?.value).filter(Boolean) : [];
	return arr.length ? arr.join('/') : '默认';
}

function buildSpecsText(){
    if (product.value?.specType === 'MULTI'){
        // 优先使用用户已选择的维度
        const pairs: Array<{key:string; value:string}> = [];
        const keys = specKeys.value;
        for (const k of keys) {
            const v = selectedSpecValues.value[k];
            if (k && v) pairs.push({ key:k, value:v });
        }
        // 若未完整可用，则尝试从已选 SKU 读取
        if (pairs.length === 0 || pairs.length < keys.length) {
            const sku = enabledSkus.value.find(s => s.id===selectedSkuId.value) as any;
            if (sku) {
                let arr = normalizeSpecs(sku?.specsJson) || normalizeSpecs(sku?.specs);
                if (!arr?.length) arr = normalizeSpecsFromSku(sku, specKeys.value);
                for (const it of arr) { if (it?.key && it?.value && !pairs.find(p=>p.key===it.key)) pairs.push({ key: it.key, value: it.value }); }
            }
        }
        if (pairs.length) { return pairs.map(it => `${it.key}：${it.value}`).join('/'); }
        return '默认规格';
    }
    return '默认规格';
}

function selectSku(id?: number){ selectedSkuId.value = id; scheduleCouponReload(); }
function inc(){
    const max = (()=>{
        const p = product.value; if (!p) return 99;
        // 服务类商品不受库存限制，这里允许最大 99
        if (p.type === 'SERVICE') return 99;
        if (p.specType === 'MULTI'){
            const sku = enabledSkus.value.find(s => s.id===selectedSkuId.value);
            const stock = Number(sku?.stockQuantity || 0);
            return Math.max(1, Math.min(99, stock));
        }
        // SINGLE 或无 SKU 的情况
        const stock = Number(p.stockQuantity || 0);
        return Math.max(1, Math.min(99, stock));
    })();
    const next = Math.min(max, quantity.value + 1);
    if (next === quantity.value) { uni.showToast({ title: '超过商品库存', icon: 'none' }); return; }
    quantity.value = next; scheduleCouponReload();
}
function dec(){ quantity.value = Math.max(1, quantity.value - 1); scheduleCouponReload(); }

const unitPrice = computed(() => {
	if (!product.value) return 0;
	if (product.value.specType === 'MULTI') {
		const sku = enabledSkus.value.find(s => s.id===selectedSkuId.value);
		return Number(sku?.price||0);
	}
	return Number(product.value.price||0);
});
const payAmount = computed(() => Math.max(0, Number(unitPrice.value) * quantity.value));
const payAmountText = computed(() => payAmount.value.toFixed(2));
const couponLoading = ref<boolean>(false);
const applicableCoupons = ref<Array<{ id:number; couponId:number; name:string; allowCombine:boolean; allowStackWithPoints?: boolean; allowStackWithMemberDiscount?: boolean; discountApplied:number }>>([]);
const selectedCouponIds = ref<Set<number>>(new Set());
const couponDiscount = computed(()=> Array.from(selectedCouponIds.value).reduce((s, id)=>{ const c = applicableCoupons.value.find(x=>x.id===id); return s + (c ? Number(c.discountApplied||0) : 0); }, 0));
const payAmountNet = computed(()=> Math.max(0, Number(payAmount.value) - couponDiscount.value));
const payAmountDisplay = computed(()=>{
    const base = Number(payAmount.value) || 0;
    const net = Number(payAmountNet.value) || 0;
    if (base <= 0) return 0; // 多规格未选或基础金额为 0 时不触发 0.01 最低价展示
    return net < 0.01 ? 0.01 : net;
});
const payAmountWithCouponText = computed(()=> payAmountDisplay.value.toFixed(2));
const couponOver = computed(()=> {
    const base = Number(payAmount.value) || 0;
    const disc = Number(couponDiscount.value) || 0;
    const over = disc - base;
    return over > 0 ? over : 0;
});

function formatPrice(n:any){ const v=Number(n); return isNaN(v)? '0.00' : v.toFixed(2); }
function disabledByCombine(c:any){ if (!c) return false; if (selectedCouponIds.value.has(c.id)) return false; if (!c.allowCombine && selectedCouponIds.value.size>0) return true; return false; }
function toggleCoupon(c:any){
    if (!c) return;
    if (disabledByCombine(c)) return;
    const set = new Set(selectedCouponIds.value);
    if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
    selectedCouponIds.value = set;
    // 若新选择后的券集合不允许积分，清空积分使用
    try{
        const picked = applicableCoupons.value.filter(x => selectedCouponIds.value.has(x.id));
        const pointsAllowed = picked.every(x => x.allowStackWithPoints !== false);
        if (!pointsAllowed) { usedPoints.value = 0; usedPointsText.value = '0'; }
    }catch{}
}

function buildApplicableItems(){ return [ { productId: product.value?.id, price: unitPrice.value, quantity: quantity.value } ]; }
async function loadApplicableCoupons(){
    couponLoading.value = true;
    try{
        const body:any = { items: buildApplicableItems() };
        const res:any = await miniappCouponControllerApplicable(body, { token: '' } as any) as any;
        applicableCoupons.value = Array.isArray(res?.applicable) ? res.applicable : [];
        selectedCouponIds.value = new Set(applicableCoupons.value.length ? [applicableCoupons.value[0].id] : []);
    }catch{ applicableCoupons.value = []; selectedCouponIds.value = new Set(); }
    finally{ couponLoading.value = false; }
}

// 防抖刷新（规格/数量变化时刷新可用券）
let couponReloadTid: any = null;
function scheduleCouponReload(){ try { if (couponReloadTid) clearTimeout(couponReloadTid); } catch {}
    couponReloadTid = setTimeout(()=>{ try { loadApplicableCoupons(); } catch {} }, 250);
}

// ===== 积分抵扣 =====
const pointsLoading = ref<boolean>(false);
const pointsAvailable = ref<number>(0);
const usedPoints = ref<number>(0);
const usedPointsText = ref<string>('');
const fenPerPoint = ref<number>(0);
const maxFenPerOrder = ref<number>(0);
const supportsPoints = computed(()=> !!(product.value as any)?.pointsDeductible);
const supportsMemberDiscount = computed(()=> !!(product.value as any)?.memberDiscount);
const pointsAmountYuan = computed(()=>{
    const pts = Math.max(0, Math.floor(Number(usedPoints.value||0)));
    const fenPer100Points = Math.max(0, Number(fenPerPoint.value||0));
    // fenPerPoint实际存储的是100积分对应的分值，所以每积分的分值需要除以100
    const totalFen = pts * (fenPer100Points / 100);
    // 向下取整到分，确保支付金额为整分数
    return Math.floor(totalFen) / 100;
});
const pointsAmountYuanText = computed(()=> pointsAmountYuan.value.toFixed(2));
// 受已选券影响的“是否允许积分/会员折扣”
const pointsAllowedByCoupons = computed(()=>{
    const picked = applicableCoupons.value.filter(c => selectedCouponIds.value.has(c.id));
    // 若选择了任意一张且其中任意一张禁止积分，则整体不允许
    return picked.every(c => c.allowStackWithPoints !== false);
});
const payAmountFinal = computed(()=>{
    const memberDeduct = Number(memberDiscountAllowedByCoupons.value ? (memberDiscountEstYuan.value||0) : 0);
    const pointsDeduct = Number(pointsAllowedByCoupons.value ? (pointsAmountYuan.value||0) : 0);
    const baseAfterDiscounts = Math.max(0, Number(payAmount.value)
        - Number(couponDiscount.value||0)
        - memberDeduct);
    const after = Math.max(0, baseAfterDiscounts - pointsDeduct);
    return after < 0.01 && baseAfterDiscounts > 0 ? 0.01 : after;
});
const payAmountFinalText = computed(()=> payAmountFinal.value.toFixed(2));
// 计算最小积分单位（必须达到能抵扣1分的积分数）
const minPointsUnit = computed(()=>{
    const fenPer100Points = Math.max(0, Number(fenPerPoint.value||0));
    if (!fenPer100Points) return 100; // 默认100积分为最小单位
    // 计算抵扣1分需要的积分数：1分 / (每积分抵扣的分数) = 1 / (fenPer100Points/100) = 100/fenPer100Points
    return Math.ceil(100 / fenPer100Points);
});

const maxUsablePoints = computed(()=>{
    try{
        const fenPer100Points = Math.max(0, Number(fenPerPoint.value||0));
        if (!fenPer100Points) return 0;
        if (!supportsPoints.value) return 0;
        
        // 检查用户积分是否达到最小使用单位
        const minUnit = minPointsUnit.value;
        if (pointsAvailable.value < minUnit) return 0;
        
        const baseYuan = Math.max(0, Number(payAmount.value) - Number(couponDiscount.value));
        const baseFen = Math.floor(baseYuan * 100);
        const orderCapFen = Math.max(0, Number(maxFenPerOrder.value||0));
        const capFen = orderCapFen>0 ? Math.min(baseFen, orderCapFen) : baseFen;
        
        // 计算最多能抵扣多少分，然后反推需要多少积分
        const maxDeductFen = Math.min(capFen, baseFen);
        const maxPointsByAmount = Math.floor(maxDeductFen * 100 / fenPer100Points);
        
        // 按最小单位对齐可用积分
        const availablePointsAligned = Math.floor(pointsAvailable.value / minUnit) * minUnit;
        const maxPointsAligned = Math.floor(maxPointsByAmount / minUnit) * minUnit;
        
        return Math.max(0, Math.min(availablePointsAligned, maxPointsAligned));
    }catch{ return 0; }
});
const pointsNote = computed(()=>{
    const fenPerPt = Math.max(0, Number(fenPerPoint.value||0));
    if (!fenPerPt) return '暂未开启积分抵扣';
    // fenPerPt 是100积分对应的分值，直接转换为元显示
    const per = (fenPerPt / 100).toFixed(2);
    const max = Math.max(0, Number(maxFenPerOrder.value||0));
    const maxYuan = max>0 ? `¥${(max/100).toFixed(2)}` : '不限';
    const minUnit = minPointsUnit.value;
    return `100积分可抵扣¥${per}，最少需要${minUnit}积分才能使用，单笔订单最大抵扣金额${maxYuan}`;
});
async function loadPointsMeta(){
    pointsLoading.value = true;
    try{
        const profile = await (memberControllerMe({} as any) as any);
        pointsAvailable.value = Math.max(0, Number(profile?.points||0));
        const ss = await (systemSettingControllerGetPublicSetting() as any);
        fenPerPoint.value = Math.max(0, Number(ss?.pointsFenPerPoint||0));
        maxFenPerOrder.value = Math.max(0, Number(ss?.pointsMaxDeductFenPerOrder||0));
    }catch{
        pointsAvailable.value = 0; fenPerPoint.value = 0; maxFenPerOrder.value = 0;
    }finally{ pointsLoading.value = false; }
}
function normalizeUsedPoints(){
    const raw = String(usedPointsText.value||'').trim();
    let pts = Math.max(0, Math.floor(Number(raw||0)));
    
    // 按最小积分单位对齐
    const minUnit = minPointsUnit.value;
    pts = Math.floor(pts / minUnit) * minUnit;
    
    // 不超过最大可用积分
    pts = Math.min(pts, maxUsablePoints.value);
    
    usedPoints.value = pts;
    usedPointsText.value = String(pts);
}
function applyMaxPoints(){ usedPoints.value = maxUsablePoints.value; usedPointsText.value = String(usedPoints.value); }
function incPoints(){
    try{
        const cur = Math.max(0, Math.floor(Number(usedPoints.value||0)));
        const minUnit = minPointsUnit.value;
        const next = Math.min(maxUsablePoints.value, cur + minUnit);
        usedPoints.value = next; usedPointsText.value = String(next);
    }catch{}
}
function decPoints(){
    try{
        const cur = Math.max(0, Math.floor(Number(usedPoints.value||0)));
        const minUnit = minPointsUnit.value;
        const next = Math.max(0, cur - minUnit);
        usedPoints.value = next; usedPointsText.value = String(next);
    }catch{}
}

// ===== 会员折扣预计展示 =====
const memberPayDiscountPercent = ref<number>(0);
const memberDiscountEligibleYuan = computed(()=> supportsMemberDiscount.value ? Math.max(0, Number(payAmount.value)) : 0);
const memberDiscountEstYuan = computed(()=>{
    const pct = Math.max(0, Number(memberPayDiscountPercent.value||0));
    if (!pct) return 0;
    const eligible = memberDiscountEligibleYuan.value;
    return (eligible * pct) / 100;
});
const memberDiscountEstText = computed(()=> Number(memberDiscountEstYuan.value||0).toFixed(2));
const memberDiscountAllowedByCoupons = computed(()=>{
    const picked = applicableCoupons.value.filter(c => selectedCouponIds.value.has(c.id));
    return picked.every(c => c.allowStackWithMemberDiscount !== false);
});
async function loadMemberMeta(){
    try{
        const profile = await (memberControllerMe({} as any) as any);
        const pct = Number((profile as any)?.level?.payDiscountPercent || 0);
        memberPayDiscountPercent.value = Math.max(0, pct);
    }catch{ memberPayDiscountPercent.value = 0; }
}

async function loadAddresses(){
    try {
        const list = await (addressControllerMyList({} as any) as any);
        addresses.value = Array.isArray(list) ? list : [];
        selectedAddressId.value = addresses.value[0]?.id;
    } catch { addresses.value = []; selectedAddressId.value = undefined; }
}

async function loadVehicles(){
	try {
		const profile = await (memberControllerMe({} as any) as any);
		const vs: VehicleEx[] = Array.isArray(profile?.vehicles) ? profile.vehicles : [];
		vehicles.value = vs;
		selectedVehicleId.value = vs[0]?.id;
	} catch { vehicles.value = []; selectedVehicleId.value = undefined; }
}

function gotoAddress(){ try { uni.navigateTo({ url: '/pages/address/index' }); } catch {} }
function gotoAddVehicle(){ try { uni.navigateTo({ url: '/pages/vehicle/create' }); } catch {} }
function selectVehicle(id?: number){ selectedVehicleId.value = id; }
function onSelectAddress(e: any){
    try{
        const id = Number(e?.currentTarget?.dataset?.id ?? e?.target?.dataset?.id);
        if (Number.isFinite(id)) selectedAddressId.value = id;
    }catch{}
}
function vehicleDisplay(v: Vehicle){ return v?.plateNumber || `车辆#${v?.id}`; }
function vehicleBrandIcon(v: VehicleEx){
	const cand = [
		(v as any)?.brandLogo,
		(v as any)?.brandLogoUrl,
		(v as any)?.brandLogoPath,
		(v as any)?.brandIcon,
		(v as any)?.brandImage,
		(v as any)?.logo,
		(v as any)?.logoUrl,
		(v as any)?.brand?.logo,
		(v as any)?.brand?.logoUrl,
		(v as any)?.brand?.icon
	].find((x:any)=>typeof x==='string' && x.trim().length>0);
	return cand ? resolveImageUrl(cand as any) : '/static/icons/placeholder.png';
}

function onBackdrop(){ close(); }
function close(){ emit('update:visible', false); }

function setPayMethod(m: 'WECHAT'|'OFFLINE'){ payMethod.value = m; }

async function submit(){
	// 登录校验
	const authed = await checkAuthAndRefresh({ redirectIfExpired: true }); if (!authed) return;
	if (!product.value) return;
	// 校验规格/库存
	if (product.value.specType==='MULTI' && !selectedSkuId.value) { uni.showToast({ title:'请选择规格', icon:'none' }); return; }
	// 校验地址
	if (isPhysical.value && delivery.value==='EXPRESS') {
		if (!addresses.value.length) { uni.showToast({ title:'请先添加收货地址', icon:'none' }); return; }
		if (!selectedAddressId.value) { uni.showToast({ title:'请选择收货地址', icon:'none' }); return; }
	}
	// 校验支付方式（H5 下默认不选，需要用户手动选择）
	if (!payMethod.value) { uni.showToast({ title:'请选择支付方式', icon:'none' }); return; }
	// 允许优惠券超过应付，前端不拦截；后端会按最低支付 0.01 处理
	// 获取会员信息
	let profile: any = null;
	try { profile = await (memberControllerMe({} as any) as any); } catch {}
	const memberId = Number(profile?.id || 0);
	if (!memberId) { uni.showToast({ title:'请先登录', icon:'none' }); return; }
	// 服务商品：需要车辆
	let vehicleId: number | undefined = undefined;
	if (product.value.type === 'SERVICE') {
		if (!selectedVehicleId.value) { uni.showToast({ title:'请选择车辆', icon:'none' }); return; }
		vehicleId = selectedVehicleId.value;
	}
	// 数量与库存上限校验（非服务商品）：SINGLE 使用 product.stockQuantity，MULTI 使用所选 SKU 的 stockQuantity
	const maxAllowed = (()=>{
		const p = product.value; if (!p) return 99;
		if (p.specType==='MULTI'){
			const sku = enabledSkus.value.find(s => s.id===selectedSkuId.value);
			return Math.max(1, Number(sku?.stockQuantity||0));
		}
		return Math.max(1, Number(p.stockQuantity||0));
	})();
	if (product.value.type !== 'SERVICE' && quantity.value > maxAllowed){
		quantity.value = Math.max(1, Math.min(99, maxAllowed));
		uni.showToast({ title:`库存不足，已调整为${quantity.value}`, icon:'none' });
		return;
	}
	const body:any = {
		type: product.value.type==='SERVICE' ? 'SERVICE' : 'SP',
		memberId,
		vehicleId,
		items: [
			{
				productId: product.value.id,
				skuId: product.value.specType==='MULTI' ? selectedSkuId.value : undefined,
				name: product.value.name,
				imageUrl: product.value.imageUrl ? resolveImageUrl(product.value.imageUrl) : (product.value.imagesJson?.[0] ? resolveImageUrl(product.value.imagesJson?.[0] as any) : null),
				specsText: buildSpecsText(),
				price: unitPrice.value,
				discount: 0,
				quantity: quantity.value
			}
		],
		userRemark: remark.value || undefined,
		shippingAddressId: (isPhysical.value && delivery.value==='EXPRESS') ? selectedAddressId.value : undefined,
		noExpress: (isPhysical.value ? (delivery.value==='PICKUP') : undefined),
		memberCouponIds: Array.from(selectedCouponIds.value),
		usedPoints: pointsAllowedByCoupons.value ? (usedPoints.value || 0) : 0,
		disableMemberDiscount: !memberDiscountAllowedByCoupons.value
	};
	try {
		const created:any = await (orderControllerCreate({ body } as any) as any);
		// 选择支付方式
		if (payMethod.value === 'WECHAT') {
			try {
				const params:any = await (orderControllerWechatJsapi((created as any)?.id as any) as any);
				// #ifdef MP-WEIXIN
				await new Promise<void>((resolve, reject)=>{
					(uni as any).requestPayment({
						timeStamp: params.timeStamp,
						nonceStr: params.nonceStr,
						package: params.package,
						signType: params.signType || 'RSA',
						paySign: params.paySign,
						success: ()=> resolve(),
						fail: (e:any)=> reject(e)
					});
				});
				uni.showToast({ title: '支付成功', icon: 'success' });
				emit('submitted', created);
				close();
				setTimeout(()=>{ try { uni.navigateTo({ url: `/pages/order/detail?no=${created?.no||''}` }); } catch {} }, 200);
				// #endif
				// #ifndef MP-WEIXIN
				uni.showToast({ title:'请在微信小程序内完成支付', icon:'none' });
				// #endif
			} catch {
				uni.showToast({ title:'支付未完成', icon:'none' });
				emit('submitted', created);
				close();
				setTimeout(()=>{ try { uni.navigateTo({ url: `/pages/order/detail?no=${created?.no||''}&src=created` }); } catch {} }, 200);
			}
		} else {
			uni.showToast({ title: '下单成功，线下支付', icon: 'none' });
			emit('submitted', created);
			close();
			setTimeout(()=>{ try { uni.navigateTo({ url: `/pages/order/detail?no=${created?.no||''}&src=created` }); } catch {} }, 300);
		}
	} catch (e:any) {
		uni.showToast({ title: e?.message || '下单失败', icon:'none' });
	}
}
</script>

<style>
.sheet-backdrop { position: fixed; left:0; right:0; top:0; bottom:0; background: rgba(0,0,0,0.45); z-index: 999; display:flex; align-items:flex-end; }
.sheet { width: 100%; background: #fff; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx; padding: 24rpx; max-height: 80vh; overflow: auto; box-shadow: 0 -8rpx 24rpx rgba(0,0,0,0.1); -webkit-overflow-scrolling: touch; display:flex; flex-direction: column; }
.sheet-header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8rpx; }
.title { font-size: 30rpx; font-weight: 700; color:#111827; }
.close { width: 48rpx; height: 48rpx; text-align:center; line-height:48rpx; border-radius: 12rpx; background:#f3f4f6; color:#111827; }
.block { margin-top: 12rpx; }
.block-title { font-size: 26rpx; color:#374151; margin-bottom: 8rpx; }
.addr-empty { background: #f9fafb; color:#6b7280; padding: 18rpx; border-radius: 12rpx; text-align:center; border: 2rpx dashed #e5e7eb; }
.addr-card { background: #f8fbff; border: 2rpx solid #dbeafe; border-radius: 16rpx; padding: 16rpx; margin-bottom: 12rpx; }
.addr-card.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.addr-card.active .addr-line1, .addr-card.active .addr-line2, .addr-card.active .addr-line3 { color:#fff; }
.addr-list { max-height: 260rpx; }
.addr-line1 { display:block; color:#0b1220; font-size: 26rpx; }
.addr-line2 { display:block; color:#6b7280; font-size: 24rpx; margin-top: 6rpx; }
.addr-line3 { display:block; color:#6b7280; font-size: 24rpx; margin-top: 6rpx; }
.sku-row { white-space: nowrap; }
.sku-chip { display:inline-flex; align-items:center; justify-content:center; padding: 10rpx 18rpx; margin-right: 12rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; color:#1f2937; background:#fff; }
.sku-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.qty-block { display:flex; align-items:center; justify-content: space-between; }
.stepper { display:flex; align-items:center; gap: 12rpx; }
.stepper .btn { width: 48rpx; height: 48rpx; border-radius: 12rpx; background:#f3f4f6; text-align:center; line-height: 48rpx; font-size: 28rpx; }
.stepper .num { min-width: 56rpx; text-align:center; font-size: 28rpx; color:#111827; }
.pay-row { display:flex; flex-wrap: wrap; gap: 12rpx; }
.pay-chip { padding: 12rpx 18rpx; border-radius: 999rpx; background:#e5e7eb; color:#111827; font-size: 24rpx; }
.pay-chip.active { background:#111827; color:#fff; }
.tip { margin-top: 6rpx; color:#6b7280; font-size: 22rpx; }
.tip.fine { font-size: 20rpx; opacity: .9; }
.coupon-list { display:flex; flex-wrap: wrap; gap: 10rpx; padding-bottom: 120rpx; }
.coupon-chip { display:inline-flex; align-items:center; gap: 8rpx; padding: 10rpx 14rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#fff; color:#111827; }
.coupon-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; border-color: transparent; }
.coupon-chip.disabled { opacity: .6; }
.coupon-chip .c-name { font-size: 22rpx; }
.coupon-chip .c-discount { font-size: 22rpx; color:#ef4444; font-weight: 700; }
.coupon-chip .c-tag { font-size: 20rpx; color:#374151; background:#f3f4f6; padding: 2rpx 8rpx; border-radius: 999rpx; }
.remark { width: 100%; min-height: 96rpx; background:#f9fafb; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 12rpx; box-sizing: border-box; }
.footer { position: sticky; bottom: 0; left: 0; right:0; display:flex; align-items:center; justify-content: space-between; gap: 12rpx; padding-top: 12rpx; background:#fff; z-index: 10; }
.price-area { display:flex; flex-direction: column; }
.label { font-size: 22rpx; color:#6b7280; }
.amount { font-size: 32rpx; color:#ef4444; font-weight: 800; }
.amount-lg { font-size: 38rpx; }
.coupon-save { font-size: 22rpx; color:#67C23A; display:inline-flex; align-items:center; padding: 2rpx 8rpx; background:#f3f4f6; border-radius: 999rpx; margin-top: 4rpx; }
.coupon-over { font-size: 22rpx; color:#f59e0b; margin-left: 6rpx; }
.submit { flex-shrink:0; padding: 18rpx 24rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; border-radius: 16rpx; font-size: 26rpx; }

/* 地址选择（多地址可横向选择） */
.addr-row { white-space: nowrap; margin-bottom: 8rpx; }
.addr-chip { display:inline-flex; flex-direction: column; padding: 12rpx 16rpx; margin-right: 12rpx; border-radius: 16rpx; border: 2rpx solid #e5e7eb; color:#1f2937; background:#fff; max-width: 540rpx; }
.addr-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.addr-chip-line1 { font-size: 24rpx; }
.addr-chip-line2 { font-size: 22rpx; opacity: .9; }
.vehicle-list { max-height: 260rpx; }
.vehicle-card { display:flex; align-items:center; gap: 12rpx; padding: 12rpx; border-radius: 16rpx; border: 2rpx solid #e5e7eb; background:#fff; margin-bottom: 12rpx; }
.vehicle-card.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.vehicle-logo { width: 64rpx; height: 64rpx; border-radius: 12rpx; background:#f3f4f6; }
.vehicle-info { display:flex; flex-direction: column; }
.vehicle-line1 { font-size: 26rpx; }
.vehicle-line2 { font-size: 24rpx; color:#6b7280; }
/* 规格维度化 */
.spec-group { margin-top: 8rpx; }
.spec-key { display:block; font-size: 24rpx; color:#6b7280; margin-bottom: 8rpx; }
.spec-row { display:flex; flex-wrap: wrap; gap: 12rpx; }
.spec-chip { padding: 10rpx 18rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; color:#1f2937; background:#fff; }
.spec-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); border-color: transparent; color:#fff; }
.spec-chip.disabled { opacity: .5; }
.addr-manage { margin-top: 8rpx; padding: 8rpx 12rpx; display:inline-flex; align-items:center; gap: 6rpx; background:#f1f5ff; color:#1d4ed8; border-radius: 999rpx; font-size: 22rpx; }
.addr-manage:after { content:'›'; font-size: 22rpx; line-height: 1; }

/* 积分卡片化样式（与确认页一致） */
.points-card { background:#f9fafb; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 12rpx; display:flex; flex-direction: column; gap: 10rpx; }
.meta-row { display:flex; flex-wrap: wrap; gap: 8rpx; }
.meta-tag { display:inline-flex; align-items:center; gap: 6rpx; padding: 6rpx 10rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#f3f4f6; color:#374151; font-size: 22rpx; }
.meta-tag.success { background: linear-gradient(135deg, #10b981, #34d399); border-color: transparent; color:#fff; }
.points-input { display:flex; align-items:center; gap: 8rpx; background: transparent; border: 0; padding: 0; }
.points-field { width: 140rpx; height: 40rpx; font-size: 24rpx; text-align:center; background:#fff; border: 2rpx solid #e5e7eb; border-radius: 10rpx; padding: 0 8rpx; }
.points-apply { padding: 6rpx 10rpx; background: transparent; color:#1d4ed8; border-radius: 999rpx; font-size: 22rpx; border: 2rpx solid #dbeafe; }
.step-btn { width: 40rpx; height: 40rpx; text-align:center; line-height: 40rpx; border-radius: 999rpx; background:#f3f4f6; color:#111827; font-size: 24rpx; }
</style>
