<template>
	<BasePage title="服务队列">
		<template #actions>
			<div style="display:flex; align-items:center; gap:8px;">
				<el-input v-model="searchPlate" placeholder="按车牌快速定位" style="width:220px;" clearable />
				<el-tag type="success">新车预计等待：{{ etaForNewCar }} 分钟</el-tag>
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
								<el-tag :type="row.guest ? 'warning' : 'danger'" style="margin-right:6px;">{{ row.guest ? '游客' : '会员' }}</el-tag>
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
			<el-table-column label="当前流程" min-width="320">
				<template #default="{ row }">
						<div class="steps-cell">
							<el-steps :active="computeActive(row)" :process-status="row.currentTaskIndex < 0 ? 'wait' : 'process'" finish-status="success">
							<el-step v-for="(t,i) in row.tasks" :key="t.id" :title="t.name" :description="`${t.durationMin}分钟`" :status="stepStatus(row, i, t)" />
						</el-steps>
						</div>
				</template>
			</el-table-column>
			<el-table-column label="排队/剩余" width="260">
				<template #default="{ row, $index }">
					<div>前方：{{ $index }} 辆 ≈ {{ aheadMinutesModel($index) }} 分钟</div>
					<div>本车剩余：≈ {{ combinedRemainingModel(row, $index) }} 分钟</div>
				</template>
			</el-table-column>
			<el-table-column label="操作" width="520" fixed="right">
				<template #default="{ row }">
					<el-button v-if="row.currentTaskIndex < 0" size="small" type="primary" style="margin-right:8px;" @click="startFirst(row)"><el-icon><VideoPlay /></el-icon><span>开始 {{ row?.tasks?.[0]?.name || '第一步' }}</span></el-button>
					<el-select v-model="row.currentTaskIndex" placeholder="切换流程" style="width:160px;margin-right:8px;" :disabled="row.currentTaskIndex < 0" @change="(i:number)=>setCurrent(row, i)">
						<el-option v-for="(t,i) in row.tasks" :key="t.id" :label="`${i+1}.${t.name}`" :value="i" />
					</el-select>
					<el-button size="small" type="success" :disabled="row.currentTaskIndex < 0" @click="finishTask(row)"><el-icon><SuccessFilled /></el-icon><span>完成当前</span></el-button>
					<el-popconfirm title="确认结束服务并移出队列？" @confirm="confirmComplete(row)">
						<template #reference>
							<el-button size="small" type="danger" :disabled="row.currentTaskIndex < 0"><el-icon><SwitchButton /></el-icon><span>结束</span></el-button>
						</template>
					</el-popconfirm>
					<el-popconfirm title="确认移出队列？" @confirm="removeItem(row)" v-if="row.status!=='COMPLETED'">
						<template #reference>
							<el-button size="small" type="warning" plain style="margin-left:8px;">移出</el-button>
						</template>
					</el-popconfirm>
					<template v-if="row.status==='COMPLETED'">
						<el-tag type="warning" effect="plain" style="margin-left:8px;">待支付</el-tag>
						<el-dropdown style="margin-left:8px;">
							<el-button size="small" type="primary">标记支付</el-button>
							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item @click="markManualPay(row, 'CASH')">现金</el-dropdown-item>
									<el-dropdown-item @click="markManualPay(row, 'SHOUQIANBA')">收钱吧</el-dropdown-item>
									<el-dropdown-item @click="markManualPay(row, 'OFFLINE')">线下记账</el-dropdown-item>
									<el-dropdown-item divided @click="markWxMicropay(row)">微信付款码</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
						<el-button size="small" link @click="openOrder(row)">查看订单</el-button>
					</template>
				</template>
			</el-table-column>
		</el-table>

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
								<el-table-column label="步骤名" min-width="200">
									<template #default="{ row }"><el-input v-model="row.name" placeholder="步骤名称（≤20字）" /></template>
								</el-table-column>
								<el-table-column label="时长(分钟)" width="140">
									<template #default="{ row }"><el-input-number v-model="row.durationMin" :min="0" :max="120" /></template>
								</el-table-column>
								<el-table-column label="操作" width="140">
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
						<el-card header="可用服务商品" shadow="never">
							<div style="display:flex; gap:8px; margin-bottom:8px;">
								<el-input v-model="productKeyword" placeholder="搜索商品" clearable style="width:260px;" />
								<el-button size="small" @click="loadServiceProducts">搜索</el-button>
							</div>
							<el-table ref="serviceTableRef" :data="serviceProducts" size="small" height="260" @selection-change="onSelectProducts" :row-key="productRowKey">
								<el-table-column type="selection" width="50" :selectable="spSelectable" />
								<el-table-column prop="name" label="商品" min-width="260" />
								<el-table-column prop="price" label="价格" width="120" />
								<el-table-column prop="enabled" label="状态" width="100">
									<template #default="{ row }"><el-tag :type="row.enabled ? 'success':'info'">{{ row.enabled?'启用':'停用' }}</el-tag></template>
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
				<el-table :data="wizardAllowedProducts" size="small" height="300" @selection-change="(rows:any[])=>{ wizardSelectedProductIds = rows.map(r=>r.id) }">
					<el-table-column type="selection" width="50" />
					<el-table-column prop="name" label="商品" min-width="260" />
					<el-table-column prop="price" label="价格" width="120" />
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
					<el-descriptions-item label="车牌">{{ form.plateNumber || (form.existingVehicle?.plateNumber) || '-' }}</el-descriptions-item>
					<el-descriptions-item label="队列类型">{{ (queueTypes.find(t=>t.id===wizardQueueTypeId)||{} as any).name || '-' }}</el-descriptions-item>
					<el-descriptions-item label="服务商品">{{ wizardSelectedProductNames.join('、') || '-' }}</el-descriptions-item>
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

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });
function rowKey(row: { id: number }){ return row.id; }
function toAbs(u?: string | null){ return absUrl(u || ''); }

type Task = { id:number; name:string; durationMin:number; status?: string };
type QueueItem = { id:number; plateNumber:string; guest:boolean; status?: string; orderId?: number|null; currentTaskIndex:number; tasks: Task[]; aheadCount:number; aheadMinutes:number; remainingMinutes:number; vehicle?: { id:number; brand?:string|null; series?:string|null; brandImage?:string|null; member?: { name?: string|null; phone?: string|null } } };
const list = ref<QueueItem[]>([]);
const loading = ref(false);
const searchPlate = ref('');

const filtered = computed(()=>{
    const kw = searchPlate.value.trim().toUpperCase();
    if (!kw) return list.value;
    return list.value.filter(x => String(x.plateNumber||'').toUpperCase().includes(kw));
});

const etaForNewCar = computed(()=> computeEtaForNewCar(list.value));

async function fetchList(){ loading.value = true; try { list.value = await http<QueueItem[]>('/queue/list', { method: 'GET' }); } finally { loading.value = false; } }
async function setCurrent(row: QueueItem, idx: number){ await http(`/queue/${row.id}/set-current`, { method: 'POST', body: { taskIndex: idx } }); ElMessage.success('已切换流程'); fetchList(); }
async function finishTask(row: QueueItem){ await http(`/queue/${row.id}/finish-task`, { method: 'POST' }); ElMessage.success('已完成当前流程'); fetchList(); }
async function confirmComplete(row: QueueItem){ await http(`/queue/${row.id}/confirm-complete`, { method: 'POST' }); ElMessage.success('已结束服务'); fetchList(); }
async function startFirst(row: QueueItem){ await http(`/queue/${row.id}/start-first`, { method: 'POST' }); ElMessage.success('已开始外表清洗 I'); fetchList(); }
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

onMounted(()=>{ fetchList(); fetchMemberOptions(); if (!queueTypes.value.length) loadQueueTypes(); startPolling(); });
const pollTimer = ref<any>(null);
function startPolling(){ if (pollTimer.value) return; pollTimer.value = setInterval(()=>{ fetchList().catch(()=>{}); }, 8000); }

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
function openConfigDrawer(){ configDrawer.value = true; if (!queueTypes.value.length) loadQueueTypes(); }
type QueueType = { id:number; name:string; enabled:boolean; sortWeight:number; remark?:string|null; steps: Array<{ id:number; orderIndex:number; name:string; durationMin:number }>; products: Array<{ id:number; productId:number }> };
const queueTypes = ref<QueueType[]>([]);
const activeTypeId = ref<number|undefined>(undefined);
const activeType = computed(()=> queueTypes.value.find(t=>t.id===activeTypeId.value));
async function loadQueueTypes(){ const res = await http<QueueType[]>('/queue-types', { method: 'GET' }); queueTypes.value = res||[]; if (!activeTypeId.value && queueTypes.value.length) activeTypeId.value = queueTypes.value[0].id; syncStepEdits(); loadTypeProductsSelection(); }
function onSelectType(idStr: string){ activeTypeId.value = Number(idStr||0) || undefined; syncStepEdits(); loadTypeProductsSelection(); }

// 步骤编辑
const stepEdits = ref<Array<{ name:string; durationMin:number }>>([]);
function syncStepEdits(){ const t = activeType.value; stepEdits.value = (t?.steps||[]).sort((a,b)=>a.orderIndex-b.orderIndex).map(s=>({ name: s.name, durationMin: s.durationMin })); }
function addStep(){ stepEdits.value.push({ name: '', durationMin: 0 }); }
function moveStep(index: number, delta: number){ const i=index, j=index+delta; if (j<0 || j>=stepEdits.value.length) return; const arr=stepEdits.value; const tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; }
function removeStep(index: number){ stepEdits.value.splice(index, 1); }
const savingSteps = ref(false);
async function saveSteps(){ if (!activeType.value) return; savingSteps.value=true; try{ const steps = stepEdits.value.map((s,i)=>({ orderIndex: i, name: s.name.trim(), durationMin: Number(s.durationMin||0) })); await http(`/queue-types/${activeType.value.id}/steps`, { method:'PUT', body: { steps } }); ElMessage.success('已保存步骤'); await loadQueueTypes(); } finally { savingSteps.value=false; } }

// 可用商品
const productKeyword = ref('');
type Product = { id:number; name:string; price:number; enabled:boolean; type:string };
const serviceProducts = ref<Product[]>([]);
const selectedProductIds = ref<number[]>([]);
function spSelectable(row: Product){ return String(row.type||'') === 'SERVICE'; }
const serviceTableRef = ref();
function productRowKey(row: { id: number }){ return row.id; }
async function loadServiceProducts(){ const res = await http<Product[]>(`/store/products`, { method: 'GET', query: { type: 'SERVICE', keyword: productKeyword.value || undefined, enabled: true } as any }); serviceProducts.value = res||[]; await loadTypeProductsSelection(); await nextTick(); try { const table:any = serviceTableRef.value; if (table && table.clearSelection) { table.clearSelection(); } const set = new Set(selectedProductIds.value); for (const row of serviceProducts.value) { if (set.has(row.id)) { try { serviceTableRef.value!.toggleRowSelection(row, true); } catch {} } } } catch {} }
async function loadTypeProductsSelection(){ const t = activeType.value; if (!t) return; const ids = new Set<number>((t.products||[]).map((x:any)=>x.productId)); selectedProductIds.value = Array.from(ids); }
const savingProducts = ref(false);
async function saveTypeProducts(){ const t = activeType.value; if (!t) return; const ids = selectedProductIds.value.filter(id=>Number.isFinite(id)); await http(`/queue-types/${t.id}/products`, { method:'PUT', body: { productIds: ids } }); ElMessage.success('已保存可用商品'); await loadQueueTypes(); await nextTick(); try { await loadServiceProducts(); } catch {} }
function onSelectProducts(rows: any[]){ selectedProductIds.value = rows.map(r=>r.id); }

// 类型增删改
const typeDialogVisible = ref(false);
const savingType = ref(false);
const typeForm = ref<any>({ id: undefined, name: '', enabled: true, sortWeight: 100, remark: '' });
function openTypeEditor(t?: any){ typeForm.value = t ? { id: t.id, name: t.name, enabled: !!t.enabled, sortWeight: Number(t.sortWeight||0), remark: t.remark||'' } : { id: undefined, name: '', enabled: true, sortWeight: 100, remark: '' }; typeDialogVisible.value = true; }
async function saveType(){ if (!typeForm.value.name) { ElMessage.error('请输入名称'); return; } savingType.value = true; try { if (typeForm.value.id) { await http(`/queue-types/${typeForm.value.id}`, { method:'PUT', body: { name: typeForm.value.name, enabled: !!typeForm.value.enabled, sortWeight: Number(typeForm.value.sortWeight||0), remark: typeForm.value.remark||null } }); } else { await http(`/queue-types`, { method:'POST', body: { name: typeForm.value.name, enabled: !!typeForm.value.enabled, sortWeight: Number(typeForm.value.sortWeight||0), remark: typeForm.value.remark||null } }); } ElMessage.success('保存成功'); typeDialogVisible.value=false; await loadQueueTypes(); } finally { savingType.value=false; } }
async function onDeleteType(id: number){ await http(`/queue-types/${id}`, { method:'DELETE' }); ElMessage.success('已删除'); await loadQueueTypes(); if (activeTypeId.value===id) activeTypeId.value = queueTypes.value[0]?.id; }

// 阶段二：入队向导（创建订单并入队）
const wizardDrawer = ref(false);
const wizardStep = ref(0);
const wizardQueueTypeId = ref<number|undefined>(undefined);
const wizardAllowedProducts = ref<Product[]>([]);
let wizardSelectedProductIds: number[] = [];
const wizardSelectedProductNames = computed(()=>{ const map = new Map<number, Product>(wizardAllowedProducts.value.map(p=>[p.id, p] as any)); return wizardSelectedProductIds.map(id=>map.get(id)?.name||'').filter(Boolean); });
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
    const list = await http<Product[]>(`/store/products`, { method: 'GET', query: { type: 'SERVICE' } as any });
    wizardAllowedProducts.value = (list||[]).filter(p=>ids.has(p.id));
});
const submittingOrder = ref(false);
async function submitCreateOrderAndEnqueue(){
    if (!wizardQueueTypeId.value) { ElMessage.error('请选择队列类型'); return; }
    if (!wizardSelectedProductIds.length) { ElMessage.error('请选择服务商品'); return; }
    submittingOrder.value = true;
    try {
        const body: any = { queueTypeId: wizardQueueTypeId.value, productIds: wizardSelectedProductIds };
        if (form.value.vehicleId) body.vehicleId = form.value.vehicleId; else body.plateNumber = form.value.plateNumber;
        if (mode.value === 'guest') Object.assign(body, { vin: form.value.vin||undefined, brandId: form.value.brandId||undefined, seriesId: form.value.seriesId||undefined, brand: form.value.brandName||undefined, series: form.value.seriesName||undefined, typeMain: form.value.typeMain, typeSub: form.value.typeSub||undefined, color: form.value.color||undefined });
        const res = await http<any>('/queue/create-service-order-and-enqueue', { method: 'POST', body });
        ElMessage.success('已创建订单并入队');
        wizardDrawer.value=false; wizardStep.value=0; await fetchList();
    } finally { submittingOrder.value=false; }
}
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


