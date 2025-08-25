<template>
	<div>
		<h3>卡券列表</h3>
		<div class="toolbar">
			<el-select v-model="query.groupId" placeholder="分组" clearable style="width:160px;margin-right:8px;">
				<el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
			</el-select>
			<el-select v-model="query.type" placeholder="类型" clearable style="width:160px;margin-right:8px;">
				<el-option label="优惠券" value="COUPON" />
				<el-option label="洗车计次卡" value="WASH_CARD" />
			</el-select>
			<el-button @click="fetchList">查询</el-button>
			<el-button type="primary" @click="openCreate">新增卡券</el-button>
		</div>
		<el-table :data="list" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="name" label="名称" />
			<el-table-column prop="type" label="类型" width="120" />
			<el-table-column prop="group.name" label="分组" />
			<el-table-column prop="enabled" label="启用" width="80">
				<template #default="{ row }"> <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag> </template>
			</el-table-column>
			<el-table-column prop="startAt" label="开始时间" width="180" />
			<el-table-column prop="endAt" label="结束时间" width="180" />
			<el-table-column label="操作" width="200">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-popconfirm title="确认删除？" @confirm="remove(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="show" :title="form.id ? '编辑卡券' : '新增卡券'" width="720px">
			<el-form label-width="100">
				<el-form-item label="类型"><el-select v-model="form.type" :disabled="!!form.id"><el-option label="优惠券" value="COUPON" /><el-option label="洗车计次卡" value="WASH_CARD" /></el-select></el-form-item>
				<el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="分组"><el-select v-model="form.groupId" placeholder="选择分组"><el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" /></el-select></el-form-item>
				<el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
				<el-form-item label="有效期"><el-date-picker v-model="range" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width:100%" /></el-form-item>
				<template v-if="form.type==='COUPON'">
					<el-form-item label="规则JSON"><el-input type="textarea" :rows="3" v-model="form.ruleJsonText" placeholder='{"kind":"direct","amount":5}' /></el-form-item>
				</template>
				<template v-else>
					<el-form-item label="总次数"><el-input-number v-model="form.totalTimes" :min="0" /></el-form-item>
					<el-form-item label="有效天数"><el-input-number v-model="form.validDays" :min="0" /></el-form-item>
				</template>
			</el-form>
			<template #footer>
				<el-button @click="show=false">取消</el-button>
				<el-button type="primary" @click="save">保存</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const groups = ref<any[]>([]);
const list = ref<any[]>([]);
const query = ref<{ groupId?: number; type?: 'COUPON'|'WASH_CARD' } >({});

async function fetchGroups(){ groups.value = await http('/coupon/groups'); }
async function fetchList(){ list.value = await http('/coupons', { query: { groupId: query.value.groupId, type: query.value.type } }); }

const show = ref(false);
const form = ref<any>({ id: 0, type: 'COUPON', name: '', groupId: undefined, enabled: true, startAt: '', endAt: '', ruleJsonText: '', totalTimes: 0, validDays: undefined });
const range = ref<[Date, Date] | ''>('');

function openCreate(){ form.value = { id: 0, type: 'COUPON', name: '', groupId: undefined, enabled: true, startAt: '', endAt: '', ruleJsonText: '', totalTimes: 0, validDays: undefined }; range.value=''; show.value = true; }
function openEdit(row:any){
	form.value = { id: row.id, type: row.type, name: row.name, groupId: row.groupId, enabled: row.enabled, startAt: row.startAt, endAt: row.endAt, ruleJsonText: row.ruleJson ? JSON.stringify(row.ruleJson) : '', totalTimes: row.totalTimes, validDays: row.validDays };
	if (row.startAt && row.endAt) range.value = [new Date(row.startAt), new Date(row.endAt)]; else range.value = '' as any;
	show.value = true;
}

watch(range, (v)=>{ if (Array.isArray(v)) { form.value.startAt = v[0]; form.value.endAt = v[1]; } else { form.value.startAt=''; form.value.endAt=''; } });

async function save(){
	if (!form.value.name) { ElMessage.error('请输入名称'); return; }
	const payload: any = { type: form.value.type, name: form.value.name, groupId: form.value.groupId || null, enabled: form.value.enabled, startAt: form.value.startAt || null, endAt: form.value.endAt || null };
	if (form.value.type === 'COUPON') { try { payload.ruleJson = form.value.ruleJsonText ? JSON.parse(form.value.ruleJsonText) : null; } catch { ElMessage.error('规则JSON格式错误'); return; } }
	else { payload.totalTimes = form.value.totalTimes || 0; payload.validDays = form.value.validDays || null; }
	if (form.value.id) await http(`/coupons/${form.value.id}`, { method:'PUT', body: payload }); else await http('/coupons', { method:'POST', body: payload });
	show.value = false; ElMessage.success('已保存'); await fetchList();
}

async function remove(id:number){ await http(`/coupons/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await fetchList(); }

onMounted(async ()=>{ await fetchGroups(); await fetchList(); });
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
</style>


