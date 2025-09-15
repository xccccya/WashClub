<template>
  <view class="page gradient-bg">
    <view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
    <view class="nav">
      <image class="back" src="/static/icons/back.png" mode="aspectFit" @tap="goBack" />
      <text class="title">集团客户中心</text>
      <text v-if="isAdmin" class="title-badge">管理员</text>
    </view>

    <view class="card group-card gradient-trans">
      <view class="group-head">
        <image class="avatar" :src="groupInfo.iconUrl ? toAbs(groupInfo.iconUrl) : '/static/icons/jtuser.png'" mode="aspectFill" />
        <view class="meta">
          <view class="name">{{ groupInfo.name || '我的集团' }}</view>
          <view v-if="groupInfo.code" class="code-row">
            <text class="code-tag">{{ groupInfo.code }}</text>
          </view>
          <view class="greet">尊敬的集团客户，{{ greetText }}</view>
        </view>
      </view>
    </view>

    <view class="card account-card gradient-trans">
      <view class="row header">
        <text class="label">集团账户</text>
      </view>
      <view class="stats">
        <view class="stat">
          <text class="s-label">余额</text>
          <view class="s-value s-value-action">
            <view class="amount">
              <text class="currency">¥</text>
              <text class="num">{{ balance.toFixed(2) }}</text>
            </view>
            <view v-if="isAdmin" role="button" class="btn small" @tap="goRecharge">充值</view>
          </view>
        </view>
        <view class="divider"></view>
        <view class="stat">
          <text class="s-label">洗车卡余次</text>
          <view class="s-value">
            <text class="num">{{ totalCardTimes }}</text>
            <text class="unit">次</text>
          </view>
        </view>
      </view>
      <view class="section">
        <view class="ledger-toggle" @tap="toggleLedger">
          <text class="lt-right">
            <text class="lt-text">余额明细</text>
            <text class="lt-arr" :class="{ open: showLedger }">▾</text>
          </text>
        </view>
        <view v-if="showLedger" class="ledger-list">
          <view v-for="(it,idx) in ledger" :key="idx" class="ledger-item cardled" @tap="goOrderByNo(it.orderNo)" :hover-class="it.orderNo ? 'hover' : ''">
            <view class="li-top">
              <text class="badge-led" :class="badgeClass(it.type)">{{ typeLabel(it.type) }}</text>
              <text v-if="it.note" class="note">{{ it.note }}</text>
              <text class="a" :class="{ inc: Number(it.amount)>=0, dec: Number(it.amount)<0 }">{{ Number(it.amount)>=0? '+':'' }}{{ Number(it.amount).toFixed(2) }}</text>
            </view>
            <view class="li-order" v-if="it.orderNo">
              <view class="order-chip" role="button">
                <text class="order-chip-label">关联订单：</text>
                <text class="order-chip-text">{{ it.orderNo }}</text>
                <text class="order-chip-arr">›</text>
              </view>
            </view>
            <view class="li-time">
              <text class="d">{{ fmtTime(it.createdAt) }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="section">
        <view class="row"><text class="label">集团洗车卡</text><text class="section-tip">Tips:点击卡片可查看其使用详情</text></view>
        <view v-if="cards.length>0" class="list">
          <view v-for="c in cards" :key="c.id" :class="['gwc-item', statusClass(c)]" @tap="goGroupCard(c)">
            <view class="gwc-bg"></view>
            <view class="gwc-accent"></view>
            <view class="gwc-left">
              <view class="gwc-title-row">
                <text class="gwc-name">{{ c.name }}</text>
                <text v-if="c.status" class="gwc-badge">{{ String(c.status)==='ACTIVE' ? '使用中' : (String(c.status)==='EXPIRED' ? '已过期' : '未启用') }}</text>
              </view>
              <view class="gwc-meta">
                <text v-if="c.cardNo" class="gwc-meta-item">卡号 {{ c.cardNo }}</text>
                <text v-if="c.expiryAt" class="gwc-meta-item">有效期 {{ fmtDateShort(c.expiryAt) }}</text>
              </view>
              <view class="gwc-progress" v-if="Number(c.totalTimes)>0">
                <view class="gwc-progress-bar">
                  <view class="gwc-progress-inner" :style="{ width: (Math.min(100, Math.max(0, Math.round((Number(c.remainingTimes||0)/Number(c.totalTimes))*100)))) + '%' }" />
                </view>
                <text class="gwc-progress-text">{{ Number(c.remainingTimes||0) }}/{{ Number(c.totalTimes||0) }} 次</text>
              </view>
            </view>
            <view class="gwc-right">
              <view class="gwc-count">
                <text class="gwc-rem">{{ c.remainingTimes }}</text>
                <text class="gwc-unit">次</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty small">
          <image class="empty-icon small" src="/static/icons/empty.png" mode="aspectFit" />
          <text class="empty-text">暂无集团卡片</text>
        </view>
      </view>
    </view>

    <view class="card admin-card gradient-trans" v-if="isAdmin">
      <view class="row"><text class="label">成员管理</text></view>
      <view class="adder">
        <input class="adder-input" v-model="phoneInput" type="number" placeholder="输入会员手机号添加成员" />
        <view role="button" class="btn add" @tap="onAddMember">添加</view>
      </view>
      <view class="member-list">
        <view v-for="m in members" :key="m.memberId" class="admin-item">
          <view class="admin-main">
            <image class="admin-avatar" :src="m.avatarUrl ? toAbs(m.avatarUrl) : '/static/icons/jtuser.png'" mode="aspectFill" />
            <view class="admin-info">
              <text class="admin-name">{{ m.name || '成员' }}</text>
              <text class="admin-phone">{{ m.phone }}</text>
            </view>
          </view>
          <view class="admin-actions">
            <template v-if="String(m.role)==='ADMIN'">
              <text v-if="myMemberId && Number(m.memberId)===Number(myMemberId)" class="act me-tag">我</text>
              <text class="act admin-tag">管理员</text>
            </template>
            <text v-else class="act remove" @tap="onRemoveMember(m.memberId)">移除</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else-if="groupId && !isAdmin" class="card gradient-trans member-card">
      <view class="member-hint">
        <text class="member-title">温馨提示</text>
        <text class="member-msg">您是集团成员。需要余额充值/次卡续费请联系下方集团管理员操作。</text>
      </view>
      <view v-if="admins.length" class="admin-list">
        <view v-for="(a, i) in admins" :key="i" class="admin-item">
          <view class="admin-main">
            <image class="admin-avatar" :src="a.avatarUrl ? toAbs(a.avatarUrl) : '/static/icons/jtuser.png'" mode="aspectFill" />
            <view class="admin-info">
              <text class="admin-name">{{ a.name || '管理员' }}</text>
              <text class="admin-phone">{{ a.phone }}</text>
            </view>
          </view>
          <view class="admin-actions" v-if="a.phone">
            <text class="act copy" @tap="copyPhone(a.phone)">复制</text>
            <text class="act call" @tap="callPhone(a.phone)">拨号</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="!groupId" class="empty">
      <image class="empty-icon" src="/static/icons/empty.png" mode="aspectFit" />
      <text class="empty-text">您当前未绑定集团账号</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSafeArea } from '../../utils/safe-area';
import { API_BASE, createHttp } from '../../utils/auth';
declare const uni: any;

const { topSpacerHeight } = useSafeArea();

const token = ref<string| null>(null);
const isAdmin = ref(false);
const groupId = ref<number | null>(null);
const groupInfo = ref<any>({});
const balance = ref(0);
const ledger = ref<any[]>([]);
const cards = ref<any[]>([]);
const showLedger = ref(false);
const admins = ref<any[]>([]);
const totalCardTimes = computed(()=>{
  try{ return cards.value.reduce((s, c)=> s + Number(c?.remainingTimes||0), 0); }catch{ return 0; }
});
const phoneInput = ref('');
const members = ref<any[]>([]);
const myMemberId = ref<number | null>(null);

const greetText = computed(()=>{
  const h = new Date().getHours();
  if (h<6) return '夜深了'; if (h<12) return '早上好'; if (h<14) return '中午好'; if (h<19) return '下午好'; return '晚上好';
});

function toAbs(u?: string){
  if (!u) return '';
  try { if (/^https?:\/\//i.test(u)) return u; } catch {}
  if (u.startsWith('/')) return API_BASE + u;
  return API_BASE + '/' + u;
}

function goBack(){ try { uni.navigateBack(); } catch {} }
function fmtTime(v?: string){ if(!v) return ''; try{ return new Date(v).toLocaleString(); }catch{ return String(v); } }
function fmtDateShort(v?: string){ if(!v) return ''; try{ const d=new Date(v); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }catch{ return String(v); } }
function toggleLedger(){ showLedger.value = !showLedger.value; }
function goRecharge(){ try { uni.navigateTo({ url: '/pages/group/recharge' }); } catch {} }
function copyPhone(p: string){ try { uni.setClipboardData({ data: String(p) }); } catch {} }
function callPhone(p: string){ try { uni.makePhoneCall({ phoneNumber: String(p) }); } catch {} }

function statusClass(c: any){
  const s = String(c?.status||'').toUpperCase();
  if (s === 'ACTIVE') return 'st-active';
  if (s === 'EXPIRED') return 'st-expired';
  return 'st-disabled';
}

function typeLabel(t?: string){
  const s = String(t||'').toUpperCase();
  if (s==='RECHARGE') return '充值';
  if (s==='DEDUCT') return '扣减';
  if (s==='REFUND') return '退款';
  if (s==='ADJUST') return '调整';
  return s || '-';
}

function badgeClass(t?: string){
  const s = String(t||'').toUpperCase();
  if (s==='RECHARGE') return 'b-recharge';
  if (s==='DEDUCT') return 'b-deduct';
  if (s==='REFUND') return 'b-refund';
  if (s==='ADJUST') return 'b-adjust';
  return 'b-default';
}

async function onAddMember(){
  try{
    const phone = String(phoneInput.value||'').trim();
    if (!phone) { uni.showToast({ title:'请输入手机号', icon:'none' }); return; }
    const http = createHttp();
    const preview:any = await http('/group/miniapp/me/lookup-member-by-phone', { method:'GET', query:{ phone } });
    if (!preview) { uni.showToast({ title:'手机号未绑定会员', icon:'none' }); return; }
    const confirmText = `确认添加成员：${preview.name||''}（${preview.phone||phone}）？`;
    await new Promise((resolve, reject)=>{
      uni.showModal({ title:'确认添加', content: confirmText, success: (r)=>{ if(r.confirm){ resolve(null);} else { reject('cancel'); } } });
    });
    await http('/group/miniapp/me/members', { method:'POST', query:{ phone } });
    phoneInput.value='';
    uni.showToast({ title:'已添加', icon:'success' });
    try{ const ms = await http('/group/miniapp/me/members', { method: 'GET' }); members.value = Array.isArray(ms) ? ms : []; }catch{}
  }catch(e){ uni.showToast({ title: (e as any)?.message || '添加失败', icon:'none' }); }
}

async function onRemoveMember(memberId: number){
  try{
    await new Promise((resolve, reject)=>{
      uni.showModal({ title:'确认移除', content:'确认将该成员移出集团？', success:(r)=>{ if(r.confirm){ resolve(null);} else { reject('cancel'); } } });
    });
    const http = createHttp();
    await http('/group/miniapp/me/members/remove', { method:'POST', query:{ memberId } });
    uni.showToast({ title:'已移除', icon:'success' });
    try{ const ms = await http('/group/miniapp/me/members', { method: 'GET' }); members.value = Array.isArray(ms) ? ms : []; }catch{}
  }catch(e){ if((e as any)!=='cancel') uni.showToast({ title: (e as any)?.message || '操作失败', icon:'none' }); }
}

async function loadGroup(){
  try{
    const http = createHttp();
    // 直接使用小程序端汇总接口，减少多次请求
    const summary:any = await http('/group/miniapp/me/summary', { method: 'GET' });
    if (!summary?.hasGroup) { groupId.value = null; groupInfo.value = {}; balance.value = 0; ledger.value = []; cards.value = []; isAdmin.value = false; return; }
    groupId.value = summary.id;
    isAdmin.value = String(summary?.role||'') === 'ADMIN';
    groupInfo.value = { id: summary.id, name: summary.name, iconUrl: summary.iconUrl, code: summary.code };
    balance.value = Number(summary.balance||0);
    try{ const led = await http('/group/miniapp/me/ledger', { method: 'GET', query: { limit: 10 } }); ledger.value = Array.isArray(led) ? led : []; }catch{ ledger.value = []; }
    try{ const cs = await http('/group/miniapp/me/cards', { method: 'GET' }); cards.value = Array.isArray(cs) ? cs : []; }catch{ cards.value = []; }
    try{ const ads = await http('/group/miniapp/me/admins', { method: 'GET' }); admins.value = Array.isArray(ads) ? ads : []; }catch{ admins.value = []; }
    try{ const ms = await http('/group/miniapp/me/members', { method: 'GET' }); members.value = Array.isArray(ms) ? ms : []; }catch{ members.value = []; }
  }catch{}
}

function goOrderByNo(no?: string){ try{ const n = String(no||'').trim(); if (!n) return; uni.navigateTo({ url: `/pages/order/detail?no=${encodeURIComponent(n)}` }); }catch{} }
function goGroupCard(c: any){ try{ if (!c?.id) return; uni.navigateTo({ url: `/pages/group/washcard?id=${c.id}` }); }catch{} }

onMounted(()=>{ try { token.value = uni.getStorageSync('token'); const u = uni.getStorageSync('user'); const id = Number(u?.id); if (Number.isFinite(id)) myMemberId.value = id; } catch {}; loadGroup(); });
</script>

<style scoped>
.page { padding: 12px; padding-bottom: calc(env(safe-area-inset-bottom) + 12px); min-height:100vh; box-sizing: border-box; }
.gradient-bg{ background: linear-gradient(180deg, #eaf3ff 0%, #fff7fb 60%, #ffffff 100%); }
.nav{ display:flex; align-items:center; gap:8px; padding: 6px 0; }
.back{ width:22px; height:22px; }
.title{ font-weight:600; font-size:16px; }
.title-badge{ margin-left:4px; background:#e6fffb; color:#13c2c2; border:1px solid #87e8de; border-radius: 999px; font-size: 11px; padding: 2px 6px; }
.card{ background: #fff; border-radius: 12px; padding:12px; margin: 10px 0; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
.gradient-trans{ background: linear-gradient(180deg, rgba(243,249,255,0.95) 0%, rgba(255,247,251,0.95) 100%); }
.group-card{ position: relative; }
.group-head{ display:flex; align-items:center; gap:10px; }
.avatar{ width:48px; height:48px; border-radius:8px; background:#f2f2f2; }
.meta{ display:flex; flex-direction:column; gap:4px; }
.name{ font-weight:800; font-size:16px; display:block; }
.code-row{ margin-top:0; }
.greet{ color:#666; font-size:12px; }
.badge{ display:inline-block; background:#e6fffb; color:#13c2c2; border:1px solid #87e8de; border-radius: 6px; font-size: 12px; padding: 2px 6px; }
.code-tag{ display:inline-block; padding: 2px 8px; border-radius: 999px; background:#f5f5ff; color:#5959d6; border:1px solid #e3e3ff; font-size: 12px; font-weight:600; }
.row{ display:flex; align-items:center; justify-content: space-between; }
.label{ color:#666; }
.val{ font-weight:700; }
.actions{ margin-top:0; display:flex; justify-content:flex-end; }
.btn{ background: linear-gradient(90deg, #4f8cff, #a07bff); color:#fff; border-radius:999px; padding: 4px 10px; font-size:12px; }
.btn.small{ padding: 2px 8px; font-size:11px; }
.ledger-toggle{ color:#1677ff; margin-top:8px; }
.ledger-toggle{ display:flex; align-items:center; justify-content:flex-end; padding:4px 2px; border-top: 1px solid rgba(0,0,0,0.06); }
.lt-right{ display:flex; align-items:center; gap:4px; color:#6b7280; font-size:12px; font-weight:400; }
.lt-arr{ display:inline-block; transition: transform .2s ease; color:#6b7280; font-size:12px; }
.lt-arr.open{ transform: rotate(180deg); }
.ledger-list{ margin-top:8px; display:flex; flex-direction:column; gap:6px; }
.ledger-item{ display:block; font-size:12px; color:#444; }
.li-top{ display:flex; align-items:center; gap:8px; }
.cardled{ background:#fff; border:1px solid #eef2ff; border-radius:10px; padding:8px 10px; }
.ledger-item .t{ min-width:64px; color:#999; }
.ledger-item .a.inc{ color:#16a34a; }
.ledger-item .a.dec{ color:#dc2626; }
.ledger-item .a{ margin-left:auto; font-weight:700; }
.li-time{ display:flex; justify-content:flex-end; margin-top:2px; }
.li-order{ display:flex; justify-content:flex-end; margin-top:2px; }
.order-link{ color:#2563eb; font-size:11px; }
.order-chip{ display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; background: linear-gradient(90deg, #eff6ff, #f5f3ff); border:1px solid #e5e7eb; box-shadow: 0 4px 10px rgba(0,0,0,0.04); }
.order-chip-icon{ width:10px; height:10px; opacity:.6; }
.order-chip-label{ font-size:11px; color:#6b7280; }
.order-chip-text{ font-size:9px; color:#1f2937; font-weight:600; }
.order-chip-arr{ font-size:12px; color:#6b7280; padding-left:2px; }
.ledger-item .d{ color:#6b7280; font-size:11px; }
.note{ flex:1; min-width:0; color:#6b7280; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.li-bottom{ display:flex; align-items:center; justify-content:space-between; margin-top:2px; }
.li-time{ display:flex; justify-content:flex-end; margin-top:2px; }
.badge-led{ font-size:11px; padding:2px 6px; border-radius:999px; border:1px solid transparent; }
.b-recharge{ background:#ecfdf5; color:#047857; border-color:#d1fae5; }
.b-deduct{ background:#fff7ed; color:#9a3412; border-color:#fed7aa; }
.b-refund{ background:#f0f9ff; color:#075985; border-color:#bae6fd; }
.b-adjust{ background:#f5f3ff; color:#5b21b6; border-color:#ddd6fe; }
.note{ margin-left:8px; color:#6b7280; }
.card-item{ display:flex; align-items:center; justify-content: space-between; padding:8px 0; border-bottom: 1px dashed #eee; }
.empty{ padding:24px 0; display:flex; flex-direction:column; align-items:center; color:#666; }
.empty-icon{ width:80px; height:80px; opacity:0.6; margin-bottom:8px; }
.empty-text{ font-size:13px; }

/* 账户卡片合并样式 */
.account-card{ padding-top: 10px; }
.account-card .header{ margin-bottom:6px; }
.stats{ display:flex; align-items:stretch; justify-content:space-between; gap:10px; background:linear-gradient(180deg, #ffffff, #f8fbff); border:1px solid #eef2ff; border-radius:10px; padding:10px; }
.stat{ flex:1; display:flex; flex-direction:column; gap:6px; }
.s-label{ color:#6b7280; font-size:12px; }
.s-value{ display:flex; align-items:baseline; gap:4px; }
.s-value-action{ align-items:center; justify-content:space-between; }
.divider{ width:1px; background:#eef2ff; }
.section{ margin-top:12px; }

/* 洗车卡视觉美化 */
.gwc-item{ position:relative; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 12px; margin-top:10px; border-radius:12px; overflow:hidden; }
.gwc-bg{ position:absolute; inset:0; background:linear-gradient(135deg, rgba(79,140,255,0.08), rgba(160,123,255,0.08)); pointer-events:none; }
.gwc-accent{ position:absolute; left:0; top:0; bottom:0; width:4px; background:linear-gradient(180deg, #60a5fa, #a78bfa); opacity:0.9; }
.gwc-left{ position:relative; flex:1; min-width:0; }
.gwc-right{ position:relative; display:flex; align-items:center; margin-left:10px; }
.gwc-name{ font-weight:800; color:#111827; }
.gwc-badge{ margin-left:6px; font-size:11px; color:#059669; background:#ecfdf5; border:1px solid #d1fae5; border-radius:999px; padding:1px 6px; }
.gwc-title-row{ display:flex; align-items:center; min-width:0; }
.section-tip{ margin-left:8px; font-size:11px; color:#6b7280; }
.gwc-meta{ margin-top:4px; display:flex; flex-wrap:wrap; gap:8px; color:#374151; font-size:12px; }
.gwc-meta-item{ background:rgba(255,255,255,0.6); border:1px solid #eef2ff; border-radius:999px; padding:2px 6px; }
.gwc-progress{ margin-top:8px; display:flex; align-items:center; gap:8px; }
.gwc-progress-bar{ position:relative; height:6px; background:#eef2ff; border-radius:999px; flex:1; overflow:hidden; }
.gwc-progress-inner{ position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg, #60a5fa, #a78bfa); border-radius:999px; }
.gwc-progress-text{ color:#6b7280; font-size:12px; }
.gwc-count{ display:flex; align-items:baseline; gap:4px; padding:6px 10px; border-radius:999px; background:linear-gradient(90deg, #f0f9ff, #f5f3ff); border:1px solid #e5e7eb; }
.gwc-rem{ font-size:20px; font-weight:800; color:#111827; }
.gwc-unit{ color:#6b7280; font-size:12px; }

/* 状态配色 */
.st-active{ border:1px solid #dbeafe; }
.st-disabled{ border:1px solid #e5e7eb; }
.st-expired{ border:1px solid #fee2e2; }
.st-disabled .gwc-accent{ background:linear-gradient(180deg, #d1d5db, #e5e7eb); }
.st-expired .gwc-accent{ background:linear-gradient(180deg, #f87171, #fca5a5); }
.st-disabled .gwc-badge{ color:#6b7280; background:#f3f4f6; border-color:#e5e7eb; }
.st-expired .gwc-badge{ color:#b91c1c; background:#fef2f2; border-color:#fecaca; }

/* 成员视角提示与管理员列表 */
.member-card{ padding-top: 14px; }
.member-hint{ background:#fff; border:1px dashed #e5e7eb; border-radius: 10px; padding:10px; display:flex; flex-direction:column; gap:6px; }
.member-title{ font-size:12px; color:#6b7280; }
.member-msg{ font-size:13px; color:#111827; line-height:1.5; }
.admin-list{ margin-top:10px; display:flex; flex-direction:column; gap:10px; }
.admin-item{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border-radius:10px; background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%); border:1px solid #eef2ff; }
.admin-main{ display:flex; align-items:center; gap:10px; }
.admin-avatar{ width:40px; height:40px; border-radius:50%; background:#f3f4f6; }
.admin-info{ display:flex; flex-direction:column; line-height:1.35; }
.admin-name{ font-weight:700; color:#111827; }
.admin-phone{ color:#6b7280; font-size:12px; }
.admin-actions{ display:flex; align-items:center; gap:8px; }
.act{ padding:4px 8px; border-radius:999px; font-size:12px; }
.act.copy{ background:#f3f4ff; color:#4f46e5; border:1px solid #e0e7ff; }
.act.call{ background:#ecfdf5; color:#047857; border:1px solid #d1fae5; }
.admin-tag{ background:#ecfdf5; color:#059669; border:1px solid #d1fae5; }
.remove{ background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; }
.adder{ display:flex; align-items:center; gap:8px; margin:8px 0 10px; }
.adder-input{ flex:1; height:32px; line-height:32px; padding:0 10px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; font-size:14px; }
.btn.add{ background:linear-gradient(90deg, #10b981, #22c55e); border:none; color:#fff; padding: 6px 12px; }
.member-list{ display:flex; flex-direction:column; gap:10px; }
.me-tag{ margin-left:6px; font-size:11px; color:#2563eb; background:#eff6ff; border:1px solid #bfdbfe; padding:1px 6px; border-radius:999px; }
</style>
