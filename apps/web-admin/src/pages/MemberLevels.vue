<template>
	<BasePage title="会员等级">
		<template #actions>
			<el-button type="primary" @click="openCreate">
				<el-icon style="vertical-align: middle; margin-right:4px;"><CirclePlus /></el-icon>
				<span style="vertical-align: middle;">新增等级</span>
			</el-button>
			<el-button @click="openGrowthConfig" style="margin-left:8px;">
				<el-icon style="vertical-align: middle; margin-right:4px;"><SetUp /></el-icon>
				<span style="vertical-align: middle;">成长值换算配置</span>
			</el-button>
		</template>
		<el-table :data="levels" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="name" label="等级名称" />
			<el-table-column label="图标" width="80">
				<template #default="{ row }">
					<el-image v-if="row.iconUrl" :src="absUrl(row.iconUrl)" style="width:28px;height:28px;border-radius:4px;" fit="cover" />
					<span v-else style="color:#909399;">-</span>
				</template>
			</el-table-column>
			<el-table-column prop="level" label="等级(数字越大等级越高)" width="180" />
			<el-table-column prop="requiredGrowth" label="升级所需成长值" width="160" />
			<el-table-column label="积分加速倍数" width="140">
				<template #default="{ row }">
					{{ Number(row.pointsMultiplier||1) === 1 ? '不加倍' : `${row.pointsMultiplier}倍` }}
				</template>
			</el-table-column>
			<el-table-column label="支付折扣%" width="120">
				<template #default="{ row }">
					{{ Number(row.payDiscountPercent||0) === 0 ? '无折扣' : `${row.payDiscountPercent}%` }}
				</template>
			</el-table-column>
			<el-table-column prop="description" label="描述" />
			<el-table-column label="默认" width="100">
				<template #default="{ row }">
					<el-tag v-if="row.isDefault" type="success">默认</el-tag>
				</template>
			</el-table-column>
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

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑等级' : '新增等级'" width="560px">
			<el-form :model="form" label-width="140px">
				<el-form-item label="等级名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="等级图标">
					<div style="display:flex;align-items:center;gap:12px;">
						<el-image v-if="form.iconUrl" :src="absUrl(form.iconUrl as any)" style="width:40px;height:40px;border-radius:6px;border:1px solid var(--el-border-color);" fit="cover" />
						<FileInput v-model="(form.iconUrl as any)" placeholder="输入URL或从文件库选择" :showPreview="false" source="member-level" />
						<el-button v-if="form.iconUrl" text type="danger" @click="form.iconUrl=null">移除</el-button>
					</div>
				</el-form-item>
				<el-form-item label="等级(大=高)"><el-input v-model.number="form.level" /></el-form-item>
				<el-form-item label="升级所需成长值"><el-input v-model.number="form.requiredGrowth" /></el-form-item>
				<el-form-item label="积分加速倍数"><el-input v-model.number="form.pointsMultiplier" /></el-form-item>
				<el-form-item label="支付折扣%"><el-input v-model.number="form.payDiscountPercent" /></el-form-item>
				<el-form-item label="等级描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
				<el-form-item label="设为默认"><el-switch v-model="form.isDefault" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" @click="onSave">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="growthVisible" title="成长值换算配置" width="420px">
			<el-form :model="growthForm" label-width="140px">
				<el-form-item label="每元成长值">
					<el-input v-model.number="growthForm.growthPerYuan" placeholder="正整数，默认1" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="growthVisible=false">取消</el-button>
				<el-button type="primary" @click="saveGrowthConfig">保存</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import FileInput from './_components/FileInput.vue';
import { absUrl as abs } from '../utils/http';
import { ElIcon } from 'element-plus';
import { CirclePlus, SetUp, Edit, Delete } from '@element-plus/icons-vue';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
function absUrl(u?: string | null){ return abs(u); }

type Level = { id: number; name: string; level: number; requiredGrowth: number; description?: string|null; iconUrl?: string|null; pointsMultiplier: number; payDiscountPercent: number; isDefault?: boolean };
const levels = ref<Level[]>([]);
const dialogVisible = ref(false);
const current = ref<Level | null>(null);
const form = ref<Partial<Level>>({ name: '', level: 1, requiredGrowth: 0, pointsMultiplier: 1, payDiscountPercent: 0, description: '', iconUrl: null });

const growthVisible = ref(false);
const growthForm = ref<{ growthPerYuan: number }>({ growthPerYuan: 1 });

async function fetchLevels(){ levels.value = await http<Level[]>('/member-level', { method: 'GET' }); }

function openCreate(){ current.value = null; form.value = { name: '', level: 1, requiredGrowth: 0, pointsMultiplier: 1, payDiscountPercent: 0, description: '', isDefault: false }; dialogVisible.value = true; }
function openEdit(row: Level){ current.value = row; form.value = { ...row }; dialogVisible.value = true; }

async function openGrowthConfig(){
  const res = await http<{ growthPerYuan: number }>('/member-level/_growth-config', { method: 'GET' });
  growthForm.value.growthPerYuan = Number(res?.growthPerYuan || 1);
  growthVisible.value = true;
}
async function saveGrowthConfig(){
  await http('/member-level/_growth-config', { method: 'POST', body: growthForm.value });
  ElMessage.success('已保存');
  growthVisible.value = false;
}

async function onSave(){
	try {
		if (current.value?.id) await http(`/member-level/${current.value.id}`, { method: 'PUT', body: form.value });
		else await http('/member-level', { method: 'POST', body: form.value });
		dialogVisible.value = false; ElMessage.success('已保存'); fetchLevels();
	} catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function remove(row: Level){ try { await http(`/member-level/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchLevels(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

onMounted(fetchLevels);
</script>


