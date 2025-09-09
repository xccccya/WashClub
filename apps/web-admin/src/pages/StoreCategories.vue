<template>
	<div>
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<div style="margin:12px 0;">
			<el-button type="primary" @click="openCreate">
				<el-icon style="vertical-align: middle; margin-right:4px;"><CirclePlus /></el-icon>
				<span style="vertical-align: middle;">新增分类</span>
			</el-button>
		</div>
		<el-table :data="list" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="name" label="名称" />
			<el-table-column prop="enabled" label="启用" width="80">
				<template #default="{ row }"> <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag> </template>
			</el-table-column>
			<el-table-column prop="weight" label="排序" width="100" />
			<el-table-column label="操作" width="200">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">
						<el-icon><Edit /></el-icon>
						<span>编辑</span>
					</el-button>
					<el-popconfirm title="确认删除？" @confirm="remove(row.id)">
						<template #reference>
							<el-button size="small" type="danger">
								<el-icon><Delete /></el-icon>
								<span>删除</span>
							</el-button>
						</template>
					</el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="show" :title="form.id ? '编辑分类' : '新增分类'" width="520px">
			<el-form label-width="80">
				<el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
				<el-form-item label="排序"><el-input-number v-model="form.weight" :min="0" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="show=false">取消</el-button>
				<el-button type="primary" @click="save">保存</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import { CirclePlus, Edit, Delete } from '@element-plus/icons-vue';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const list = ref<any[]>([]);

async function fetchList(){ list.value = await http('/store/categories'); }

const show = ref(false);
const form = ref<any>({ id: 0, name: '', enabled: true, weight: 0 });

function openCreate(){ form.value = { id: 0, name: '', enabled: true, weight: 0 }; show.value = true; }
function openEdit(row:any){ form.value = { id: row.id, name: row.name, enabled: row.enabled, weight: row.weight }; show.value = true; }

async function save(){
	try{
		if (!form.value.name) { ElMessage.error('请输入名称'); return; }
		if (form.value.id) await http(`/store/categories/${form.value.id}`, { method:'PUT', body: { name: form.value.name, enabled: form.value.enabled, weight: form.value.weight } });
		else await http('/store/categories', { method:'POST', body: { name: form.value.name, enabled: form.value.enabled, weight: form.value.weight } });
		show.value = false; ElMessage.success('已保存'); await fetchList();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function remove(id:number){ try { await http(`/store/categories/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

onMounted(fetchList);
</script>

<style scoped>
</style>


