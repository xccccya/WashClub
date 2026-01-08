<template>
	<div class="picker">
		<div class="top">
			<el-input
				:model-value="keyword"
				clearable
				size="large"
				class="search"
				placeholder="搜索服务项目"
				:suffix-icon="Search"
				@update:model-value="onKeywordChange"
			/>
			<div class="meta">
				<el-tag v-if="selectedIds.length" type="success" effect="light">已选 {{ selectedIds.length }} 项</el-tag>
				<el-tag v-else type="info" effect="plain">点击卡片即可选择</el-tag>
			</div>
		</div>

		<div v-if="selectedIds.length" class="selected">
			<div class="chips">
				<el-tag
					v-for="pid in selectedIds"
					:key="pid"
					closable
					class="chip"
					@close="onClosePid(pid)"
				>
					{{ productNameById(pid) }}
					<span v-if="skuTextByProductId(pid)" class="chip-sub">· {{ skuTextByProductId(pid) }}</span>
				</el-tag>
			</div>
		</div>

		<div class="grid-wrap">
			<div v-if="loading && !products.length" class="grid">
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

			<div v-else-if="filtered.length === 0" class="empty">
				<el-empty description="暂无可选服务" />
			</div>

			<div v-else class="grid">
				<div
					v-for="p in filtered"
					:key="p.id"
					class="prod"
					:class="{ selected: isSelected(p.id) }"
					@click="emit('product-click', p)"
				>
					<div class="thumb">
						<img v-if="p.imageUrl" :src="toAbs(p.imageUrl)" alt="" />
						<div v-else class="noimg">无图</div>
						<div v-if="isSelected(p.id)" class="check">
							<el-icon><CircleCheckFilled /></el-icon>
						</div>
					</div>
					<div class="info">
						<div class="name" :title="p.name">{{ p.name }}</div>
						<div class="sub">
							<el-tag v-if="String(p.specType||'')==='MULTI'" size="small" effect="plain">多规格</el-tag>
							<el-tag v-if="isSelected(p.id) && skuText(p)" size="small" type="success" effect="light">{{ skuText(p) }}</el-tag>
						</div>
						<div class="price">
							<span class="num">
								<template v-if="String(p.specType||'')==='MULTI'">{{ p.priceRange || '—' }}</template>
								<template v-else>¥{{ Number(p.price||0).toFixed(2) }}</template>
							</span>
						</div>
					</div>
					<div class="hint">
						<span v-if="isSelected(p.id)">再次点击取消</span>
						<span v-else>点击选择</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Search, CircleCheckFilled } from '@element-plus/icons-vue';
import { absUrl } from '../../utils/http';

type Product = { id:number; name:string; price:number; enabled:boolean; type:string; imageUrl?: string | null; specType?: string; priceRange?: string | null; skus?: Array<{ id:number; name:string; price:number; enabled?: boolean }> };

const props = defineProps<{
	products: Product[];
	loading?: boolean;
	keyword: string;
	selectedIds: number[];
	skuByProduct: Record<number, number|undefined>;
}>();

const emit = defineEmits<{
	(e:'update:keyword', v:string): void;
	(e:'product-click', p: Product): void;
}>();

function toAbs(u?: string | null){ return absUrl(u || ''); }

// 轻量防抖，避免频繁刷新
let kwTimer: any = null;
function onKeywordChange(v: any){
	const s = String(v || '').trim();
	emit('update:keyword', s);
	try { if (kwTimer) clearTimeout(kwTimer); } catch {}
	kwTimer = setTimeout(()=>{ /* noop: 父组件可按需监听 keyword */ }, 120);
}

const filtered = computed(()=>{
	const kw = String(props.keyword || '').trim().toLowerCase();
	const arr = Array.isArray(props.products) ? props.products : [];
	if (!kw) return arr;
	return arr.filter((p:any)=>{
		const name = String(p?.name || '').toLowerCase();
		if (name.includes(kw)) return true;
		const skus = Array.isArray(p?.skus) ? p.skus : [];
		return skus.some((s:any)=> String(s?.name||'').toLowerCase().includes(kw));
	});
});

function isSelected(pid: number){ return (props.selectedIds || []).includes(pid); }
function skuText(p: any){
	try{
		const pid = Number(p?.id||0);
		const sid = props.skuByProduct?.[pid];
		if (!sid) return '';
		const s = (Array.isArray(p?.skus) ? p.skus : []).find((x:any)=> Number(x.id)===Number(sid));
		return s?.name || '';
	}catch{ return ''; }
}
function skuTextByProductId(pid: number){
	try{
		const p = (props.products||[]).find((x:any)=> Number(x.id)===Number(pid));
		return skuText(p);
	}catch{ return ''; }
}
function productNameById(pid: number){
	try{ return (props.products||[]).find((x:any)=> Number(x.id)===Number(pid))?.name || String(pid); }catch{ return String(pid); }
}
function onClosePid(pid: number){
	try{
		const p = (props.products||[]).find((x:any)=> Number(x.id)===Number(pid));
		if (p) emit('product-click', p);
	}catch{}
}
</script>

<style scoped>
.picker{ display:flex; flex-direction:column; gap:12px; min-height:0; }
.top{ display:flex; align-items:center; gap:12px; }
.search{ flex: 1 1 auto; min-width: 240px; }
.meta{ flex: 0 0 auto; display:flex; gap:8px; align-items:center; }

.selected{ padding: 10px 12px; border:1px solid #eef1f5; border-radius: 14px; background: linear-gradient(180deg, #fff, #fbfcfe); }
.chips{ display:flex; flex-wrap:wrap; gap:10px; }
.chip{ border-radius: 999px; }
.chip-sub{ opacity:.75; }

.grid-wrap{ flex: 1 1 auto; min-height: 0; overflow:auto; padding: 4px 2px; }
.empty{ display:flex; align-items:center; justify-content:center; padding: 24px 0; }
.grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:14px; }

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
.prod:hover{ box-shadow: 0 12px 28px rgba(17,24,39,.10); border-color: rgba(99,102,241,.22); }
.prod:active{ transform: scale(0.99); }
.prod.selected{ border-color: rgba(34,197,94,.55); box-shadow: 0 10px 24px rgba(34,197,94,.10); }
.prod.selected::after{ content:''; position:absolute; inset:0; border:2px solid rgba(34,197,94,.55); border-radius:18px; pointer-events:none; }

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
.check{
	position:absolute;
	right:8px;
	top:8px;
	width:28px;
	height:28px;
	border-radius: 999px;
	background: rgba(34,197,94,.92);
	color:#fff;
	display:flex;
	align-items:center;
	justify-content:center;
	box-shadow: 0 10px 18px rgba(34,197,94,.22);
}
.info{ flex: 1 1 auto; min-width:0; display:flex; flex-direction:column; gap:8px; padding-top: 2px; }
.name{ font-weight:900; line-height:1.25; max-height: 44px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; line-clamp: 2; -webkit-box-orient:vertical; color:#111827; }
.sub{ display:flex; gap:8px; flex-wrap:wrap; }
.price{ display:flex; align-items:baseline; gap:8px; }
.price .num{ font-size:14px; font-weight:900; color:#ef4444; }
.hint{ position:absolute; right:12px; bottom:10px; color:#9ca3af; font-size:12px; font-weight:700; }

/* 骨架屏 */
.loading .thumb{ background: #f5f7fa; }
.sk{ background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%); border-radius:8px; }
.sk-thumb{ position:absolute; inset:0; border-radius:0; }
.sk-line{ height:14px; margin:8px 0; }

@media (max-width: 1240px){ .grid{ grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); } }
</style>

