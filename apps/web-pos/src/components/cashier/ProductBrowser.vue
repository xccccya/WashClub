<template>
	<div class="browser">
		<!-- 顶部导航卡片：类型切换 + 搜索 + 仅展示在售（功能不变，仅样式参考截图） -->
		<div class="nav-card">
			<div class="nav-left">
				<el-radio-group :model-value="orderKind" size="default" class="kind" @change="onKindChange">
					<el-radio-button value="SP">商品/卡券</el-radio-button>
					<el-radio-button value="SERVICE">服务</el-radio-button>
				</el-radio-group>
			</div>
			<div class="nav-right">
				<el-input
					:model-value="keyword"
					placeholder="搜索或扫码识别商品"
					clearable
					size="default"
					class="search-input"
					:suffix-icon="Search"
					@update:model-value="onKeywordChange"
					@keyup.enter="emit('search')"
				/>
			</div>
		</div>

		<!-- 商品选择卡片：分类横向列表 + 商品列表 + 展开分类菜单（参考截图） -->
		<div class="picker-card">
			<div class="catbar">
				<el-button class="cat-arrow" circle text @click="scrollCats(-1)">
					<el-icon><ArrowLeft /></el-icon>
				</el-button>
				<div ref="catScrollRef" class="cat-scroll">
					<div class="cat-tab" :class="{ active: typeof activeCategoryId==='undefined' }" @click="onPickCategory(undefined)">
						全部商品
					</div>
					<div
						v-for="c in (categoriesDisplay||[])"
						:key="c.id"
						class="cat-tab"
						:class="{ active: Number(activeCategoryId)===Number(c.id) }"
						@click="onPickCategory(Number(c.id))"
					>
						{{ c.name }}
					</div>
				</div>
				<el-button class="cat-arrow" circle text @click="scrollCats(1)">
					<el-icon><ArrowRight /></el-icon>
				</el-button>
				<el-button class="cat-menu" circle text @click="toggleCategoryPanel">
					<el-icon><Menu /></el-icon>
				</el-button>
			</div>

			<div class="body">
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
					<div v-else-if="(products||[]).length===0" class="empty">
						<el-empty description="暂无商品" />
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
								<div v-if="isProductDisabled(p)" class="thumb-mask">{{ disabledReason(p) }}</div>
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

				<div v-if="categoryPanelOpen" class="category-panel">
					<div class="panel-header">
						<el-icon class="panel-ico"><Menu /></el-icon>
						<div class="panel-title">全部分类</div>
						<el-button class="panel-close" circle text @click="categoryPanelOpen=false">
							<el-icon><Close /></el-icon>
						</el-button>
					</div>
					<div class="panel-list">
						<div
							class="panel-item"
							:class="{ active: typeof activeCategoryId==='undefined' }"
							@click="onPickCategory(undefined)"
						>
							<el-icon class="panel-chevron"><ArrowRight /></el-icon>
							<div class="panel-name">全部商品</div>
						</div>
						<div
							v-for="c in (categoriesDisplay||[])"
							:key="c.id"
							class="panel-item"
							:class="{ active: Number(activeCategoryId)===Number(c.id) }"
							@click="onPickCategory(Number(c.id))"
						>
							<el-icon class="panel-chevron"><ArrowRight /></el-icon>
							<div class="panel-name">{{ c.name }}</div>
						</div>
					</div>
				</div>
			</div>
		</div>

	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { absUrl } from '../../utils/http';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, Plus, Menu, Close, Search } from '@element-plus/icons-vue';

const props = defineProps<{ 
	orderKind: 'SERVICE'|'SP';
	categoriesDisplay: any[];
	activeCategoryId?: number|undefined;
	keyword: string;
	products: any[];
	productsLoading: boolean;
	highlightId?: number|undefined;
}>();
const emit = defineEmits<{
	(e:'update:orderKind', v:'SERVICE'|'SP'): void;
	(e:'update:activeCategoryId', v:number|undefined): void;
	(e:'update:keyword', v:string): void;
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

const catScrollRef = ref<HTMLElement | null>(null);
function scrollCats(dir: -1 | 1){
	try{
		const el = catScrollRef.value;
		if (!el) return;
		const step = Math.max(240, Math.floor(el.clientWidth * 0.6));
		el.scrollBy({ left: dir * step, behavior: 'smooth' });
	}catch{}
}
function onPickCategory(id: number | undefined){
	emit('update:activeCategoryId', id);
	emit('search');
}

const categoryPanelOpen = ref(false);
function toggleCategoryPanel(){
	categoryPanelOpen.value = !categoryPanelOpen.value;
}
</script>

<style scoped>
.browser{ flex: 1 1 auto; min-width: 0; display:flex; flex-direction: column; gap:12px; min-height:0; height:100%; }

/* 顶部导航卡片（参考截图） */
.nav-card{
	--nav-radius: 26px;
	/* 统一高度：tab / 搜索 / 在售 */
	--nav-h: 40px;
	/* 统一背景：截图是“浅灰填充，无边框” */
	--nav-chip-bg: #f3f5f8;
	--nav-chip-bg-hover: #eef2f6;
	/* hover 阴影更轻更柔 */
	--nav-hover-shadow: 0 10px 24px rgba(17,24,39,0.05);
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap:16px;
	padding: 12px 14px;
	border-radius: var(--nav-radius);
	/* 截图风格：整条导航卡片不做边框/阴影 */
	border: 0;
	background: #fff;
	box-shadow: none;
}
.nav-left{ flex: 0 0 auto; }
.nav-right{ display:flex; align-items:center; justify-content:flex-end; gap:12px; flex: 1 1 auto; min-width: 0; }
/* 分段样式：导航 tab（无边框，仅选中高亮；hover 有阴影） */
.kind{
	/* 注意：class="kind" 直接挂在 el-radio-group 根节点上 */
	background: transparent;
	border: 0;
	border-radius:999px;
	padding: 0;
	display:inline-flex;
	/* 截图里 tab 之间更“松” */
	gap: 22px;
}
.kind :deep(.el-radio-button){ margin: 0; }
.kind :deep(.el-radio-button__inner){
	background: transparent;
	border: 0 !important;
	border-left: 0 !important;
	box-shadow: none;
	border-radius: 999px !important;
	padding: 0 22px;
	height: var(--nav-h);
	line-height: var(--nav-h);
	display:inline-flex;
	align-items:center;
	justify-content:center;
	transition: background .15s ease, box-shadow .18s ease, transform .12s ease, color .15s ease;
	color:#111827;
	font-weight: 800;
	font-size: 16px;
}
.kind :deep(.el-radio-button:first-child .el-radio-button__inner),
.kind :deep(.el-radio-button:last-child .el-radio-button__inner){
	border-radius: 999px !important;
}
.kind :deep(.el-radio-button__inner::before){ display:none !important; }
.kind :deep(.el-radio-button__inner),
.kind :deep(.el-radio-button__inner:hover),
.kind :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner){
	outline: none !important;
}
.kind :deep(.el-radio-button__inner:hover){
	background: var(--nav-chip-bg-hover);
	box-shadow: var(--nav-hover-shadow);
}
.kind :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner),
.kind :deep(.is-active .el-radio-button__inner){
	background: var(--el-color-primary);
	color:#fff;
	/* 统一风格：选中态不要蓝色阴影 */
	box-shadow: none;
}
.search-input{ max-width: 560px; flex: 1 1 auto; min-width: 280px; }
.nav-right :deep(.el-input__wrapper){
	background: var(--nav-chip-bg);
	/* 搜索框需要边框（截图风格：细、浅、圆角胶囊） */
	border: 1px solid rgba(17,24,39,0.12) !important;
	box-shadow: none !important;
	border-radius: 999px;
	height: var(--nav-h);
	min-height: var(--nav-h);
	padding-left: 16px;
	padding-right: 14px;
	padding-top: 0;
	padding-bottom: 0;
	display: inline-flex;
	align-items: center;
	transition: background .15s ease, box-shadow .18s ease, border-color .15s ease;
}
.nav-right :deep(.el-input__inner){
	height: var(--nav-h) !important;
	line-height: var(--nav-h) !important;
}
.nav-right :deep(.el-input__wrapper:hover){
	background: var(--nav-chip-bg-hover);
	box-shadow: var(--nav-hover-shadow) !important;
	border-color: rgba(17,24,39,0.18) !important;
}
.nav-right :deep(.el-input__suffix){ margin-left: 8px; }
.nav-right :deep(.el-input__suffix-inner){ color: rgba(17,24,39,0.55); }
.nav-right :deep(.el-input__wrapper.is-focus),
.nav-right :deep(.is-focus .el-input__wrapper){
	background:#fff;
	/* 截图风格：聚焦不做蓝色描边/外框，只保持干净 */
	border-color: rgba(17,24,39,0.18) !important;
	box-shadow: none !important;
}

.picker-card{
	flex: 1 1 auto;
	min-height: 0;
	display:flex;
	flex-direction:column;
	border: 1px solid #eef1f5;
	border-radius: 18px;
	background: #fff;
	box-shadow: none;
	overflow: hidden;
}
.catbar{
	display:flex;
	align-items:center;
	gap:8px;
	padding: 12px 12px;
	border-bottom: 1px solid #f0f2f6;
	background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}
.cat-arrow{ width:34px; height:34px; flex: 0 0 auto; border-radius: 999px; background:#f7f9fc; border:1px solid #e7ebf0; }
.cat-arrow:hover{ background:#eef2f7; }
.cat-menu{ width:34px; height:34px; flex: 0 0 auto; border-radius: 12px; background:#f7f9fc; border:1px solid #e7ebf0; }
.cat-menu:hover{ background:#eef2f7; }
.cat-scroll{
	flex: 1 1 auto;
	min-width:0;
	overflow-x:auto;
	overflow-y:hidden;
	display:flex;
	gap:18px;
	padding: 2px 6px;
	scroll-behavior:smooth;
	overscroll-behavior: contain;
	-webkit-overflow-scrolling: touch;
}
.cat-tab{
	flex: 0 0 auto;
	padding: 10px 2px;
	color:#374151;
	font-weight:800;
	cursor:pointer;
	user-select:none;
	white-space:nowrap;
	border-bottom: 2px solid transparent;
	transition: color .15s ease, border-color .15s ease;
}
.cat-tab:hover{ color:#111827; }
.cat-tab.active{ color: var(--el-color-primary); border-bottom-color: var(--el-color-primary); }

.body{ flex: 1 1 auto; min-height: 0; display:flex; overflow:hidden; }
.products{ flex:1 1 auto; min-height: 0; overflow:auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; padding: 14px; }
.empty{ display:flex; align-items:center; justify-content:center; min-height: 240px; }
.grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:14px; }
.prod{
	display:flex;
	align-items:stretch;
	gap:12px;
	padding: 12px;
	background:#fff;
	border:1px solid #eef1f5;
	border-radius:18px;
	cursor:pointer;
	user-select:none;
	position:relative;
	transition: box-shadow .2s ease, transform .08s ease, border-color .2s ease;
}
.prod:hover{ box-shadow: 0 12px 28px rgba(17,24,39,.10); border-color: rgba(99,102,241,.20); }
.prod:active{ transform: scale(0.99); }
.prod.highlight{ box-shadow: 0 8px 20px rgba(64,158,255,.25); transform: scale(1.02); }
.prod.highlight::after{ content:''; position:absolute; inset:0; border:2px solid var(--el-color-primary); border-radius:18px; pointer-events:none; box-shadow: 0 0 0 0 rgba(0,0,0,0); z-index:1; }
.thumb{
	position:relative;
	flex: 0 0 auto;
	width: 92px;
	height: 92px;
	border-radius:14px;
	background:#f3f4f6;
	overflow:hidden;
	display:flex;
	align-items:center;
	justify-content:center;
}
.thumb img{ width:100%; height:100%; object-fit:cover; }
.noimg{ color:#9ca3af; font-weight:700; }
.thumb-mask{
	position:absolute;
	inset:0;
	background: rgba(17,24,39,0.42);
	color:#fff;
	display:flex;
	align-items:center;
	justify-content:center;
	font-weight:900;
	font-size:14px;
	letter-spacing:.2px;
}
.info{ flex: 1 1 auto; min-width:0; display:flex; flex-direction:column; gap:8px; padding-top: 2px; padding-right: 34px; }
.name{ font-weight:800; line-height:1.25; max-height: 44px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; line-clamp: 2; -webkit-box-orient:vertical; color:#111827; }
.price{ display:flex; align-items:baseline; gap:8px; }
.price .num{ font-size:18px; font-weight:900; color:#ef4444; }
.price .range{ color:#999; font-size:12px; }
.stock{ color:#909399; font-size:12px; }
.prod.disabled{ opacity: 0.6; cursor: not-allowed; }
/* 快捷添加按钮 */
.quick-add{
	position:absolute;
	right:10px;
	bottom:10px;
	box-shadow: 0 10px 20px rgba(59,130,246,.25);
	opacity:.95;
}
/* 骨架屏 */
.loading .thumb{ background: #f5f7fa; }
.sk{ background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%); border-radius:8px; }
.sk-thumb{ position:absolute; inset:0; border-radius:0; }
.sk-line{ height:14px; margin:8px 0; }
@media (max-width: 1440px){ .grid{ grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); } }
@media (min-width: 1680px){ .grid{ grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); } }
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

/* 展开分类菜单（右侧面板，参考截图） */
.category-panel{
	flex: 0 0 auto;
	width: 340px;
	border-left: 1px solid #f0f2f6;
	background: #fbfcfe;
	display:flex;
	flex-direction:column;
	min-height:0;
}
.panel-header{
	display:flex;
	align-items:center;
	gap:10px;
	padding: 14px 14px;
	border-bottom: 1px solid #eef1f5;
	background: #fff;
}
.panel-ico{ color:#111827; }
.panel-title{ font-weight:900; color:#111827; }
.panel-close{ margin-left:auto; width:34px; height:34px; border-radius: 12px; background:#f7f9fc; border:1px solid #e7ebf0; }
.panel-close:hover{ background:#eef2f7; }
.panel-list{ flex: 1 1 auto; min-height:0; overflow:auto; padding: 10px; }
.panel-item{
	display:flex;
	align-items:center;
	gap:10px;
	padding: 12px 12px;
	border-radius: 14px;
	cursor:pointer;
	color:#111827;
	font-weight:800;
	transition: background .15s ease, color .15s ease;
}
.panel-item:hover{ background:#f1f5f9; }
.panel-item.active{ background: rgba(64,158,255,.10); color: var(--el-color-primary); }
.panel-chevron{ color: currentColor; opacity:.9; }
.panel-name{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
</style>


