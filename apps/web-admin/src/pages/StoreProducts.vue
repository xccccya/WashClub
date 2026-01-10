<template>
	<div class="wc-page">
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<div class="wc-toolbar">
			<el-input v-model="keyword" placeholder="搜索名称/条码" class="wc-field wc-field--lg" @keyup.enter="fetchList" />
			<el-button @click="fetchList">查询</el-button>
			<div class="wc-spacer" />
			<el-button type="primary" @click="openCreate">新增商品</el-button>
		</div>

		<div class="wc-table-wrap">
			<div class="wc-table-scroll">
				<el-table :data="list" stripe size="small" style="min-width: 980px; width: 100%;">
			<el-table-column prop="id" label="ID" width="70" />
			<el-table-column label="主图" width="90">
				<template #default="{ row }">
					<img v-if="row.imageUrl" :src="abs(row.imageUrl)" class="product-thumb" />
				</template>
			</el-table-column>
			<el-table-column prop="name" label="名称" min-width="160" />
			<el-table-column prop="barcode" label="条码" width="160" />
			<el-table-column label="分类" width="120"><template #default="{ row }">{{ row.category?.name || '-' }}</template></el-table-column>
			<el-table-column label="类型" width="100"><template #default="{ row }"><el-tag>{{ typeLabel(row.type) }}</el-tag></template></el-table-column>
			<el-table-column label="规格" width="90"><template #default="{ row }">{{ specLabel(row.specType) }}</template></el-table-column>
			<el-table-column label="价格" width="160">
				<template #default="{ row }">
					<span v-if="row.specType==='MULTI'">{{ row.priceRange || '-' }}</span>
					<span v-else>{{ row.price }}</span>
				</template>
			</el-table-column>
			<el-table-column label="总销量" width="140">
				<template #default="{ row }">
					<span class="nowrap">{{ row.totalSales ?? 0 }}<span class="muted">（含虚拟：{{ row.initialSales ?? 0 }}）</span></span>
				</template>
			</el-table-column>
			<el-table-column label="剩余库存" width="110">
				<template #default="{ row }">{{ row.type==='SERVICE' ? '-' : (row.specType==='MULTI' ? (row.totalStock ?? 0) : (row.stockQuantity ?? 0)) }}</template>
			</el-table-column>
			<el-table-column label="状态" width="90">
				<template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已上架' : '已下架' }}</el-tag></template>
			</el-table-column>
			<el-table-column label="创建时间" width="170"><template #default="{ row }">{{ fmtTime(row.createdAt) }}</template></el-table-column>
			<el-table-column label="更新时间" width="170"><template #default="{ row }">{{ fmtTime(row.updatedAt) }}</template></el-table-column>
			<el-table-column label="操作" width="280" fixed="right">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-button size="small" :type="row.enabled ? 'warning' : 'success'" @click="toggleEnabled(row)">{{ row.enabled ? '下架' : '上架' }}</el-button>
					<el-popconfirm title="确认删除？若被引用将失败，建议下架" @confirm="remove(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
				</el-table>
			</div>
		</div>

		<el-dialog v-model="show" :title="form.id ? '编辑商品' : '新增商品'" width="980px" :destroy-on-close="false" class="wc-dialog wc-product-dialog">
			<el-tabs v-model="formTab">
				<el-tab-pane label="基础信息" name="base">
					<el-form label-width="100" class="wc-product-form">
						<el-form-item label="类型"><el-select v-model="form.type" :disabled="!!form.id" class="wc-field wc-field--md"><el-option label="服务项目" value="SERVICE" /><el-option label="实物商品" value="PHYSICAL" /><el-option label="虚拟卡券" value="VIRTUAL_CARD" /></el-select></el-form-item>
						<el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
						<el-form-item label="条码">
							<div class="inline-row">
								<el-input v-model="form.barcode" maxlength="13" placeholder="仅数字，最多13位" @input="onBarcodeInput" />
								<el-button @click="genBarcode">生成13位</el-button>
							</div>
						</el-form-item>
						<el-form-item label="分类"><el-select v-model="form.categoryId" placeholder="选择分类" class="wc-field wc-field--md"><el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" /></el-select></el-form-item>
						<el-form-item label="上架"><el-switch v-model="form.enabled" /></el-form-item>
						<el-form-item v-if="form.type==='SERVICE'" label="计为洗车(次)"><el-switch v-model="form.isCarWash" /></el-form-item>
						<el-form-item label="排序"><el-input-number v-model="form.sortWeight" :min="0" /></el-form-item>
						<el-form-item label="商品图片">
							<div class="images-field">
								<div class="images-grid">
									<div v-for="(img,i) in formImages" :key="img" class="image-card">
										<img :src="abs(img)" class="image-card__img" />
										<div v-if="i===0" class="image-card__badge">主图</div>
										<div class="image-card__remove" @click="removeImage(i)">×</div>
									</div>
								</div>
								<div class="images-actions">
									<div class="images-actions__left">
										<input class="file-input" type="file" multiple @change="onImagesChange" />
										<el-button size="small" @click="pickerVisible=true">从文件库选择</el-button>
									</div>
									<small>可添加多张图片，首张作为主图保存</small>
								</div>
							</div>
						</el-form-item>
					</el-form>
				</el-tab-pane>
				<el-tab-pane label="扩展信息" name="extra">
					<el-form label-width="100" class="wc-product-form">
						<el-form-item v-if="form.type==='PHYSICAL'" label="发货形式">
							<div class="inline-row inline-row--loose">
								<el-checkbox v-model="form.shipAllowExpress">允许快递配送</el-checkbox>
								<el-checkbox v-model="form.shipAllowPickup">允许到店自提</el-checkbox>
							</div>
							<div class="form-tip" v-if="form.type==='PHYSICAL' && !(form.shipAllowExpress || form.shipAllowPickup)">至少选择一种发货形式</div>
						</el-form-item>
						<el-form-item label="规格类型"><el-select v-model="form.specType" class="wc-field wc-field--sm"><el-option label="单规格" value="SINGLE" /><el-option label="多规格" value="MULTI" /></el-select></el-form-item>
						<div v-if="form.type==='SERVICE'" class="form-tip">提示：服务商品不参与库存统计，库存项将自动隐藏。</div>
						<template v-if="form.specType==='SINGLE'">
							<el-form-item label="价格"><el-input-number v-model="form.price" :min="0" :step="0.1" /></el-form-item>
							<el-form-item label="划线价"><el-input-number v-model="form.listPrice" :min="0" :step="0.1" /></el-form-item>
							<el-form-item v-if="form.type!=='SERVICE'" label="库存"><el-input-number v-model="form.stockQuantity" :min="0" /></el-form-item>
							<el-form-item v-if="form.type==='VIRTUAL_CARD'" label="绑定卡券"><el-select v-model="form.couponId" placeholder="选择卡券" class="wc-field wc-field--md"><el-option v-for="c in couponOptions" :key="c.id" :label="c.name" :value="c.id" /></el-select></el-form-item>
						</template>
						<template v-else>
							<div class="spec-panel">
								<div class="spec-head">
									<b>规格项定义</b>
									<el-button size="small" @click="addSpecItem">新增规格项</el-button>
								</div>
								<div v-for="(sp,i) in specItems" :key="i" class="spec-item">
									<div class="spec-item__row">
										<el-input v-model="sp.name" placeholder="规格名，如 颜色/尺码" class="wc-field wc-field--md" />
										<el-button size="small" type="danger" @click="removeSpecItem(i)">删除规格</el-button>
									</div>
									<div class="spec-item__values">
										<el-tag v-for="(val,vi) in sp.values" :key="vi" closable @close="removeSpecValue(i,vi)">{{ val }}</el-tag>
										<el-input v-model="specValueDraft" placeholder="输入规格值并回车" class="wc-field wc-field--md" @keyup.enter="confirmAddSpecValue(i)" />
									</div>
								</div>
								<div class="spec-actions">
									<el-button size="small" type="primary" @click="generateSkuMatrix"><el-icon style="margin-right:4px;"><Grid /></el-icon>生成规格组合</el-button>
									<small class="muted" style="margin-left:0;">将覆盖当前 SKU 列表</small>
								</div>
								<div class="sku-head">
									<b>SKU 列表</b>
									<div class="sku-head__actions">
										<el-button @click="addSku" size="small"><el-icon style="margin-right:4px;"><CirclePlus /></el-icon>新增SKU</el-button>
										<el-button @click="batchGenSkuIfEmpty" size="small"><el-icon style="margin-right:4px;"><Promotion /></el-icon>为空项生成SKU编码</el-button>
										<el-button @click="batchGenBarcodeIfEmpty" size="small"><el-icon style="margin-right:4px;"><Ticket /></el-icon>为空项生成条码</el-button>
									</div>
								</div>
								<div class="wc-table-wrap wc-table-wrap--inner">
									<el-table :data="form.skus" size="small" :fit="false" style="width:100%;">
									<el-table-column label="名称"><template #default="{ row }"><el-input v-model="row.name" placeholder="规格名称" /></template></el-table-column>
									<el-table-column label="SKU编码" width="220">
										<template #default="{ row }">
											<div class="inline-row" style="gap:6px;">
												<el-input v-model="row.skuCode" placeholder="自动/手填" />
												<el-button size="small" @click="genRowSku(row)">生成</el-button>
											</div>
										</template>
									</el-table-column>
									<el-table-column label="条码" width="220">
										<template #default="{ row }">
											<div class="inline-row" style="gap:6px;">
												<el-input v-model="row.barcode" placeholder="13位数字" />
												<el-button size="small" @click="genRowBarcode(row)">生成</el-button>
											</div>
										</template>
									</el-table-column>
									<el-table-column label="图片" width="160">
										<template #default="{ row }">
											<div class="sku-image-cell">
												<img v-if="row.imageUrl" :src="abs(row.imageUrl)" class="sku-thumb" />
												<el-upload :http-request="(o:any)=>onSkuUpload(row,o)" :show-file-list="false"><el-button size="small">上传</el-button></el-upload>
												<el-button size="small" @click="openSkuPicker(row)">从文件库选择</el-button>
											</div>
										</template>
									</el-table-column>
									<el-table-column label="价格" width="180"><template #default="{ row }"><el-input-number v-model="row.price" :min="0" :step="0.1" controls-position="right" class="sku-number sku-number--price" /></template></el-table-column>
									<el-table-column label="划线价" width="180"><template #default="{ row }"><el-input-number v-model="row.listPrice" :min="0" :step="0.1" controls-position="right" class="sku-number sku-number--price" /></template></el-table-column>
									<el-table-column v-if="form.type!=='SERVICE'" label="库存" width="160"><template #default="{ row }"><el-input-number v-model="row.stockQuantity" :min="0" controls-position="right" class="sku-number sku-number--stock" /></template></el-table-column>
									<el-table-column v-if="form.type==='VIRTUAL_CARD'" label="绑定卡券" min-width="240">
										<template #default="{ row }">
											<el-select v-model="row.couponId" placeholder="选择卡券" filterable style="width:100%;">
												<el-option v-for="c in couponOptions" :key="c.id" :label="c.name" :value="c.id" />
											</el-select>
										</template>
									</el-table-column>
									<el-table-column label="启用" width="90"><template #default="{ row }"><el-switch v-model="row.enabled" /></template></el-table-column>
									<el-table-column label="操作" width="100"><template #default="{ $index }"><el-button size="small" type="danger" @click="removeSku($index)">删除</el-button></template></el-table-column>
									</el-table>
								</div>
							</div>
						</template>
						<el-form-item label="积分抵扣"><el-switch v-model="form.pointsDeductible" /></el-form-item>
						<el-form-item label="会员折扣"><el-switch v-model="form.memberDiscount" /></el-form-item>
						<el-form-item label="初始销量"><el-input-number v-model="form.initialSales" :min="0" /></el-form-item>
						<el-form-item label="卖点"><el-input v-model="form.sellPoint" placeholder="十字以内高亮卖点" /></el-form-item>
					</el-form>
				</el-tab-pane>
				<el-tab-pane label="商品介绍" name="desc">
					<div class="desc-head">
						<span>支持图片粘贴上传、基础排版与列表。</span>
						<el-button size="small" @click="openInsertFromLib">从文件库插入图片</el-button>
					</div>
					<div ref="quillRef" class="quill-host"></div>
				</el-tab-pane>
			</el-tabs>
			<template #footer>
				<el-button @click="show=false">取消</el-button>
				<el-button type="primary" @click="save">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showUpload" title="上传商品图片" width="520px" class="wc-dialog">
			<div class="upload-panel">
				<input class="file-input" type="file" @change="onFileChange" />
			</div>
			<div v-if="uploadUrl" style="margin-top:12px;">已上传：<code>{{ uploadUrl }}</code></div>
			<template #footer>
				<el-button @click="showUpload=false">关闭</el-button>
				<el-button type="primary" v-if="uploadUrl" @click="applyImage">应用到商品</el-button>
			</template>
		</el-dialog>

		<FilePickerDialog v-model="pickerVisible" multiple title="选择商品图片" @picked="onPicked" />
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import FilePickerDialog from './_components/FilePickerDialog.vue';
import { ElMessage } from 'element-plus';
import { Grid, CirclePlus, Promotion, Ticket } from '@element-plus/icons-vue';
import {
	couponControllerList,
	storeCategoryControllerList,
	storeProductControllerCreate,
	storeProductControllerList,
	storeProductControllerRemove,
	storeProductControllerUpdate,
} from '@wash/api-client';

// 兼容：将 Quill 暴露到全局，供 @vueup/vue-quill 内部使用
try { if (typeof window !== 'undefined' && !(window as any).Quill) { (window as any).Quill = Quill; } } catch {}

function abs(u?: string){ return absUrl(u || ''); }
const list = ref<any[]>([]);
const categories = ref<any[]>([]);
const keyword = ref('');
const quillRef = ref<HTMLDivElement|null>(null);
let quillInstance: any = null;

async function fetchList(){
	const params: any = {};
	if (keyword.value) params.keyword = keyword.value;
	const res: any = await storeProductControllerList(params as any);
	list.value = Array.isArray(res) ? res : [];
}
function typeLabel(t?: string){ if(t==='SERVICE') return '服务项目'; if(t==='PHYSICAL') return '实物商品'; if(t==='VIRTUAL_CARD') return '虚拟卡券'; return t||'-'; }
function specLabel(s?: string){ if(s==='SINGLE') return '单规格'; if(s==='MULTI') return '多规格'; return s||'-'; }
function fmtTime(val?: string){ try{ if(!val) return '-'; const d = new Date(val); const p=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }catch{return '-';} }

async function toggleEnabled(row:any){ try{ await storeProductControllerUpdate(Number(row.id), { enabled: !row.enabled } as any); ElMessage.success(!row.enabled?'已上架':'已下架'); await fetchList(); }catch(e:any){ ElMessage.error(e?.message||'操作失败'); } }
async function fetchCategories(){ const res:any = await storeCategoryControllerList({} as any); categories.value = Array.isArray(res) ? res : []; }

const show = ref(false);
const formTab = ref<'base'|'extra'|'desc'>('base');
const form = ref<any>({ id: 0, type: 'SERVICE', name: '', barcode: '', categoryId: undefined, enabled: true, sortWeight: 0, sellPoint: '', specType: 'SINGLE', price: 0, listPrice: 0, stockQuantity: 0, couponId: undefined, description: '', skus: [], pointsDeductible: false, memberDiscount: false, initialSales: 0, isCarWash: false, shipAllowExpress: true, shipAllowPickup: true });
const formImages = ref<string[]>([]);
// 多规格：规格项定义与输入草稿
const specItems = ref<Array<{ name: string; values: string[] }>>([]);
const specValueDraft = ref('');
const pickerVisible = ref(false);
const pickerForDesc = ref(false);
const skuPickerRow = ref<any|null>(null);

function openCreate(){ form.value = { id: 0, type: 'SERVICE', name: '', barcode: '', categoryId: undefined, enabled: true, sortWeight: 0, sellPoint: '', specType: 'SINGLE', price: 0, listPrice: 0, stockQuantity: 0, couponId: undefined, description: '', skus: [], pointsDeductible: false, memberDiscount: false, initialSales: 0, isCarWash: false, shipAllowExpress: true, shipAllowPickup: true }; formImages.value = []; specItems.value = []; formTab.value = 'base'; show.value = true; }
const couponOptions = ref<any[]>([]);
async function fetchCoupons(){
	const res: any = await couponControllerList({ type: 'WASH_CARD' } as any);
	couponOptions.value = Array.isArray(res) ? res : [];
}
function openEdit(row:any){
	form.value = JSON.parse(JSON.stringify(row));
	if (!Array.isArray(form.value.skus)) form.value.skus = [];
	// 默认勾选（兼容老数据）
	if (form.value.shipAllowExpress===undefined) form.value.shipAllowExpress = true;
	if (form.value.shipAllowPickup===undefined) form.value.shipAllowPickup = true;
	const imgs = Array.isArray((row as any).imagesJson) ? (row as any).imagesJson : [];
	formImages.value = imgs.length ? imgs.slice() : (row.imageUrl ? [row.imageUrl] : []);
	// 规格项定义（后端字段：specsDefinitionJson）
	const defs = Array.isArray((row as any).specsDefinitionJson) ? (row as any).specsDefinitionJson : [];
	specItems.value = defs.map((d:any)=>({ name: String(d?.name||''), values: Array.isArray(d?.values) ? d.values.map((v:any)=>String(v)) : [] }));
	formTab.value = 'base';
	show.value = true;
}

function addSku(){ form.value.skus.push({ name: '', skuCode: '', price: 0, listPrice: 0, stockQuantity: 0, couponId: undefined }); }
function removeSku(i:number){ form.value.skus.splice(i,1); }

async function save(){
	if (!form.value.name) { ElMessage.error('请输入名称'); return; }
	if (form.value.specType==='MULTI' && (!form.value.skus || form.value.skus.length===0)) { ElMessage.error('请添加至少一个SKU'); return; }
	if (form.value.specType==='MULTI'){
		// 前置校验：skuCode 唯一与必填
		const codes = (form.value.skus||[]).map((s:any)=>String(s.skuCode||'').trim());
		if (codes.some((c: string)=>!c)) { ElMessage.error('请填写每个 SKU 的编码'); return; }
		const dup = codes.find((c:string, i:number)=> codes.indexOf(c)!==i); if (dup){ ElMessage.error(`SKU 编码重复：${dup}`); return; }
	}
	// 处理商品介绍中的 base64 图片：上传为文件URL并替换
	if (typeof form.value.description === 'string' && form.value.description.includes('src="data:')) {
		try { form.value.description = await processDescHtmlReplaceDataImages(form.value.description); } catch {}
	}
	// 主图保存为 imageUrl
	form.value.imageUrl = formImages.value[0] || '';
    form.value.imagesJson = formImages.value.slice();
	// 保存规格项定义
	if (form.value.specType==='MULTI') {
		form.value.specsDefinitionJson = specItems.value.filter(s=>s.name && s.values && s.values.length>0).map(s=>({ name: s.name.trim(), values: s.values.map(v=>String(v).trim()).filter(Boolean) }));
	} else {
		form.value.specsDefinitionJson = null;
	}
	// 服务商品不参与库存：确保提交时库存为0
	if (form.value.type==='SERVICE'){
		if (form.value.specType==='SINGLE') form.value.stockQuantity = 0;
		else if (Array.isArray(form.value.skus)) for(const s of form.value.skus){ s.stockQuantity = 0; }
	}
	if (form.value.id) await storeProductControllerUpdate(Number(form.value.id), form.value as any);
	else await storeProductControllerCreate(form.value as any);
	show.value = false; ElMessage.success('已保存'); await fetchList();
}

async function remove(id:number){ await storeProductControllerRemove(Number(id)); ElMessage.success('已删除'); await fetchList(); }

// 上传图片
const showUpload = ref(false);
const currentProductId = ref<number | null>(null);
const uploadUrl = ref('');
function openUpload(row:any){ currentProductId.value = row.id; uploadUrl.value=''; showUpload.value = true; }
async function onFileChange(e:any){
	const file = e.target.files?.[0]; if (!file) return;
	const fd = new FormData(); 
	fd.append('file', file);
	fd.append('source', 'product-main');  // 自动识别为商品主图
	const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
	const j = await res.json(); uploadUrl.value = j?.url || '';
}
async function applyImage(){
	if (!currentProductId.value || !uploadUrl.value) return;
	await storeProductControllerUpdate(Number(currentProductId.value), { imageUrl: uploadUrl.value } as any);
	ElMessage.success('已更新图片'); showUpload.value = false; await fetchList();
}

onMounted(async ()=>{ await Promise.all([fetchCategories(), fetchList(), fetchCoupons()]); });

async function initQuill(){
	if (!quillRef.value || quillInstance) return;
	quillInstance = new Quill(quillRef.value, {
		modules: {
			toolbar: {
				container: [[{ header: [1,2,3,false] }], ['bold','italic','underline','strike'], [{ list: 'ordered' }, { list: 'bullet' }], ['link','image'], ['clean']],
				handlers: {
					image: async function(){
						try{
							const input = document.createElement('input');
							input.type = 'file';
							input.accept = 'image/*';
							input.onchange = async () => {
								const file = input.files && input.files[0]; if (!file) return;
								const fd = new FormData(); 
								fd.append('file', file); 
								fd.append('dir', 'public');
								fd.append('source', 'product-desc');  // 自动识别为商品详情图片
								const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
								const j = await res.json(); const url = j?.url ? (j.url.startsWith('http')? j.url : absUrl(j.url)) : '';
								if (url) {
									const range = quillInstance.getSelection(true);
									quillInstance.insertEmbed(range ? range.index : 0, 'image', url, 'user');
								}
							};
							input.click();
						}catch{}
					}
				}
			}
		},
		theme: 'snow'
	});
	// 粘贴与拖拽图片：拦截 dataURL，上传为 URL 并插入
	try {
		const root = quillInstance.root as HTMLElement;
		root.addEventListener('paste', async (e: any) => {
			try{
				const items: DataTransferItemList | undefined = e?.clipboardData?.items;
				if (!items) return;
				const files: File[] = [];
				for (let i=0;i<items.length;i++){ const it = items[i]; if (it && it.kind==='file' && /^image\//i.test(it.type)) { const f = it.getAsFile(); if (f) files.push(f); } }
				if (!files.length) return;
				e.preventDefault();
				const range = quillInstance.getSelection(true);
				for (const file of files){
					const url = await uploadImageFile(file, 'product-desc');
					if (url) quillInstance.insertEmbed(range ? range.index : 0, 'image', url, 'user');
				}
			}catch{}
		});
		root.addEventListener('drop', async (e: any) => {
			try{
			const fileList = (e?.dataTransfer?.files as FileList | null);
			const files: File[] = fileList ? Array.from(fileList) : [];
			const imageFiles: File[] = files.filter((f: File)=>/^image\//i.test(f.type));
			if (!imageFiles.length) return;
				e.preventDefault();
				const range = quillInstance.getSelection(true);
			for (const file of imageFiles){
					const url = await uploadImageFile(file, 'product-desc');
					if (url) quillInstance.insertEmbed(range ? range.index : 0, 'image', url, 'user');
				}
			}catch{}
		});
		// 兜底：当富文本里出现 data:image 的 <img>，延迟扫描并替换
		setTimeout(async ()=>{
			try{
				const html = quillInstance.root.innerHTML || '';
				if (html.includes('src="data:')){
					const replaced = await processDescHtmlReplaceDataImages(html);
					if (replaced && replaced !== html) {
						quillInstance.clipboard.dangerouslyPasteHTML(replaced);
					}
				}
			}catch{}
		}, 0);
	}catch{}
	try { quillInstance.clipboard.dangerouslyPasteHTML(form.value.description || ''); } catch {}
	quillInstance.on('text-change', ()=>{ try { form.value.description = quillInstance.root.innerHTML || ''; } catch {} });
}

watch([show, formTab], async ([s, tab])=>{
	if (!s) return;
	if (tab !== 'desc') return;
	await nextTick();
	if (!quillInstance) {
		const existing = (quillRef.value as any)?.__quill || (quillRef.value as any)?.quill;
		if (existing) { quillInstance = existing; }
		else { await initQuill(); }
	}
	try { if (quillInstance) quillInstance.clipboard.dangerouslyPasteHTML(form.value.description || ''); } catch {}
});

onBeforeUnmount(()=>{ quillInstance = null; });

// 上传图片工具：返回绝对URL
async function uploadImageFile(file: File, source: string): Promise<string>{
	try{
		const fd = new FormData();
		fd.append('file', file);
		fd.append('dir', 'public');
		fd.append('source', source);
		const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
		const j = await res.json(); const url = j?.url ? (j.url.startsWith('http')? j.url : absUrl(j.url)) : '';
		return url || '';
	}catch{ return ''; }
}

// 将 HTML 内的 data:image base64 图片提取上传并替换为 URL
async function processDescHtmlReplaceDataImages(html: string): Promise<string>{
	try{
		const imgs = Array.from(html.matchAll(/<img\b[^>]*src=["'](data:[^"']+)["'][^>]*>/gi));
		if (!imgs.length) return html;
		let out = html;
		for (const m of imgs){
			const dataUrl = m[1];
			if (!/^data:image\//i.test(dataUrl)) continue;
			const blob = dataURLToBlob(dataUrl);
			if (!blob) continue;
			const file = new File([blob], `image_${Date.now()}.png`, { type: blob.type || 'image/png' });
			const url = await uploadImageFile(file, 'product-desc');
			if (url) {
				out = out.replace(dataUrl, url);
			}
		}
		return out;
	}catch{ return html; }
}

function dataURLToBlob(dataUrl: string): Blob | null {
	try{
		const arr = dataUrl.split(','); if (arr.length < 2) return null;
		const mimeMatch = arr[0].match(/data:([^;]+);/i); const mime = mimeMatch ? mimeMatch[1] : 'image/png';
		const bstr = atob(arr[1]);
		let n = bstr.length; const u8arr = new Uint8Array(n);
		while(n--){ u8arr[n] = bstr.charCodeAt(n); }
		return new Blob([u8arr], { type: mime });
	}catch{ return null; }
}

// 表单内多图上传
async function onImagesChange(e:any){
	const fileList = (e?.target as HTMLInputElement)?.files as FileList | null;
	const files: File[] = fileList ? Array.from(fileList) : [];
	for (const file of files){
		const fd = new FormData(); 
		fd.append('file', file); 
		fd.append('dir', 'public');
		fd.append('source', 'product-gallery');  // 自动识别为商品多图
		const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
		const j = await res.json(); if (j?.url) formImages.value.push(j.url);
	}
	try { e.target.value = ''; } catch {}
}
function removeImage(i:number){ formImages.value.splice(i,1); }
function onPicked(list:any[]){
	const urls = (list||[]).map(x=>x?.url).filter(Boolean);
	if (pickerForDesc.value && urls.length && quillInstance) {
		try { const range = quillInstance.getSelection(true); for(const u of urls){ quillInstance.insertEmbed(range ? range.index : 0, 'image', abs(u), 'user'); } } catch {}
	} else if (skuPickerRow.value && urls.length) {
		skuPickerRow.value.imageUrl = urls[0];
		skuPickerRow.value = null;
	} else {
		for(const u of urls){ if(!formImages.value.includes(u)) formImages.value.push(u); }
	}
}
function openInsertFromLib(){ pickerForDesc.value = true; pickerVisible.value = true; }
function openSkuPicker(row:any){ skuPickerRow.value = row; pickerForDesc.value = false; pickerVisible.value = true; }

// 多规格：规格项编辑与组合生成
function addSpecItem(){ specItems.value.push({ name: '', values: [] }); }
function removeSpecItem(i:number){ specItems.value.splice(i,1); }
function confirmAddSpecValue(specIndex:number){ const v = specValueDraft.value.trim(); if (!v) return; const arr = specItems.value[specIndex]?.values; if (arr && !arr.includes(v)) arr.push(v); specValueDraft.value=''; }
function removeSpecValue(specIndex:number, valIndex:number){ const arr = specItems.value[specIndex]?.values; if (!arr) return; arr.splice(valIndex,1); }
function generateSkuMatrix(){
	const defs = specItems.value.filter(s=>s.name && s.values && s.values.length>0);
	if (defs.length===0) { ElMessage.error('请先添加至少一个规格项与其值'); return; }
	// 生成笛卡尔积
	let combos: any[] = [{}];
	for (const def of defs){
		const next: any[] = [];
		for (const c of combos){
			for (const val of def.values){ next.push({ ...c, [def.name]: val }); }
		}
		combos = next;
	}
	// 写入 SKUs（保留同名/同组合的已有价格等）
	const existed = Array.isArray(form.value.skus)? form.value.skus : [];
	const toKey = (m:any)=> Object.keys(m).sort().map(k=>`${k}:${m[k]}`).join('|');
	const existedByKey = new Map<string, any>();
	for (const s of existed){ const key = toKey(Object.fromEntries((Array.isArray(s.specsJson)? s.specsJson:[]).map((p:any)=>[String(p.name||''), String(p.value||'')]))); if (key) existedByKey.set(key, s); }
	const newSkus:any[] = [];
	for (const m of combos){
		const specsJson = Object.keys(m).map(name=>({ name, value: m[name] }));
		const key = toKey(m);
		const old = existedByKey.get(key);
		newSkus.push({
			id: old?.id,
			name: Object.values(m).join('/'),
			specsJson,
			skuCode: old?.skuCode || '',
			barcode: old?.barcode || '',
			imageUrl: old?.imageUrl || '',
			price: old?.price ?? 0,
			listPrice: old?.listPrice ?? 0,
			stockQuantity: old?.stockQuantity ?? 0,
			enabled: typeof old?.enabled==='boolean' ? old.enabled : true,
		});
	}
	form.value.skus = newSkus;
}

// SKU 图片上传（单元格内）
async function onSkuUpload(row:any, options:any){
	const file = options?.file as File; if (!file) return;
	const fd = new FormData(); 
	fd.append('file', file); 
	fd.append('dir', 'public');
	fd.append('source', 'product-sku');  // 自动识别为商品规格图片
	const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
	const j = await res.json(); if (j?.url) row.imageUrl = j.url;
}

// 条码处理：仅数字且最多13位；提供随机13位生成
function onBarcodeInput(){ const val = String(form.value.barcode||''); const digits = val.replace(/\D+/g, '').slice(0,13); if (digits !== val) form.value.barcode = digits; }
function genBarcode(){ let s=''; for(let i=0;i<13;i++){ s += Math.floor(Math.random()*10); } form.value.barcode = s; }

// 随机生成：SKU/条码（SKU 列表内）
function randomSkuCode(len:number = 8){
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = '';
	for(let i=0;i<len;i++){ s += chars[Math.floor(Math.random()*chars.length)]; }
	return s;
}
function randomDigits(n:number){ let s=''; for(let i=0;i<n;i++){ s += Math.floor(Math.random()*10); } return s; }
function ensureUniqueInSkus(field: 'skuCode'|'barcode', candidate: string){
	const exists = new Set<string>((form.value.skus||[]).map((r:any)=> String(r?.[field]||'').trim()).filter(Boolean));
	if (!exists.has(candidate)) return candidate;
	for(let i=0;i<50;i++){
		const next = field==='skuCode' ? (candidate + randomSkuCode(2)) : (candidate.slice(0,11) + randomDigits(2));
		if (!exists.has(next)) return next;
	}
	return candidate + '_' + randomSkuCode(3);
}
function genRowSku(row:any){ const code = ensureUniqueInSkus('skuCode', randomSkuCode(8)); row.skuCode = code; }
function genRowBarcode(row:any){ const code = ensureUniqueInSkus('barcode', randomDigits(13)); row.barcode = code; }
function batchGenSkuIfEmpty(){ for(const r of (form.value.skus||[])){ if(!String(r.skuCode||'').trim()) genRowSku(r); } ElMessage.success('已为空缺项生成 SKU 编码'); }
function batchGenBarcodeIfEmpty(){ for(const r of (form.value.skus||[])){ if(!String(r.barcode||'').trim()) genRowBarcode(r); } ElMessage.success('已为空缺项生成条码'); }

</script>

<style scoped>
.nowrap{ white-space:nowrap; }
.muted{ color: var(--el-text-color-secondary); font-size:12px; margin-left:4px; }
.wc-table-scroll{ overflow:auto; width:100%; }

.product-thumb{
	width:56px;
	height:56px;
	object-fit:cover;
	border-radius:10px;
	border:1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
}

.inline-row{
	display:flex;
	gap:8px;
	align-items:center;
	width:100%;
}
.inline-row--loose{ gap:12px; }

.images-field{ width:100%; }
.images-grid{
	display:flex;
	flex-wrap:wrap;
	gap:8px;
}
.image-card{
	position:relative;
	width:88px;
	height:88px;
	border-radius:12px;
	overflow:hidden;
	border:1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
	box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.image-card__img{
	width:100%;
	height:100%;
	object-fit:cover;
}
.image-card__badge{
	position:absolute;
	left:0;
	top:0;
	background: var(--app-primary);
	color:#fff;
	font-size:12px;
	padding:2px 6px;
	border-bottom-right-radius:10px;
}
.image-card__remove{
	position:absolute;
	right:6px;
	top:6px;
	background: rgba(0,0,0,0.58);
	color:#fff;
	border-radius:9999px;
	width:20px;
	height:20px;
	display:flex;
	align-items:center;
	justify-content:center;
	cursor:pointer;
	user-select:none;
	line-height:1;
}
.images-actions{
	margin-top:8px;
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap:10px;
	flex-wrap:wrap;
}
.images-actions__left{
	display:flex;
	gap:8px;
	align-items:center;
	flex-wrap:wrap;
}

.file-input{ max-width: 260px; }
/* 美化原生文件选择按钮（不改功能） */
.file-input::file-selector-button{
	margin-right:10px;
	border:1px solid var(--el-border-color);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 35%);
	color: var(--el-text-color-primary);
	padding:6px 10px;
	border-radius:10px;
	cursor:pointer;
	transition: background .15s ease, border-color .15s ease;
}
.file-input:hover::file-selector-button{
	background: var(--el-fill-color-light);
	border-color: var(--el-border-color);
}

.form-tip{
	color:#909399;
	margin-left:100px;
	margin-top:-4px;
	margin-bottom:8px;
}

.spec-panel{
	padding:10px 12px;
	background: var(--el-fill-color-lighter);
	border:1px dashed var(--el-border-color);
	border-radius:12px;
}
.spec-head{
	margin-bottom:10px;
	display:flex;
	justify-content:space-between;
	align-items:center;
}
.spec-item{
	margin-bottom:10px;
	padding:10px;
	background: var(--el-bg-color);
	border:1px solid var(--el-border-color-lighter);
	border-radius:10px;
}
.spec-item__row{
	display:flex;
	align-items:center;
	gap:8px;
	margin-bottom:8px;
	flex-wrap:wrap;
}
.spec-item__values{
	display:flex;
	flex-wrap:wrap;
	gap:8px;
	align-items:center;
}
.spec-actions{
	margin:10px 0;
	display:flex;
	gap:10px;
	align-items:center;
	flex-wrap:wrap;
}
.sku-head{
	margin-bottom:10px;
	display:flex;
	justify-content:space-between;
	align-items:center;
	gap:8px;
	flex-wrap:wrap;
}
.sku-head__actions{
	display:flex;
	gap:8px;
	align-items:center;
	flex-wrap:wrap;
}
.wc-table-wrap--inner{
	border-radius:12px;
}
.sku-image-cell{
	display:flex;
	align-items:center;
	gap:8px;
	flex-wrap:wrap;
}
.sku-thumb{
	width:36px;
	height:36px;
	object-fit:cover;
	border-radius:10px;
	border:1px solid var(--el-border-color-lighter);
	background: var(--el-fill-color-lighter);
}
.sku-number--price{ width:140px; }
.sku-number--stock{ width:120px; }

.desc-head{
	margin-bottom:8px;
	color:#666;
	display:flex;
	justify-content:space-between;
	align-items:center;
	gap:10px;
}

.upload-panel{
	display:flex;
	align-items:center;
	gap:10px;
	flex-wrap:wrap;
}

/* Quill 暗色适配（Quill DOM 由运行时注入，需用 :deep） */
.quill-host{
	height: 360px;
	border-radius: 10px;
	overflow: hidden;
	border: 1px solid var(--el-border-color);
	background: var(--el-bg-color);
}
:deep(.quill-host .ql-toolbar.ql-snow){
	border: none;
	border-bottom: 1px solid var(--el-border-color);
	background: color-mix(in oklab, var(--el-bg-color), var(--el-fill-color-light) 40%);
}
:deep(.quill-host .ql-container.ql-snow){
	border: none;
	background: var(--el-bg-color);
	color: var(--el-text-color-primary);
}
:deep(.quill-host .ql-editor){
	min-height: 300px;
	color: var(--el-text-color-primary);
}
:deep(.quill-host .ql-editor.ql-blank::before){
	color: var(--el-text-color-placeholder);
}
:deep(.quill-host .ql-snow .ql-stroke){
	stroke: var(--el-text-color-regular);
}
:deep(.quill-host .ql-snow .ql-fill){
	fill: var(--el-text-color-regular);
}
:deep(.quill-host .ql-snow .ql-picker){
	color: var(--el-text-color-regular);
}
:deep(.quill-host .ql-snow .ql-picker-options){
	background: var(--el-bg-color-overlay);
	border: 1px solid var(--el-border-color);
}
:deep(.quill-host .ql-snow .ql-tooltip){
	background: var(--el-bg-color-overlay);
	border: 1px solid var(--el-border-color);
	color: var(--el-text-color-primary);
}
</style>


