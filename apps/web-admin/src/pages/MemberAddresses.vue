<template>
	<div>
		<div class="toolbar">
			<el-input v-model="keyword" placeholder="搜索 省/市/区/街道/手机号/会员名" style="width:320px;" @keyup.enter.native="refresh" />
			<el-button type="primary" @click="refresh"><el-icon style="vertical-align: middle; margin-right:4px;"><Search /></el-icon><span style="vertical-align: middle;">搜索</span></el-button>
		</div>
		<el-table :data="items" border stripe size="small">
			<el-table-column prop="id" label="#" width="60" />
			<el-table-column label="会员">
				<template #default="{ row }">{{ row.member?.name }}（{{ row.member?.phone }}）</template>
			</el-table-column>
			<el-table-column label="地址">
				<template #default="{ row }">{{ row.province }} {{ row.city }} {{ row.district }} {{ row.street }} {{ row.detail }}</template>
			</el-table-column>
			<el-table-column prop="phone" label="手机号" width="120" />
			<el-table-column prop="label" label="标签" width="100" />
			<el-table-column label="操作" width="140" fixed="right">
				<template #default="{ row }">
					<el-popconfirm title="确定删除该地址吗？" @confirm="remove(row)">
						<template #reference>
							<el-button type="danger" size="small"><el-icon><Delete /></el-icon><span>删除</span></el-button>
						</template>
					</el-popconfirm>
				</template>
			</el-table-column>
		</el-table>
		<div class="pager">
			<el-pagination layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPage" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { addressControllerAdminList } from '@wash/api-client';
import { ElMessage } from 'element-plus';
import { ElIcon } from 'element-plus';
import { Search, Delete } from '@element-plus/icons-vue';

const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');

async function refresh(){
    const res:any = (await addressControllerAdminList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined } as any) as unknown) as any;
    items.value = res.items || [];
    total.value = res.total || 0;
}

function onPage(p:number){ page.value = p; refresh(); }

async function remove(row:any){
    try {
        // 管理端复用会员端删除需要 token 校验，这里直接提示仅支持会员自行删除；或可扩展后台删除接口
        ElMessage.warning('当前仅支持会员端删除，管理端暂不提供直删');
    } catch {}
}

onMounted(refresh);
</script>

<style scoped>
.toolbar { margin-bottom: 12px; display:flex; gap:8px; }
.pager { margin-top: 12px; display:flex; justify-content: flex-end; }
</style>


