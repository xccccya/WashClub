<template>
  <view class="page gradient-bg">
    <view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
    <view class="nav">
      <image class="back" src="/static/icons/back.png" mode="aspectFit" @tap="goBack" />
      <text class="title">集团余额充值</text>
    </view>
    <view class="card gradient-trans">
      <view class="row"><text class="label">充值金额</text></view>
      <view class="quick-amounts">
        <view v-for="v in presets" :key="v" :class="['qa', amountSel===v?'active':'']" @tap="selectPreset(v)">¥{{ v }}</view>
        <view :class="['qa','custom', amountSel===-1?'active':'']" @tap="selectPreset(-1)">自定义</view>
      </view>
      <view v-if="amountSel===-1" class="custom-row">
        <text class="rmb">¥</text>
        <input class="input money" type="number" v-model="amount" placeholder="请输入金额" />
      </view>
      <view class="actions">
        <view role="button" class="btn primary" @tap="createOrder">创建充值订单</view>
      </view>
      <view v-if="orderNo" class="hint">已创建订单：{{ orderNo }}，正在跳转...</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { groupMiniappControllerMyGroupRecharge, groupMiniappControllerMyGroupSummary } from '@wash/api-client';

const { topSpacerHeight } = useSafeArea();

const amount = ref<string>('100');
const orderNo = ref<string>('');
const groupId = ref<number | null>(null);
const amountSel = ref<number>(100);
const presets = ref<number[]>([10,50,100,500]);

function goBack(){ try { uni.navigateBack(); } catch {} }

async function loadGroupId(){
  try {
    const summary:any = await groupMiniappControllerMyGroupSummary({} as any);
    groupId.value = summary?.hasGroup ? summary?.id : null;
  } catch {}
}

function selectPreset(v:number){ amountSel.value = v; if (v>0) amount.value = String(v); }

async function createOrder(){
  try{
    if (!groupId.value) { uni.showToast({ title:'未绑定集团', icon:'none' }); return; }
    const raw = String(amount.value||'').trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) { uni.showToast({ title:'金额格式不正确，最多两位小数', icon:'none' }); return; }
    const a = Number(raw); if (!isFinite(a) || a<=0) { uni.showToast({ title:'金额必须大于0', icon:'none' }); return; }
    if (a > 5000) { uni.showToast({ title:'单次金额不得超过5000', icon:'none' }); return; }
    const r: any = await groupMiniappControllerMyGroupRecharge({ amount: a } as any);
    orderNo.value = r?.no || '';
    uni.showToast({ title:'已创建订单', icon:'success' });
    // 跳转到订单详情
    if (orderNo.value){
      setTimeout(()=>{ try{ uni.navigateTo({ url: `/pages/order/detail?no=${encodeURIComponent(orderNo.value)}&src=created` }); }catch{} }, 300);
    }
  }catch(e:any){ uni.showToast({ title: e?.message || '创建失败', icon:'none' }); }
}

onMounted(loadGroupId);
</script>

<style scoped>
.page { padding: 12px; padding-bottom: calc(env(safe-area-inset-bottom) + 12px); min-height:100vh; box-sizing: border-box; }
.gradient-bg{ background: linear-gradient(180deg, #eaf3ff 0%, #fff7fb 60%, #ffffff 100%); }
.nav{ display:flex; align-items:center; gap:8px; padding: 6px 0; }
.back{ width:22px; height:22px; }
.title{ font-weight:600; font-size:16px; }
.card{ background:#fff; border-radius:12px; padding:12px; margin:12px 0; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
.gradient-trans{ background: linear-gradient(180deg, rgba(243,249,255,0.95) 0%, rgba(255,247,251,0.95) 100%); }
.row{ display:flex; align-items:center; justify-content: space-between; margin: 8px 0; }
.label{ color:#666; }
.input{ border:1px solid #eee; padding: 8px 10px; border-radius: 8px; margin-bottom: 12px; background: #fff; box-shadow: inset 0 0 0 999px rgba(255,255,255,0.6); }
.btn{ background: linear-gradient(90deg, #4f8cff, #a07bff); color:#fff; border-radius:999px; padding: 8px 14px; }
.hint{ margin-top:10px; color:#666; font-size:12px; }

/* 充值UI重构 */
.quick-amounts{ display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:10px; margin: 8px 0 12px; }
.qa{ text-align:center; padding:10px 12px; border:1px solid #e5e7eb; border-radius:10px; background:#fff; color:#111827; }
.qa.active{ border-color:#93c5fd; background:linear-gradient(180deg,#f0f9ff,#fff); color:#1e40af; }
.qa.custom{ grid-column: span 4; }
.custom-row{ display:flex; align-items:center; gap:6px; border:1px dashed #e5e7eb; border-radius:10px; padding:6px 8px; background:#fff; margin: 8px 0 12px; }
.rmb{ font-size:16px; color:#3b82f6; font-weight:600; }
.input.money{ flex:none; width:120px; height:32px; line-height:32px; margin:0; border:1px solid #e5e7eb; border-radius:8px; box-shadow:none; background:#f9fafb; padding:0 10px; font-size:14px; }
.actions{ display:flex; justify-content:flex-end; margin-top:6px; }
.btn.primary{ background: linear-gradient(90deg, #10b981, #22c55e); }
</style>
