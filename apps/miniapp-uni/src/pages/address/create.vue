<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<view class="card">
			<view class="header"><text class="title">新增收货地址</text></view>
			<view class="form">
				<view class="form-row">
					<text class="label">省市区街道</text>
					<view class="cascade">
						<picker mode="selector" :range="provinceList" range-key="name" @change="onPickProvince">
							<view class="picker-text">{{ form.province || '选择省' }}</view>
						</picker>
						<picker v-if="form.province" mode="selector" :range="cityList" range-key="name" @change="onPickCity">
							<view class="picker-text">{{ form.city || '选择市' }}</view>
						</picker>
						<picker v-if="form.city" mode="selector" :range="districtList" range-key="name" @change="onPickDistrict">
							<view class="picker-text">{{ form.district || '选择区' }}</view>
						</picker>
						<picker v-if="streetList.length>0" mode="selector" :range="streetList" range-key="name" @change="onPickStreet">
							<view class="picker-text">{{ form.street || '选择街道' }}</view>
						</picker>
					</view>
				</view>
				<view class="form-row">
					<text class="label">详细地址</text>
					<input class="input" v-model="form.detail" placeholder="如xx路xx号xx单元xx室" />
				</view>
				<view class="form-row">
					<text class="label">手机号</text>
					<input class="input" v-model="form.phone" type="number" maxlength="11" placeholder="收货人手机号" />
				</view>
				<view class="form-row">
					<text class="label">地址标签</text>
					<view class="tags">
						<view v-for="t in presetTags" :key="t" class="tag-chip" :class="{ active: form.label===t }" @tap="form.label=t">{{ t }}</view>
						<input class="tag-input" v-model="customLabel" maxlength="4" placeholder="自定义(≤4字)" @blur="applyCustomLabel" />
					</view>
				</view>
				<view class="form-actions">
					<view class="btn" @tap="goBack">取消</view>
					<view class="btn-primary" @tap="save">保存</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import { createHttp, getToken } from '../../utils/auth';

type Addr = { province: string; city: string; district: string; street: string; detail: string; phone: string; label?: string | null };
type DistrictItem = { name: string; adcode?: string; districts?: DistrictItem[] };

const { topSpacerHeight, statusBarHeight } = useSafeArea();
const http = createHttp();
const form = reactive<Addr>({ province: '', city: '', district: '', street: '', detail: '', phone: '' });
const customLabel = ref('');
const presetTags = ['家', '公司', '学校', '父母', '朋友'];

const provinceList = ref<DistrictItem[]>([]);
const cityList = ref<DistrictItem[]>([]);
const districtList = ref<DistrictItem[]>([]);
const streetList = ref<DistrictItem[]>([]);

function goBack(){
    try {
        const pages = getCurrentPages?.() || [];
        if (pages.length > 1) { uni.navigateBack(); return; }
        uni.reLaunch({ url: '/pages/address/index' });
    } catch { uni.reLaunch({ url: '/pages/address/index' }); }
}

function applyCustomLabel(){ const t = (customLabel.value||'').trim(); if (!t) return; form.label = t.slice(0,4); }

async function onPickProvince(e:any){ const idx = Number(e?.detail?.value || 0); const p = provinceList.value[idx]; form.province = p?.name || ''; form.city=''; form.district=''; form.street=''; cityList.value = []; districtList.value = []; streetList.value = []; if (p?.name || p?.adcode){ cityList.value = await fetchSub(p.adcode || p.name); } }
async function onPickCity(e:any){ const idx = Number(e?.detail?.value || 0); const c = cityList.value[idx]; form.city = (c?.name)||''; form.district=''; form.street=''; districtList.value = []; streetList.value = []; if (c?.name || c?.adcode){ districtList.value = await fetchSub(c.adcode || c.name); } }
async function onPickDistrict(e:any){ const idx = Number(e?.detail?.value || 0); const d = districtList.value[idx]; form.district = (d?.name)||''; form.street=''; streetList.value = []; if (d?.name || d?.adcode){ streetList.value = await fetchSub(d.adcode || d.name); } }
function onPickStreet(e:any){ const idx = Number(e?.detail?.value || 0); const s = streetList.value[idx]; form.street = (s?.name)||''; }

async function fetchSub(keywords: string){
    const q = `keywords=${encodeURIComponent(keywords)}&subdistrict=1&extensions=base`;
    const res:any = await http(`/content/district?${q}`);
    const arr: DistrictItem[] = Array.isArray(res?.districts) ? res.districts : [];
    const first = arr[0];
    return Array.isArray(first?.districts) ? first.districts as DistrictItem[] : [];
}

async function loadProvinces(){
    try {
        const res:any = await http('/content/district?subdistrict=1&extensions=base');
        const root: any = Array.isArray(res?.districts) ? res.districts[0] : null;
        provinceList.value = Array.isArray(root?.districts) ? root.districts : [];
    } catch {}
}

function validate(): string | null {
    if (!form.province || !form.city || !form.district) return '请选择省/市/区';
    if (streetList.value.length > 0 && !form.street) return '请选择街道';
    if (!form.detail || !form.detail.trim()) return '请填写详细地址';
    if (!/^1\d{10}$/.test(String(form.phone||''))) return '手机号格式不正确';
    if (form.label && Array.from(form.label).length > 4) return '标签最多4个字';
    return null;
}

async function save(){
    const msg = validate(); if (msg){ uni.showToast({ title: msg, icon:'none' }); return; }
    try {
        await http('/address/me/create', { method: 'POST', body: form });
        uni.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(()=>{ goBack(); }, 200);
    } catch (e:any) {
        uni.showToast({ title: e?.message?.slice(0,30) || '保存失败', icon: 'none' });
    }
}

onShow(async ()=>{ if (!getToken()){ uni.navigateTo({ url: '/pages/login/index' }); return; } await loadProvinces(); });
</script>

<style>
.page { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%); padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.card { background: linear-gradient(180deg, rgba(243,249,255,0.92) 0%, rgba(255,247,251,0.92) 100%); border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); backdrop-filter: blur(2rpx); }
.header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.title { font-size: 32rpx; font-weight: 800; color:#0b1220; letter-spacing: 1rpx; }

.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }

.form { display:flex; flex-direction: column; gap: 16rpx; }
.form-row { display:flex; flex-direction: column; gap: 10rpx; }
.label { font-size: 24rpx; color:#374151; }
.cascade { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8rpx; }
.picker-text { padding: 16rpx 12rpx; background: #fff; border: 2rpx solid #e5e7eb; border-radius: 14rpx; font-size: 24rpx; color:#111827; text-align:center; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.input { padding: 16rpx 12rpx; background:#fff; border: 2rpx solid #e5e7eb; border-radius: 14rpx; font-size: 24rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.tags { display:flex; align-items:center; gap: 12rpx; flex-wrap: wrap; }
.tag-chip { padding: 8rpx 14rpx; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); border: none; font-size: 22rpx; color:#0b1220; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06); }
.tag-chip.active { background: linear-gradient(135deg, #60a5fa, #a78bfa); color:#fff; }
.tag-input { padding: 10rpx 14rpx; border: 2rpx solid #e5e7eb; border-radius: 999rpx; width: 220rpx; font-size: 22rpx; background:#fff; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04); }
.form-actions { display:flex; align-items:center; justify-content:flex-end; gap: 12rpx; margin-top: 8rpx; }
.btn { font-size: 24rpx; color:#1f2937; padding: 12rpx 20rpx; border-radius: 999rpx; border: 2rpx solid #e5e7eb; background:#fff; }
.btn-primary { color:#fff; padding: 12rpx 20rpx; border-radius: 999rpx; background: linear-gradient(135deg, #60a5fa, #a78bfa); border: none; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08); }
</style>


