<template>
	<div>
		<h3>评价管理</h3>
		<el-form :inline="true" style="margin-bottom:12px;">
			<el-form-item label="会员ID"><el-input v-model.number="memberId" placeholder="可选" style="width:160px;" /></el-form-item>
			<el-form-item label="订单号"><el-input v-model="orderNo" placeholder="可选" style="width:220px;" /></el-form-item>
			<el-form-item label="评分"><el-input v-model.number="ratingMin" placeholder="最小" style="width:100px;" /> - <el-input v-model.number="ratingMax" placeholder="最大" style="width:100px;margin-left:6px;" /></el-form-item>
			<el-form-item label="时间范围"><el-date-picker v-model="dateRange" type="datetimerange" start-placeholder="开始" end-placeholder="结束" style="width: 420px;" /></el-form-item>
			<el-button type="primary" @click="fetchList">查询</el-button>
		</el-form>
		<el-table :data="list" border size="small">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column label="订单号" width="240">
				<template #default="{ row }"><el-link type="primary" @click="gotoOrder(row)">{{ row?.order?.no || row.orderId }}</el-link></template>
			</el-table-column>
			<el-table-column label="会员" width="220">
				<template #default="{ row }">{{ (row?.member?.name||'-') + ' / ' + (row?.member?.phone||'-') }}</template>
			</el-table-column>
			<el-table-column label="评分" width="160">
				<template #default="{ row }">
					<el-rate v-model="row.rating" disabled show-score>
					</el-rate>
				</template>
			</el-table-column>
			<el-table-column label="内容">
				<template #default="{ row }">
					<div style="white-space:pre-wrap;">{{ row.content || '-' }}</div>
					<div v-if="Array.isArray(row.imagesJson) && row.imagesJson.length" style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
						<img v-for="(img,idx) in row.imagesJson" :key="idx" :src="img" style="width:56px;height:56px;border-radius:6px;object-fit:cover;" />
					</div>
				</template>
			</el-table-column>
			<el-table-column label="回复">
				<template #default="{ row }">
					<div>{{ row.replyContent || '-' }}</div>
				</template>
			</el-table-column>
			<el-table-column prop="createdAt" label="时间" width="180">
				<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column label="操作" width="240">
				<template #default="{ row }">
					<el-button size="small" @click="openReply(row)">回复</el-button>
					<el-button size="small" type="danger" @click="del(row)">删除</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogReply" title="回复评价" width="520px">
			<el-input type="textarea" v-model="replyText" placeholder="输入回复内容" :rows="4" />
			<template #footer>
				<el-button @click="dialogReply=false">取消</el-button>
				<el-button type="primary" @click="submitReply">提交</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage, ElMessageBox } from 'element-plus';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const router = useRouter();
const memberId = ref<number|undefined>(undefined);
const orderNo = ref<string>('');
const ratingMin = ref<number|undefined>(undefined);
const ratingMax = ref<number|undefined>(undefined);
const dateRange = ref<[Date, Date] | undefined>(undefined);
const list = ref<any[]>([]);
const dialogReply = ref(false);
const replyText = ref('');
let currentId: number | null = null;

function formatDate(val?: string){ if(!val) return '-'; try{ return new Date(val).toLocaleString(); }catch{return val} }

async function fetchList(){
    const query:any = { page: 1, pageSize: 50, memberId: memberId.value };
    if (orderNo.value) query.orderNo = orderNo.value;
    if (ratingMin.value != null) query.ratingMin = ratingMin.value;
    if (ratingMax.value != null) query.ratingMax = ratingMax.value;
    if (dateRange.value && Array.isArray(dateRange.value)) { query.start = dateRange.value[0]?.toISOString?.(); query.end = dateRange.value[1]?.toISOString?.(); }
    const res = await http('/orders/_reviews', { method: 'GET', query });
    list.value = Array.isArray(res) ? res : [];
}
function openReply(row: any){ currentId = row?.id || null; replyText.value = row?.replyContent || ''; dialogReply.value = true; }
async function submitReply(){ if(!currentId) return; await http(`/orders/_reviews/${currentId}/reply`, { method:'POST', body: { content: replyText.value } }); dialogReply.value = false; ElMessage.success('已回复'); fetchList(); }
async function del(row: any){ if(!row?.id) return; const ok = await ElMessageBox.confirm('确定删除该评价吗？','提示').then(()=>true).catch(()=>false); if(!ok) return; await http(`/orders/_reviews/${row.id}/delete`, { method:'POST' }); ElMessage.success('已删除'); fetchList(); }
function gotoOrder(row:any){ const no = row?.order?.no; if (!no) return; router.push(`/orders/no/${encodeURIComponent(no)}`); }

onMounted(fetchList);
</script>

<style scoped>
</style>


