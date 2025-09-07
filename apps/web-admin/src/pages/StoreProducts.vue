<template>
	<div>
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<div class="toolbar">
			<el-input v-model="keyword" placeholder="搜索名称/条码" style="width:220px;margin-right:8px;" @keyup.enter="fetchList" />
			<el-button @click="fetchList">查询</el-button>
			<el-button type="primary" @click="openCreate">新增商品</el-button>
		</div>
		<div class="table-scroll"><el-table :data="list" border stripe size="small" style="min-width: 980px; width: 100%; border-radius:8px;">
			<el-table-column prop="id" label="ID" width="70" />
			<el-table-column label="主图" width="90">
				<template #default="{ row }"><img :src="abs(row.imageUrl)" v-if="row.imageUrl" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #eee;" /></template>
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
		</el-table></div>

		<el-dialog v-model="show" :title="form.id ? '编辑商品' : '新增商品'" width="980px" :destroy-on-close="false">
			<el-tabs v-model="formTab">
				<el-tab-pane label="基础信息" name="base">
					<el-form label-width="100">
						<el-form-item label="类型"><el-select v-model="form.type" :disabled="!!form.id"><el-option label="服务项目" value="SERVICE" /><el-option label="实物商品" value="PHYSICAL" /><el-option label="虚拟卡券" value="VIRTUAL_CARD" /></el-select></el-form-item>
						<el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
						<el-form-item label="条码">
							<div style="display:flex;gap:8px;align-items:center;width:100%;">
								<el-input v-model="form.barcode" maxlength="13" placeholder="仅数字，最多13位" @input="onBarcodeInput" />
								<el-button @click="genBarcode">生成13位</el-button>
							</div>
						</el-form-item>
						<el-form-item label="分类"><el-select v-model="form.categoryId" placeholder="选择分类"><el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" /></el-select></el-form-item>
						<el-form-item label="上架"><el-switch v-model="form.enabled" /></el-form-item>
						<el-form-item label="排序"><el-input-number v-model="form.sortWeight" :min="0" /></el-form-item>
						<el-form-item label="商品图片">
							<div style="width:100%;">
								<div style="display:flex;flex-wrap:wrap;gap:8px;">
									<div v-for="(img,i) in formImages" :key="img" style="position:relative;width:88px;height:88px;border-radius:8px;overflow:hidden;border:1px solid #eee;">
										<img :src="abs(img)" style="width:100%;height:100%;object-fit:cover;" />
										<div v-if="i===0" style="position:absolute;left:0;top:0;background:var(--app-primary);color:#fff;font-size:12px;padding:2px 4px;border-bottom-right-radius:6px;">主图</div>
										<div @click="removeImage(i)" style="position:absolute;right:2px;top:2px;background:rgba(0,0,0,0.6);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;">×</div>
									</div>
								</div>
								<div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
									<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
										<input type="file" multiple @change="onImagesChange" />
										<el-button size="small" @click="pickerVisible=true">从文件库选择</el-button>
									</div>
									<small>可添加多张图片，首张作为主图保存</small>
								</div>
							</div>
						</el-form-item>
					</el-form>
				</el-tab-pane>
				<el-tab-pane label="扩展信息" name="extra">
					<el-form label-width="100">
						<el-form-item label="规格类型"><el-select v-model="form.specType"><el-option label="单规格" value="SINGLE" /><el-option label="多规格" value="MULTI" /></el-select></el-form-item>
						<div v-if="form.type==='SERVICE'" style="margin:-4px 0 8px 100px;color:#909399;">提示：服务商品不参与库存统计，库存项将自动隐藏。</div>
						<template v-if="form.specType==='SINGLE'">
							<el-form-item label="价格"><el-input-number v-model="form.price" :min="0" :step="0.1" /></el-form-item>
							<el-form-item label="划线价"><el-input-number v-model="form.listPrice" :min="0" :step="0.1" /></el-form-item>
							<el-form-item v-if="form.type!=='SERVICE'" label="库存"><el-input-number v-model="form.stockQuantity" :min="0" /></el-form-item>
							<el-form-item v-if="form.type==='VIRTUAL_CARD'" label="绑定卡券"><el-select v-model="form.couponId" placeholder="选择卡券"><el-option v-for="c in couponOptions" :key="c.id" :label="c.name" :value="c.id" /></el-select></el-form-item>
						</template>
						<template v-else>
							<div style="padding:8px 12px;background:#fafafa;border:1px dashed #ddd;border-radius:8px;">
								<div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;"><b>规格项定义</b><el-button size="small" @click="addSpecItem">新增规格项</el-button></div>
								<div v-for="(sp,i) in specItems" :key="i" style="margin-bottom:8px;padding:8px;background:#fff;border:1px solid #eee;border-radius:6px;">
									<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
										<el-input v-model="sp.name" placeholder="规格名，如 颜色/尺码" style="width:200px;" />
										<el-button size="small" type="danger" @click="removeSpecItem(i)">删除规格</el-button>
									</div>
									<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
										<el-tag v-for="(val,vi) in sp.values" :key="vi" closable @close="removeSpecValue(i,vi)">{{ val }}</el-tag>
										<el-input v-model="specValueDraft" placeholder="输入规格值并回车" style="width:180px;" @keyup.enter="confirmAddSpecValue(i)" />
									</div>
								</div>
								<div style="margin:8px 0;display:flex;gap:8px;align-items:center;"><el-button size="small" type="primary" @click="generateSkuMatrix"><el-icon style="margin-right:4px;"><Grid /></el-icon>生成规格组合</el-button><small>将覆盖当前 SKU 列表</small></div>
								<div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
									<b>SKU 列表</b>
									<div style="display:flex;gap:8px;align-items:center;">
										<el-button @click="addSku" size="small"><el-icon style="margin-right:4px;"><CirclePlus /></el-icon>新增SKU</el-button>
										<el-button @click="batchGenSkuIfEmpty" size="small"><el-icon style="margin-right:4px;"><Promotion /></el-icon>为空项生成SKU编码</el-button>
										<el-button @click="batchGenBarcodeIfEmpty" size="small"><el-icon style="margin-right:4px;"><Ticket /></el-icon>为空项生成条码</el-button>
									</div>
								</div>
								<el-table :data="form.skus" size="small" border :fit="false" style="width:100%;">
									<el-table-column label="名称"><template #default="{ row }"><el-input v-model="row.name" placeholder="规格名称" /></template></el-table-column>
									<el-table-column label="SKU编码" width="220">
										<template #default="{ row }">
											<div style="display:flex;gap:6px;align-items:center;">
												<el-input v-model="row.skuCode" placeholder="自动/手填" />
												<el-button size="small" @click="genRowSku(row)">生成</el-button>
											</div>
										</template>
									</el-table-column>
									<el-table-column label="条码" width="220">
										<template #default="{ row }">
											<div style="display:flex;gap:6px;align-items:center;">
												<el-input v-model="row.barcode" placeholder="13位数字" />
												<el-button size="small" @click="genRowBarcode(row)">生成</el-button>
											</div>
										</template>
									</el-table-column>
									<el-table-column label="图片" width="160">
										<template #default="{ row }">
											<div style="display:flex;align-items:center;gap:8px;">
												<img v-if="row.imageUrl" :src="abs(row.imageUrl)" style="width:36px;height:36px;object-fit:cover;border-radius:6px;" />
												<el-upload :http-request="(o:any)=>onSkuUpload(row,o)" :show-file-list="false"><el-button size="small">上传</el-button></el-upload>
												<el-button size="small" @click="openSkuPicker(row)">从文件库选择</el-button>
											</div>
										</template>
									</el-table-column>
									<el-table-column label="价格" width="180"><template #default="{ row }"><el-input-number v-model="row.price" :min="0" :step="0.1" controls-position="right" style="width:140px;" /></template></el-table-column>
									<el-table-column label="划线价" width="180"><template #default="{ row }"><el-input-number v-model="row.listPrice" :min="0" :step="0.1" controls-position="right" style="width:140px;" /></template></el-table-column>
									<el-table-column v-if="form.type!=='SERVICE'" label="库存" width="160"><template #default="{ row }"><el-input-number v-model="row.stockQuantity" :min="0" controls-position="right" style="width:120px;" /></template></el-table-column>
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
						</template>
						<el-form-item label="积分抵扣"><el-switch v-model="form.pointsDeductible" /></el-form-item>
						<el-form-item label="会员折扣"><el-switch v-model="form.memberDiscount" /></el-form-item>
						<el-form-item label="初始销量"><el-input-number v-model="form.initialSales" :min="0" /></el-form-item>
						<el-form-item label="卖点"><el-input v-model="form.sellPoint" placeholder="十字以内高亮卖点" /></el-form-item>
					</el-form>
				</el-tab-pane>
				<el-tab-pane label="商品介绍" name="desc">
					<div style="margin-bottom:8px; color:#666; display:flex; justify-content:space-between; align-items:center;">
						<span>支持图片粘贴上传、基础排版与列表。</span>
						<el-button size="small" @click="openInsertFromLib">从文件库插入图片</el-button>
					</div>
					<div ref="quillRef" style="height:360px;background:#fff;"></div>
				</el-tab-pane>
			</el-tabs>
			<template #footer>
				<el-button @click="show=false">取消</el-button>
				<el-button type="primary" @click="save">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="showUpload" title="上传商品图片" width="520px">
			<input type="file" @change="onFileChange" />
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
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import FilePickerDialog from './_components/FilePickerDialog.vue';
import { ElMessage } from 'element-plus';
import { Grid, CirclePlus, Promotion, Ticket } from '@element-plus/icons-vue';

// 兼容：将 Quill 暴露到全局，供 @vueup/vue-quill 内部使用
try { if (typeof window !== 'undefined' && !(window as any).Quill) { (window as any).Quill = Quill; } } catch {}

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
function abs(u?: string){ return absUrl(u || ''); }
const list = ref<any[]>([]);
const categories = ref<any[]>([]);
const keyword = ref('');
const quillRef = ref<HTMLDivElement|null>(null);
let quillInstance: any = null;

async function fetchList(){ list.value = await http('/store/products', { query: { keyword: keyword.value } }); }
function typeLabel(t?: string){ if(t==='SERVICE') return '服务项目'; if(t==='PHYSICAL') return '实物商品'; if(t==='VIRTUAL_CARD') return '虚拟卡券'; return t||'-'; }
function specLabel(s?: string){ if(s==='SINGLE') return '单规格'; if(s==='MULTI') return '多规格'; return s||'-'; }
function fmtTime(val?: string){ try{ if(!val) return '-'; const d = new Date(val); const p=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }catch{return '-';} }

async function toggleEnabled(row:any){ try{ await http(`/store/products/${row.id}`, { method:'PUT', body:{ enabled: !row.enabled } }); ElMessage.success(!row.enabled?'已上架':'已下架'); await fetchList(); }catch(e:any){ ElMessage.error(e?.message||'操作失败'); } }
async function fetchCategories(){ categories.value = await http('/store/categories'); }

const show = ref(false);
const formTab = ref<'base'|'extra'|'desc'>('base');
const form = ref<any>({ id: 0, type: 'SERVICE', name: '', barcode: '', categoryId: undefined, enabled: true, sortWeight: 0, sellPoint: '', specType: 'SINGLE', price: 0, listPrice: 0, stockQuantity: 0, couponId: undefined, description: '', skus: [], pointsDeductible: false, memberDiscount: false, initialSales: 0 });
const formImages = ref<string[]>([]);
// 多规格：规格项定义与输入草稿
const specItems = ref<Array<{ name: string; values: string[] }>>([]);
const specValueDraft = ref('');
const pickerVisible = ref(false);
const pickerForDesc = ref(false);
const skuPickerRow = ref<any|null>(null);

function openCreate(){ form.value = { id: 0, type: 'SERVICE', name: '', barcode: '', categoryId: undefined, enabled: true, sortWeight: 0, sellPoint: '', specType: 'SINGLE', price: 0, listPrice: 0, stockQuantity: 0, couponId: undefined, description: '', skus: [], pointsDeductible: false, memberDiscount: false, initialSales: 0 }; formImages.value = []; specItems.value = []; formTab.value = 'base'; show.value = true; }
const couponOptions = ref<any[]>([]);
async function fetchCoupons(){ couponOptions.value = await http('/coupons', { query: { type: 'WASH_CARD' } }); }
function openEdit(row:any){
	form.value = JSON.parse(JSON.stringify(row));
	if (!Array.isArray(form.value.skus)) form.value.skus = [];
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
		if (codes.some(c=>!c)) { ElMessage.error('请填写每个 SKU 的编码'); return; }
		const dup = codes.find((c:string, i:number)=> codes.indexOf(c)!==i); if (dup){ ElMessage.error(`SKU 编码重复：${dup}`); return; }
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
	if (form.value.id) await http(`/store/products/${form.value.id}`, { method:'PUT', body: form.value });
	else await http('/store/products', { method:'POST', body: form.value });
	show.value = false; ElMessage.success('已保存'); await fetchList();
}

async function remove(id:number){ await http(`/store/products/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await fetchList(); }

// 上传图片
const showUpload = ref(false);
const currentProductId = ref<number | null>(null);
const uploadUrl = ref('');
function openUpload(row:any){ currentProductId.value = row.id; uploadUrl.value=''; showUpload.value = true; }
async function onFileChange(e:any){
	const file = e.target.files?.[0]; if (!file) return;
	const fd = new FormData(); fd.append('file', file);
	const res = await fetch(`${API_BASE}/file/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
	const j = await res.json(); uploadUrl.value = j?.url || '';
}
async function applyImage(){ if (!currentProductId.value || !uploadUrl.value) return; await http(`/store/products/${currentProductId.value}`, { method:'PUT', body: { imageUrl: uploadUrl.value } }); ElMessage.success('已更新图片'); showUpload.value = false; await fetchList(); }

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
								const fd = new FormData(); fd.append('file', file); fd.append('dir', 'public');
								const res = await fetch(`${API_BASE}/file/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
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

// 表单内多图上传
async function onImagesChange(e:any){
	const files: File[] = Array.from(e.target.files || []);
	for (const file of files){
		const fd = new FormData(); fd.append('file', file); fd.append('dir', 'public');
		const res = await fetch(`${API_BASE}/file/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
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
	const fd = new FormData(); fd.append('file', file); fd.append('dir', 'public');
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
.toolbar{ display:flex; align-items:center; margin:12px 0; flex-wrap: wrap; gap:8px; width:100%; }
.nowrap{ white-space:nowrap; }
.muted{ color:#999; font-size:12px; margin-left:4px; }
.table-scroll{ overflow:auto; width:100%; }
</style>


