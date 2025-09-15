<template>
  <view class="page gradient-bg">
    <view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
    <view class="nav">
      <image class="back" src="/static/icons/back.png" mode="aspectFit" @tap="goBack" />
      <text class="title">集团卡详情</text>
    </view>

    <view class="card">
      <view class="head">
        <text class="name">{{ card?.name || '集团洗车计次卡' }}</text>
        <text v-if="card?.status" class="badge">{{ card?.status==='ACTIVE' ? '使用中' : (card?.status==='EXPIRED' ? '已过期' : '未启用') }}</text>
      </view>
      <view class="meta">
        <text>卡号：{{ card?.cardNo || '-' }}</text>
        <text>余次：{{ card?.remainingTimes ?? '-' }}/{{ card?.totalTimes ?? '-' }}</text>
        <text>有效期：{{ expiryText || '永久' }}</text>
      </view>
      <view class="prog"><view class="prog-inner" :style="{ width: usedPercent + '%' }" /></view>
    </view>

    <view class="card">
      <view class="sub">使用与变更记录</view>
      <view v-if="logs.length===0" class="empty">暂无记录</view>
      <view v-else class="list">
        <view v-for="l in logs" :key="l.id" class="row">
          <view class="left">
            <view :class="['dot', nodeClass(l)]" />
          </view>
          <view class="right">
            <view class="r1">
              <text class="t">{{ titleText(l) }}</text>
              <text class="time">{{ formatTime(l.createdAt) }}</text>
            </view>
            <view class="r2">
              <text class="chip">{{ reasonText(l.reason) }}</text>
              <text class="muted">变更 {{ changeText(l) }} · 余 {{ l.beforeRemaining }}→{{ l.afterRemaining }}</text>
            </view>
            <view v-if="l.purchaseOrderNo || l.serviceOrderNo" class="r3">
              <view class="order-chip" @tap="gotoOrderNo(l.purchaseOrderNo || l.serviceOrderNo)">
                <text class="order-chip-label">关联订单：</text>
                <text class="order-chip-text">{{ l.purchaseOrderNo || l.serviceOrderNo }}</text>
                <text class="order-chip-arr">›</text>
              </view>
            </view>
            <view v-if="l.remark" class="remark">{{ l.remark }}</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useSafeArea } from '../../utils/safe-area';
import { createHttp, getToken } from '../../utils/auth';

const { topSpacerHeight } = useSafeArea();
const card = ref<any|null>(null);
const logs = ref<any[]>([]);

const expiryText = computed(()=>{ try { const v = card.value?.expiryAt; if (!v) return ''; const d=new Date(v); if (isNaN(d.getTime())) return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; } catch { return ''; } });
const usedPercent = computed(()=>{ const total=Math.max(1,Number(card.value?.totalTimes||0)); const remain=Math.max(0,Number(card.value?.remainingTimes||0)); const used=Math.max(0,total-remain); return Math.max(0,Math.min(100,Math.round((used/total)*100))); });

function goBack(){ try{ uni.navigateBack(); }catch{} }
function formatTime(v?: string){ if(!v) return ''; try{ const d=new Date(v as any); if (isNaN(d.getTime())) return ''; const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mm=String(d.getMinutes()).padStart(2,'0'); return `${y}-${m}-${dd} ${hh}:${mm}`; }catch{return ''} }
function changeText(l:any){ const c=Number(l?.change||0); return c>0?`+${c}`:String(c); }
function nodeClass(l:any){ if (l?.action==='ADD') return 'add'; if (l?.action==='DEDUCT') return 'deduct'; return ''; }
function titleText(l:any){ if (l?.action==='ADD') return `增加次数 ${changeText(l)}`; if(l?.action==='DEDUCT') return `划扣次数 ${changeText(l)}`; return '记录'; }
function reasonText(r?:string){ const v=String(r||'').toUpperCase(); if(v==='BACKEND_ADD') return '后台增加'; if(v==='PURCHASE_ADD') return '购买入账'; if(v==='SERVICE_DEDUCT') return '服务划扣'; if(v==='REFUND_DEDUCT') return '退款回退'; if(v==='BACKEND_DEDUCT') return '后台划扣'; return r||'-'; }
function gotoOrderNo(no?:string){ try{ const n=String(no||'').trim(); if(!n) return; uni.navigateTo({ url: `/pages/order/detail?no=${encodeURIComponent(n)}` }); }catch{} }

onLoad(async (query:any)=>{
  try{
    const id = Number(query?.id||NaN);
    if (!Number.isFinite(id)) { uni.showToast({ title:'参数错误', icon:'none' }); return; }
    if (!getToken()) { uni.navigateTo({ url:'/pages/login/index' }); return; }
    const http = createHttp();
    card.value = await http(`/group/miniapp/me/card/${id}`, { method:'GET' });
    const res:any = await http(`/group/miniapp/me/card/${id}/logs`, { method:'GET', query:{ page:1, pageSize: 20 } });
    logs.value = Array.isArray(res?.items) ? res.items : [];
  }catch{ card.value=null; logs.value=[]; }
});
</script>

<style scoped>
.page{ padding:12px; }
.gradient-bg{ background: linear-gradient(180deg, #eaf3ff 0%, #fff7fb 60%, #ffffff 100%); }
.nav{ display:flex; align-items:center; gap:8px; padding: 6px 0; }
.back{ width:22px; height:22px; }
.title{ font-weight:600; font-size:16px; }
.card{ background:#fff; border-radius:12px; padding:12px; margin: 10px 0; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
.head{ display:flex; align-items:center; gap:6px; }
.name{ font-weight:800; font-size:16px; }
.badge{ font-size:11px; color:#059669; background:#ecfdf5; border:1px solid #d1fae5; border-radius:999px; padding:1px 6px; }
.meta{ margin-top:6px; display:flex; gap:12px; color:#374151; font-size:12px; flex-wrap:wrap; }
.prog{ margin-top:8px; height:6px; background:#eef2ff; border-radius:999px; overflow:hidden; }
.prog-inner{ height:100%; background:linear-gradient(90deg,#60a5fa,#a78bfa); }
.sub{ font-size:13px; color:#111827; font-weight:700; margin-bottom:6px; }
.empty{ font-size:12px; color:#6b7280; padding:10px 0; text-align:center; }
.row{ display:flex; gap:10px; padding:10px 0; }
.left{ width:14px; display:flex; justify-content:center; }
.dot{ width:8px; height:8px; border-radius:999px; background:#94a3b8; margin-top:4px; }
.dot.add{ background:#10b981; }
.dot.deduct{ background:#ef4444; }
.right{ flex:1; border:1px solid #eef2ff; border-radius:10px; padding:8px; background:#fafcff; }
.r1{ display:flex; align-items:center; justify-content:space-between; }
.t{ font-size:14px; color:#0f172a; font-weight:700; }
.time{ font-size:11px; color:#94a3b8; }
.r2{ margin-top:4px; display:flex; align-items:center; gap:6px; }
.chip{ font-size:11px; color:#1e293b; background:#e2e8f0; padding: 0 6px; border-radius:999px; }
.muted{ font-size:12px; color:#64748b; }
.r3{ margin-top:4px; }
.link{ font-size:12px; color:#2563eb; }
.order-chip{ display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background: linear-gradient(90deg, #eff6ff, #f5f3ff); border:1px solid #e5e7eb; box-shadow: 0 4px 10px rgba(0,0,0,0.04); }
.order-chip-icon{ width:10px; height:10px; opacity:.6; }
.order-chip-label{ font-size:11px; color:#6b7280; }
.order-chip-text{ font-size:9px; color:#1f2937; font-weight:600; }
.order-chip-arr{ font-size:12px; color:#6b7280; padding-left:2px; }
.remark{ margin-top:6px; font-size:12px; color:#374151; background:#f8fafc; border:1px dashed #e5e7eb; border-radius:8px; padding:6px 8px; }
</style>


