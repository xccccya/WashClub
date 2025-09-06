<template>
	<BasePage title="广告横幅">
		<template #actions>
			<el-button type="primary" @click="openCreate"><el-icon style="margin-right:4px;"><Picture /></el-icon>新建横幅</el-button>
			<el-select v-model="filterEnabled" placeholder="筛选" style="width:160px;margin-left:8px;">
				<el-option label="全部" value="" />
				<el-option label="已启用" value="true" />
				<el-option label="未启用" value="false" />
			</el-select>
		</template>
		<el-table :data="banners" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column label="图片" width="140">
				<template #default="{ row }">
					<img :src="abs(row.imageUrl)" style="width:120px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #eee;" />
				</template>
			</el-table-column>
			<el-table-column prop="title" label="标题" />
			<el-table-column prop="weight" label="权重" width="100" />
			<el-table-column label="跳转" width="220">
				<template #default="{ row }">
					<el-tag size="small" :type="row.jumpEnabled ? 'success' : 'info'">{{ row.jumpEnabled ? '开启' : '关闭' }}</el-tag>
					<span v-if="row.jumpEnabled && row.linkPath" style="margin-left:6px;color:#666;">{{ row.linkPath }}</span>
				</template>
			</el-table-column>
			<el-table-column prop="enabled" label="启用" width="100">
				<template #default="{ row }">
					<el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '已启用' : '未启用' }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="380">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)"><el-icon style="margin-right:4px;"><EditPen /></el-icon>编辑</el-button>
					<el-button size="small" @click="toggleEnable(row)" :type="row.enabled ? 'warning' : 'primary'"><el-icon style="margin-right:4px;"><SwitchButton /></el-icon>{{ row.enabled ? '禁用' : '启用' }}</el-button>
					<el-button size="small" type="danger" @click="remove(row)"><el-icon style="margin-right:4px;"><Delete /></el-icon>删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑横幅' : '新建横幅'" width="620px">
			<el-form :model="form" label-width="120px">
				<el-form-item label="标题"><el-input v-model="form.title" placeholder="可选" /></el-form-item>
				<el-form-item label="图片">
					<div style="display:flex;align-items:center;gap:12px;">
						<img v-if="form.imageUrl" :src="abs(form.imageUrl)" style="width:240px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #eee;" />
						<el-upload :http-request="uploadImage" :show-file-list="false" accept="image/*">
							<el-button type="primary">上传图片</el-button>
						</el-upload>
					</div>
				</el-form-item>
				<el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
				<el-form-item label="跳转设置">
					<el-switch v-model="form.jumpEnabled" style="margin-right:10px;" />
					<el-input v-model="form.linkPath" placeholder="如 /pages/washcard/index" style="width:300px;" :disabled="!form.jumpEnabled" />
				</el-form-item>
				<el-form-item label="权重"><el-input v-model.number="form.weight" type="number" style="width:160px;" /></el-form-item>
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
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Banner = { id: number; title?: string|null; imageUrl: string; enabled: boolean; jumpEnabled: boolean; linkPath?: string|null; weight: number };
const filterEnabled = ref('');
const banners = ref<Banner[]>([]);
const dialogVisible = ref(false);
const current = ref<Banner | null>(null);
const form = ref<{ id?: number; title?: string; imageUrl: string; enabled: boolean; jumpEnabled: boolean; linkPath?: string; weight: number }>({ imageUrl: '', enabled: false, jumpEnabled: false, weight: 0 });

async function fetchList(){
    const query: any = {};
    if (filterEnabled.value !== '') query.enabled = filterEnabled.value;
    banners.value = await http<Banner[]>('/content/banners', { method: 'GET', query });
}

function openCreate(){ current.value = null; form.value = { imageUrl: '', enabled: false, jumpEnabled: false, weight: 0 }; dialogVisible.value = true; }
function openEdit(row: Banner){ current.value = row; form.value = { id: row.id, title: row.title || '', imageUrl: row.imageUrl, enabled: row.enabled, jumpEnabled: row.jumpEnabled, linkPath: row.linkPath || '', weight: row.weight }; dialogVisible.value = true; }

async function onSave(){
    if (!form.value.imageUrl) { ElMessage.error('请上传横幅图片'); return; }
    try {
        if (current.value?.id) {
            await http(`/content/banners/${current.value.id}`, { method: 'PUT', body: { title: form.value.title || null, imageUrl: form.value.imageUrl, enabled: form.value.enabled, jumpEnabled: form.value.jumpEnabled, linkPath: form.value.linkPath || null, weight: form.value.weight } });
        } else {
            await http('/content/banners', { method: 'POST', body: { title: form.value.title || null, imageUrl: form.value.imageUrl, enabled: form.value.enabled, jumpEnabled: form.value.jumpEnabled, linkPath: form.value.linkPath || null, weight: form.value.weight } });
        }
        dialogVisible.value = false; ElMessage.success('已保存'); fetchList();
    } catch (e:any) {
        const msg = e?.message?.replace(/^[^:\s]*:\s*/, '') || '';
        if (/最多可同时启用3条/.test(msg)) ElMessage.error('最多可同时启用3条横幅'); else ElMessage.error(msg || '保存失败');
    }
}

async function toggleEnable(row: Banner){
    try {
        await http(`/content/banners/${row.id}/enable`, { method: 'POST', body: { enabled: !row.enabled } });
        ElMessage.success('已更新');
        fetchList();
    } catch (e:any) {
        ElMessage.error(e?.message?.replace(/^[^:\s]*:\s*/, '') || '最多可同时启用3条横幅');
    }
}
async function remove(row: Banner){
    try { await http(`/content/banners/${row.id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchList(); }
    catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); }
}

async function uploadImage(options: any){
    const file = options?.file as File;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('dir', 'public');
    const res = await fetch(`${API_BASE}/file/upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` }, body: fd });
    const data = await res.json();
    if (!res.ok) { throw new Error(data?.message || '上传失败'); }
    form.value.imageUrl = data?.url || '';
    ElMessage.success('上传成功');
}

function abs(u?: string){ return absUrl(u || ''); }

onMounted(fetchList);
watch(filterEnabled, fetchList);
</script>


