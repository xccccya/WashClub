<template>
	<div class="cart">
		<div class="cart-head">
			<div>结算清单</div>
			<el-button text type="danger" @click="emit('clear')" :disabled="items.length===0">清空</el-button>
		</div>
		<div class="cart-body" v-if="items.length">
			<div class="cart-item" v-for="(it,idx) in items" :key="idx">
				<div class="ci-name">{{ it.name }}<span v-if="it.specsText" class="specs">（{{ it.specsText }}）</span></div>
				<div class="ci-ops">
					<el-input-number :model-value="it.quantity" :min="1" :max="999" size="large" @change="(v: any)=>emit('update-qty', { index: idx, quantity: Number(v||1) })" />
					<div class="ci-price">¥{{ (Number(it.price||0) * Number(it.quantity||0)).toFixed(2) }}</div>
					<el-button text type="danger" @click="emit('remove', idx)">移除</el-button>
				</div>
			</div>
		</div>
		<el-empty v-else description="请从左侧选择商品/服务" />
	</div>
</template>

<script setup lang="ts">
export interface CartItem { productId?: number|null; skuId?: number|null; name: string; imageUrl?: string|null; specsText?: string|null; barcode?: string|null; price: number; quantity: number; productType?: 'SERVICE'|'PHYSICAL'|'VIRTUAL_CARD'; pointsDeductible?: boolean; memberDiscount?: boolean; }
const props = defineProps<{ items: CartItem[] }>();
const emit = defineEmits<{
	(e:'remove', index:number): void;
	(e:'clear'): void;
	(e:'update-qty', payload:{ index:number; quantity:number }): void;
}>();
</script>

<style scoped>
.cart{ background:#fff; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px; max-height: 360px; overflow:auto; }
.cart-head{ display:flex; justify-content:space-between; align-items:center; }
.cart-item{ border-bottom:1px dashed var(--el-border-color); padding:8px 0; display:flex; flex-direction:column; gap:6px; }
.ci-name{ font-weight:600; }
.specs{ color:#999; font-weight:400; }
.ci-ops{ display:flex; align-items:center; gap:8px; justify-content:space-between; }
.ci-price{ font-weight:700; }
</style>


