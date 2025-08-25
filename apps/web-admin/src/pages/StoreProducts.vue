<template>
	<div>
		<h3>商品列表</h3>
		<div class="toolbar">
			<el-input v-model="keyword" placeholder="搜索名称/条码" style="width:220px;margin-right:8px;" @keyup.enter="fetchList" />
			<el-button @click="fetchList">查询</el-button>
			<el-button type="primary" @click="openCreate">新增商品</el-button>
		</div>
		<el-table :data="list" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column label="图片" width="72">
				<template #default="{ row }"><img :src="row.imageUrl" v-if="row.imageUrl" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" /></template>
			</el-table-column>
			<el-table-column prop="name" label="名称" />
			<el-table-column prop="type" label="类型" width="120" />
			<el-table-column prop="specType" label="规格" width="100" />
			<el-table-column prop="price" label="价格" width="120" />
			<el-table-column prop="enabled" label="上架" width="80">
				<template #default="{ row }"> <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag> </template>
			</el-table-column>
			<el-table-column label="操作" width="260">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-button size="small" @click="openUpload(row)">图片</el-button>
					<el-popconfirm title="确认删除？" @confirm="remove(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="show" :title="form.id ? '编辑商品' : '新增商品'" width="720px">
			<el-form label-width="100">
				<el-form-item label="类型"><el-select v-model="form.type" :disabled="!!form.id"><el-option label="服务项目" value="SERVICE" /><el-option label="实物商品" value="PHYSICAL" /><el-option label="虚拟卡券" value="VIRTUAL_CARD" /></el-select></el-form-item>
				<el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="条码"><el-input v-model="form.barcode" /></el-form-item>
				<el-form-item label="分类"><el-select v-model="form.categoryId" placeholder="选择分类"><el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" /></el-select></el-form-item>
				<el-form-item label="上架"><el-switch v-model="form.enabled" /></el-form-item>
				<el-form-item label="排序"><el-input-number v-model="form.sortWeight" :min="0" /></el-form-item>
				<el-form-item label="卖点"><el-input v-model="form.sellPoint" /></el-form-item>
				<el-form-item label="规格类型"><el-select v-model="form.specType"><el-option label="单规格" value="SINGLE" /><el-option label="多规格" value="MULTI" /></el-select></el-form-item>
				<template v-if="form.specType==='SINGLE'">
					<el-form-item label="价格"><el-input-number v-model="form.price" :min="0" :step="0.1" /></el-form-item>
					<el-form-item label="划线价"><el-input-number v-model="form.listPrice" :min="0" :step="0.1" /></el-form-item>
					<el-form-item v-if="form.type!=='SERVICE'" label="库存"><el-input-number v-model="form.stockQuantity" :min="0" /></el-form-item>
					<el-form-item v-if="form.type==='VIRTUAL_CARD'" label="绑定卡券"><el-select v-model="form.couponId" placeholder="选择卡券"><el-option v-for="c in couponOptions" :key="c.id" :label="c.name" :value="c.id" /></el-select></el-form-item>
				</template>
				<template v-else>
					<div style="padding:8px 12px;background:#fafafa;border:1px dashed #ddd;border-radius:8px;">
						<div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;"><b>SKU 列表</b><el-button @click="addSku" size="small">新增SKU</el-button></div>
						<el-table :data="form.skus" size="small" border>
							<el-table-column label="名称"><template #default="{ row }"><el-input v-model="row.name" placeholder="规格名称" /></template></el-table-column>
							<el-table-column label="SKU编码" width="160"><template #default="{ row }"><el-input v-model="row.skuCode" /></template></el-table-column>
							<el-table-column label="价格" width="140"><template #default="{ row }"><el-input-number v-model="row.price" :min="0" :step="0.1" /></template></el-table-column>
							<el-table-column label="划线价" width="140"><template #default="{ row }"><el-input-number v-model="row.listPrice" :min="0" :step="0.1" /></template></el-table-column>
							<el-table-column label="库存" width="120"><template #default="{ row }"><el-input-number v-model="row.stockQuantity" :min="0" /></template></el-table-column>
							<el-table-column label="操作" width="100"><template #default="{ $index }"><el-button size="small" type="danger" @click="removeSku($index)">删除</el-button></template></el-table-column>
						</el-table>
					</div>
				</template>
				<el-form-item label="商品介绍"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
			</el-form>
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
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const list = ref<any[]>([]);
const categories = ref<any[]>([]);
const keyword = ref('');

async function fetchList(){ list.value = await http('/store/products', { query: { keyword: keyword.value } }); }
async function fetchCategories(){ categories.value = await http('/store/categories'); }

const show = ref(false);
const form = ref<any>({ id: 0, type: 'SERVICE', name: '', barcode: '', categoryId: undefined, enabled: true, sortWeight: 0, sellPoint: '', specType: 'SINGLE', price: 0, listPrice: 0, stockQuantity: 0, couponId: undefined, description: '', skus: [] });

function openCreate(){ form.value = { id: 0, type: 'SERVICE', name: '', barcode: '', categoryId: undefined, enabled: true, sortWeight: 0, sellPoint: '', specType: 'SINGLE', price: 0, listPrice: 0, stockQuantity: 0, couponId: undefined, description: '', skus: [] }; show.value = true; }
const couponOptions = ref<any[]>([]);
async function fetchCoupons(){ couponOptions.value = await http('/coupons', { query: { type: 'WASH_CARD' } }); }
function openEdit(row:any){ form.value = JSON.parse(JSON.stringify(row)); if (!Array.isArray(form.value.skus)) form.value.skus = []; show.value = true; }

function addSku(){ form.value.skus.push({ name: '', skuCode: '', price: 0, listPrice: 0, stockQuantity: 0 }); }
function removeSku(i:number){ form.value.skus.splice(i,1); }

async function save(){
	if (!form.value.name) { ElMessage.error('请输入名称'); return; }
	if (form.value.specType==='MULTI' && (!form.value.skus || form.value.skus.length===0)) { ElMessage.error('请添加至少一个SKU'); return; }
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
	const res = await fetch('http://localhost:3000/file/upload', { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } });
	const j = await res.json(); uploadUrl.value = j?.url || '';
}
async function applyImage(){ if (!currentProductId.value || !uploadUrl.value) return; await http(`/store/products/${currentProductId.value}`, { method:'PUT', body: { imageUrl: uploadUrl.value } }); ElMessage.success('已更新图片'); showUpload.value = false; await fetchList(); }

onMounted(async ()=>{ await Promise.all([fetchCategories(), fetchList(), fetchCoupons()]); });
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
</style>


