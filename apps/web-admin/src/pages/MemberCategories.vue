<template>
	<BasePage title="会员分类">
		<template #actions>
			<el-button type="primary" @click="openCreate">
				<el-icon style="vertical-align: middle; margin-right:4px;"><CirclePlus /></el-icon>
				<span style="vertical-align: middle;">新增分类</span>
			</el-button>
		</template>
		<el-table :data="categories" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="分类名称" />
			<el-table-column prop="weight" label="权重(数字越大越靠前)" width="220" />
			<el-table-column label="操作" width="200" fixed="right">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">
						<el-icon><Edit /></el-icon>
						<span>编辑</span>
					</el-button>
					<el-button size="small" type="danger" @click="remove(row)">
						<el-icon><Delete /></el-icon>
						<span>删除</span>
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑分类' : '新增分类'" width="420px">
			<el-form :model="form" label-width="120px">
				<el-form-item label="分类名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="权重(大=前)"><el-input v-model.number="form.weight" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" @click="onSave">保存</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import {
	memberCategoryControllerCreate,
	memberCategoryControllerList,
	memberCategoryControllerRemove,
	memberCategoryControllerUpdate,
} from '@wash/api-client';
import { ElMessage } from 'element-plus';
import { ElIcon } from 'element-plus';
import { CirclePlus, Edit, Delete } from '@element-plus/icons-vue';

type Category = { id: number; name: string; weight: number };
const categories = ref<Category[]>([]);
const dialogVisible = ref(false);
const current = ref<Category | null>(null);
const form = ref<Partial<Category>>({ name: '', weight: 0 });

async function fetchCategories(){ categories.value = (await memberCategoryControllerList() as any) as Category[]; }

function openCreate(){ current.value = null; form.value = { name: '', weight: 0 }; dialogVisible.value = true; }
function openEdit(row: Category){ current.value = row; form.value = { ...row }; dialogVisible.value = true; }

async function onSave(){
	try{
		const payload:any = { name: String(form.value?.name || '').trim(), weight: Number(form.value?.weight || 0) };
		if (current.value?.id) await memberCategoryControllerUpdate(String(current.value.id), payload);
		else await memberCategoryControllerCreate(payload);
		dialogVisible.value = false; ElMessage.success('已保存'); fetchCategories();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function remove(row: Category){ try { await memberCategoryControllerRemove(String(row.id)); ElMessage.success('已删除'); fetchCategories(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

onMounted(fetchCategories);
</script>



