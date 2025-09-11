<template>
  <div class="page">
    <div class="toolbar">
      <el-select
        v-model="groupId"
        filterable
        remote
        clearable
        :remote-method="searchGroups"
        :loading="loadingGroups"
        placeholder="选择集团（可按集团号/名称搜索）"
        style="width: 320px; margin-right: 8px;"
        @change="onGroupChange"
      >
        <el-option v-for="g in groupOptions" :key="g.id" :label="`${g.code} - ${g.name}`" :value="g.id" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索车牌/品牌/会员" style="width: 240px; margin-right: 8px;" @keyup.enter="load" />
      <el-select v-model="source" placeholder="来源" style="width: 120px; margin-right: 8px;">
        <el-option label="全部" value="all" />
        <el-option label="集团名下" value="group" />
        <el-option label="会员车辆" value="member" />
      </el-select>
      <el-select v-model="sortBy" placeholder="排序字段" style="width: 140px; margin-right: 8px;">
        <el-option label="更新时间" value="updatedAt" />
        <el-option label="创建时间" value="createdAt" />
        <el-option label="车牌号" value="plateNumber" />
        <el-option label="品牌" value="brand" />
        <el-option label="主类型" value="typeMain" />
      </el-select>
      <el-select v-model="sortOrder" placeholder="顺序" style="width: 120px; margin-right: 8px;">
        <el-option label="降序" value="desc" />
        <el-option label="升序" value="asc" />
      </el-select>
      <el-button type="primary" @click="load">查询</el-button>
      <el-button type="success" style="margin-left: 12px" @click="openCreate" :disabled="!groupId">新增车辆</el-button>
    </div>

    <el-table :data="items" height="calc(100vh - 220px)" highlight-current-row @row-dblclick="onRowDblClick">
      <el-table-column label="车牌" width="200">
        <template #default="{ row }">
          <span :class="['plate-chip', plateClass(row.plateNumber)]">{{ row.plateNumber }}</span>
          <el-tag v-if="row.isMemberVehicle" type="info" size="small" style="margin-left:8px">会员车辆</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="brand" label="品牌" />
      <el-table-column prop="series" label="车系" />
      <el-table-column prop="typeMain" label="类型" width="120" />
      <el-table-column prop="color" label="颜色" width="120" />
      <el-table-column label="会员" min-width="220">
        <template #default="{ row }">
          <span v-if="row.member">{{ `${row.member.name}（${row.member.phone}）` }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button v-if="!row.isMemberVehicle" size="small" type="danger" @click="remove(row)">解绑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="createVisible" title="新增集团车辆" width="620px">
      <el-form label-width="100px">
        <el-form-item label="车牌号" required><el-input v-model="form.plateNumber" placeholder="例如 川A12345 或 川AD12345" /></el-form-item>
        <!-- 品牌与车系复用会员车辆逻辑 -->
        <el-form-item label="车辆品牌">
          <div style="width:100%">
            <div class="letter-bar" v-if="brandsLoaded">
              <span :class="['letter', selectedLetter===null?'active':'']" @click="selectLetter(null)">全部</span>
              <span v-for="ch in brandLetters" :key="ch" :class="['letter', selectedLetter===ch?'active':'']" @click="selectLetter(ch)">{{ ch }}</span>
            </div>
            <el-select :key="brandSelectKey" ref="brandSelectRef" v-model="form.brandId" filterable placeholder="选择品牌（可搜索）" style="width:100%" :loading="brandLoading" @change="onBrandChange" @visible-change="onBrandDropdownVisible">
              <el-option v-for="b in brandOptions" :key="b.brand_id" :label="`${b.main_brand_name}-${b.brand_name}`" :value="b.brand_id">
                <div class="brand-option">
                  <img v-if="b.img" :src="formatBrandImg(b.img)" class="brand-logo" />
                  <span class="brand-text">{{ b.main_brand_name }}-{{ b.brand_name }}</span>
                </div>
              </el-option>
            </el-select>
          </div>
        </el-form-item>
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
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>
    
    <!-- 查看车辆信息（双击弹窗） -->
    <el-dialog v-model="viewDialog" title="车辆信息" width="720px">
      <div v-if="viewItem" class="view-wrap">
        <el-descriptions :column="2" border class="desc">
          <el-descriptions-item label="ID">{{ viewItem.id }}</el-descriptions-item>
          <el-descriptions-item label="车牌号">
            <span :class="['plate-chip', plateClass(viewItem.plateNumber)]">{{ viewItem.plateNumber }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="VIN">{{ viewItem.vin || '-' }}</el-descriptions-item>
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
            <span v-else>-</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { http, absUrl } from '../utils/http';
import { API_BASE } from '../config';

const route = useRoute();
const groupId = ref<number | null>(null);
const groupOptions = ref<any[]>([]);
const loadingGroups = ref(false);
const items = ref<any[]>([]);
const keyword = ref('');
const source = ref<'all'|'group'|'member'>('all');
const sortBy = ref<'createdAt'|'updatedAt'|'plateNumber'|'brand'|'typeMain'>('updatedAt');
const sortOrder = ref<'asc'|'desc'>('desc');

const createVisible = ref(false);
const form = ref<any>({ plateNumber: '', vin: '', brandId: undefined as number | undefined, brandName: '', seriesId: undefined as number | undefined, seriesName: '', typeMain: '', typeSub: '', color: '' });
const typeMainOptions = ['轿车', 'SUV', 'MPV', '卡车', '跑车'];
const typeSubMap: Record<string, string[]> = {
  '轿车': ['微型车','小型车','紧凑型车','中型车','中大型车','大型车'],
  'SUV': ['小型SUV','紧凑型SUV','中型SUV','中大型SUV','大型SUV'],
  'MPV': ['小型MPV','紧凑型MPV','中型MPV','中大型MPV','大型MPV'],
  '卡车': ['轻卡','微卡','皮卡','房车'],
  '跑车': [],
};
function typeSubOptions(main?: string){ return main ? (typeSubMap[main] || []) : []; }
const colorOptions = ['黑色','白色','灰色','银色','红色','金色（米/香槟）','蓝色','棕色（褐/咖啡）','紫色','绿色','粉色','黄色','橙色','其他（彩绘/混合）'];

// 品牌/车系（沿用会员车辆页实现）
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
const currentBrand = ref<FlatBrand | null>(null);
function formatBrandImg(url?: string){ if (!url) return ''; return url; }
function selectLetter(ch: string | null){ selectedLetter.value = ch; applyBrandFilter(); try { brandSelectKey.value++; } catch {} }
function applyBrandFilter(){ const all = brandOptionsAll.value; brandOptions.value = selectedLetter.value ? all.filter(b => (b.letter||'').toUpperCase() === selectedLetter.value) : all; }
async function fetchBrands(){ brandLoading.value = true; try { const resp = await fetch(`${API_BASE}/content/car/brands`); const json = await resp.json(); const arr: BrandItem[] = json || []; const flat: FlatBrand[] = []; for (const mb of arr){ for (const b of (mb.brand_list || [])){ flat.push({ brand_id: b.brand_id, brand_name: b.brand_name, main_brand_name: mb.main_brand_name, letter: (mb.letter||'').toUpperCase(), img: b.img || mb.img }); } } brandOptionsAll.value = flat; applyBrandFilter(); brandsLoaded.value = true; } catch { brandOptionsAll.value = []; brandOptions.value = []; } finally { brandLoading.value = false; } }
async function fetchSeries(brandId: number){ if (!brandId) { seriesOptions.value = []; return; } seriesLoading.value = true; try { const resp = await fetch(`${API_BASE}/content/car/series?brandId=${brandId}`); const json = await resp.json(); const arr: any[] = json || []; seriesOptions.value = arr.map(s => ({ series_id: s.series_id, series_name: s.series_name, scale: s.scale })); } catch { seriesOptions.value = []; } finally { seriesLoading.value = false; } }
function onBrandChange(val: number){ const b = brandOptionsAll.value.find(x => x.brand_id === val); form.value.brandName = b?.brand_name || ''; currentBrand.value = b || null; form.value.seriesId = undefined; form.value.seriesName = ''; fetchSeries(val); }
function onSeriesChange(val: number){ const s = seriesOptions.value.find(x => x.series_id === val); form.value.seriesName = s?.series_name || ''; const scale = (s?.scale || '').toString(); const { main, sub } = mapScaleToType(scale); if (main) form.value.typeMain = main; if (sub) form.value.typeSub = sub; lockTypeBySeries.value = !!val; }
function onBrandDropdownVisible(visible: boolean){ if (visible && !brandsLoaded.value && !brandLoading.value) fetchBrands(); }
function mapScaleToType(scale: string): { main: string; sub: string } { const sc = (scale || '').trim(); if (!sc) return { main: '', sub: '' }; if (/SUV/i.test(sc)) { return { main: 'SUV', sub: sc.replace(/\s+/g,'') }; } if (/MPV/i.test(sc)) { return { main: 'MPV', sub: sc.replace(/\s+/g,'') }; } if (/(皮卡|轻卡|微卡|房车)/.test(sc)) { const sub = sc.includes('皮卡') ? '皮卡' : sc.includes('轻卡') ? '轻卡' : sc.includes('微卡') ? '微卡' : '房车'; return { main: '卡车', sub }; } if (/跑车/.test(sc)) { return { main: '跑车', sub: '' }; } return { main: '轿车', sub: sc.replace(/\s+/g,'') }; }

async function load(){
  if(!groupId.value){ items.value=[]; return; }
  const res:any = await http(`/group/${groupId.value}/vehicles`, { method: 'GET', query: { keyword: keyword.value || undefined, source: source.value, sortBy: sortBy.value, sortOrder: sortOrder.value } });
  items.value = Array.isArray(res) ? res : [];
}

function openCreate(){ createVisible.value = true; }

async function doCreate(){
  if(!groupId.value){ ElMessage.error('缺少集团ID'); return; }
  if(!form.value.plateNumber){ ElMessage.error('请填写车牌号'); return; }
  if(!form.value.typeMain){ ElMessage.error('请选择车辆主类'); return; }
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
  } as any;
  await http(`/group/${groupId.value}/vehicles`, { method: 'POST', body: payload });
  ElMessage.success('创建成功');
  createVisible.value = false;
  form.value = { plateNumber: '', vin: '', brandId: undefined, brandName: '', seriesId: undefined, seriesName: '', typeMain: '', typeSub: '', color: '' };
  await load();
}

async function remove(row: any){
  if(!groupId.value) return;
  await http(`/group/${groupId.value}/vehicles/${row.id}`, { method: 'DELETE' });
  ElMessage.success('已解绑');
  await load();
}
onMounted(()=>{ const q = Number(route.query.groupId||0); if (Number.isFinite(q) && q>0) { groupId.value = q; load(); } });

async function searchGroups(q?: string){
  loadingGroups.value = true;
  try{
    const res:any = await http('/group', { method:'GET', query: { page: 1, pageSize: 200, keyword: (q||'').trim() || undefined, sortBy: 'name', sortOrder: 'asc' } });
    groupOptions.value = Array.isArray(res?.items) ? res.items : [];
    // 若无预设 groupId，自动不选择
  } finally { loadingGroups.value = false; }
}

function onGroupChange(){ load(); }

function plateClass(plate?: string){
  const s = String(plate||'');
  if (s.length >= 8) return 'plate-green';
  return 'plate-blue';
}

type Vehicle = { id: number; plateNumber: string; vin?: string | null; brand?: string | null; series?: string | null; typeMain: string; typeSub?: string | null; color?: string | null; brandImage?: string | null; seriesImage?: string | null; createdAt?: string | null; updatedAt?: string | null; member?: { id: number; name: string; phone: string } };
const viewDialog = ref(false);
const viewItem = ref<Vehicle | null>(null);
function toAbs(u?: string | null){ return absUrl(u || ''); }
function openView(v: Vehicle){ viewItem.value = v; viewDialog.value = true; }
function onRowDblClick(row: Vehicle){ openView(row); }

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
.page { padding: 16px; }
.toolbar { margin-bottom: 12px; }
.plate-chip { display:inline-block; padding: 2px 8px; border-radius: 12px; background: #e6f0ff; color: #1d4ed8; font-weight: 600; }
.plate-chip.plate-green { background:#e6fff4; color:#16a34a; }
/* 品牌选择器样式（与会员车辆页一致） */
.letter-bar { display:flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.letter { font-size: 12px; padding: 4px 6px; border-radius: 4px; cursor: pointer; color: #666; }
.letter.active { background:#ecf5ff; color: var(--app-primary); }
.brand-option { display:flex; align-items:center; gap:8px; }
.brand-logo { width:18px; height:18px; object-fit:contain; border-radius:2px; }
.brand-text { line-height:18px; }

/* 详情美化 */
.desc { margin-bottom: 12px; }
.imgs-row { display:flex; gap: 12px; }
.img-card { flex:1; background:#fff; border: 1px solid #ebeef5; border-radius: 8px; overflow: hidden; }
.img-title { padding: 8px 10px; font-size: 13px; color:#606266; border-bottom:1px solid #ebeef5; background:#f9fafc; }
.img-body { padding: 10px; display:flex; align-items:center; justify-content:center; min-height: 160px; }
.img { max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 4px; }
.img.series { max-height: 200px; }
.img-empty { width:100%; height:160px; display:flex; align-items:center; justify-content:center; color:#909399; background:#fafafa; border:1px dashed #e4e7ed; }
.brand-cell { display:flex; align-items:center; gap:8px; }
.brand-inline-img { width:18px; height:18px; object-fit:contain; border-radius:2px; }
</style>
