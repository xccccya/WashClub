<template>
	<BasePage title="服务队列">
		<template #actions>
			<div class="actions-bar">
				<el-input ref="searchInputRef" v-model="searchPlate" placeholder="按车牌快速定位" class="search-input" clearable />
				<el-button size="large" class="kb-btn" @mousedown.prevent @click="openSearchKb">车牌键盘</el-button>
				<el-popover :visible="searchKbVisible" placement="bottom-start" :show-arrow="false" :width="Math.min(560, Math.max(480, windowW*0.8))" @after-leave="searchKbVisible=false">
					<PlateKeyboard @press="(ch)=>{ searchPlate=String(searchPlate||'')+ch; }" @delete="searchPlate = String(searchPlate||'').slice(0, -1)" @confirm="searchKbVisible=false" />
					<template #reference><span></span></template>
				</el-popover>
				<div class="quick-filter">
					<el-segmented v-model="quickFilter" :options="quickFilterOptions" size="large" />
				</div>
				<div v-if="etaSummary.length" class="eta-tags">
					<el-tag
						v-for="t in etaSummary"
						:key="t.typeId"
						:effect="selectedTypeIds.includes(t.typeId) ? 'dark' : 'light'"
						:style="t.displayColor ? { backgroundColor: selectedTypeIds.includes(t.typeId) ? t.displayColor : '', color: selectedTypeIds.includes(t.typeId) ? '#fff' : '', borderColor: t.displayColor } : {}"
						@click="toggleSelectType(t.typeId)"
						clickable
					>
						<span>{{ t.typeName }}</span>
						<template v-if="t.excludedFromEta"><span style="margin-left:6px;">不计入等待</span></template>
						<template v-else-if="!t.etaConfigured"><span style="margin-left:6px;">未配置</span></template>
						<template v-else><span style="margin-left:6px;">新车≈{{ t.etaForNewCar }} 分钟</span></template>
					</el-tag>
					<el-button v-if="selectedTypeIds.length" size="small" @click="clearSelectedTypes">清除筛选</el-button>
				</div>
				<el-button size="large" type="primary" @click="openConfigDrawer"><el-icon style="vertical-align: middle; margin-right:6px;"><Setting /></el-icon><span style="vertical-align: middle;">配置</span></el-button>
				<el-button size="large" type="primary" @click="openWizard"><el-icon style="vertical-align: middle; margin-right:6px;"><Tickets /></el-icon><span style="vertical-align: middle;">创建订单并入队</span></el-button>
			</div>
		</template>

		<el-table ref="tableRef" :data="filtered" class="pos-table" border stripe style="width:100%" :row-key="rowKey" v-loading="loading" :row-class-name="queueRowClass" :fit="true" @cell-dblclick="onCellDblClick" @row-dblclick="onRowDblClick" @row-click="onRowClick">
			<el-table-column type="index" label="#" width="64" />
			<el-table-column prop="vehicle" label="车辆/类型" min-width="320">
				<template #default="{ row }">
					<div class="vehicle">
						<img v-if="row?.vehicle?.brandImage" :src="toAbs(row.vehicle.brandImage)" class="brand-img" />
						<div class="v-text">
							<div>
								<el-tag v-if="row?.vehicle?.group" type="info" effect="plain" class="mr6"><el-icon class="mr4"><OfficeBuilding /></el-icon>{{ row.vehicle.group.name }}</el-tag>
								<el-tag :type="row?.vehicle?.group ? 'info' : (row.guest ? 'warning' : 'danger')" class="mr6">{{ row?.vehicle?.group ? '集团客户' : (row.guest ? '游客' : '会员') }}</el-tag>
								<strong>{{ row.plateNumber }}</strong>
							</div>
							<div v-if="row?.vehicle?.member" class="u-line">
								<span class="member">{{ row.vehicle.member.name || '-' }}（{{ row.vehicle.member.phone || '-' }}）</span>
							</div>
							<div class="subline">
								<el-tag size="small" :style="row?.queueType?.displayColor ? { backgroundColor: row.queueType.displayColor, color: '#fff', borderColor: row.queueType.displayColor } : {}">{{ row?.queueType?.name || '-' }}</el-tag>
								<small class="muted">{{ row?.vehicle?.brand || '-' }} / {{ row?.vehicle?.series || '-' }}</small>
							</div>
						</div>
					</div>
				</template>
			</el-table-column>
			<el-table-column label="当前流程" min-width="360">
				<template #default="{ row }">
					<div class="steps-cell">
						<el-steps :active="computeActive(row)" :process-status="row.currentTaskIndex < 0 ? 'wait' : 'process'" finish-status="success">
							<el-step v-for="(t,i) in row.tasks" :key="t.id" :title="t.name" :description="`${t.durationMin}分钟`" :status="stepStatus(row, i, t)" />
						</el-steps>
					</div>
				</template>
			</el-table-column>
			<el-table-column label="排队/剩余" width="300">
				<template #default="{ row, $index }">
					<div>前方：{{ $index }} 辆 ≈ {{ aheadMinutesModel($index) }} 分钟</div>
					<div>本车剩余：≈ {{ combinedRemainingModel(row, $index) }} 分钟</div>
					<div v-if="row.excludedFromEta" class="mt4"><el-tag size="small" type="info" effect="plain">不计入预计等待</el-tag></div>
					<div v-else-if="!row.etaConfigured" class="mt4"><el-tag size="small" type="warning" effect="plain">预计时间未配置</el-tag></div>
					<div v-else class="mt4 tips">同组预计等待：前方≈{{ row.aheadMinutesEta }} 分钟；本车≈{{ row.remainingMinutesEta }} 分钟</div>
				</template>
			</el-table-column>
			<el-table-column label="操作" fixed="right" class-name="col-ops" :min-width="opsColWidth">
				<template #default="{ row }">
					<div class="ops">
						<template v-if="row.status!=='COMPLETED'">
							<el-button v-if="row.currentTaskIndex < 0" size="large" type="primary" class="btn-lg" @click="startFirst(row)"><el-icon><VideoPlay /></el-icon><span>开始 {{ row?.tasks?.[0]?.name || '第一步' }}</span></el-button>
							<!-- 步骤切换移入更多菜单；当显示"开始"按钮时隐藏"完成当前"；最后一步也隐藏"完成当前" -->
							<el-button v-if="row.currentTaskIndex >= 0 && row.currentTaskIndex < (row.tasks?.length||0) - 1" size="large" type="success" class="btn-lg" @click="finishTask(row)"><el-icon><SuccessFilled /></el-icon><span>完成当前</span></el-button>
							<el-popconfirm v-if="row.currentTaskIndex >= 0" title="确认该车辆所有步骤均已完成？" @confirm="confirmComplete(row)">
								<template #reference>
									<el-button size="large" type="danger" class="btn-lg" :disabled="row.currentTaskIndex < 0"><el-icon><SwitchButton /></el-icon><span>结束</span></el-button>
								</template>
							</el-popconfirm>
							<el-dropdown trigger="click">
								<el-button size="large" class="btn-lg" plain>更多</el-button>
								<template #dropdown>
									<el-dropdown-menu>
										<el-dropdown-item :disabled="row.currentTaskIndex < 0 || row.status==='COMPLETED'" @click="openStepPicker(row)">切换步骤</el-dropdown-item>
										<el-dropdown-item @click="confirmRemove(row)" :disabled="row.status==='COMPLETED'">移出</el-dropdown-item>
									</el-dropdown-menu>
								</template>
							</el-dropdown>
						</template>
						<template v-else>
							<span class="pay-only">
								<el-tag type="warning" effect="plain">待支付</el-tag>
								<el-button type="primary" @click="openPay(row)">标记支付</el-button>
							</span>
						</template>
					</div>
				</template>
			</el-table-column>
		</el-table>

		<!-- 步骤选择弹窗 -->
		<el-dialog v-model="stepPickerVisible" title="切换步骤" width="520px">
			<el-card v-if="stepPickerRow" shadow="never">
				<el-radio-group :model-value="stepPickerRow.currentTaskIndex" @change="(i:number)=>confirmPickStep(i)">
					<el-radio v-for="(t,i) in (stepPickerRow?.tasks||[])" :key="t.id" :label="i">{{ i+1 }}. {{ t.name }}（{{ t.durationMin }} 分钟）</el-radio>
				</el-radio-group>
			</el-card>
			<template #footer>
				<el-button @click="stepPickerVisible=false">关闭</el-button>
			</template>
		</el-dialog>

		<!-- 隐藏测量模板：根据所有可能组合计算操作列所需最小宽度 -->
		<div class="ops-measure">
			<div ref="opsTplNotStartedRef" class="ops">
				<el-button size="large" type="primary" class="btn-lg"><el-icon><VideoPlay /></el-icon><span>开始 第一步</span></el-button>
				<!-- 未开始组合：不显示"完成当前"，以更接近真实列宽需求 -->
				<el-button size="large" class="btn-lg" plain>更多</el-button>
			</div>
			<div ref="opsTplRunningRef" class="ops">
				<!-- 移除操作列中的步骤下拉，用更多菜单打开弹窗选择 -->
				<el-button size="large" type="success" class="btn-lg"><el-icon><SuccessFilled /></el-icon><span>完成当前</span></el-button>
				<el-button size="large" type="danger" class="btn-lg"><el-icon><SwitchButton /></el-icon><span>结束</span></el-button>
				<el-button size="large" class="btn-lg" plain>更多</el-button>
			</div>
			<div ref="opsTplPayRef" class="ops ops-pay-only">
				<span class="pay-only">
					<el-tag type="warning" effect="plain">待支付</el-tag>
					<el-button type="primary">标记支付</el-button>
				</span>
			</div>
		</div>

		<!-- 支付与扫码弹窗（POS 放大版） -->
		<el-dialog v-model="showPay" title="手动确认支付" width="640px" @closed="stopScan">
			<el-tabs v-model="payTab">
				<el-tab-pane label="常规方式" name="manual">
					<el-select v-model="payMethod" placeholder="支付方式" style="width: 100%">
						<el-option label="现金" value="CASH" />
						<el-option label="收钱吧" value="SHOUQIANBA" />
						<el-option label="线下其他" value="OFFLINE" />
					</el-select>
					<div v-if="orderForPay" style="margin-top:12px; display:flex; align-items:center; gap:8px;">
						<div style="flex:0 0 auto; color:#606266;">收银立减</div>
						<el-input-number v-model="cashierDiscountInput" :min="0" :max="payAmountCap" :step="0.01" :precision="2" :controls="false" size="small" style="width: 140px;" @change="onManualDiscountChange" />
						<div style="flex:1; color:#909399; font-size:12px;">最多可减至 0 元；0 元仅支持内部支付</div>
					</div>
					<div v-if="orderForPay" style="margin-top:6px; text-align:right; color:#303133;">应收：<b>¥{{ payAmountAfterManual.toFixed(2) }}</b></div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" @click="doMarkPaid">确认支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane label="微信付款码" name="wx">
					<el-input v-model="wxAuthCode" placeholder="请扫描/输入顾客微信付款码" maxlength="24" />
					<div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
						<el-button @click="openScan">打开摄像头识别</el-button>
						<el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="onSelectImage">
							<el-button>从图片识别</el-button>
						</el-upload>
					</div>
					<div class="hint">提示：仅用于线下收银，成功后订单将自动标记已支付。</div>
					<div v-if="orderForPay" style="margin-top:6px; display:flex; justify-content:space-between; align-items:center; color:#303133;">
						<div>应收：<b>¥{{ payAmountAfterManual.toFixed(2) }}</b></div>
						<div v-if="payAmountAfterManual<=0" style="color:#f56c6c; font-size:12px;">零元订单不支持微信付款码</div>
					</div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" :loading="wxPayLoading" :disabled="payAmountAfterManual<=0" @click="doWxMicropay">发起付款码支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane label="洗车卡划扣" name="wash">
					<div class="note">系统会自动识别本订单中标记为"计为洗车(次)"的服务商品数量作为需要扣减的次数，并从车辆所属集团或会员的洗车卡中优先扣减。次数不可手动修改。</div>
					<el-radio-group v-model="washPrefer" size="small">
						<el-radio-button label="AUTO">自动选择</el-radio-button>
						<el-radio-button label="GROUP">优先集团卡</el-radio-button>
						<el-radio-button label="MEMBER">优先会员卡</el-radio-button>
					</el-radio-group>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" @click="doWashDeduct">确认划扣并支付</el-button>
					</div>
				</el-tab-pane>
				<el-tab-pane v-if="canGroupBalance" label="集团余额" name="group">
					<div class="note">仅用于集团服务订单。集团余额支付不计入支付金额统计，仅进行集团余额内部扣减并记录关联订单流水。</div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" :loading="groupPayLoading" @click="doGroupBalance">确认集团余额支付</el-button>
					</div>
				</el-tab-pane>
			</el-tabs>
		</el-dialog>
		<el-dialog v-model="showScan" title="摄像头识别付款码" width="820px">
			<div class="scan-wrap">
				<video ref="videoRef" class="video" playsinline muted></video>
				<canvas ref="canvasRef" style="display:none;"></canvas>
				<div class="scan-tip">将顾客付款码对准摄像头，系统会自动识别</div>
			</div>
			<template #footer>
				<el-button @click="showScan=false">关闭</el-button>
			</template>
		</el-dialog>

		<!-- 配置抽屉：队列类型/步骤/可用商品 -->
		<el-drawer v-model="configDrawer" title="服务队列配置" size="70%" :with-header="true" :before-close="onBeforeCloseConfigDrawer">
			<div class="config-flex">
				<div class="config-left">
					<div class="config-left-top">
						<strong>队列类型</strong>
						<el-button size="small" type="primary" @click="openTypeEditor()"><el-icon><CirclePlus /></el-icon></el-button>
					</div>
					<el-input v-model="typeFilter" placeholder="搜索类型" clearable class="type-search" />
					<el-menu :key="menuKey" :default-active="String(activeTypeId || '')" @select="onSelectType">
						<el-menu-item v-for="t in filteredQueueTypes" :key="t.id" :index="String(t.id)">
							<span>{{ t.name }}</span>
							<el-tag v-if="!t.enabled" size="small" type="info" effect="plain" style="margin-left:8px;">禁用</el-tag>
						</el-menu-item>
					</el-menu>
				</div>
				<div class="config-right">
					<div v-if="activeType">
						<div class="config-right-head">
							<div class="config-right-title">
								<strong>{{ activeType.name }}</strong>
								<el-tag v-if="!activeType.enabled" size="small" type="info" effect="plain">禁用</el-tag>
							</div>
							<div>
								<el-button size="small" @click="openTypeEditor(activeType)">编辑</el-button>
								<el-popconfirm title="确认删除该队列类型？" @confirm="onDeleteType(activeType.id)">
									<template #reference>
										<el-button size="small" type="danger">删除</el-button>
									</template>
								</el-popconfirm>
							</div>
						</div>
						<el-card header="步骤配置" shadow="never" style="margin-bottom:12px;">
							<el-table :data="stepEdits" size="small">
								<el-table-column type="index" width="60" />
								<el-table-column label="步骤名" min-width="200">
									<template #default="{ row }"><el-input v-model="row.name" maxlength="20" show-word-limit placeholder="步骤名称（≤20字）" /></template>
								</el-table-column>
								<el-table-column label="时长(分钟)" min-width="200">
									<template #default="{ row }"><el-input-number v-model="row.durationMin" :min="0" :max="120" /></template>
								</el-table-column>
								<el-table-column label="计入ETA" width="120">
									<template #default="{ row }"><el-switch v-model="row.isEta" /></template>
								</el-table-column>
								<el-table-column label="操作" width="220">
									<template #default="{ $index }">
										<el-button size="small" @click="moveStep($index, -1)" :disabled="$index===0"><el-icon><ArrowUp /></el-icon></el-button>
										<el-button size="small" @click="moveStep($index, 1)" :disabled="$index===stepEdits.length-1"><el-icon><ArrowDown /></el-icon></el-button>
										<el-button size="small" type="danger" @click="removeStep($index)"><el-icon><Delete /></el-icon></el-button>
									</template>
								</el-table-column>
							</el-table>
							<div class="card-actions sticky" style="display:flex; gap:8px;">
								<el-button size="small" @click="addStep"><el-icon><CirclePlus /></el-icon>添加步骤</el-button>
								<el-button size="small" type="primary" @click="saveSteps" :loading="savingSteps">保存步骤</el-button>
							</div>
						</el-card>
						<el-card header="ETA 配置" shadow="never" style="margin-bottom:12px;">
							<el-form :model="typeForm" label-width="120px" size="small">
								<el-form-item label="参与预计等待">
									<el-switch v-model="typeForm.participateInEta" :active-value="true" :inactive-value="false" />
								</el-form-item>
								<el-form-item label="ETA 并行工位数">
									<el-input-number v-model="typeForm.etaParallelSlots" :min="1" :max="99" :step="1" placeholder="未配置表示不计算" />
								</el-form-item>
								<el-form-item label="ETA 资源组 Key">
									<el-input v-model="typeForm.etaGroupKey" placeholder="如 exterior / interior 等" />
								</el-form-item>
								<el-form-item label="类型配色">
									<el-input v-model="typeForm.displayColor" placeholder="#409EFF 或 rgba(...)" />
								</el-form-item>
								<div style="text-align:right;">
									<el-button size="small" type="primary" @click="saveType" :loading="savingType">保存类型</el-button>
								</div>
							</el-form>
						</el-card>
						<el-card header="可用服务商品" shadow="never">
							<div style="display:flex; gap:8px; margin-bottom:8px; align-items:center; flex-wrap: wrap;">
								<el-input v-model="productKeyword" placeholder="搜索商品" clearable style="width:260px;" />
								<el-button size="small" @click="loadServiceProducts">搜索</el-button>
								<el-button size="small" @click="selectAllServiceProducts">全选可选</el-button>
								<el-button size="small" @click="clearProductSelection">清空</el-button>
							</div>
							<el-table ref="serviceTableRef" :data="serviceProducts" size="small" height="260" :row-key="productRowKey">
								<el-table-column label="图片" width="72">
									<template #default="{ row }">
										<img v-if="row?.imageUrl" :src="toAbs(row.imageUrl)" class="pimg" />
										<div v-else class="pimg empty">无</div>
									</template>
								</el-table-column>
								<el-table-column prop="name" label="商品" min-width="260" />
								<el-table-column label="价格/区间" width="140">
									<template #default="{ row }">
										<template v-if="String(row?.specType||'')==='MULTI'">{{ skuPriceHint(row) }}</template>
										<template v-else>{{ row.price }}</template>
									</template>
								</el-table-column>
								<el-table-column prop="enabled" label="状态" width="100">
									<template #default="{ row }"><el-tag :type="row.enabled ? 'success':'info'">{{ row.enabled?'启用':'停用' }}</el-tag></template>
								</el-table-column>
								<el-table-column label="可用于该队列" width="160">
									<template #default="{ row }">
										<el-switch :model-value="isAllowed(row.id)" :disabled="savingRowId===row.id || !row.enabled" @change="(v:boolean)=>onToggleAllowed(row.id,v)" />
									</template>
								</el-table-column>
							</el-table>
							<div class="card-actions sticky" style="display:flex; gap:8px;">
								<el-button size="small" type="primary" @click="saveTypeProducts" :loading="savingProducts">保存可用商品</el-button>
							</div>
						</el-card>
					</div>
					<el-empty v-else description="选择左侧队列类型以进行配置" />
				</div>
			</div>
		</el-drawer>

		<!-- 队列类型 创建/编辑 对话框 -->
		<el-dialog v-model="typeDialogVisible" :title="typeForm.id ? '编辑队列类型' : '新建队列类型'" width="520px">
			<el-form :model="typeForm" label-width="100px">
				<el-form-item label="名称" required>
					<el-input v-model="typeForm.name" maxlength="20" show-word-limit placeholder="例如 标准洗车队列" />
				</el-form-item>
				<el-form-item label="启用">
					<el-switch v-model="typeForm.enabled" />
				</el-form-item>
				<el-form-item label="排序权重">
					<el-input-number v-model="typeForm.sortWeight" :min="0" :max="10000" />
				</el-form-item>
				<el-form-item label="备注">
					<el-input v-model="typeForm.remark" type="textarea" rows="3" maxlength="100" show-word-limit />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="typeDialogVisible=false">取消</el-button>
				<el-button type="primary" :loading="savingType" @click="saveType">保存</el-button>
			</template>
		</el-dialog>

		<!-- 入队向导（创建订单并入队） -->
		<el-drawer v-model="wizardDrawer" title="创建服务订单并入队" size="70%">
			<el-steps :active="wizardStep" finish-status="success" style="margin-bottom:12px;">
				<el-step title="车辆" />
				<el-step title="队列类型" />
				<el-step title="服务项目" />
				<el-step title="确认" />
			</el-steps>
			<!-- Step 0: 车辆 -->
			<div v-show="wizardStep===0" class="wiz-vehicle">
				<div class="mode-tabs">
					<el-button size="large" :type="mode==='smart'?'primary':'default'" @click="mode='smart'">智能选择</el-button>
					<el-button size="large" :type="mode==='member'?'primary':'default'" @click="mode='member'">会员车辆</el-button>
					<el-button size="large" :type="mode==='existing'?'primary':'default'" @click="mode='existing'">现有车辆</el-button>
					<el-button size="large" :type="mode==='guest'?'primary':'default'" @click="mode='guest'">游客车辆</el-button>
				</div>
				<el-form :model="form" label-width="120px" class="wiz-form">
					<!-- 智能选择：统一入口，支持现有车辆选择或快速新建（会员/游客） -->
					<template v-if="mode==='smart'">
						<el-form-item label="车牌号" required>
							<div class="inline-kb-row">
								<el-autocomplete
									ref="existingAutoRef"
									v-model="form.plateNumber"
									:fetch-suggestions="querySearchPlate"
									placeholder="输入车牌支持模糊搜索"
									popper-class="existing-plate-popper"
									:teleported="true"
									:fit-input-width="true"
									value-key="plateNumber"
									:debounce="0"
									highlight-first-item
									trigger-on-focus
									@focus="triggerExistingAuto"
									@select="onSelectExistingVehicle"
									style="width:100%"
								/>
								<el-button class="kb-btn" @mousedown.prevent @click="openExistingKb">车牌键盘</el-button>
								<!-- 无遮罩键盘：锚定到按钮旁 -->
								<el-popover
									:visible="existingKbVisible && (mode==='existing' || mode==='smart')"
									placement="bottom-start"
									:width="Math.min(640, Math.max(520, windowW*0.9))"
									:show-arrow="false"
									@after-leave="existingKbVisible=false"
								>
									<PlateKeyboard @press="onKbPressExisting" @delete="onKbDeleteExisting" @confirm="existingKbVisible=false" />
									<template #reference>
										<span></span>
									</template>
								</el-popover>
							</div>
							<small v-if="!form.vehicleId && form.plateNumber" class="muted" style="display:block;margin-top:6px;">未从下拉中选择现有车辆时，将按新建车辆处理</small>
						</el-form-item>
						<!-- 若未选择现有车辆，则展示新建路径与表单 -->
						<template v-if="!form.vehicleId">
							<el-card shadow="never">
								<template #header>
									<div class="card-head">
										<span>新建车辆</span>
										<el-tooltip placement="top" effect="dark" content="智能选择：输入车牌可联想并用键盘；选择下拉项即使用现有车辆；未选择则按下方新建方式创建（绑定会员需先选会员，均需选择车辆主类）；如选择品牌/车系，将随单保存并展示品牌图。">
											<el-icon class="help-icon"><QuestionFilled /></el-icon>
										</el-tooltip>
									</div>
								</template>
								<el-form-item label="新建方式">
									<el-radio-group v-model="smartCreateMode" size="small">
										<el-radio-button label="member">绑定到会员</el-radio-button>
										<el-radio-button label="guest">新增游客车辆</el-radio-button>
									</el-radio-group>
								</el-form-item>
                                <template v-if="smartCreateMode==='member'">
                                    <el-form-item label="选择会员" required>
                                        <el-select v-model="form.memberId" placeholder="请选择会员" filterable style="width:100%" @change="onMemberChange">
                                            <el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name}（${m.phone}）`" :value="m.id" />
                                        </el-select>
                                    </el-form-item>
                                </template>
								<!-- 通用车辆信息（与游客车辆一致），用于新建车辆 -->
								<el-form-item label="VIN"><el-input v-model="form.vin" placeholder="17位 VIN（可选）" /></el-form-item>
								<el-form-item label="车辆品牌">
								<div style="width:100%">
									<div class="letter-bar" v-if="brandsLoaded">
											<span :class="['letter', selectedLetter===null?'active':'']" @click="selectLetter(null)">全部</span>
											<span v-for="ch in brandLetters" :key="ch" :class="['letter', selectedLetter===ch?'active':'']" @click="selectLetter(ch)">{{ ch }}</span>
									</div>
									<template v-if="brandLoading">
										<el-skeleton :rows="1" animated />
									</template>
									<template v-else-if="brandsLoaded && !brandOptions.length">
										<el-empty description="暂无品牌数据" />
									</template>
									<template v-else>
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
									</template>
								</div>
								</el-form-item>
							<el-form-item label="车辆车系">
								<template v-if="seriesLoading">
									<el-skeleton :rows="1" animated />
								</template>
								<template v-else-if="form.brandId && !seriesOptions.length">
									<el-empty description="暂无车系数据" />
								</template>
								<template v-else>
									<el-select v-model="form.seriesId" filterable placeholder="选择车系（可搜索）" style="width:100%" :disabled="!form.brandId" :loading="seriesLoading" @change="onSeriesChange">
										<el-option v-for="s in seriesOptions" :key="s.series_id" :label="s.series_name" :value="s.series_id" />
									</el-select>
								</template>
							</el-form-item>
								<el-form-item label="车辆主类" required>
									<el-select v-model="form.typeMain" placeholder="请选择车辆主类" style="width:100%" :disabled="lockTypeBySeries">
										<el-option v-for="t in typeMainOptions" :key="t" :label="t" :value="t" />
									</el-select>
									<small v-if="lockTypeBySeries" class="muted ml8">已根据车系自动选择</small>
								</el-form-item>
								<el-form-item label="车辆子类">
									<el-select v-model="form.typeSub" placeholder="可选" clearable style="width:100%" :disabled="lockTypeBySeries">
										<el-option v-for="t in typeSubOptions(form.typeMain)" :key="t" :label="t" :value="t" />
									</el-select>
								</el-form-item>
								<el-form-item label="车辆颜色">
									<el-select v-model="form.color" placeholder="可选" clearable style="width:100%">
										<el-option v-for="c in colorOptionsList" :key="c" :label="c" :value="c" />
									</el-select>
								</el-form-item>
							</el-card>
						</template>
					</template>
					<el-form-item v-if="mode==='member'" label="选择会员">
						<el-select v-model="form.memberId" placeholder="请选择会员" filterable style="width:100%" @change="onMemberChange">
							<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name}（${m.phone}）`" :value="m.id" />
						</el-select>
					</el-form-item>
					<el-form-item v-if="mode==='member'" label="选择车辆">
						<el-select v-model="form.vehicleId" placeholder="请选择车辆" filterable style="width:100%">
							<el-option v-for="v in memberVehicles" :key="v.id" :label="`${v.plateNumber}（${v.brand||'-'}/${v.series||'-'}）`" :value="v.id" />
						</el-select>
					</el-form-item>
					<el-form-item v-if="mode==='existing' || mode==='guest'" label="车牌号" required>
						<template v-if="mode==='existing'">
							<div class="inline-kb-row">
								<el-autocomplete
									ref="existingAutoRef"
									v-model="form.plateNumber"
									:fetch-suggestions="querySearchPlate"
									placeholder="输入车牌支持模糊搜索"
									popper-class="existing-plate-popper"
									:teleported="true"
									:fit-input-width="true"
									value-key="plateNumber"
									:debounce="0"
									highlight-first-item
									trigger-on-focus
									@focus="triggerExistingAuto"
									@select="onSelectExistingVehicle"
									style="width:100%"
								/>
								<el-button class="kb-btn" @mousedown.prevent @click="openExistingKb">车牌键盘</el-button>
								<!-- 无遮罩键盘：锚定到按钮旁 -->
								<el-popover
								:visible="existingKbVisible && (mode==='existing' || mode==='smart')"
									placement="bottom-start"
									:width="Math.min(640, Math.max(520, windowW*0.9))"
									:show-arrow="false"
									@after-leave="existingKbVisible=false"
								>
									<PlateKeyboard @press="onKbPressExisting" @delete="onKbDeleteExisting" @confirm="existingKbVisible=false" />
									<template #reference>
										<span></span>
									</template>
								</el-popover>
							</div>
						</template>
						<template v-else>
							<PlateInput v-model="form.plateNumber" placeholder="点击输入车牌" :inline="true" />
						</template>
					</el-form-item>
					<el-form-item v-if="mode==='guest'" label="VIN"><el-input v-model="form.vin" placeholder="17位 VIN（可选）" /></el-form-item>
					<el-form-item v-if="mode==='guest'" label="车辆品牌">
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
					<el-form-item v-if="mode==='guest'" label="车辆车系">
						<el-select v-model="form.seriesId" filterable placeholder="选择车系（可搜索）" style="width:100%" :disabled="!form.brandId" :loading="seriesLoading" @change="onSeriesChange">
							<el-option v-for="s in seriesOptions" :key="s.series_id" :label="s.series_name" :value="s.series_id" />
						</el-select>
					</el-form-item>
					<el-form-item v-if="mode==='guest'" label="车辆主类" required>
						<el-select v-model="form.typeMain" placeholder="请选择车辆主类" style="width:100%" :disabled="lockTypeBySeries">
							<el-option v-for="t in typeMainOptions" :key="t" :label="t" :value="t" />
						</el-select>
						<small v-if="lockTypeBySeries" class="muted ml8">已根据车系自动选择</small>
					</el-form-item>
					<el-form-item v-if="mode==='guest'" label="车辆子类">
						<el-select v-model="form.typeSub" placeholder="可选" clearable style="width:100%" :disabled="lockTypeBySeries">
							<el-option v-for="t in typeSubOptions(form.typeMain)" :key="t" :label="t" :value="t" />
						</el-select>
					</el-form-item>
					<el-form-item v-if="mode==='guest'" label="车辆颜色">
						<el-select v-model="form.color" placeholder="可选" clearable style="width:100%">
							<el-option v-for="c in colorOptionsList" :key="c" :label="c" :value="c" />
						</el-select>
					</el-form-item>
				</el-form>
				<div class="wiz-actions">
					<el-button size="large" type="primary" @click="nextWizardFromVehicle">下一步</el-button>
				</div>
			</div>
			<!-- Step 1: 队列类型 -->
			<div v-show="wizardStep===1" class="wiz-type">
				<el-radio-group v-model="wizardQueueTypeId">
					<el-radio v-for="t in queueTypes" :key="t.id" :label="t.id">{{ t.name }}</el-radio>
				</el-radio-group>
				<div class="wiz-actions">
					<el-button size="large" @click="wizardStep=0">上一步</el-button>
					<el-button size="large" type="primary" @click="wizardStep=2">下一步</el-button>
				</div>
			</div>
			<!-- Step 2: 服务项目 -->
            <div v-show="wizardStep===2" class="wiz-products">
                <el-alert type="info" :closable="false" class="mb8" title="仅可选择该队列类型允许的服务商品" />
                <el-table :data="wizardAllowedProducts" size="small" height="320" @selection-change="onWizardSelectionChange">
                    <el-table-column label="图片" width="72">
                        <template #default="{ row }">
                            <img v-if="row?.imageUrl" :src="toAbs(row.imageUrl)" class="pimg" />
                            <div v-else class="pimg empty">无</div>
                        </template>
                    </el-table-column>
                    <el-table-column type="selection" width="50" />
                    <el-table-column prop="name" label="商品" min-width="220" />
                    <el-table-column label="规格" min-width="240">
                        <template #default="{ row }">
                            <template v-if="String(row?.specType||'')==='MULTI'">
                                <el-select v-model="wizardSkuByProduct[row.id]" placeholder="请选择规格" style="width:220px;">
                                    <el-option v-for="s in (row.skus||[])" :key="s.id" :label="skuLabel(s)" :value="s.id" :disabled="s.enabled===false" />
                                </el-select>
                            </template>
                            <template v-else>-</template>
                        </template>
                    </el-table-column>
                    <el-table-column label="价格/区间" width="140">
                        <template #default="{ row }">
                            <template v-if="String(row?.specType||'')==='MULTI'">{{ skuPriceHint(row) }}</template>
                            <template v-else>{{ row.price }}</template>
                        </template>
                    </el-table-column>
                </el-table>
				<div class="wiz-actions split">
					<el-button size="large" @click="wizardStep=1">上一步</el-button>
					<div>
						<el-button size="large" @click="wizardDrawer=false">取消</el-button>
						<el-button size="large" type="primary" @click="wizardStep=3">下一步</el-button>
					</div>
				</div>
			</div>
			<!-- Step 3: 确认 -->
            <div v-show="wizardStep===3" class="wiz-confirm">
                <el-descriptions title="确认信息" :column="1" border>
                    <el-descriptions-item label="车辆">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <img v-if="currentBrand?.img" :src="formatBrandImg(currentBrand.img)" class="brand-img" />
                            <span>{{ selectedPlate }}</span>
                        </div>
                    </el-descriptions-item>
                    <el-descriptions-item label="队列类型">{{ (queueTypes.find(t=>t.id===wizardQueueTypeId)||{} as any).name || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="服务商品">
                        <template v-if="wizardSelectedProductIds.length">
                            <div v-for="pid in wizardSelectedProductIds" :key="pid">
                                <span>{{ (wizardAllowedProducts.find(p=>p.id===pid)||{} as any).name || '-' }}</span>
                                <template v-if="wizardSkuByProduct[pid]">
                                    <span style="margin-left:6px; color:#909399;">（{{ skuNameById(pid, wizardSkuByProduct[pid]!) }}）</span>
                                </template>
                            </div>
                        </template>
                        <template v-else>-</template>
                    </el-descriptions-item>
                </el-descriptions>
				<div class="wiz-actions split">
					<el-button size="large" @click="wizardStep=2">上一步</el-button>
					<div>
						<el-button size="large" @click="wizardDrawer=false">取消</el-button>
						<el-button size="large" type="primary" :loading="submittingOrder" @click="submitCreateOrderAndEnqueue">提交</el-button>
					</div>
				</div>
			</div>
		</el-drawer>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { http, absUrl } from '../utils/http';
import { API_BASE } from '../config';
import { ElMessage, ElMessageBox } from 'element-plus';
import PlateInput from '../components/PlateInput.vue';
import PlateKeyboard from '../components/PlateKeyboard.vue';
import { useRouter } from 'vue-router';

type Task = { id:number; name:string; durationMin:number; status?: string; orderIndex?: number };
type QueueItem = { id:number; plateNumber:string; guest:boolean; status?: string; orderId?: number|null; currentTaskIndex:number; tasks: Task[]; aheadCount?:number; aheadMinutes?:number; remainingMinutes?:number; queueTypeId?: number|null; queueType?: { id:number; name:string; displayColor?: string|null } | null; vehicle?: { id:number; brand?:string|null; series?:string|null; brandImage?:string|null; group?: { name: string }; member?: { name?: string|null; phone?: string|null } } };

function rowKey(row: { id?: number }, index: number){ return Number(row?.id||index); }
function toAbs(u?: string | null){ return absUrl(u || ''); }

const list = ref<QueueItem[]>([]);
const searchInputRef = ref<any>(null);
const loading = ref(false);
const searchPlate = ref('');
const router = useRouter();
type QuickFilter = 'ALL' | 'NOT_STARTED' | 'RUNNING' | 'COMPLETED';
const quickFilter = ref<QuickFilter>('ALL');
const quickFilterOptions = [
	{ label: '全部', value: 'ALL' },
	{ label: '未开始', value: 'NOT_STARTED' },
	{ label: '进行中', value: 'RUNNING' },
	{ label: '已完成', value: 'COMPLETED' },
];
type EtaSummary = { typeId:number; typeName:string; displayColor?: string|null; etaConfigured:boolean; excludedFromEta:boolean; etaForNewCar: number|null; tips?: string };
const etaSummary = ref<EtaSummary[]>([]);
const selectedTypeIds = ref<number[]>([]);
function toggleSelectType(id:number){ const s=new Set(selectedTypeIds.value); if(s.has(id)) s.delete(id); else s.add(id); selectedTypeIds.value=Array.from(s); }
function clearSelectedTypes(){ selectedTypeIds.value=[]; }

const filtered = computed(()=>{
	const kw = searchPlate.value.trim().toUpperCase();
	const set = new Set(selectedTypeIds.value);
	let arr = list.value || [];
	// 快速分组筛选
	if (quickFilter.value !== 'ALL'){
		arr = arr.filter((x:any)=>{
			const idx = Number(x?.currentTaskIndex ?? -1);
			const status = String(x?.status||'');
			if (quickFilter.value === 'NOT_STARTED') return idx < 0 && status !== 'COMPLETED';
			if (quickFilter.value === 'RUNNING') return idx >= 0 && status !== 'COMPLETED';
			if (quickFilter.value === 'COMPLETED') return status === 'COMPLETED';
			return true;
		});
	}
	if (set.size) arr = arr.filter(x=> set.has(Number(x?.queueTypeId || x?.queueType?.id || 0)));
	if (kw) arr = arr.filter(x=> String(x.plateNumber||'').toUpperCase().includes(kw));
	return arr;
});

// 动态测量操作列宽度，保证所有操作在一行完整展示
const opsColWidth = ref(520);
const tableRef = ref();
const opsTplNotStartedRef = ref<HTMLElement|null>(null);
const opsTplRunningRef = ref<HTMLElement|null>(null);
const opsTplPayRef = ref<HTMLElement|null>(null);
function measureOpsWidth(){
    try{
        // 根据当前数据决定需要测的组合
        const hasNotStarted = (filtered.value||[]).some((x:any)=> Number(x?.currentTaskIndex??-1) < 0 && String(x?.status||'')!=='COMPLETED');
        const hasRunning = (filtered.value||[]).some((x:any)=> Number(x?.currentTaskIndex??-1) >= 0 && String(x?.status||'')!=='COMPLETED');
        const hasPay = (filtered.value||[]).some((x:any)=> String(x?.status||'')==='COMPLETED');

        // 可见行的实际 ops 宽度
        const visibleNodes = Array.from(document.querySelectorAll('.pos-table .ops')) as HTMLElement[];
        const visibleMax = visibleNodes.reduce((m,el)=> Math.max(m, Math.ceil(el.getBoundingClientRect().width)), 0);
        // 模板宽度（仅测当前存在的组合）
        const t1 = hasNotStarted && opsTplNotStartedRef.value ? Math.ceil(opsTplNotStartedRef.value.getBoundingClientRect().width) : 0;
        const t2 = hasRunning && opsTplRunningRef.value ? Math.ceil(opsTplRunningRef.value.getBoundingClientRect().width) : 0;
        const t3 = hasPay && opsTplPayRef.value ? Math.ceil(opsTplPayRef.value.getBoundingClientRect().width) : 0;
        const maxNeeded = Math.max(visibleMax, t1, t2, t3);
        const paddingReserve = 24; // 单元格内边距与按钮间距裕量
        // 按当前组合设置下限：仅待支付更紧凑，其余场景保守一些
        const min = hasNotStarted || hasRunning ? 320 : 240;
        const maxCap = Math.floor(window.innerWidth * 0.7); // 上限：避免过度占据表格
        const nextWidth = Math.min(maxCap, Math.max(min, maxNeeded + paddingReserve));
        if (nextWidth !== opsColWidth.value) {
            opsColWidth.value = nextWidth;
            // 触发表格重新布局
            try { (tableRef.value as any)?.doLayout?.(); } catch {}
        }
    }catch{}
}

let resizeTimer: any = null;
function onResize(){ if (resizeTimer) clearTimeout(resizeTimer); resizeTimer = setTimeout(()=>{ nextTick().then(()=>measureOpsWidth()); }, 120); }

function queueRowClass({ row }: { row: any }){
	if (String(row?.status||'') === 'COMPLETED') return 'row-completed';
	if (Number(row?.currentTaskIndex||-1) >= 0) return 'row-running';
	return '';
}

function stepStatus(row: QueueItem, index: number, t: Task){
	const doneByIndex = Number(row.currentTaskIndex||0) > index;
	if (doneByIndex || String(t.status||'') === 'DONE') return 'success' as any;
	if (Number(row.currentTaskIndex||0) === index || String(t.status||'') === 'DOING') return 'process' as any;
	return 'wait' as any;
}
function computeActive(row: QueueItem){
	const tasks = Array.isArray(row?.tasks) ? row.tasks : [];
	if (tasks.length > 0) {
		const last:any = tasks[tasks.length - 1];
		if (String(last?.status || '') === 'DONE') return tasks.length;
	}
	const i = Number(row?.currentTaskIndex||0);
	return i < 0 ? 0 : i;
}
function computeEtaForNewCar(items: QueueItem[]): number {
	let total = 0;
	for (const it of (items || [])) {
		const tasks = Array.isArray(it?.tasks) ? [...it.tasks].sort((a:any,b:any)=>Number(a.orderIndex||0)-Number(b.orderIndex||0)) : [] as any[];
		const idx = Number(it?.currentTaskIndex ?? 0);
		const tE1:any = tasks.find((t:any)=> Number(t.orderIndex||0) === 0);
		const tE2:any = tasks.find((t:any)=> Number(t.orderIndex||0) === 1);
		const e1Dur = Number(tE1?.durationMin ?? 5) || 5;
		const e2Dur = Number(tE2?.durationMin ?? 5) || 5;
		const e1Done = idx > 0 || String(tE1?.status||'') === 'DONE';
		const e2Done = idx > 1 || String(tE2?.status||'') === 'DONE';
		if (!e1Done) total += e1Dur;
		if (!e2Done) total += e2Dur;
	}
	return Math.max(0, Math.round(total));
}
function aheadMinutesModel(index: number){
	const items = (list.value || []).slice(0, index);
	return computeEtaForNewCar(items as any);
}
function remainingMinutesModel(row: QueueItem){
	const tasks = Array.isArray(row?.tasks) ? [...row.tasks].sort((a:any,b:any)=>Number(a.orderIndex||0)-Number(b.orderIndex||0)) : [] as any[];
	const idx = Number(row?.currentTaskIndex ?? 0);
	let total = 0;
	for (let i = 0; i < tasks.length; i++) {
		const t:any = tasks[i];
		const doneByIndex = idx > i;
		if (doneByIndex || String(t?.status||'') === 'DONE') continue;
		total += Number(t?.durationMin || 0);
	}
	return Math.max(0, Math.round(total));
}
function combinedRemainingModel(row: QueueItem, index: number){
	const waitAhead = aheadMinutesModel(index);
	const selfRemain = remainingMinutesModel(row);
	return Math.max(0, Math.round(waitAhead + selfRemain));
}

async function fetchList(){
	try { loading.value = true; list.value = await http<QueueItem[]>('/queue/list', { method:'GET' }); }
	catch { list.value = []; }
	finally { loading.value = false; }
}
async function fetchEta(){
	try { etaSummary.value = await http<EtaSummary[]>('/queue/eta-summary', { method:'GET' }); }
	catch { etaSummary.value = []; }
}

async function setCurrent(row: QueueItem, idx: number){
	try{ await http(`/queue/${row.id}/set-current`, { method:'POST', body:{ taskIndex: idx } }); ElMessage.success('已切换步骤'); fetchList(); }
	catch(e:any){ ElMessage.error(String(e?.message||'操作失败')); }
}
async function finishTask(row: QueueItem){
	try{ await http(`/queue/${row.id}/finish-task`, { method:'POST' }); ElMessage.success('已完成当前步骤'); fetchList(); }
	catch(e:any){ ElMessage.error(String(e?.message||'操作失败')); }
}
async function confirmComplete(row: QueueItem){
	try{ await http(`/queue/${row.id}/confirm-complete`, { method:'POST' }); ElMessage.success('已完成全部步骤'); fetchList(); }
	catch(e:any){ ElMessage.error(String(e?.message||'操作失败')); }
}
async function startFirst(row: QueueItem){
	try{ await http(`/queue/${row.id}/start-first`, { method:'POST' }); ElMessage.success('已开始第一步'); fetchList(); }
	catch(e:any){ ElMessage.error(String(e?.message||'操作失败')); }
}
async function removeItem(row: QueueItem){
	try{ await http(`/queue/${row.id}`, { method:'DELETE' }); ElMessage.success('已移出队列'); fetchList(); }
	catch(e:any){ ElMessage.error(String(e?.message||'操作失败')); }
}
function openOrder(row:any){ const id = Number(row?.orderId||0)||0; if(!id){ ElMessage.error('未找到订单'); return; } router.push(`/orders/${id}`); }
function onCellDblClick(row:any, column:any, cell:any, event:any){
	try{
		const rec:any = row as any;
		const id = Number(rec?.orderId||0)||0;
		if (!id) return;
		// 跳过操作列与索引列
		const colClass = String(column?.className||'');
		const colType = String(column?.type||'');
		if (colClass.includes('col-ops') || colType==='index' || colType==='selection') return;
		openOrder(rec);
	}catch{}
}
async function confirmRemove(row: QueueItem){
	try{
		await ElMessageBox.confirm('确认移出队列？', '提示', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' });
		await removeItem(row);
	}catch{}
}

// 支付 & 扫码占位
const showPay = ref(false);
const payTab = ref<'manual'|'wx'|'wash'|'group'>('manual');
const payMethod = ref<'CASH'|'SHOUQIANBA'|'OFFLINE'>('CASH');
const wxAuthCode = ref('');
const wxPayLoading = ref(false);
const washPrefer = ref<'AUTO'|'GROUP'|'MEMBER'>('AUTO');
const currentOrderId = ref<number|null>(null);
const canGroupBalance = ref(false);
const groupPayLoading = ref(false);
// 收银立减
const orderForPay = ref<any>(null);
const cashierDiscountInput = ref<number>(0);
const payAmountCap = computed(()=>{
    try{ const o:any = orderForPay.value; if(!o) return 0; const total=Number(o.totalAmount||0); const discount=Number(o.discountAmount||0); const cashierPrev=Number(o.cashierDiscountAmount||0); return Math.max(0, Number((total - (discount - cashierPrev)).toFixed(2))); }catch{ return 0; }
});
const payAmountAfterManual = computed(()=>{
    try{ const o:any=orderForPay.value; if(!o) return 0; const shipping=Number(o.shippingFee||0); const points=Number(o.pointsAmount||0); const manual=Math.max(0, Number(cashierDiscountInput.value||0)); const base=payAmountCap.value; return Math.max(0, Number((base - manual + shipping - points).toFixed(2))); }catch{ return 0; }
});
function onManualDiscountChange(){ try{ let v=Number(cashierDiscountInput.value||0); if(!Number.isFinite(v)||v<0) v=0; const cap=Number(payAmountCap.value||0); cashierDiscountInput.value=Number(Math.min(cap, v).toFixed(2)); }catch{} }
const showScan = ref(false);
const videoRef = ref<HTMLVideoElement|null>(null);
const canvasRef = ref<HTMLCanvasElement|null>(null);
async function openPay(row:any){ currentOrderId.value=Number(row?.orderId||0)||null; canGroupBalance.value=false; try{ const id=currentOrderId.value; if(id){ const ord:any = await http(`/orders/${id}`); orderForPay.value = ord || null; cashierDiscountInput.value = Math.max(0, Number(ord?.cashierDiscountAmount||0)) || 0; canGroupBalance.value = String(ord?.type||'').toUpperCase()==='SERVICE' && !!ord?.groupId && String(ord?.payStatus||'')==='UNPAID'; } }catch{ orderForPay.value=null; cashierDiscountInput.value=0; canGroupBalance.value=false; } showPay.value=true; }
// 无遮罩键盘状态
const windowW = (typeof window!=='undefined' ? window.innerWidth : 1280) || 1280;
const searchKbVisible = ref(false);
const existingKbVisible = ref(false);
async function doMarkPaid(){
    try{
        const id = currentOrderId.value;
        if(!id){ ElMessage.error('未找到关联订单'); return; }
        try{ await http(`/orders/${id}/adjust-cashier-discount`, { method:'POST', body:{ amount: Number(cashierDiscountInput.value||0) } }); }catch{}
        await http(`/orders/${id}/pay/manual`, { method:'POST', body:{ method: payMethod.value } });
        ElMessage.success('已标记为已支付');
        showPay.value=false;
        await fetchList();
    }catch(e:any){ ElMessage.error(String(e?.message||'操作失败')); }
}
async function doWxMicropay(){
    try{
        const id = currentOrderId.value;
        if(!id){ ElMessage.error('未找到关联订单'); return; }
        const code = String(wxAuthCode.value||'').trim();
        if(!/^\d{18,24}$/.test(code)){ ElMessage.error('请输入有效的微信付款码（18-24位数字）'); return; }
        wxPayLoading.value=true;
        try{ await http(`/orders/${id}/adjust-cashier-discount`, { method:'POST', body:{ amount: Number(cashierDiscountInput.value||0) } }); }catch{}
        await http(`/orders/${id}/pay/wx-micropay`, { method:'POST', body:{ authCode: code } });
        ElMessage.success('付款成功，已标记订单为已支付');
        showPay.value=false; wxAuthCode.value='';
        await fetchList();
    }catch(e:any){ ElMessage.error(String(e?.message||'付款失败')); }
    finally{ wxPayLoading.value=false; }
}
async function doWashDeduct(){
	try{
		const id = currentOrderId.value;
		if(!id){ ElMessage.error('未找到关联订单'); return; }
		const prefer = washPrefer.value==='AUTO'?undefined:washPrefer.value;
		await http(`/orders/${id}/pay/wash-card`, { method:'POST', body:{ prefer } });
		ElMessage.success('划扣成功');
		showPay.value=false;
		await fetchList();
	}catch(e:any){ ElMessage.error(String(e?.message||'划扣失败')); }
}
async function doGroupBalance(){
    try{
        const id = currentOrderId.value; if(!id){ ElMessage.error('未找到关联订单'); return; }
        if (!canGroupBalance.value){ ElMessage.error('仅集团服务订单可使用集团余额支付'); return; }
        groupPayLoading.value = true;
        await http(`/orders/${id}/pay/group-balance`, { method:'POST' });
        ElMessage.success('集团余额支付成功');
        showPay.value=false;
        await fetchList();
    }catch(e:any){ ElMessage.error(String(e?.message||e||'支付失败')); }
    finally{ groupPayLoading.value=false; }
}
async function openScan(){ showScan.value=true; await nextTick(); }
function stopScan(){ try{}catch{} }
function onSelectImage(_f:any){}
// 仅键盘实例（不渲染输入框），用于快速定位与现有车辆旁键按钮触发
const searchKbRef = ref<InstanceType<typeof PlateInput>|null>(null);
function openSearchKb(){ try{ searchKbVisible.value = true; }catch{} }
const existingKbRef = ref<InstanceType<typeof PlateInput>|null>(null);
const existingAutoRef = ref<any>(null);
function getExistingAutoInputEl(): HTMLInputElement | null {
    try{
        const comp:any = existingAutoRef.value;
        const root = comp?.$el as HTMLElement | undefined;
        return (root?.querySelector('input') as HTMLInputElement | null) || null;
    }catch{ return null; }
}
async function triggerExistingAuto(){
	try{
		await nextTick();
		const input = getExistingAutoInputEl();
		if (!input) return;
		if (document.activeElement !== input) { try{ input.focus(); }catch{} }
		// 轻量触发：仅派发一次 input，fetch-suggestions 内读取最新 form.plateNumber
		try{ input.dispatchEvent(new Event('input', { bubbles: true })); }catch{}
	}catch{}
}
function onKbPressExisting(ch: string){ form.value.plateNumber = String(form.value.plateNumber||'') + ch; triggerExistingAuto(); }
function onKbDeleteExisting(){ form.value.plateNumber = String(form.value.plateNumber||'').slice(0, -1); triggerExistingAuto(); }
function openExistingKb(){
    try{
        existingKbVisible.value = true;
        // 打开键盘同时确保自动完成获得焦点，便于输入后立即触发建议
        setTimeout(()=>{ try{ const el = (existingAutoRef.value as any)?.$el?.querySelector('input'); (el as HTMLInputElement)?.focus?.(); (existingAutoRef.value as any)?.handleFocus?.(); }catch{} }, 0);
    }catch{}
}

// 配置抽屉
const configDrawer = ref(false);
type QueueType = { id:number; name:string; enabled:boolean; sortWeight:number; remark?:string|null; displayColor?: string|null; participateInEta?: boolean|null; etaParallelSlots?: number|null; etaGroupKey?: string|null; steps: Array<{ id:number; orderIndex:number; name:string; durationMin:number; isEta?: boolean|null }>; products: Array<{ id:number; productId:number }> };
const queueTypes = ref<QueueType[]>([]);
const activeTypeId = ref<number|undefined>(undefined);
const activeType = computed(()=> queueTypes.value.find(t=>t.id===activeTypeId.value));
function openConfigDrawer(){ configDrawer.value=true; if (!queueTypes.value.length) loadQueueTypes(); else loadServiceProducts(); }
function onSelectType(idStr: string){ activeTypeId.value = Number(idStr||0)||undefined; syncStepEdits(); syncTypeForm(); loadTypeProductsSelection(); }
const stepEdits = ref<Array<{ name:string; durationMin:number; isEta?: boolean }>>([]);
function syncStepEdits(){ const t = activeType.value; stepEdits.value = (t?.steps||[]).sort((a,b)=>a.orderIndex-b.orderIndex).map(s=>({ name: s.name, durationMin: s.durationMin, isEta: !!s.isEta })); }
function addStep(){ stepEdits.value.push({ name:'', durationMin:0 }); }
function moveStep(i:number, d:number){ const j=i+d; if(j<0||j>=stepEdits.value.length) return; const arr=stepEdits.value; const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; }
function removeStep(i:number){ stepEdits.value.splice(i,1); }
const typeForm = ref<any>({ id: undefined, name: '', enabled: true, sortWeight: 100, remark: '', participateInEta: null as boolean | null, etaParallelSlots: null as number | null, etaGroupKey: '' as string | null, displayColor: '' as string | null });
const savingType = ref(false);
const savingSteps = ref(false);
async function saveSteps(){
	if (!activeType.value) return;
	const steps = stepEdits.value.map((s,i)=>({ orderIndex: i, name: s.name.trim(), durationMin: Number(s.durationMin||0), isEta: !!s.isEta }));
	savingSteps.value = true;
	try{
		await http(`/queue-types/${activeType.value.id}/steps`, { method:'PUT', body: { steps } });
		ElMessage.success('已保存步骤');
		await loadQueueTypes();
		dirtySteps.value = false;
	} finally {
		savingSteps.value = false;
	}
}
function syncTypeForm(){ const t = activeType.value; typeForm.value = t ? { id: t.id, name: t.name, enabled: !!t.enabled, sortWeight: Number(t.sortWeight||0), remark: t.remark||'', participateInEta: t.participateInEta ?? null, etaParallelSlots: t.etaParallelSlots ?? null, etaGroupKey: t.etaGroupKey ?? '', displayColor: t.displayColor ?? '' } : { id: undefined, name: '', enabled: true, sortWeight: 100, remark: '', participateInEta: null, etaParallelSlots: null, etaGroupKey: '', displayColor: '' }; }
async function saveType(){ if (!typeForm.value.name) { ElMessage.error('请输入名称'); return; } const payload:any = { name: typeForm.value.name, enabled: !!typeForm.value.enabled, sortWeight: Number(typeForm.value.sortWeight||0), remark: typeForm.value.remark||null, participateInEta: typeForm.value.participateInEta, etaParallelSlots: typeForm.value.etaParallelSlots===null?null:Number(typeForm.value.etaParallelSlots||0)||null, etaGroupKey: (String(typeForm.value.etaGroupKey||'').trim()||null), displayColor: (String(typeForm.value.displayColor||'').trim()||null) }; savingType.value = true; try { if (typeForm.value.id) { await http(`/queue-types/${typeForm.value.id}`, { method:'PUT', body: payload }); } else { await http(`/queue-types`, { method:'POST', body: payload }); } ElMessage.success('保存成功'); typeDialogVisible.value=false; await loadQueueTypes(); dirtyType.value=false; } finally { savingType.value=false; } }
async function onDeleteType(id:number){ await http(`/queue-types/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await loadQueueTypes(); if (activeTypeId.value===id) activeTypeId.value = queueTypes.value[0]?.id; }
const typeDialogVisible = ref(false);
const dirtySteps = ref(false);
const dirtyType = ref(false);
const dirtyProducts = ref(false);
const typeFilter = ref('');
const menuKey = ref(0);
const filteredQueueTypes = computed(()=>{
	const kw = typeFilter.value.trim();
	if (!kw) return queueTypes.value;
	return queueTypes.value.filter(t=> String(t.name||'').includes(kw));
});

function openTypeEditor(t?: any){
	typeForm.value = t ? { id: t.id, name: t.name, enabled: !!t.enabled, sortWeight: Number(t.sortWeight||0), remark: t.remark||'', participateInEta: t.participateInEta ?? null, etaParallelSlots: t.etaParallelSlots ?? null, etaGroupKey: t.etaGroupKey ?? '', displayColor: t.displayColor ?? '' } : { id: undefined, name: '', enabled: true, sortWeight: 100, remark: '', participateInEta: null, etaParallelSlots: null, etaGroupKey: '', displayColor: '' };
	typeDialogVisible.value = true;
}

async function loadQueueTypes(){
	try{
		const res = await http<QueueType[]>('/queue-types', { method:'GET' });
		queueTypes.value = res || [];
		if (!activeTypeId.value && queueTypes.value.length) activeTypeId.value = queueTypes.value[0].id;
		syncStepEdits();
		syncTypeForm();
		await loadServiceProducts();
	}catch{
		queueTypes.value = [];
	}
}

// 未保存变更跟踪
watch(stepEdits, ()=>{ dirtySteps.value = true; }, { deep: true });
watch(typeForm, ()=>{ dirtyType.value = true; }, { deep: true });
function markClean(){ dirtySteps.value=false; dirtyType.value=false; dirtyProducts.value=false; }
watch(queueTypes, ()=>{ markClean(); });
function onSavedSteps(){ dirtySteps.value=false; }
function onSavedType(){ dirtyType.value=false; }
function onSavedProducts(){ dirtyProducts.value=false; }

// 可用商品
const productKeyword = ref('');
const showDisabled = ref(false);
type Product = { id:number; name:string; price:number; enabled:boolean; type:string; imageUrl?: string | null; specType?: string; skus?: Array<{ id:number; name:string; price:number; enabled?: boolean }> };
const serviceProducts = ref<Product[]>([]);
const selectedProductIds = ref<number[]>([]);
const savingRowId = ref<number|null>(null);
const serviceTableRef = ref();
function productRowKey(row:{id:number}){ return row.id; }
function spSelectable(row:any){ return String(row?.type||'')==='SERVICE' && !!row.enabled; }
function isAllowed(id: number){ const t = activeType.value; if (!t) return false; return (t.products||[]).some((x:any)=> Number(x.productId)===Number(id)); }
async function onToggleAllowed(productId: number, allowed: boolean){ try { savingRowId.value=productId; const t = activeType.value; if (!t) return; const set = new Set<number>((t.products||[]).map((x:any)=>Number(x.productId))); if (allowed) set.add(productId); else set.delete(productId); selectedProductIds.value = Array.from(set); await saveTypeProducts(); } finally { savingRowId.value=null; } }
function onSelectProducts(rows:any[]){ selectedProductIds.value = rows.map(r=>r.id); }
const savingProducts = ref(false);
async function loadServiceProducts(){ const query:any = { type: 'SERVICE', keyword: productKeyword.value || undefined }; if (!showDisabled.value) query.enabled = true as any; const res = await http<Product[]>(`/store/products`, { method:'GET', query }); serviceProducts.value = res||[]; await loadTypeProductsSelection(); await nextTick(); try { const table:any = serviceTableRef.value; if (table && table.clearSelection) { table.clearSelection(); } const set = new Set<number>((selectedProductIds?.value||[]) as number[]); for (const row of serviceProducts.value) { if (set.has(row.id)) { try { (serviceTableRef.value as any).toggleRowSelection(row, true); } catch {} } } } catch {} }
async function loadTypeProductsSelection(){ const t = activeType.value; if (!t) return; const ids = new Set<number>((t.products||[]).map((x:any)=>x.productId)); const currentIds = new Set<number>((serviceProducts.value||[]).map(p=>p.id)); selectedProductIds.value = Array.from(ids).filter(id=> showDisabled.value ? true : currentIds.has(id)); }
async function saveTypeProducts(){ const t = activeType.value; if (!t) return; const ids = selectedProductIds.value.filter(id=>Number.isFinite(id)); await http(`/queue-types/${t.id}/products`, { method:'PUT', body: { productIds: ids } }); ElMessage.success('已保存可用商品'); await loadQueueTypes(); dirtyProducts.value=false; await nextTick(); try { await loadServiceProducts(); } catch {} }
function selectAllServiceProducts(){ const set = new Set<number>((serviceProducts.value||[]).filter(sp=>spSelectable(sp as any)).map(sp=>sp.id)); selectedProductIds.value = Array.from(set); }
function clearProductSelection(){ selectedProductIds.value = []; }

// 入队向导（完整：车辆 + 类型 + 商品 + 确认）
const wizardDrawer = ref(false);
const wizardStep = ref(0);
const wizardQueueTypeId = ref<number|undefined>(undefined);
const wizardAllowedProducts = ref<Product[]>([]);
const wizardSelectedProductIds = ref<number[]>([]);
const wizardSkuByProduct = ref<Record<number, number|undefined>>({});
const wizardSelectedProductNames = computed(()=>{ const map = new Map<number, Product>(wizardAllowedProducts.value.map(p=>[p.id, p] as any)); return (wizardSelectedProductIds.value||[]).map(id=>map.get(id)?.name||'').filter(Boolean); });
function openWizard(){ wizardDrawer.value=true; wizardStep.value=0; wizardQueueTypeId.value = queueTypes.value[0]?.id; resetVehicleForm(); wizardSelectedProductIds.value=[]; wizardSkuByProduct.value={}; if (mode.value === 'guest') { ensureBrandsLoaded(); } }
function onWizardSelectionChange(rows:any[]){ wizardSelectedProductIds.value = rows.map(r=>r.id); }

// 车辆模式与表单
type MemberOption = { id:number; name:string; phone:string };
const memberOptions = ref<MemberOption[]>([]);
const memberVehicles = ref<Array<{ id:number; plateNumber:string; brand?:string; series?:string }>>([]);
type Mode = 'smart' | 'member' | 'existing' | 'guest';
const mode = ref<Mode>('smart');
const form = ref<any>({ memberId: undefined, vehicleId: undefined, plateNumber: '', vin: '', brandId: undefined as number | undefined, seriesId: undefined as number | undefined, typeMain: '', typeSub: '', color: '', existingVehicle: null as any, brandName: '', seriesName: '' });
// 统一重置车辆相关状态，避免后续创建沿用历史数据
function resetVehicleForm(){
	try{
		form.value = { memberId: undefined, vehicleId: undefined, plateNumber: '', vin: '', brandId: undefined, seriesId: undefined, typeMain: '', typeSub: '', color: '', existingVehicle: null, brandName: '', seriesName: '' } as any;
		memberVehicles.value = [];
		currentBrand.value = null;
		seriesOptions.value = [];
		lockTypeBySeries.value = false;
		// 智能选择默认“绑定到会员”
		smartCreateMode.value = 'member';
	}catch{}
}
// 智能选择：新建路径（member | guest）——默认改为“绑定到会员”
const smartCreateMode = ref<'member'|'guest'>('member');
// 当选择会员时自动对齐到“绑定到会员”；不在无会员时强制改回“游客”
watch(()=>form.value.memberId, ()=>{
    try{
        if (mode.value !== 'smart') return;
        if (form.value.memberId) smartCreateMode.value = 'member';
    }catch{}
});
type PlateSearchItem = { id:number; plateNumber:string; brand?:string; series?:string; memberId?:number|null; memberName?:string; memberPhone?:string };
async function querySearchPlate(queryString: string, cb: (items: PlateSearchItem[])=>void){ const kw = String(queryString || '').trim(); if (!kw) { cb([]); return; } try { const res = await http<PlateSearchItem[]>(`/vehicle/search`, { method: 'GET', query: { q: kw, limit: 15 } }); cb(res || []); } catch { cb([]); } }
function onSelectExistingVehicle(item: PlateSearchItem){ form.value.plateNumber = item.plateNumber; form.value.vehicleId = item.id; form.value.existingVehicle = item; }
async function onMemberChange(){ memberVehicles.value = []; form.value.vehicleId = undefined; if (!form.value.memberId) return; const res = await http<any[]>(`/vehicle/member/${form.value.memberId}`, { method: 'GET' }); memberVehicles.value = res || []; }
async function fetchMemberOptions(){ try{ const res = await http<{ items: MemberOption[] }>(`/member/list`, { method: 'GET', query: { page: 1, pageSize: 500 } }); memberOptions.value = res?.items || []; } catch { memberOptions.value = []; } }

// 品牌/车系联动（游客车辆）
const brandLetters = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
const selectedLetter = ref<string | null>(null);
const brandLoading = ref(false);
const brandsLoaded = ref(false);
const seriesLoading = ref(false);
const brandOptionsAll = ref<any[]>([]);
const brandOptions = ref<any[]>([]);
const brandSelectRef = ref();
const brandSelectKey = ref(0);
const currentBrand = ref<any|null>(null);
const seriesOptions = ref<any[]>([]);
const lockTypeBySeries = ref(false);
const typeMainOptions = ['轿车', 'SUV', 'MPV', '卡车', '跑车'];
const colorOptionsList = ['黑色','白色','灰色','银色','红色','金色（米/香槟）','蓝色','棕色（褐/咖啡）','紫色','绿色','粉色','黄色','橙色','其他（彩绘/混合)'];
const typeSubMap: Record<string, string[]> = { '轿车': ['微型车','小型车','紧凑型车','中型车','中大型车','大型车'], 'SUV': ['小型SUV','紧凑型SUV','中型SUV','中大型SUV','大型SUV'], 'MPV': ['小型MPV','紧凑型MPV','中型MPV','中大型MPV','大型MPV'], '卡车': ['轻卡','微卡','皮卡','房车'], '跑车': [] };
function typeSubOptions(main?: string){ return main ? (typeSubMap[main] || []) : []; }
function selectLetter(ch: string | null){ selectedLetter.value = ch; applyBrandFilter(); try { brandSelectKey.value++; } catch {} }
function applyBrandFilter(){ const all = brandOptionsAll.value; brandOptions.value = selectedLetter.value ? all.filter((b:any)=>(b.letter||'').toUpperCase()===selectedLetter.value) : all; }
async function fetchBrands(){ brandLoading.value=true; try { const resp = await fetch(`${API_BASE}/content/car/brands`); const json = await resp.json(); const arr:any[] = json || []; const flat:any[]=[]; for (const mb of arr){ for (const b of (mb.brand_list||[])){ flat.push({ brand_id: b.brand_id, brand_name: b.brand_name, main_brand_name: mb.main_brand_name, letter: (mb.letter||'').toUpperCase(), img: b.img || mb.img }); } } brandOptionsAll.value = flat; applyBrandFilter(); brandsLoaded.value=true; } catch { brandOptionsAll.value=[]; brandOptions.value=[]; } finally { brandLoading.value=false; } }
async function fetchSeries(brandId: number){ if (!brandId) { seriesOptions.value=[]; return; } seriesLoading.value=true; try { const resp = await fetch(`${API_BASE}/content/car/series?brandId=${brandId}`); const json = await resp.json(); const arr:any[] = json || []; seriesOptions.value = arr.map((s:any)=>({ series_id: s.series_id, series_name: s.series_name, scale: s.scale })); } catch { seriesOptions.value=[]; } finally { seriesLoading.value=false; } }
function onBrandChange(val: number){ const b = brandOptionsAll.value.find((x:any)=>x.brand_id===val); form.value.brandName = b?.brand_name || ''; currentBrand.value = b || null; form.value.seriesId = undefined; fetchSeries(val); }
function onSeriesChange(val: number){ const s = seriesOptions.value.find((x:any)=>x.series_id===val); form.value.seriesName = s?.series_name || ''; const scale = (s?.scale||'').toString(); const { main, sub } = mapScaleToType(scale); if (main) form.value.typeMain = main; if (sub) form.value.typeSub = sub; lockTypeBySeries.value = !!val; }
function onBrandDropdownVisible(visible: boolean){ if (visible && !brandsLoaded.value && !brandLoading.value) fetchBrands(); }
function mapScaleToType(scale: string): { main: string; sub: string } { const sc=(scale||'').trim(); if(!sc) return { main:'', sub:''}; if(/SUV/i.test(sc)) return { main:'SUV', sub: sc.replace(/\s+/g,'') }; if(/MPV/i.test(sc)) return { main:'MPV', sub: sc.replace(/\s+/g,'') }; if(/(皮卡|轻卡|微卡|房车)/.test(sc)){ const sub = sc.includes('皮卡')?'皮卡':sc.includes('轻卡')?'轻卡':sc.includes('微卡')?'微卡':'房车'; return { main:'卡车', sub }; } if(/跑车/.test(sc)) return { main:'跑车', sub:'' }; return { main:'轿车', sub: sc.replace(/\s+/g,'') }; }
function formatBrandImg(url?: string){ if (!url) return ''; return url; }

// 品牌列表懒加载：仅在下拉展开时加载（onBrandDropdownVisible 中触发），避免无谓 API 调用
async function ensureBrandsLoaded(){
    try{
        selectedLetter.value = null;
        if (brandsLoaded.value) { applyBrandFilter(); return; }
        // 不主动加载，保留方法供其他入口显式调用
    } catch {}
}

// 移除进入游客模式/打开向导时的预加载，保持懒加载
// 切换模式时清理跨模式残留，避免误用上一辆车数据
watch(mode, (m)=>{
	try{
		// 清理现有车辆选中状态
		form.value.vehicleId = undefined;
		form.value.existingVehicle = null;
		// 非智能/现有模式不保留车牌文本
		if (m !== 'existing' && m !== 'smart') {
			form.value.plateNumber = '';
		}
		// 非会员模式清理会员相关
		if (m !== 'member'){
			form.value.memberId = undefined;
			memberVehicles.value = [];
		}
		// 非游客模式清理游客扩展字段
		if (m !== 'guest'){
			form.value.vin = '';
			form.value.brandId = undefined;
			form.value.seriesId = undefined;
			form.value.typeMain = '';
			form.value.typeSub = '';
			form.value.color = '';
			form.value.brandName = '';
			form.value.seriesName = '';
			currentBrand.value = null;
			seriesOptions.value = [];
			lockTypeBySeries.value = false;
		}
	}catch{}
});
watch(wizardDrawer, (open)=>{ if (open && mode.value === 'guest') { /* no-op */ } });

const selectedPlate = computed(()=>{ if (mode.value === 'member') { const v = memberVehicles.value.find(v=>v.id === form.value.vehicleId); if (v?.plateNumber) return v.plateNumber; } if ((mode.value === 'existing' || mode.value==='smart') && form.value.existingVehicle?.plateNumber) return form.value.existingVehicle.plateNumber; return form.value.plateNumber || '-'; });
async function nextWizardFromVehicle(){
    // 智能模式：优先使用已选择车辆；否则根据新建路径校验
    if (mode.value === 'smart'){
        const plate = String(form.value.plateNumber||'').trim();
        if (!plate && !form.value.vehicleId) { ElMessage.error('请输入或选择车牌'); return; }
        if (!form.value.vehicleId){
            if (smartCreateMode.value === 'member'){
                if (!form.value.memberId){ ElMessage.error('请选择会员'); return; }
                if (!form.value.typeMain){ ElMessage.error('请选择车辆主类'); return; }
            } else {
                if (!form.value.typeMain){ ElMessage.error('请选择车辆主类'); return; }
            }
        }
        wizardStep.value=1; return;
    }
    if (mode.value === 'member') {
        if (!form.value.vehicleId) { ElMessage.error('请选择会员车辆'); return; }
    }
    if (mode.value === 'existing') {
        const plate = String(form.value.plateNumber||'').trim();
        if (!plate && !form.value.vehicleId) { ElMessage.error('请输入或选择车牌'); return; }
        if (!form.value.vehicleId && plate) {
            try{
                const res = await http<PlateSearchItem[]>(`/vehicle/search`, { method:'GET', query: { q: plate, limit: 20 } });
                const upper = plate.toUpperCase();
                const match = (res||[]).find(it => String(it.plateNumber||'').toUpperCase() === upper);
                if (!match) {
                    ElMessage.error('未找到该车牌对应的车辆，请从列表选择现有车辆或切换为游客车辆');
                    return;
                }
                form.value.vehicleId = Number(match.id||0) || undefined;
                form.value.existingVehicle = match;
            } catch {
                ElMessage.error('查询车辆失败，请稍后重试');
                return;
            }
        }
    }
    if (mode.value === 'guest') {
        if (!form.value.plateNumber || !form.value.typeMain) { ElMessage.error('请完善游客车辆信息'); return; }
    }
    wizardStep.value=1;
}
watch(wizardQueueTypeId, async (val)=>{ if (!val) { wizardAllowedProducts.value = []; return; } const t = queueTypes.value.find(t=>t.id===val); const ids = new Set<number>((t?.products||[]).map((x:any)=>x.productId)); if (!ids.size) { wizardAllowedProducts.value = []; wizardSelectedProductIds.value=[]; return; } const list = await http<any[]>(`/store/products`, { method: 'GET', query: { type: 'SERVICE' } as any }); wizardAllowedProducts.value = (list||[]).filter(p=>ids.has(p.id)); wizardSelectedProductIds.value = []; wizardSkuByProduct.value = {}; });
const submittingOrder = ref(false);
async function submitCreateOrderAndEnqueue(){ try{ if (!wizardQueueTypeId.value){ ElMessage.error('请选择队列类型'); return; } if (!wizardSelectedProductIds.value.length){ ElMessage.error('请选择服务商品'); return; } submittingOrder.value=true; // 构造 items，校验多规格SKU
        for (const p of wizardAllowedProducts.value){ if (String((p as any)?.specType||'')==='MULTI' && wizardSelectedProductIds.value.includes(p.id)){ const sid = wizardSkuByProduct.value[p.id]; if (!sid){ ElMessage.error(`请选择规格：${p.name}`); submittingOrder.value=false; return; } } }
        const items = wizardSelectedProductIds.value.map(pid=>({ productId: pid, skuId: wizardSkuByProduct.value[pid] || null }));
        const body:any = { queueTypeId: wizardQueueTypeId.value, items };
        // 智能模式处理：若未选vehicleId，按路径决定
        if (mode.value === 'smart'){
            if (form.value.vehicleId){
                body.vehicleId = form.value.vehicleId;
            } else if (smartCreateMode.value === 'member'){
                // 先创建会员车辆，再使用 vehicleId
                const payload:any = { plateNumber: String(form.value.plateNumber||'').trim(), vin: form.value.vin||undefined, brand: form.value.brandName||undefined, series: form.value.seriesName||undefined, brandId: form.value.brandId||undefined, seriesId: form.value.seriesId||undefined, typeMain: form.value.typeMain, typeSub: form.value.typeSub||undefined, color: form.value.color||undefined };
                const created:any = await http(`/vehicle/member/${form.value.memberId}`, { method:'POST', body: payload });
                body.vehicleId = Number(created?.id||0) || undefined;
                if (!body.vehicleId) { ElMessage.error('创建会员车辆失败'); return; }
            } else {
                // 游客车辆：随入队接口一起创建（保持图片填充：传 brandId/seriesId）
                body.plateNumber = String(form.value.plateNumber||'').trim();
                Object.assign(body, { vin: form.value.vin||undefined, brandId: form.value.brandId||undefined, seriesId: form.value.seriesId||undefined, brand: form.value.brandName||undefined, series: form.value.seriesName||undefined, typeMain: form.value.typeMain, typeSub: form.value.typeSub||undefined, color: form.value.color||undefined });
            }
        } else {
            if (form.value.vehicleId) body.vehicleId = form.value.vehicleId; else body.plateNumber = form.value.plateNumber;
            if (mode.value === 'guest') Object.assign(body, { vin: form.value.vin||undefined, brandId: form.value.brandId||undefined, seriesId: form.value.seriesId||undefined, brand: form.value.brandName||undefined, series: form.value.seriesName||undefined, typeMain: form.value.typeMain, typeSub: form.value.typeSub||undefined, color: form.value.color||undefined });
        }
        await http('/queue/create-service-order-and-enqueue', { method:'POST', body }); ElMessage.success('已创建订单并入队'); resetVehicleForm(); wizardSelectedProductIds.value=[]; wizardSkuByProduct.value={}; wizardQueueTypeId.value = queueTypes.value[0]?.id; wizardDrawer.value=false; wizardStep.value=0; await fetchList(); } finally { submittingOrder.value=false; } }

function skuLabel(s: any){ try{ const p = Number(s?.price||0); return p>0 ? `${s?.name||''}（￥${p.toFixed(2)}）` : String(s?.name||''); }catch{ return String(s?.name||''); } }
function skuPriceHint(row: any){ try{ const arr = Array.isArray(row?.skus)?row.skus:[]; if(!arr.length) return '-'; const prices = arr.map((x:any)=>Number(x?.price||0)).filter((n:number)=>Number.isFinite(n)); if(!prices.length) return '-'; const min = Math.min(...prices); const max = Math.max(...prices); return min===max ? `￥${min.toFixed(2)}` : `￥${min.toFixed(2)} ~ ￥${max.toFixed(2)}`; }catch{ return '-'; } }
function skuNameById(pid: number, sid: number){ try{ const p = wizardAllowedProducts.value.find(x=>x.id===pid) as any; const s = (p?.skus||[]).find((y:any)=>Number(y.id)===Number(sid)); return s?.name || '-'; }catch{ return '-'; } }

let pollTimer: any = null;
onMounted(()=>{ fetchList(); fetchEta(); fetchMemberOptions(); if (!queueTypes.value.length) loadQueueTypes(); pollTimer = setInterval(()=>{ fetchList(); fetchEta(); }, 8000); window.addEventListener('resize', onResize); nextTick().then(()=>measureOpsWidth());
    // 监听车牌变更以主动触发联想建议（支持智能/现有车辆；包括物理键盘与车牌键盘逐字输入）
    watch(()=>form.value.plateNumber, async (val)=>{
        try{
            const s = String(val||'').trim();
            if (mode.value !== 'existing' && mode.value !== 'smart') return;
            await nextTick();
            const comp:any = existingAutoRef.value;
            const input = comp?.inputRef?.input || (comp?.$el?.querySelector('input') as HTMLInputElement | null);
            if (input) {
                if (document.activeElement !== input) { try{ input.focus(); }catch{} }
                input.dispatchEvent(new Event('input', { bubbles: true }));
                // 若未出现下拉，尝试触发键盘事件以兼容浏览器差异
                try{ input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' } as any)); }catch{}
            }
        }catch{}
    });
});
onUnmounted(()=>{ try{ if (pollTimer) clearInterval(pollTimer); } catch{} pollTimer = null; try{ window.removeEventListener('resize', onResize); }catch{} });
watch(list, async ()=>{ await nextTick(); measureOpsWidth(); });
watch(filtered, async ()=>{ await nextTick(); measureOpsWidth(); });

// 当车牌与已选车辆不一致或被清空时，清理 vehicleId/existingVehicle 以恢复“新建车辆”入口
watch(()=>form.value.plateNumber, (val)=>{
    try{
        const s = String(val||'').trim();
        const exist = form.value.existingVehicle?.plateNumber;
        if (!s){ form.value.vehicleId = undefined; form.value.existingVehicle = null; return; }
        if (exist && String(exist||'').toUpperCase() !== s.toUpperCase()){
            form.value.vehicleId = undefined;
            form.value.existingVehicle = null;
        }
    }catch{}
});

// 抽屉关闭前提示未保存修改
async function onBeforeCloseConfigDrawer(done: () => void){
	if (dirtySteps.value || dirtyType.value || dirtyProducts.value){
		try{
			await ElMessageBox.confirm('检测到未保存的修改，确定要关闭吗？', '提示', { type:'warning', confirmButtonText: '关闭并丢弃', cancelButtonText: '取消' });
			done();
			markClean();
		}catch{}
	}else{
		done();
	}
}

function onRowDblClick(row:any){
	try{
		const id = Number((row as any)?.orderId||0)||0;
		if (!id){ ElMessage.error('未找到订单'); return; }
		openOrder(row);
	}catch{}
}

const lastTapTs = ref<number>(0);
const lastTapRowId = ref<number|null>(null);
function onRowClick(row:any, column:any, event:any){
	try{
		const id = Number((row as any)?.orderId||0)||0;
		if (!id) return;
		// 忽略操作列/索引/选择列
		const colClass = String(column?.className||'');
		const colType = String(column?.type||'');
		if (colClass.includes('col-ops') || colType==='index' || colType==='selection') return;
		const now = Date.now();
		if (lastTapRowId.value === id && (now - lastTapTs.value) <= 350){
			lastTapTs.value = 0; lastTapRowId.value = null; openOrder(row); return;
		}
		lastTapRowId.value = id; lastTapTs.value = now;
	}catch{}
}

// 步骤选择弹窗
const stepPickerVisible = ref(false);
const stepPickerRow = ref<QueueItem|null>(null);
function openStepPicker(row: QueueItem){ stepPickerRow.value = row; stepPickerVisible.value = true; }
async function confirmPickStep(i: number){ try{ const row = stepPickerRow.value; if (!row) return; await setCurrent(row, i); stepPickerVisible.value=false; }catch{} }
</script>

<style scoped>
.eta-tags{ display:flex; align-items:center; gap:10px; flex-wrap: wrap; padding: 6px 8px; background: #fafafa; border: 1px dashed #e5e7eb; border-radius: 8px; }
.actions-bar{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.search-input{ width:340px; }
.pos-table{ border-radius: 12px; overflow: hidden; border: 1px solid var(--el-border-color); box-shadow: 0 2px 10px rgba(0,0,0,.04); }
 .pos-table :deep(.el-table__header){ font-size: 15px; }
 .pos-table :deep(.el-table__row){ height: auto; }
 .pos-table :deep(.el-button){ font-size: 15px; white-space: nowrap; }
 .pos-table :deep(.el-select .el-input__wrapper){ padding: 10px 12px; }
 .step-switch{ width:180px; margin:0 8px; }
.quick-filter{ display:flex; align-items:center; }
.vehicle{ display:flex; align-items:center; gap:12px; }
.brand-img{ width:28px;height:28px;object-fit:contain;border-radius:4px; border:1px solid #eee; }
.v-text{ display:flex; flex-direction:column; }
.member{ margin-left:8px; color:#606266; }
.muted{ color:#909399; }
.subline{ display:flex; align-items:center; gap:8px; margin-top:2px; flex-wrap:wrap; }
.steps-cell{ display:block; width:100%; overflow:visible; }
.steps-cell :deep(.el-steps){ width:100%; }
.steps-cell :deep(.el-step__main){ white-space:normal; }
.steps-cell :deep(.el-step__title){ white-space:normal; }
.steps-cell :deep(.el-step__description){ white-space:normal; }
.btn-lg{ padding: 16px 20px; min-height:44px; }
.pimg{ width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #eee; }
.pimg.empty{ display:flex;align-items:center;justify-content:center;color:#bbb; }
.scan-wrap{ display:flex;flex-direction:column;gap:8px;align-items:center; }
.video{ width:100%;max-height:420px;background:#000; }
.scan-tip{ color:#909399;font-size:12px; }
.row-running{ background: #f0f9eb; }
.row-completed{ background: #fff7e6; }
.pos-table :deep(.el-table__cell){ padding: 12px 8px; }
.pos-table :deep(.el-tag){ transform: scale(1.05); }
.pos-table :deep(.el-table__empty-text){ font-size: 16px; }
.col-ops :deep(.cell){
	padding-right: 8px;
}
.ops{ display:inline-flex; align-items:center; gap:8px; flex-wrap: wrap; max-width: 100%; }
/* 紧凑模式：仅未支付相关按钮时自动缩小 */
.ops:has(.pay-only){ gap:6px; }
.ops .pay-only{ display:inline-flex; align-items:center; gap:6px; }

/* 隐藏测量模板但参与布局尺寸计算 */
.ops-measure{ position: absolute; visibility: hidden; height: 0; overflow: hidden; }
.ops-measure .ops{ white-space: nowrap; }
.ops-measure .ops-pay-only .el-button{ padding: 10px 12px; }

/* 横屏触控增强（12.7 英寸平板优先） */
.pos-table :deep(.el-select .el-input__wrapper){ padding: 12px 14px; }
.step-switch{ width:220px; }
@media (min-width: 1280px){
	.pos-table :deep(.el-table__header){ font-size: 16px; }
	.pos-table :deep(.el-table__cell){ padding: 14px 10px; }
	.vehicle{ gap:14px; }
}

/* 配置抽屉：横屏触控优化（参照后台并适配 12.7\"） */
.config-flex{ display:flex; gap:12px; height: calc(100vh - 160px); }
.config-left{ flex: 0 0 300px; border-right:1px solid #ebeef5; padding-right:12px; overflow:auto; }
.config-left-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.type-search{ width:100%; margin: 6px 0 8px; }
.config-left :deep(.el-menu-item){ height:48px; line-height:48px; font-size:15px; }
.config-right{ flex:1; overflow:auto; padding-left:12px; }
.config-right-head{ position: sticky; top: 0; background:#fff; z-index: 1; padding:6px 0; display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.config-right-title{ display:flex; align-items:center; gap:8px; }
.config-right :deep(.el-card__header){ padding: 10px 12px; font-weight: 600; }
.config-right :deep(.el-table .el-table__cell){ padding: 10px 8px; }
.config-right :deep(.el-input__wrapper){ padding: 10px 12px; }
.config-right :deep(.el-input-number .el-input__wrapper){ padding: 8px 10px; }
.config-right :deep(.el-input-number){ width: 120px; }
.config-right :deep(.el-table .cell){ overflow: visible; }
.config-right :deep(.el-input-number .el-input__wrapper){ padding-right: 36px; }
.config-right :deep(.el-input-number .el-input__inner){ text-align: center; }
.config-right :deep(.el-input-number.is-without-controls .el-input__wrapper){ padding-right: 12px; }
.config-right :deep(.el-input-number .el-input-number__decrease),
.config-right :deep(.el-input-number .el-input-number__increase){ width: 30px; }
.config-right :deep(.el-switch){ transform: scale(1.1); }
.config-right :deep(.el-button--small){ padding: 8px 10px; }
.config-right :deep(.el-select .el-input__wrapper){ padding: 10px 12px; }
.config-right :deep(.el-radio-button__inner){ padding: 8px 12px; }
.config-right :deep(.el-form-item){ margin-bottom: 12px; }
.card-actions.sticky{ position: sticky; bottom: 0; background: #fff; padding: 8px 0; }

/* 入队向导：触控友好布局与粘底操作区 */
.wiz-vehicle{ padding-bottom: 56px; }
.mode-tabs{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom: 10px; }
.wiz-form{ background:#fff; border: 1px solid #ebeef5; border-radius: 10px; padding: 12px; }
.letter-bar{ display:flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 8px; }
.letter{ font-size: 13px; padding: 6px 8px; border-radius: 6px; cursor: pointer; color: #666; border:1px dashed #e5e7eb; }
.letter.active{ background:#ecf5ff; color:#409EFF; border-color:#c6e2ff; }
.brand-option{ display:flex; align-items:center; gap:8px; }
.brand-logo{ width:18px; height:18px; object-fit:contain; border-radius:2px; }
.brand-logo.prefix{ margin-right:6px; }
.brand-text{ line-height:18px; }
.wiz-actions{ position: sticky; bottom: 0; display:flex; justify-content:flex-end; gap:10px; background:#fff; padding: 10px 0 8px; margin-top: 12px; border-top: 1px dashed #ebeef5; }
.wiz-actions.split{ justify-content:space-between; align-items:center; }
.ml8{ margin-left:8px; }

/* Step2 表格密度与可点选区域 */
.wiz-products :deep(.el-table .el-table__cell){ padding: 10px 8px; }
.wiz-products :deep(.el-checkbox__inner){ width: 18px; height: 18px; }
/* 现有车辆联想下拉提升层级，确保不被车牌键盘遮挡 */
:deep(.existing-plate-popper){ z-index: 4000 !important; }
</style>


