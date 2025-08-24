<template>
	<BasePage title="服务队列">
		<template #actions>
			<el-input v-model="searchPlate" placeholder="按车牌快速定位" style="width:220px;margin-right:8px;" />
			<el-tag type="success" style="margin-right:8px;">新车预计等待：{{ etaForNewCar }} 分钟</el-tag>
			<el-dropdown>
				<el-button type="primary">添加车辆</el-button>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item @click="openAdd('member')">根据会员选择车辆</el-dropdown-item>
						<el-dropdown-item @click="openAdd('existing')">按车牌搜索现有车辆</el-dropdown-item>
						<el-dropdown-item divided @click="openAdd('guest')">手动录入游客车辆</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</template>

		<el-table :data="filtered" stripe style="width:100%">
			<el-table-column type="index" label="#" width="60" />
			<el-table-column prop="vehicle" label="车辆" min-width="260">
				<template #default="{ row }">
					<div style="display:flex; align-items:center; gap:10px;">
						<img v-if="row?.vehicle?.brandImage" :src="toAbs(row.vehicle.brandImage)" style="width:24px;height:24px;object-fit:contain;border-radius:4px; border:1px solid #eee;" />
						<div style="display:flex; flex-direction:column;">
							<div>
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
							<el-step v-for="(t,i) in row.tasks" :key="t.id" :title="t.name" :description="`${t.durationMin}分钟`" />
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
			<el-table-column label="操作" width="360">
				<template #default="{ row }">
					<el-button v-if="row.currentTaskIndex < 0" size="small" type="primary" style="margin-right:8px;" @click="startFirst(row)">开始外表清洗 I</el-button>
					<el-select v-model="row.currentTaskIndex" placeholder="切换流程" style="width:160px;margin-right:8px;" :disabled="row.currentTaskIndex < 0" @change="(i:number)=>setCurrent(row, i)">
						<el-option v-for="(t,i) in row.tasks" :key="t.id" :label="`${i+1}.${t.name}`" :value="i" />
					</el-select>
					<el-button size="small" type="success" :disabled="row.currentTaskIndex < 0" @click="finishTask(row)">完成当前</el-button>
					<el-popconfirm title="确认结束服务并移出队列？" @confirm="confirmComplete(row)">
						<template #reference>
							<el-button size="small" type="danger" :disabled="row.currentTaskIndex < 0">结束</el-button>
						</template>
					</el-popconfirm>
				</template>
			</el-table-column>
		</el-table>

		<el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px">
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
					<el-autocomplete v-if="mode==='existing'" v-model="form.plateNumber" :fetch-suggestions="querySearchPlate" placeholder="输入车牌支持模糊搜索" value-key="plateNumber" @select="onSelectExistingVehicle" style="width:100%">
						<template #default="{ item }">
							<div style="display:flex;justify-content:space-between;align-items:center;width:100%">
								<div>
									<strong>{{ item.plateNumber }}</strong>
									<span style="margin-left:8px;color:#909399;">{{ item.brand }}/{{ item.series }}</span>
								</div>
								<div v-if="item.memberName || item.memberPhone" style="color:#606266;">
									{{ item.memberName||'-' }}（{{ item.memberPhone||'-' }}）
								</div>
							</div>
						</template>
					</el-autocomplete>
					<el-input v-else v-model="form.plateNumber" placeholder="例如 川A12345" />
				</el-form-item>
				<el-form-item v-if="mode==='guest'" label="VIN"><el-input v-model="form.vin" placeholder="17位 VIN（可选）" /></el-form-item>
				<!-- 品牌选择（与车辆新增一致） -->
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
				<!-- 车系选择 -->
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
			<template #footer>
				<el-button @click="dialogVisible=false">取消</el-button>
				<el-button type="primary" :loading="saving" @click="onSave">确认添加</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { ElMessage, ElMessageBox } from 'element-plus';

const http = createHttpClient({ baseUrl: 'http://localhost:3000', getToken: () => localStorage.getItem('token') || undefined });
function toAbs(u?: string | null){ if (!u) return ''; if (/^https?:\/\//i.test(String(u))) return String(u); return `http://localhost:3000${String(u).startsWith('/')?u:('/'+u)}`; }

type Task = { id:number; name:string; durationMin:number; status?: string };
type QueueItem = { id:number; plateNumber:string; guest:boolean; currentTaskIndex:number; tasks: Task[]; aheadCount:number; aheadMinutes:number; remainingMinutes:number; vehicle?: { id:number; brand?:string|null; series?:string|null; brandImage?:string|null; member?: { name?: string|null; phone?: string|null } } };
const list = ref<QueueItem[]>([]);
const loading = ref(false);
const searchPlate = ref('');

const filtered = computed(()=>{
    const kw = searchPlate.value.trim();
    if (!kw) return list.value;
    return list.value.filter(x => x.plateNumber.includes(kw));
});

const etaForNewCar = computed(()=> computeEtaForNewCar(list.value));

async function fetchList(){ loading.value = true; try { list.value = await http<QueueItem[]>('/queue/list', { method: 'GET' }); } finally { loading.value = false; } }
async function setCurrent(row: QueueItem, idx: number){ await http(`/queue/${row.id}/set-current`, { method: 'POST', body: { taskIndex: idx } }); ElMessage.success('已切换流程'); fetchList(); }
async function finishTask(row: QueueItem){ await http(`/queue/${row.id}/finish-task`, { method: 'POST' }); ElMessage.success('已完成当前流程'); fetchList(); }
async function confirmComplete(row: QueueItem){ await http(`/queue/${row.id}/confirm-complete`, { method: 'POST' }); ElMessage.success('已结束服务'); fetchList(); }
async function startFirst(row: QueueItem){ await http(`/queue/${row.id}/start-first`, { method: 'POST' }); ElMessage.success('已开始外表清洗 I'); fetchList(); }

type MemberOption = { id:number; name:string; phone:string };
const memberOptions = ref<MemberOption[]>([]);
const memberVehicles = ref<Array<{ id:number; plateNumber:string; brand?:string; series?:string }>>([]);

type Mode = 'member' | 'existing' | 'guest';
const mode = ref<Mode>('member');
const dialogVisible = ref(false);
const saving = ref(false);
const form = ref<any>({ memberId: undefined, vehicleId: undefined, plateNumber: '', vin: '', brandId: undefined as number | undefined, seriesId: undefined as number | undefined, typeMain: '', typeSub: '', color: '', existingVehicle: null as any });
const dialogTitle = computed(()=> mode.value==='member' ? '根据会员选择车辆' : mode.value==='existing' ? '按车牌搜索现有车辆' : '手动录入游客车辆');

function openAdd(m: Mode){ mode.value = m; form.value = { memberId: undefined, vehicleId: undefined, plateNumber: '', typeMain: '', typeSub: '', color: '' }; dialogVisible.value = true; }
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

async function onSave(){
    saving.value = true;
    try {
        if (mode.value === 'member') {
            if (!form.value.vehicleId) { ElMessage.error('请选择车辆'); return; }
            // 重复检测（前置），避免重复添加
            const exists = (filtered.value || []).some(it => it.vehicle?.id === form.value.vehicleId);
            if (exists) { ElMessage.warning('该车辆已在队列中'); return; }
            await http('/queue/add', { method: 'POST', body: { mode: 'vehicleId', vehicleId: form.value.vehicleId } });
        } else if (mode.value === 'existing') {
            if (!form.value.plateNumber) { ElMessage.error('请输入车牌号'); return; }
            // 优先使用选择的 vehicleId，避免同牌不同车误差
            if (form.value.vehicleId) {
                const exists = (filtered.value || []).some(it => it.vehicle?.id === form.value.vehicleId);
                if (exists) { ElMessage.warning('该车辆已在队列中'); return; }
                await http('/queue/add', { method: 'POST', body: { mode: 'vehicleId', vehicleId: form.value.vehicleId } });
            } else {
                const exists = (filtered.value || []).some(it => String(it.plateNumber||'').toUpperCase() === String(form.value.plateNumber||'').toUpperCase());
                if (exists) { ElMessage.warning('该车辆已在队列中'); return; }
                try {
                    await http('/queue/add', { method: 'POST', body: { mode: 'plateExisting', plateNumber: form.value.plateNumber } });
                } catch (e:any) {
                    const msg = String(e?.message || '');
                    if (/未找到该车牌对应的车辆/.test(msg)) {
                        try {
                            await ElMessageBox.confirm(`未找到车牌“${form.value.plateNumber}”。是否新建为游客车辆？`, '提示', { confirmButtonText: '新建游客车辆', cancelButtonText: '取消', type: 'warning' });
                            // 切换到游客录入并保留车牌
                            mode.value = 'guest';
                            form.value = { ...form.value, vehicleId: undefined, vin: '', brandId: undefined, seriesId: undefined, brandName: '', seriesName: '', typeMain: '', typeSub: '', color: '' };
                            return; // 不关闭弹窗，等待用户继续填写
                        } catch {
                            // 用户取消
                            return;
                        }
                    }
                    // 其他错误按原规则提示
                    ElMessage.error(msg.replace(/^HTTP\s+\d+[^:]*:\s*/, '').slice(0, 60) || '添加失败');
                    return;
                }
            }
        } else {
            if (!form.value.plateNumber) { ElMessage.error('请输入车牌号'); return; }
            if (!form.value.typeMain) { ElMessage.error('请选择车辆主类'); return; }
            const payload = { mode: 'guest', plateNumber: form.value.plateNumber, vin: form.value.vin || undefined, brandId: form.value.brandId || undefined, seriesId: form.value.seriesId || undefined, brand: form.value.brandName || undefined, series: form.value.seriesName || undefined, typeMain: form.value.typeMain, typeSub: form.value.typeSub || undefined, color: form.value.color || undefined } as any;
            const exists = (filtered.value || []).some(it => String(it.plateNumber||'').toUpperCase() === String(form.value.plateNumber||'').toUpperCase());
            if (exists) { ElMessage.warning('该车辆已在队列中'); return; }
            await http('/queue/add', { method: 'POST', body: payload });
        }
        dialogVisible.value = false; fetchList();
    } finally { saving.value = false; }
}

async function fetchMemberOptions(){
    const res = await http<{ items: MemberOption[] }>(`/member/list`, { method: 'GET', query: { page: 1, pageSize: 500 } });
    memberOptions.value = res.items || [];
}

onMounted(()=>{ fetchList(); fetchMemberOptions(); });

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
async function fetchBrands(){ brandLoading.value=true; try { const resp = await fetch(`http://localhost:3000/content/car/brands`); const json = await resp.json(); const arr:any[] = json || []; const flat:any[]=[]; for (const mb of arr){ for (const b of (mb.brand_list||[])){ flat.push({ brand_id: b.brand_id, brand_name: b.brand_name, main_brand_name: mb.main_brand_name, letter: (mb.letter||'').toUpperCase(), img: b.img || mb.img }); } } brandOptionsAll.value = flat; applyBrandFilter(); brandsLoaded.value=true; } catch { brandOptionsAll.value=[]; brandOptions.value=[]; } finally { brandLoading.value=false; } }
async function fetchSeries(brandId: number){ if (!brandId) { seriesOptions.value=[]; return; } seriesLoading.value=true; try { const resp = await fetch(`http://localhost:3000/content/car/series?brandId=${brandId}`); const json = await resp.json(); const arr:any[] = json || []; seriesOptions.value = arr.map((s:any)=>({ series_id: s.series_id, series_name: s.series_name, scale: s.scale })); } catch { seriesOptions.value=[]; } finally { seriesLoading.value=false; } }
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
.steps-cell :deep(.el-step__head.is-process) { color: #409EFF; border-color: #409EFF; }
.steps-cell :deep(.el-step__title.is-process) { color: #409EFF; }
.steps-cell :deep(.el-step__description.is-process) { color: #409EFF; }
/* 修复表格只显示一行：确保表格容器允许高度自适应 */
/* 避免强行修改表格内部高度，恢复默认滚动与渲染 */
</style>


