<template>
	<BasePage title="员工配置">
		<template #actions>
			<el-button type="primary" @click="openCreate">
				<el-icon style="vertical-align: middle; margin-right:4px;"><User /></el-icon>
				<span style="vertical-align: middle;">新增员工</span>
			</el-button>
		</template>
		<el-form :inline="true" class="toolbar">
			<el-form-item>
				<el-input v-model="keyword" placeholder="搜索姓名/职务/会员名或手机号" clearable @keyup.enter.native="fetchList" style="width:280px;" />
			</el-form-item>
			<el-form-item>
				<el-select v-model="enabled" placeholder="状态" clearable style="width:120px;">
					<el-option label="启用" :value="true" />
					<el-option label="禁用" :value="false" />
				</el-select>
			</el-form-item>
			<el-form-item>
				<el-button @click="fetchList">查询</el-button>
			</el-form-item>
		</el-form>
		<el-table :data="items" stripe style="width:100%" v-loading="loading">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column label="员工姓名">
				<template #default="{ row }">
					{{ row.name || row.member?.name || '-' }}
				</template>
			</el-table-column>
			<el-table-column prop="title" label="职务" width="120" />
			<el-table-column label="会员信息">
				<template #default="{ row }">
					{{ row.member?.name || '-' }}（{{ row.member?.phone || '-' }}）
				</template>
			</el-table-column>
			<el-table-column label="状态" width="120">
				<template #default="{ row }">
					<el-switch v-model="row.enabled" @change="onToggleEnabled(row)" />
				</template>
			</el-table-column>
			<el-table-column label="操作" width="220">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)"><el-icon><Edit /></el-icon><span>编辑</span></el-button>
					<el-button size="small" type="danger" @click="remove(row)"><el-icon><Delete /></el-icon><span>删除</span></el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-pagination
			v-if="total > pageSize"
			style="margin-top:12px;"
			layout="prev, pager, next"
			:total="total"
			:page-size="pageSize"
			:current-page="page"
			@current-change="(p:number)=>{page=p; fetchList();}"
		/>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑员工' : '新增员工'" width="520px">
			<el-form :model="form" ref="formRef" label-width="90px">
				<el-form-item label="绑定会员">
					<el-input v-model="memberPhone" placeholder="输入会员手机号查询" style="width:260px; margin-right:8px;" />
					<el-button size="small" @click="lookupMember">查询</el-button>
				</el-form-item>
				<el-form-item v-if="memberPreview" label="会员">
					<div>{{ memberPreview.name }}（{{ memberPreview.phone }}）</div>
				</el-form-item>
				<el-form-item label="员工姓名"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="职务名称"><el-input v-model="form.title" /></el-form-item>
				<el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
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
	systemEmployeeControllerCreate,
	systemEmployeeControllerList,
	systemEmployeeControllerLookupMember,
	systemEmployeeControllerRemove,
	systemEmployeeControllerUpdate,
} from '@wash/api-client';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Edit, Delete, User } from '@element-plus/icons-vue';

type MemberPreview = { id: number; name: string; phone: string };
type Employee = { id: number; memberId: number; name?: string|null; title?: string|null; enabled: boolean; member?: { id: number; name: string; phone: string } };

const items = ref<Employee[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const keyword = ref('');
const enabled = ref<boolean|undefined>(undefined);

const dialogVisible = ref(false);
const current = ref<Employee | null>(null);
const formRef = ref();
const form = ref<Partial<Employee>>({ name: '', title: '', enabled: true });
const memberPhone = ref('');
const memberPreview = ref<MemberPreview | null>(null);

async function fetchList(){
  loading.value = true;
  try {
    // 注意：返回体类型在 openapi 中可能仍不完整，这里按实际后端返回（对象含 items/total）使用
    const resp = (await systemEmployeeControllerList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      enabled: enabled.value == null ? undefined : String(enabled.value),
    } as any) as unknown) as any;
    items.value = resp?.items || [];
    total.value = resp?.total || 0;
  } catch(e:any){ ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '加载失败'); }
  finally { loading.value = false; }
}

function openCreate(){ current.value = null; form.value = { name: '', title: '', enabled: true }; memberPhone.value=''; memberPreview.value=null; dialogVisible.value = true; }
function openEdit(row: Employee){ current.value = row; form.value = { id: row.id, name: row.name || row.member?.name, title: row.title, enabled: row.enabled }; memberPhone.value=''; memberPreview.value = row.member ? { id: row.member.id, name: row.member.name, phone: row.member.phone } : null; dialogVisible.value = true; }

async function lookupMember(){
  try {
    if (!memberPhone.value) { ElMessage.warning('请输入手机号'); return; }
    const res = (await systemEmployeeControllerLookupMember({ phone: memberPhone.value } as any) as unknown) as MemberPreview;
    if (!res) { ElMessage.warning('未找到会员'); memberPreview.value=null; return; }
    memberPreview.value = res;
  } catch(e:any){ ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '查询失败'); }
}

async function onSave(){
  try{
    if (current.value?.id) {
      await systemEmployeeControllerUpdate(String(current.value.id), { name: form.value.name ?? null, title: form.value.title ?? null, enabled: !!form.value.enabled } as any);
    } else {
      if (!memberPreview.value?.id) { ElMessage.warning('请先查询并选择会员'); return; }
      await systemEmployeeControllerCreate({ memberId: memberPreview.value.id, name: form.value.name ?? null, title: form.value.title ?? null, enabled: !!form.value.enabled } as any);
    }
    dialogVisible.value=false; ElMessage.success('已保存'); fetchList();
  } catch(e:any){ ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '保存失败'); }
}

async function onToggleEnabled(row: Employee){
  try{ await systemEmployeeControllerUpdate(String(row.id), { enabled: !!row.enabled } as any); ElMessage.success(row.enabled ? '已启用' : '已禁用'); }
  catch(e:any){ ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '更新失败'); fetchList(); }
}

async function remove(row: Employee){
  try{
    await ElMessageBox.confirm('确认删除该员工？', '提示', { type: 'warning' });
    await systemEmployeeControllerRemove(String(row.id));
    ElMessage.success('已删除');
    fetchList();
  }catch(e:any){ if (e !== 'cancel') ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '删除失败'); }
}

onMounted(fetchList);
</script>


