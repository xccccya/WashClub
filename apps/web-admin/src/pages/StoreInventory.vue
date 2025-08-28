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
				<el-select v-if="selectedProduct?.specType==='MULTI'" v-model="skuId" placeholder="选择SKU" style="width:260px;" :disabled="!selectedProduct" @change="onSkuChange">
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
				<el-input-number
					v-model="change"
					:step="1"
					:precision="0"
					:placeholder="reason==='ADJUSTMENT' ? '调整可正可负' : (reason==='INBOUND' ? '入库数量(正数)' : '出库数量(正数)')"
					:min="reason==='ADJUSTMENT' ? -999999 : 0"
					:max="999999"
				/>
				<el-select v-model="reason" placeholder="原因" style="width:160px;" @change="onReasonChange">
					<el-option label="入库" value="INBOUND" />
					<el-option label="出库" value="OUTBOUND" />
					<el-option label="调整" value="ADJUSTMENT" />
				</el-select>
				<el-input v-model="remark" placeholder="备注" style="flex:1;" />
				<el-button type="primary" @click="doAdjust">提交</el-button>
			</div>
		</div>
		<div class="card" v-if="selectedProduct && selectedProduct.type!=='SERVICE'">
			<div class="row" style="justify-content:space-between;">
				<div class="row" style="margin-bottom:0;">
					<el-select v-model="filterReason" placeholder="流水原因" style="width:140px;">
						<el-option label="全部" :value="''" />
						<el-option label="入库" value="INBOUND" />
						<el-option label="出库" value="OUTBOUND" />
						<el-option label="调整" value="ADJUSTMENT" />
						<el-option label="订单扣减" value="ORDER_DEDUCT" />
						<el-option label="订单回滚" value="ORDER_ROLLBACK" />
						<el-option label="退款回仓" value="REFUND_RETURN" />
					</el-select>
					<el-button @click="fetchLogs">查询记录</el-button>
				</div>
				<div class="row" style="margin-bottom:0;">
					<el-pagination
						:current-page="page"
						:page-size="pageSize"
						:total="total"
						@current-change="onPageChange"
						layout="prev, pager, next"
					/>
				</div>
			</div>
			<el-table :data="logs" border stripe size="small" style="width:100%;border-radius:8px;">
				<el-table-column prop="id" label="ID" width="80" />
				<el-table-column label="时间" width="180">
					<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
				</el-table-column>
				<el-table-column label="商品/SKU" min-width="220">
					<template #default="{ row }">
						<div class="nowrap">{{ row.product?.name || '-' }}<span v-if="row.sku">｜{{ row.sku?.name }}（{{ row.sku?.skuCode }}）</span></div>
					</template>
				</el-table-column>
				<el-table-column label="变更" width="120">
					<template #default="{ row }">
						<span :style="{color: row.change>=0? '#2f8f2f':'#c0392b'}">{{ row.change>=0? '+'+row.change : row.change }}</span>
					</template>
				</el-table-column>
				<el-table-column label="前后库存" width="160">
					<template #default="{ row }">{{ row.beforeStock }} → {{ row.afterStock }}</template>
				</el-table-column>
				<el-table-column label="原因" width="140">
					<template #default="{ row }">{{ reasonLabel(row.reason) }}</template>
				</el-table-column>
				<el-table-column prop="remark" label="备注" min-width="160" />
				<el-table-column label="操作人" width="140">
					<template #default="{ row }">{{ row.operatorUser?.name || row.operatorUser?.phone || '-' }}</template>
				</el-table-column>
			</el-table>
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
const logs = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const filterReason = ref('');

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
function reasonLabel(r?: string){
    if(r==='INBOUND') return '入库';
    if(r==='OUTBOUND') return '出库';
    if(r==='ADJUSTMENT') return '调整';
    if(r==='ORDER_DEDUCT') return '订单扣减';
    if(r==='ORDER_ROLLBACK') return '订单回滚';
    if(r==='REFUND_RETURN') return '退款回仓';
    return r || '-';
}
function formatTime(t:any){ try{ return new Date(t).toLocaleString(); }catch{ return t||'-'; } }

async function fetchCategories(){ categories.value = await http('/store/categories'); }
async function fetchProducts(){ if(!categoryId.value){ products.value=[]; return; } products.value = (await http('/store/products', { query: { categoryId: String(categoryId.value), enabled: 'true' } }))
    .filter((p:any)=> p.type !== 'SERVICE'); }

function onCategoryChange(){ productId.value = undefined; skuId.value = undefined; products.value=[]; skus.value=[]; logs.value=[]; total.value=0; fetchProducts(); }
function onProductChange(){
	skuId.value = undefined;
	const p = selectedProduct.value;
	skus.value = p && p.specType==='MULTI' ? (Array.isArray(p.skus)? p.skus.filter((s:any)=> s.enabled !== false):[]) : [];
	page.value = 1; // 切换商品后默认展示该商品全部记录（不按SKU过滤）
	fetchLogs();
}
function onSkuChange(){ page.value = 1; fetchLogs(); }
async function fetchLogs(){
    if(!productId.value){ logs.value=[]; total.value=0; return; }
    const query:any = { productId: String(productId.value), page: String(page.value), pageSize: String(pageSize.value) };
    if (selectedProduct.value?.specType==='MULTI' && skuId.value) query.skuId = String(skuId.value);
    if (filterReason.value) query.reason = filterReason.value;
    const res = await http('/store/inventory/logs', { query });
    logs.value = Array.isArray(res?.items) ? res.items : [];
    total.value = Number(res?.total || 0);
}
function onPageChange(p:number){ page.value = p; fetchLogs(); }

async function doAdjust(){
	if (!productId.value) { ElMessage.error('请选择商品'); return; }
	const p = selectedProduct.value;
	if (!p) { ElMessage.error('请选择有效商品'); return; }
	if (p.type === 'SERVICE') { ElMessage.error('服务商品不支持库存调整'); return; }
	if (change.value===undefined || change.value===null || change.value===0) { ElMessage.error('请输入非零变更数量'); return; }
	// 入库/出库：只允许正数；调整允许正负
	if (reason.value !== 'ADJUSTMENT' && change.value < 0) { ElMessage.error('入库/出库仅填写正数数量'); return; }
	if (p.specType==='MULTI' && !skuId.value) { ElMessage.error('多规格商品请先选择SKU'); return; }
	await http('/store/inventory/adjust', { method:'POST', body: { productId: productId.value, skuId: skuId.value || undefined, change: change.value, reason: reason.value, remark: remark.value } });
	ElMessage.success('已完成库存调整');
	// 刷新商品数据以更新库存显示
	await fetchProducts();
    // 刷新日志
    await fetchLogs();
}

function onReasonChange(){
    // 切换为入库/出库时，若为负数则取绝对值；切换为调整不动
    if (reason.value === 'INBOUND' || reason.value === 'OUTBOUND') {
        if (typeof change.value === 'number' && change.value < 0) change.value = Math.abs(change.value);
    }
}

onMounted(async ()=>{ await fetchCategories(); });
</script>

<style scoped>
.card{ background:#fff; border:1px solid #eee; border-radius:8px; padding:12px; }
.row{ display:flex; gap:12px; align-items:center; margin-bottom:12px; }
.hint{ color:#666; margin:-4px 0 8px 0; }
</style>


