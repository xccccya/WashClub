<template>
	<el-drawer
		:model-value="modelValue"
		@update:model-value="(v:boolean)=>emit('update:modelValue', v)"
		:with-header="false"
		size="min(960px, 92vw)"
		direction="rtl"
		append-to-body
		class="member-detail-drawer"
	>
		<div class="drawer-body">
			<!-- 第一行：头像、昵称 -->
			<div class="header">
				<div class="header-left">
					<el-avatar :size="44" :src="avatarSrc" />
					<div class="header-meta">
						<div class="name-row">
							<div class="name">{{ displayName }}</div>
							<el-tag v-if="member?.level?.name" size="small" effect="light" type="primary">{{ member.level.name }}</el-tag>
						</div>
						<div class="sub">
							<span class="muted">ID：</span><span class="mono">{{ memberId || '-' }}</span>
							<span class="sep">·</span>
							<span class="muted">UID：</span><span class="mono">{{ member?.uid ?? baseMember?.uid ?? '-' }}</span>
							<span class="sep">·</span>
							<span class="muted">手机号：</span><span class="mono">{{ member?.phone ?? baseMember?.phone ?? '-' }}</span>
						</div>
					</div>
				</div>
				<div class="header-right">
					<div class="last-visit">
						<div class="last-visit__label">上次到店</div>
						<div class="last-visit__value">{{ lastVisitAt ? formatTime(lastVisitAt) : '—' }}</div>
					</div>
					<el-button text @click="emit('update:modelValue', false)">关闭</el-button>
				</div>
			</div>

			<!-- 第二行：总计订单、总计消费金额、积分、经验、总计洗车次数 -->
			<div class="stats">
				<div class="stat-card">
					<div class="stat-label">总计订单</div>
					<div class="stat-value">{{ statsLoading ? '—' : totalOrders }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">累计消费金额</div>
					<div class="stat-value">{{ statsLoading ? '—' : `¥${formatMoney(totalPaidAmount)}` }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">积分</div>
					<div class="stat-value">{{ points }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">成长值</div>
					<div class="stat-value">{{ growthPoints }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">总计洗车次数</div>
					<div class="stat-value">{{ statsLoading ? '—' : totalWashCount }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">累计次卡划扣次数</div>
					<div class="stat-value">{{ statsLoading ? '—' : washCardDeductTimes }}</div>
				</div>
				<div class="stat-card">
					<div class="stat-label">洗车次卡余次</div>
					<div class="stat-value">{{ statsLoading ? '—' : washCardRemainingTimes }}</div>
				</div>
			</div>

			<!-- 第三行：信息类型选择 -->
			<div class="tabs">
				<el-tabs v-model="activeTab" class="tabs-inner" @tab-change="onTabChange" stretch>
					<el-tab-pane label="用户信息" name="profile" />
					<el-tab-pane label="消费记录" name="orders" />
					<el-tab-pane label="积分明细" name="points" />
					<el-tab-pane label="签到记录" name="signins" />
					<el-tab-pane label="持有优惠券" name="coupons" />
					<el-tab-pane label="洗车计次卡" name="washcards" />
					<el-tab-pane label="用户车辆" name="vehicles" />
				</el-tabs>
			</div>

			<!-- 第四行：内容 -->
			<div class="content">
				<!-- 用户信息 -->
				<div v-show="activeTab==='profile'" class="tab-panel">
					<el-skeleton v-if="memberLoading" :rows="6" animated />
					<template v-else>
						<el-card shadow="never" class="tab-card">
							<template #header>
								<div class="tab-card__header">
									<div class="tab-card__title">
										<div class="tab-card__title-text">用户信息</div>
										<div class="tab-card__subtitle muted">基础资料、密码、标签</div>
									</div>
									<div class="tab-card__actions">
										<el-button size="small" text @click="refreshActiveTab" title="刷新当前标签数据">
											<el-icon><Refresh /></el-icon>
											刷新
										</el-button>
									</div>
								</div>
							</template>
							<div class="profile">
							<div class="section">
								<div class="section-title-row">
									<div class="section-title-marker" />
									<div class="section-title">基本信息</div>
								</div>
								<div class="kv-grid">
									<div class="kv">
										<div class="k">用户编号：</div><div class="v">{{ member?.id ?? baseMember?.id ?? '-' }}</div>
									</div>
									<div class="kv">
										<div class="k">UID：</div><div class="v">{{ member?.uid ?? baseMember?.uid ?? '-' }}</div>
									</div>
									<div class="kv">
										<div class="k">昵称：</div><div class="v">{{ member?.name ?? baseMember?.name ?? '-' }}</div>
									</div>
									<div class="kv">
										<div class="k">手机号码：</div><div class="v">{{ member?.phone ?? baseMember?.phone ?? '-' }}</div>
									</div>
									<div class="kv">
										<div class="k">会员等级：</div><div class="v">{{ member?.level?.name ?? baseMember?.level?.name ?? '-' }}</div>
									</div>
									<div class="kv">
										<div class="k">会员分类：</div><div class="v">{{ member?.category?.name ?? baseMember?.category?.name ?? '-' }}</div>
									</div>
									<div class="kv">
										<div class="k">注册时间：</div><div class="v">{{ formatTime(member?.createdAt ?? baseMember?.createdAt) }}</div>
									</div>
									<div class="kv">
										<div class="k">活跃时间：</div><div class="v">{{ formatTime(member?.lastActiveAt ?? baseMember?.lastActiveAt) }}</div>
									</div>
								</div>
							</div>

							<div class="section">
								<div class="section-title-row">
									<div class="section-title-marker" />
									<div class="section-title">密码</div>
								</div>
								<div class="kv-grid">
									<div class="kv kv-wide">
										<div class="k">登录密码：</div>
										<div class="v">
											<div class="pwd-row">
												<span class="mono pwd-text">{{ passwordVisible ? (memberPassword || '未设置') : '********' }}</span>
												<el-button text class="pwd-btn" @click="passwordVisible = !passwordVisible" :title="passwordVisible ? '隐藏' : '显示'">
													<el-icon><component :is="passwordVisible ? Hide : View" /></el-icon>
												</el-button>
												<el-button text class="pwd-btn" @click="copyText(memberPassword)" title="复制 hash">
													<el-icon><CopyDocument /></el-icon>
												</el-button>
											</div>
											<div class="pwd-tip muted">提示：此处展示的是系统存储值（已加密 hash），仅供排查问题，请勿对外泄露。</div>
										</div>
									</div>
								</div>
							</div>

							<div class="section">
								<div class="section-title-row">
									<div class="section-title-marker" />
									<div class="section-title">用户概况</div>
								</div>
								<div class="kv-grid">
									<div class="kv">
										<div class="k">积分：</div><div class="v">{{ points }}</div>
									</div>
									<div class="kv">
										<div class="k">余额：</div><div class="v">{{ member?.balance ?? baseMember?.balance ?? 0 }}</div>
									</div>
									<div class="kv">
										<div class="k">成长值：</div><div class="v">{{ growthPoints }}</div>
									</div>
									<div class="kv kv-wide">
										<div class="k">用户标签：</div>
										<div class="v">
											<div v-if="(member?.tags || baseMember?.tags || []).length" class="tag-list">
												<el-tag v-for="t in (member?.tags || baseMember?.tags || [])" :key="t.id" size="small" effect="plain">{{ t.name }}</el-tag>
											</div>
											<span v-else class="muted">-</span>
										</div>
									</div>
								</div>
							</div>
							</div>
						</el-card>
					</template>
				</div>

				<!-- 消费记录 -->
				<div v-show="activeTab==='orders'" class="tab-panel">
					<el-card shadow="never" class="tab-card">
						<template #header>
							<div class="tab-card__header">
								<div class="tab-card__title">
									<div class="tab-card__title-text">消费记录</div>
									<div class="tab-card__subtitle muted">共 {{ ordersAllTotal }} 笔（顶部统计口径为“已支付且已完成”）</div>
								</div>
								<div class="tab-card__actions">
									<el-button size="small" text @click="refreshActiveTab" title="刷新当前标签数据">
										<el-icon><Refresh /></el-icon>
										刷新
									</el-button>
								</div>
							</div>
						</template>
						<el-skeleton v-if="ordersLoading" :rows="8" animated />
						<el-empty v-else-if="ordersAllPaged.length===0" description="暂无记录" />
						<el-table v-else :data="ordersAllPaged" size="small" stripe class="nice-table" style="width:100%">
						<el-table-column prop="no" label="订单号" min-width="220">
							<template #default="{ row }">
								<el-link type="primary" underline="never" @click="goOrder(row)">{{ row.no }}</el-link>
							</template>
						</el-table-column>
						<el-table-column prop="type" label="类型" width="90">
							<template #default="{ row }">{{ typeLabel(row.type) }}</template>
						</el-table-column>
						<el-table-column prop="payStatus" label="支付" width="90">
							<template #default="{ row }">
								<el-tag size="small" :type="payStatusTagType(row.payStatus)">{{ payStatusLabel(row.payStatus) }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="payAmount" label="支付金额" width="120">
							<template #default="{ row }">¥{{ formatMoney(row.payAmount) }}</template>
						</el-table-column>
						<el-table-column prop="createdAt" label="下单时间" width="170">
							<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
						</el-table-column>
						</el-table>
						<div v-if="ordersAllTotal>ordersPageSize" class="pager">
							<el-pagination
								background
								layout="sizes, prev, pager, next, jumper"
								:total="ordersAllTotal"
								:page-size="ordersPageSize"
								:current-page="ordersPage"
								:page-sizes="pageSizes"
								@current-change="(p:number)=>{ ordersPage=p; }"
								@size-change="(s:number)=>{ ordersPageSize=s; ordersPage=1; }"
							/>
						</div>
					</el-card>
				</div>

				<!-- 积分明细 -->
				<div v-show="activeTab==='points'" class="tab-panel">
					<el-card shadow="never" class="tab-card">
						<template #header>
							<div class="tab-card__header">
								<div class="tab-card__title">
									<div class="tab-card__title-text">积分明细</div>
									<div class="tab-card__subtitle muted">共 {{ pointsTotal }} 条</div>
								</div>
								<div class="tab-card__actions">
									<el-button size="small" text @click="refreshActiveTab" title="刷新当前标签数据">
										<el-icon><Refresh /></el-icon>
										刷新
									</el-button>
								</div>
							</div>
						</template>
						<el-skeleton v-if="pointsLoading" :rows="8" animated />
						<el-empty v-else-if="pointsPaged.length===0" description="暂无记录" />
						<el-table v-else :data="pointsPaged" size="small" stripe class="nice-table" style="width:100%">
						<el-table-column prop="createdAt" label="时间" width="180">
							<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
						</el-table-column>
						<el-table-column prop="change" label="变动" width="100">
							<template #default="{ row }">
								<span :style="{ color: Number(row.change)>0 ? '#16a34a' : '#ef4444', fontWeight: 700 }">
									{{ Number(row.change)>0 ? `+${row.change}` : row.change }}
								</span>
							</template>
						</el-table-column>
						<el-table-column prop="source" label="来源" width="120" />
						<el-table-column label="关联订单" min-width="160">
							<template #default="{ row }">
								<el-link v-if="row.orderNo" type="primary" underline="never" @click="goOrder(row)">{{ row.orderNo }}</el-link>
								<span v-else class="muted">—</span>
							</template>
						</el-table-column>
						<el-table-column prop="desc" label="备注" min-width="180" />
						</el-table>
						<div v-if="pointsTotal>pointsPageSize" class="pager">
							<el-pagination
								background
								layout="sizes, prev, pager, next, jumper"
								:total="pointsTotal"
								:page-size="pointsPageSize"
								:current-page="pointsPage"
								:page-sizes="pageSizes"
								@current-change="(p:number)=>{ pointsPage=p; }"
								@size-change="(s:number)=>{ pointsPageSize=s; pointsPage=1; }"
							/>
						</div>
					</el-card>
				</div>

				<!-- 签到记录 -->
				<div v-show="activeTab==='signins'" class="tab-panel">
					<el-card shadow="never" class="tab-card">
						<template #header>
							<div class="tab-card__header">
								<div class="tab-card__title">
									<div class="tab-card__title-text">签到记录</div>
									<div class="tab-card__subtitle muted">连续 {{ signinStatus?.streakDays ?? 0 }} 天 · 累计 {{ signinStatus?.totalDays ?? 0 }} 天</div>
								</div>
								<div class="tab-card__actions">
									<el-button size="small" text @click="refreshActiveTab" title="刷新当前标签数据">
										<el-icon><Refresh /></el-icon>
										刷新
									</el-button>
								</div>
							</div>
						</template>
						<el-skeleton v-if="signinsLoading" :rows="8" animated />
						<template v-else>
							<el-card shadow="never" class="inline-card">
								<div class="mini-stats">
									<div class="mini">
										<div class="mini-value">{{ signinStatus?.totalDays ?? 0 }}</div>
										<div class="mini-label">累计天数</div>
									</div>
									<div class="divider" />
									<div class="mini">
										<div class="mini-value" style="color:#2563eb;">{{ signinStatus?.streakDays ?? 0 }}</div>
										<div class="mini-label">连续天数</div>
									</div>
									<div class="divider" />
									<div class="mini">
										<div class="mini-value" style="color:#16a34a;">{{ signinStatus?.totalGrowth ?? 0 }}</div>
										<div class="mini-label">累计成长值</div>
									</div>
								</div>
							</el-card>
							<el-empty v-if="signinPaged.length===0" description="暂无记录" />
							<el-table v-else :data="signinPaged" size="small" stripe class="nice-table" style="width:100%">
							<el-table-column prop="dateStr" label="日期" width="160" />
							<el-table-column prop="growthGranted" label="成长值" width="120" />
							</el-table>
							<div v-if="signinTotal>signinPageSize" class="pager">
								<el-pagination
									background
									layout="sizes, prev, pager, next, jumper"
									:total="signinTotal"
									:page-size="signinPageSize"
									:current-page="signinPage"
									:page-sizes="pageSizes"
									@current-change="(p:number)=>{ signinPage=p; }"
									@size-change="(s:number)=>{ signinPageSize=s; signinPage=1; }"
								/>
							</div>
						</template>
					</el-card>
				</div>

				<!-- 持有优惠券 -->
				<div v-show="activeTab==='coupons'" class="tab-panel">
					<el-card shadow="never" class="tab-card">
						<template #header>
							<div class="tab-card__header">
								<div class="tab-card__title">
									<div class="tab-card__title-text">持有优惠券</div>
									<div class="tab-card__subtitle muted">共 {{ couponsTotal }} 张</div>
								</div>
								<div class="tab-card__actions">
									<el-button size="small" text @click="refreshActiveTab" title="刷新当前标签数据">
										<el-icon><Refresh /></el-icon>
										刷新
									</el-button>
								</div>
							</div>
						</template>
						<el-skeleton v-if="couponsLoading" :rows="8" animated />
						<el-empty v-else-if="coupons.length===0" description="暂无记录" />
						<el-table v-else :data="coupons" size="small" stripe class="nice-table" style="width:100%">
						<el-table-column prop="coupon.name" label="卡券名称" min-width="160" />
						<el-table-column label="有效期" min-width="220">
							<template #default="{ row }">
								<span>{{ formatTime(row.startAt) || '-' }}</span>
								<span class="muted"> ~ </span>
								<span>{{ formatTime(row.endAt) || '-' }}</span>
							</template>
						</el-table-column>
						<el-table-column label="状态" width="120">
							<template #default="{ row }">
								<el-tag size="small" :type="row.usedAt ? 'info' : (isExpired(row) ? 'danger' : 'success')">
									{{ row.usedAt ? '已使用' : (isExpired(row) ? '已过期' : '可用') }}
								</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="usedAt" label="使用时间" width="180">
							<template #default="{ row }">{{ formatTime(row.usedAt) }}</template>
						</el-table-column>
						</el-table>
						<div v-if="couponsTotal>couponsPageSize" class="pager">
							<el-pagination
								background
								layout="sizes, prev, pager, next, jumper"
								:total="couponsTotal"
								:page-size="couponsPageSize"
								:current-page="couponsPage"
								:page-sizes="pageSizes"
								@current-change="onCouponsPage"
								@size-change="onCouponsPageSize"
							/>
						</div>
					</el-card>
				</div>

				<!-- 洗车计次卡 -->
				<div v-show="activeTab==='washcards'" class="tab-panel">
					<el-card shadow="never" class="tab-card">
						<template #header>
							<div class="tab-card__header">
								<div class="tab-card__title">
									<div class="tab-card__title-text">洗车计次卡</div>
									<div class="tab-card__subtitle muted">共 {{ washCardsTotal }} 张</div>
								</div>
								<div class="tab-card__actions">
									<el-button size="small" text @click="refreshActiveTab" title="刷新当前标签数据">
										<el-icon><Refresh /></el-icon>
										刷新
									</el-button>
								</div>
							</div>
						</template>
						<el-skeleton v-if="washCardsLoading" :rows="8" animated />
						<el-empty v-else-if="washCards.length===0" description="暂无记录" />
						<el-table v-else :data="washCards" size="small" stripe class="nice-table" style="width:100%">
						<el-table-column prop="name" label="卡名称" min-width="160" show-overflow-tooltip />
						<el-table-column prop="cardNo" label="卡号" width="140" />
						<el-table-column label="次数(剩/总)" width="140">
							<template #default="{ row }">{{ row.remainingTimes }}/{{ row.totalTimes }}</template>
						</el-table-column>
						<el-table-column prop="expiryAt" label="有效期" width="180">
							<template #default="{ row }">{{ formatTime(row.expiryAt) || '永久' }}</template>
						</el-table-column>
						<el-table-column label="共享" min-width="220" show-overflow-tooltip>
							<template #default="{ row }">
								<span v-if="(row.shares||[]).length===0" class="muted">—</span>
								<span v-else>
									<el-tag v-for="s in row.shares" :key="s.id" size="small" effect="plain" style="margin-right:6px;">
										{{ s.member?.name || s.member?.phone || s.memberId }}
									</el-tag>
								</span>
							</template>
						</el-table-column>
						</el-table>
						<div v-if="washCardsTotal>washCardsPageSize" class="pager">
							<el-pagination
								background
								layout="sizes, prev, pager, next, jumper"
								:total="washCardsTotal"
								:page-size="washCardsPageSize"
								:current-page="washCardsPage"
								:page-sizes="pageSizes"
								@current-change="onWashCardsPage"
								@size-change="onWashCardsPageSize"
							/>
						</div>
					</el-card>
				</div>

				<!-- 用户车辆 -->
				<div v-show="activeTab==='vehicles'" class="tab-panel">
					<el-card shadow="never" class="tab-card">
						<template #header>
							<div class="tab-card__header">
								<div class="tab-card__title">
									<div class="tab-card__title-text">用户车辆</div>
									<div class="tab-card__subtitle muted">共 {{ vehiclesTotal }} 辆</div>
								</div>
								<div class="tab-card__actions">
									<el-button size="small" text @click="refreshActiveTab" title="刷新当前标签数据">
										<el-icon><Refresh /></el-icon>
										刷新
									</el-button>
								</div>
							</div>
						</template>
						<el-skeleton v-if="vehiclesLoading" :rows="8" animated />
						<el-empty v-else-if="vehiclesPaged.length===0" description="暂无记录" />
						<el-table v-else :data="vehiclesPaged" size="small" stripe class="nice-table" style="width:100%">
						<el-table-column prop="plateNumber" label="车牌" width="140" />
						<el-table-column prop="brand" label="品牌" min-width="120" show-overflow-tooltip />
						<el-table-column prop="series" label="车系" min-width="120" show-overflow-tooltip />
						<el-table-column prop="typeMain" label="类型" width="120" show-overflow-tooltip />
						<el-table-column prop="color" label="颜色" width="120" show-overflow-tooltip />
						<el-table-column prop="isDefault" label="默认" width="90">
							<template #default="{ row }">
								<el-tag size="small" :type="row.isDefault ? 'success' : 'info'">{{ row.isDefault ? '是' : '否' }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="createdAt" label="创建时间" width="170">
							<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
						</el-table-column>
						</el-table>
						<div v-if="vehiclesTotal>vehiclesPageSize" class="pager">
							<el-pagination
								background
								layout="sizes, prev, pager, next, jumper"
								:total="vehiclesTotal"
								:page-size="vehiclesPageSize"
								:current-page="vehiclesPage"
								:page-sizes="pageSizes"
								@current-change="(p:number)=>{ vehiclesPage=p; }"
								@size-change="(s:number)=>{ vehiclesPageSize=s; vehiclesPage=1; }"
							/>
						</div>
					</el-card>
				</div>
			</div>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { View, Hide, CopyDocument, Refresh } from '@element-plus/icons-vue';
import { absUrl } from '../../utils/http';
import {
	memberControllerGet,
	memberPointsControllerListLogs,
	memberSignInControllerGetMemberStatus,
	memberSignInControllerList,
	memberCouponAdminControllerList,
	orderControllerList,
	systemSettingControllerGetPublicSetting,
	vehicleControllerListByMember,
	washCardControllerAdminList,
	washCardControllerAdminMemberStats,
} from '@wash/api-client';

type MemberLite = any;

const props = defineProps<{
	modelValue: boolean;
	memberId: number | null;
	baseMember?: MemberLite | null;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', v: boolean): void;
}>();

const activeTab = ref<'profile' | 'orders' | 'points' | 'signins' | 'coupons' | 'washcards' | 'vehicles'>('profile');
const pageSizes = [10, 20, 30, 50, 100];

const siteSetting = ref<{ defaultMemberAvatarUrl?: string | null } | null>(null);
async function ensureSiteSetting() {
	if (siteSetting.value) return;
	try {
		siteSetting.value = ((await systemSettingControllerGetPublicSetting()) as any) || null;
	} catch {
		siteSetting.value = { defaultMemberAvatarUrl: null };
	}
}
function formatAvatar(url?: string | null) {
	const candidate = url || siteSetting.value?.defaultMemberAvatarUrl || '';
	const u = absUrl(candidate);
	return u || absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png');
}

const member = ref<any>(null);
const memberLoading = ref(false);
const passwordVisible = ref(false);
const memberPassword = computed(() => {
	const v = member.value?.password;
	return v ? String(v) : '';
});

const orders = ref<any[]>([]);
const ordersLoading = ref(false);
const washCardStatsLoading = ref(false);
const washCardStats = ref<{ deductTimes: number; remainingTimes: number } | null>(null);
const statsLoading = computed(() => memberLoading.value || ordersLoading.value || washCardStatsLoading.value);

const pointsLoading = ref(false);
const pointsLogs = ref<any[]>([]);

const signinsLoading = ref(false);
const signinStatus = ref<any>(null);
const signinLogs = ref<any[]>([]);

const couponsLoading = ref(false);
const coupons = ref<any[]>([]);
const couponsTotal = ref(0);
const couponsPage = ref(1);
const couponsPageSize = ref(20);

const washCardsLoading = ref(false);
const washCards = ref<any[]>([]);
const washCardsTotal = ref(0);
const washCardsPage = ref(1);
const washCardsPageSize = ref(20);

const vehiclesLoading = ref(false);
const vehicles = ref<any[]>([]);
const vehiclesPage = ref(1);
const vehiclesPageSize = ref(10);

const displayName = computed(() => member.value?.name ?? props.baseMember?.name ?? '会员');
const avatarSrc = computed(() => formatAvatar(member.value?.avatarUrl ?? props.baseMember?.avatarUrl));

const points = computed(() => Number(member.value?.points ?? props.baseMember?.points ?? 0) || 0);
const growthPoints = computed(() => Number(member.value?.growthPoints ?? props.baseMember?.growthPoints ?? 0) || 0);
const washCardDeductTimes = computed(() => Number(washCardStats.value?.deductTimes || 0) || 0);
const washCardRemainingTimes = computed(() => Number(washCardStats.value?.remainingTimes || 0) || 0);

function isPaidCompleted(o: any): boolean {
	// 后端口径：SERVICE 完成通常为 fulfillmentStatus=DONE 且/或 status=FULFILLED；SP 完成一般为 status=CLOSED
	const payOk = String(o?.payStatus || '').toUpperCase() === 'PAID';
	const status = String(o?.status || '').toUpperCase();
	const fs = String(o?.fulfillmentStatus || '').toUpperCase();
	const statusOk = status === 'CLOSED' || status === 'FULFILLED' || fs === 'DONE';
	return payOk && statusOk && !o?.deletedAt;
}
const ordersPaidCompleted = computed(() => orders.value.filter(isPaidCompleted));
const totalOrders = computed(() => ordersPaidCompleted.value.length);
function washTimesOfOrder(o: any): number {
	// 口径：一个订单可能包含多个“计入次数的洗车项目”，需按项目数量统计（后端已下发 washTimes）
	if (String(o?.type || '').toUpperCase() !== 'SERVICE') return 0;
	const n = Number(o?.washTimes);
	if (Number.isFinite(n) && n >= 0) return n;
	// 兜底：若后端未下发 washTimes（旧版本），回退为“每单算 1 次”
	return 1;
}
const totalWashCount = computed(() => ordersPaidCompleted.value.reduce((acc: number, o: any) => acc + washTimesOfOrder(o), 0));
const totalPaidAmount = computed(() => {
	// 只算已支付且已完成
	return ordersPaidCompleted.value.reduce((acc: number, o: any) => acc + Number(o?.payAmount || 0), 0);
});

const lastVisitAt = computed<string | null>(() => {
	try {
		const times = orders.value
			.filter((o: any) => String(o?.type || '').toUpperCase() === 'SERVICE')
			.map((o) => new Date(o?.createdAt || 0).getTime())
			.filter((t: number) => Number.isFinite(t) && t > 0);
		if (!times.length) return null;
		const max = Math.max(...times);
		return new Date(max).toISOString();
	} catch {
		return null;
	}
});

// 订单分页（展示全部订单）
const ordersPage = ref(1);
const ordersPageSize = ref(10);
const ordersAllTotal = computed(() => orders.value.length);
const ordersAllPaged = computed(() => orders.value.slice((ordersPage.value - 1) * ordersPageSize.value, ordersPage.value * ordersPageSize.value));

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
function formatMoney(v: any) {
	try {
		const n = Number(v || 0);
		return n.toFixed(2);
	} catch {
		return '0.00';
	}
}

function typeLabel(v?: string) {
	if (v === 'SERVICE') return '服务';
	if (v === 'SP') return '商品';
	if (v === 'FK') return '付款';
	return v || '-';
}
function payStatusLabel(v?: string) {
	if (v === 'UNPAID') return '未支付';
	if (v === 'PAID') return '已支付';
	if (v === 'REFUNDED') return '已退款';
	if (v === 'CANCELLED') return '已作废';
	return v || '-';
}
function payStatusTagType(v?: string) {
	if (v === 'UNPAID') return 'info';
	if (v === 'PAID') return 'success';
	if (v === 'REFUNDED') return 'warning';
	if (v === 'CANCELLED') return 'danger';
	return undefined as any;
}

function goOrder(row: any) {
	try {
		const id = Number(row?.id || row?.orderId || 0);
		const no = String(row?.orderNo || row?.no || '').trim();
		if (id) {
			window.open(`/pos/orders/${id}`, '_blank');
			return;
		}
		if (no) {
			window.open(`/pos/orders/no/${encodeURIComponent(no)}`, '_blank');
			return;
		}
	} catch {}
}

function isExpired(row: any): boolean {
	try {
		const endAt = row?.endAt ? new Date(row.endAt).getTime() : 0;
		if (!endAt) return false;
		return Date.now() > endAt;
	} catch {
		return false;
	}
}

function resetAll() {
	activeTab.value = 'profile';
	member.value = null;
	orders.value = [];
	washCardStats.value = null;
	washCardStatsLoading.value = false;
	pointsLogs.value = [];
	signinStatus.value = null;
	signinLogs.value = [];
	coupons.value = [];
	couponsTotal.value = 0;
	washCards.value = [];
	washCardsTotal.value = 0;
	vehicles.value = [];
	passwordVisible.value = false;
	ordersPage.value = 1;
	ordersPageSize.value = 10;
	pointsPage.value = 1;
	pointsPageSize.value = 10;
	signinPage.value = 1;
	signinPageSize.value = 10;
	couponsPage.value = 1;
	couponsPageSize.value = 20;
	washCardsPage.value = 1;
	washCardsPageSize.value = 20;
	vehiclesPage.value = 1;
	vehiclesPageSize.value = 10;
	_pointsLoaded.value = false;
	_signinsLoaded.value = false;
	_couponsLoaded.value = false;
	_washCardsLoaded.value = false;
	_vehiclesLoaded.value = false;
}

async function loadBase() {
	if (!props.memberId) return;
	await ensureSiteSetting();
	memberLoading.value = true;
	ordersLoading.value = true;
	washCardStatsLoading.value = true;
	try {
		const id = String(props.memberId);
		const statsP = washCardControllerAdminMemberStats({ memberId: Number(id) } as any).catch(() => null);
		const [m, o, ws] = await Promise.all([
			memberControllerGet(id),
			orderControllerList({ memberId: id, includeDeleted: false } as any),
			statsP,
		]);
		member.value = (m as any) || null;
		const rows = Array.isArray(o) ? (o as any[]) : ((o as any)?.items || (o as any)?.data?.items || []);
		orders.value = Array.isArray(rows) ? rows : [];
		washCardStats.value = ws ? { deductTimes: Number((ws as any)?.deductTimes || 0) || 0, remainingTimes: Number((ws as any)?.remainingTimes || 0) || 0 } : null;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载会员详情失败'));
	} finally {
		memberLoading.value = false;
		ordersLoading.value = false;
		washCardStatsLoading.value = false;
	}
}

const _pointsLoaded = ref(false);
const _signinsLoaded = ref(false);
const _couponsLoaded = ref(false);
const _washCardsLoaded = ref(false);
const _vehiclesLoaded = ref(false);

// 积分分页（全量拉取后前端分页）
const pointsPage = ref(1);
const pointsPageSize = ref(10);
const pointsTotal = computed(() => pointsLogs.value.length);
const pointsPaged = computed(() => pointsLogs.value.slice((pointsPage.value - 1) * pointsPageSize.value, pointsPage.value * pointsPageSize.value));

// 签到分页（全量拉取后前端分页）
const signinPage = ref(1);
const signinPageSize = ref(10);
const signinTotal = computed(() => signinLogs.value.length);
const signinPaged = computed(() => signinLogs.value.slice((signinPage.value - 1) * signinPageSize.value, signinPage.value * signinPageSize.value));

// 车辆分页（全量拉取后前端分页）
const vehiclesTotal = computed(() => vehicles.value.length);
const vehiclesPaged = computed(() => vehicles.value.slice((vehiclesPage.value - 1) * vehiclesPageSize.value, vehiclesPage.value * vehiclesPageSize.value));

async function loadPointsIfNeeded(force = false) {
	if ((!force && _pointsLoaded.value) || !props.memberId) return;
	pointsLoading.value = true;
	try {
		const rows = (await memberPointsControllerListLogs({ memberId: String(props.memberId) } as any)) as any;
		const list = Array.isArray(rows) ? rows : [];
		pointsLogs.value = list;
		pointsPage.value = 1;
		_pointsLoaded.value = true;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载积分明细失败'));
	} finally {
		pointsLoading.value = false;
	}
}

async function loadSigninsIfNeeded(force = false) {
	if ((!force && _signinsLoaded.value) || !props.memberId) return;
	signinsLoading.value = true;
	try {
		const [s, rows] = await Promise.all([
			memberSignInControllerGetMemberStatus({ memberId: props.memberId } as any),
			memberSignInControllerList({ memberId: props.memberId } as any),
		]);
		signinStatus.value = (s as any) || null;
		signinLogs.value = Array.isArray(rows) ? (rows as any[]) : [];
		signinPage.value = 1;
		_signinsLoaded.value = true;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载签到记录失败'));
	} finally {
		signinsLoading.value = false;
	}
}

async function loadCouponsIfNeeded(force = false) {
	if ((!force && _couponsLoaded.value) || !props.memberId) return;
	await fetchCouponsPage(1, couponsPageSize.value, true);
}

async function loadWashCardsIfNeeded(force = false) {
	if ((!force && _washCardsLoaded.value) || !props.memberId) return;
	await fetchWashCardsPage(1, washCardsPageSize.value, true);
}

async function loadVehiclesIfNeeded(force = false) {
	if ((!force && _vehiclesLoaded.value) || !props.memberId) return;
	vehiclesLoading.value = true;
	try {
		const rows: any = await vehicleControllerListByMember(String(props.memberId));
		vehicles.value = Array.isArray(rows) ? rows : [];
		vehiclesPage.value = 1;
		_vehiclesLoaded.value = true;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载车辆失败'));
	} finally {
		vehiclesLoading.value = false;
	}
}

async function fetchCouponsPage(page: number, pageSize: number, markLoaded = false) {
	if (!props.memberId) return;
	couponsLoading.value = true;
	try {
		const res: any = await memberCouponAdminControllerList({ page, pageSize, memberId: props.memberId } as any);
		coupons.value = Array.isArray(res?.items) ? res.items : [];
		couponsTotal.value = Number(res?.total || 0);
		couponsPage.value = page;
		couponsPageSize.value = pageSize;
		if (markLoaded) _couponsLoaded.value = true;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载优惠券失败'));
	} finally {
		couponsLoading.value = false;
	}
}
function onCouponsPage(p: number) { fetchCouponsPage(p, couponsPageSize.value); }
function onCouponsPageSize(s: number) { fetchCouponsPage(1, s); }

async function fetchWashCardsPage(page: number, pageSize: number, markLoaded = false) {
	if (!props.memberId) return;
	washCardsLoading.value = true;
	try {
		const res: any = await washCardControllerAdminList({ page, pageSize, memberId: props.memberId } as any);
		washCards.value = Array.isArray(res?.items) ? res.items : [];
		washCardsTotal.value = Number(res?.total || 0);
		washCardsPage.value = page;
		washCardsPageSize.value = pageSize;
		if (markLoaded) _washCardsLoaded.value = true;
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载洗车计次卡失败'));
	} finally {
		washCardsLoading.value = false;
	}
}
function onWashCardsPage(p: number) { fetchWashCardsPage(p, washCardsPageSize.value); }
function onWashCardsPageSize(s: number) { fetchWashCardsPage(1, s); }

async function onTabChange() {
	if (activeTab.value === 'points') await loadPointsIfNeeded();
	if (activeTab.value === 'signins') await loadSigninsIfNeeded();
	if (activeTab.value === 'coupons') await loadCouponsIfNeeded();
	if (activeTab.value === 'washcards') await loadWashCardsIfNeeded();
	if (activeTab.value === 'vehicles') await loadVehiclesIfNeeded();
}

async function refreshActiveTab() {
	if (!props.memberId) return;
	if (activeTab.value === 'profile' || activeTab.value === 'orders') {
		await loadBase();
		return;
	}
	if (activeTab.value === 'points') { _pointsLoaded.value = false; await loadPointsIfNeeded(true); return; }
	if (activeTab.value === 'signins') { _signinsLoaded.value = false; await loadSigninsIfNeeded(true); return; }
	if (activeTab.value === 'coupons') { _couponsLoaded.value = false; await loadCouponsIfNeeded(true); return; }
	if (activeTab.value === 'washcards') { _washCardsLoaded.value = false; await loadWashCardsIfNeeded(true); return; }
	if (activeTab.value === 'vehicles') { _vehiclesLoaded.value = false; await loadVehiclesIfNeeded(true); return; }
}

async function copyText(text: string) {
	const v = String(text || '').trim();
	if (!v) { ElMessage.warning('暂无可复制内容'); return; }
	try {
		await navigator.clipboard.writeText(v);
		ElMessage.success('已复制');
	} catch {
		try {
			const ta = document.createElement('textarea');
			ta.value = v;
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			ta.style.top = '-9999px';
			document.body.appendChild(ta);
			ta.focus();
			ta.select();
			const ok = document.execCommand('copy');
			document.body.removeChild(ta);
			ok ? ElMessage.success('已复制') : ElMessage.error('复制失败');
		} catch {
			ElMessage.error('复制失败');
		}
	}
}

watch(
	() => props.modelValue,
	async (v) => {
		if (!v) {
			resetAll();
			return;
		}
		await loadBase();
	},
);

watch(
	() => props.memberId,
	async () => {
		if (!props.modelValue) return;
		resetAll();
		await loadBase();
	},
);
</script>

<style scoped>
.drawer-body{
	padding: 18px 18px 16px 18px;
	display:flex;
	flex-direction:column;
	height:100%;
	box-sizing:border-box;
	background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}
.header{
	display:flex;
	align-items:flex-start;
	justify-content:space-between;
	gap:12px;
	padding-bottom: 12px;
	border-bottom: 1px solid #eef2f7;
}
.header-left{
	display:flex;
	align-items:center;
	gap:12px;
	min-width:0;
}
.header-meta{ min-width:0; }
.name-row{ display:flex; align-items:center; gap:8px; }
.name{
	font-weight: 800;
	color:#111827;
	font-size: 18px;
	line-height: 22px;
	white-space:nowrap;
	overflow:hidden;
	text-overflow:ellipsis;
	max-width: 520px;
}
.sub{
	margin-top: 4px;
	font-size: 12px;
	color:#6b7280;
	white-space:nowrap;
	overflow:hidden;
	text-overflow:ellipsis;
}
.sep{ margin: 0 8px; color:#cbd5e1; }
.muted{ color:#6b7280; }
.mono{ font-variant-numeric: tabular-nums; }
.last-visit{
	display:flex;
	flex-direction:column;
	align-items:flex-end;
	gap: 2px;
	padding: 6px 10px;
	border-radius: 10px;
	border: 1px solid #eef2f7;
	background: #ffffff;
	margin-right: 8px;
}
.last-visit__label{ font-size: 12px; color:#6b7280; }
.last-visit__value{ font-size: 12px; font-weight: 700; color:#111827; font-variant-numeric: tabular-nums; }
.header-right{ display:flex; align-items:flex-start; gap: 8px; }

.stats{
	margin-top: 14px;
	display:grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 10px;
}
.stat-card{
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px solid #eef2f7;
	background: #ffffff;
	box-shadow: 0 1px 0 rgba(17,24,39,0.02);
}
.stat-label{ font-size: 12px; color:#6b7280; }
.stat-value{
	margin-top: 6px;
	font-size: 18px;
	font-weight: 800;
	color:#111827;
	letter-spacing: -0.2px;
	font-variant-numeric: tabular-nums;
}

.tabs{ margin-top: 12px; }
.tabs-inner :deep(.el-tabs__header){ margin: 0; }
.tabs-inner :deep(.el-tabs__nav-wrap::after){ height: 1px; background: #eef2f7; }

.content{
	margin-top: 12px;
	flex: 1;
	min-height: 0;
	overflow: auto;
	padding-right: 2px;
}
.tab-panel{ padding: 2px 0 0 0; }
.tab-card{
	border-radius: 14px;
	border: 1px solid #eef2f7;
	background: rgba(255,255,255,0.9);
	box-shadow: 0 1px 0 rgba(17,24,39,0.02);
}
.tab-card :deep(.el-card__header){
	padding: 12px 14px;
	border-bottom: 1px solid #eef2f7;
	background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}
.tab-card :deep(.el-card__body){ padding: 14px; }
.tab-card__header{
	display:flex;
	align-items:flex-start;
	justify-content:space-between;
	gap: 12px;
}
.tab-card__title{ min-width: 0; }
.tab-card__title-text{
	font-weight: 900;
	color:#111827;
	letter-spacing: -0.2px;
}
.tab-card__subtitle{
	margin-top: 2px;
	font-size: 12px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 560px;
}
.tab-card__actions{ display:flex; align-items:center; gap: 6px; flex: 0 0 auto; }

.nice-table :deep(.el-table__header th){
	background: #f8fafc !important;
	color: #334155;
	font-weight: 800;
}
.nice-table :deep(.el-table__row:hover td){
	background: #f8fbff !important;
}
.nice-table :deep(.el-table__cell){
	padding-top: 10px;
	padding-bottom: 10px;
}
.pager{ margin-top: 12px; display:flex; justify-content:flex-end; }
.tag-list{ display:flex; flex-wrap:wrap; gap:6px; }
.inline-card{ margin-bottom: 12px; border-radius: 12px; }
.mini-stats{ display:flex; align-items:center; justify-content:space-between; gap: 14px; }
.mini{ flex:1; text-align:center; }
.mini-value{ font-size: 20px; font-weight: 900; color:#111827; font-variant-numeric: tabular-nums; }
.mini-label{ font-size: 12px; color:#6b7280; margin-top: 2px; }
.divider{ width: 1px; align-self: stretch; background: #eef2f7; }

.profile{ display:flex; flex-direction:column; gap: 16px; }
.section-title-row{ display:flex; align-items:center; gap: 8px; margin-bottom: 10px; }
.section-title-marker{ width: 3px; height: 16px; border-radius: 2px; background: #2563eb; }
.section-title{ font-weight: 800; color:#111827; }
.kv-grid{
	display:grid;
	grid-template-columns: 1fr 1fr 1fr;
	gap: 10px 18px;
	padding-bottom: 10px;
	border-bottom: 1px dashed #eef2f7;
}
.section:last-child .kv-grid{ border-bottom: none; padding-bottom: 0; }
.kv{ display:flex; gap: 6px; min-width: 0; }
.kv-wide{ grid-column: 1 / -1; }
.k{ color:#6b7280; flex: 0 0 auto; }
.v{ color:#111827; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pwd-row{ display:flex; align-items:center; gap: 6px; }
.pwd-btn{ padding: 0 4px; }
.pwd-text{ word-break: break-all; white-space: normal; }
.pwd-tip{ margin-top: 4px; font-size: 12px; }

@media (max-width: 860px){
	.stats{ grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
	.name{ max-width: 340px; }
	.kv-grid{ grid-template-columns: 1fr; }
	.last-visit{ display:none; }
}
</style>

