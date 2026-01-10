<template>
	<el-dialog
		:model-value="modelValue"
		@update:model-value="(v:boolean)=>emit('update:modelValue', v)"
		title="车辆信息"
		width="min(920px, 94vw)"
		append-to-body
		@closed="resetAll"
	>
		<div class="view-wrap">
			<el-skeleton v-if="vehicleLoading" :rows="10" animated />
			<template v-else>
				<el-alert
					v-if="vehicle && isNoPlateRow(vehicle)"
					type="warning"
					show-icon
					:closable="false"
					title="系统保留无牌车：已锁定"
					description="该车辆用于无牌车/忘记车牌的下单与入队占位。为避免误操作，不允许在后台编辑/删除/绑定/改绑。"
				/>

				<el-card v-if="vehicle" shadow="never" class="vehicle-card">
					<div class="vehicle-card__grid">
						<div class="vehicle-card__main">
							<div class="vehicle-card__head">
								<div class="vehicle-card__plate">
									<span :class="['plate-chip', plateClass(vehicle.plateNumber)]">{{ vehicle.plateNumber }}</span>
									<el-tag size="small" :type="vehicle.isDefault ? 'success' : 'info'">
										{{ vehicle.isDefault ? '默认车' : '非默认' }}
									</el-tag>
									<el-tag v-if="vehicle.group" size="small" type="info" effect="plain">集团：{{ vehicle.group.name }}</el-tag>
								</div>
								<div class="vehicle-card__meta">
									<div class="meta-pill" title="品牌">
										<img v-if="vehicle.brandImage" :src="toAbs(vehicle.brandImage)" class="meta-icon" />
										<span class="meta-k">品牌</span>
										<span class="meta-v">{{ vehicle.brand || '-' }}</span>
									</div>
									<div class="meta-pill" title="车系">
										<span class="meta-k">车系</span>
										<span class="meta-v">{{ vehicle.series || '-' }}</span>
									</div>
									<div class="meta-pill" title="类型">
										<span class="meta-k">类型</span>
										<span class="meta-v">{{ (vehicle.typeMain||'-') + (vehicle.typeSub?(' / '+vehicle.typeSub):'') }}</span>
									</div>
									<div class="meta-pill" title="颜色">
										<span class="meta-k">颜色</span>
										<el-tag size="small" class="meta-color" :style="colorTagStyle(vehicle.color)">{{ vehicle.color || '-' }}</el-tag>
									</div>
								</div>
								<div class="vehicle-card__sub muted">
									<span>ID {{ vehicle.id }}</span>
									<span class="dot">·</span>
									<span>VIN {{ vehicle.vin || '-' }}</span>
									<span class="dot">·</span>
									<span v-if="vehicle.member">{{ `${vehicle.member.name}（${vehicle.member.phone}）` }}</span>
									<span v-else-if="vehicle.group">集团车辆</span>
									<span v-else>游客</span>
								</div>
							</div>

							<div class="vehicle-card__kv">
								<div class="kv kv-strong">
									<div class="k">累计消费金额</div>
									<div class="v v-strong">
										<el-skeleton v-if="metricsLoading" :rows="1" animated style="width: 120px;" />
										<template v-else>
											<span class="money">￥{{ formatMoney(metricsSpentAmount) }}</span>
										</template>
									</div>
								</div>
								<div class="kv kv-strong">
									<div class="k">累计洗车次数</div>
									<div class="v v-strong">
										<el-skeleton v-if="metricsLoading" :rows="1" animated style="width: 90px;" />
										<template v-else>
											<span class="count">{{ metricsWashTimes }}</span>
											<span class="unit">次</span>
										</template>
									</div>
								</div>
								<div class="kv kv-strong">
									<div class="k">洗车卡划扣次数</div>
									<div class="v v-strong">
										<el-skeleton v-if="metricsLoading" :rows="1" animated style="width: 90px;" />
										<template v-else>
											<span class="count">{{ metricsWashCardDeductTimes }}</span>
											<span class="unit">次</span>
										</template>
									</div>
								</div>
								<div class="kv">
									<div class="k">创建 / 修改</div>
									<div class="v v-col">
										<div class="v-line"><span class="muted">创建</span><span class="mono">{{ formatDateTime(vehicle.createdAt) }}</span></div>
										<div class="v-line"><span class="muted">修改</span><span class="mono">{{ formatDateTime(vehicle.updatedAt) }}</span></div>
									</div>
								</div>
								<div class="kv">
									<div class="k">最近一次到店</div>
									<div class="v">
										<el-skeleton v-if="lastVisitLoading" :rows="1" animated style="width: 160px;" />
										<template v-else>
											<span>{{ lastVisitAt ? formatDateTime(lastVisitAt) : '-' }}</span>
											<el-button
												v-if="canViewOrders() && lastVisitOrderId"
												size="small"
												link
												type="primary"
												@click="openOrderInNewTab(lastVisitOrderId)"
											>
												查看订单
											</el-button>
										</template>
									</div>
								</div>
								<div class="kv">
									<div class="k">订单记录</div>
									<div class="v">
										<template v-if="canViewOrders()">
											<el-button size="small" type="primary" plain @click="openOrdersDrawer">查看全部</el-button>
											<span v-if="ordersTotalKnown" class="muted" style="font-size:12px;">共 {{ ordersTotal }} 单</span>
										</template>
										<template v-else>
											<span class="muted">无权限</span>
										</template>
									</div>
								</div>
							</div>
						</div>
					</div>
				</el-card>

				<!-- 车辆订单记录（抽屉） -->
				<el-drawer
					v-model="ordersDrawer"
					append-to-body
					direction="rtl"
					size="min(760px, 92vw)"
					:with-header="true"
				>
					<template #header>
						<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
							<div style="min-width:0;">
								<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
									<span style="font-weight:700;">订单记录</span>
									<el-tag size="small" effect="light">{{ vehicle?.plateNumber || '-' }}</el-tag>
								</div>
								<div class="muted" style="font-size:12px;margin-top:2px;">
									最近到店：{{ lastVisitAt ? formatDateTime(lastVisitAt) : '—' }}
								</div>
							</div>
							<div style="display:flex;align-items:center;gap:8px;flex:0 0 auto;">
								<el-button size="small" @click="fetchVehicleOrders" :loading="ordersLoading">刷新</el-button>
							</div>
						</div>
					</template>

					<div style="padding: 8px 0;">
						<el-skeleton v-if="ordersLoading && orders.length===0" :rows="6" animated />
						<el-empty v-else-if="!ordersLoading && orders.length===0" description="暂无订单记录" />
						<el-table v-else :data="orders" stripe size="small" style="width:100%">
							<el-table-column prop="createdAt" label="时间" width="170">
								<template #default="{ row }">{{ formatShortTime(row.createdAt) }}</template>
							</el-table-column>
							<el-table-column label="订单号" min-width="210" show-overflow-tooltip>
								<template #default="{ row }">
									<el-button link type="primary" class="mono" @click="openOrderInNewTab(row.id)">{{ row.no || `#${row.id}` }}</el-button>
								</template>
							</el-table-column>
							<el-table-column label="类型" width="90">
								<template #default="{ row }">{{ formatOrderType(row.type) }}</template>
							</el-table-column>
							<el-table-column label="状态" width="110">
								<template #default="{ row }">
									<el-tag size="small" :type="orderStatusTagType(row)">{{ formatOrderStatus(row) }}</el-tag>
								</template>
							</el-table-column>
							<el-table-column label="金额" width="110" align="right">
								<template #default="{ row }">￥{{ formatMoney(row.payAmount) }}</template>
							</el-table-column>
							<el-table-column label="操作" width="120" fixed="right">
								<template #default="{ row }">
									<el-button size="small" type="primary" link @click="openOrderInNewTab(row.id)">打开详情</el-button>
								</template>
							</el-table-column>
						</el-table>

						<div v-if="ordersTotal>ordersPageSize" style="margin-top:12px;display:flex;justify-content:flex-end;">
							<el-pagination
								background
								layout="sizes, prev, pager, next, jumper"
								:total="ordersTotal"
								:page-size="ordersPageSize"
								:current-page="ordersPage"
								:page-sizes="[10,20,30,50]"
								@current-change="(p:number)=>{ ordersPage=p; fetchVehicleOrders(); }"
								@size-change="(s:number)=>{ ordersPageSize=s; ordersPage=1; fetchVehicleOrders(); }"
							/>
						</div>
					</div>
				</el-drawer>

				<!-- 改绑记录 -->
				<el-card v-if="vehicle" shadow="never" class="inline-card rebind-logs-card">
					<div class="section-head">
						<div class="section-title">改绑记录</div>
						<div style="display:flex; align-items:center; gap:8px;">
							<el-button size="small" @click="fetchRebindLogs" :loading="rebindLogsLoading" :disabled="!canViewRebindLogs">刷新</el-button>
						</div>
					</div>
					<el-alert v-if="!canViewRebindLogs" type="info" show-icon :closable="false" title="无权限查看改绑记录" />
					<template v-else>
						<el-skeleton v-if="rebindLogsLoading && rebindLogs.length===0" :rows="4" animated />
						<el-empty v-else-if="rebindLogs.length===0" description="暂无改绑记录" />
						<el-table v-else :data="rebindLogs" stripe size="small" style="width:100%">
							<el-table-column prop="createdAt" label="时间" width="180">
								<template #default="{ row }">{{ formatShortTime(row.createdAt) }}</template>
							</el-table-column>
							<el-table-column label="变更" min-width="260" show-overflow-tooltip>
								<template #default="{ row }">{{ formatSubject(row, 'from') }} → {{ formatSubject(row, 'to') }}</template>
							</el-table-column>
							<el-table-column label="操作人" width="200" show-overflow-tooltip>
								<template #default="{ row }">{{ formatOperator(row) }}</template>
							</el-table-column>
							<el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
						</el-table>
						<div v-if="rebindLogsTotal>rebindLogsPageSize" style="margin-top:12px;display:flex;justify-content:flex-end;">
							<el-pagination
								background
								layout="sizes, prev, pager, next, jumper"
								:total="rebindLogsTotal"
								:page-size="rebindLogsPageSize"
								:current-page="rebindLogsPage"
								:page-sizes="[10,20,30,50]"
								@current-change="(p:number)=>{ rebindLogsPage=p; fetchRebindLogs(); }"
								@size-change="(s:number)=>{ rebindLogsPageSize=s; rebindLogsPage=1; fetchRebindLogs(); }"
							/>
						</div>
					</template>
				</el-card>
			</template>
		</div>
		<template #footer>
			<el-button @click="emit('update:modelValue', false)">关闭</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';

type Vehicle = {
	id: number;
	plateNumber: string;
	vin?: string | null;
	brand?: string | null;
	series?: string | null;
	typeMain?: string | null;
	typeSub?: string | null;
	color?: string | null;
	isDefault: boolean;
	memberId?: number | null;
	groupId?: number | null;
	brandImage?: string | null;
	seriesImage?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	member?: { id: number; name: string; phone: string } | null;
	group?: { id: number; name: string } | null;
};

const props = defineProps<{
	modelValue: boolean;
	vehicleId: number | null;
	/**
	 * 无牌车占位车牌号（用于展示“系统保留无牌车”提示）
	 * 不传则仅按车牌字面判断失败时不提示
	 */
	noPlateNumber?: string;
	/**
	 * 打开订单详情的路径前缀：默认 /admin/orders
	 * POS 端可传 /pos/orders
	 */
	orderUrlPrefix?: string;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', v: boolean): void;
}>();

const orderUrlPrefix = computed(() => (props.orderUrlPrefix || '/admin/orders').replace(/\/+$/, ''));

function getApiBase(): string {
	// applyApiBaseToGlobals 会注入到全局，shared-ui 内不依赖具体应用 config
	try {
		const g: any = globalThis as any;
		return String(g?.__VITE_API_BASE__ || g?.VITE_API_BASE || '').trim().replace(/\/+$/, '');
	} catch {
		return '';
	}
}

function absUrl(u?: string | null): string {
	if (!u) return '';
	const s = String(u);
	if (/^https?:\/\//i.test(s)) return s;
	const base = getApiBase();
	if (!base) return s;
	if (s.startsWith('/')) return `${base}${s}`;
	if (s.startsWith('uploads/')) return `${base}/${s}`;
	return `${base}/${s}`;
}
function toAbs(u?: string | null) { return absUrl(u || ''); }

function isNoPlateRow(v: any): boolean {
	try {
		const plate = String(v?.plateNumber || '').trim().toUpperCase();
		const target = String(props.noPlateNumber || '').trim().toUpperCase();
		return !!plate && !!target && plate === target;
	} catch {
		return false;
	}
}

const vehicle = ref<Vehicle | null>(null);
const vehicleLoading = ref(false);

// 车辆订单 / 最近到店
const lastVisitLoading = ref(false);
const lastVisitAt = ref<string | null>(null);
const lastVisitOrderId = ref<number | null>(null);
const ordersDrawer = ref(false);
const ordersLoading = ref(false);
const orders = ref<any[]>([]);
const ordersTotal = ref(0);
const ordersTotalKnown = ref(false);
const ordersPage = ref(1);
const ordersPageSize = ref(20);

// 车辆统计
const metricsLoading = ref(false);
const metricsWashCardDeductTimes = ref(0);
const metricsSpentAmount = ref(0);
const metricsWashTimes = ref(0);

// 改绑记录
const canViewRebindLogs = computed(() => canViewVehiclesRebind());
const rebindLogsLoading = ref(false);
const rebindLogs = ref<any[]>([]);
const rebindLogsPage = ref(1);
const rebindLogsPageSize = ref(10);
const rebindLogsTotal = ref(0);

function resetAll() {
	vehicle.value = null;
	vehicleLoading.value = false;
	lastVisitLoading.value = false;
	lastVisitAt.value = null;
	lastVisitOrderId.value = null;
	ordersDrawer.value = false;
	ordersLoading.value = false;
	orders.value = [];
	ordersTotal.value = 0;
	ordersTotalKnown.value = false;
	ordersPage.value = 1;
	ordersPageSize.value = 20;
	metricsLoading.value = false;
	metricsWashCardDeductTimes.value = 0;
	metricsSpentAmount.value = 0;
	metricsWashTimes.value = 0;
	rebindLogsLoading.value = false;
	rebindLogs.value = [];
	rebindLogsPage.value = 1;
	rebindLogsPageSize.value = 10;
	rebindLogsTotal.value = 0;
}

function authHeader(): Record<string, string> {
	const token = localStorage.getItem('token') || '';
	return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(url: string) {
	const res = await fetch(url, { method: 'GET', headers: { ...authHeader() } });
	if (!res.ok) {
		const ct = res.headers.get('content-type') || '';
		if (ct.includes('application/json')) {
			const j: any = await res.json().catch(() => ({}));
			throw Object.assign(new Error(j?.message || `HTTP ${res.status}`), { status: res.status });
		}
		throw Object.assign(new Error((await res.text()) || `HTTP ${res.status}`), { status: res.status });
	}
	return await res.json();
}

async function fetchVehicle() {
	const id = Number(props.vehicleId || 0);
	if (!id) return;
	vehicleLoading.value = true;
	try {
		const base = getApiBase();
		const j: any = await fetchJson(`${base}/vehicle/${id}`);
		vehicle.value = (j as any) || null;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载车辆失败'));
		vehicle.value = null;
	} finally {
		vehicleLoading.value = false;
	}
}

function canViewOrders(): boolean {
	try {
		const raw = localStorage.getItem('user') || '{}';
		const u = JSON.parse(raw || '{}');
		const perms = Array.isArray(u?.permissions) ? u.permissions : [];
		return perms.includes('*') || perms.includes('orders');
	} catch {
		return false;
	}
}

function canViewVehiclesRebind(): boolean {
	try {
		const raw = localStorage.getItem('user') || '{}';
		const u = JSON.parse(raw || '{}');
		const perms = Array.isArray(u?.permissions) ? u.permissions : [];
		return perms.includes('*') || perms.includes('vehicles');
	} catch {
		return false;
	}
}

function openOrderInNewTab(orderId: number) {
	const id = Number(orderId || 0);
	if (!id) return;
	try {
		window.open(`${orderUrlPrefix.value}/${id}`, '_blank');
	} catch {}
}

function formatMoney(input: any): string {
	const n = Number(input ?? 0);
	if (!Number.isFinite(n)) return '0.00';
	return n.toFixed(2);
}

function formatShortTime(input?: string | null) {
	if (!input) return '-';
	const d = new Date(input as any);
	if (isNaN(d.getTime())) return String(input);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	const hh = String(d.getHours()).padStart(2, '0');
	const mm = String(d.getMinutes()).padStart(2, '0');
	const ss = String(d.getSeconds()).padStart(2, '0');
	return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`;
}

function formatDateTime(input?: string | null){
	if (!input) return '-';
	const d = new Date(input as any);
	if (isNaN(d.getTime())) return String(input);
	const y = d.getFullYear();
	const m = String(d.getMonth()+1).padStart(2,'0');
	const dd = String(d.getDate()).padStart(2,'0');
	const hh = String(d.getHours()).padStart(2,'0');
	const mm = String(d.getMinutes()).padStart(2,'0');
	const ss = String(d.getSeconds()).padStart(2,'0');
	return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`;
}

function formatOrderType(t: any): string {
	const s = String(t || '').toUpperCase();
	if (s === 'SERVICE') return '服务';
	if (s === 'SP') return '商品';
	if (s === 'FK') return '付款';
	return s || '-';
}

function formatOrderStatus(row: any): string {
	const type = String(row?.type || '').toUpperCase();
	const pay = String(row?.payStatus || '').toUpperCase();
	const f = String(row?.fulfillmentStatus || '').toUpperCase();
	const status = String(row?.status || '').toUpperCase();
	const serviceDone = type === 'SERVICE' && ((pay === 'PAID' && f === 'DONE') || status === 'FULFILLED');
	if (serviceDone) return '已完成';
	if (pay === 'UNPAID') return '待支付';
	if (pay === 'PAID' && type === 'SERVICE' && (f === 'PENDING' || f === 'IN_SERVICE')) return '服务中';
	if (pay === 'PAID' && type === 'SP' && (f === 'PENDING' || f === 'SHIPPED')) return '配送中';
	if (status === 'CANCELLED' || pay === 'CANCELLED') return '已取消';
	if (pay === 'REFUNDED') return '已退款';
	return status || pay || '-';
}

function orderStatusTagType(row: any): 'success' | 'warning' | 'info' | 'danger' {
	const txt = formatOrderStatus(row);
	if (txt === '已完成') return 'success';
	if (txt === '待支付') return 'warning';
	if (txt === '已取消' || txt === '已退款') return 'danger';
	return 'info';
}

async function fetchVehicleLastVisit() {
	const id = Number(props.vehicleId || 0);
	if (!id || !canViewOrders()) {
		lastVisitAt.value = null;
		lastVisitOrderId.value = null;
		return;
	}
	lastVisitLoading.value = true;
	try {
		const base = getApiBase();
		const j: any = await fetchJson(`${base}/vehicle/${id}/last-visit`);
		lastVisitAt.value = j?.lastVisitAt ? String(j.lastVisitAt) : null;
		lastVisitOrderId.value = Number(j?.serviceOrderId || 0) || null;
	} catch (e: any) {
		// 无权限不打扰
		const msg = String(e?.message || e || '');
		if (!/403|forbidden/i.test(msg)) ElMessage.error(msg || '加载最近到店失败');
		lastVisitAt.value = null;
		lastVisitOrderId.value = null;
	} finally {
		lastVisitLoading.value = false;
	}
}

async function fetchVehicleMetrics() {
	const id = Number(props.vehicleId || 0);
	if (!id || !canViewOrders()) {
		metricsWashCardDeductTimes.value = 0;
		metricsSpentAmount.value = 0;
		metricsWashTimes.value = 0;
		return;
	}
	metricsLoading.value = true;
	try {
		const base = getApiBase();
		const j: any = await fetchJson(`${base}/vehicle/${id}/metrics`);
		metricsWashCardDeductTimes.value = Math.max(0, Number(j?.totalWashCardDeductTimes || 0) || 0);
		metricsSpentAmount.value = Math.max(0, Number(j?.totalSpentAmount || 0) || 0);
		metricsWashTimes.value = Math.max(0, Number(j?.totalWashTimes || 0) || 0);
	} catch (e: any) {
		const msg = String(e?.message || e || '');
		if (!/403|forbidden/i.test(msg)) ElMessage.error(msg || '加载车辆统计失败');
		metricsWashCardDeductTimes.value = 0;
		metricsSpentAmount.value = 0;
		metricsWashTimes.value = 0;
	} finally {
		metricsLoading.value = false;
	}
}

async function fetchVehicleOrders() {
	const id = Number(props.vehicleId || 0);
	if (!id || !canViewOrders()) return;
	ordersLoading.value = true;
	try {
		const base = getApiBase();
		const url = `${base}/vehicle/${id}/orders?page=${ordersPage.value}&pageSize=${ordersPageSize.value}`;
		const j: any = await fetchJson(url);
		orders.value = Array.isArray(j?.items) ? j.items : [];
		ordersTotal.value = Number(j?.total || 0);
		ordersTotalKnown.value = true;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载订单记录失败'));
		orders.value = [];
		ordersTotal.value = 0;
		ordersTotalKnown.value = false;
	} finally {
		ordersLoading.value = false;
	}
}

function openOrdersDrawer() {
	if (!canViewOrders()) { ElMessage.error('无查看订单权限'); return; }
	ordersDrawer.value = true;
	if (!ordersTotalKnown.value && orders.value.length === 0) {
		ordersPage.value = 1;
		fetchVehicleOrders();
	}
}

function formatSubject(row: any, side: 'from'|'to'): string {
	const m = side === 'from' ? row?.fromMember : row?.toMember;
	const g = side === 'from' ? row?.fromGroup : row?.toGroup;
	const mid = side === 'from' ? row?.fromMemberId : row?.toMemberId;
	const gid = side === 'from' ? row?.fromGroupId : row?.toGroupId;
	if (m?.id) return `${m.name || '会员'}（${m.phone || '-'}）`;
	if (g?.id) return `集团：${g.name || g.id}`;
	if (mid) return `会员ID ${mid}`;
	if (gid) return `集团ID ${gid}`;
	return '游客';
}

function formatOperator(row: any): string {
	const u = row?.operatorUser;
	if (!u) return row?.operatorUserId ? `操作人ID ${row.operatorUserId}` : '—';
	return `${u.name || '管理员'}${u.phone ? `（${u.phone}）` : ''}`;
}

async function fetchRebindLogs() {
	const id = Number(props.vehicleId || 0);
	if (!id || !canViewRebindLogs.value) return;
	rebindLogsLoading.value = true;
	try {
		const base = getApiBase();
		const url = `${base}/vehicle/${id}/rebind-logs?page=${rebindLogsPage.value}&pageSize=${rebindLogsPageSize.value}`;
		const j: any = await fetchJson(url);
		rebindLogs.value = Array.isArray(j?.items) ? j.items : [];
		rebindLogsTotal.value = Number(j?.total || 0);
	} catch (e: any) {
		const msg = String(e?.message || e || '');
		// 403 不提示（权限已在 UI 明示）
		if (!/403|forbidden/i.test(msg)) ElMessage.error(msg || '加载改绑记录失败');
		rebindLogs.value = [];
		rebindLogsTotal.value = 0;
	} finally {
		rebindLogsLoading.value = false;
	}
}

function plateClass(plate?: string){
	const s = String(plate||'');
	if (s.length >= 8) return 'plate-green';
	return 'plate-blue';
}

function colorTagStyle(color?: string | null): any {
	const c = (color||'').toString();
	const map: Record<string, { bg: string; fg: string; bd?: string }> = {
		'黑色': { bg: '#111827', fg: '#fff' },
		'白色': { bg: '#ffffff', fg: '#111', bd: '#e5e7eb' },
		'灰色': { bg: '#9ca3af', fg: '#111' },
		'银色': { bg: '#e5e7eb', fg: '#111' },
		'红色': { bg: '#ef4444', fg: '#fff' },
		'金色（米/香槟）': { bg: '#f59e0b', fg: '#111' },
		'蓝色': { bg: '#3b82f6', fg: '#fff' },
		'棕色（褐/咖啡）': { bg: '#92400e', fg: '#fff' },
		'紫色': { bg: '#8b5cf6', fg: '#fff' },
		'绿色': { bg: '#10b981', fg: '#fff' },
		'粉色': { bg: '#f472b6', fg: '#111' },
		'黄色': { bg: '#fde047', fg: '#111' },
		'橙色': { bg: '#fb923c', fg: '#111' },
		'其他（彩绘/混合）': { bg: '#6b7280', fg: '#fff' },
	};
	const m = map[c];
	if (!m) return {};
	return { background: m.bg, color: m.fg, borderColor: m.bd || m.bg };
}

watch(
	() => [props.modelValue, props.vehicleId] as const,
	async ([open, id]) => {
		if (!open || !id) return;
		// 打开时初始化
		resetAll();
		await fetchVehicle();
		await Promise.all([
			fetchVehicleLastVisit(),
			fetchVehicleMetrics(),
			// 改绑日志不强制拉取：有权限则拉第一页
			(async ()=>{ if (canViewRebindLogs.value) await fetchRebindLogs(); })(),
		]);
	},
);
</script>

<style scoped>
.muted { color:#6b7280; }
.mono { font-variant-numeric: tabular-nums; }
.view-wrap { display:flex; flex-direction:column; gap: 12px; }
.vehicle-card { border-radius: 12px; overflow: hidden; }
.vehicle-card :deep(.el-card__body){ padding: 14px 14px; }
.vehicle-card__grid{
	display:grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 12px;
	align-items: stretch;
}
.vehicle-card__head{ display:flex; flex-direction:column; gap: 6px; margin-bottom: 10px; }
.vehicle-card__plate{ display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
.vehicle-card__meta{
	display:flex;
	align-items:center;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 2px;
}
.meta-pill{
	display:flex;
	align-items:center;
	gap: 6px;
	padding: 6px 10px;
	border-radius: 999px;
	background: #f8fafc;
	border: 1px solid #eef2f7;
	box-shadow: 0 1px 2px rgba(0,0,0,0.03);
	min-width: 0;
}
.meta-icon{
	width:18px;
	height:18px;
	border-radius: 6px;
	object-fit: contain;
	background:#fff;
	border:1px solid #eef2f7;
	flex: 0 0 auto;
}
.meta-k{ font-size: 12px; color:#6b7280; flex: 0 0 auto; }
.meta-v{
	font-size: 12px;
	color:#111827;
	font-weight: 600;
	min-width: 0;
	max-width: 220px;
	overflow:hidden;
	text-overflow:ellipsis;
	white-space:nowrap;
}
.meta-color :deep(.el-tag__content){ font-weight: 700; }
.vehicle-card__sub{ font-size: 12px; display:flex; align-items:center; flex-wrap: wrap; gap: 6px; }
.vehicle-card__sub .dot{ color:#c0c4cc; }
.vehicle-card__kv{
	display:grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px 12px;
}
.kv{ background:#fafafa; border:1px solid #f0f2f5; border-radius: 10px; padding: 10px 10px; min-height: 54px; }
.k{ font-size: 12px; color:#909399; margin-bottom: 6px; }
.v{ font-size: 13px; color:#303133; display:flex; align-items:center; gap: 8px; min-width: 0; }
.v-col{ flex-direction: column; align-items: flex-start; gap: 6px; }
.v-line{ display:flex; align-items:center; gap: 8px; font-size: 12px; color:#303133; }
.v :deep(.el-tag){ min-width: unset; }
.vehicle-card__main{ min-width: 0; }
.kv-strong{ background: linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%); border-color:#e5e7eb; }
.v-strong{ font-size: 16px; font-weight: 700; letter-spacing: 0.2px; }
.v-strong .money{ color:#111827; }
.v-strong .count{ color:#111827; }
.v-strong .unit{ font-size: 12px; font-weight: 600; color:#6b7280; margin-left: 2px; }

@media (max-width: 980px){
	.vehicle-card__grid{ grid-template-columns: 1fr; }
	.vehicle-card__kv{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.meta-v{ max-width: 160px; }
}

.plate-chip { display:inline-block; padding: 2px 8px; border-radius: 12px; background: #f0f9eb; color: #67c23a; font-weight: 700; }
.plate-chip.plate-blue { background:#e6f0ff; color:#1d4ed8; }
.plate-chip.plate-green { background:#e6fff4; color:#16a34a; }

.rebind-logs-card{ border-radius: 10px; }
.section-head{ display:flex; align-items:center; justify-content:space-between; gap: 12px; margin-bottom: 8px; }
.section-title{ font-weight: 800; color:#111827; }
</style>

