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
			<el-table-column prop="expiryType" label="有效期类型" width="120" />
			<el-table-column prop="startAt" label="开始时间" width="180" />
			<el-table-column prop="endAt" label="结束时间" width="180" />
			<el-table-column label="操作" width="360">
				<template #default="{ row }">
					<el-button size="small" @click="openEdit(row)">编辑</el-button>
					<el-popconfirm title="确认删除？" @confirm="remove(row.id)"><template #reference><el-button size="small" type="danger">删除</el-button></template></el-popconfirm>
					<el-button size="small" type="success" @click="openIssue(row)">发放</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="show" :title="form.id ? '编辑卡券' : '新增卡券'" width="840px">
			<el-form label-width="100">
				<el-form-item label="类型"><el-select v-model="form.type" :disabled="!!form.id"><el-option label="优惠券" value="COUPON" /><el-option label="洗车计次卡" value="WASH_CARD" /></el-select></el-form-item>
				<el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
				<el-form-item label="分组"><el-select v-model="form.groupId" placeholder="选择分组"><el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" /></el-select></el-form-item>
				<el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
				<el-form-item label="有效期类型">
					<el-radio-group v-model="form.expiryType">
						<el-radio label="FIXED">固定时间</el-radio>
						<el-radio label="AFTER_RECEIVE">领取后生效</el-radio>
						<el-radio label="PERMANENT">永久有效</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item v-if="form.expiryType==='FIXED'" label="有效期时间段"><el-date-picker v-model="range" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width:100%" /></el-form-item>
				<el-form-item v-if="form.expiryType==='AFTER_RECEIVE'" label="有效天数"><el-input-number v-model="form.validDays" :min="0" /></el-form-item>

				<el-form-item label="图片">
					<div style="display:flex;gap:8px;align-items:center;width:100%">
						<el-input v-model="form.imageUrl" placeholder="图片URL或上传" />
						<input type="file" @change="onSelectImage" />
						<div v-if="form.imageUrl" style="width:80px;height:60px;border:1px solid #eee;display:flex;align-items:center;justify-content:center;overflow:hidden">
							<img :src="form.imageUrl" style="max-width:100%;max-height:100%" />
						</div>
					</div>
				</el-form-item>
				<el-form-item label="描述"><el-input type="textarea" :rows="2" v-model="form.description" /></el-form-item>
				<el-form-item label="后台备注"><el-input type="textarea" :rows="2" v-model="form.adminRemark" /></el-form-item>
				<template v-if="form.type==='COUPON'">
					<el-form-item label="面值"><el-input-number v-model="form.faceValue" :min="0" :step="1" /></el-form-item>
					<el-form-item label="发行总数"><el-input-number v-model="form.issueTotal" :min="0" :step="1" /></el-form-item>
					<el-form-item label="每人限领"><el-input-number v-model="form.perMemberLimit" :min="0" :step="1" /></el-form-item>
					<el-form-item label="最低订单额"><el-input-number v-model="form.minOrderAmount" :min="0" :step="1" /></el-form-item>
					<el-form-item label="适用范围">
						<el-radio-group v-model="form.applyScope">
							<el-radio label="ALL">全部商品</el-radio>
							<el-radio label="SPECIFIED">指定商品</el-radio>
						</el-radio-group>
					</el-form-item>
					<el-form-item v-if="form.applyScope==='SPECIFIED'" label="指定商品">
						<el-select v-model="form.applicableProductIds" multiple filterable placeholder="选择商品" style="width:100%">
							<el-option v-for="p in productOptions" :key="p.id" :label="p.name" :value="p.id" />
						</el-select>
					</el-form-item>
					<el-form-item label="规则JSON"><el-input type="textarea" :rows="3" v-model="form.ruleJsonText" placeholder='{"kind":"direct","amount":5}' /></el-form-item>
					<el-form-item label="小程序可领"><el-switch v-model="form.allowMiniappClaim" /></el-form-item>
					<el-form-item label="叠加策略">
						<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
							<el-checkbox v-model="form.allowCombine">可与其他券同用</el-checkbox>
							<el-checkbox v-model="form.allowStackWithPoints">可与积分同用</el-checkbox>
							<el-checkbox v-model="form.allowStackWithMemberDiscount">可与会员折扣同用</el-checkbox>
						</div>
					</el-form-item>
				</template>
				<template v-else>
					<el-form-item label="总次数"><el-input-number v-model="form.totalTimes" :min="0" /></el-form-item>
				</template>
			</el-form>
			<template #footer>
				<el-button @click="show=false">取消</el-button>
				<el-button type="primary" @click="save">保存</el-button>
			</template>
		</el-dialog>

		<!-- 发放对话框 -->
		<el-dialog v-model="issueShow" title="发放优惠券" width="720px">
			<div style="display:flex;gap:16px;align-items:flex-start;">
				<div style="flex:1;">
					<MemberSelector v-model:selected="issueMemberIds" />
				</div>
				<div style="width:240px;">
					<el-form label-width="90">
						<el-form-item label="每人张数"><el-input-number v-model="issueCount" :min="1" /></el-form-item>
						<el-alert type="info" :closable="false" show-icon title="将按券配置校验发行总数与每人限领" />
					</el-form>
				</div>
			</div>
			<template #footer>
				<el-button @click="issueShow=false">取消</el-button>
				<el-button type="primary" :loading="issuing" @click="doIssue">发放</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { ElMessage } from 'element-plus';
import MemberSelector from './_components/MemberSelector.vue';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
const groups = ref<any[]>([]);
const list = ref<any[]>([]);
const query = ref<{ groupId?: number; type?: 'COUPON'|'WASH_CARD' } >({});
const productOptions = ref<any[]>([]);

async function fetchGroups(){ groups.value = await http('/coupon/groups'); }
async function fetchList(){ list.value = await http('/coupons', { query: { groupId: query.value.groupId, type: query.value.type } }); }
async function fetchProducts(){ productOptions.value = await http('/store/products', { query: { enabled: true } }); }

const show = ref(false);
const form = ref<any>({
	id: 0,
	type: 'COUPON',
	name: '',
	groupId: undefined,
	enabled: true,
	expiryType: 'PERMANENT',
	startAt: '',
	endAt: '',
	validDays: undefined,
	imageUrl: '',
	description: '',
	adminRemark: '',
	// 优惠券专用
	faceValue: undefined,
	perMemberLimit: undefined,
	minOrderAmount: undefined,
	applyScope: 'ALL',
	applicableProductIds: [],
	ruleJsonText: '',
	allowMiniappClaim: false,
	allowCombine: false,
	allowStackWithPoints: true,
	allowStackWithMemberDiscount: true,
	// 计次卡
	totalTimes: 0,
});
const range = ref<[Date, Date] | ''>('');

// 发放弹窗状态
const issueShow = ref(false);
const issueCouponId = ref<number | null>(null);
const issueMemberIds = ref<number[]>([]);
const issueCount = ref(1);
const issuing = ref(false);

function openIssue(row:any){ issueCouponId.value = row.id; issueMemberIds.value = []; issueCount.value = 1; issueShow.value = true; }
async function doIssue(){
    if (!issueCouponId.value || issueMemberIds.value.length === 0) { ElMessage.error('请选择会员'); return; }
    issuing.value = true;
    try{
        for (const mid of issueMemberIds.value){
            await http(`/coupons/${issueCouponId.value}/issue`, { method:'POST', body: { memberId: mid, count: issueCount.value } });
        }
        issueShow.value = false; ElMessage.success('已发放');
    } finally { issuing.value = false; }
}

function openCreate(){
	form.value = {
		id: 0,
		type: 'COUPON',
		name: '',
		groupId: undefined,
		enabled: true,
		expiryType: 'PERMANENT',
		startAt: '',
		endAt: '',
		validDays: undefined,
		imageUrl: '',
		description: '',
		adminRemark: '',
		faceValue: undefined,
		issueTotal: undefined,
		perMemberLimit: undefined,
		minOrderAmount: undefined,
		applyScope: 'ALL',
		applicableProductIds: [],
		ruleJsonText: '',
		allowMiniappClaim: false,
		allowCombine: false,
		allowStackWithPoints: true,
		allowStackWithMemberDiscount: true,
		totalTimes: 0,
	};
	range.value='';
	show.value = true;
}
function openEdit(row:any){
	form.value = {
		id: row.id,
		type: row.type,
		name: row.name,
		groupId: row.groupId,
		enabled: row.enabled,
		expiryType: row.expiryType || 'PERMANENT',
		startAt: row.startAt,
		endAt: row.endAt,
		validDays: row.validDays,
		imageUrl: row.imageUrl || '',
		description: row.description || '',
		adminRemark: row.adminRemark || '',
		faceValue: row.faceValue,
		issueTotal: row.issueTotal,
		perMemberLimit: row.perMemberLimit,
		minOrderAmount: row.minOrderAmount,
		applyScope: row.applyScope || 'ALL',
		applicableProductIds: Array.isArray(row.applicableProducts) ? row.applicableProducts.map((x:any)=>x.productId) : [],
		ruleJsonText: row.ruleJson ? JSON.stringify(row.ruleJson) : '',
		allowMiniappClaim: !!row.allowMiniappClaim,
		allowCombine: !!row.allowCombine,
		allowStackWithPoints: row.allowStackWithPoints !== false,
		allowStackWithMemberDiscount: row.allowStackWithMemberDiscount !== false,
		totalTimes: row.totalTimes,
	};
	if (row.startAt && row.endAt) range.value = [new Date(row.startAt), new Date(row.endAt)]; else range.value = '' as any;
	show.value = true;
}

watch(range, (v)=>{ if (Array.isArray(v)) { form.value.startAt = v[0]; form.value.endAt = v[1]; } else { form.value.startAt=''; form.value.endAt=''; } });

async function save(){
	if (!form.value.name) { ElMessage.error('请输入名称'); return; }
	const payload: any = {
		type: form.value.type,
		name: form.value.name,
		groupId: form.value.groupId || null,
		enabled: form.value.enabled,
		expiryType: form.value.expiryType,
		startAt: form.value.expiryType==='FIXED' ? (form.value.startAt || null) : null,
		endAt: form.value.expiryType==='FIXED' ? (form.value.endAt || null) : null,
		validDays: form.value.expiryType==='AFTER_RECEIVE' ? (form.value.validDays || null) : null,
		imageUrl: form.value.imageUrl || null,
		description: form.value.description || null,
		adminRemark: form.value.adminRemark || null,
	};
	if (form.value.type === 'COUPON') {
		try { payload.ruleJson = form.value.ruleJsonText ? JSON.parse(form.value.ruleJsonText) : null; } catch { ElMessage.error('规则JSON格式错误'); return; }
		payload.faceValue = form.value.faceValue ?? null;
		payload.issueTotal = form.value.issueTotal ?? null;
		payload.perMemberLimit = form.value.perMemberLimit ?? null;
		payload.minOrderAmount = form.value.minOrderAmount ?? null;
		payload.applyScope = form.value.applyScope;
		payload.applicableProductIds = form.value.applyScope==='SPECIFIED' ? (form.value.applicableProductIds || []) : [];
		payload.allowMiniappClaim = !!form.value.allowMiniappClaim;
		payload.allowCombine = !!form.value.allowCombine;
		payload.allowStackWithPoints = form.value.allowStackWithPoints !== false;
		payload.allowStackWithMemberDiscount = form.value.allowStackWithMemberDiscount !== false;
	} else {
		payload.totalTimes = form.value.totalTimes || 0;
	}
	if (form.value.id) await http(`/coupons/${form.value.id}`, { method:'PUT', body: payload }); else await http('/coupons', { method:'POST', body: payload });
	show.value = false; ElMessage.success('已保存'); await fetchList();
}

async function remove(id:number){ await http(`/coupons/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await fetchList(); }

async function onSelectImage(ev: Event){
	const input = ev.target as HTMLInputElement;
	if (!input?.files || input.files.length === 0) return;
	const f = input.files[0];
	const fd = new FormData();
	fd.append('file', f);
	fd.append('dir', 'admin');
	const token = localStorage.getItem('token') || '';
	const res = await fetch(`${API_BASE}/file/upload`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '' }, body: fd });
	if (!res.ok) { ElMessage.error('上传失败'); return; }
	const j = await res.json();
	form.value.imageUrl = j?.url || '';
}

onMounted(async ()=>{ await Promise.all([fetchGroups(), fetchList(), fetchProducts()]); });
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
</style>


