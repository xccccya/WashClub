<template>
	<BasePage title="滚动通知">
		<template #actions>
			<el-button type="primary" @click="openCreate"><el-icon style="margin-right:4px;"><Bell /></el-icon>新建通知</el-button>
			<el-select v-model="filterType" placeholder="筛选类型" style="width:160px;margin-left:8px;">
				<el-option label="全部" value="" />
				<el-option label="首页通知" value="home" />
				<el-option label="商店通知" value="store" />
			</el-select>
		</template>
		<el-table :data="notices" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="type" label="类型" width="120">
				<template #default="{ row }">{{ row.type==='home' ? '首页' : '商店' }}</template>
			</el-table-column>
			<el-table-column prop="content" label="内容" />
			<el-table-column prop="enabled" label="启用" width="120">
				<template #default="{ row }">
					<el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '未启用' }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="320">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)"><el-icon style="margin-right:4px;"><EditPen /></el-icon>编辑</el-button>
					<el-button size="small" type="primary" @click="enable(row)" :disabled="row.enabled"><el-icon style="margin-right:4px;"><Open /></el-icon>启用该条</el-button>
					<el-button size="small" type="danger" @click="remove(row)"><el-icon style="margin-right:4px;"><Delete /></el-icon>删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑通知' : '新建通知'" width="520px">
			<el-form :model="form" label-width="120px">
				<el-form-item label="类型">
					<el-radio-group v-model="form.type">
						<el-radio label="home">首页</el-radio>
						<el-radio label="store">商店</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="3" /></el-form-item>
				<el-form-item label="立即启用"><el-switch v-model="form.enabled" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" @click="onSave">保存</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { BasePage } from '@wash/shared-ui';
import {
	scrollNoticeControllerCreate,
	scrollNoticeControllerEnable,
	scrollNoticeControllerList,
	scrollNoticeControllerRemove,
	scrollNoticeControllerUpdate,
} from '@wash/api-client';
import { ElMessage } from 'element-plus';

type Notice = { id: number; type: 'home' | 'store'; content: string; enabled: boolean };
const filterType = ref('');
const notices = ref<Notice[]>([]);
const dialogVisible = ref(false);
const current = ref<Notice | null>(null);
const form = ref<{ id?: number; type: 'home' | 'store'; content: string; enabled: boolean }>({ type: 'home', content: '', enabled: false });

async function fetchList(){
	const query: any = {};
	if (filterType.value) query.type = filterType.value;
	// 注意：目前 openapi.json 未完整描述返回体类型，orval 会生成 data:void；这里按实际后端返回（数组）使用
	notices.value = (await scrollNoticeControllerList(query) as unknown) as Notice[];
}

function openCreate(){ current.value = null; form.value = { type: 'home', content: '', enabled: false }; dialogVisible.value = true; }
function openEdit(row: Notice){ current.value = row; form.value = { id: row.id, type: row.type, content: row.content, enabled: row.enabled }; dialogVisible.value = true; }

async function onSave(){
	try{
		if (current.value?.id) {
			await scrollNoticeControllerUpdate(String(current.value.id), { content: form.value.content, enabled: form.value.enabled } as any);
		} else {
			await scrollNoticeControllerCreate({ type: form.value.type, content: form.value.content, enabled: form.value.enabled } as any);
		}
		dialogVisible.value = false; ElMessage.success('已保存'); fetchList();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function enable(row: Notice){ try { await scrollNoticeControllerEnable(String(row.id)); ElMessage.success('已启用'); fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }
async function remove(row: Notice){ try { await scrollNoticeControllerRemove(String(row.id)); ElMessage.success('已删除'); fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

onMounted(fetchList);
watch(filterType, fetchList);
</script>


