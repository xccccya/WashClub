<template>
	<BasePage title="会员车辆">
		<template #actions>
			<el-input v-model="keyword" placeholder="搜索车牌/品牌/会员" style="width:260px;margin-right:8px;" />
			<el-button @click="fetchList" :loading="loading" style="margin-right:8px;">搜索</el-button>
			<el-dropdown>
				<el-button type="primary">新增车辆</el-button>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item @click="openCreate('member')">绑定到会员</el-dropdown-item>
						<el-dropdown-item divided @click="openCreate('guest')">新增游客车辆</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</template>
		<el-table :data="list" stripe style="width:100%" highlight-current-row @row-dblclick="onRowDblClick">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="plateNumber" label="车牌号" width="160" />
			<el-table-column prop="vin" label="VIN" width="160">
				<template #default="{ row }">{{ row.vin || '-' }}</template>
			</el-table-column>
			<el-table-column label="品牌/车系" min-width="240" show-overflow-tooltip>
				<template #default="{ row }">{{ (row.brand||'-') + ' / ' + (row.series||'-') }}</template>
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
			<el-table-column label="操作" width="260">
				<template #default="{ row }">
					<el-button size="small" link @click="openEdit(row)">编辑</el-button>
					<el-button size="small" link type="success" :disabled="row.isDefault" @click="setDefault(row)">设为默认</el-button>
					<el-button v-if="!row.memberId" size="small" link type="warning" @click="openBindMember(row)">绑定会员</el-button>
					<el-button size="small" link type="danger" @click="openDelete(row)">删除</el-button>
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
				<el-form-item label="车牌号" required><el-input v-model="form.plateNumber" placeholder="例如 川A12345 或 川AD12345" /></el-form-item>
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
						<el-option v-for="s in seriesOptions" :key="s.series_id" :label="s.series_name" :value="s.series_id" />
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
				<el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
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

		<!-- 查看车辆信息（美化版） -->
		<el-dialog v-model="viewDialog" title="车辆信息" width="720px">
			<div v-if="viewItem" class="view-wrap">
				<el-descriptions :column="2" border class="desc">
					<el-descriptions-item label="ID">{{ viewItem.id }}</el-descriptions-item>
					<el-descriptions-item label="车牌号">
						<span :class="['plate-chip', plateClass(viewItem.plateNumber)]">{{ viewItem.plateNumber }}</span>
					</el-descriptions-item>
					<el-descriptions-item label="VIN">{{ viewItem.vin || '-' }}</el-descriptions-item>
					<el-descriptions-item label="默认">
						<el-tag :type="viewItem.isDefault ? 'success' : 'info'">{{ viewItem.isDefault ? '是' : '否' }}</el-tag>
					</el-descriptions-item>
					<el-descriptions-item label="品牌">
						<div class="brand-cell">
							<img v-if="viewItem.brandImage" :src="toAbs(viewItem.brandImage)" class="brand-inline-img" />
							<span>{{ viewItem.brand || '-' }}</span>
						</div>
					</el-descriptions-item>
					<el-descriptions-item label="车系">{{ viewItem.series || '-' }}</el-descriptions-item>
					<el-descriptions-item label="类型">{{ (viewItem.typeMain||'-') + (viewItem.typeSub?(' / '+viewItem.typeSub):'') }}</el-descriptions-item>
					<el-descriptions-item label="颜色">
						<el-tag :style="colorTagStyle(viewItem.color)">{{ viewItem.color || '-' }}</el-tag>
					</el-descriptions-item>
					<el-descriptions-item label="会员" :span="2">
						<span v-if="viewItem.member">{{ `${viewItem.member.name}（${viewItem.member.phone}）` }}</span>
						<span v-else>游客</span>
					</el-descriptions-item>
					<el-descriptions-item label="创建时间">{{ formatDateTime(viewItem.createdAt) }}</el-descriptions-item>
					<el-descriptions-item label="修改时间">{{ formatDateTime(viewItem.updatedAt) }}</el-descriptions-item>
				</el-descriptions>

				<div class="imgs-row">
					<div class="img-card">
						<div class="img-title">车系图</div>
						<div class="img-body">
							<img v-if="viewItem.seriesImage" :src="toAbs(viewItem.seriesImage)" class="img series" />
							<div v-else class="img img-empty">无</div>
						</div>
					</div>
				</div>
			</div>
			<template #footer>
				<el-button @click="viewDialog=false">关闭</el-button>
			</template>
		</el-dialog>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';
import { absUrl } from '../utils/http';
import { ElMessage } from 'element-plus';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type Vehicle = { id: number; plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain: string; typeSub?: string | null; color?: string | null; isDefault: boolean; memberId: number | null; brandImage?: string | null; seriesImage?: string | null; createdAt?: string | null; updatedAt?: string | null; member?: { id: number; name: string; phone: string } };

const list = ref<Vehicle[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const keyword = ref('');

const dialogVisible = ref(false);
const createMode = ref<'member'|'guest'>('member');
const saving = ref(false);
const current = ref<Vehicle | null>(null);
const form = ref<any>({ plateNumber: '', vin: '', brandId: undefined as number | undefined, brandName: '', seriesId: undefined as number | undefined, seriesName: '', typeMain: '', typeSub: '', color: '', isDefault: false, memberId: undefined as number | undefined });
type MemberOption = { id: number; name: string; phone: string };
const memberOptions = ref<MemberOption[]>([]);
function toAbs(u?: string | null){ return absUrl(u || ''); }

const delDialog = ref(false);
const delId = ref<number | null>(null);
const viewDialog = ref(false);
const viewItem = ref<Vehicle | null>(null);

// 绑定会员
const bindDialog = ref(false);
const bindVehicle = ref<Vehicle | null>(null);
const bindMemberId = ref<number | null>(null);
function openBindMember(v: Vehicle){ bindVehicle.value = v; bindMemberId.value = null; bindDialog.value = true; }
async function onBindSave(){ if (!bindVehicle.value?.id || !bindMemberId.value) { ElMessage.error('请选择会员'); return; } await http(`/vehicle/${bindVehicle.value.id}/bind-member/${bindMemberId.value}`, { method: 'POST' }); bindDialog.value = false; ElMessage.success('已绑定'); fetchList(); }
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

// 车型外部接口
const API_KEY = '79c9ec9af0555d0de315b5675f6b1453';
type BrandItem = { main_brand_id: number; main_brand_name: string; letter: string; img?: string; brand_list: Array<{ brand_id: number; brand_name: string; img?: string }> };
type FlatBrand = { brand_id: number; brand_name: string; main_brand_name: string; letter: string; img?: string };
type SeriesItem = { series_id: number; series_name: string; scale?: string };
const brandLetters = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
const selectedLetter = ref<string | null>(null);
const brandLoading = ref(false);
const brandsLoaded = ref(false);
const seriesLoading = ref(false);
const brandOptionsAll = ref<FlatBrand[]>([]);
const brandOptions = ref<FlatBrand[]>([]);
const brandSelectRef = ref();
const brandSelectKey = ref(0);
const seriesOptions = ref<SeriesItem[]>([]);
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
        const resp = await fetch(`${API_BASE}/content/car/brands`);
        const json = await resp.json();
        const arr: BrandItem[] = json || [];
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
        const resp = await fetch(`${API_BASE}/content/car/series?brandId=${brandId}`);
        const json = await resp.json();
        const arr: any[] = json || [];
        seriesOptions.value = arr.map(s => ({ series_id: s.series_id, series_name: s.series_name, scale: s.scale }));
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
        const res = await http<{ items: Vehicle[]; page: number; pageSize: number; total: number }>(
            '/vehicle/list', { method: 'GET', query: { page: page.value, pageSize: pageSize.value, keyword: keyword.value } }
        );
        list.value = res.items;
        total.value = res.total;
    } finally { loading.value = false; }
}

function onPageChange(p: number){ page.value = p; fetchList(); }

function openCreate(mode: 'member'|'guest' = 'member'){ createMode.value = mode; current.value = null; form.value = { plateNumber: '', vin: '', brand: '', series: '', typeMain: '', typeSub: '', color: '', isDefault: false, memberId: undefined }; dialogVisible.value = true; }
function openEdit(v: Vehicle){ current.value = v; form.value = { ...v }; dialogVisible.value = true; }
function openDelete(v: Vehicle){ delId.value = v.id; delDialog.value = true; }
function openView(v: Vehicle){ viewItem.value = v; viewDialog.value = true; }
function onRowDblClick(row: Vehicle){ openView(row); }

async function setDefault(v: Vehicle){ await http(`/vehicle/${v.id}/set-default`, { method: 'POST' }); ElMessage.success('已设为默认'); fetchList(); }

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
            await http(`/vehicle/${current.value.id}`, { method: 'PUT', body: payload });
        } else if (createMode.value === 'member') {
            if (!form.value.memberId) { ElMessage.error('请选择会员'); return; }
            await http(`/vehicle/member/${form.value.memberId}`, { method: 'POST', body: payload });
        } else {
            await http(`/vehicle/guest/create`, { method: 'POST', body: payload });
        }
        dialogVisible.value = false; fetchList();
    } finally { saving.value = false; }
}

async function onDeleteConfirm(){ if (!delId.value) return; await http(`/vehicle/${delId.value}`, { method: 'DELETE' }); ElMessage.success('已删除'); delDialog.value = false; fetchList(); }

async function fetchMemberOptions(){
    try {
        const res = await http<{ items: Array<{ id:number; name:string; phone:string }> }>(
            '/member/list', { method: 'GET', query: { page: 1, pageSize: 500 } }
        );
        memberOptions.value = (res.items || []).map(m => ({ id: m.id, name: m.name, phone: m.phone }));
    } catch {}
}

onMounted(()=>{ fetchMemberOptions(); /* 品牌数据在下拉展开时再拉取 */ fetchList(); });
function onBrandDropdownVisible(visible: boolean){ if (visible && !brandsLoaded.value && !brandLoading.value) fetchBrands(); }

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
.brand-logo { width:18px; height:18px; object-fit:contain; border-radius:2px; }
.brand-logo.prefix { margin-right:6px; }
.brand-text { line-height:18px; }
/* 让表格容器在 BasePage 内容区内水平占满 */
.base-page__content { padding: 0; }
/* 让表格外层容器与表格都占满 */
.table-wrap { width: 100%; }
.table-wrap :deep(.el-table) { width: 100%; }

/* 详情美化 */
.desc { margin-bottom: 12px; }
.plate-chip { display:inline-block; padding: 2px 8px; border-radius: 12px; background: #f0f9eb; color: #67c23a; font-weight: 600; }
.plate-chip.plate-blue { background:#e6f0ff; color:#1d4ed8; }
.plate-chip.plate-green { background:#e6fff4; color:#16a34a; }
.imgs-row { display:flex; gap: 12px; }
.img-card { flex:1; background:#fff; border: 1px solid #ebeef5; border-radius: 8px; overflow: hidden; }
.img-title { padding: 8px 10px; font-size: 13px; color:#606266; border-bottom:1px solid #ebeef5; background:#f9fafc; }
.img-body { padding: 10px; display:flex; align-items:center; justify-content:center; min-height: 160px; }
.img { max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 4px; }
.img.series { max-height: 200px; }
.img-empty { width:100%; height:160px; display:flex; align-items:center; justify-content:center; color:#909399; background:#fafafa; border:1px dashed #e4e7ed; }

/* 品牌图内嵌到品牌名单元格 */
.brand-cell { display:flex; align-items:center; gap:8px; }
.brand-inline-img { width:18px; height:18px; object-fit:contain; border-radius:2px; }
</style>


