<template>
	<BasePage title="服务队列">
		<template #actions>
			<div style="display:flex; align-items:center; gap:8px;">
				<el-input v-model="searchPlate" placeholder="按车牌快速定位" style="width:220px;" clearable />
				<!-- 顶部 ETA 汇总（按类型展示，按资源组计算） -->
				<div v-if="etaSummary.length" style="display:flex; align-items:center; gap:6px; flex-wrap: wrap; max-width: 720px;">
					<el-tag
						v-for="t in etaSummary"
						:key="t.typeId"
						:effect="selectedTypeIds.includes(t.typeId) ? 'dark' : 'light'"
						:style="t.displayColor ? { backgroundColor: selectedTypeIds.includes(t.typeId) ? t.displayColor : '', color: selectedTypeIds.includes(t.typeId) ? '#fff' : '', borderColor: t.displayColor } : {}"
						clickable
						@click="toggleSelectType(t.typeId)"
					>
						<span>{{ t.typeName }}</span>
						<template v-if="t.excludedFromEta"><span style="margin-left:6px;">不计入等待</span></template>
						<template v-else-if="!t.etaConfigured"><span style="margin-left:6px;">未配置</span></template>
						<template v-else><span style="margin-left:6px;">新车≈{{ t.etaForNewCar }} 分钟</span></template>
					</el-tag>
					<el-button v-if="selectedTypeIds.length" size="small" @click="clearSelectedTypes">清除筛选</el-button>
				</div>
				<el-button type="primary" @click="openConfigDrawer"><el-icon style="vertical-align: middle; margin-right:4px;"><Setting /></el-icon><span style="vertical-align: middle;">配置</span></el-button>
				<el-button type="primary" @click="openWizard"><el-icon style="vertical-align: middle; margin-right:4px;"><Tickets /></el-icon><span style="vertical-align: middle;">创建订单并入队</span></el-button>
			</div>
		</template>

		<el-table :data="filtered" stripe style="width:100%" :row-key="rowKey">
			<el-table-column type="index" label="#" width="60" />
			<el-table-column prop="vehicle" label="车辆" min-width="300">
				<template #default="{ row }">
					<div style="display:flex; align-items:center; gap:10px;">
						<img v-if="row?.vehicle?.brandImage" :src="toAbs(row.vehicle.brandImage)" style="width:24px;height:24px;object-fit:contain;border-radius:4px; border:1px solid #eee;" />
						<div style="display:flex; flex-direction:column;">
							<div>
								<el-tag v-if="row?.vehicle?.group" type="info" style="margin-right:6px;" effect="plain"><el-icon style="margin-right:4px;"><OfficeBuilding /></el-icon>{{ row.vehicle.group.name }}</el-tag>
								<el-tag :type="row?.vehicle?.group ? 'info' : (row.guest ? 'warning' : 'danger')" style="margin-right:6px;">{{ row?.vehicle?.group ? '集团客户' : (row.guest ? '游客' : '会员') }}</el-tag>
								<strong>{{ row.plateNumber }}</strong>
								<span v-if="row?.vehicle?.member" style="margin-left:8px; color:#606266;">{{ row.vehicle.member.name || '-' }}（{{ row.vehicle.member.phone || '-' }}）</span>
							</div>
							<small style="color:#909399;">
								{{ row?.vehicle?.brand || '-' }} / {{ row?.vehicle?.series || '-' }}
							</small>
						</div>
					</div>
				</template>
			</el-table-column>
			<el-table-column prop="queueType" label="队列类型" width="160">
				<template #default="{ row }">
					<el-tag size="small" :style="row?.queueType?.displayColor ? { backgroundColor: row.queueType.displayColor, color: '#fff', borderColor: row.queueType.displayColor } : {}">{{ row?.queueType?.name || '-' }}</el-tag>
				</template>
			</el-table-column>
			<el-table-column label="当前流程" min-width="320">
				<template #default="{ row }">
						<div class="steps-cell">
							<el-steps :active="computeActive(row)" :process-status="row.currentTaskIndex < 0 ? 'wait' : 'process'" finish-status="success">
							<el-step v-for="(t,i) in row.tasks" :key="t.id" :title="t.name" :description="`${t.durationMin}分钟`" :status="stepStatus(row, i, t)" />
						</el-steps>
						</div>
				</template>
			</el-table-column>
			<el-table-column label="排队/剩余" width="320">
				<template #default="{ row, $index }">
					<div>前方：{{ $index }} 辆 ≈ {{ aheadMinutesModel($index) }} 分钟</div>
					<div>本车剩余：≈ {{ combinedRemainingModel(row, $index) }} 分钟</div>
					<div v-if="row.excludedFromEta" style="margin-top:4px;"><el-tag size="small" type="info" effect="plain">不计入预计等待</el-tag></div>
					<div v-else-if="!row.etaConfigured" style="margin-top:4px;"><el-tag size="small" type="warning" effect="plain">预计时间未配置</el-tag></div>
					<div v-else style="margin-top:4px; color:#606266; font-size:12px;">同组预计等待：前方≈{{ row.aheadMinutesEta }} 分钟；本车≈{{ row.remainingMinutesEta }} 分钟</div>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="520" fixed="right">
				<template #default="{ row }">
					<template v-if="row.status!=='COMPLETED'">
						<el-button v-if="row.currentTaskIndex < 0" size="small" type="primary" style="margin-right:8px;" @click="startFirst(row)"><el-icon><VideoPlay /></el-icon><span>开始 {{ row?.tasks?.[0]?.name || '第一步' }}</span></el-button>
						<el-select v-model="row.currentTaskIndex" placeholder="切换流程" style="width:160px;margin-right:8px;" :disabled="row.currentTaskIndex < 0" @change="(i:number)=>setCurrent(row, i)">
							<el-option v-for="(t,i) in row.tasks" :key="t.id" :label="`${i+1}.${t.name}`" :value="i" />
						</el-select>
						<el-button size="small" type="success" :disabled="row.currentTaskIndex < 0 || row.currentTaskIndex >= (row.tasks?.length||0) - 1" @click="finishTask(row)"><el-icon><SuccessFilled /></el-icon><span>完成当前</span></el-button>
						<el-popconfirm title="确认该车辆所有步骤均已完成？" @confirm="confirmComplete(row)">
							<template #reference>
								<el-button size="small" type="danger" :disabled="row.currentTaskIndex < 0"><el-icon><SwitchButton /></el-icon><span>结束</span></el-button>
							</template>
						</el-popconfirm>
						<el-popconfirm title="确认移出队列？" @confirm="removeItem(row)">
							<template #reference>
								<el-button size="small" type="warning" plain style="margin-left:8px;">移出</el-button>
							</template>
						</el-popconfirm>
					</template>
					<template v-else>
						<el-tag type="warning" effect="plain" style="margin-left:8px;">待支付</el-tag>
						<el-button size="small" type="primary" style="margin-left:8px;" @click="openPay(row)">标记支付</el-button>
						<el-button size="small" link @click="openOrder(row)">查看订单</el-button>
					</template>
				</template>
			</el-table-column>
		</el-table>

		<!-- 复用订单列表的标记支付弹窗 -->
		<el-dialog v-model="showPay" title="手动确认支付" width="420px" @closed="stopScan">
			<el-tabs v-model="payTab">
				<el-tab-pane label="常规方式" name="manual">
					<el-select v-model="payMethod" placeholder="支付方式" style="width: 100%">
						<el-option label="现金" value="CASH" />
						<el-option label="收钱吧" value="SHOUQIANBA" />
						<el-option label="线下其他" value="OFFLINE" />
					</el-select>
					<div v-if="orderForPay" style="margin-top:12px; display:flex; align-items:center; gap:8px;">
						<div style="flex:0 0 auto; color:#606266;">收银立减</div>
						<el-input-number
							v-model="cashierDiscountInput"
							:min="0"
							:max="payAmountCap"
							:step="0.01"
							:precision="2"
							:controls="false"
							size="small"
							style="width: 140px;"
							@change="onManualDiscountChange"
						/>
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
					<div style="margin-top:8px; display:flex; gap:8px;">
						<el-button @click="openScan">打开摄像头识别</el-button>
						<el-upload :auto-upload="false" :show-file-list="false" accept="image/*" @change="onSelectImage">
							<el-button>从图片识别</el-button>
						</el-upload>
					</div>
					<div style="color:#909399;font-size:12px; margin-top:6px;">提示：仅用于线下收银，成功后订单将自动标记已支付。</div>
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
					<div style="color:#606266; font-size:13px; line-height:1.6; background:#f9fafb; padding:8px 10px; border-radius:6px; border:1px dashed #e5e7eb; margin-bottom:8px;">
						系统会自动识别本订单中标记为"计为洗车(次)"的服务商品数量作为需要扣减的次数，并从车辆所属集团或会员的洗车卡中优先扣减。次数不可手动修改。
					</div>
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
					<div style="color:#606266; font-size:13px; line-height:1.6; background:#f9fafb; padding:8px 10px; border-radius:6px; border:1px dashed #e5e7eb; margin-bottom:8px;">
						仅用于集团服务订单。集团余额支付不计入支付金额统计，仅进行集团余额内部扣减并记录关联订单流水。
					</div>
					<div style="margin-top:12px; text-align:right;">
						<el-button @click="showPay=false">取消</el-button>
						<el-button type="primary" :loading="groupPayLoading" @click="doGroupBalance">确认集团余额支付</el-button>
					</div>
				</el-tab-pane>
			</el-tabs>
		</el-dialog>
		<el-dialog v-model="showScan" title="摄像头识别付款码" width="520px">
			<div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
				<video ref="videoRef" style="width:100%;max-height:360px;background:#000;" playsinline muted></video>
				<canvas ref="canvasRef" style="display:none;"></canvas>
				<div style="color:#909399;font-size:12px;">将顾客付款码对准摄像头，系统会自动识别</div>
			</div>
			<template #footer>
				<el-button @click="showScan=false">关闭</el-button>
			</template>
		</el-dialog>

		<!-- 配置抽屉：队列类型/步骤/可用商品 -->
		<el-drawer v-model="configDrawer" title="服务队列配置" size="60%" :with-header="true">
			<div style="display:flex; gap:16px; height: calc(100vh - 160px);">
				<div style="flex: 0 0 280px; border-right:1px solid #ebeef5; padding-right:12px; overflow:auto;">
					<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
						<strong>队列类型</strong>
						<el-button size="small" type="primary" @click="openTypeEditor()"><el-icon><CirclePlus /></el-icon></el-button>
					</div>
					<el-menu :default-active="String(activeTypeId || '')" @select="onSelectType">
						<el-menu-item v-for="t in queueTypes" :key="t.id" :index="String(t.id)">
							<span>{{ t.name }}</span>
							<el-tag v-if="!t.enabled" size="small" type="info" effect="plain" style="margin-left:8px;">禁用</el-tag>
						</el-menu-item>
					</el-menu>
				</div>
				<div style="flex:1; overflow:auto; padding-left:12px;">
					<div v-if="activeType">
						<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
							<div style="display:flex; align-items:center; gap:8px;">
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
								<el-table-column label="步骤名" min-width="180">
									<template #default="{ row }"><el-input v-model="row.name" maxlength="20" show-word-limit placeholder="步骤名称（≤20字）" /></template>
								</el-table-column>
								<el-table-column label="时长(分钟)" width="160">
									<template #default="{ row }"><el-input-number v-model="row.durationMin" :min="0" :max="120" /></template>
								</el-table-column>
								<el-table-column label="计入ETA" width="120">
									<template #default="{ row }"><el-switch v-model="row.isEta" /></template>
								</el-table-column>
								<el-table-column label="操作" width="200">
									<template #default="{ $index }">
										<el-button size="small" @click="moveStep($index, -1)" :disabled="$index===0"><el-icon><ArrowUp /></el-icon></el-button>
										<el-button size="small" @click="moveStep($index, 1)" :disabled="$index===stepEdits.length-1"><el-icon><ArrowDown /></el-icon></el-button>
										<el-button size="small" type="danger" @click="removeStep($index)"><el-icon><Delete /></el-icon></el-button>
									</template>
								</el-table-column>
							</el-table>
							<div style="margin-top:8px; display:flex; gap:8px;">
								<el-button size="small" @click="addStep"><el-icon><CirclePlus /></el-icon>添加步骤</el-button>
								<el-button size="small" type="primary" @click="saveSteps" :loading="savingSteps">保存步骤</el-button>
							</div>
						</el-card>
						<el-card header="ETA 配置" shadow="never" style="margin-bottom:12px;">
							<el-alert type="info" :closable="false" style="margin-bottom:8px;" show-icon>
								<template #title>
									<div>
										<strong>ETA 配置说明</strong>
										<div style="font-size:12px; line-height:1.6; color:#606266; margin-top:4px;">
											<div>1) "参与预计等待"：开启后，该类型将参与 ETA 计算；关闭则在各处显示"<strong>不计入预计等待</strong>"。</div>
											<div>2) "并行工位数"：同一资源组可同时服务的车辆数（例如外观清洗有 2 组人员/工位，则填 2）。</div>
											<div>3) "资源组 Key"：将共享同一工位/人力的类型设置为<strong>相同</strong>的 Key（如 exterior、interior）。不同组彼此不影响。</div>
											<div>4) 在下方"步骤配置"中勾选需要纳入 ETA 的步骤（例如外观相关步骤）。未勾选的步骤不影响"新车预计等待"。</div>
											<div>5) ETA 口径：当组内正在进行中的 ETA 步骤数 < 并行工位数时，新车 ETA=0；否则按"组内剩余 ETA 步骤时长总和 ÷ 并行工位数"近似估算。</div>
										</div>
									<div style="font-size:12px; line-height:1.6; color:#606266; margin-top:6px;">
										<strong>推荐配置流程：</strong> 启用参与 → 设置并行工位数 → 设置资源组 Key → 在"步骤配置"勾选 ETA 步骤 → 保存。
									</div>
								</div>
							</template>
							</el-alert>
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
								<el-switch v-model="showDisabled" active-text="显示停用" @change="loadServiceProducts" />
							</div>
							<el-table ref="serviceTableRef" :data="serviceProducts" size="small" height="260" :row-key="productRowKey">
								<el-table-column label="图片" width="72">
									<template #default="{ row }">
										<img v-if="row?.imageUrl" :src="toAbs(row.imageUrl)" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #eee;" />
										<div v-else style="width:48px;height:48px;border:1px dashed #ddd;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#bbb;">无</div>
									</template>
								</el-table-column>
                                <el-table-column prop="name" label="商品" min-width="260" />
                                <el-table-column label="价格/区间" width="160">
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
										<el-switch :model-value="isAllowed(row.id)" :disabled="savingRowId===row.id" @change="(v:boolean)=>onToggleAllowed(row.id,v)" />
									</template>
								</el-table-column>
							</el-table>
							<div style="margin-top:8px; display:flex; gap:8px;">
								<el-button size="small" type="primary" @click="saveTypeProducts" :loading="savingProducts">保存可用商品</el-button>
							</div>
						</el-card>
					</div>
					<el-empty v-else description="选择左侧队列类型以进行配置" />
				</div>
			</div>
		</el-drawer>

		<!-- 队列类型编辑对话框 -->
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
		<el-drawer v-model="wizardDrawer" title="创建服务订单并入队" size="60%">
			<el-steps :active="wizardStep" finish-status="success" style="margin-bottom:12px;">
				<el-step title="车辆" />
				<el-step title="队列类型" />
				<el-step title="服务项目" />
				<el-step title="确认" />
			</el-steps>
			<div v-show="wizardStep===0">
				<!-- 复用三种录入方式 -->
				<div style="display:flex; gap:12px; margin-bottom:8px;">
					<el-button :type="mode==='member'?'primary':'default'" @click="mode='member'">会员车辆</el-button>
					<el-button :type="mode==='existing'?'primary':'default'" @click="mode='existing'">现有车辆</el-button>
					<el-button :type="mode==='guest'?'primary':'default'" @click="mode='guest'">游客车辆</el-button>
				</div>
				<!-- 直接复用已有表单片段 -->
				<el-form :model="form" label-width="110px">
					<el-form-item v-if="mode==='member'" label="选择会员">
						<el-select v-model="form.memberId" placeholder="请选择会员" filterable style="width:100%" @change="onMemberChange">
							<el-option v-for="m in memberOptions" :key="m.id" :label="`${m.name}（${m.phone}）`" :value="m.id" />
						</el-select>
					</el-form-item>
					<el-form-item v-if="mode==='member'" label="选择该会员车辆">
						<el-select v-model="form.vehicleId" placeholder="请选择车辆" filterable style="width:100%">
							<el-option v-for="v in memberVehicles" :key="v.id" :label="`${v.plateNumber}（${v.brand||'-'}/${v.series||'-'}）`" :value="v.id" />
						</el-select>
					</el-form-item>
					<el-form-item v-if="mode==='existing' || mode==='guest'" label="车牌号" required>
						<el-autocomplete v-if="mode==='existing'" v-model="form.plateNumber" :fetch-suggestions="querySearchPlate" placeholder="输入车牌支持模糊搜索" value-key="plateNumber" @select="onSelectExistingVehicle" style="width:100%" />
						<el-input v-else v-model="form.plateNumber" placeholder="例如 川A12345" />
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
						<small v-if="lockTypeBySeries" style="color:#909399;margin-left:8px;">已根据车系自动选择</small>
					</el-form-item>
					<el-form-item v-if="mode==='guest'" label="车辆子类">
						<el-select v-model="form.typeSub" placeholder="可选" clearable style="width:100%" :disabled="lockTypeBySeries">
							<el-option v-for="t in typeSubOptions(form.typeMain)" :key="t" :label="t" :value="t" />
						</el-select>
					</el-form-item>
					<el-form-item v-if="mode==='guest'" label="车辆颜色">
						<el-select v-model="form.color" placeholder="可选" clearable style="width:100%">
							<el-option v-for="c in colorOptions" :key="c" :label="c" :value="c" />
						</el-select>
					</el-form-item>
				</el-form>
				<div style="text-align:right;">
					<el-button type="primary" @click="nextWizardFromVehicle">下一步</el-button>
				</div>
			</div>
			<div v-show="wizardStep===1">
				<el-radio-group v-model="wizardQueueTypeId">
					<el-radio v-for="t in queueTypes" :key="t.id" :label="t.id">{{ t.name }}</el-radio>
				</el-radio-group>
				<div style="text-align:right; margin-top:12px;">
					<el-button @click="wizardStep=0">上一步</el-button>
					<el-button type="primary" @click="wizardStep=2">下一步</el-button>
				</div>
			</div>
            <div v-show="wizardStep===2">
                <el-alert type="info" :closable="false" style="margin-bottom:8px;" title="仅可选择该队列类型允许的服务商品" />
                <el-table :data="wizardAllowedProducts" size="small" height="300" @selection-change="onWizardSelectionChange">
                    <el-table-column label="图片" width="72">
                        <template #default="{ row }">
                            <img v-if="row?.imageUrl" :src="toAbs(row.imageUrl)" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #eee;" />
                            <div v-else style="width:48px;height:48px;border:1px dashed #ddd;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#bbb;">无</div>
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
                    <el-table-column prop="price" label="价格/区间" width="140">
                        <template #default="{ row }">
                            <template v-if="String(row?.specType||'')==='MULTI'">
                                <span>{{ skuPriceHint(row) }}</span>
                            </template>
                            <template v-else>{{ row.price }}</template>
                        </template>
                    </el-table-column>
                </el-table>
                <div style="display:flex; justify-content:space-between; margin-top:12px;">
                    <el-button @click="wizardStep=1">上一步</el-button>
                    <div>
                        <el-button @click="wizardDrawer=false">取消</el-button>
                        <el-button type="primary" @click="wizardStep=3">下一步</el-button>
                    </div>
                </div>
            </div>
            <div v-show="wizardStep===3">
				<el-descriptions title="确认信息" :column="1" border>
					<el-descriptions-item label="车牌">{{ selectedPlate }}</el-descriptions-item>
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
				<div style="display:flex; justify-content:space-between; margin-top:12px;">
					<el-button @click="wizardStep=2">上一步</el-button>
					<div>
						<el-button @click="wizardDrawer=false">取消</el-button>
						<el-button type="primary" :loading="submittingOrder" @click="submitCreateOrderAndEnqueue">提交</el-button>
					</div>
				</div>
			</div>
		</el-drawer>

		<!-- 直接入队对话框已移除，统一走向导 -->
	</BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import { ElMessage, ElMessageBox, ElIcon } from 'element-plus';
import { CirclePlus, User, UserFilled, Search, VideoPlay, SuccessFilled, SwitchButton, Setting, OfficeBuilding, ArrowUp, ArrowDown, Delete, Tickets } from '@element-plus/icons-vue';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
function rowKey(row: { id: number }){ return row.id; }
function toAbs(u?: string | null){ return absUrl(u || ''); }

type Task = { id:number; name:string; durationMin:number; status?: string };
type QueueItem = { id:number; plateNumber:string; guest:boolean; status?: string; orderId?: number|null; currentTaskIndex:number; tasks: Task[]; aheadCount:number; aheadMinutes:number; remainingMinutes:number; queueTypeId?: number|null; queueType?: { id:number; name:string; displayColor?: string|null } | null; vehicle?: { id:number; brand?:string|null; series?:string|null; brandImage?:string|null; member?: { name?: string|null; phone?: string|null } } };
const list = ref<QueueItem[]>([]);
const loading = ref(false);
const searchPlate = ref('');

const filtered = computed(()=>{
    const kw = searchPlate.value.trim().toUpperCase();
    const selected = new Set(selectedTypeIds.value);
    let arr = list.value || [];
    if (selected.size) arr = arr.filter((x:any)=> selected.has(Number(x?.queueTypeId || x?.queueType?.id || 0)));
    if (kw) arr = arr.filter(x => String(x.plateNumber||'').toUpperCase().includes(kw));
    return arr;
});

// 顶部 ETA 汇总（按类型展示，按资源组计算）
type EtaSummary = { typeId:number; typeName:string; displayColor?: string|null; etaConfigured:boolean; excludedFromEta:boolean; etaForNewCar: number|null; tips?: string };
const etaSummary = ref<EtaSummary[]>([]);
const selectedTypeIds = ref<number[]>([]);
function toggleSelectType(id:number){ const set = new Set(selectedTypeIds.value); if (set.has(id)) set.delete(id); else set.add(id); selectedTypeIds.value = Array.from(set); }
function clearSelectedTypes(){ selectedTypeIds.value = []; }

async function fetchList(){ loading.value = true; try { const data = await http<QueueItem[]>('/queue/list', { method: 'GET' }); list.value = data || []; } finally { loading.value = false; } }
async function fetchEtaSummary(){ try { etaSummary.value = await http<EtaSummary[]>('/queue/eta-summary', { method: 'GET' }); } catch { etaSummary.value = []; } }
async function setCurrent(row: QueueItem, idx: number){ await http(`/queue/${row.id}/set-current`, { method: 'POST', body: { taskIndex: idx } }); const t = row.tasks?.[idx]; ElMessage.success(`已切换到：${t?.name || '当前步骤'}`); fetchList(); }
async function finishTask(row: QueueItem){ const idx = Number(row.currentTaskIndex||0); const t = row.tasks?.[idx]; await http(`/queue/${row.id}/finish-task`, { method: 'POST' }); ElMessage.success(`已完成：${t?.name || '当前步骤'}`); fetchList(); }
async function confirmComplete(row: QueueItem){ await http(`/queue/${row.id}/confirm-complete`, { method: 'POST' }); ElMessage.success('该车辆所有步骤均已完成'); fetchList(); }
async function startFirst(row: QueueItem){ await http(`/queue/${row.id}/start-first`, { method: 'POST' }); const t = row.tasks?.[0]; ElMessage.success(`已开始：${t?.name || '第一步'}`); fetchList(); }
async function removeItem(row: QueueItem){ await http(`/queue/${row.id}`, { method: 'DELETE' }); ElMessage.success('已移出队列'); fetchList(); }
async function markManualPay(row: any, method: 'CASH'|'SHOUQIANBA'|'OFFLINE'){
    try {
        const orderId = Number(row?.orderId||0) || undefined;
        if (!orderId) { ElMessage.error('未找到关联订单'); return; }
        await http(`/orders/${orderId}/pay/manual`, { method: 'POST', body: { method } });
        ElMessage.success('支付已标记');
        fetchList();
    } catch(e:any){ ElMessage.error(String(e?.message||'标记失败')); }
}
async function markWashDeduct(row: any){
    try {
        const orderId = Number(row?.orderId||0) || undefined;
        if (!orderId) { ElMessage.error('未找到关联订单'); return; }
        await http(`/orders/${orderId}/pay/wash-card`, { method: 'POST', body: { } });
        ElMessage.success('洗车卡划扣成功');
        fetchList();
    } catch(e:any){ ElMessage.error(String(e?.message||'划扣失败')); }
}
import { useRouter } from 'vue-router';
const router = useRouter();
function openOrder(row: any){ const id = Number(row?.orderId||0) || undefined; if (!id) { ElMessage.error('未找到订单'); return; } router.push(`/orders/${id}`); }
async function markWxMicropay(row: any){
    try {
        const orderId = Number(row?.orderId||0) || undefined;
        if (!orderId) { ElMessage.error('未找到关联订单'); return; }
        const { value: authCode } = await ElMessageBox.prompt('请扫描顾客微信付款码或手动输入授权码', '微信付款码', { inputPlaceholder: '授权码（条码内容）', confirmButtonText: '提交', cancelButtonText: '取消' }) as any;
        if (!authCode) return;
        await http(`/orders/${orderId}/pay/wx-micropay`, { method: 'POST', body: { authCode } });
        ElMessage.success('微信付款码支付成功');
        fetchList();
    } catch(e:any){ const msg = String(e?.message||'支付失败'); ElMessage.error(msg); }
}

type MemberOption = { id:number; name:string; phone:string };
const memberOptions = ref<MemberOption[]>([]);
const memberVehicles = ref<Array<{ id:number; plateNumber:string; brand?:string; series?:string }>>([]);

type Mode = 'member' | 'existing' | 'guest';
const mode = ref<Mode>('member');
// 直接入队对话框已移除
const dialogVisible = ref(false);
const saving = ref(false);
const form = ref<any>({ memberId: undefined, vehicleId: undefined, plateNumber: '', vin: '', brandId: undefined as number | undefined, seriesId: undefined as number | undefined, typeMain: '', typeSub: '', color: '', existingVehicle: null as any });
const dialogTitle = computed(()=> '');

// 直接入队入口已废弃
function openAdd(m: Mode){ openWizard(); }
type PlateSearchItem = { id:number; plateNumber:string; brand?:string; series?:string; memberId?:number|null; memberName?:string; memberPhone?:string };
async function querySearchPlate(queryString: string, cb: (items: PlateSearchItem[])=>void){
    const kw = String(queryString || '').trim();
    if (!kw) { cb([]); return; }
    try {
        const res = await http<PlateSearchItem[]>(`/vehicle/search`, { method: 'GET', query: { q: kw, limit: 15 } });
        cb(res || []);
    } catch { cb([]); }
}
function onSelectExistingVehicle(item: PlateSearchItem){
    form.value.plateNumber = item.plateNumber;
    form.value.vehicleId = item.id;
    form.value.existingVehicle = item;
}

async function onMemberChange(){
    memberVehicles.value = [];
    if (!form.value.memberId) return;
    const res = await http<any[]>(`/vehicle/member/${form.value.memberId}`, { method: 'GET' });
    memberVehicles.value = res || [];
}

async function onSave(){ /* 直接入队已移除 */ }

async function fetchMemberOptions(){
    const res = await http<{ items: MemberOption[] }>(`/member/list`, { method: 'GET', query: { page: 1, pageSize: 500 } });
    memberOptions.value = res.items || [];
}

onMounted(()=>{ fetchList(); fetchEtaSummary(); fetchMemberOptions(); if (!queueTypes.value.length) loadQueueTypes(); startPolling(); });
const pollTimer = ref<any>(null);
function startPolling(){ if (pollTimer.value) return; pollTimer.value = setInterval(()=>{ fetchList().catch(()=>{}); fetchEtaSummary().catch(()=>{}); }, 8000); }

// 品牌/车系与联动逻辑（复用 MemberVehicles 的简化版本）
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
const typeSubMap: Record<string, string[]> = { '轿车': ['微型车','小型车','紧凑型车','中型车','中大型车','大型车'], 'SUV': ['小型SUV','紧凑型SUV','中型SUV','中大型SUV','大型SUV'], 'MPV': ['小型MPV','紧凑型MPV','中型MPV','中大型MPV','大型MPV'], '卡车': ['轻卡','微卡','皮卡','房车'], '跑车': [] };
const colorOptions = ['黑色','白色','灰色','银色','红色','金色（米/香槟）','蓝色','棕色（褐/咖啡）','紫色','绿色','粉色','黄色','橙色','其他（彩绘/混合）'];
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

function stepStatus(row: QueueItem, index: number, t: Task){
    const doneByIndex = row.currentTaskIndex > index;
    if (doneByIndex || (t.status === 'DONE')) return 'success';
    if (row.currentTaskIndex === index || t.status === 'DOING') return 'process';
    return 'wait';
}

function computeActive(row: QueueItem){
    // 若最后一步已完成，则返回 steps.length 以使所有连接线显示为完成色
    const tasks = Array.isArray(row?.tasks) ? row.tasks : [];
    if (tasks.length > 0) {
        const last = tasks[tasks.length - 1] as any;
        if (String(last?.status || '') === 'DONE') return tasks.length;
    }
    const idx = Number(row?.currentTaskIndex || 0);
    return idx < 0 ? 0 : idx;
}

function computeEtaForNewCar(items: QueueItem[]): number {
    // 基于外观两步(E1=5, E2=5)并行模型：累计所有车辆未完成的外观步骤时长
    let total = 0;
    for (const it of (items || [])) {
        const tasks = Array.isArray(it?.tasks) ? [...it.tasks].sort((a:any,b:any)=>a.orderIndex-b.orderIndex) : [] as any[];
        const idx = Number(it?.currentTaskIndex ?? 0);
        const tE1: any = tasks.find((t:any)=> t.orderIndex === 0);
        const tE2: any = tasks.find((t:any)=> t.orderIndex === 1);
        const e1Dur = Number(tE1?.durationMin ?? 5) || 5;
        const e2Dur = Number(tE2?.durationMin ?? 5) || 5;
        const e1Done = idx > 0 || String(tE1?.status||'') === 'DONE';
        const e2Done = idx > 1 || String(tE2?.status||'') === 'DONE';
        if (!e1Done) total += e1Dur;
        if (!e2Done) total += e2Dur;
    }
    return Math.max(0, Math.round(total));
}

function aheadMinutesModel(index: number): number {
    // 累计 index 之前车辆的未完成外观(E1/E2)时长
    const items = (list.value || []).slice(0, index);
    return computeEtaForNewCar(items as any);
}

function remainingMinutesModel(row: QueueItem): number {
    // 本车剩余：本车未完成的所有任务时长（包含外观与内饰）
    const tasks = Array.isArray(row?.tasks) ? [...row.tasks].sort((a:any,b:any)=>a.orderIndex-b.orderIndex) : [] as any[];
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

function combinedRemainingModel(row: QueueItem, index: number): number {
    // 前方车辆造成的新车等待（仅外观E1/E2）+ 本车自身剩余（全部步骤）
    const waitAhead = aheadMinutesModel(index);
    const selfRemain = remainingMinutesModel(row);
    return Math.max(0, Math.round(waitAhead + selfRemain));
}

// ============ 配置抽屉 ============
const configDrawer = ref(false);
function openConfigDrawer(){ configDrawer.value = true; if (!queueTypes.value.length) loadQueueTypes(); else loadServiceProducts(); }
type QueueType = { id:number; name:string; enabled:boolean; sortWeight:number; remark?:string|null; displayColor?: string|null; participateInEta?: boolean|null; etaParallelSlots?: number|null; etaGroupKey?: string|null; steps: Array<{ id:number; orderIndex:number; name:string; durationMin:number; isEta?: boolean|null }>; products: Array<{ id:number; productId:number }> };
const queueTypes = ref<QueueType[]>([]);
const activeTypeId = ref<number|undefined>(undefined);
const activeType = computed(()=> queueTypes.value.find(t=>t.id===activeTypeId.value));
function syncTypeForm(){ const t = activeType.value; typeForm.value = t ? { id: t.id, name: t.name, enabled: !!t.enabled, sortWeight: Number(t.sortWeight||0), remark: t.remark||'', participateInEta: t.participateInEta ?? null, etaParallelSlots: t.etaParallelSlots ?? null, etaGroupKey: t.etaGroupKey ?? '', displayColor: t.displayColor ?? '' } : { id: undefined, name: '', enabled: true, sortWeight: 100, remark: '', participateInEta: null, etaParallelSlots: null, etaGroupKey: '', displayColor: '' }; }
async function loadQueueTypes(){ const res = await http<QueueType[]>('/queue-types', { method: 'GET' }); queueTypes.value = res||[]; if (!activeTypeId.value && queueTypes.value.length) activeTypeId.value = queueTypes.value[0].id; syncStepEdits(); syncTypeForm(); await loadServiceProducts(); }
function onSelectType(idStr: string){ activeTypeId.value = Number(idStr||0) || undefined; syncStepEdits(); syncTypeForm(); loadTypeProductsSelection(); }

// 步骤编辑
const stepEdits = ref<Array<{ name:string; durationMin:number; isEta?: boolean }>>([]);
function syncStepEdits(){ const t = activeType.value; stepEdits.value = (t?.steps||[]).sort((a,b)=>a.orderIndex-b.orderIndex).map(s=>({ name: s.name, durationMin: s.durationMin, isEta: !!s.isEta })); }
function addStep(){ stepEdits.value.push({ name: '', durationMin: 0 }); }
function moveStep(index: number, delta: number){ const i=index, j=index+delta; if (j<0 || j>=stepEdits.value.length) return; const arr=stepEdits.value; const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; }
function removeStep(index: number){ stepEdits.value.splice(index, 1); }
const savingSteps = ref(false);
async function saveSteps(){ if (!activeType.value) return; savingSteps.value=true; try{ const steps = stepEdits.value.map((s,i)=>({ orderIndex: i, name: s.name.trim(), durationMin: Number(s.durationMin||0), isEta: !!s.isEta })); await http(`/queue-types/${activeType.value.id}/steps`, { method:'PUT', body: { steps } }); ElMessage.success('已保存步骤'); await loadQueueTypes(); } finally { savingSteps.value=false; } }

// 可用商品
const productKeyword = ref('');
const showDisabled = ref(false);
type Product = { id:number; name:string; price:number; enabled:boolean; type:string; imageUrl?: string | null; specType?: string; skus?: Array<{ id:number; name:string; price:number; enabled?: boolean }> };
const serviceProducts = ref<Product[]>([]);
const selectedProductIds = ref<number[]>([]);
const savingRowId = ref<number|null>(null);
function isAllowed(id: number){ const t = activeType.value; if (!t) return false; return (t.products||[]).some((x:any)=> Number(x.productId)===Number(id)); }
async function onToggleAllowed(productId: number, allowed: boolean){ try { savingRowId.value = productId; const t = activeType.value; if (!t) return; const set = new Set<number>((t.products||[]).map((x:any)=>Number(x.productId))); if (allowed) set.add(productId); else set.delete(productId); selectedProductIds.value = Array.from(set); await saveTypeProducts(); } finally { savingRowId.value=null; } }
const serviceTableRef = ref();
function productRowKey(row: { id: number }){ return row.id; }
async function loadServiceProducts(){
    const query:any = { type: 'SERVICE', keyword: productKeyword.value || undefined };
    if (!showDisabled.value) query.enabled = true as any;
    const res = await http<Product[]>(`/store/products`, { method: 'GET', query });
    serviceProducts.value = res||[];
    await loadTypeProductsSelection();
    await nextTick(); try { const table:any = serviceTableRef.value; if (table && table.clearSelection) { table.clearSelection(); } const set = new Set(selectedProductIds.value); for (const row of serviceProducts.value) { if (set.has(row.id)) { try { (serviceTableRef.value as any).toggleRowSelection(row, true); } catch {} } } } catch {}
}
async function loadTypeProductsSelection(){
    const t = activeType.value; if (!t) return;
    const ids = new Set<number>((t.products||[]).map((x:any)=>x.productId));
    const currentIds = new Set<number>((serviceProducts.value||[]).map(p=>p.id));
    selectedProductIds.value = Array.from(ids).filter(id=> showDisabled.value ? true : currentIds.has(id));
}
const savingProducts = ref(false);
async function saveTypeProducts(){
    const t = activeType.value; if (!t) return;
    const enabledSet = new Set<number>(serviceProducts.value.filter(p=>p.enabled).map(p=>p.id));
    const ids = selectedProductIds.value.filter(id=>Number.isFinite(id) && enabledSet.has(id));
    await http(`/queue-types/${t.id}/products`, { method:'PUT', body: { productIds: ids } });
    ElMessage.success('已保存可用商品');
    await loadQueueTypes();
    await nextTick(); try { await loadServiceProducts(); } catch {}
}
function onSelectProducts(rows: any[]){ selectedProductIds.value = rows.map(r=>r.id); }

// 类型增删改
const typeDialogVisible = ref(false);
const savingType = ref(false);
const typeForm = ref<any>({ id: undefined, name: '', enabled: true, sortWeight: 100, remark: '', participateInEta: null as boolean | null, etaParallelSlots: null as number | null, etaGroupKey: '' as string | null, displayColor: '' as string | null });
function openTypeEditor(t?: any){ typeForm.value = t ? { id: t.id, name: t.name, enabled: !!t.enabled, sortWeight: Number(t.sortWeight||0), remark: t.remark||'', participateInEta: t.participateInEta ?? null, etaParallelSlots: t.etaParallelSlots ?? null, etaGroupKey: t.etaGroupKey ?? '', displayColor: t.displayColor ?? '' } : { id: undefined, name: '', enabled: true, sortWeight: 100, remark: '', participateInEta: null, etaParallelSlots: null, etaGroupKey: '', displayColor: '' }; typeDialogVisible.value = true; }
async function saveType(){ if (!typeForm.value.name) { ElMessage.error('请输入名称'); return; } const payload:any = { name: typeForm.value.name, enabled: !!typeForm.value.enabled, sortWeight: Number(typeForm.value.sortWeight||0), remark: typeForm.value.remark||null, participateInEta: typeForm.value.participateInEta, etaParallelSlots: typeForm.value.etaParallelSlots===null?null:Number(typeForm.value.etaParallelSlots||0)||null, etaGroupKey: (String(typeForm.value.etaGroupKey||'').trim()||null), displayColor: (String(typeForm.value.displayColor||'').trim()||null) }; savingType.value = true; try { if (typeForm.value.id) { await http(`/queue-types/${typeForm.value.id}`, { method:'PUT', body: payload }); } else { await http(`/queue-types`, { method:'POST', body: payload }); } ElMessage.success('保存成功'); typeDialogVisible.value=false; await loadQueueTypes(); } finally { savingType.value=false; } }
async function onDeleteType(id: number){ await http(`/queue-types/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await loadQueueTypes(); if (activeTypeId.value===id) activeTypeId.value = queueTypes.value[0]?.id; }

// 阶段二：入队向导（创建订单并入队）
const wizardDrawer = ref(false);
const wizardStep = ref(0);
const wizardQueueTypeId = ref<number|undefined>(undefined);
const wizardAllowedProducts = ref<Product[]>([]);
const wizardSelectedProductIds = ref<number[]>([]);
const wizardSkuByProduct = ref<Record<number, number|undefined>>({});
const wizardSelectedProductNames = computed(()=>{ const map = new Map<number, Product>(wizardAllowedProducts.value.map(p=>[p.id, p] as any)); return (wizardSelectedProductIds.value||[]).map(id=>map.get(id)?.name||'').filter(Boolean); });
function openWizard(){ wizardDrawer.value=true; wizardStep.value=0; wizardQueueTypeId.value = queueTypes.value[0]?.id; }
async function nextWizardFromVehicle(){
    // 基本校验
    if (mode.value === 'member') { if (!form.value.vehicleId) { ElMessage.error('请选择会员车辆'); return; } }
    if (mode.value === 'existing') { if (!form.value.plateNumber && !form.value.vehicleId) { ElMessage.error('请输入或选择车牌'); return; } }
    if (mode.value === 'guest') { if (!form.value.plateNumber || !form.value.typeMain) { ElMessage.error('请完善游客车辆信息'); return; } }
    wizardStep.value = 1;
}
watch(wizardQueueTypeId, async (val)=>{
    if (!val) { wizardAllowedProducts.value = []; return; }
    const t = queueTypes.value.find(t=>t.id===val);
    const ids = new Set<number>((t?.products||[]).map((x:any)=>x.productId));
    if (!ids.size) { wizardAllowedProducts.value = []; return; }
    const list = await http<any[]>(`/store/products`, { method: 'GET', query: { type: 'SERVICE' } as any });
    wizardAllowedProducts.value = (list||[]).filter(p=>ids.has(p.id));
    wizardSelectedProductIds.value = [];
    wizardSkuByProduct.value = {};
});
const submittingOrder = ref(false);
async function submitCreateOrderAndEnqueue(){
    if (!wizardQueueTypeId.value) { ElMessage.error('请选择队列类型'); return; }
    if (!wizardSelectedProductIds.value.length) { ElMessage.error('请选择服务商品'); return; }
    submittingOrder.value = true;
    try {
        // 构造 items，支持多规格
        const items = wizardSelectedProductIds.value.map(pid=>({ productId: pid, skuId: wizardSkuByProduct.value[pid] || null }));
        // 校验多规格商品必须选择 SKU
        for (const p of wizardAllowedProducts.value) {
            if (String((p as any)?.specType||'')==='MULTI' && wizardSelectedProductIds.value.includes(p.id)){
                const sid = wizardSkuByProduct.value[p.id];
                if (!sid) { ElMessage.error(`请选择规格：${p.name}`); submittingOrder.value=false; return; }
            }
        }
        const body: any = { queueTypeId: wizardQueueTypeId.value, items };
        if (form.value.vehicleId) body.vehicleId = form.value.vehicleId; else body.plateNumber = form.value.plateNumber;
        if (mode.value === 'guest') Object.assign(body, { vin: form.value.vin||undefined, brandId: form.value.brandId||undefined, seriesId: form.value.seriesId||undefined, brand: form.value.brandName||undefined, series: form.value.seriesName||undefined, typeMain: form.value.typeMain, typeSub: form.value.typeSub||undefined, color: form.value.color||undefined });
        const res = await http<any>('/queue/create-service-order-and-enqueue', { method: 'POST', body });
        ElMessage.success('已创建订单并入队');
        wizardDrawer.value=false; wizardStep.value=0; await fetchList();
    } finally { submittingOrder.value=false; }
}

const selectedPlate = computed(()=>{
    if (mode.value === 'member') {
        const v = memberVehicles.value.find(v=>v.id === form.value.vehicleId);
        if (v?.plateNumber) return v.plateNumber;
    }
    if (mode.value === 'existing' && form.value.existingVehicle?.plateNumber) return form.value.existingVehicle.plateNumber;
    return form.value.plateNumber || '-';
});

function onWizardSelectionChange(rows: any[]){
    wizardSelectedProductIds.value = Array.isArray(rows) ? rows.map((r:any)=>r.id) : [];
}

function skuLabel(s: any){ try{ const p = Number(s?.price||0); return p>0 ? `${s?.name||''}（￥${p.toFixed(2)}）` : String(s?.name||''); }catch{ return String(s?.name||''); } }
function skuPriceHint(row: any){ try{ const arr = Array.isArray(row?.skus)?row.skus:[]; if(!arr.length) return '-'; const prices = arr.map((x:any)=>Number(x?.price||0)).filter((n:number)=>Number.isFinite(n)); if(!prices.length) return '-'; const min = Math.min(...prices); const max = Math.max(...prices); return min===max ? `￥${min.toFixed(2)}` : `￥${min.toFixed(2)} ~ ￥${max.toFixed(2)}`; }catch{ return '-'; } }
function skuNameById(pid: number, sid: number){ try{ const p = wizardAllowedProducts.value.find(x=>x.id===pid) as any; const s = (p?.skus||[]).find((y:any)=>Number(y.id)===Number(sid)); return s?.name || '-'; }catch{ return '-'; } }

// 订单支付复用弹窗
const showPay = ref(false);
const currentOrderId = ref<number|null>(null);
const payMethod = ref<'CASH'|'SHOUQIANBA'|'OFFLINE'>('CASH');
const payTab = ref<'manual'|'wx'|'wash'|'group'>('manual');
const wxAuthCode = ref('');
const wxPayLoading = ref(false);
const showScan = ref(false);
const videoRef = ref<HTMLVideoElement|null>(null);
const canvasRef = ref<HTMLCanvasElement|null>(null);
let mediaStream: MediaStream | null = null;
let scanTimer: any = null;
// 收银立减
const orderForPay = ref<any>(null);
const cashierDiscountInput = ref<number>(0);
const payAmountCap = computed(()=>{
    try{
        const o:any = orderForPay.value; if (!o) return 0;
        const total = Number(o.totalAmount||0);
        const discount = Number(o.discountAmount||0);
        const cashierPrev = Number(o.cashierDiscountAmount||0);
        const base = Math.max(0, Number((total - (discount - cashierPrev)).toFixed(2)));
        return base;
    }catch{ return 0; }
});
const payAmountAfterManual = computed(()=>{
    try{
        const o:any = orderForPay.value; if (!o) return 0;
        const shipping = Number(o.shippingFee||0);
        const points = Number(o.pointsAmount||0);
        const manual = Math.max(0, Number(cashierDiscountInput.value||0));
        const baseBeforeCashier = payAmountCap.value;
        const pay = Math.max(0, Number((baseBeforeCashier - manual + shipping - points).toFixed(2)));
        return pay;
    }catch{ return 0; }
});
function onManualDiscountChange(){
    try{
        let v = Number(cashierDiscountInput.value||0);
        if (!Number.isFinite(v) || v < 0) v = 0;
        const cap = Number(payAmountCap.value||0);
        cashierDiscountInput.value = Number(Math.min(cap, v).toFixed(2));
    }catch{}
}
const washPrefer = ref<'AUTO'|'GROUP'|'MEMBER'>('AUTO');
const canGroupBalance = ref(false);
const groupPayLoading = ref(false);

async function openPay(row:any){
    currentOrderId.value = Number(row?.orderId||0)||null;
    payMethod.value='CASH'; payTab.value='manual'; washPrefer.value='AUTO'; wxAuthCode.value='';
    canGroupBalance.value = false;
    try{
        const id = currentOrderId.value;
        if (id){ const ord:any = await http(`/orders/${id}`); orderForPay.value = ord||null; cashierDiscountInput.value = Math.max(0, Number(ord?.cashierDiscountAmount||0)) || 0; canGroupBalance.value = String(ord?.type||'').toUpperCase()==='SERVICE' && !!ord?.groupId && String(ord?.payStatus||'')==='UNPAID'; }
    }catch{ orderForPay.value=null; cashierDiscountInput.value=0; canGroupBalance.value = false; }
    showPay.value = true;
}
async function doMarkPaid(){ try { const id = currentOrderId.value; if(!id){ ElMessage.error('未找到关联订单'); return; } try{ await http(`/orders/${id}/adjust-cashier-discount`, { method:'POST', body: { amount: Number(cashierDiscountInput.value||0) } }); }catch{} await http(`/orders/${id}/pay/manual`, { method:'POST', body: { method: payMethod.value } }); ElMessage.success('已标记为已支付'); showPay.value=false; await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'操作失败')); } }
async function doWxMicropay(){ try { const id=currentOrderId.value; if(!id){ ElMessage.error('未找到关联订单'); return; } const code = String(wxAuthCode.value||'').trim(); if (!/^\d{18,24}$/.test(code)){ ElMessage.error('请输入有效的微信付款码（18-24位数字）'); return; } wxPayLoading.value=true; try{ await http(`/orders/${id}/adjust-cashier-discount`, { method:'POST', body: { amount: Number(cashierDiscountInput.value||0) } }); }catch{} await http(`/orders/${id}/pay/wx-micropay`, { method:'POST', body: { authCode: code } }); ElMessage.success('付款成功，已标记订单为已支付'); showPay.value=false; wxAuthCode.value=''; await fetchList(); } catch(e:any){ ElMessage.error(String(e?.message||e||'付款失败')); } finally { wxPayLoading.value=false; } }
async function doWashDeduct(){ try{ const id = currentOrderId.value; if(!id){ ElMessage.error('未找到关联订单'); return; } const ord:any = await http(`/orders/${id}`); if (String(ord?.type||'').toUpperCase()!=='SERVICE'){ ElMessage.error('仅服务订单可使用洗车卡划扣'); return; } const prefer = washPrefer.value==='AUTO'?undefined:washPrefer.value; const ret:any = await http(`/orders/${id}/pay/wash-card`, { method:'POST', body: { prefer } }); const plan = Array.isArray(ret?.plan)?ret.plan:[]; const times = Number(ret?.requiredTimes||0); ElMessage.success(`划扣成功：扣${times}次，使用${plan.length}张卡`); showPay.value=false; await fetchList(); }catch(e:any){ ElMessage.error(String(e?.message||e||'划扣失败')); } }
async function doGroupBalance(){
    try{
        const id = currentOrderId.value; if(!id){ ElMessage.error('未找到关联订单'); return; }
        if (!canGroupBalance.value){ ElMessage.error('仅集团服务订单可使用集团余额支付'); return; }
        groupPayLoading.value = true;
        await http(`/orders/${id}/pay/group-balance`, { method:'POST' });
        ElMessage.success('集团余额支付成功');
        showPay.value = false;
        await fetchList();
    }catch(e:any){ ElMessage.error(String(e?.message||e||'支付失败')); }
    finally{ groupPayLoading.value = false; }
}

async function openScan(){ try{ showScan.value=true; await nextTick(); if(!videoRef.value) return; mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); videoRef.value.srcObject = mediaStream as any; await videoRef.value.play(); startDecodeLoop(); } catch(e:any){ ElMessage.error('无法打开摄像头：' + String(e?.message||e||'')); showScan.value=false; } }
function stopScan(){ try{ if (scanTimer){ clearInterval(scanTimer); scanTimer=null; } }catch{} try{ if (videoRef.value){ videoRef.value.pause(); (videoRef.value as any).srcObject = null; } }catch{} try{ if (mediaStream){ mediaStream.getTracks().forEach(t=> t.stop()); mediaStream=null; } }catch{} }
function startDecodeLoop(){ const reader = new BrowserMultiFormatReader(); scanTimer = setInterval(async()=>{ try{ if(!videoRef.value||!canvasRef.value) return; const v = videoRef.value; const c = canvasRef.value; const w=v.videoWidth, h=v.videoHeight; if(!w||!h) return; c.width=w; c.height=h; const ctx=c.getContext('2d'); if(!ctx) return; ctx.drawImage(v,0,0,w,h); const res = await reader.decodeFromImage(undefined as any, c.toDataURL('image/png')); const text = String((res as any)?.getText?.()).trim(); if (/^\d{18,24}$/.test(text)){ wxAuthCode.value=text; ElMessage.success('识别成功'); showScan.value=false; stopScan(); } }catch(err){ if (!(err instanceof NotFoundException)) { /* ignore */ } } }, 500); }
async function onSelectImage(file:any){ try{ const f = file?.raw || file?.target?.files?.[0]; if(!f) return; const reader = new FileReader(); reader.onload = async ()=>{ try{ const img = new Image(); img.onload = async ()=>{ const c=document.createElement('canvas'); c.width=img.width; c.height=img.height; const ctx=c.getContext('2d'); if(!ctx) return; ctx.drawImage(img,0,0); const br=new BrowserMultiFormatReader(); const res=await br.decodeFromImage(undefined as any, c.toDataURL('image/png')); const text=String((res as any)?.getText?.()).trim(); if (/^\d{18,24}$/.test(text)){ wxAuthCode.value=text; ElMessage.success('识别成功'); } else { ElMessage.error('未检测到有效付款码'); } }; img.onerror=()=> ElMessage.error('图片读取失败'); img.src=String(reader.result||''); }catch{ ElMessage.error('识别失败'); } }; reader.onerror=()=> ElMessage.error('图片读取失败'); reader.readAsDataURL(f); }catch{ ElMessage.error('识别失败'); } }
</script>

<style scoped>
.el-tag { min-width: 40px; text-align: center; }
.letter-bar { display:flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.letter { font-size: 12px; padding: 4px 6px; border-radius: 4px; cursor: pointer; color: #666; }
.letter.active { background:#ecf5ff; color:#409EFF; }
.brand-option { display:flex; align-items:center; gap:8px; }
.brand-logo { width:18px; height:18px; object-fit:contain; border-radius:2px; }
.brand-logo.prefix { margin-right:6px; }
.brand-text { line-height:18px; }
/* 让步骤在单元格内稳定布局并可换行 */
.steps-cell { display:block; width:100%; overflow:visible; }
.steps-cell :deep(.el-steps) { width:100%; }
.steps-cell :deep(.el-step__main) { white-space:normal; }
.steps-cell :deep(.el-step__title) { white-space:normal; }
.steps-cell :deep(.el-step__description) { white-space:normal; }
/* 进行中颜色改为蓝色 */
.steps-cell :deep(.el-step__head.is-process) { color: var(--app-primary); border-color: var(--app-primary); }
.steps-cell :deep(.el-step__title.is-process) { color: var(--app-primary); }
.steps-cell :deep(.el-step__description.is-process) { color: var(--app-primary); }
/* 修复表格只显示一行：确保表格容器允许高度自适应 */
/* 避免强行修改表格内部高度，恢复默认滚动与渲染 */
</style>


