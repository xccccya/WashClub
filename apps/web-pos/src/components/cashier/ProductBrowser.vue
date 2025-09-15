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
				<el-input :model-value="keyword" placeholder="搜索商品名/条码" clearable size="large" style="min-width:220px" @update:model-value="onKeywordChange" @keyup.enter="emit('search')" />
				<el-checkbox :model-value="showOnlyEnabled" @change="(v: any)=>{ emit('update:showOnlyEnabled', !!v); emit('search'); }">仅显示在售</el-checkbox>
			</div>
		</div>

		<div class="products">
			<transition name="fade-slide" mode="out-in">
			<div v-if="productsLoading && (products||[]).length===0" class="grid">
				<div v-for="i in 8" :key="i" class="prod loading">
					<div class="thumb">
						<el-skeleton animated :rows="0" style="width:100%; height:100%">
							<template #template>
								<div class="sk sk-thumb"></div>
							</template>
						</el-skeleton>
					</div>
					<div class="info">
						<el-skeleton animated :rows="2">
							<template #template>
								<div class="sk sk-line" style="width:80%"></div>
								<div class="sk sk-line" style="width:60%"></div>
							</template>
						</el-skeleton>
					</div>
				</div>
			</div>
			<div v-else class="grid" :key="orderKind">
				<div
					v-for="p in products"
					:key="p.id"
					class="prod"
					:class="{ disabled: isProductDisabled(p), highlight: (typeof highlightId!=='undefined' && Number(highlightId)===Number(p.id)) }"
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
					<el-button class="quick-add" type="primary" circle size="small" @click.stop="onProductClick(p)">
						<el-icon><Plus /></el-icon>
					</el-button>
				</div>
			</div>
			</transition>
		</div>
	</div>
</template>

<script setup lang="ts">
import { absUrl } from '../../utils/http';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

const props = defineProps<{ 
	orderKind: 'SERVICE'|'SP';
	categoriesDisplay: any[];
	activeCategoryId?: number|undefined;
	keyword: string;
	showOnlyEnabled: boolean;
	products: any[];
	productsLoading: boolean;
	highlightId?: number|undefined;
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

// 关键字输入自动搜索（去除按钮，轻微防抖）
let kwTimer: any = null;
function onKeywordChange(v:any){
  try{ emit('update:keyword', String(v||'').trim()); }catch{}
  try{ if (kwTimer) clearTimeout(kwTimer); }catch{}
  kwTimer = setTimeout(()=>{ try{ emit('search'); }catch{} }, 250);
}

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
.left{ flex: 1 1 auto; min-width: 0; display:flex; flex-direction: column; gap:8px; min-height:0; height:100%; overflow:auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.toolbar{ display:flex; flex-direction: column; gap:8px; position:sticky; top:0; z-index:2; background: rgba(255,255,255,0.75); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); padding:10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,.03); border-bottom: 1px solid #eef1f5; border-radius: 12px; }
.kind{ display:flex; align-items:center; }
/* 分段样式：极浅容器，选中态胶囊 */
.kind :deep(.el-radio-group){ background:#f6f8fb; border:1px solid #e6ebf2; border-radius:999px; padding:4px; display:inline-flex; gap:4px; }
.kind :deep(.el-radio-button){ margin: 0; }
.kind :deep(.el-radio-button__inner){ background: transparent; border: 0; box-shadow: none; border-radius: 999px !important; padding: 8px 18px; transition: all .15s ease; }
.kind :deep(.el-radio-button__inner:hover){ background: rgba(0,0,0,0.05); }
.kind :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner),
.kind :deep(.is-active .el-radio-button__inner){ background: var(--el-color-primary); color:#fff; }
.filters{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
/* 筛选透明布局，各控件采用轻卡片式边界与圆角 */
.filters{ background: transparent; border: 0; padding: 0; }
.filters :deep(.el-input__wrapper),
.filters :deep(.el-select__wrapper){ background:#f7f9fc; border:1px solid #e7ebf0 !important; box-shadow: none !important; border-radius:10px; }
.filters :deep(.el-input__wrapper.is-focus),
.filters :deep(.is-focus .el-input__wrapper),
.filters :deep(.el-select__wrapper.is-focus),
.filters :deep(.is-focus .el-select__wrapper){ background:#fff; border-color: var(--el-color-primary) !important; box-shadow: 0 0 0 2px rgba(64,158,255,.10) !important; }
.filters :deep(.el-input-group__append){ border: none; background: transparent; padding-left: 8px; }
.filters :deep(.el-checkbox){ padding:6px 10px; border-radius:10px; background:#f7f9fc; border:1px solid #e7ebf0; }
.filters :deep(.el-checkbox:hover){ background:#eef2f7; }
.products{ flex:1 1 auto; min-height: 200px; overflow:visible; }
.grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:10px; }
.prod{ background:#fff; border:1px solid var(--el-border-color); border-radius:12px; overflow:hidden; cursor:pointer; user-select:none; position:relative; transition: box-shadow .2s ease, transform .08s ease; }
.prod:hover{ box-shadow: 0 8px 20px rgba(0,0,0,.08); }
.prod:active{ transform: scale(0.98); }
.prod.highlight{ box-shadow: 0 8px 20px rgba(64,158,255,.25); transform: scale(1.02); }
.prod.highlight::after{ content:''; position:absolute; inset:0; border:2px solid var(--el-color-primary); border-radius:12px; pointer-events:none; box-shadow: 0 0 0 0 rgba(0,0,0,0); z-index:1; }
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
/* 快捷添加按钮 */
.quick-add{ position:absolute; right:8px; bottom:8px; box-shadow: 0 6px 16px rgba(59,130,246,.35); opacity:.95; }
/* 骨架屏 */
.loading .thumb{ background: #f5f7fa; }
.sk{ background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%); border-radius:8px; }
.sk-thumb{ position:absolute; inset:0; border-radius:0; }
.sk-line{ height:14px; margin:8px 0; }
@media (max-width: 1440px){ .grid{ grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); } }
@media (min-width: 1366px){ .grid{ grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); } }
/* 切换动效 */
.fade-slide-enter-active, .fade-slide-leave-active { transition: opacity .18s ease, transform .18s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateY(6px); }
.fade-slide-leave-to { opacity: 0; transform: translateY(-6px); }
/* 分段选中流光（切换瞬间） */
.kind :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner){ position:relative; overflow:hidden; }
.kind :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner::after){
  content:''; position:absolute; top:0; bottom:0; left:-30%; width:30%;
  background: linear-gradient(90deg, rgba(255,255,255,.0), rgba(255,255,255,.6), rgba(255,255,255,.0));
  transform: skewX(-20deg);
  animation: shine-quick .18s ease forwards;
}
@keyframes shine-quick { to { left: 130%; } }
</style>


