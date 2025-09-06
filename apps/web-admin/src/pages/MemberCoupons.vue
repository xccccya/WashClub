<template>
	<div>
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<div class="toolbar">
			<el-input v-model="query.memberId" placeholder="会员ID" style="width:140px;margin-right:8px;" />
			<el-input v-model="query.couponId" placeholder="卡券ID" style="width:140px;margin-right:8px;" />
			<el-select v-model="query.used" placeholder="是否已使用" clearable style="width:160px;margin-right:8px;">
				<el-option label="未使用" value="0" />
				<el-option label="已使用" value="1" />
			</el-select>
			<el-select v-model="query.expired" placeholder="是否过期" clearable style="width:160px;margin-right:8px;">
				<el-option label="未过期" value="0" />
				<el-option label="已过期" value="1" />
			</el-select>
			<el-button @click="fetchList"><el-icon style="margin-right:4px;"><Search /></el-icon>查询</el-button>
		</div>
		<el-table :data="list.items" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="member.name" label="会员" min-width="160">
				<template #default="{ row }">{{ row.member?.name }}（{{ row.member?.phone }}）</template>
			</el-table-column>
			<el-table-column prop="coupon.name" label="卡券名称" min-width="160" />
			<el-table-column prop="expiryType" label="有效期类型" width="120">
				<template #default="{ row }">{{ zhExpiryType(row.expiryType) }}</template>
			</el-table-column>
			<el-table-column prop="startAt" label="开始时间" width="200">
				<template #default="{ row }">{{ formatLocal(row.startAt) }}</template>
			</el-table-column>
			<el-table-column prop="endAt" label="结束时间" width="200">
				<template #default="{ row }">{{ formatLocal(row.endAt) }}</template>
			</el-table-column>
			<el-table-column prop="usedAt" label="使用时间" width="200">
				<template #default="{ row }">{{ formatLocal(row.usedAt) }}</template>
			</el-table-column>
			<el-table-column label="操作" width="300">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)"><el-icon style="margin-right:4px;"><EditPen /></el-icon>修改有效期</el-button>
					<el-popconfirm title="确认删除？" @confirm="remove(row.id)"><template #reference><el-button size="small" type="danger"><el-icon style="margin-right:4px;"><Delete /></el-icon>删除</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

		<el-pagination v-if="list.total>pageSize" background layout="prev, pager, next" :total="list.total" :page-size="pageSize" :current-page="page" @current-change="onPage" style="margin-top:12px" />

		<el-dialog v-model="show" title="修改有效期" width="520px">
			<el-form label-width="100">
				<el-form-item label="有效期">
					<el-date-picker v-model="range" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width:100%" />
				</el-form-item>
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

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const page = ref(1);
const pageSize = ref(20);
const query = ref<{ memberId?: string | number; couponId?: string | number; used?: '0'|'1'|''; expired?: '0'|'1'|'' }>({ used: '' as any, expired: '' as any });
const list = ref<{ total:number; page:number; pageSize:number; items:any[] }>({ total:0, page:1, pageSize:20, items: [] });

async function fetchList(){
	list.value = await http('/member-coupons', { query: { page: page.value, pageSize: pageSize.value, memberId: query.value.memberId || undefined, couponId: query.value.couponId || undefined, used: query.value.used || undefined, expired: query.value.expired || undefined } });
}
function onPage(p:number){ page.value=p; fetchList(); }

const show = ref(false);
const editingId = ref<number | null>(null);
const range = ref<[Date, Date] | ''>('');

function openEdit(row:any){ editingId.value = row.id; range.value = (row.startAt && row.endAt) ? [new Date(row.startAt), new Date(row.endAt)] : '' as any; show.value = true; }

async function save(){
	try{
		if (!editingId.value) return;
		const startAt = Array.isArray(range.value) ? range.value[0] : null;
		const endAt = Array.isArray(range.value) ? range.value[1] : null;
		await http(`/member-coupons/${editingId.value}/expiry`, { method: 'PUT', body: { startAt, endAt } });
		show.value = false; ElMessage.success('已保存'); fetchList();
	}catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

async function remove(id:number){ try { await http(`/member-coupons/${id}`, { method: 'DELETE' }); ElMessage.success('已删除'); fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

onMounted(fetchList);

function zhExpiryType(t?: string){
  const v = String(t||'').toUpperCase();
  if (v==='PERMANENT') return '永久有效';
  if (v==='FIXED') return '固定区间';
  if (v==='AFTER_RECEIVE') return '领取后生效';
  return v || '-';
}
function formatLocal(d?: string | Date | null): string{
  try{
    if (!d) return '';
    const dt = new Date(d);
    if (!isFinite(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const dd = String(dt.getDate()).padStart(2,'0');
    const hh = String(dt.getHours()).padStart(2,'0');
    const mm = String(dt.getMinutes()).padStart(2,'0');
    const ss = String(dt.getSeconds()).padStart(2,'0');
    return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`;
  }catch{ return ''; }
}
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
</style>


