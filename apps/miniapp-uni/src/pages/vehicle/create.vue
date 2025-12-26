<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>
		<view class="card">
			<view class="group-title">车辆基本信息</view>
			<view class="form-item"><text class="label required">车牌号</text><plate-input v-model="plate" /></view>
			<!-- 按需求：品牌/车系放在车牌号后 -->
			<view class="form-item">
				<text class="label">车辆品牌</text>
				<view class="picker" @tap="openBrandDialog">{{ brandName || '请选择（支持首字母筛选/搜索）' }}</view>
			</view>
			<view class="form-item">
				<text class="label">车辆车系</text>
				<view class="picker" :class="{ disabled: !brandId }" @tap="openSeriesDialog">{{ seriesName || (brandId ? '请选择（可搜索）' : '请先选择品牌') }}</view>
			</view>
			<view class="form-item">
				<text class="label required">车辆主类</text>
				<picker mode="selector" :range="typeMainOptions" :disabled="lockTypeBySeries" @change="onTypeMainChange">
					<view class="picker" :class="{ disabled: lockTypeBySeries }">{{ typeMain || '请选择' }}</view>
				</picker>
				<text v-if="lockTypeBySeries" class="lock-hint">已根据车系自动选择</text>
			</view>
			<view class="form-item">
				<text class="label">车辆子类</text>
				<picker mode="selector" :range="typeSubOptions(typeMain)" :disabled="!typeMain || lockTypeBySeries" @change="onTypeSubChange">
					<view class="picker" :class="{ disabled: !typeMain || lockTypeBySeries }">{{ typeSub || '可选' }}</view>
				</picker>
			</view>
			<view class="form-item">
				<text class="label">车辆颜色</text>
				<picker mode="selector" :range="colorOptions" @change="onColorChange">
					<view class="picker">{{ color || '可选' }}</view>
				</picker>
			</view>
		</view>

		<view class="card">
			<view class="group-title">车辆其他信息</view>
			<view class="form-item"><text class="label">VIN码</text><input class="input" v-model="vin" placeholder="17位VIN（可选）" maxlength="17" /></view>
		</view>

		<view class="tip">提示：带<text class="asterisk">*</text>号为必填项目。</view>
		<view class="submit" :class="{ disabled: saving }" @tap="onSubmit">{{ saving ? '正在保存，请稍候…' : '保存' }}</view>

		<!-- 品牌选择弹层 -->
		<view v-if="brandDialog" class="dlg-mask" @tap="closeBrandDialog"></view>
		<view v-if="brandDialog" class="dlg-panel">
			<view class="dlg-head"><text class="dlg-title">选择车辆品牌</text><text class="dlg-close" @tap="closeBrandDialog">关闭</text></view>
			<view class="dlg-search"><input class="input" v-model="brandSearch" placeholder="搜索品牌" @input="onBrandSearch" /></view>
			<view class="letter-bar" v-if="brandsLoaded">
				<text :class="['letter', selectedLetter===null?'active':'']" @tap="selectLetter(null)" @click="selectLetter(null)">全部</text>
				<text v-for="ch in brandLetters" :key="ch" :class="['letter', selectedLetter===ch?'active':'']" @tap="selectLetter(ch)" @click="selectLetter(ch)">{{ ch }}</text>
			</view>
			<scroll-view :scroll-y="true" class="dlg-list" :style="{ maxHeight: '60vh', minHeight: '40vh' }">
				<view v-if="brandLoading" class="loading">加载中...</view>
				<view v-for="b in brandDisplayOptions" :key="b.brand_id" class="dlg-item" @tap="chooseBrand(b)">
					<image v-if="b.img" :src="b.img" class="brand-logo" />
					<text class="brand-text">{{ b.main_brand_name }}-{{ b.brand_name }}</text>
				</view>
				<view v-if="!brandLoading && brandDisplayOptions.length===0" class="empty">未找到结果</view>
			</scroll-view>
		</view>

		<!-- 车系选择弹层 -->
		<view v-if="seriesDialog" class="dlg-mask" @tap="closeSeriesDialog"></view>
		<view v-if="seriesDialog" class="dlg-panel">
			<view class="dlg-head"><text class="dlg-title">选择车辆车系</text><text class="dlg-close" @tap="closeSeriesDialog">关闭</text></view>
			<view class="dlg-search"><input class="input" v-model="seriesSearch" placeholder="搜索车系" @input="onSeriesSearch" /></view>
			<scroll-view :scroll-y="true" class="dlg-list" :style="{ maxHeight: '60vh', minHeight: '40vh' }">
				<view v-if="seriesLoading" class="loading">加载中...</view>
				<view v-for="s in seriesDisplayOptions" :key="s.series_id" class="dlg-item" @tap="chooseSeries(s)">
					<text class="brand-text">{{ s.series_name }}</text>
				</view>
				<view v-if="!seriesLoading && seriesDisplayOptions.length===0" class="empty">未找到结果</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { createHttp, checkAuthAndRefresh } from '../../utils/auth';
import PlateInput from './plate-input.vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight, statusBarHeight } = useSafeArea();

const plate = ref('');
const typeMain = ref('');
const typeSub = ref('');
const typeMainOptions = ['轿车','SUV','MPV','卡车','跑车'];
const typeSubMap: Record<string, string[]> = {
	'轿车': ['微型车','小型车','紧凑型车','中型车','中大型车','大型车'],
	'SUV': ['小型SUV','紧凑型SUV','中型SUV','中大型SUV','大型SUV'],
	'MPV': ['小型MPV','紧凑型MPV','中型MPV','中大型MPV','大型MPV'],
	'卡车': ['轻卡','微卡','皮卡','房车'],
	'跑车': [],
};
function typeSubOptions(main?: string){ return main ? (typeSubMap[main] || []) : []; }
const colorOptions = ['黑色','白色','灰色','银色','红色','金色（米/香槟）','蓝色','棕色（褐/咖啡）','紫色','绿色','粉色','黄色','橙色','其他（彩绘/混合）'];
const color = ref('');
const vin = ref('');
const saving = ref(false);

// 品牌/车系列表与筛选
type FlatBrand = { brand_id: number; brand_name: string; main_brand_name: string; letter: string; img?: string };
type SeriesItem = { series_id: number; series_name: string; scale?: string };
const brandDialog = ref(false);
const seriesDialog = ref(false);
const brandLetters = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
const selectedLetter = ref<string|null>(null);
const brandSearch = ref('');
const seriesSearch = ref('');
const brandLoading = ref(false);
const seriesLoading = ref(false);
const brandsLoaded = ref(false);
const brandOptionsAll = ref<FlatBrand[]>([]);
const brandOptions = ref<FlatBrand[]>([]);
const brandDisplayOptions = computed(()=>{
	const kw = brandSearch.value.trim().toLowerCase();
	const src = brandOptions.value;
	if (!kw) return src;
	return src.filter(b => (b.brand_name + ' ' + b.main_brand_name).toLowerCase().includes(kw));
});
const seriesOptions = ref<SeriesItem[]>([]);
const seriesDisplayOptions = computed(()=>{
	const kw = seriesSearch.value.trim().toLowerCase();
	if (!kw) return seriesOptions.value;
	return seriesOptions.value.filter(s => (s.series_name||'').toLowerCase().includes(kw));
});
const seriesCache = ref<Record<number, { ts: number; items: SeriesItem[] }>>({});
const SERIES_TTL_MS = 10 * 60 * 1000;

const brandId = ref<number|undefined>(undefined);
const brandName = ref('');
const seriesId = ref<number|undefined>(undefined);
const seriesName = ref('');
const lockTypeBySeries = ref(false);

function onTypeMainChange(e: any){ const idx = Number(e?.detail?.value||0); typeMain.value = typeMainOptions[idx] || ''; }
function onTypeSubChange(e:any){ const idx = Number(e?.detail?.value||0); typeSub.value = typeSubOptions(typeMain.value)[idx] || ''; }
function onColorChange(e: any){ const idx = Number(e?.detail?.value||0); color.value = colorOptions[idx] || ''; }

function validate(){
    if (!plate.value || !/^[\u4e00-\u9fa5][A-Z][A-Z0-9\u4e00-\u9fa5]{5,6}$/.test(plate.value)) { uni.showToast({ title: '请输入合法车牌', icon: 'none' }); return false; }
    if (!typeMain.value) { uni.showToast({ title: '请选择车辆主类型', icon: 'none' }); return false; }
    return true;
}

async function onSubmit(){
    if (!validate()) return;
    const payload = {
            plateNumber: plate.value.trim(),
            typeMain: typeMain.value,
            typeSub: typeSub.value || undefined,
            color: color.value || undefined,
            vin: vin.value || undefined,
            brand: brandName.value || undefined,
            series: seriesName.value || undefined,
            brandId: brandId.value || undefined,
            seriesId: seriesId.value || undefined,
        };
    try {
        if (saving.value) return; saving.value = true;
        try { uni.showLoading({ title: '正在保存，请稍候…', mask: true }); } catch {}
        const http = createHttp();
        await http('/vehicle/me/create', { method: 'POST', body: payload });
        uni.showToast({ title: '已保存', icon: 'success' });
        setTimeout(()=>{
            try { uni.navigateBack(); return; } catch {}
            try { uni.redirectTo({ url: '/pages/vehicle/list' }); } catch {}
        }, 300);
    } catch (e:any) {
        const msg = String(e?.message || '');
        // 若因唯一索引导致失败（同一车牌已存在），尝试查找并改为更新以触发图片保存逻辑
        if (/Vehicle_plateNumber_key|Unique constraint failed/i.test(msg)) {
            try {
                const http = createHttp();
                const list = await http<any[]>('/vehicle/me/list', { method: 'GET' });
                const exists = (list||[]).find(it => String(it.plateNumber).toUpperCase() === plate.value.trim().toUpperCase());
                if (exists && exists.id) {
                    await http(`/vehicle/${exists.id}`, { method: 'PUT', body: payload as any });
                    uni.showToast({ title: '已更新车辆信息', icon: 'success' });
                    setTimeout(()=>{
                        try { uni.navigateBack(); return; } catch {}
                        try { uni.redirectTo({ url: '/pages/vehicle/list' }); } catch {}
                    }, 300);
                    return;
                }
            } catch (ee:any) {
                uni.showToast({ title: String(ee?.message||'保存失败').slice(0,30), icon:'none' });
            }
        } else {
            uni.showToast({ title: msg.slice(0,30) || '保存失败', icon: 'none' });
        }
    } finally { try { uni.hideLoading(); } catch {}; saving.value = false; }
}

onShow(()=>{ checkAuthAndRefresh({ redirectIfExpired: true }); });

// 品牌/车系：懒加载 + 防滥用
function openBrandDialog(){ brandDialog.value = true; if (!brandsLoaded.value && !brandLoading.value) fetchBrands(); }
function closeBrandDialog(){ brandDialog.value = false; }
function openSeriesDialog(){ if (!brandId.value) { uni.showToast({ title:'请先选择品牌', icon:'none' }); return; } seriesDialog.value = true; fetchSeriesIfNeeded(brandId.value); }
function closeSeriesDialog(){ seriesDialog.value = false; }

function selectLetter(ch: string | null){ selectedLetter.value = ch; applyBrandFilter(); }
function applyBrandFilter(){ const all = brandOptionsAll.value; brandOptions.value = selectedLetter.value ? all.filter(b => (b.letter||'').toUpperCase() === selectedLetter.value) : all; }

async function fetchBrands(){
    brandLoading.value = true;
    try {
        const http = createHttp();
        const json = await http<any>('/content/car/brands', { method: 'GET' });
        const arr: any[] = json || [];
        const flat: FlatBrand[] = [];
        for (const mb of arr){
            for (const b of (mb.brand_list || [])){
                flat.push({ brand_id: b.brand_id, brand_name: b.brand_name, main_brand_name: mb.main_brand_name, letter: String(mb.letter||'').toUpperCase(), img: b.img || mb.img });
            }
        }
        brandOptionsAll.value = flat; applyBrandFilter(); brandsLoaded.value = true;
    } catch { brandOptionsAll.value = []; brandOptions.value = []; }
    finally { brandLoading.value = false; }
}

async function fetchSeriesIfNeeded(bid: number){
    const cached = seriesCache.value[bid]; const now = Date.now();
    if (cached && now - cached.ts < SERIES_TTL_MS) { seriesOptions.value = cached.items; return; }
    seriesLoading.value = true;
    try {
        const http = createHttp();
        const json = await http<any>('/content/car/series', { method: 'GET', query: { brandId: bid } });
        const arr: any[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
        const items: SeriesItem[] = arr.map(s => ({ series_id: s.series_id, series_name: s.series_name, scale: s.scale }));
        seriesOptions.value = items; seriesCache.value[bid] = { ts: now, items };
    } catch { seriesOptions.value = []; }
    finally { seriesLoading.value = false; }
}

function onBrandSearch(){ /* 前端过滤，节流不必请求 */ }
function onSeriesSearch(){ /* 前端过滤 */ }

function chooseBrand(b: FlatBrand){
    brandId.value = b.brand_id; brandName.value = b.brand_name; seriesId.value = undefined; seriesName.value = '';
    lockTypeBySeries.value = false; // 变更品牌时解除锁定，待选车系后再锁
    // 预加载该品牌的车系列表，避免用户立即进入车系列表时首次为空
    try { fetchSeriesIfNeeded(b.brand_id); } catch {}
    closeBrandDialog();
}
function chooseSeries(s: SeriesItem){
    seriesId.value = s.series_id; seriesName.value = s.series_name;
    // 根据 scale 推断主类/子类（若未选主类）
    const scale = String(s.scale || '');
    if (!typeMain.value) {
        const mapped = mapScaleToType(scale);
        if (mapped.main) typeMain.value = mapped.main;
        if (mapped.sub) typeSub.value = mapped.sub;
    }
    // 只要选择过车系，就锁定主类/子类（与后台一致）
    lockTypeBySeries.value = true;
    closeSeriesDialog();
}

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/vehicle/list' });
	} catch { uni.reLaunch({ url: '/pages/vehicle/list' }); }
}

function mapScaleToType(scale: string): { main: string; sub: string }{
    const sc = (scale||'').trim();
    if (!sc) return { main:'', sub:'' };
    if (/SUV/i.test(sc)) return { main:'SUV', sub: sc.replace(/\s+/g,'') };
    if (/MPV/i.test(sc)) return { main:'MPV', sub: sc.replace(/\s+/g,'') };
    if (/(皮卡|轻卡|微卡|房车)/.test(sc)) { const sub = sc.includes('皮卡')?'皮卡':sc.includes('轻卡')?'轻卡':sc.includes('微卡')?'微卡':'房车'; return { main:'卡车', sub }; }
    if (/跑车/.test(sc)) return { main:'跑车', sub:'' };
    return { main:'轿车', sub: sc.replace(/\s+/g,'') };
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 24rpx; background: #f8fafc; box-sizing: border-box; }
.card { background:#fff; border-radius: 20rpx; padding: 20rpx; box-shadow: 0 6rpx 20rpx rgba(0,0,0,0.06); margin-bottom: 20rpx; }
.group-title { font-weight: 700; margin-bottom: 12rpx; }
.form-item { margin-bottom: 20rpx; }
.label { display:block; margin-bottom: 12rpx; color:#374151; }
.label.required::before { content: '*'; color: #ef4444; margin-right: 6rpx; }
.picker { padding: 18rpx; background:#f3f4f6; border-radius: 12rpx; }
.picker.disabled { opacity: 0.6; }
.tip { color:#6b7280; font-size: 24rpx; }
.submit { margin-top: 24rpx; padding: 20rpx 0; text-align:center; background: linear-gradient(135deg, #a8d8ff, #ffc9de); border-radius: 999rpx; }
.submit.disabled { opacity: 0.6; }
.asterisk { color:#ef4444; }
.input { padding: 18rpx; background:#f3f4f6; border-radius: 12rpx; }
.lock-hint { margin-left: 12rpx; color: #6b7280; font-size: 22rpx; }

/* 弹层样式 */
.dlg-mask { position: fixed; left:0; right:0; top:0; bottom:0; background: rgba(0,0,0,0.35); z-index: 998; }
.dlg-panel { position: fixed; left:0; right:0; bottom:0; background:#fff; border-radius: 24rpx 24rpx 0 0; z-index: 999; max-height: 70vh; min-height: 40vh; display:flex; flex-direction: column; }
.dlg-head { display:flex; align-items:center; justify-content: space-between; padding: 18rpx 20rpx; border-bottom: 2rpx solid #f3f4f6; }
.dlg-title { font-weight: 700; }
.dlg-close { color:#409eff; }
.dlg-search { padding: 12rpx 20rpx; }
.dlg-list { flex:1; padding: 8rpx 12rpx; height: 50vh; box-sizing: border-box; overflow-y: scroll; -webkit-overflow-scrolling: touch; }
.dlg-item { display:flex; align-items:center; gap: 12rpx; padding: 14rpx 10rpx; border-bottom: 2rpx solid #f3f4f6; }
.brand-logo { width: 40rpx; height: 40rpx; object-fit: contain; border-radius: 4rpx; background:#fafafa; }
.brand-text { color:#374151; }
.letter-bar { display:flex; flex-wrap: wrap; gap: 8rpx; padding: 0 20rpx 10rpx; }
.letter { font-size: 24rpx; padding: 6rpx 10rpx; border-radius: 999rpx; color:#4b5563; background:#f3f4f6; }
.letter.active { background:#ecf5ff; color:#409eff; }
.loading, .empty { text-align:center; color:#6b7280; padding: 20rpx 0; }

/* 统一返回按钮样式 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


