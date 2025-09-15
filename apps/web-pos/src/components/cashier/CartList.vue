<template>
	<div class="cart">
		<div class="cart-head">
			<div>结算清单</div>
			<el-button text type="danger" @click="emit('clear')" :disabled="items.length===0">清空</el-button>
		</div>
		<transition-group name="list" tag="div" class="cart-body" v-if="items.length">
			<div class="cart-item" v-for="(it,idx) in items" :key="(it.productId||'p') + '_' + (it.skuId||'s') + '_' + idx">
				<div class="ci-main">
					<div class="ci-thumb" v-if="it.imageUrl"><img :src="absUrl(it.imageUrl)" alt="" /></div>
					<div class="ci-info">
						<div class="ci-name">{{ it.name }}<span v-if="it.specsText" class="specs">（{{ it.specsText }}）</span></div>
						<div class="ci-sub">单价 ¥{{ Number(it.price||0).toFixed(2) }}</div>
					</div>
				</div>
				<div class="ci-ops">
					<el-input-number :model-value="it.quantity" :min="1" :max="999" size="large" @change="(v: any)=>emit('update-qty', { index: idx, quantity: Number(v||1) })" />
					<div class="ci-price">¥{{ (Number(it.price||0) * Number(it.quantity||0)).toFixed(2) }}</div>
					<el-button text type="danger" @click="emit('remove', idx)">移除</el-button>
				</div>
			</div>
		</transition-group>
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
import { absUrl } from '../../utils/http';
</script>

<style scoped>
.cart{ background:#fff; border:1px solid var(--el-border-color); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px; max-height: none; overflow:visible; }
.cart-head{ display:flex; justify-content:space-between; align-items:center; }
.cart-item{ border-bottom:1px dashed var(--el-border-color); padding:8px 0; display:flex; flex-direction:column; gap:6px; }
.ci-main{ display:flex; align-items:center; gap:10px; }
.ci-thumb{ width:44px; height:44px; border-radius:6px; overflow:hidden; background:#f6f6f6; flex: 0 0 auto; }
.ci-thumb img{ width:100%; height:100%; object-fit:cover; }
.ci-info{ display:flex; flex-direction:column; gap:2px; }
.ci-name{ font-weight:600; }
.ci-sub{ color:#909399; font-size:12px; }
.specs{ color:#999; font-weight:400; }
.ci-ops{ display:flex; align-items:center; gap:8px; justify-content:space-between; position:relative; z-index: 0; }
.ci-price{ font-weight:700; }
/* 金额跃迁（更新时轻微放大回落） */
.ci-price{ transition: transform .18s ease, color .18s ease; }
.cart-item:hover .ci-price{ transform: translateY(-1px); }
/* 动画 */
.list-enter-active, .list-leave-active { transition: all .18s ease; }
.list-enter-from{ opacity:0; transform: translateY(6px); }
.list-leave-to{ opacity:0; transform: translateY(-6px); }
</style>


