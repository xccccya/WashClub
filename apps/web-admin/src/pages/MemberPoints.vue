<template>
	<BasePage title="积分管理">
		<template #actions>
			<el-button type="primary" @click="openConfig">
				<el-icon style="vertical-align: middle; margin-right:4px;"><Setting /></el-icon>
				<span style="vertical-align: middle;">积分规则配置</span>
			</el-button>
			<el-button @click="openAdjust">
				<el-icon style="vertical-align: middle; margin-right:4px;"><EditPen /></el-icon>
				<span style="vertical-align: middle;">手动增减积分</span>
			</el-button>
		</template>
		<div class="points-page">
			<el-card class="filter-card" shadow="never">
				<el-form class="filter-form" :inline="true" @submit.prevent>
					<el-form-item label="关键词">
						<el-input
							v-model="q.keyword"
							placeholder="会员ID/UID/昵称/手机号"
							clearable
							style="width:240px;"
							@keyup.enter="onSearch"
						/>
					</el-form-item>
					<el-form-item label="来源">
						<el-select v-model="q.source" placeholder="全部" clearable style="width:180px;" @change="onAutoSearch">
							<el-option label="支付入账" value="PAY" />
							<el-option label="后台调整" value="ADMIN" />
							<el-option label="退款扣减/返还" value="REFUND" />
							<el-option label="订单使用" value="USE" />
						</el-select>
					</el-form-item>
					<el-form-item label="订单号">
						<el-input
							v-model="q.orderNo"
							placeholder="模糊匹配订单号"
							clearable
							style="width:220px;"
							@keyup.enter="onSearch"
						/>
					</el-form-item>
					<el-form-item label="时间范围">
						<el-date-picker
							v-model="q.dateRange"
							type="datetimerange"
							start-placeholder="开始时间"
							end-placeholder="结束时间"
							value-format="YYYY-MM-DDTHH:mm:ss.SSSZ"
							format="YYYY-MM-DD HH:mm"
							:shortcuts="dateShortcuts"
							style="width:360px;"
							@change="onAutoSearch"
						/>
					</el-form-item>
					<el-form-item class="filter-actions-item" label="" :label-width="0">
						<div class="filter-actions">
							<el-button type="primary" :loading="loading" @click="onSearch">
								<el-icon class="btn-icon"><Search /></el-icon>
								<span>查询</span>
							</el-button>
							<el-button :disabled="loading" @click="resetFilters">重置</el-button>
						</div>
					</el-form-item>
				</el-form>
			</el-card>

			<el-card class="table-card" shadow="never">
				<template #header>
					<div class="table-header">
						<div class="table-title">
							<div class="table-title__text">积分流水</div>
							<div class="table-title__sub muted">
								共 {{ total }} 条
							</div>
						</div>
					</div>
				</template>

				<el-table
					v-loading="loading"
					:data="logs"
					stripe
					size="small"
					row-key="id"
					class="nice-table"
					style="width:100%"
				>
					<template #empty>
						<el-empty description="暂无记录" />
					</template>
					<el-table-column prop="id" label="ID" width="90" />
					<el-table-column label="会员" min-width="160">
						<template #default="{ row }">
							<div class="member-cell">
								<div class="member-cell__top">
									<el-link class="member-cell__name" type="primary" :underline="false" @click="openDetail(Number(row.memberId||0))">
										{{ row?.member?.name || '-' }}
									</el-link>
									<span class="member-cell__phone mono">{{ maskPhone(row?.member?.phone) }}</span>
								</div>
								<div class="member-cell__meta muted">
									<span v-if="row?.member?.uid" class="kv">UID {{ row.member.uid }}</span>
									<span class="kv">ID {{ row.memberId }}</span>
								</div>
							</div>
						</template>
					</el-table-column>
					<el-table-column prop="createdAt" label="时间" width="190">
						<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
					</el-table-column>
					<el-table-column prop="change" label="变动" width="120" align="right">
						<template #default="{ row }">
							<span class="points-change" :class="{ 'points-change--pos': Number(row.change)>0, 'points-change--neg': Number(row.change)<0 }">
								{{ formatChange(row.change) }}
							</span>
						</template>
					</el-table-column>
					<el-table-column prop="source" label="来源" width="140">
						<template #default="{ row }">
							<el-tag size="small" :type="sourceTagType(row.source)" effect="light">
								{{ sourceLabel(row.source) }}
							</el-tag>
						</template>
					</el-table-column>
					<el-table-column label="关联订单" width="280">
						<template #default="{ row }">
							<template v-if="row.orderNo">
								<el-link class="mono" type="primary" :underline="false" @click="goOrder(row)">{{ row.orderNo }}</el-link>
							</template>
							<template v-else>-</template>
						</template>
					</el-table-column>
					<el-table-column prop="desc" label="备注" min-width="220" show-overflow-tooltip />
					<el-table-column label="操作" width="120" fixed="right">
						<template #default="{ row }">
							<el-button link type="primary" size="small" @click="openDetail(Number(row.memberId||0))">
								<el-icon><View /></el-icon>
								<span>详情</span>
							</el-button>
						</template>
					</el-table-column>
				</el-table>

				<div class="pager">
					<el-pagination
						background
						:total="total"
						:page-size="pageSize"
						:current-page="page"
						:page-sizes="[10,20,50,100]"
						layout="total, sizes, prev, pager, next, jumper"
						@current-change="onPageChange"
						@size-change="onPageSizeChange"
					/>
				</div>
			</el-card>
		</div>

		<el-dialog v-model="cfgVisible" title="积分规则配置" width="520px">
			<el-form :model="cfg" label-width="220px">
				<el-form-item label="每1元获取积分（整数）">
					<el-input-number v-model="cfg.pointsPerYuan" :min="0" :step="1" :precision="0" style="width:180px;" />
				</el-form-item>
				<el-form-item label="100积分抵扣金额（元）">
					<el-input-number v-model="cfg.pointsFenPerPointYuan" :min="0" :step="0.01" :precision="2" style="width:180px;" />
				</el-form-item>
				<el-form-item label="单笔订单最多抵扣（元，0不限）">
					<el-input-number v-model="cfg.pointsMaxDeductYuan" :min="0" :step="0.01" :precision="2" style="width:180px;" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="cfgVisible=false">取消</el-button>
				<el-button type="primary" @click="saveConfig">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="adjustVisible" title="手动增减积分" width="520px">
			<el-form :model="adjust" label-width="120px">
				<el-form-item label="选择会员">
					<el-select v-model="adjust.memberId" filterable remote reserve-keyword placeholder="输入昵称/手机号搜索" :remote-method="remoteSearchMembers" :loading="memberLoading" style="width:320px;">
						<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name || '-'}（${m.phone}）#${m.id}`" :value="m.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="增减值（可负）">
					<el-input-number v-model="adjust.delta" :step="1" :precision="0" style="width:220px;" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="adjust.remark" style="width:320px;" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="adjustVisible=false">取消</el-button>
				<el-button type="primary" @click="submitAdjust">提交</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="detailVisible" title="积分详情" width="820px">
			<div v-if="detailMember">
				<el-card shadow="never" style="margin-bottom:12px;">
					<div class="detail-top">
						<div class="detail-card detail-user">
							<div class="detail-user__avatar" aria-hidden="true">{{ detailAvatarText }}</div>
							<div class="detail-user__main">
								<div class="detail-user__title">
									<span class="detail-user__name">{{ detailMember?.name || '-' }}</span>
									<el-tag size="small" effect="light" type="info">ID {{ detailMemberId || '-' }}</el-tag>
									<el-tag v-if="detailMember?.uid" size="small" effect="light">UID {{ detailMember.uid }}</el-tag>
								</div>
								<div class="detail-user__meta muted">
									<span>手机号：<span class="mono">{{ detailMember?.phone || '-' }}</span></span>
								</div>
							</div>
						</div>

						<div class="detail-card detail-stats">
							<div class="stat-card">
								<div class="stat-card__label muted">当前积分</div>
								<div class="stat-card__num stat-card__num--neutral">{{ detailStats.currentPoints }}</div>
							</div>
							<div class="stat-card">
								<div class="stat-card__label muted">本月使用</div>
								<div class="stat-card__num stat-card__num--neg">{{ detailStats.monthUsed }}</div>
							</div>
							<div class="stat-card">
								<div class="stat-card__label muted">本月获得</div>
								<div class="stat-card__num stat-card__num--pos">{{ detailStats.monthGained }}</div>
							</div>
							<div class="stat-card">
								<div class="stat-card__label muted">累计抵扣(元)</div>
								<div class="stat-card__num stat-card__num--primary">{{ detailStats.totalDeductYuan.toFixed(2) }}</div>
							</div>
						</div>

						<div class="detail-card detail-adjust">
							<div class="detail-adjust__title">快速增减</div>
							<el-form :model="detailAdjust" class="detail-adjust-form" @submit.prevent>
								<el-form-item label="" :label-width="0">
									<el-input-number
										v-model="detailAdjust.delta"
										:step="1"
										:precision="0"
										controls-position="right"
										style="width: 100%;"
									/>
								</el-form-item>
								<el-form-item label="" :label-width="0">
									<el-input v-model="detailAdjust.remark" placeholder="备注（可选）" clearable />
								</el-form-item>
								<div class="detail-adjust-actions">
									<el-popconfirm
										:width="320"
										:title="detailAdjustConfirmTitle"
										confirm-button-text="确认"
										cancel-button-text="取消"
										:disabled="detailAdjustDisabled || detailAdjustLoading"
										@confirm="submitDetailAdjust"
									>
										<template #reference>
											<el-button type="primary" size="small" :loading="detailAdjustLoading" :disabled="detailAdjustDisabled">提交</el-button>
										</template>
									</el-popconfirm>
									<el-button size="small" :disabled="detailAdjustLoading" @click="resetDetailAdjust">清空</el-button>
								</div>
								<div class="detail-adjust-tip muted">正数增加，负数扣减</div>
							</el-form>
						</div>
					</div>
				</el-card>

				<div>
					<el-table :data="detailLogs" stripe size="small" class="nice-table" style="width:100%">
						<template #empty>
							<el-empty description="暂无记录" />
						</template>
						<el-table-column prop="createdAt" label="时间" width="180">
							<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
						</el-table-column>
						<el-table-column prop="change" label="变动" width="120">
							<template #default="{ row }"><span :style="{ color: row.change>0?'#16a34a':'#ef4444' }">{{ row.change>0? '+'+row.change : row.change }}</span></template>
						</el-table-column>
						<el-table-column prop="source" label="来源" width="120">
							<template #default="{ row }">
								<el-tag size="small" :type="sourceTagType(row.source)" effect="light">{{ sourceLabel(row.source) }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column label="关联订单" width="180">
							<template #default="{ row }">
								<template v-if="row.orderNo">
									<el-link class="mono" type="primary" :underline="false" @click="goOrder(row)">{{ row.orderNo }}</el-link>
								</template>
								<template v-else>-</template>
							</template>
						</el-table-column>
						<el-table-column prop="desc" label="备注" />
					</el-table>
				</div>
			</div>
			<template #footer>
				<el-button @click="detailVisible=false">关闭</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { BasePage } from '@wash/shared-ui';
import {
	memberControllerGet,
	memberControllerList,
	memberPointsControllerAdjust,
	memberPointsControllerGetConfig,
	memberPointsControllerSave,
	memberPointsControllerListLogs,
	memberPointsControllerListLogsPaged,
} from '@wash/api-client';
import { ElMessage } from 'element-plus';
import { Setting, EditPen, Search, View } from '@element-plus/icons-vue';
import router from '../router';

const q = ref<{ keyword?: string; source?: string; orderNo?: string; dateRange?: [string, string] | [] }>({
	keyword: '',
	source: undefined,
	orderNo: '',
	dateRange: [],
});
const loading = ref(false);
const logs = ref<any[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const dateShortcuts = [
	{
		text: '近7天',
		value: () => {
			const end = new Date();
			const start = new Date();
			start.setDate(start.getDate() - 7);
			return [start, end];
		},
	},
	{
		text: '本月',
		value: () => {
			const now = new Date();
			const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
			const end = new Date();
			return [start, end];
		},
	},
];

async function fetchLogs(resetToFirstPage = false){
	if (resetToFirstPage) page.value = 1;
	loading.value = true;
	try{
		const [from, to] = Array.isArray(q.value.dateRange) ? (q.value.dateRange as any) : [];
		const res:any = await memberPointsControllerListLogsPaged({
			page: page.value,
			pageSize: pageSize.value,
			source: q.value.source || undefined,
			orderNo: String(q.value.orderNo || '').trim() || undefined,
			keyword: String(q.value.keyword || '').trim() || undefined,
			from: from || undefined,
			to: to || undefined,
		} as any);
		logs.value = Array.isArray(res?.items) ? res.items : [];
		total.value = Number(res?.total || 0) || 0;
	} catch (e:any) {
		ElMessage.error(String(e?.message||e||'加载失败'));
	} finally {
		loading.value = false;
	}
}

function onSearch(){ fetchLogs(true); }
let _autoTimer: any = null;
function onAutoSearch(){
	if (_autoTimer) clearTimeout(_autoTimer);
	_autoTimer = setTimeout(()=> fetchLogs(true), 250);
}
function resetFilters(){
	q.value = { keyword: '', source: undefined, orderNo: '', dateRange: [] };
	fetchLogs(true);
}
function onPageChange(p: number){ page.value = p; fetchLogs(false); }
function onPageSizeChange(s: number){ pageSize.value = s; page.value = 1; fetchLogs(false); }

function sourceLabel(src?: string){
	const s = String(src || '').toUpperCase();
	if (s === 'PAY') return '支付入账';
	if (s === 'ADMIN') return '后台调整';
	if (s === 'REFUND') return '退款扣减/返还';
	if (s === 'USE') return '订单使用';
	return s || '-';
}
function sourceTagType(src?: string): 'success'|'warning'|'info'|'danger'|'' {
	const s = String(src || '').toUpperCase();
	if (s === 'PAY') return 'success';
	if (s === 'ADMIN') return 'warning';
	if (s === 'REFUND') return 'info';
	if (s === 'USE') return 'danger';
	return '';
}

const cfgVisible = ref(false);
const cfg = ref<{ pointsPerYuan:number; pointsFenPerPoint:number; pointsMaxDeductFenPerOrder:number; pointsFenPerPointYuan:number; pointsMaxDeductYuan:number }>({ pointsPerYuan: 0, pointsFenPerPoint: 0, pointsMaxDeductFenPerOrder: 0, pointsFenPerPointYuan: 0, pointsMaxDeductYuan: 0 });

async function openConfig(){
  try{
    const res:any = (await memberPointsControllerGetConfig() as unknown) as any;
    const fenPerPoint = Number(res?.pointsFenPerPoint || 0);
    const maxFen = Number(res?.pointsMaxDeductFenPerOrder || 0);
    // pointsPerYuan：新版字段；若后端尚未返回（或迁移未跑），则按旧字段 pointsPerFen * 100 兜底
    const legacyPerFen = Number(res?.pointsPerFen ?? 0);
    cfg.value.pointsPerYuan = Math.max(0, Math.floor(Number(res?.pointsPerYuan ?? 0))) || (Math.max(0, Math.floor(legacyPerFen)) * 100);
    cfg.value.pointsFenPerPoint = fenPerPoint;
    cfg.value.pointsMaxDeductFenPerOrder = maxFen;
    cfg.value.pointsFenPerPointYuan = +(fenPerPoint / 100).toFixed(2);
    cfg.value.pointsMaxDeductYuan = +(maxFen / 100).toFixed(2);
    cfgVisible.value = true;
  }catch(e:any){ ElMessage.error(String(e?.message||e||'加载失败')); }
}
async function saveConfig(){
  try{
    const payload = {
      pointsPerYuan: cfg.value.pointsPerYuan,
      pointsFenPerPoint: (cfg.value.pointsFenPerPointYuan || 0) * 100,
      pointsMaxDeductFenPerOrder: (cfg.value.pointsMaxDeductYuan || 0) * 100,
    };
    await memberPointsControllerSave(payload as any);
    ElMessage.success('已保存'); cfgVisible.value=false;
  }catch(e:any){ ElMessage.error(String(e?.message||e||'保存失败')); }
}

const adjustVisible = ref(false);
const adjust = ref<{ memberId?: number; delta?: number; remark?: string }>({});
function openAdjust(){ adjust.value = {}; adjustVisible.value = true; }
const memberOptions = ref<any[]>([]);
const memberLoading = ref(false);
let _memberSearchTimer: any = null;
async function remoteSearchMembers(keyword: string){
  if (_memberSearchTimer) clearTimeout(_memberSearchTimer);
  _memberSearchTimer = setTimeout(async ()=>{
    memberLoading.value = true;
    try{
      const res:any = (await memberControllerList({ page: 1, pageSize: 20, keyword } as any) as unknown) as any;
      memberOptions.value = Array.isArray(res?.items) ? res.items : [];
    } finally { memberLoading.value = false; }
  }, 250);
}
async function submitAdjust(){
  try{
    await memberPointsControllerAdjust({ ...(adjust.value as any), operatorUserId: getUserId() } as any);
    ElMessage.success('已调整'); adjustVisible.value=false; fetchLogs(true);
  }catch(e:any){ ElMessage.error(String(e?.message||e||'提交失败')); }
}

onMounted(()=>{ fetchLogs(true); });

function formatTime(t?: string){ try{ return new Date(t||'').toLocaleString(); }catch{ return String(t||'-'); } }
function getUserId(): number | null { try{ const s = localStorage.getItem('user')||'{}'; const u = JSON.parse(s); return Number(u?.id||0) || null; }catch{ return null; } }
function goOrder(row:any){
  try{
    const id = Number(row?.orderId || 0);
    const no = String(row?.orderNo || '');
    if (id) { router.push('/orders/' + id); return; }
    if (no) { router.push('/orders/no/' + encodeURIComponent(no)); return; }
  }catch(e){}
}

function formatMemberLabel(row: any){
	const m = row?.member;
	const name = m?.name ? String(m.name) : '-';
	const phone = m?.phone ? String(m.phone) : '-';
	return `${name}（${phone}）`;
}
function formatChange(v: any){
	const n = Number(v || 0);
	if (n > 0) return `+${n}`;
	return String(n);
}

function maskPhone(phone?: string){
	const p = String(phone || '').trim();
	if (!p) return '-';
	if (p.length <= 4) return '****' + p;
	return '****' + p.slice(-4);
}

const detailVisible = ref(false);
const detailMember = ref<any>(null);
const detailLogs = ref<any[]>([]);
const detailStats = ref<{ currentPoints:number; monthUsed:number; monthGained:number; totalDeductFen:number; totalDeductYuan:number }>({ currentPoints:0, monthUsed:0, monthGained:0, totalDeductFen:0, totalDeductYuan:0 });
const detailMemberId = ref<number | null>(null);
const detailAdjust = ref<{ delta?: number; remark?: string }>({ delta: undefined, remark: '' });
const detailAdjustLoading = ref(false);

const detailAdjustDisabled = computed(() => {
	const mid = Number(detailMemberId.value || 0);
	const delta = Number(detailAdjust.value?.delta || 0);
	return !mid || !delta || detailAdjustLoading.value;
});

const detailAdjustConfirmTitle = computed(() => {
	const name = String(detailMember.value?.name || '').trim() || '该会员';
	const mid = detailMemberId.value;
	const delta = Number(detailAdjust.value?.delta || 0);
	const deltaText = delta > 0 ? `+${delta}` : String(delta);
	const remark = String(detailAdjust.value?.remark || '').trim();
	return `确认对 ${name}${mid ? `（ID ${mid}）` : ''} 调整积分 ${deltaText}${remark ? `？备注：${remark}` : '？'}`;
});

const detailAvatarText = computed(() => {
	const name = String(detailMember.value?.name || '').trim();
	if (name) return name.slice(0, 1);
	const phone = String(detailMember.value?.phone || '').trim();
	if (phone) return phone.slice(-4);
	return 'U';
});

function resetDetailAdjust(){
	detailAdjust.value = { delta: undefined, remark: '' };
}

async function submitDetailAdjust(){
	const mid = Number(detailMemberId.value || 0);
	const delta = Number(detailAdjust.value?.delta || 0);
	if (!mid) { ElMessage.warning('未找到会员ID'); return; }
	if (!delta) { ElMessage.warning('请输入增减值（不可为 0）'); return; }
	detailAdjustLoading.value = true;
	try{
		await memberPointsControllerAdjust({ memberId: mid, delta, remark: detailAdjust.value?.remark || '', operatorUserId: getUserId() } as any);
		ElMessage.success('已调整');
		resetDetailAdjust();
		await openDetail(mid); // 刷新详情（积分/流水/统计）
		await fetchLogs(false); // 刷新主列表（不重置分页）
	}catch(e:any){
		ElMessage.error(String(e?.message||e||'提交失败'));
	}finally{
		detailAdjustLoading.value = false;
	}
}

async function openDetail(memberId: number){
  try{
		detailMemberId.value = memberId;
    const [m, rows, cfg]: any = await Promise.all([
      memberControllerGet(String(memberId)) as any,
      memberPointsControllerListLogs({ memberId: String(memberId) } as any) as any,
      memberPointsControllerGetConfig() as any,
    ]);
    const logsArr:any[] = Array.isArray(rows) ? rows : [];
    detailMember.value = m || null;
    detailLogs.value = logsArr;

    const currentPoints = Math.max(0, Number(m?.points || 0));
    const fenPerPoint = Math.max(0, Number(cfg?.pointsFenPerPoint || 0));

    // 本月范围
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth()+1, 1, 0, 0, 0, 0);
    let monthUsed = 0, monthGained = 0, refundReturnedPos = 0;
    for (const r of logsArr){
      const createdAt = new Date(r?.createdAt || 0);
      if (!(createdAt >= start && createdAt < end)) continue;
      const ch = Number(r?.change || 0);
      const src = String(r?.source || '');
      if (src === 'USE' && ch < 0) monthUsed += Math.abs(ch);
      if (src === 'REFUND' && ch > 0) refundReturnedPos += ch; // 退款返还
      if ((src === 'PAY' || src === 'ADMIN') && ch > 0) monthGained += ch;
      if (src === 'REFUND' && ch < 0) monthGained += ch; // 扣除本月获得
    }
    monthUsed = Math.max(0, monthUsed - refundReturnedPos);
    if (monthGained < 0) monthGained = 0;

    // 累计抵扣金额（元）：净使用积分 * 单位面值
    let totalUse = 0, totalRefundReturn = 0;
    for (const r of logsArr){
      const ch = Number(r?.change || 0);
      const src = String(r?.source || '');
      if (src === 'USE' && ch < 0) totalUse += Math.abs(ch);
      if (src === 'REFUND' && ch > 0) totalRefundReturn += ch;
    }
    const netUsedPoints = Math.max(0, totalUse - totalRefundReturn);
    const totalDeductFen = Math.max(0, Math.floor(netUsedPoints * fenPerPoint));
    const totalDeductYuan = +(totalDeductFen / 100).toFixed(2);

    detailStats.value = { currentPoints, monthUsed, monthGained, totalDeductFen, totalDeductYuan };
    detailVisible.value = true;
  }catch(e:any){ ElMessage.error(String(e?.message||e||'加载失败')); }
}
</script>

<style scoped>
.points-page{
	height: 100%;
	min-height: 0;
	overflow: auto;
	/* 避免滚动条遮挡内容 */
	padding-right: 2px;
}
.filter-card{
	margin: 8px 0 12px 0;
	border-radius: 14px;
}
.filter-form{
	display:flex;
	flex-wrap:wrap;
	gap: 10px 12px;
	align-items:center;
}
.filter-form :deep(.el-form-item){
	margin-right: 0;
	margin-bottom: 0;
	align-items: center;
}
.filter-form :deep(.el-form-item__label){
	line-height: 32px;
	padding-bottom: 0;
	color: var(--el-text-color-regular);
}
.filter-form :deep(.el-form-item__content){
	line-height: 32px;
	align-items: center;
}
.filter-actions-item{
	margin-left: auto;
	align-self: center;
}
.filter-actions-item :deep(.el-form-item__content){
	justify-content: flex-end;
}
.filter-actions{
	display:flex;
	gap:10px;
	align-items:center;
	padding-bottom: 2px;
}
.btn-icon{
	margin-right: 4px;
	vertical-align: middle;
}
.table-card{
	border-radius: 14px;
}
.table-card :deep(.el-card__body){
	padding-top: 8px;
}
.table-header{
	display:flex;
	align-items:center;
	justify-content: space-between;
	gap: 12px;
}
.table-title{
	display:flex;
	flex-direction:column;
	gap:2px;
}
.table-title__text{
	font-size: 14px;
	font-weight: 800;
	color: #111827;
	letter-spacing: .2px;
}
.table-title__sub{
	font-size: 12px;
}
.muted{ color: var(--el-text-color-secondary); }
.nice-table :deep(.el-table__inner-wrapper::before){
	background-color: transparent;
}
.nice-table :deep(.el-table__header-wrapper th){
	background: color-mix(in oklab, var(--el-fill-color-light), transparent 15%);
	color: color-mix(in oklab, var(--el-text-color-primary), #111827 20%);
	font-weight: 700;
}
.nice-table :deep(.el-table__cell){
	padding: 10px 12px;
}
.member-cell{ display:flex; flex-direction:column; gap:4px; }
.member-cell__top{ display:flex; align-items:center; gap:10px; min-width: 0; }
.member-cell__name{ font-weight: 700; min-width: 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.member-cell__phone{ font-size: 12px; color: var(--el-text-color-secondary); }
.member-cell__meta{ display:flex; gap:10px; font-size:12px; }
.kv{
	display:inline-flex;
	align-items:center;
	gap:6px;
}
.mono{ font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.points-change{ font-weight: 800; font-variant-numeric: tabular-nums; }
.points-change--pos{ color:#16a34a; }
.points-change--neg{ color:#ef4444; }
.pager{ display:flex; justify-content:flex-end; margin-top: 12px; }

.detail-top{
	display:grid;
	grid-template-columns: 1.05fr 1.4fr 0.95fr;
	gap: 12px;
	align-items: stretch;
}
.detail-card{
	background: color-mix(in oklab, var(--el-fill-color-light), transparent 25%);
	border: 1px solid color-mix(in oklab, var(--el-border-color), transparent 10%);
	border-radius: 14px;
	padding: 12px;
}

.detail-user{
	display:flex;
	gap: 12px;
	align-items:flex-start;
}
.detail-user__avatar{
	width: 40px;
	height: 40px;
	border-radius: 12px;
	display:flex;
	align-items:center;
	justify-content:center;
	font-weight: 900;
	letter-spacing: .2px;
	color: var(--el-color-primary);
	background: color-mix(in oklab, var(--el-color-primary), #fff 88%);
	border: 1px solid color-mix(in oklab, var(--el-color-primary), #fff 70%);
	flex: 0 0 auto;
}
.detail-user__main{ min-width: 0; display:flex; flex-direction:column; gap: 6px; }
.detail-user__title{
	display:flex;
	align-items:center;
	flex-wrap: wrap;
	gap: 8px;
	min-width: 0;
}
.detail-user__name{
	font-size: 14px;
	font-weight: 900;
	color: #111827;
	letter-spacing: .2px;
	max-width: 260px;
	overflow:hidden;
	text-overflow:ellipsis;
	white-space:nowrap;
}
.detail-user__meta{ font-size: 12px; }

.detail-stats{
	display:grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;
}
.stat-card{
	background: var(--el-bg-color);
	border: 1px solid color-mix(in oklab, var(--el-border-color), transparent 20%);
	border-radius: 12px;
	padding: 10px 12px;
	display:flex;
	flex-direction: column;
	gap: 6px;
	min-width: 0;
}
.stat-card__label{ font-size: 12px; }
.stat-card__num{
	font-size: 22px;
	font-weight: 900;
	line-height: 1;
	color: #111827;
	font-variant-numeric: tabular-nums;
}
.stat-card__num--neutral{ color:#111827; }
.stat-card__num--neg{ color:#ef4444; }
.stat-card__num--pos{ color:#16a34a; }
.stat-card__num--primary{ color:#2563eb; }

.detail-adjust{
	display:flex;
	flex-direction: column;
	justify-content: space-between;
}
.detail-adjust__title{
	font-size: 12px;
	font-weight: 800;
	color: #111827;
	margin-bottom: 8px;
	letter-spacing: .2px;
}
.detail-adjust-form :deep(.el-form-item){
	margin-bottom: 8px;
}
.detail-adjust-actions{
	display:flex;
	gap: 8px;
	align-items:center;
}
.detail-adjust-tip{
	margin-top: 6px;
	font-size: 12px;
}

@media (max-width: 860px){
	.detail-top{
		grid-template-columns: 1fr;
	}
}
</style>


