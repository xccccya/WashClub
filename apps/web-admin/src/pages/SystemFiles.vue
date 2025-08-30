<template>
	<BasePage title="文件管理">
		<template #actions>
			<el-upload
				:action="`${API_BASE}/file/upload`"
				:name="'file'"
				:show-file-list="false"
				:headers="authHeaders"
				:data="{ dir }"
				:on-success="onUploaded"
			>
				<el-button type="primary">上传文件</el-button>
			</el-upload>
			<el-select v-model="dir" style="width:200px;margin-left:8px;">
				<el-option label="公共目录(public)" value="public" />
				<el-option label="管理后台(admin)" value="admin" />
				<el-option label="收银台(pos)" value="pos" />
				<el-option label="小程序(miniapp)" value="miniapp" />
				<el-option label="车辆图片(carimg)" value="carimg" />
			</el-select>
		</template>

		<el-table :data="files" stripe style="width:100%">
			<el-table-column prop="name" label="文件名" />
			<el-table-column prop="size" label="大小(B)" width="120" />
			<el-table-column prop="mtime" label="时间" width="180">
				<template #default="{ row }">{{ formatTime(row.mtime) }}</template>
			</el-table-column>
			<el-table-column label="预览" width="120">
				<template #default="{ row }">
					<a :href="absUrl(row.url)" target="_blank">打开</a>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="120">
				<template #default="{ row }">
					<el-button size="small" type="danger" @click="remove(row)">删除</el-button>
				</template>
			</el-table-column>
		</el-table>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type FileItem = { name: string; url: string; path: string; size: number; mtime: number };
const files = ref<FileItem[]>([]);
const dir = ref<'public'|'admin'|'pos'|'miniapp'>('admin');
const authHeaders = computed(()=>({ Authorization: `Bearer ${localStorage.getItem('token')||''}` }));

function formatTime(ms: number){ const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

async function fetchList(){ files.value = await http<FileItem[]>('/file/list', { method: 'GET', query: { dir: dir.value } }); }
function onUploaded(){ ElMessage.success('上传成功'); fetchList(); }
async function remove(row: FileItem){ await http(`/file/${encodeURIComponent(row.path)}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchList(); }

onMounted(fetchList);
watch(dir, () => { fetchList(); });
</script>


