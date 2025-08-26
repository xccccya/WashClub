<template>
	<div>
		<h3>库存管理</h3>
		<div class="card">
			<div class="row">
				<el-select v-model="categoryId" placeholder="选择商品分类" style="width:220px;" @change="onCategoryChange">
					<el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
				</el-select>
				<el-select v-model="productId" placeholder="选择商品" style="width:320px;" filterable :disabled="!categoryId" @change="onProductChange">
					<el-option v-for="p in products" :key="p.id" :label="productLabel(p)" :value="p.id" />
				</el-select>
				<el-select v-if="selectedProduct?.specType==='MULTI'" v-model="skuId" placeholder="选择SKU" style="width:260px;" :disabled="!selectedProduct">
					<el-option v-for="s in skus" :key="s.id" :label="skuLabel(s)" :value="s.id" />
				</el-select>
			</div>
			<div class="hint" v-if="selectedProduct">
				<div>类型：<b>{{ typeLabel(selectedProduct.type) }}</b> ｜ 规格：<b>{{ specLabel(selectedProduct.specType) }}</b>
					<span v-if="selectedProduct.type!=='SERVICE'"> ｜ 当前库存：
						<span v-if="selectedProduct.specType==='MULTI'">{{ totalStock(selectedProduct) }}</span>
						<span v-else>{{ selectedProduct.stockQuantity ?? 0 }}</span>
					</span>
				</div>
			</div>
			<div class="row">
				<el-input-number v-model="change" :min="-999999" :max="999999" :step="1" placeholder="变更数量(+入库/-出库)" />
				<el-select v-model="reason" placeholder="原因" style="width:160px;">
					<el-option label="入库" value="INBOUND" />
					<el-option label="出库" value="OUTBOUND" />
					<el-option label="调整" value="ADJUSTMENT" />
				</el-select>
				<el-input v-model="remark" placeholder="备注" style="flex:1;" />
				<el-button type="primary" @click="doAdjust">提交</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });

const categories = ref<any[]>([]);
const products = ref<any[]>([]);
const skus = ref<any[]>([]);

const categoryId = ref<number | undefined>(undefined);
const productId = ref<number | undefined>(undefined);
const skuId = ref<number | undefined>(undefined);
const change = ref<number | undefined>(undefined);
const reason = ref('INBOUND');
const remark = ref('');

const selectedProduct = computed(()=> products.value.find(p=>p.id===productId.value));

function typeLabel(t?: string){ if(t==='SERVICE') return '服务项目'; if(t==='PHYSICAL') return '实物商品'; if(t==='VIRTUAL_CARD') return '虚拟卡券'; return t||'-'; }
function specLabel(s?: string){ if(s==='SINGLE') return '单规格'; if(s==='MULTI') return '多规格'; return s||'-'; }
function totalStock(p:any){ return p?.totalStock ?? 0; }
function productLabel(p:any){ const inv = p.type==='SERVICE' ? '-' : (p.specType==='MULTI' ? totalStock(p) : (p.stockQuantity ?? 0)); return `${p.name}（${typeLabel(p.type)}｜${specLabel(p.specType)}｜库存：${inv}）`; }
function skuLabel(s:any){ return `${s.name || '默认'}｜库存：${s.stockQuantity ?? 0}`; }

async function fetchCategories(){ categories.value = await http('/store/categories'); }
async function fetchProducts(){ if(!categoryId.value){ products.value=[]; return; } products.value = (await http('/store/products', { query: { categoryId: String(categoryId.value), enabled: 'true' } }))
    .filter((p:any)=> p.type !== 'SERVICE'); }

function onCategoryChange(){ productId.value = undefined; skuId.value = undefined; products.value=[]; skus.value=[]; fetchProducts(); }
function onProductChange(){ skuId.value = undefined; const p = selectedProduct.value; skus.value = p && p.specType==='MULTI' ? (Array.isArray(p.skus)? p.skus.filter((s:any)=> s.enabled !== false):[]) : []; }

async function doAdjust(){
	if (!productId.value) { ElMessage.error('请选择商品'); return; }
	const p = selectedProduct.value;
	if (!p) { ElMessage.error('请选择有效商品'); return; }
	if (p.type === 'SERVICE') { ElMessage.error('服务商品不支持库存调整'); return; }
	if (change.value===undefined || change.value===null || change.value===0) { ElMessage.error('请输入非零变更数量'); return; }
	if (p.specType==='MULTI' && !skuId.value) { ElMessage.error('多规格商品请先选择SKU'); return; }
	await http('/store/inventory/adjust', { method:'POST', body: { productId: productId.value, skuId: skuId.value || undefined, change: change.value, reason: reason.value, remark: remark.value } });
	ElMessage.success('已完成库存调整');
	// 刷新商品数据以更新库存显示
	await fetchProducts();
}

onMounted(async ()=>{ await fetchCategories(); });
</script>

<style scoped>
.card{ background:#fff; border:1px solid #eee; border-radius:8px; padding:12px; }
.row{ display:flex; gap:12px; align-items:center; margin-bottom:12px; }
.hint{ color:#666; margin:-4px 0 8px 0; }
</style>


