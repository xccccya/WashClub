<template>
	<BasePage title="会员车辆">
		<template #actions>
			<el-input v-model="keyword" placeholder="搜索车牌/VIN/品牌/车型" style="width:260px;margin-right:8px;" />
			<el-select
				v-model="filterMemberId"
				filterable
				remote
				clearable
				:remote-method="searchMembersForFilter"
				:loading="filterMembersLoading"
				placeholder="按会员筛选（昵称/手机号）"
				style="width: 320px; margin-right: 8px;"
				@change="onFilterMemberChange"
			>
				<el-option v-for="m in filterMemberOptions" :key="m.id" :label="memberLabel(m)" :value="m.id" />
			</el-select>
			<el-tag v-if="memberIdFilter" type="success" effect="light" style="margin-right:8px;">
				已筛选：{{ memberIdFilterLabel || `会员ID ${memberIdFilter}` }}
			</el-tag>
			<el-button v-if="memberIdFilter" @click="clearMemberFilter" style="margin-right:8px;">清除筛选</el-button>
			<el-button @click="fetchList" :loading="loading" style="margin-right:8px;">
				<el-icon style="vertical-align: middle; margin-right:4px;"><Search /></el-icon>
				<span style="vertical-align: middle;">搜索</span>
			</el-button>
			<el-dropdown>
				<el-button type="primary"><el-icon style="vertical-align: middle; margin-right:4px;"><CirclePlus /></el-icon><span style="vertical-align: middle;">新增车辆</span></el-button>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item @click="openCreate('member')"><el-icon style="margin-right:6px;"><User /></el-icon>绑定到会员</el-dropdown-item>
						<el-dropdown-item divided @click="openCreate('guest')"><el-icon style="margin-right:6px;"><UserFilled /></el-icon>新增游客车辆</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</template>
		<el-table :data="list" stripe style="width:100%" highlight-current-row @row-dblclick="onRowDblClick">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="plateNumber" label="车牌号" width="180">
				<template #default="{ row }">
					<div style="display:flex;align-items:center;gap:8px;">
						<template v-if="isNoPlateRow(row)">
							<el-tag type="info" effect="plain">无牌车</el-tag>
							<el-tooltip effect="dark" placement="top" :content="`系统保留占位车牌：${noPlateNumber}`">
								<span class="muted mono">{{ row.plateNumber }}</span>
							</el-tooltip>
						</template>
						<template v-else>
							<span class="mono">{{ row.plateNumber }}</span>
						</template>
					</div>
				</template>
			</el-table-column>
			<el-table-column prop="vin" label="VIN" width="160">
				<template #default="{ row }">{{ row.vin || '-' }}</template>
			</el-table-column>
			<el-table-column label="品牌/车系" min-width="240" show-overflow-tooltip>
				<template #default="{ row }">
					<div class="brand-series-cell">
						<img v-if="row.brandImage" :src="toAbs(row.brandImage)" class="mini-icon" />
						<span class="brand-series-text">{{ (row.brand||'-') + ' / ' + (row.series||'-') }}</span>
					</div>
				</template>
			</el-table-column>
			<el-table-column label="类型" min-width="180" show-overflow-tooltip>
				<template #default="{ row }">{{ (row.typeMain||'-') + (row.typeSub?(' / '+row.typeSub):'') }}</template>
			</el-table-column>
			<el-table-column prop="color" label="颜色" width="120" />
			<el-table-column label="会员" min-width="220" show-overflow-tooltip>
				<template #default="{ row }">{{ row.member ? `${row.member.name}（${row.member.phone}）` : '游客' }}</template>
			</el-table-column>
			<el-table-column label="默认" width="100">
				<template #default="{ row }">
					<el-tag :type="row.isDefault? 'success' : 'info'">{{ row.isDefault ? '是' : '否' }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="320" fixed="right">
				<template #default="{ row }">
					<el-tooltip v-if="isNoPlateRow(row)" effect="dark" placement="top" content="系统保留无牌车：已锁定，不允许编辑/绑定/改绑/设默认/删除">
						<span>
							<el-button size="small" link disabled><el-icon><Edit /></el-icon><span>编辑</span></el-button>
							<el-button size="small" link type="warning" disabled><el-icon><RefreshRight /></el-icon><span>改绑</span></el-button>
							<el-button size="small" link type="success" disabled><el-icon><Star /></el-icon><span>设为默认</span></el-button>
							<el-button size="small" link type="warning" disabled><el-icon><User /></el-icon><span>绑定会员</span></el-button>
							<el-button size="small" link type="danger" disabled><el-icon><Delete /></el-icon><span>删除</span></el-button>
						</span>
					</el-tooltip>
					<template v-else>
						<el-button size="small" link @click="openEdit(row)"><el-icon><Edit /></el-icon><span>编辑</span></el-button>
						<el-button v-if="row.memberId" size="small" link type="warning" @click="openRebind(row)"><el-icon><RefreshRight /></el-icon><span>改绑</span></el-button>
						<el-button size="small" link type="success" :disabled="row.isDefault" @click="setDefault(row)"><el-icon><Star /></el-icon><span>设为默认</span></el-button>
						<el-button v-if="!row.memberId" size="small" link type="warning" @click="openBindMember(row)"><el-icon><User /></el-icon><span>绑定会员</span></el-button>
						<el-button size="small" link type="danger" @click="openDelete(row)"><el-icon><Delete /></el-icon><span>删除</span></el-button>
					</template>
				</template>
			</el-table-column>
		</el-table>
		<div style="margin-top:12px;display:flex;justify-content:flex-end;">
			<el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />
		</div>

		<el-dialog v-model="dialogVisible" :title="current?.id ? '编辑车辆' : '新增车辆'" width="560px">
			<el-form :model="form" label-width="100px">
				<el-form-item v-if="!current?.id && createMode==='member'" label="选择会员" required>
					<el-select v-model="form.memberId" placeholder="请选择会员" filterable style="width:100%">
						<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name || '会员'}（${m.phone}）`" :value="m.id" />
					</el-select>
				</el-form-item>
				<el-form-item v-if="isNoPlateInput(form.plateNumber)" label="提示">
					<el-alert type="warning" show-icon :closable="false" title="该车牌为系统保留“无牌车”占位车牌，已锁定。" description="请勿创建/绑定/修改为该车牌。如需使用无牌车下单/入队，请在收银端/服务队列使用“一键无牌车”。" />
				</el-form-item>
				<el-form-item label="车牌号" required>
					<el-input v-model="form.plateNumber" :disabled="current ? isNoPlateRow(current) : false" placeholder="例如 川A12345 或 川AD12345" />
				</el-form-item>
				<el-form-item label="VIN"><el-input v-model="form.vin" placeholder="17位 VIN（可选）" /></el-form-item>
				<!-- 品牌选择（首字母筛选 + 可搜索） -->
				<el-form-item label="车辆品牌">
					<div style="width:100%">
						<div class="letter-bar" v-if="brandsLoaded">
							<span :class="['letter', selectedLetter===null?'active':'']" @click="selectLetter(null)">全部</span>
							<span v-for="ch in brandLetters" :key="ch" :class="['letter', selectedLetter===ch?'active':'']" @click="selectLetter(ch)">{{ ch }}</span>
						</div>
						<el-select :key="brandSelectKey" ref="brandSelectRef" v-model="form.brandId" filterable placeholder="选择品牌（可搜索）" style="width:100%" :loading="brandLoading" @change="onBrandChange" @visible-change="onBrandDropdownVisible">
							<template #prefix>
								<img v-if="currentBrand?.img" :src="formatBrandImg(currentBrand.img)" class="brand-logo prefix" />
							</template>
							<el-option v-for="b in brandOptions" :key="b.brand_id" :label="`${b.main_brand_name}-${b.brand_name}`" :value="b.brand_id">
								<div class="brand-option">
									<img v-if="b.img" :src="formatBrandImg(b.img)" class="brand-logo" />
									<span class="brand-text">{{ b.main_brand_name }}-{{ b.brand_name }}</span>
								</div>
							</el-option>
						</el-select>
					</div>
				</el-form-item>
				<!-- 车系选择（可搜索） -->
				<el-form-item label="车辆车系">
					<el-select v-model="form.seriesId" filterable placeholder="选择车系（可搜索）" style="width:100%" :disabled="!form.brandId" :loading="seriesLoading" @change="onSeriesChange">
						<template #prefix>
							<img v-if="currentBrand?.img" :src="formatBrandImg(currentBrand.img)" class="brand-logo prefix" />
						</template>
						<el-option v-for="s in seriesOptions" :key="s.series_id" :label="s.series_name" :value="s.series_id">
							<div class="brand-option">
								<img v-if="currentBrand?.img" :src="formatBrandImg(currentBrand.img)" class="brand-logo" />
								<span class="brand-text">{{ s.series_name }}</span>
							</div>
						</el-option>
					</el-select>
				</el-form-item>
				<el-form-item label="车辆主类" required>
					<el-select v-model="form.typeMain" placeholder="请选择车辆主类" style="width:100%" :disabled="lockTypeBySeries">
						<el-option v-for="t in typeMainOptions" :key="t" :label="t" :value="t" />
					</el-select>
					<small v-if="lockTypeBySeries" style="color:#909399;margin-left:8px;">已根据车系自动选择</small>
				</el-form-item>
				<el-form-item label="车辆子类">
					<el-select v-model="form.typeSub" placeholder="可选" clearable style="width:100%" :disabled="lockTypeBySeries">
						<el-option v-for="t in typeSubOptions(form.typeMain)" :key="t" :label="t" :value="t" />
					</el-select>
				</el-form-item>
				<el-form-item label="车辆颜色">
					<el-select v-model="form.color" placeholder="可选" clearable style="width:100%">
						<el-option v-for="c in colorOptions" :key="c" :label="c" :value="c" />
					</el-select>
				</el-form-item>
				<el-form-item label="默认车辆"><el-switch v-model="form.isDefault" /></el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" :loading="saving" :disabled="(current && isNoPlateRow(current)) || isNoPlateInput(form.plateNumber)" @click="onSave">保存</el-button>
			</template>
		</el-dialog>

		<el-dialog v-model="delDialog" title="确认删除" width="420px">
			<div>确认删除该车辆？此操作不可恢复。</div>
			<template #footer>
				<el-button @click="delDialog=false">取消</el-button>
				<el-button type="danger" @click="onDeleteConfirm">确认</el-button>
			</template>
		</el-dialog>

		<!-- 绑定会员 -->
		<el-dialog v-model="bindDialog" title="绑定会员" width="480px">
			<el-form label-width="100px">
				<el-form-item label="选择会员">
					<el-select v-model="bindMemberId" placeholder="请选择会员" filterable style="width:100%">
						<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name || '会员'}（${m.phone}）`" :value="m.id" />
					</el-select>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="bindDialog=false">取消</el-button>
				<el-button type="primary" @click="onBindSave">绑定</el-button>
			</template>
		</el-dialog>

		<!-- 改绑（仅已绑定会员车辆） -->
		<el-dialog v-model="rebindDialog" title="改绑车辆" width="560px" @closed="resetRebindDialog">
			<div v-if="rebindVehicle" class="rebind-head">
				<div class="rebind-title">
					<div class="plate-chip">{{ rebindVehicle.plateNumber }}</div>
					<div class="muted rebind-sub">当前归属：{{ rebindVehicle.member ? `${rebindVehicle.member.name}（${rebindVehicle.member.phone}）` : `会员ID ${rebindVehicle.memberId}` }}</div>
				</div>
			</div>
			<el-form label-width="120px">
				<el-form-item label="改绑方式" required>
					<el-radio-group v-model="rebindMode">
						<el-radio value="toMember">换绑到其他会员</el-radio>
						<el-radio value="toGuest">解除绑定（变为游客）</el-radio>
					</el-radio-group>
				</el-form-item>

				<el-form-item v-if="rebindMode==='toMember'" label="目标会员" required>
					<el-select
						v-model="rebindToMemberId"
						filterable
						remote
						clearable
						:remote-method="searchMembersForRebind"
						:loading="rebindMembersLoading"
						placeholder="按昵称/手机号搜索会员"
						style="width:100%"
					>
						<el-option v-for="m in rebindMemberOptions" :key="m.id" :label="memberLabel(m)" :value="m.id" />
					</el-select>
				</el-form-item>

				<el-form-item v-if="rebindMode==='toGuest'" label="提示">
					<el-alert title="解除绑定后，该车辆将变为游客车辆（memberId 为空）。" type="warning" show-icon :closable="false" />
				</el-form-item>

				<el-form-item label="备注（建议）">
					<el-input v-model="rebindRemark" type="textarea" :rows="3" placeholder="例如：客户更换手机号/录入错误/门店调整" />
				</el-form-item>

				<el-form-item label="二次确认" required>
					<el-checkbox v-model="rebindConfirm">我已确认该操作会影响车辆归属与后续服务记录</el-checkbox>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="rebindDialog=false">取消</el-button>
				<el-button type="primary" :loading="rebindSaving" @click="submitRebind">确认改绑</el-button>
			</template>
		</el-dialog>

		<!-- 查看车辆信息（美化版） -->
		<el-dialog v-model="viewDialog" title="车辆信息" width="920px">
			<div v-if="viewItem" class="view-wrap">
				<el-alert
					v-if="isNoPlateRow(viewItem)"
					type="warning"
					show-icon
					:closable="false"
					title="系统保留无牌车：已锁定"
					description="该车辆用于无牌车/忘记车牌的下单与入队占位。为避免误操作，不允许在后台编辑/删除/绑定/改绑。"
				/>
				<el-card shadow="never" class="vehicle-card">
					<div class="vehicle-card__grid">
						<div class="vehicle-card__main">
							<div class="vehicle-card__head">
								<div class="vehicle-card__plate">
									<span :class="['plate-chip', plateClass(viewItem.plateNumber)]">{{ viewItem.plateNumber }}</span>
									<el-tag size="small" :type="viewItem.isDefault ? 'success' : 'info'">
										{{ viewItem.isDefault ? '默认车' : '非默认' }}
									</el-tag>
								</div>
								<div class="vehicle-card__meta">
									<div class="meta-pill" title="品牌">
										<img v-if="viewItem.brandImage" :src="toAbs(viewItem.brandImage)" class="meta-icon" />
										<span class="meta-k">品牌</span>
										<span class="meta-v">{{ viewItem.brand || '-' }}</span>
									</div>
									<div class="meta-pill" title="车系">
										<span class="meta-k">车系</span>
										<span class="meta-v">{{ viewItem.series || '-' }}</span>
									</div>
									<div class="meta-pill" title="类型">
										<span class="meta-k">类型</span>
										<span class="meta-v">{{ (viewItem.typeMain||'-') + (viewItem.typeSub?(' / '+viewItem.typeSub):'') }}</span>
									</div>
									<div class="meta-pill" title="颜色">
										<span class="meta-k">颜色</span>
										<el-tag size="small" class="meta-color" :style="colorTagStyle(viewItem.color)">{{ viewItem.color || '-' }}</el-tag>
									</div>
								</div>
								<div class="vehicle-card__sub muted">
									<span>ID {{ viewItem.id }}</span>
									<span class="dot">·</span>
									<span>VIN {{ viewItem.vin || '-' }}</span>
									<span class="dot">·</span>
									<span v-if="viewItem.member">{{ `${viewItem.member.name}（${viewItem.member.phone}）` }}</span>
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
										<div class="v-line"><span class="muted">创建</span><span class="mono">{{ formatDateTime(viewItem.createdAt) }}</span></div>
										<div class="v-line"><span class="muted">修改</span><span class="mono">{{ formatDateTime(viewItem.updatedAt) }}</span></div>
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
					size="760px"
					:with-header="true"
				>
					<template #header>
						<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
							<div style="min-width:0;">
								<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
									<span style="font-weight:700;">订单记录</span>
									<el-tag size="small" effect="light">{{ viewItem?.plateNumber || '-' }}</el-tag>
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

				<el-card shadow="never" class="inline-card rebind-logs-card">
					<div class="section-head">
						<div class="section-title">改绑记录</div>
						<div style="display:flex; align-items:center; gap:8px;">
							<el-button size="small" @click="fetchRebindLogs" :loading="rebindLogsLoading">刷新</el-button>
						</div>
					</div>
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
				</el-card>
			</div>
			<template #footer>
				<el-button @click="viewDialog=false">关闭</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BasePage } from '@wash/shared-ui';
import {
	carDataControllerGetBrands,
	carDataControllerGetSeries,
	type CarBrandGroupDto,
	type CarSeriesDto,
	memberControllerGet,
	memberControllerList,
	vehicleControllerAdminList,
	vehicleControllerAdminRebind,
	vehicleControllerBindMember,
	vehicleControllerCreateForMember,
	vehicleControllerCreateGuest,
	vehicleControllerListByMember,
	vehicleControllerRemove,
	vehicleControllerSetDefault,
	vehicleControllerUpdateVehicle,
} from '@wash/api-client';
import { API_BASE, resolveNoPlateNumber } from '../config';
import { absUrl } from '../utils/http';
import { ElMessage } from 'element-plus';
import { ElIcon } from 'element-plus';
import { Search, CirclePlus, User, UserFilled, Edit, Star, Delete, RefreshRight } from '@element-plus/icons-vue';

type Vehicle = { id: number; plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain: string; typeSub?: string | null; color?: string | null; isDefault: boolean; memberId: number | null; brandImage?: string | null; seriesImage?: string | null; createdAt?: string | null; updatedAt?: string | null; member?: { id: number; name: string; phone: string } };

const route = useRoute();
const router = useRouter();

const list = ref<Vehicle[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const keyword = ref('');

type MemberOption = { id: number; name: string; phone: string };

const memberIdFilter = computed<number | null>(() => {
	const raw: any = (route.query as any)?.memberId;
	const v = Array.isArray(raw) ? raw[0] : raw;
	const n = Number(v || 0);
	return Number.isFinite(n) && n > 0 ? n : null;
});

const filterMemberId = ref<number | null>(null);
const filterMemberOptions = ref<MemberOption[]>([]);
const filterMembersLoading = ref(false);
const memberIdFilterLabel = computed(() => {
	const id = memberIdFilter.value;
	if (!id) return '';
	const m = filterMemberOptions.value.find((x) => Number(x.id) === Number(id));
	if (m) return memberLabel(m);
	const m2 = memberOptions.value.find((x) => Number(x.id) === Number(id));
	if (m2) return memberLabel(m2 as any);
	return '';
});

function memberLabel(m: any): string {
	const name = String(m?.name || '会员');
	const phone = String(m?.phone || '-');
	return `${name}（${phone}）`;
}

function clearMemberFilter() {
	const q: any = { ...(route.query as any) };
	delete q.memberId;
	router.replace({ query: q });
}

const dialogVisible = ref(false);
const createMode = ref<'member'|'guest'>('member');
const saving = ref(false);
const current = ref<Vehicle | null>(null);
const form = ref<any>({ plateNumber: '', vin: '', brandId: undefined as number | undefined, brandName: '', seriesId: undefined as number | undefined, seriesName: '', typeMain: '', typeSub: '', color: '', isDefault: false, memberId: undefined as number | undefined });
const memberOptions = ref<MemberOption[]>([]);
function toAbs(u?: string | null){ return absUrl(u || ''); }

const noPlateNumber = resolveNoPlateNumber();
function isNoPlateInput(plate: any): boolean {
	try{
		const s = String(plate || '').trim().toUpperCase();
		const target = String(noPlateNumber || '川K00000').trim().toUpperCase();
		return !!s && s === target;
	}catch{ return false; }
}
function isNoPlateRow(row: any): boolean {
	return isNoPlateInput(row?.plateNumber);
}

const delDialog = ref(false);
const delId = ref<number | null>(null);
const viewDialog = ref(false);
const viewItem = ref<Vehicle | null>(null);

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
const rebindLogsLoading = ref(false);
const rebindLogs = ref<any[]>([]);
const rebindLogsPage = ref(1);
const rebindLogsPageSize = ref(10);
const rebindLogsTotal = ref(0);

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

async function fetchRebindLogs() {
	if (!viewItem.value?.id) return;
	rebindLogsLoading.value = true;
	try {
		const token = localStorage.getItem('token') || '';
		const url = `${API_BASE}/vehicle/${viewItem.value.id}/rebind-logs?page=${rebindLogsPage.value}&pageSize=${rebindLogsPageSize.value}`;
		const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) {
			const ct = res.headers.get('content-type') || '';
			if (ct.includes('application/json')) {
				const j: any = await res.json().catch(() => ({}));
				throw new Error(j?.message || `HTTP ${res.status}`);
			}
			throw new Error((await res.text()) || `HTTP ${res.status}`);
		}
		const j: any = await res.json();
		rebindLogs.value = Array.isArray(j?.items) ? j.items : [];
		rebindLogsTotal.value = Number(j?.total || 0);
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '加载改绑记录失败'));
	} finally {
		rebindLogsLoading.value = false;
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

function openOrderInNewTab(orderId: number) {
	const id = Number(orderId || 0);
	if (!id) return;
	try {
		window.open(`/admin/orders/${id}`, '_blank');
	} catch {
		router.push(`/orders/${id}`);
	}
}

function formatMoney(input: any): string {
	const n = Number(input ?? 0);
	if (!Number.isFinite(n)) return '0.00';
	return n.toFixed(2);
}

function formatOrderType(t: any): string {
	const s = String(t || '').toUpperCase();
	if (s === 'SERVICE') return '服务';
	if (s === 'SP') return '商品';
	if (s === 'FK') return '付款';
	return s || '-';
}

function formatOrderStatus(row: any): string {
	// 优先按常用口径展示：已完成/待支付/进行中等
	const type = String(row?.type || '').toUpperCase();
	const pay = String(row?.payStatus || '').toUpperCase();
	const f = String(row?.fulfillmentStatus || '').toUpperCase();
	const status = String(row?.status || '').toUpperCase();

	// 服务完成口径（与后端 last-visit 一致）
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
	if (!viewItem.value?.id) return;
	if (!canViewOrders()) {
		lastVisitAt.value = null;
		lastVisitOrderId.value = null;
		return;
	}
	lastVisitLoading.value = true;
	try {
		const token = localStorage.getItem('token') || '';
		const url = `${API_BASE}/vehicle/${viewItem.value.id}/last-visit`;
		const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) {
			const ct = res.headers.get('content-type') || '';
			if (ct.includes('application/json')) {
				const j: any = await res.json().catch(() => ({}));
				throw new Error(j?.message || `HTTP ${res.status}`);
			}
			throw new Error((await res.text()) || `HTTP ${res.status}`);
		}
		const j: any = await res.json();
		lastVisitAt.value = j?.lastVisitAt ? String(j.lastVisitAt) : null;
		lastVisitOrderId.value = Number(j?.serviceOrderId || 0) || null;
	} catch (e: any) {
		// 无权限时不打扰用户（页面已做权限提示）；其它错误给出轻提示
		const msg = String(e?.message || e || '');
		if (!/403|forbidden/i.test(msg)) ElMessage.error(msg || '加载最近到店失败');
		lastVisitAt.value = null;
		lastVisitOrderId.value = null;
	} finally {
		lastVisitLoading.value = false;
	}
}

async function fetchVehicleMetrics() {
	if (!viewItem.value?.id) return;
	if (!canViewOrders()) {
		metricsWashCardDeductTimes.value = 0;
		metricsSpentAmount.value = 0;
		metricsWashTimes.value = 0;
		return;
	}
	metricsLoading.value = true;
	try {
		const token = localStorage.getItem('token') || '';
		const url = `${API_BASE}/vehicle/${viewItem.value.id}/metrics`;
		const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) {
			const ct = res.headers.get('content-type') || '';
			if (ct.includes('application/json')) {
				const j: any = await res.json().catch(() => ({}));
				throw new Error(j?.message || `HTTP ${res.status}`);
			}
			throw new Error((await res.text()) || `HTTP ${res.status}`);
		}
		const j: any = await res.json();
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
	if (!viewItem.value?.id) return;
	if (!canViewOrders()) return;
	ordersLoading.value = true;
	try {
		const token = localStorage.getItem('token') || '';
		const url = `${API_BASE}/vehicle/${viewItem.value.id}/orders?page=${ordersPage.value}&pageSize=${ordersPageSize.value}`;
		const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) {
			const ct = res.headers.get('content-type') || '';
			if (ct.includes('application/json')) {
				const j: any = await res.json().catch(() => ({}));
				throw new Error(j?.message || `HTTP ${res.status}`);
			}
			throw new Error((await res.text()) || `HTTP ${res.status}`);
		}
		const j: any = await res.json();
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
	// 首次打开时再拉取，避免弹窗打开即额外请求
	if (!ordersTotalKnown.value && orders.value.length === 0) {
		ordersPage.value = 1;
		fetchVehicleOrders();
	}
}

// 绑定会员
const bindDialog = ref(false);
const bindVehicle = ref<Vehicle | null>(null);
const bindMemberId = ref<number | null>(null);
function openBindMember(v: Vehicle){
	if (isNoPlateRow(v)) { ElMessage.warning('系统保留无牌车已锁定，禁止绑定会员'); return; }
	bindVehicle.value = v; bindMemberId.value = null; bindDialog.value = true;
}
async function onBindSave(){
	if (!bindVehicle.value?.id || !bindMemberId.value) { ElMessage.error('请选择会员'); return; }
	await vehicleControllerBindMember(String(bindVehicle.value.id), String(bindMemberId.value));
	bindDialog.value = false;
	ElMessage.success('已绑定');
	fetchList();
}
const typeMainOptions = ['轿车', 'SUV', 'MPV', '卡车', '跑车'];
const typeSubMap: Record<string, string[]> = {
    '轿车': ['微型车','小型车','紧凑型车','中型车','中大型车','大型车'],
    'SUV': ['小型SUV','紧凑型SUV','中型SUV','中大型SUV','大型SUV'],
    'MPV': ['小型MPV','紧凑型MPV','中型MPV','中大型MPV','大型MPV'],
    '卡车': ['轻卡','微卡','皮卡','房车'],
    '跑车': [],
};
const colorOptions = ['黑色','白色','灰色','银色','红色','金色（米/香槟）','蓝色','棕色（褐/咖啡）','紫色','绿色','粉色','黄色','橙色','其他（彩绘/混合）'];
function typeSubOptions(main?: string){ return main ? (typeSubMap[main] || []) : []; }

// 车型数据统一通过后端代理获取，客户端不持有第三方服务密钥。
type FlatBrand = { brand_id: number; brand_name: string; main_brand_name: string; letter: string; img?: string };
const brandLetters = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
const selectedLetter = ref<string | null>(null);
const brandLoading = ref(false);
const brandsLoaded = ref(false);
const seriesLoading = ref(false);
const brandOptionsAll = ref<FlatBrand[]>([]);
const brandOptions = ref<FlatBrand[]>([]);
const brandSelectRef = ref();
const brandSelectKey = ref(0);
const seriesOptions = ref<CarSeriesDto[]>([]);
const lockTypeBySeries = ref(false);

function selectLetter(ch: string | null){
    selectedLetter.value = ch;
    applyBrandFilter();
    // 解决 Element Plus select 选项过滤后下拉未刷新问题：重建组件实例
    try { brandSelectKey.value++; } catch {}
}
function applyBrandFilter(){
    const all = brandOptionsAll.value;
    brandOptions.value = selectedLetter.value ? all.filter(b => (b.letter||'').toUpperCase() === selectedLetter.value) : all;
}
async function fetchBrands(){
    brandLoading.value = true;
    try {
		const arr: CarBrandGroupDto[] = await carDataControllerGetBrands();
        const flat: FlatBrand[] = [];
        for (const mb of arr){
            for (const b of (mb.brand_list || [])){
                flat.push({ brand_id: b.brand_id, brand_name: b.brand_name, main_brand_name: mb.main_brand_name, letter: (mb.letter||'').toUpperCase(), img: b.img || mb.img });
            }
        }
        brandOptionsAll.value = flat;
        applyBrandFilter();
        brandsLoaded.value = true;
    } catch { brandOptionsAll.value = []; brandOptions.value = []; }
    finally { brandLoading.value = false; }
}
async function fetchSeries(brandId: number){
    if (!brandId) { seriesOptions.value = []; return; }
    seriesLoading.value = true;
    try {
		seriesOptions.value = await carDataControllerGetSeries({ brandId });
    } catch { seriesOptions.value = []; }
    finally { seriesLoading.value = false; }
}
function onBrandChange(val: number){
    const b = brandOptionsAll.value.find(x => x.brand_id === val);
    form.value.brandName = b?.brand_name || '';
    currentBrand.value = b || null;
    form.value.seriesId = undefined; form.value.seriesName = '';
    fetchSeries(val);
}
function onSeriesChange(val: number){
    const s = seriesOptions.value.find(x => x.series_id === val);
    form.value.seriesName = s?.series_name || '';
    // 根据返回的 scale 推导主类与子类
    const scale = (s?.scale || '').toString();
    const { main, sub } = mapScaleToType(scale);
    if (main) form.value.typeMain = main;
    if (sub) form.value.typeSub = sub;
    lockTypeBySeries.value = !!val;
}

async function fetchList(){
    loading.value = true;
    try {
        if (memberIdFilter.value) {
			const rows: any = await vehicleControllerListByMember(String(memberIdFilter.value));
			const all: Vehicle[] = Array.isArray(rows) ? rows : [];
			const kw = String(keyword.value || '').trim().toLowerCase();
			const filtered = kw
				? all.filter((v: any) => {
						const hay = [
							v?.plateNumber,
							v?.vin,
							v?.brand,
							v?.series,
							v?.typeMain,
							v?.typeSub,
							v?.color,
						]
							.filter(Boolean)
							.join(' ')
							.toLowerCase();
						return hay.includes(kw);
				  })
				: all;
			total.value = filtered.length;
			const start = (page.value - 1) * pageSize.value;
			list.value = filtered.slice(start, start + pageSize.value);
			return;
		}

		const res:any = await vehicleControllerAdminList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined } as any);
		list.value = Array.isArray(res?.items) ? res.items : [];
		total.value = Number(res?.total || 0);
    } finally { loading.value = false; }
}

function onPageChange(p: number){ page.value = p; fetchList(); }

function openCreate(mode: 'member'|'guest' = 'member'){
	createMode.value = mode;
	current.value = null;
	form.value = { plateNumber: '', vin: '', brand: '', series: '', typeMain: '', typeSub: '', color: '', isDefault: false, memberId: undefined };
	if (mode === 'member' && memberIdFilter.value) form.value.memberId = memberIdFilter.value;
	dialogVisible.value = true;
}
function openEdit(v: Vehicle){
	if (isNoPlateRow(v)) { ElMessage.warning('系统保留无牌车已锁定，禁止编辑'); return; }
	current.value = v; form.value = { ...v }; dialogVisible.value = true;
}
function openDelete(v: Vehicle){
	if (isNoPlateRow(v)) { ElMessage.warning('系统保留无牌车已锁定，禁止删除'); return; }
	delId.value = v.id; delDialog.value = true;
}
function openView(v: Vehicle){ viewItem.value = v; viewDialog.value = true; }
function onRowDblClick(row: Vehicle){ openView(row); }

watch(
	() => viewDialog.value,
	(v) => {
		if (!v) return;
		// 最近到店/订单记录
		lastVisitAt.value = null;
		lastVisitOrderId.value = null;
		ordersDrawer.value = false;
		orders.value = [];
		ordersTotal.value = 0;
		ordersTotalKnown.value = false;
		ordersPage.value = 1;
		ordersPageSize.value = 20;
		fetchVehicleLastVisit();
		metricsWashCardDeductTimes.value = 0;
		metricsSpentAmount.value = 0;
		metricsWashTimes.value = 0;
		fetchVehicleMetrics();

		rebindLogs.value = [];
		rebindLogsTotal.value = 0;
		rebindLogsPage.value = 1;
		rebindLogsPageSize.value = 10;
		fetchRebindLogs();
	},
);

async function setDefault(v: Vehicle){
	if (isNoPlateRow(v)) { ElMessage.warning('系统保留无牌车已锁定，禁止设为默认'); return; }
	await vehicleControllerSetDefault(String(v.id)); ElMessage.success('已设为默认'); fetchList();
}

function validatePlate(plate: string){ return /^[\u4e00-\u9fa5]{1}[A-Z]{1}[A-Z0-9\u4e00-\u9fa5]{5,6}$/.test(plate.replace(/\s+/g,'')); }

function formatDateTime(input?: string | null){
    if (!input) return '-';
    const d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    return `${y}-${m}-${dd} ${hh}:${mm}:${ss}`;
}

async function onSave(){
	if (isNoPlateInput(form.value.plateNumber)) { ElMessage.error('该车牌为系统保留无牌车占位车牌，禁止创建/修改'); return; }
    if (!form.value.plateNumber || !validatePlate(form.value.plateNumber)) { ElMessage.error('请输入合法车牌号'); return; }
    if (!form.value.typeMain) { ElMessage.error('请选择车辆主类'); return; }
    saving.value = true;
    try {
        const payload = {
            plateNumber: form.value.plateNumber.trim(),
            vin: form.value.vin || undefined,
            brand: form.value.brandName || undefined,
            series: form.value.seriesName || undefined,
            brandId: form.value.brandId || undefined,
            seriesId: form.value.seriesId || undefined,
            typeMain: form.value.typeMain,
            typeSub: form.value.typeSub || undefined,
            color: form.value.color || undefined,
            isDefault: !!form.value.isDefault,
        } as any;
        if (current.value?.id) {
            await vehicleControllerUpdateVehicle(String(current.value.id), payload);
        } else if (createMode.value === 'member') {
            if (!form.value.memberId) { ElMessage.error('请选择会员'); return; }
            await vehicleControllerCreateForMember(String(form.value.memberId), payload);
        } else {
            await vehicleControllerCreateGuest(payload);
        }
        dialogVisible.value = false; ElMessage.success('已保存'); fetchList();
    } catch (e:any) {
        ElMessage.error(String(e?.message||e||'保存失败'));
    } finally { saving.value = false; }
}

async function onDeleteConfirm(){ if (!delId.value) return; try { await vehicleControllerRemove(String(delId.value)); ElMessage.success('已删除'); delDialog.value = false; fetchList(); } catch (e:any){ ElMessage.error(String(e?.message||e||'删除失败')); } }

async function fetchMemberOptions(){
    try {
        const res:any = await memberControllerList({ page: '1', pageSize: '500', keyword: '' } as any);
        memberOptions.value = (Array.isArray(res?.items) ? res.items : []).map((m:any) => ({ id: m.id, name: m.name, phone: m.phone }));
    } catch {}
}

async function ensureFilterMemberOption(memberId: number) {
	if (!memberId) return;
	const exists = filterMemberOptions.value.some((m) => Number(m.id) === Number(memberId));
	if (exists) return;
	try {
		const m: any = await memberControllerGet(String(memberId));
		if (m?.id) filterMemberOptions.value = [{ id: Number(m.id), name: m.name, phone: m.phone }, ...filterMemberOptions.value];
	} catch {}
}

async function searchMembersForFilter(q?: string) {
	filterMembersLoading.value = true;
	try {
		const res: any = await memberControllerList({ page: 1, pageSize: 50, keyword: (q || '').trim() || undefined } as any);
		filterMemberOptions.value = (Array.isArray(res?.items) ? res.items : []).map((m: any) => ({ id: m.id, name: m.name, phone: m.phone }));
	} finally {
		filterMembersLoading.value = false;
	}
}

function onFilterMemberChange(v: number | null) {
	const q: any = { ...(route.query as any) };
	if (v) q.memberId = v;
	else delete q.memberId;
	router.replace({ query: q });
}

function applyFilterFromRoute() {
	filterMemberId.value = memberIdFilter.value;
	if (memberIdFilter.value) ensureFilterMemberOption(memberIdFilter.value);
}

onMounted(()=>{ fetchMemberOptions(); applyFilterFromRoute(); /* 品牌数据在下拉展开时再拉取 */ fetchList(); });

watch(
	() => (route.query as any)?.memberId,
	() => {
		applyFilterFromRoute();
		page.value = 1;
		fetchList();
	},
);
function onBrandDropdownVisible(visible: boolean){ if (visible && !brandsLoaded.value && !brandLoading.value) fetchBrands(); }

// ====== 改绑 ======
const rebindDialog = ref(false);
const rebindVehicle = ref<Vehicle | null>(null);
const rebindMode = ref<'toMember'|'toGuest'>('toMember');
const rebindToMemberId = ref<number | null>(null);
const rebindRemark = ref('');
const rebindConfirm = ref(false);
const rebindSaving = ref(false);
const rebindMemberOptions = ref<MemberOption[]>([]);
const rebindMembersLoading = ref(false);

function openRebind(v: Vehicle) {
	if (isNoPlateRow(v)) { ElMessage.warning('系统保留无牌车已锁定，禁止改绑'); return; }
	rebindVehicle.value = v;
	rebindDialog.value = true;
	rebindMode.value = 'toMember';
	rebindToMemberId.value = null;
	rebindRemark.value = '';
	rebindConfirm.value = false;
	rebindMemberOptions.value = [];
}

function resetRebindDialog() {
	rebindVehicle.value = null;
	rebindMode.value = 'toMember';
	rebindToMemberId.value = null;
	rebindRemark.value = '';
	rebindConfirm.value = false;
	rebindSaving.value = false;
	rebindMemberOptions.value = [];
}

async function searchMembersForRebind(q?: string) {
	rebindMembersLoading.value = true;
	try {
		const res: any = await memberControllerList({ page: 1, pageSize: 50, keyword: (q || '').trim() || undefined } as any);
		rebindMemberOptions.value = (Array.isArray(res?.items) ? res.items : []).map((m: any) => ({ id: m.id, name: m.name, phone: m.phone }));
	} finally {
		rebindMembersLoading.value = false;
	}
}

async function submitRebind() {
	if (!rebindVehicle.value?.id) return;
	if (!rebindConfirm.value) { ElMessage.error('请勾选二次确认'); return; }

	const currentMemberId = Number(rebindVehicle.value.memberId || 0) || null;
	let toMemberId: number | null = null;
	let toGuest = false;
	if (rebindMode.value === 'toMember') {
		const t = Number(rebindToMemberId.value || 0);
		if (!t) { ElMessage.error('请选择目标会员'); return; }
		if (currentMemberId && t === currentMemberId) { ElMessage.error('目标会员不能与当前会员相同'); return; }
		toMemberId = t;
	}
	if (rebindMode.value === 'toGuest') {
		toMemberId = null;
		toGuest = true;
	}

	rebindSaving.value = true;
	try {
		await vehicleControllerAdminRebind(String(rebindVehicle.value.id), {
			body: {
				confirm: true,
				toMemberId,
				toGroupId: null,
				toGuest,
				remark: (rebindRemark.value || '').trim() || null,
			} as any,
		} as any);
		ElMessage.success('改绑成功');
		rebindDialog.value = false;
		await fetchList();
	} catch (e: any) {
		ElMessage.error(String(e?.message || e || '改绑失败'));
	} finally {
		rebindSaving.value = false;
	}
}

const currentBrand = ref<FlatBrand | null>(null);
function formatBrandImg(url?: string){ if (!url) return ''; return url; }

function mapScaleToType(scale: string): { main: string; sub: string } {
    const sc = (scale || '').trim();
    if (!sc) return { main: '', sub: '' };
    if (/SUV/i.test(sc)) { return { main: 'SUV', sub: sc.replace(/\s+/g,'') }; }
    if (/MPV/i.test(sc)) { return { main: 'MPV', sub: sc.replace(/\s+/g,'') }; }
    if (/(皮卡|轻卡|微卡|房车)/.test(sc)) {
        // 房车也归于卡车
        const sub = sc.includes('皮卡') ? '皮卡' : sc.includes('轻卡') ? '轻卡' : sc.includes('微卡') ? '微卡' : '房车';
        return { main: '卡车', sub };
    }
    if (/跑车/.test(sc)) { return { main: '跑车', sub: '' }; }
    // 默认视为轿车序列
    return { main: '轿车', sub: sc.replace(/\s+/g,'') };
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
</script>

<style scoped>
.el-tag { min-width: 40px; text-align: center; }
.letter-bar { display:flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.letter { font-size: 12px; padding: 4px 6px; border-radius: 4px; cursor: pointer; color: #666; }
.letter.active { background:#ecf5ff; color: var(--app-primary); }
.brand-option { display:flex; align-items:center; gap:8px; }
.brand-logo { width:28px; height:28px; object-fit:contain; border-radius:6px; background:#fff; border:1px solid #eef2f7; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.brand-logo.prefix { margin-right:6px; }
.brand-text { line-height:18px; }

/* 品牌/车系（列表列内展示） */
.brand-series-cell{ display:flex; align-items:center; gap:8px; min-width:0; }
.brand-series-text{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mini-icon{
	width:28px;
	height:28px;
	object-fit:contain;
	border-radius:10px;
	background:#fff;
	border:1px solid #eef2f7;
	box-shadow: 0 1px 2px rgba(0,0,0,0.04);
	flex: 0 0 auto;
}
/* 让表格容器在 BasePage 内容区内水平占满 */
.base-page__content { padding: 0; }
/* 让表格外层容器与表格都占满 */
.table-wrap { width: 100%; }
.table-wrap :deep(.el-table) { width: 100%; }

/* 详情美化 */
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

.plate-chip { display:inline-block; padding: 2px 8px; border-radius: 12px; background: #f0f9eb; color: #67c23a; font-weight: 600; }
.plate-chip.plate-blue { background:#e6f0ff; color:#1d4ed8; }
.plate-chip.plate-green { background:#e6fff4; color:#16a34a; }

/* 品牌图内嵌到品牌名单元格 */
.brand-cell { display:flex; align-items:center; gap:8px; }
.brand-inline-img { width:22px; height:22px; object-fit:contain; border-radius:6px; background:#fff; border:1px solid #eef2f7; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

/* 改绑弹窗 */
.rebind-head{ margin-bottom: 10px; }
.rebind-title{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.rebind-sub{ font-size: 12px; }
.rebind-logs-card{ margin-top: 12px; border-radius: 10px; }
</style>


