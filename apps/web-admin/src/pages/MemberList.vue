<template>
	<BasePage title="会员列表">
		<template #actions>
			<el-form class="ml-filters" :inline="true" :model="filters" size="small" @submit.prevent>
				<el-form-item label="关键词">
					<el-input
						v-model="filters.keyword"
						clearable
						placeholder="姓名/手机号/ID/UID"
						class="ml-w-240"
						@keyup.enter="onSearch"
					/>
				</el-form-item>
				<el-form-item label="等级">
					<el-select v-model="filters.levelId" clearable filterable placeholder="全部" class="ml-w-140" @change="onSearch">
						<el-option v-for="lv in levels" :key="lv.id" :label="lv.name" :value="lv.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="分类">
					<el-select v-model="filters.categoryId" clearable filterable placeholder="全部" class="ml-w-140" @change="onSearch">
						<el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="标签">
					<el-select v-model="filters.tagId" clearable filterable placeholder="全部" class="ml-w-160" @change="onSearch">
						<el-option v-for="t in tagFilterOptions" :key="t.id" :label="t.name" :value="t.id" />
					</el-select>
				</el-form-item>

				<el-form-item class="ml-more-toggle">
					<el-button link type="primary" @click="showMore = !showMore">{{ showMore ? '收起筛选' : '更多筛选' }}</el-button>
				</el-form-item>

				<template v-if="showMore">
					<el-form-item label="注册">
						<el-date-picker
							v-model="createdRangeValue"
							type="daterange"
							unlink-panels
							range-separator="~"
							start-placeholder="开始日期"
							end-placeholder="结束日期"
							format="YYYY-MM-DD"
							value-format="YYYY-MM-DD"
							teleported
							clearable
							class="ml-w-240"
							@change="onCreatedRangeChange"
						/>
					</el-form-item>
					<el-form-item label="活跃">
						<el-date-picker
							v-model="activeRangeValue"
							type="daterange"
							unlink-panels
							range-separator="~"
							start-placeholder="开始日期"
							end-placeholder="结束日期"
							format="YYYY-MM-DD"
							value-format="YYYY-MM-DD"
							teleported
							clearable
							class="ml-w-240"
							@change="onActiveRangeChange"
						/>
					</el-form-item>
				</template>

				<el-form-item label="排序">
					<el-select v-model="filters.sortBy" placeholder="默认" class="ml-w-160" @change="onSearch">
						<el-option label="默认（等级+ID）" value="" />
						<el-option label="成长值" value="growthPoints" />
						<el-option label="累计支付" value="totalPaidAmount" />
						<el-option label="积分" value="points" />
						<el-option label="余额" value="balance" />
						<el-option label="注册时间" value="createdAt" />
						<el-option label="活跃时间" value="lastActiveAt" />
					</el-select>
					<el-radio-group v-model="filters.sortOrder" class="ml-sort-order" @change="onSearch">
					<el-radio-button value="desc">倒序</el-radio-button>
					<el-radio-button value="asc">正序</el-radio-button>
					</el-radio-group>
				</el-form-item>

				<el-form-item>
					<el-checkbox v-model="filters.excludePlaceholders" @change="onSearch">排除占位账号</el-checkbox>
				</el-form-item>
				<el-form-item v-if="createdRangeLabel">
					<el-tag size="small" effect="plain" type="info" closable @close="clearCreatedRange">
						注册：{{ createdRangeLabel }}
					</el-tag>
				</el-form-item>
				<el-form-item v-if="activeRangeLabel">
					<el-tag size="small" effect="plain" type="success" closable @close="clearActiveRange">
						活跃：{{ activeRangeLabel }}
					</el-tag>
				</el-form-item>

				<el-form-item>
					<el-button type="primary" @click="onSearch" :loading="loading">
						<el-icon style="vertical-align: middle; margin-right:4px;"><Search /></el-icon>
						搜索
					</el-button>
					<el-button @click="onReset" :disabled="loading">重置</el-button>
				</el-form-item>

				<el-form-item class="ml-right">
					<el-tooltip v-if="guestOwnerInfo" placement="bottom" effect="dark">
						<template #content>
							<div style="line-height:1.5;">
								<div>游客占位ID：{{ guestOwnerInfo?.guestMemberId ?? '-' }}</div>
								<div v-if="guestOwnerInfo?.exists===false" style="opacity:.9;">状态：不存在</div>
								<div v-else style="opacity:.9;">标签：{{ guestOwnerInfo?.tagged===false ? '未贴标签' : '已贴标签' }}</div>
							</div>
						</template>
						<el-tag size="small" :type="guestOwnerInfo?.tagged===false ? 'warning' : 'info'" effect="plain" class="ml-guest-tag">
							游客占位 {{ guestOwnerInfo?.guestMemberId ?? '-' }}
						</el-tag>
					</el-tooltip>
					<el-button
						title="刷新游客占位账号"
						aria-label="刷新游客占位账号"
						:loading="syncingGuest"
						circle
						plain
						@click="refreshGuestOwner"
					>
						<el-icon><Refresh /></el-icon>
					</el-button>
					<el-button type="primary" @click="openCreate">
						<el-icon style="vertical-align: middle; margin-right:4px;"><CirclePlus /></el-icon>
						新建会员
					</el-button>
				</el-form-item>
			</el-form>
		</template>
		<div class="ml-shell">
			<div class="ml-table">
				<el-table :data="list" stripe style="width: 100%" height="100%">
					<el-table-column prop="id" label="ID" width="80" />
					<el-table-column prop="uid" label="UID" width="100" />
					<el-table-column label="头像" width="90">
						<template #default="{ row }">
							<div class="avatar-click" title="点击查看详情" @click="openDetailDrawer(row)">
								<el-avatar :size="32" :src="formatAvatar(row.avatarUrl)" />
							</div>
						</template>
					</el-table-column>
					<el-table-column prop="name" label="昵称" width="220">
						<template #default="{ row }">
							<span>{{ row.name }}</span>
							<el-tag v-if="isGroupOrderOwner(row)" type="warning" effect="plain" size="small" style="margin-left:6px;">集团占位</el-tag>
							<el-tag v-if="isGuestOrderOwner(row)" type="warning" effect="plain" size="small" style="margin-left:6px;">游客占位</el-tag>
						</template>
					</el-table-column>
					<el-table-column prop="phone" label="手机号" width="150" />
					<el-table-column prop="level.name" label="等级" width="120">
						<template #default="{ row }">{{ row.level?.name || '-' }}</template>
					</el-table-column>
					<el-table-column prop="category.name" label="分类" width="120">
						<template #default="{ row }">{{ row.category?.name || '-' }}</template>
					</el-table-column>
					<el-table-column prop="growthPoints" label="成长值" width="120">
						<template #default="{ row }">{{ (row as any).growthPoints ?? 0 }}</template>
					</el-table-column>
					<el-table-column prop="totalPaidAmount" label="累计支付(￥)" width="140">
						<template #default="{ row }">{{ Number((row as any).totalPaidAmount||0).toFixed(2) }}</template>
					</el-table-column>
					<el-table-column prop="points" label="积分" width="100" />
					<el-table-column prop="balance" label="余额" width="120" />
					<el-table-column prop="createdAt" label="注册时间" width="180">
						<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
					</el-table-column>
					<el-table-column prop="lastActiveAt" label="活跃时间" width="180">
						<template #default="{ row }">{{ formatTime(row.lastActiveAt) }}</template>
					</el-table-column>
					<el-table-column label="操作" width="420" fixed="right">
						<template #default="{ row }">
							<div class="op-btns">
								<el-button size="small" link :disabled="isGroupOrderOwner(row) || isGuestOrderOwner(row)" @click="openEdit(row)">
									<el-icon><User /></el-icon>
									<span>查看资料</span>
								</el-button>
								<el-button size="small" link type="warning" :disabled="isGroupOrderOwner(row) || isGuestOrderOwner(row)" @click="openResetPwd(row)">
									<el-icon><Edit /></el-icon>
									<span>修改密码</span>
								</el-button>
								<el-button size="small" link type="primary" :disabled="isGroupOrderOwner(row) || isGuestOrderOwner(row)" @click="openGrowthLogs(row)">
									<el-icon><List /></el-icon>
									<span>成长日志</span>
								</el-button>
								<el-button size="small" link type="danger" :disabled="isGroupOrderOwner(row) || isGuestOrderOwner(row)" @click="openDeleteDialog(row)">
									<el-icon><Delete /></el-icon>
									<span>删除</span>
								</el-button>
							</div>
						</template>
					</el-table-column>
				</el-table>
			</div>
			<div class="ml-pager">
				<el-pagination
					background
					layout="total, prev, pager, next, sizes"
					:total="total"
					:page-size="pageSize"
					:page-sizes="[10,20,50,100]"
					:current-page="page"
					@current-change="onPageChange"
					@size-change="onPageSizeChange"
				/>
			</div>
		</div>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '查看/编辑会员' : '新建会员'" width="520px">
			<el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
				<el-form-item v-if="current?.id" label="ID"><el-input :model-value="current?.id" disabled /></el-form-item>
				<el-form-item v-if="current?.id" label="UID"><el-input :model-value="current?.uid" disabled /></el-form-item>
				<el-form-item label="头像">
					<div style="display:flex;align-items:center;gap:12px;">
						<img :src="formatAvatar(form.avatarUrl)" alt="avatar" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid #eee;" />
						<el-upload :http-request="uploadAvatar" :show-file-list="false" accept="image/*"><el-button>上传头像</el-button></el-upload>
						<el-button @click="openPickAvatar">从文件库选择</el-button>
						<el-button link type="danger" @click="onAvatarClear">恢复默认</el-button>
					</div>
				</el-form-item>
				<el-form-item label="昵称" prop="name"><el-input v-model="form.name" :maxlength="10" show-word-limit /></el-form-item>
				<el-form-item label="手机号" prop="phone"><el-input v-model="form.phone" /></el-form-item>
				<el-form-item label="会员等级" prop="levelId">
					<el-select v-model="form.levelId" placeholder="请选择等级" style="width:100%">
						<el-option v-for="lv in levels" :key="lv.id" :label="lv.name" :value="lv.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="会员分类" prop="categoryId">
					<el-select v-model="form.categoryId" placeholder="请选择分类" style="width:100%">
						<el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
					</el-select>
				</el-form-item>
				<el-form-item label="会员标签">
					<div v-if="systemTagsRO.length" style="margin-bottom:6px;">
						<span style="margin-right:6px;color:#909399;">系统标签：</span>
						<el-tag v-for="t in systemTagsRO" :key="t.id" type="info" effect="plain" style="margin-right:6px;">{{ t.name }}</el-tag>
					</div>
					<el-select
						v-model="form.tagIds"
						multiple
						filterable
						tag-type="primary"
						allow-create
						default-first-option
						placeholder="选择或输入新标签后回车"
						style="width:100%"
					>
						<el-option v-for="t in tagOptions" :key="t.id" :label="t.name" :value="t.id" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="!current?.id" label="密码" prop="password"><el-input v-model="form.password" type="password" /></el-form-item>
				<el-form-item v-if="!current?.id" label="确认密码" prop="password2"><el-input v-model="form.password2" type="password" /></el-form-item>
				<el-form-item v-if="current?.id" label="注册时间"><el-input :model-value="formatTime(current?.createdAt as any)" disabled /></el-form-item>
				<el-form-item v-if="current?.id" label="活跃时间"><el-input :model-value="formatTime(current?.lastActiveAt as any)" disabled /></el-form-item>
				<el-form-item label="积分"><el-input v-model.number="form.points" /></el-form-item>
				<el-form-item label="余额"><el-input v-model.number="form.balance" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="pwdDialog" title="修改密码" width="420px">
			<el-form :model="pwdForm" label-width="90px">
				<el-form-item label="新密码"><el-input v-model="pwdForm.password" type="password" /></el-form-item>
				<el-form-item label="确认密码"><el-input v-model="pwdForm.password2" type="password" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="pwdDialog=false">取消</el-button>
				<el-button type="primary" @click="onResetPwdSave">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="delDialog" title="确认删除" width="420px" @closed="clearDelTimer">
			<div>确认删除该会员？将同时删除该会员的所有车辆、洗车计次卡及其共享与日志记录，此操作不可恢复。</div>
			<template #footer>
				<el-button @click="delDialog=false">取消</el-button>
				<el-button type="danger" :disabled="delCountdown>0" @click="onDeleteConfirm">
					{{ delCountdown>0 ? `确认(${delCountdown}s)` : '确认' }}
				</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="growthDialog" title="成长值日志" width="560px">
			<div class="growth-logs">
				<div v-if="growthLoading" class="loading">加载中...</div>
				<div v-else-if="growthLogs.length===0" class="empty">暂无成长值日志</div>
				<div v-else class="list">
					<div class="row" v-for="(g,i) in growthLogs" :key="i">
						<div class="desc">
							{{ g.desc }}
							<el-tag size="small" v-if="g.orderNo" style="margin-left:8px;cursor:pointer;" @click="goOrderTag(g)">订单：{{ g.orderNo }}</el-tag>
						</div>
						<div class="change" :class="{ plus: g.change>0, minus: g.change<0 }">{{ g.change>0?`+${g.change}`:g.change }}</div>
						<div class="time">{{ formatTime(g.createdAt) }}</div>
					</div>
				</div>
			</div>
			<template #footer>
				<el-button @click="openAdjustDialog">调整成长值</el-button>
				<el-button @click="growthDialog=false">关闭</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="adjustDialog" title="调整成长值" width="420px">
			<el-form :model="adjustForm" label-width="90px">
				<el-form-item label="变更值">
					<el-input-number v-model="adjustForm.delta" :step="1" :min="-999999" :max="999999" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="adjustForm.remark" placeholder="填写变更原因，必填" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="adjustDialog=false">取消</el-button>
				<el-button type="primary" @click="saveAdjust">保存</el-button>
			</template>
		</el-dialog>

		<FilePickerDialog v-model="pickVisible" title="选择头像" @picked="onPickedAvatar" />
		<MemberDetailDrawer v-model="detailDrawerVisible" :member-id="detailMemberId" :base-member="detailBaseMember" />
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import FilePickerDialog from './_components/FilePickerDialog.vue';
import MemberDetailDrawer from './_components/MemberDetailDrawer.vue';
import { ElMessage } from 'element-plus';
import { ElIcon } from 'element-plus';
import { Search, CirclePlus, User, Edit, List, Delete, Refresh } from '@element-plus/icons-vue';
import { useRoute } from 'vue-router';
import {
	memberCategoryControllerList,
	memberControllerAdjustGrowth,
	memberControllerCreate,
	memberControllerGetGuestOrderOwner,
	memberControllerGetGrowthLogsByMember,
	memberControllerList,
	memberControllerRemove,
	memberControllerSetPassword,
	memberControllerSyncGuestOrderOwner,
	memberControllerUpdate,
	memberLevelControllerList,
	memberTagControllerCreate,
	memberTagControllerList,
	systemSettingControllerGetPublicSetting,
} from '@wash/api-client';

type Level = { id: number; name: string; weight: number };
const levels = ref<Level[]>([]);

type Category = { id: number; name: string; weight: number };
const categories = ref<Category[]>([]);

type Tag = { id: number; name: string; isSystem?: boolean };
const tagOptions = ref<Tag[]>([]);
const tagFilterOptions = ref<Tag[]>([]);

type Member = { id: number; uid: number; name: string; phone: string; points: number; balance: number; createdAt: string; lastActiveAt?: string | null; avatarUrl?: string | null; level?: Level; category?: Category; tags?: Tag[]; growthPoints?: number; totalPaidAmount?: number };
const list = ref<Member[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const dialogVisible = ref(false);
const saving = ref(false);
const current = ref<Member | null>(null);
const formRef = ref();
const form = ref<any>({ name: '', phone: '', levelId: undefined, categoryId: undefined, tagIds: [] as Array<number|string>, password: '', password2: '', points: 0, balance: 0, avatarUrl: undefined as string | null | undefined });
const systemTagsRO = computed(() => (current.value?.tags || []).filter(t => (t as any).isSystem));
function isGroupOrderOwner(m: Member){
    const tags = (m?.tags || []) as any[];
    return tags.some(t => String(t?.name||'').toUpperCase() === 'GROUP_ORDER_OWNER');
}
function isGuestOrderOwner(m: Member){
    const tags = (m?.tags || []) as any[];
    return tags.some(t => String(t?.name||'').toUpperCase() === 'GUEST_ORDER_OWNER');
}
const guestOwnerInfo = ref<{ guestMemberId: number|null; exists?: boolean; tagged?: boolean }|null>(null);
const syncingGuest = ref(false);
async function loadGuestOwnerInfo(){ try{ guestOwnerInfo.value = (await memberControllerGetGuestOrderOwner() as any) || null; }catch{ guestOwnerInfo.value = null; } }
async function refreshGuestOwner(){ try{ syncingGuest.value = true; await memberControllerSyncGuestOrderOwner(); await loadGuestOwnerInfo(); await fetchList(); ElMessage.success('已刷新游客占位账号'); }catch(e:any){ ElMessage.error(String(e?.message||'刷新失败')); } finally { syncingGuest.value = false; } }

const rules = {
	name: [
		{ required: true, message: '请输入昵称', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (Array.from(String(val || '').trim()).length <= 10 ? cb() : cb(new Error('昵称最多10个字符'))), trigger: 'blur' },
	],
	phone: [
		{ required: true, message: '请输入手机号', trigger: 'blur' },
		{ validator: (_: any, val: string, cb: any) => (/^1\d{10}$/.test(val) ? cb() : cb(new Error('手机号格式不正确'))), trigger: 'blur' },
	],
	levelId: [{ required: true, message: '请选择会员等级', trigger: 'change' }],
	categoryId: [{ required: true, message: '请选择会员分类', trigger: 'change' }],
	password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
	password2: [{ validator: (_: any, _v: string, cb: any) => (form.value.password === form.value.password2 ? cb() : cb(new Error('两次输入的密码不一致'))), trigger: 'blur' }],
};

const pwdDialog = ref(false);
const pwdForm = ref<{ id?: number; password: string; password2: string }>({ password: '', password2: '' });

const delDialog = ref(false);
const delTarget = ref<Member | null>(null);
const delCountdown = ref(0);
let delTimer: any = null;

// 成长值日志弹窗
const growthDialog = ref(false);
const growthLoading = ref(false);
const growthLogs = ref<Array<{ createdAt: string; desc: string; change: number; orderId?: number|null; orderNo?: string|null }>>([]);
let growthMemberId: number | null = null;

async function openGrowthLogs(m: Member){
    growthDialog.value = true;
    growthLoading.value = true;
    growthLogs.value = [];
    growthMemberId = m.id;
    try{
        const rows = (await memberControllerGetGrowthLogsByMember(String(m.id), { limit: 100 } as any) as any) as any[];
        growthLogs.value = Array.isArray(rows) ? rows : [];
    } finally {
        growthLoading.value = false;
    }
}

function goOrderTag(g: { orderId?: number|null; orderNo?: string|null }){
    const id = Number(g?.orderId||0);
    const no = String(g?.orderNo||'').trim();
    if (id) { window.open(`/admin/orders/${id}`, '_blank'); return; }
    if (no) { window.open(`/admin/orders/no/${encodeURIComponent(no)}`, '_blank'); return; }
}

const adjustDialog = ref(false);
const adjustForm = ref<{ delta: number; remark: string }>({ delta: 0, remark: '' });
async function openAdjustDialog(){ if (!growthMemberId){ ElMessage.error('请先打开某位会员的成长日志'); return; } adjustForm.value = { delta: 0, remark: '' }; adjustDialog.value = true; }
async function saveAdjust(){
    if (!growthMemberId) { ElMessage.error('无效的会员'); return; }
    const delta = Math.trunc(Number(adjustForm.value.delta||0));
    if (!Number.isFinite(delta) || delta === 0){ ElMessage.error('变更值必须为非零整数'); return; }
    const remark = String(adjustForm.value.remark||'').trim();
    if (!remark){ ElMessage.error('请填写备注'); return; }
    // 二次确认
    const ok = await new Promise<boolean>(resolve=>{ const h=(window as any).confirm || ((msg:string)=>window.confirm(msg)); try{ resolve(!!h(`确认${delta>0?'增加':'扣减'}成长值 ${Math.abs(delta)} ？`)); }catch{ resolve(true); } });
    if (!ok) return;
    await memberControllerAdjustGrowth(String(growthMemberId), { delta, remark } as any);
    ElMessage.success('已调整'); adjustDialog.value = false; openGrowthLogs({ id: growthMemberId } as any); fetchList();
}

function formatTime(v?: string | null) {
	if (!v) return '-';
	try {
		const d = new Date(v as any);
		if (isNaN(d.getTime())) return '-';
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		const hh = String(d.getHours()).padStart(2, '0');
		const mi = String(d.getMinutes()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
	} catch {
		return '-';
	}
}

async function fetchLevels(){ levels.value = (await memberLevelControllerList() as any) as Level[]; }
async function fetchCategories(){ categories.value = (await memberCategoryControllerList() as any) as Category[]; }
async function fetchTags(){
	const all = (await memberTagControllerList() as any) as Tag[];
	// 前端在选择时隐藏系统默认标签，避免误选
	tagOptions.value = all.filter(t => !t.isSystem);
	// 筛选项：允许按系统标签过滤（只读）
	tagFilterOptions.value = Array.isArray(all) ? all : [];
}

type SortBy = ''|'growthPoints'|'totalPaidAmount'|'points'|'balance'|'createdAt'|'lastActiveAt';
type SortOrder = 'asc'|'desc';
const filters = reactive<{
	keyword: string;
	levelId?: number;
	categoryId?: number;
	tagId?: number;
	excludePlaceholders: boolean;
	createdFrom?: string;
	createdTo?: string;
	activeFrom?: string;
	activeTo?: string;
	sortBy: SortBy;
	sortOrder: SortOrder;
}>({
	keyword: '',
	levelId: undefined,
	categoryId: undefined,
	tagId: undefined,
	excludePlaceholders: false,
	createdFrom: undefined,
	createdTo: undefined,
	activeFrom: undefined,
	activeTo: undefined,
	sortBy: '',
	sortOrder: 'desc',
});

function addDaysDateOnly(dateOnly: string, days: number): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateOnly || '').trim());
	if (!m) return dateOnly;
	const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
	const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
	dt.setDate(dt.getDate() + days);
	const yy = dt.getFullYear();
	const mm = String(dt.getMonth() + 1).padStart(2, '0');
	const dd = String(dt.getDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}
function fmtDateOnly(v?: string){
	try{
		const s = String(v||'').trim();
		if (!s) return '';
		const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
		if (m) return m[1];
		const d = new Date(s);
		if (isNaN(d.getTime())) return s;
		const yy = d.getFullYear();
		const mm = String(d.getMonth()+1).padStart(2,'0');
		const dd = String(d.getDate()).padStart(2,'0');
		return `${yy}-${mm}-${dd}`;
	}catch{ return String(v||''); }
}
function rangeLabel(from?: string, toExclusive?: string){
	const a = String(from||'').trim();
	const b = String(toExclusive||'').trim();
	if (!a && !b) return '';
	const aa = a ? fmtDateOnly(a) : '—';
	let bb = '—';
	if (b){
		const dateOnly = fmtDateOnly(b);
		// 语义统一：to 为“排他上界”，按日展示时减 1 天
		bb = dateOnly ? addDaysDateOnly(dateOnly, -1) : '—';
	}
	return `${aa} ~ ${bb}`;
}
const createdRangeLabel = computed(()=> rangeLabel(filters.createdFrom, filters.createdTo));
const activeRangeLabel = computed(()=> rangeLabel(filters.activeFrom, filters.activeTo));
const showMore = ref(false);
const createdRangeValue = ref<[string,string] | null>(null);
const activeRangeValue = ref<[string,string] | null>(null);
function syncRangePickersFromFilters(){
	try{
		const cFrom = fmtDateOnly(filters.createdFrom||'');
		const cToEx = fmtDateOnly(filters.createdTo||'');
		createdRangeValue.value = (cFrom && cToEx) ? [cFrom, addDaysDateOnly(cToEx, -1)] : null;
		const aFrom = fmtDateOnly(filters.activeFrom||'');
		const aToEx = fmtDateOnly(filters.activeTo||'');
		activeRangeValue.value = (aFrom && aToEx) ? [aFrom, addDaysDateOnly(aToEx, -1)] : null;
	}catch{}
}
function onCreatedRangeChange(v: any){
	if (!v || !Array.isArray(v) || !v[0] || !v[1]){
		filters.createdFrom = undefined;
		filters.createdTo = undefined;
		createdRangeValue.value = null;
		onSearch();
		return;
	}
	filters.createdFrom = String(v[0]);
	// to 为排他上界：end + 1day
	filters.createdTo = addDaysDateOnly(String(v[1]), 1);
	onSearch();
}
function onActiveRangeChange(v: any){
	if (!v || !Array.isArray(v) || !v[0] || !v[1]){
		filters.activeFrom = undefined;
		filters.activeTo = undefined;
		activeRangeValue.value = null;
		onSearch();
		return;
	}
	filters.activeFrom = String(v[0]);
	filters.activeTo = addDaysDateOnly(String(v[1]), 1);
	onSearch();
}
function clearCreatedRange(){
	filters.createdFrom = undefined;
	filters.createdTo = undefined;
	createdRangeValue.value = null;
	onSearch();
}
function clearActiveRange(){
	filters.activeFrom = undefined;
	filters.activeTo = undefined;
	activeRangeValue.value = null;
	onSearch();
}

async function fetchList() {
	loading.value = true;
	try {
		const params: any = {
			keyword: String(filters.keyword || ''),
			page: String(page.value),
			pageSize: String(pageSize.value),
		};
		if (filters.levelId) params.levelId = String(filters.levelId);
		if (filters.categoryId) params.categoryId = String(filters.categoryId);
		if (filters.tagId) params.tagId = String(filters.tagId);
		if (filters.excludePlaceholders) params.excludePlaceholders = '1';
		if (filters.createdFrom) params.createdFrom = String(filters.createdFrom);
		if (filters.createdTo) params.createdTo = String(filters.createdTo);
		if (filters.activeFrom) params.activeFrom = String(filters.activeFrom);
		if (filters.activeTo) params.activeTo = String(filters.activeTo);
		if (filters.sortBy) params.sortBy = String(filters.sortBy);
		if (filters.sortOrder) params.sortOrder = String(filters.sortOrder);

		const res = (await memberControllerList(params as any) as any) as { items: Member[]; total: number; page: number; pageSize: number };
		list.value = Array.isArray(res?.items) ? res.items : [];
		total.value = Number(res?.total || 0);
	} finally {
		loading.value = false;
	}
}

function onPageChange(p: number) {
	page.value = p;
	fetchList();
}
function onPageSizeChange(s: number){
	pageSize.value = Number(s || 10);
	page.value = 1;
	fetchList();
}

function onSearch(){
	page.value = 1;
	fetchList();
}
function onReset(){
	filters.keyword = '';
	filters.levelId = undefined;
	filters.categoryId = undefined;
	filters.tagId = undefined;
	filters.excludePlaceholders = false;
	filters.createdFrom = undefined;
	filters.createdTo = undefined;
	filters.activeFrom = undefined;
	filters.activeTo = undefined;
	filters.sortBy = '';
	filters.sortOrder = 'desc';
	createdRangeValue.value = null;
	activeRangeValue.value = null;
	page.value = 1;
	fetchList();
}

function openCreate() {
	current.value = null;
	form.value = { name: '', phone: '', levelId: undefined, categoryId: undefined, tagIds: [], password: '', password2: '', points: 0, balance: 0, avatarUrl: undefined };
	dialogVisible.value = true;
}

function openEdit(item: Member) {
    if (isGroupOrderOwner(item)) { ElMessage.warning('集团订单占位会员禁止编辑'); return; }
	current.value = item;
	const nonSystemTagIds = (item.tags||[]).filter((t: any) => !t.isSystem).map(t=>t.id);
	form.value = { ...item, levelId: item.level?.id, categoryId: item.category?.id, tagIds: nonSystemTagIds, password: '', password2: '' };
	dialogVisible.value = true;
}

function openResetPwd(item: Member){ if (isGroupOrderOwner(item)) { ElMessage.warning('集团订单占位会员禁止修改密码'); return; } pwdForm.value = { id: item.id, password: '', password2: '' }; pwdDialog.value = true; }

async function onResetPwdSave(){
	if (!pwdForm.value.password || pwdForm.value.password !== pwdForm.value.password2) { ElMessage.error('两次密码不一致'); return; }
	await memberControllerSetPassword(String(pwdForm.value.id), { password: pwdForm.value.password } as any);
	pwdDialog.value = false; ElMessage.success('密码已更新');
}

	async function onSave() {
		saving.value = true;
		try {
			if (formRef.value) { await formRef.value.validate(); }
		// 将新输入的标签名先创建，再转换为ID
		const selected = Array.isArray(form.value.tagIds) ? [...form.value.tagIds] : [];
		const tagIdsNumeric: number[] = [];
		for (const v of selected) {
			if (typeof v === 'number') { tagIdsNumeric.push(v); continue; }
			const name = String(v).trim();
			if (!name) continue;
			const exists = tagOptions.value.find(t => t.name === name);
			if (exists) { tagIdsNumeric.push(exists.id); continue; }
			const created = (await memberTagControllerCreate({ name } as any) as any) as Tag;
			tagOptions.value.push(created);
			tagIdsNumeric.push(created.id);
		}
		const payload: any = { name: String(form.value.name || '').trim(), phone: form.value.phone, levelId: form.value.levelId, categoryId: form.value.categoryId, tagIds: tagIdsNumeric, points: form.value.points, balance: form.value.balance };
		if (form.value.avatarUrl !== undefined) payload.avatarUrl = form.value.avatarUrl;
		if (!current.value?.id && form.value.password) payload.password = form.value.password;
			if (current.value?.id) {
				await memberControllerUpdate(String(current.value.id), payload as any);
			} else {
				await memberControllerCreate(payload as any);
			}
			dialogVisible.value = false;
			ElMessage.success('已保存');
			fetchList();
		} catch (e:any) {
			ElMessage.error(String(e?.message||e||'保存失败'));
		} finally {
			saving.value = false;
		}
	}

function openDeleteDialog(item: Member){
	delTarget.value = item;
	delCountdown.value = 5;
	delDialog.value = true;
	if (delTimer) { clearInterval(delTimer); delTimer = null; }
	delTimer = setInterval(()=>{
		delCountdown.value = Math.max(0, delCountdown.value - 1);
		if (delCountdown.value === 0 && delTimer) { clearInterval(delTimer); delTimer = null; }
	}, 1000);
}

function clearDelTimer(){ if (delTimer) { clearInterval(delTimer); delTimer = null; } }

async function onDeleteConfirm(){
	if (!delTarget.value) return;
	if (isGroupOrderOwner(delTarget.value)) { ElMessage.warning('集团订单占位会员禁止删除'); delDialog.value=false; return; }
	await memberControllerRemove(String(delTarget.value.id));
	ElMessage.success('已删除');
	delDialog.value = false; delTarget.value = null; fetchList();
}

const route = useRoute();
function applyRouteQuery(){
	try{
		const q:any = route.query || {};
		if (q.keyword != null) filters.keyword = String(q.keyword||'');
		if (q.levelId != null) filters.levelId = Number(q.levelId)||undefined;
		if (q.categoryId != null) filters.categoryId = Number(q.categoryId)||undefined;
		if (q.tagId != null) filters.tagId = Number(q.tagId)||undefined;
		if (q.createdFrom != null) filters.createdFrom = String(q.createdFrom||'') || undefined;
		if (q.createdTo != null) filters.createdTo = String(q.createdTo||'') || undefined;
		if (q.excludePlaceholders != null) filters.excludePlaceholders = (String(q.excludePlaceholders)==='1' || String(q.excludePlaceholders).toLowerCase()==='true');
		if (q.sortBy != null) filters.sortBy = (String(q.sortBy||'') as any) || '';
		if (q.sortOrder != null) filters.sortOrder = (String(q.sortOrder||'').toLowerCase()==='asc' ? 'asc' : 'desc');
		if (q.activeFrom != null) filters.activeFrom = String(q.activeFrom||'') || undefined;
		if (q.activeTo != null) filters.activeTo = String(q.activeTo||'') || undefined;
		syncRangePickersFromFilters();
	}catch{}
}

onMounted(()=>{
	ensureSiteSetting();
	fetchLevels(); fetchCategories(); fetchTags();
	applyRouteQuery();
	fetchList();
	loadGuestOwnerInfo();
});

watch(() => route.fullPath, ()=>{
	// 支持从 Dashboard 跳转到同一页时更新筛选
	applyRouteQuery();
	fetchList();
});

// 读取站点默认头像，避免写死默认图
const siteSetting = ref<{ defaultMemberAvatarUrl?: string | null } | null>(null);
async function ensureSiteSetting(){ if (siteSetting.value) return; try { siteSetting.value = (await systemSettingControllerGetPublicSetting() as any) || null; } catch { siteSetting.value = { defaultMemberAvatarUrl: null }; } }
function toAbsUrl(path?: string | null) { if (!path) return ''; if (/^https?:\/\//i.test(path)) return path; return absUrl(path||''); }
function formatAvatar(url?: string | null){ const candidate = url || siteSetting.value?.defaultMemberAvatarUrl || ''; const u = toAbsUrl(candidate); return u || absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png'); }
async function uploadAvatar(o:any){ 
	const fd=new FormData(); 
	fd.append('file', o.file); 
	fd.append('dir','public'); 
	fd.append('source', 'avatar');  // 自动识别为头像上传
	const res=await fetch(`${API_BASE}/assets/upload`, { method:'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` } }); 
	const j=await res.json(); 
	form.value.avatarUrl = j?.url || null; 
	ElMessage.success('头像已上传'); 
}
function onAvatarClear(){ form.value.avatarUrl = null; ElMessage.success('已恢复默认头像'); }
const pickVisible = ref(false);
function openPickAvatar(){ pickVisible.value = true; }
function onPickedAvatar(list:any[]){ const first = Array.isArray(list) ? list[0] : null; if (first?.url) form.value.avatarUrl = first.url; }

// 会员详情抽屉（点击头像）
const detailDrawerVisible = ref(false);
const detailMemberId = ref<number | null>(null);
const detailBaseMember = ref<Member | null>(null);
function openDetailDrawer(m: Member){
	detailMemberId.value = m?.id ?? null;
	detailBaseMember.value = m || null;
	detailDrawerVisible.value = true;
}
</script>

<style scoped>
.op-btns { display: inline-flex; gap: 6px; align-items: center; }
.avatar-click{
	display:inline-flex;
	align-items:center;
	justify-content:center;
	width:40px;
	height:40px;
	border-radius:10px;
	cursor:pointer;
	transition: background-color .15s ease, transform .12s ease;
}
.avatar-click:hover{ background: #f3f6fb; }
.avatar-click:active{ transform: scale(0.98); }
.growth-logs { max-height: 60vh; overflow: auto; }
.growth-logs .list { display: flex; flex-direction: column; gap: 10px; }
.growth-logs .row { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto; gap: 2px 12px; padding: 10px 12px; border-radius: 8px; border: 1px solid #eef2f7; background: #fff; }
.growth-logs .desc { grid-column: 1 / 2; font-weight: 600; color: #111827; }
.growth-logs .change { grid-column: 2 / 3; justify-self: end; font-weight: 700; }
.growth-logs .change.plus { color: #16a34a; }
.growth-logs .change.minus { color: #ef4444; }
.growth-logs .time { grid-column: 1 / 3; color: #6b7280; font-size: 12px; }
.loading, .empty { color: #6b7280; text-align: center; padding: 24px 0; }

/* 顶部筛选条：紧凑布局，减少占用高度 */
.ml-filters{
	width: 100%;
	display:flex;
	flex-wrap:wrap;
	align-items:center;
	gap: 10px 12px;
	padding: 10px 12px;
	border: 1px solid var(--el-border-color-lighter);
	border-radius: 14px;
	background:
		linear-gradient(180deg, color-mix(in oklab, var(--el-color-primary), transparent 94%) 0%, transparent 70%),
		color-mix(in oklab, var(--el-bg-color), transparent 0%);
	box-shadow: 0 10px 24px rgba(17, 24, 39, 0.04);
}
.ml-filters :deep(.el-form-item){
	margin-right: 0;
	margin-bottom: 0;
}
.ml-filters :deep(.el-form-item__label){
	color: var(--el-text-color-secondary);
	font-size: 12px;
}
.ml-filters :deep(.el-input__wrapper),
.ml-filters :deep(.el-select__wrapper){
	border-radius: 10px;
}
.ml-w-140{ width: 140px; }
.ml-w-160{ width: 160px; }
.ml-w-240{ width: 240px; }
.ml-more-toggle :deep(.el-button){
	padding-inline: 8px;
}
.ml-sort-order{ margin-left: 8px; }
.ml-right{
	margin-left: auto;
	display:flex;
	align-items:center;
	gap: 8px;
}
.ml-guest-tag{ white-space: nowrap; }

/* 表格区域：在 BasePage(content overflow:hidden) 的前提下，使用“表格内部滚动” */
.ml-shell{
	height: 100%;
	min-height: 0;
	display:flex;
	flex-direction:column;
}
.ml-table{
	flex: 1 1 auto;
	min-height: 0;
	overflow: hidden;
	border: 1px solid #eef2f7;
	border-radius: 12px;
	background: #fff;
}
.ml-pager{
	margin-top: 12px;
	display:flex;
	justify-content:flex-end;
}
</style>

