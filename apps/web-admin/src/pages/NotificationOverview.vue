<template>
	<div class="page">
		<div class="toolbar">
			<div class="left">
				<el-date-picker
					v-model="dateRange"
					type="daterange"
					range-separator="至"
					start-placeholder="开始日期"
					end-placeholder="结束日期"
					value-format="YYYY-MM-DD"
					:shortcuts="shortcuts"
					:clearable="true"
				/>
				<el-button type="primary" @click="refreshAll" :loading="loadingOverview">刷新概览</el-button>
			</div>
			<div class="right">
				<el-tag type="info">统计口径：按创建时间（createdAt）</el-tag>
			</div>
		</div>

		<div class="cards" v-loading="loadingOverview">
			<div class="card admin">
				<div class="card-head">
					<div class="title">管理端站内通知</div>
					<el-tag type="success" effect="light">ADMIN</el-tag>
				</div>
				<div class="metric">
					<div class="num">{{ overview?.admin?.total ?? 0 }}</div>
					<div class="label">发送总数</div>
				</div>
				<div class="meta">
					<div class="chip">未读：<b>{{ overview?.admin?.unread ?? 0 }}</b></div>
					<div class="chip">已读：<b>{{ overview?.admin?.read ?? 0 }}</b></div>
				</div>
			</div>

			<div class="card member">
				<div class="card-head">
					<div class="title">会员端站内通知</div>
					<el-tag type="warning" effect="light">MEMBER</el-tag>
				</div>
				<div class="metric">
					<div class="num">{{ overview?.member?.total ?? 0 }}</div>
					<div class="label">发送总数</div>
				</div>
				<div class="meta">
					<div class="chip">未读：<b>{{ overview?.member?.unread ?? 0 }}</b></div>
					<div class="chip">已读：<b>{{ overview?.member?.read ?? 0 }}</b></div>
				</div>
			</div>

			<div class="card wxapp">
				<div class="card-head">
					<div class="title">小程序订阅消息</div>
					<el-tag type="info" effect="light">WXAPP</el-tag>
				</div>
				<div class="metric">
					<div class="num">{{ overview?.wxapp?.total ?? 0 }}</div>
					<div class="label">发送尝试数</div>
				</div>
				<div class="meta">
					<div class="chip">成功：<b>{{ overview?.wxapp?.success ?? 0 }}</b></div>
					<div class="chip">失败：<b>{{ overview?.wxapp?.failed ?? 0 }}</b></div>
				</div>
			</div>
		</div>

		<el-card class="panel" shadow="never">
			<template #header>
				<div class="panel-head">
					<div class="panel-title">发送详情</div>
					<div class="panel-actions">
						<div class="action-row top">
							<el-radio-group v-model="activeTab" class="segmented" @change="onTabChange">
								<el-radio-button label="ADMIN">管理端通知</el-radio-button>
								<el-radio-button label="MEMBER">会员端通知</el-radio-button>
								<el-radio-button label="WXAPP">小程序订阅消息</el-radio-button>
							</el-radio-group>
						</div>
						<div class="action-row filters">
							<el-input v-model="filters.q" class="w-search" placeholder="搜索：标题/内容/type/模板ID" clearable @keyup.enter="reloadList">
								<template #prefix><el-icon><Search /></el-icon></template>
							</el-input>
							<el-input v-if="activeTab!=='ADMIN'" v-model="filters.memberIdText" class="w-mid" placeholder="会员ID（可选）" clearable @keyup.enter="reloadList" />
							<el-select v-if="activeTab!=='WXAPP'" v-model="filters.status" class="w-sm" placeholder="已读状态" clearable>
								<el-option label="未读" value="UNREAD" />
								<el-option label="已读" value="READ" />
							</el-select>
							<el-select v-if="activeTab==='WXAPP'" v-model="filters.result" class="w-sm" placeholder="发送结果" clearable>
								<el-option label="成功" value="SUCCESS" />
								<el-option label="失败" value="FAILED" />
							</el-select>
							<el-input v-model="filters.typeKey" class="w-type" placeholder="类型（type/typeKey，可选）" clearable @keyup.enter="reloadList" />
							<el-button @click="reloadList" :loading="loadingList">刷新</el-button>
						</div>
					</div>
				</div>
			</template>

			<div class="table-wrap" v-loading="loadingList">
				<el-table v-if="activeTab!=='WXAPP'" :data="list" style="width:100%">
					<el-table-column prop="id" label="ID" width="90" />
					<el-table-column prop="type" label="类型" width="160" show-overflow-tooltip />
					<el-table-column prop="title" label="标题" min-width="160" show-overflow-tooltip />
					<el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
					<el-table-column v-if="activeTab==='MEMBER'" prop="targetMemberId" label="会员ID" width="110" />
					<el-table-column v-if="activeTab==='ADMIN'" prop="targetUserId" label="管理员ID" width="110" />
					<el-table-column prop="createdAt" label="时间" width="170">
						<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
					</el-table-column>
					<el-table-column prop="status" label="状态" width="110">
						<template #default="{ row }">
							<el-tag :type="row.status==='UNREAD'?'danger':'success'" effect="light">{{ row.status==='UNREAD'?'未读':'已读' }}</el-tag>
						</template>
					</el-table-column>
					<el-table-column prop="readAt" label="已读时间" width="170">
						<template #default="{ row }">{{ row.readAt ? formatTime(row.readAt) : '—' }}</template>
					</el-table-column>
					<el-table-column label="操作" width="120" fixed="right">
						<template #default="{ row }">
							<el-button link type="primary" @click="openDetail(row)">查看</el-button>
						</template>
					</el-table-column>
				</el-table>

				<el-table v-else :data="list" style="width:100%">
					<el-table-column prop="id" label="ID" width="90" />
					<el-table-column prop="typeKey" label="类型" width="170" show-overflow-tooltip />
					<el-table-column prop="memberId" label="会员ID" width="110" />
					<el-table-column prop="templateId" label="模板ID" min-width="170" show-overflow-tooltip />
					<el-table-column prop="page" label="跳转页面" min-width="160" show-overflow-tooltip />
					<el-table-column label="结果" width="110">
						<template #default="{ row }">
							<el-tag :type="row.errcode===0 ? 'success' : 'danger'" effect="light">{{ row.errcode===0 ? '成功' : '失败' }}</el-tag>
						</template>
					</el-table-column>
					<el-table-column prop="errcode" label="errcode" width="110">
						<template #default="{ row }">{{ row.errcode === 0 ? 0 : (row.errcode ?? '—') }}</template>
					</el-table-column>
					<el-table-column prop="errmsg" label="errmsg" min-width="160" show-overflow-tooltip />
					<el-table-column prop="createdAt" label="时间" width="170">
						<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
					</el-table-column>
					<el-table-column label="payload" min-width="220">
						<template #default="{ row }">
							<el-popover placement="top-start" trigger="hover" :width="420">
								<template #reference>
									<el-tag type="info" effect="plain" class="mono">查看</el-tag>
								</template>
								<pre class="json">{{ prettyJson(row.payload) }}</pre>
							</el-popover>
						</template>
					</el-table-column>
					<el-table-column label="操作" width="120" fixed="right">
						<template #default="{ row }">
							<el-button link type="primary" @click="openDetail(row)">查看</el-button>
						</template>
					</el-table-column>
				</el-table>

				<div class="pager">
					<el-pagination
						v-model:current-page="page"
						v-model:page-size="pageSize"
						:page-sizes="[10, 20, 50, 100]"
						layout="total, sizes, prev, pager, next, jumper"
						:total="total"
						@current-change="onPageChange"
						@size-change="onSizeChange"
					/>
				</div>
			</div>
		</el-card>

		<el-dialog v-model="detailVisible" title="消息详情" width="760px">
			<div class="detail">
				<div class="row"><span class="k">通道</span><span class="v">{{ activeTab }}</span></div>
				<div class="row"><span class="k">ID</span><span class="v">{{ detail?.id ?? '—' }}</span></div>
				<div class="row" v-if="activeTab!=='WXAPP'"><span class="k">类型</span><span class="v">{{ detail?.type ?? '—' }}</span></div>
				<div class="row" v-else><span class="k">类型</span><span class="v">{{ detail?.typeKey ?? '—' }}</span></div>
				<div class="row"><span class="k">时间</span><span class="v">{{ detail?.createdAt ? formatTime(detail.createdAt) : '—' }}</span></div>
				<div class="row" v-if="activeTab!=='WXAPP'"><span class="k">状态</span><span class="v">{{ detail?.status ?? '—' }}</span></div>
				<div class="row" v-else><span class="k">结果</span><span class="v">{{ detail?.errcode===0 ? 'SUCCESS' : 'FAILED' }}</span></div>
				<div class="row" v-if="activeTab==='MEMBER'"><span class="k">会员ID</span><span class="v">{{ detail?.targetMemberId ?? '—' }}</span></div>
				<div class="row" v-if="activeTab==='ADMIN'"><span class="k">管理员ID</span><span class="v">{{ detail?.targetUserId ?? '—' }}</span></div>
				<div class="row" v-if="activeTab==='WXAPP'"><span class="k">模板ID</span><span class="v mono">{{ detail?.templateId ?? '—' }}</span></div>
				<div class="row" v-if="activeTab==='WXAPP'"><span class="k">跳转页</span><span class="v mono">{{ detail?.page ?? '—' }}</span></div>

				<div class="block" v-if="activeTab!=='WXAPP'">
					<div class="k">标题</div>
					<div class="v">{{ detail?.title ?? '—' }}</div>
				</div>
				<div class="block" v-if="activeTab!=='WXAPP'">
					<div class="k">内容</div>
					<pre class="text">{{ detail?.content ?? '' }}</pre>
				</div>
				<div class="block" v-if="activeTab==='WXAPP'">
					<div class="k">payload</div>
					<pre class="json">{{ prettyJson(detail?.payload) }}</pre>
				</div>
			</div>
			<template #footer>
				<el-button @click="detailVisible=false">关闭</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { API_BASE } from '../config';
import { Search } from '@element-plus/icons-vue';

type Overview = {
	ok: boolean;
	admin: { total: number; unread: number; read: number };
	member: { total: number; unread: number; read: number };
	wxapp: { total: number; success: number; failed: number };
};

type NotifRow = {
	id: number;
	createdAt: string;
	title: string;
	content?: string | null;
	type?: string | null;
	linkPath?: string | null;
	targetType: 'ADMIN' | 'MEMBER';
	targetUserId?: number | null;
	targetMemberId?: number | null;
	status: 'UNREAD' | 'READ';
	readAt?: string | null;
};

type WxappRow = {
	id: number;
	createdAt: string;
	typeKey: string;
	memberId?: number | null;
	openid?: string | null;
	templateId: string;
	page?: string | null;
	payload?: any;
	errcode?: number | null;
	errmsg?: string | null;
	msgid?: string | null;
};

type ListResp<T> = { ok: boolean; total: number; list: T[] };

const dateRange = ref<[string, string] | null>(null);
const shortcuts = [
	{
		text: '近7天',
		value: () => {
			const end = new Date();
			const start = new Date();
			start.setDate(start.getDate() - 6);
			return [formatYmd(start), formatYmd(end)];
		},
	},
	{
		text: '近30天',
		value: () => {
			const end = new Date();
			const start = new Date();
			start.setDate(start.getDate() - 29);
			return [formatYmd(start), formatYmd(end)];
		},
	},
];

const loadingOverview = ref(false);
const loadingList = ref(false);
const overview = ref<Overview | null>(null);
const initialized = ref(false);

const activeTab = ref<'ADMIN' | 'MEMBER' | 'WXAPP'>('ADMIN');
const filters = reactive({
	q: '',
	typeKey: '',
	status: '' as '' | 'UNREAD' | 'READ',
	result: '' as '' | 'SUCCESS' | 'FAILED',
	memberIdText: '',
});

const memberId = computed(() => {
	const n = Number(String(filters.memberIdText || '').trim());
	return Number.isFinite(n) && n > 0 ? n : null;
});

const list = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const detailVisible = ref(false);
const detail = ref<any | null>(null);

function formatYmd(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatTime(t: string): string {
	try {
		const d = new Date(t);
		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
	} catch {
		return t;
	}
}

function prettyJson(v: any): string {
	try {
		if (v == null) return '';
		return JSON.stringify(v, null, 2);
	} catch {
		return String(v ?? '');
	}
}

function authHeaders(): Record<string, string> {
	const token = localStorage.getItem('token') || '';
	return token ? { Authorization: `Bearer ${token}` } : {};
}

function rangeQuery(): { from?: string; to?: string } {
	if (!dateRange.value) return {};
	const [from, to] = dateRange.value;
	return { from, to };
}

async function fetchJson<T>(path: string, qs?: Record<string, any>): Promise<T> {
	const url = new URL(`${API_BASE}${path}`);
	Object.entries(qs || {}).forEach(([k, v]) => {
		if (v === undefined || v === null || v === '') return;
		url.searchParams.set(k, String(v));
	});
	const res = await fetch(url.toString(), { method: 'GET', headers: { ...authHeaders() } });
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(text || `${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

async function loadOverview() {
	loadingOverview.value = true;
	try {
		overview.value = await fetchJson<Overview>('/notification/admin/overview', rangeQuery());
	} catch (e: any) {
		overview.value = null;
		ElMessage.error(String(e?.message || '加载概览失败'));
	} finally {
		loadingOverview.value = false;
	}
}

async function loadList() {
	loadingList.value = true;
	try {
		const skip = (page.value - 1) * pageSize.value;
		const qs: any = {
			channel: activeTab.value,
			take: pageSize.value,
			skip,
			q: filters.q || undefined,
			typeKey: filters.typeKey || undefined,
			...rangeQuery(),
		};
		if (activeTab.value !== 'WXAPP') qs.status = filters.status || undefined;
		if (activeTab.value === 'WXAPP') qs.result = filters.result || undefined;
		if (activeTab.value !== 'ADMIN' && memberId.value) qs.memberId = memberId.value;

		const resp = await fetchJson<ListResp<NotifRow | WxappRow>>('/notification/admin/overview/list', qs);
		list.value = Array.isArray((resp as any)?.list) ? (resp as any).list : [];
		total.value = Number((resp as any)?.total || 0);
	} catch (e: any) {
		list.value = [];
		total.value = 0;
		ElMessage.error(String(e?.message || '加载列表失败'));
	} finally {
		loadingList.value = false;
	}
}

function openDetail(row: any) {
	detail.value = row;
	detailVisible.value = true;
}

async function refreshAll() {
	await Promise.all([loadOverview(), loadList()]);
}

function reloadList() {
	page.value = 1;
	loadList();
}

function onPageChange(p: number) {
	page.value = p;
	loadList();
}

function onSizeChange() {
	page.value = 1;
	loadList();
}

function onTabChange() {
	// 切换 tab 时清理不适用的筛选，避免产生“无数据”的误解
	filters.q = filters.q || '';
	filters.typeKey = filters.typeKey || '';
	filters.memberIdText = filters.memberIdText || '';
	if (activeTab.value === 'WXAPP') filters.status = '';
	else filters.result = '';
	page.value = 1;
	loadList();
}

watch(dateRange, () => {
	// 仅触发概览刷新；列表由用户手动刷新（避免频繁请求）
	if (!initialized.value) return;
	loadOverview();
});

onMounted(() => {
	// 默认近7天，提升可读性（数据量可控）
	try {
		const end = new Date();
		const start = new Date();
		start.setDate(start.getDate() - 6);
		dateRange.value = [formatYmd(start), formatYmd(end)];
	} catch {}
	initialized.value = true;
	refreshAll();
});
</script>

<style scoped>
.page { display:flex; flex-direction:column; gap:12px; }
.toolbar{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
.toolbar .left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.toolbar .right{ display:flex; align-items:center; gap:8px; }

.cards{ display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px; }
@media (max-width: 1100px){ .cards{ grid-template-columns: repeat(1, minmax(0, 1fr)); } }
.card{
	border-radius: 14px;
	padding: 14px 14px 12px;
	border: 1px solid var(--el-border-color-light);
	background: var(--el-bg-color);
	box-shadow: 0 1px 0 rgba(0,0,0,.02);
}
.card.admin{ background: linear-gradient(135deg, rgba(34,197,94,.12), rgba(255,255,255,0)); }
.card.member{ background: linear-gradient(135deg, rgba(245,158,11,.14), rgba(255,255,255,0)); }
.card.wxapp{ background: linear-gradient(135deg, rgba(59,130,246,.12), rgba(255,255,255,0)); }
.card-head{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
.title{ font-weight: 800; color: var(--el-text-color-primary); letter-spacing: .2px; }
.metric{ display:flex; align-items:baseline; gap:10px; }
.num{ font-size: 28px; font-weight: 900; line-height: 1; color: var(--el-text-color-primary); }
.label{ font-size: 12px; color: var(--el-text-color-secondary); }
.meta{ display:flex; gap:10px; margin-top:10px; flex-wrap:wrap; }
.chip{ font-size: 12px; color: var(--el-text-color-regular); background: rgba(255,255,255,.65); border: 1px solid var(--el-border-color-lighter); padding: 6px 10px; border-radius: 9999px; }

.panel{ border-radius: 14px; }
.panel-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
.panel-title{ font-weight: 800; white-space: nowrap; padding-top: 2px; }
.panel-actions{ flex: 1; min-width: 0; display:flex; flex-direction:column; gap:10px; align-items:flex-end; }
.action-row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; width:100%; }
.action-row.filters{ justify-content:flex-end; }
.w-search{ width: 260px; }
.w-mid{ width: 160px; }
.w-sm{ width: 140px; }
.w-type{ width: 220px; }
.action-row.filters :deep(.el-input), .action-row.filters :deep(.el-select){ max-width: 100%; }
@media (max-width: 1200px){
	.panel-actions{ align-items:flex-start; }
	.action-row{ justify-content:flex-start; }
}
.segmented :deep(.el-radio-button__inner){
	padding: 6px 10px;
	font-weight: 700;
	border-radius: 9999px;
}
.segmented :deep(.el-radio-button:first-child .el-radio-button__inner){
	border-top-left-radius: 9999px;
	border-bottom-left-radius: 9999px;
}
.segmented :deep(.el-radio-button:last-child .el-radio-button__inner){
	border-top-right-radius: 9999px;
	border-bottom-right-radius: 9999px;
}
.table-wrap{ margin-top:10px; }
.pager{ display:flex; justify-content:flex-end; margin-top: 10px; }

.detail{ display:flex; flex-direction:column; gap:8px; }
.row{ display:flex; gap:10px; }
.row .k{ width: 90px; color: var(--el-text-color-secondary); }
.row .v{ flex:1; color: var(--el-text-color-primary); }
.block{ border: 1px solid var(--el-border-color-light); border-radius: 10px; padding: 10px; }
.block .k{ font-size:12px; color: var(--el-text-color-secondary); margin-bottom:6px; }
.text{ white-space: pre-wrap; word-break: break-word; margin:0; font-family: inherit; font-size: 13px; line-height: 1.5; }
.json{ white-space: pre-wrap; word-break: break-word; margin:0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.45; color: var(--el-text-color-regular); }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
</style>


