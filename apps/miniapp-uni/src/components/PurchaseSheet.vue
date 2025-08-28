<template>
	<view v-if="visible" class="sheet-backdrop" @tap="onBackdrop">
		<view class="sheet" @tap.stop>
			<view class="sheet-header">
				<text class="title">确认下单</text>
				<view class="close" @tap="close">×</view>
			</view>

			<!-- 地址（仅实物商品显示） -->
			<view v-if="isPhysical" class="block">
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
					<text class="amount">¥{{ payAmountText }}</text>
				</view>
				<view class="submit" @tap="submit">立即支付¥{{ payAmountText }}</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
declare const uni: any;
import { computed, reactive, ref, watch } from 'vue';
import { createHttp, checkAuthAndRefresh } from '../utils/auth';
import { resolveImageUrl } from '../utils/url';

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
const payMethod = ref<'WECHAT'|'OFFLINE'>('WECHAT');

const http = createHttp();

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
}

const isPhysical = computed(() => product.value?.type === 'PHYSICAL');
const isService = computed(() => product.value?.type === 'SERVICE');

const addresses = ref<Address[]>([]);
const selectedAddressId = ref<number|undefined>(undefined);
const vehicles = ref<VehicleEx[]>([]);
const selectedVehicleId = ref<number|undefined>(undefined);

watch(() => props.product, () => {
	quantity.value = 1;
	remark.value = '';
	selectedSkuId.value = undefined;
	selectedSpecValues.value = {};
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
});

watch(visible, (v)=>{
	if (v) {
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

function selectSku(id?: number){ selectedSkuId.value = id; }
function inc(){ quantity.value = Math.min(99, quantity.value + 1); }
function dec(){ quantity.value = Math.max(1, quantity.value - 1); }

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

async function loadAddresses(){
    try {
        const list = await http<Address[]>('/address/me/list', { method:'GET' });
        addresses.value = Array.isArray(list) ? list : [];
        selectedAddressId.value = addresses.value[0]?.id;
    } catch { addresses.value = []; selectedAddressId.value = undefined; }
}

async function loadVehicles(){
	try {
		const profile = await http<any>('/member/me/profile', { method:'GET' });
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
	if (isPhysical.value) {
		if (!addresses.value.length) { uni.showToast({ title:'请先添加收货地址', icon:'none' }); return; }
		if (!selectedAddressId.value) { uni.showToast({ title:'请选择收货地址', icon:'none' }); return; }
	}
	// 获取会员信息
	let profile: any = null;
	try { profile = await http<any>('/member/me/profile', { method:'GET' }); } catch {}
	const memberId = Number(profile?.id || 0);
	if (!memberId) { uni.showToast({ title:'请先登录', icon:'none' }); return; }
	// 服务商品：需要车辆
	let vehicleId: number | undefined = undefined;
	if (product.value.type === 'SERVICE') {
		if (!selectedVehicleId.value) { uni.showToast({ title:'请选择车辆', icon:'none' }); return; }
		vehicleId = selectedVehicleId.value;
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
		remark: remark.value || undefined,
		shippingAddressId: isPhysical.value ? selectedAddressId.value : undefined
	};
	try {
		const created = await http<any>('/orders', { method:'POST', body });
		// 选择支付方式
		if (payMethod.value === 'WECHAT') {
			try {
				const params:any = await http(`/orders/${created?.id}/pay/wechat-jsapi`, { method:'POST' });
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
.sheet { width: 100%; background: #fff; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx; padding: 24rpx; max-height: 80vh; overflow: auto; box-shadow: 0 -8rpx 24rpx rgba(0,0,0,0.1); }
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
.remark { width: 100%; min-height: 96rpx; background:#f9fafb; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 12rpx; box-sizing: border-box; }
.footer { position: sticky; bottom: 0; left: 0; right:0; display:flex; align-items:center; justify-content: space-between; gap: 12rpx; padding-top: 12rpx; background:#fff; }
.price-area { display:flex; flex-direction: column; }
.label { font-size: 22rpx; color:#6b7280; }
.amount { font-size: 32rpx; color:#ef4444; font-weight: 800; }
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
</style>
