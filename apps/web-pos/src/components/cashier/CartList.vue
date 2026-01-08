<template>
	<div class="cart" :class="{ embedded: !!embedded }">
		<div class="cart-head">
			<div class="title">已选购 <b class="count">{{ items.length }}</b> 件</div>
			<el-button text type="danger" @click="emit('clear')" :disabled="items.length===0">
				<el-icon><Delete /></el-icon>
				清空
			</el-button>
		</div>
		<div class="cart-body">
			<transition-group name="list" tag="div" class="cart-list" v-if="items.length">
				<div class="cart-item" v-for="(it,idx) in items" :key="(it.productId||'p') + '_' + (it.skuId||'s') + '_' + idx">
					<div class="ci-row">
						<div class="ci-thumb"><img v-if="it.imageUrl" :src="absUrl(it.imageUrl)" alt="" /></div>
						<div class="ci-mid">
							<div class="ci-top">
								<div class="ci-name" :title="it.name">{{ it.name }}</div>
								<el-link class="ci-remove" type="primary" underline="never" @click="emit('remove', idx)">删除</el-link>
							</div>
							<div
								class="ci-spec"
								:class="{ selectable: canChangeSku(it) }"
								@click="canChangeSku(it) && emit('change-sku', idx)"
							>
								<span class="spec-text">{{ it.specsText || '默认' }}</span>
								<span v-if="canChangeSku(it)" class="spec-caret"></span>
							</div>
							<div class="ci-bottom">
								<div class="ci-price">¥ {{ Number(it.price||0).toFixed(2) }}</div>
								<div class="ci-stepper">
									<el-button class="qty-btn" circle :disabled="Number(it.quantity||0) <= 1" @click="emit('update-qty', { index: idx, quantity: Math.max(1, Number(it.quantity||0) - 1) })">
										<el-icon><Minus /></el-icon>
									</el-button>
									<div class="qty-num">{{ Number(it.quantity||0) }}</div>
									<el-button class="qty-btn qty-plus" type="primary" circle :disabled="Number(it.maxQuantity||0) > 0 && Number(it.quantity||0) >= Number(it.maxQuantity||0)" @click="emit('update-qty', { index: idx, quantity: Math.min(999, Number(it.quantity||0) + 1) })">
										<el-icon><Plus /></el-icon>
									</el-button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</transition-group>
			<el-empty v-else description="请从右侧选择商品/服务" />
		</div>
	</div>
</template>

<script setup lang="ts">
export interface CartItem { productId?: number|null; skuId?: number|null; name: string; imageUrl?: string|null; specsText?: string|null; barcode?: string|null; price: number; quantity: number; maxQuantity?: number|null; specType?: 'SINGLE'|'MULTI'|string|null; skuOptions?: any[]|null; productType?: 'SERVICE'|'PHYSICAL'|'VIRTUAL_CARD'; pointsDeductible?: boolean; memberDiscount?: boolean; }
defineProps<{ items: CartItem[]; embedded?: boolean }>();
const emit = defineEmits<{
	(e:'remove', index:number): void;
	(e:'clear'): void;
	(e:'update-qty', payload:{ index:number; quantity:number }): void;
	(e:'change-sku', index:number): void;
}>();
import { absUrl } from '../../utils/http';
import { Delete, Minus, Plus } from '@element-plus/icons-vue';

function canChangeSku(it: CartItem): boolean {
	try{
		return String(it?.specType||'') === 'MULTI' && Array.isArray(it?.skuOptions) && it!.skuOptions!.length > 0;
	}catch{ return false; }
}
</script>

<style scoped>
.cart{ background:#fff; border:1px solid var(--el-border-color); border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:8px; min-height:0; overflow:hidden; }
.cart.embedded{ border:none; background:transparent; padding:0; border-radius:0; }
.cart.embedded .cart-body{ padding-right: 2px; }
.cart-head{
	display:flex;
	justify-content:space-between;
	align-items:center;
	padding-bottom: 8px;
	margin-bottom: 8px;
	border-bottom: 1px solid #eef1f5;
}
.title{ color:#303133; font-weight:700; }
.count{ font-weight:800; color: var(--el-color-primary); }
.cart-body{ flex: 1 1 auto; min-height:0; overflow:auto; padding-right: 4px; }
.cart-list{ display:flex; flex-direction:column; }
.cart-item{ border-bottom:1px dashed var(--el-border-color); padding:10px 0; }
.ci-row{ display:grid; grid-template-columns: 52px minmax(0, 1fr); gap:10px; align-items:center; }
.ci-thumb{
	width:52px;
	height:52px;
	border-radius:10px;
	overflow:hidden;
	background:#f3f4f6;
	box-shadow: 0 4px 12px rgba(0,0,0,.05);
}
.ci-thumb img{ width:100%; height:100%; object-fit:cover; }
.ci-mid{
	min-width:0;
	display:flex;
	flex-direction:column;
	gap:6px;
	/* 右侧留白：避免删除/加减按钮贴边 */
	padding-right: 10px;
}
.ci-top{ display:flex; align-items:flex-start; gap:10px; justify-content:space-between; min-width:0; }
.ci-name{ min-width:0; font-weight:900; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; }
.ci-remove{ flex:0 0 auto; font-weight:700; font-size:13px; }
.ci-spec{
	display:flex;
	align-items:center;
	gap:6px;
	color:#6b7280;
	font-size:12px;
	white-space:nowrap;
	overflow:hidden;
	text-overflow:ellipsis;
	line-height:1.1;
}
.ci-spec .spec-text{ min-width:0; overflow:hidden; text-overflow:ellipsis; }
.ci-spec.selectable{
	cursor:pointer;
	user-select:none;
	width: fit-content;
	padding: 2px 6px;
	border-radius: 8px;
	background: rgba(17,24,39,.04);
	border: 1px solid rgba(17,24,39,.06);
}
.ci-spec.selectable:hover{ border-color: rgba(17,24,39,.12); background: rgba(17,24,39,.06); }
.spec-caret{
	display:inline-block;
	width: 0;
	height: 0;
	border-left: 4px solid transparent;
	border-right: 4px solid transparent;
	border-top: 5px solid rgba(107,114,128,.95);
	transform: translateY(1px);
	flex: 0 0 auto;
}
.ci-bottom{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.ci-price{ font-weight:900; color:#111827; }
.ci-stepper{ display:flex; align-items:center; gap:8px; }
.qty-num{
	min-width: 24px;
	text-align:center;
	font-weight:900;
	color:#374151;
	font-size: 12px;
	letter-spacing: 0.2px;
}
.qty-btn{
	width:30px;
	height:30px;
	min-width:30px;
	min-height:30px;
	padding:0;
	border-radius:999px;
	aspect-ratio: 1 / 1;
	box-sizing: border-box;
	flex: 0 0 auto;
}
.qty-btn :deep(.el-icon){
	font-size: 14px;
}
.qty-btn:not(.qty-plus){
	background: #f3f4f6;
	border-color: rgba(17,24,39,.08);
	color: rgba(17,24,39,.55);
}
.qty-plus{
	box-shadow: 0 6px 14px rgba(64,158,255,.22);
}
.qty-plus :deep(.el-icon){
	color: #fff;
}
.qty-btn.is-disabled{
	opacity: .55;
}

/* 动画 */
.list-enter-active, .list-leave-active { transition: all .18s ease; }
.list-enter-from{ opacity:0; transform: translateY(6px); }
.list-leave-to{ opacity:0; transform: translateY(-6px); }
</style>


