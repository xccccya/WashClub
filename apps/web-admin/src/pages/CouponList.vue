<template>
	<div>
		<!-- 标题已移除，使用顶部面包屑信息替代 -->
		<div class="toolbar">
			<el-select v-model="query.groupId" placeholder="分组" clearable style="width:160px;margin-right:8px;">
				<el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
			</el-select>
			<el-select v-model="query.type" placeholder="类型" clearable style="width:160px;margin-right:8px;">
				<el-option label="优惠券" value="COUPON" />
				<el-option label="洗车计次卡" value="WASH_CARD" />
			</el-select>
			<el-button @click="fetchList">查询</el-button>
			<el-button type="primary" @click="openCreate"><el-icon style="margin-right:4px;"><Plus /></el-icon>新增卡券</el-button>
		</div>
		<el-table :data="list" border size="small" style="width: 100%">
			<el-table-column prop="id" label="ID" width="60" />
			<el-table-column prop="name" label="名称" />
			<el-table-column prop="type" label="类型" width="120">
				<template #default="{ row }">{{ zhType(row.type) }}</template>
			</el-table-column>
			<el-table-column prop="group.name" label="分组" />
			<el-table-column prop="enabled" label="启用" width="80">
				<template #default="{ row }"> <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '是' : '否' }}</el-tag> </template>
			</el-table-column>
			<el-table-column prop="expiryType" label="有效期类型" width="120">
				<template #default="{ row }">{{ zhExpiryType(row.expiryType) }}</template>
			</el-table-column>
			<el-table-column prop="startAt" label="开始时间" width="200">
				<template #default="{ row }">{{ formatLocal(row.startAt) }}</template>
			</el-table-column>
			<el-table-column prop="endAt" label="结束时间" width="200">
				<template #default="{ row }">{{ formatLocal(row.endAt) }}</template>
			</el-table-column>
			<el-table-column label="操作" width="480">
				<template #default="{ row }">
					<el-button size="small" @click="openView(row)"><el-icon style="margin-right:4px;"><View /></el-icon>查看</el-button>
					<el-button size="small" @click="openEdit(row)"><el-icon style="margin-right:4px;"><EditPen /></el-icon>编辑</el-button>
					<el-popconfirm title="确认删除？" @confirm="remove(row.id)"><template #reference><el-button size="small" type="danger"><el-icon style="margin-right:4px;"><Delete /></el-icon>删除</el-button></template></el-popconfirm>
					<el-button size="small" type="success" @click="openIssue(row)"><el-icon style="margin-right:4px;"><Tickets /></el-icon>发放</el-button>
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
						<el-radio v-if="form.type!=='WASH_CARD'" label="FIXED">固定时间</el-radio>
						<el-radio label="AFTER_RECEIVE">领取后生效</el-radio>
						<el-radio label="PERMANENT">永久有效</el-radio>
					</el-radio-group>
				</el-form-item>
				<el-form-item v-if="form.expiryType==='FIXED' && form.type!=='WASH_CARD'" label="有效期时间段"><el-date-picker v-model="range" type="datetimerange" range-separator="至" start-placeholder="开始" end-placeholder="结束" style="width:100%" /></el-form-item>
				<el-form-item v-if="form.expiryType==='AFTER_RECEIVE'" label="有效天数"><el-input-number v-model="form.validDays" :min="1" :step="1" :precision="0" /></el-form-item>
				<el-form-item label="图片">
					<FileInput v-model="form.imageUrl" placeholder="图片URL或从文件库选择" source="coupon" />
				</el-form-item>
				<el-form-item label="描述"><el-input type="textarea" :rows="2" v-model="form.description" /></el-form-item>
				<el-form-item label="后台备注"><el-input type="textarea" :rows="2" v-model="form.adminRemark" /></el-form-item>
				<template v-if="form.type==='COUPON'">
					<el-form-item label="面值">
						<el-input-number v-model="form.faceValue" :disabled="form.ruleKind!=='none'" :min="0" :max="999999.99" :step="0.01" :precision="2" />
					</el-form-item>
					<el-form-item label="发行总数"><el-input-number v-model="form.issueTotal" :min="0" :step="1" :precision="0" /></el-form-item>
					<el-form-item label="每人限领"><el-input-number v-model="form.perMemberLimit" :min="0" :step="1" :precision="0" /></el-form-item>
					<el-form-item label="最低订单额">
						<el-input-number v-model="form.minOrderAmount" :disabled="form.ruleKind!=='none'" :min="0" :max="999999.99" :step="0.01" :precision="2" />
					</el-form-item>
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
					<el-form-item label="规则类型">
						<el-radio-group v-model="form.ruleKind">
							<el-radio label="direct">直减</el-radio>
							<el-radio label="percent">折扣%</el-radio>
							<el-radio label="none">不使用规则JSON</el-radio>
						</el-radio-group>
					</el-form-item>
					<el-form-item v-if="form.ruleKind==='direct'" label="直减金额"><el-input-number v-model="form.ruleAmount" :min="0" :max="999999.99" :step="0.01" :precision="2" /></el-form-item>
					<el-form-item v-if="form.ruleKind==='percent'" label="折扣百分比%"><el-input-number v-model="form.rulePercent" :min="0" :max="100" :step="1" :precision="0" /></el-form-item>
					<el-form-item v-if="form.ruleKind==='percent'" label="封顶金额"><el-input-number v-model="form.ruleCap" :min="0" :max="999999.99" :step="0.01" :precision="2" /></el-form-item>
					<el-form-item label="口径">
						<el-radio-group v-model="form.ruleApplyBase">
							<el-radio label="auto">按适用品项小计</el-radio>
							<el-radio label="order">按整单小计</el-radio>
						</el-radio-group>
					</el-form-item>
					<el-form-item label="最低小计门槛"><el-input-number v-model="form.ruleMinSubtotal" :min="0" :max="999999.99" :step="0.01" :precision="2" /></el-form-item>
					<el-alert type="info" :closable="false" show-icon title="生效说明（请先读完再保存）">
						<template #default>
							<div class="alert-desc">
								<div>1）规则优先：选择‘规则类型’（直减/折扣%）后，仅按规则计算优惠；此时‘面值’与‘最低订单额’不再生效。</div>
								<div>2）计算口径：规则默认按‘适用品项小计’计算；若口径选‘整单’，则按整单商品金额计算。无论哪种口径，单张券的优惠都不会超过该口径金额。</div>
								<div>3）适用范围：选‘指定商品’时，订单中至少包含一件被指定的商品，且优惠仅按这些被指定商品的小计计算。</div>
								<div>4）门槛与封顶：需先达到规则里的‘最低小计门槛’；折扣%可设置‘封顶金额’；直减不需要封顶。</div>
								<div>5）多券叠加：仅当所选每一张券都勾选了‘可与其他券同用’时才允许叠加。叠加时，每张券各自按自身的口径/门槛/封顶独立计算优惠，再将各券优惠相加；系统还会做总量限制：所有券合计优惠不会超过‘整单商品金额’。</div>
								<div>6）积分/会员折扣：若所选券中任意一张不允许与积分或会员折扣同用，则本次下单不可同时使用对应权益。</div>
								<div>7）有效期：‘固定时间’使用开始/结束时间；‘领取后生效’必须填写正整数的有效天数；‘永久有效’无需填写时间。</div>
								<div>8）其它：‘发行总数’与‘每人限领’会在发放与领取时校验；开启‘小程序可领’后，用户可在小程序自行领取。</div>
							</div>
						</template>
					</el-alert>
					<el-form-item label="规则JSON(高级)"><el-input type="textarea" :rows="3" v-model="form.ruleJsonText" placeholder='{"kind":"direct","amount":5,"cap":20,"applyBase":"auto"}' /></el-form-item>
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
				<el-button type="primary" :loading="issuing" @click="doIssue"><el-icon style="margin-right:4px;"><Tickets /></el-icon>发放</el-button>
			</template>
		</el-dialog>

		<!-- 查看详情 -->
		<el-dialog v-model="viewShow" title="卡券详情" width="640px">
			<div v-if="view">
				<el-descriptions :column="2" border>
					<el-descriptions-item label="ID">{{ view.id }}</el-descriptions-item>
					<el-descriptions-item label="名称">{{ view.name }}</el-descriptions-item>
					<el-descriptions-item label="类型">{{ zhType(view.type) }}</el-descriptions-item>
					<el-descriptions-item label="有效期">{{ view.expiryType==='FIXED' ? (formatLocal(view.startAt)+' ~ '+formatLocal(view.endAt)) : (view.expiryType==='AFTER_RECEIVE' ? ('领取后'+(view.validDays||'-')+'天') : '永久有效') }}</el-descriptions-item>
					<el-descriptions-item label="已领取">{{ view.stats?.issuedCount ?? '-' }}</el-descriptions-item>
					<el-descriptions-item label="已使用">{{ view.stats?.usedCount ?? '-' }}</el-descriptions-item>
					<el-descriptions-item label="剩余发行">{{ view.stats?.remainingIssue ?? '-' }}</el-descriptions-item>
				</el-descriptions>
			</div>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { createHttpClient } from '@wash/shared-utils';
import FileInput from './_components/FileInput.vue';
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
const form = ref<any>({ id: 0, type: 'COUPON', name: '', groupId: undefined, enabled: true, expiryType: 'PERMANENT', startAt: '', endAt: '', validDays: undefined, imageUrl: '', description: '', adminRemark: '', faceValue: undefined, perMemberLimit: undefined, minOrderAmount: undefined, applyScope: 'ALL', applicableProductIds: [], ruleKind: 'none', ruleAmount: undefined, rulePercent: undefined, ruleCap: undefined, ruleApplyBase: 'auto', ruleMinSubtotal: undefined, ruleJsonText: '', allowMiniappClaim: false, allowCombine: false, allowStackWithPoints: true, allowStackWithMemberDiscount: true, totalTimes: 0 });
const range = ref<[Date, Date] | ''>('');

// 发放弹窗状态
const issueShow = ref(false);
const issueCouponId = ref<number | null>(null);
const issueMemberIds = ref<number[]>([]);
const issueCount = ref(1);
const issuing = ref(false);

function openIssue(row:any){ issueCouponId.value = row.id; issueMemberIds.value = []; issueCount.value = 1; issueShow.value = true; }
async function doIssue(){ if (!issueCouponId.value || issueMemberIds.value.length === 0) { ElMessage.error('请选择会员'); return; } issuing.value = true; try{ for (const mid of issueMemberIds.value){ await http(`/coupons/${issueCouponId.value}/issue`, { method:'POST', body: { memberId: mid, count: issueCount.value } }); } issueShow.value = false; ElMessage.success('已发放'); } catch(e:any){ ElMessage.error(String(e?.message||e||'发放失败')); } finally { issuing.value = false; } }

function openCreate(){ form.value = { id: 0, type: 'COUPON', name: '', groupId: undefined, enabled: true, expiryType: 'PERMANENT', startAt: '', endAt: '', validDays: undefined, imageUrl: '', description: '', adminRemark: '', faceValue: undefined, issueTotal: undefined, perMemberLimit: undefined, minOrderAmount: undefined, applyScope: 'ALL', applicableProductIds: [], ruleKind: 'none', ruleAmount: undefined, rulePercent: undefined, ruleCap: undefined, ruleApplyBase: 'auto', ruleMinSubtotal: undefined, ruleJsonText: '', allowMiniappClaim: false, allowCombine: false, allowStackWithPoints: true, allowStackWithMemberDiscount: true, totalTimes: 0, }; range.value=''; show.value = true; }
function openEdit(row:any){ form.value = { id: row.id, type: row.type, name: row.name, groupId: row.groupId, enabled: row.enabled, expiryType: row.type==='WASH_CARD' ? (row.expiryType==='FIXED' ? 'AFTER_RECEIVE' : (row.expiryType||'PERMANENT')) : (row.expiryType || 'PERMANENT'), startAt: row.startAt, endAt: row.endAt, validDays: row.validDays, imageUrl: row.imageUrl || '', description: row.description || '', adminRemark: row.adminRemark || '', faceValue: row.faceValue, issueTotal: row.issueTotal, perMemberLimit: row.perMemberLimit, minOrderAmount: row.minOrderAmount, applyScope: row.applyScope || 'ALL', applicableProductIds: Array.isArray(row.applicableProducts) ? row.applicableProducts.map((x:any)=>x.productId) : [], ruleKind: (row.ruleJson && row.ruleJson.kind) ? row.ruleJson.kind : 'none', ruleAmount: (row.ruleJson && row.ruleJson.amount!=null) ? Number(row.ruleJson.amount) : undefined, rulePercent: (row.ruleJson && (row.ruleJson.percent!=null||row.ruleJson.amount!=null) && row.ruleJson.kind==='percent') ? Number(row.ruleJson.percent ?? row.ruleJson.amount) : undefined, ruleCap: (row.ruleJson && row.ruleJson.cap!=null) ? Number(row.ruleJson.cap) : undefined, ruleApplyBase: (row.ruleJson && row.ruleJson.applyBase) ? row.ruleJson.applyBase : 'auto', ruleMinSubtotal: (row.ruleJson && row.ruleJson.minSubtotal!=null) ? Number(row.ruleJson.minSubtotal) : undefined, ruleJsonText: row.ruleJson ? JSON.stringify(row.ruleJson) : '', allowMiniappClaim: !!row.allowMiniappClaim, allowCombine: !!row.allowCombine, allowStackWithPoints: row.allowStackWithPoints !== false, allowStackWithMemberDiscount: row.allowStackWithMemberDiscount !== false, totalTimes: row.totalTimes, }; if (row.startAt && row.endAt) range.value = [new Date(row.startAt), new Date(row.endAt)]; else range.value = '' as any; show.value = true; }

const viewShow = ref(false);
const view = ref<any>(null);
async function openView(row:any){ view.value = await http(`/coupons/${row.id}`); viewShow.value = true; }

watch(range, (v)=>{ if (Array.isArray(v)) { form.value.startAt = v[0]; form.value.endAt = v[1]; } else { form.value.startAt=''; form.value.endAt=''; } });

async function save(){ if (!form.value.name) { ElMessage.error('请输入名称'); return; } const payload: any = { type: form.value.type, name: form.value.name, groupId: form.value.groupId || null, enabled: form.value.enabled, expiryType: form.value.expiryType, startAt: form.value.expiryType==='FIXED' ? (form.value.startAt || null) : null, endAt: form.value.expiryType==='FIXED' ? (form.value.endAt || null) : null, validDays: form.value.expiryType==='AFTER_RECEIVE' ? (form.value.validDays || null) : null, imageUrl: form.value.imageUrl || null, description: form.value.description || null, adminRemark: form.value.adminRemark || null, };
	if (form.value.type === 'COUPON') {
		let built:any = null;
		if (form.value.ruleKind && form.value.ruleKind !== 'none') { built = { kind: form.value.ruleKind } as any; if (form.value.ruleKind==='direct') built.amount = Number(form.value.ruleAmount||0); if (form.value.ruleKind==='percent') built.percent = Number(form.value.rulePercent||0); if (form.value.ruleKind==='percent' && form.value.ruleCap!=null) built.cap = Number(form.value.ruleCap); if (form.value.ruleApplyBase==='order') built.applyBase = 'order'; if (form.value.ruleMinSubtotal!=null) built.minSubtotal = Number(form.value.ruleMinSubtotal); }
		try { const advanced = form.value.ruleJsonText ? JSON.parse(form.value.ruleJsonText) : null; payload.ruleJson = advanced || built; } catch { ElMessage.error('规则JSON格式错误'); return; }
		if (payload.ruleJson) { payload.faceValue = null; payload.minOrderAmount = null; } else { payload.faceValue = form.value.faceValue ?? null; payload.minOrderAmount = form.value.minOrderAmount ?? null; }
		payload.issueTotal = form.value.issueTotal ?? null; payload.perMemberLimit = form.value.perMemberLimit ?? null; payload.applyScope = form.value.applyScope; if (form.value.applyScope==='SPECIFIED'){ if (!Array.isArray(form.value.applicableProductIds) || form.value.applicableProductIds.length===0){ ElMessage.error('请选择至少一个指定商品'); return; } payload.applicableProductIds = form.value.applicableProductIds; } else { payload.applicableProductIds = []; } payload.allowMiniappClaim = !!form.value.allowMiniappClaim; payload.allowCombine = !!form.value.allowCombine; payload.allowStackWithPoints = form.value.allowStackWithPoints !== false; payload.allowStackWithMemberDiscount = form.value.allowStackWithMemberDiscount !== false; }
	else { payload.totalTimes = form.value.totalTimes || 0; }
	try { if (form.value.id) await http(`/coupons/${form.value.id}`, { method:'PUT', body: payload }); else await http('/coupons', { method:'POST', body: payload }); show.value = false; ElMessage.success('已保存'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); } }

async function remove(id:number){ try { await http(`/coupons/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

// 已用统一 FileInput 替代原生 input 上传

onMounted(async ()=>{ await Promise.all([fetchGroups(), fetchList(), fetchProducts()]); });

function zhType(t?: string){ const v = String(t||''); if (v==='COUPON') return '优惠券'; if (v==='WASH_CARD') return '洗车计次卡'; return v || '-'; }
function zhExpiryType(t?: string){ const v = String(t||''); if (v==='FIXED') return '固定时间'; if (v==='AFTER_RECEIVE') return '领取后生效'; if (v==='PERMANENT') return '永久有效'; return v || '-'; }
function formatLocal(d?: string){ try { if (!d) return '-'; const dt = new Date(d); if (isNaN(dt.getTime())) return '-'; const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const dd=String(dt.getDate()).padStart(2,'0'); const hh=String(dt.getHours()).padStart(2,'0'); const mm=String(dt.getMinutes()).padStart(2,'0'); const ss=String(dt.getSeconds()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`; } catch { return '-'; } }
</script>

<style scoped>
.toolbar{ display:flex; align-items:center; margin:12px 0; }
.alert-desc { white-space: normal; line-height: 1.6; display:flex; flex-direction: column; gap: 6px; }
</style>


