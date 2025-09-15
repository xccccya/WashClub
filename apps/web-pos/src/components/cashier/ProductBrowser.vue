<template>
	<div class="left">
		<div class="toolbar">
			<div class="kind">
				<el-radio-group :model-value="orderKind" size="large" @change="onKindChange">
					<el-radio-button label="SP">商品/卡券</el-radio-button>
					<el-radio-button label="SERVICE">服务</el-radio-button>
				</el-radio-group>
			</div>
			<div class="filters">
				<el-select :model-value="activeCategoryId" clearable filterable placeholder="商品分类" size="large" style="min-width:200px" @change="(v: any)=>{ emit('update:activeCategoryId', v as any); emit('search'); }">
					<el-option v-for="c in categoriesDisplay" :key="c.id" :label="c.name" :value="c.id" />
				</el-select>
				<el-input :model-value="keyword" placeholder="搜索商品名/条码" clearable size="large" style="min-width:220px" @update:model-value="(v: any)=>emit('update:keyword', String(v||'').trim())" @keyup.enter="emit('search')">
					<template #append><el-button @click="emit('search')">搜索</el-button></template>
				</el-input>
				<el-checkbox :model-value="showOnlyEnabled" @change="(v: any)=>{ emit('update:showOnlyEnabled', !!v); emit('search'); }">仅显示在售</el-checkbox>
			</div>
		</div>

		<div class="products">
			<el-empty v-if="productsLoading && (products||[]).length===0" description="加载中..." />
			<div v-else class="grid">
				<div
					v-for="p in products"
					:key="p.id"
					class="prod"
					:class="{ disabled: isProductDisabled(p) }"
					@click="onProductClick(p)"
				>
					<div class="thumb">
						<img v-if="p.imageUrl" :src="absUrl(p.imageUrl)" alt="" />
						<div v-else class="noimg">无图</div>
						<div class="badges">
							<el-tag v-if="p.type==='SERVICE'" type="success" size="small">服务</el-tag>
							<el-tag v-else-if="p.type==='VIRTUAL_CARD'" type="warning" size="small">卡券</el-tag>
							<el-tag v-else type="info" size="small">商品</el-tag>
							<el-tag v-if="!p.enabled" type="danger" size="small">已下架</el-tag>
							<el-tag v-if="p.type!=='SERVICE' && (Number(p.totalStock||0)===0)" type="danger" size="small">售罄</el-tag>
							<!-- 发货形式徽标：仅实物显示 -->
							<el-tag v-if="p.type==='PHYSICAL' && p.shipAllowExpress===false && p.shipAllowPickup!==false" type="warning" size="small">仅自提</el-tag>
							<el-tag v-if="p.type==='PHYSICAL' && p.shipAllowPickup===false && p.shipAllowExpress!==false" type="warning" size="small">仅快递</el-tag>
						</div>
						<div v-if="isProductDisabled(p)" class="mask">{{ disabledReason(p) }}</div>
					</div>
					<div class="info">
						<div class="name" :title="p.name">{{ p.name }}</div>
						<div class="price">
							<span class="num">¥{{ displayPrice(p) }}</span>
							<span v-if="p.priceRange && p.specType==='MULTI'" class="range">{{ p.priceRange }}</span>
						</div>
						<div v-if="p.type!=='SERVICE'" class="stock">库存：{{ Number(p.totalStock||0) }}</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { absUrl } from '../../utils/http';
import { ElMessage } from 'element-plus';

const props = defineProps<{ 
	orderKind: 'SERVICE'|'SP';
	categoriesDisplay: any[];
	activeCategoryId?: number|undefined;
	keyword: string;
	showOnlyEnabled: boolean;
	products: any[];
	productsLoading: boolean;
}>();
const emit = defineEmits<{
	(e:'update:orderKind', v:'SERVICE'|'SP'): void;
	(e:'update:activeCategoryId', v:number|undefined): void;
	(e:'update:keyword', v:string): void;
	(e:'update:showOnlyEnabled', v:boolean): void;
	(e:'order-kind-change'): void;
	(e:'search'): void;
	(e:'product-click', p:any): void;
}>();

function onKindChange(v:any){ emit('update:orderKind', v as any); emit('order-kind-change'); }

function displayPrice(p:any): string { if (p.specType === 'MULTI') return p.priceRange || ''; return Number(p.price||0).toFixed(2); }
function isProductDisabled(p:any): boolean {
	if (!p?.enabled) return true;
	if (props.orderKind==='SERVICE'){
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
	if (props.orderKind==='SERVICE' && p.type!=='SERVICE') return '仅服务可选';
	if (props.orderKind==='SP' && p.type==='SERVICE') return '仅商品/卡券可选';
	if (props.orderKind==='SP' && p.type!=='SERVICE' && Number(p.totalStock||0)===0) return '售罄';
	return '不可选';
}
function onProductClick(p:any){
	if (isProductDisabled(p)) { ElMessage.info(disabledReason(p)); return; }
	emit('product-click', p);
}
</script>

<style scoped>
.left{ flex: 1 1 auto; min-width: 0; display:flex; flex-direction: column; gap:8px; }
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
.prod.disabled{ opacity: 0.6; cursor: not-allowed; }
@media (max-width: 1440px){ .grid{ grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); } }
</style>


