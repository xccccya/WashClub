<template>
	<div>
		<h3>订单列表</h3>
		<div class="toolbar">
			<el-input v-model="keyword" placeholder="订单号/备注/手机号" style="width:220px;margin-right:8px;" @keyup.enter="fetchList" />
			<el-select v-model="type" placeholder="类型" style="width:140px;margin-right:8px;">
				<el-option label="全部" value="" />
				<el-option label="服务" value="SERVICE" />
				<el-option label="商品" value="SP" />
				<el-option label="付款" value="FK" />
			</el-select>
			<el-select v-model="status" placeholder="状态" style="width:140px;margin-right:8px;">
				<el-option label="全部" value="" />
				<el-option label="已创建" value="CREATED" />
				<el-option label="已支付" value="PAID" />
				<el-option label="已履约" value="FULFILLED" />
				<el-option label="已关闭" value="CLOSED" />
				<el-option label="已取消" value="CANCELLED" />
			</el-select>
			<el-select v-model="payStatus" placeholder="支付状态" style="width:140px;margin-right:8px;">
				<el-option label="全部" value="" />
				<el-option label="未支付" value="UNPAID" />
				<el-option label="已支付" value="PAID" />
				<el-option label="已退款" value="REFUNDED" />
				<el-option label="已作废" value="CANCELLED" />
			</el-select>
			<el-date-picker
				v-model="createdAtRange"
				type="datetimerange"
				start-placeholder="开始时间"
				end-placeholder="结束时间"
				style="margin-right:8px;"
				value-format="YYYY-MM-DDTHH:mm:ssZ"
			/>
			<el-button @click="fetchList">查询</el-button>
		</div>
		<el-table :data="list" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="no" label="订单号" />
			<el-table-column prop="type" label="类型" width="100" />
			<el-table-column prop="status" label="状态" width="100" />
			<el-table-column prop="payStatus" label="支付状态" width="100" />
			<el-table-column prop="payMethod" label="支付方式" width="120" />
			<el-table-column prop="totalAmount" label="订单总额" width="120" />
			<el-table-column prop="discountAmount" label="减免金额" width="120" />
			<el-table-column prop="shippingFee" label="配送费" width="100" />
			<el-table-column prop="payAmount" label="支付金额" width="120" />
			<el-table-column prop="createdAt" label="下单时间" width="170">
				<template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column prop="paidAt" label="支付时间" width="170">
				<template #default="{ row }">{{ formatDate(row.paidAt) }}</template>
			</el-table-column>
			<el-table-column label="会员" min-width="200">
				<template #default="{ row }">
					<span>UID: {{ row.member?.uid || '-' }} / ID: {{ row.memberId }}</span>
					<br />
					<span>{{ row.member?.name || '-' }}（{{ row.member?.phone || '-' }}）</span>
				</template>
			</el-table-column>
			<el-table-column prop="remark" label="备注" min-width="160" />
			<el-table-column label="操作" width="280">
				<template #default="{ row }">
					<el-button size="small" @click="open(row.id)">查看</el-button>
					<el-button v-if="row.payStatus==='UNPAID'" size="small" type="success" @click="openPay(row)">标记支付</el-button>
					<el-popconfirm title="确认关闭？" @confirm="close(row.id)"><template #reference><el-button size="small" type="danger">关闭</el-button></template></el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="showPay" title="手动确认支付" width="420px">
			<el-select v-model="payMethod" placeholder="支付方式" style="width: 100%">
				<el-option label="现金" value="CASH" />
				<el-option label="收钱吧" value="SHOUQIANBA" />
				<el-option label="线下其他" value="OFFLINE" />
			</el-select>
			<template #footer>
				<el-button @click="showPay=false">取消</el-button>
				<el-button type="primary" @click="doMarkPaid">确认支付</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage } from 'element-plus';

const router = useRouter();
const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
const list = ref<any[]>([]);
const keyword = ref('');
const type = ref<string | ''>('');
const status = ref<string | ''>('');
const payStatus = ref<string | ''>('');
const createdAtRange = ref<[string, string] | null>(null);

function formatDate(val: string | null | undefined){
	if(!val) return '-';
	try{ return new Date(val).toLocaleString(); }catch{ return String(val); }
}

async function fetchList(){
	const start = createdAtRange.value?.[0];
	const end = createdAtRange.value?.[1];
	list.value = await http('/orders', { query: {
		keyword: keyword.value || undefined,
		type: type.value || undefined,
		status: status.value || undefined,
		payStatus: payStatus.value || undefined,
		start: start || undefined,
		end: end || undefined,
	} });
}
function open(id:number){ router.push(`/orders/${id}`); }
async function close(id:number){ await http(`/orders/${id}/close`, { method:'POST' }); ElMessage.success('已关闭'); await fetchList(); }

const showPay = ref(false);
const currentOrderId = ref<number | null>(null);
const payMethod = ref<'CASH'|'SHOUQIANBA'|'OFFLINE'|'CASH'>('CASH');
function openPay(row:any){ currentOrderId.value = row.id; payMethod.value = 'CASH'; showPay.value = true; }
async function doMarkPaid(){ if (!currentOrderId.value) return; await http(`/orders/${currentOrderId.value}/pay/manual`, { method:'POST', body: { method: payMethod.value } }); ElMessage.success('已标记为已支付'); showPay.value = false; await fetchList(); }

onMounted(fetchList);
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
</style>


