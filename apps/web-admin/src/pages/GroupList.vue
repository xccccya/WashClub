<template>
  <div class="page">
    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索集团名称" style="width: 240px; margin-right: 12px" @keyup.enter="load" />
      <el-select v-model="sortBy" placeholder="排序字段" style="width: 140px; margin-right: 8px">
        <el-option label="创建时间" value="createdAt" />
        <el-option label="名称" value="name" />
        <el-option label="余额" value="balance" />
      </el-select>
      <el-select v-model="sortOrder" placeholder="顺序" style="width: 120px; margin-right: 8px">
        <el-option label="降序" value="desc" />
        <el-option label="升序" value="asc" />
      </el-select>
      <el-button type="primary" @click="load">查询</el-button>
      <el-button type="success" style="margin-left: 12px" @click="openCreate">新建集团</el-button>
    </div>

    <el-skeleton :loading="loading" animated :throttle="200">
      <template #template>
        <div style="padding:12px;">
          <el-skeleton-item variant="rect" style="height: 42px; margin-bottom: 10px;" />
          <el-skeleton-item v-for="i in 6" :key="i" variant="rect" style="height: 40px; margin: 6px 0;" />
        </div>
      </template>
      <template #default>
        <el-empty v-if="!items.length" description="暂无集团，点击右上角新建" />
        <el-table v-else :data="items" height="calc(100vh - 220px)" @row-dblclick="openDetail">
          <el-table-column prop="code" label="集团号" width="160">
            <template #default="{ row }">
              <el-tag class="code-tag" @click.stop="copyCode(row.code)" title="点击复制">{{ row.code }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="iconUrl" label="图标" width="80">
            <template #default="{ row }">
              <el-avatar :size="32" :src="absUrl(row.iconUrl || '')">G</el-avatar>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="160" />
          <el-table-column prop="memberCount" label="绑定人数" width="100">
            <template #default="{ row }">{{ row.memberCount ?? (row.members?.length || 0) }}</template>
          </el-table-column>
          <el-table-column prop="vehicleCount" label="车辆数" width="100" />
          <el-table-column prop="totalCardRemaining" label="卡余次" width="100" />
          <el-table-column label="余额" width="120">
            <template #default="{ row }">¥ {{ Number(row.balance?.balance ?? 0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="totalPaidAmount" label="累计消费(¥)" width="140">
            <template #default="{ row }">{{ Number(row.totalPaidAmount||0).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="createdAt" label="添加日期" width="180">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="280">
            <template #default="{ row }">
              <el-button size="small" type="primary" text @click="openDetail(row)">详情</el-button>
              <el-dropdown trigger="click">
                <el-button size="small">更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="jumpVehicles(row)">车辆</el-dropdown-item>
                    <el-dropdown-item @click="jumpCards(row)">卡</el-dropdown-item>
                    <el-dropdown-item @click="jumpBalance(row)">余额</el-dropdown-item>
                    <el-dropdown-item divided style="color: var(--el-color-danger);" @click="deleteWithConfirm(row)">删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-skeleton>

    <div class="pagination">
      <el-pagination :current-page="page" :page-size="pageSize" :total="total" :page-sizes="[10,20,50,100]" @current-change="(p:number)=>{page=p;load()}" @size-change="(s:number)=>{pageSize=s;page=1;load();}" layout="sizes, prev, pager, next, ->, total" />
    </div>

    <!-- 新建集团 -->
    <el-dialog v-model="createVisible" title="新建集团" width="560px">
      <el-form label-width="110px">
        <el-form-item label="集团名称" required>
          <el-input v-model="createForm.name" placeholder="请输入集团名称" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="集团图标">
          <div class="create-icon-row">
            <el-avatar :size="56" :src="absUrl(createForm.iconUrl || '')">G</el-avatar>
            <div class="create-icon-uploader">
              <FileInput v-model="createForm.iconUrl" placeholder="输入URL或从文件库选择" :auto-tags="['group-icon']" source="admin-group" />
              <div class="hint">建议正方形图片，至少 128x128px</div>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="管理员会员" required>
          <el-select
            v-model="createForm.firstAdminMemberId"
            filterable
            remote
            clearable
            :remote-method="searchMembersForCreate"
            :loading="memberLoadingForCreate"
            placeholder="搜索姓名/手机号，或下拉浏览"
            style="width: 100%;"
          >
            <el-option
              v-for="m in memberOptionsForCreate"
              :key="m.id"
              :label="`${m.id} - ${m.name} (${m.phone})`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible=false">取消</el-button>
        <el-button type="primary" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" size="50%" :title="detail?.name || '集团详情'">
      <div v-if="detail">
        <div class="detail-head">
          <div class="left">
            <div class="avatar-wrap">
              <el-avatar :size="64" :src="absUrl(((detailEdit.iconUrl !== undefined ? detailEdit.iconUrl : detail.iconUrl) || ''))">G</el-avatar>
            </div>
            <div class="meta">
              <div class="title-row">
                <el-input v-model="detailEdit.name" @keyup.enter="saveBasic" placeholder="集团名称" />
                <template v-if="hasIcon">
                  <el-button size="small" @click="openIconPicker">更换图标</el-button>
                  <el-button size="small" text type="danger" @click="clearIcon">清除</el-button>
                </template>
                <template v-else>
                  <el-button size="small" @click="openIconPicker">从文件库选择</el-button>
                  <el-upload :http-request="uploadIcon" :show-file-list="false" accept="image/*">
                    <el-button size="small" type="primary">上传图标</el-button>
                  </el-upload>
                </template>
              </div>
              <el-input v-model="detailEdit.remark" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="备注（选填）" />
            </div>
          </div>
          <div class="right">
            <el-button type="primary" @click="saveBasic">保存</el-button>
            <el-button @click="jumpVehicles(detail)">车辆</el-button>
            <el-button @click="jumpCards(detail)">卡</el-button>
            <el-button @click="jumpBalance(detail)">余额</el-button>
          </div>
        </div>

        <el-descriptions :column="3" border class="detail-stats">
          <el-descriptions-item label="集团号">{{ detail.code }}</el-descriptions-item>
          <el-descriptions-item label="余额">¥ {{ Number(detail.balance?.balance ?? 0).toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="车辆数">{{ detail.vehicleCount }}</el-descriptions-item>
          <el-descriptions-item label="卡余次">{{ detail.totalCardRemaining }}</el-descriptions-item>
          <el-descriptions-item label="成员数">{{ detail.members?.length || 0 }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <h3 style="margin:18px 0 8px;">成员管理</h3>
        <div style="display:flex;gap:8px;margin-bottom:8px; align-items:center;">
          <el-input v-model="addMemberIds" placeholder="输入会员ID，逗号分隔" style="width:280px" />
          <el-popover placement="bottom-start" trigger="click" :width="480">
            <template #reference>
              <el-button>搜索添加</el-button>
            </template>
            <div style="display:flex; gap:8px; margin-bottom:8px;">
              <el-input v-model="memberSearchKeyword" placeholder="搜索会员昵称/手机号" @keyup.enter="searchMembers" />
              <el-button type="primary" @click="searchMembers">搜索</el-button>
            </div>
            <el-table :data="memberSearchResult" height="260">
              <el-table-column prop="id" label="#" width="80" />
              <el-table-column prop="name" label="昵称" />
              <el-table-column prop="phone" label="手机号" width="140" />
              <el-table-column label="操作" width="120">
                <template #default="{ row }">
                  <el-button size="small" @click="appendMemberId(row.id)">加入</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-popover>
          <el-button type="primary" @click="addMembers">添加成员</el-button>
        </div>
        <el-table :data="detail.members || []" size="small">
          <el-table-column prop="member.id" label="会员ID" width="100" />
          <el-table-column prop="member.name" label="会员昵称" />
          <el-table-column prop="member.phone" label="手机号" />
          <el-table-column prop="role" label="角色" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.role==='ADMIN'" type="success">管理员</el-tag>
              <el-tag v-else type="info">成员</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220">
            <template #default="{ row }">
              <el-button size="small" @click="toggleAdmin(row)">{{ row.role==='ADMIN'?'取消管理员':'设为管理员' }}</el-button>
              <el-button size="small" type="danger" :disabled="row.role==='ADMIN'" @click="removeMember(row)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else style="padding:12px;">
        <el-skeleton :rows="6" animated></el-skeleton>
      </div>
    </el-drawer>
    <FilePickerDialog v-model="iconPickerVisible" title="选择集团图标" @picked="onIconPicked" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { absUrl } from '../utils/http';
import { API_BASE } from '../config';
import FileInput from './_components/FileInput.vue';
import FilePickerDialog from './_components/FilePickerDialog.vue';
import {
	groupControllerCreate,
	groupControllerGet,
	groupControllerList,
	groupControllerRemove,
	groupControllerUpdate,
	groupMemberControllerAdd,
	groupMemberControllerList,
	groupMemberControllerRemove,
	groupMemberControllerSetAdmin,
	memberControllerList,
} from '@wash/api-client';

const router = useRouter();
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const items = ref<any[]>([]);
const loading = ref(false);
const keyword = ref('');
const sortBy = ref<'createdAt'|'name'|'balance'>('createdAt');
const sortOrder = ref<'asc'|'desc'>('desc');

const createVisible = ref(false);
const createForm = ref({ name: '', iconUrl: '', firstAdminMemberId: undefined as any, remark: '' });
const memberOptionsForCreate = ref<any[]>([]);
const memberLoadingForCreate = ref(false);

const detailVisible = ref(false);
const detail = ref<any | null>(null);
const detailEdit = ref<any>({ name: '', iconUrl: '', remark: '' });
const iconPickerVisible = ref(false);
const hasIcon = computed(()=>{
  const v = detailEdit.value?.iconUrl;
  if (v === '') return false;
  return !!(v || detail.value?.iconUrl);
});
const addMemberIds = ref('');
const memberSearchKeyword = ref('');
const memberSearchResult = ref<any[]>([]);

function formatTime(v?: string){ if(!v) return '-'; try{ return new Date(v).toLocaleString(); }catch{ return String(v); } }

async function load(){
  loading.value = true;
  try{
    const res:any = await groupControllerList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value||undefined, sortBy: sortBy.value, sortOrder: sortOrder.value } as any);
    total.value = res?.total || 0;
    items.value = Array.isArray(res?.items) ? res.items : [];
  }finally{
    loading.value = false;
  }
}

function openCreate(){
  createVisible.value = true;
  searchMembersForCreate('');
}

async function doCreate(){
  if(!createForm.value.name || !createForm.value.firstAdminMemberId){ ElMessage.error('请填写完整'); return; }
  await groupControllerCreate(createForm.value as any);
  ElMessage.success('创建成功');
  createVisible.value = false;
  createForm.value = { name: '', iconUrl: '', firstAdminMemberId: undefined as any, remark: '' };
  await load();
}

async function openDetail(row: any){
  const id = row?.id || row;
  const res:any = await groupControllerGet(Number(id));
  detail.value = res;
  detailEdit.value = { name: res?.name, iconUrl: res?.iconUrl, remark: res?.remark || '' };
  detailVisible.value = true;
}

async function saveBasic(){
  if(!detail.value) return;
  const body:any = { ...detailEdit.value };
  if (Object.prototype.hasOwnProperty.call(detailEdit.value, 'iconUrl') && detailEdit.value.iconUrl === '') body.iconUrl = null;
  await groupControllerUpdate(Number(detail.value.id), body as any);
  ElMessage.success('已保存');
  await openDetail(detail.value.id);
  await load();
}

async function addMembers(){
  if(!detail.value) return;
  const ids = (addMemberIds.value||'').split(',').map(s=>Number(s.trim())).filter(n=>Number.isFinite(n));
  if(ids.length===0){ ElMessage.error('请输入会员ID'); return; }
  await groupMemberControllerAdd(Number(detail.value.id), { memberIds: ids } as any);
  ElMessage.success('添加成功');
  addMemberIds.value = '';
  await openDetail(detail.value.id);
}

async function toggleAdmin(row: any){
  if(!detail.value) return;
  const isAdmin = row.role !== 'ADMIN';
  await groupMemberControllerSetAdmin(Number(detail.value.id), Number(row.memberId), { isAdmin } as any);
  ElMessage.success('已更新');
  await openDetail(detail.value.id);
}

async function removeMember(row: any){
  if(!detail.value) return;
  await groupMemberControllerRemove(Number(detail.value.id), Number(row.memberId));
  ElMessage.success('已移除');
  await openDetail(detail.value.id);
}

load();

async function doDelete(row: any){
  const id = row?.id || row;
  await groupControllerRemove(Number(id));
  ElMessage.success('已删除');
  await load();
}

async function searchMembers(){
  const kw = (memberSearchKeyword.value||'').trim();
  if(!kw){ memberSearchResult.value = []; return; }
  const res:any = await memberControllerList({ page: 1, pageSize: 20, keyword: kw } as any);
  memberSearchResult.value = Array.isArray(res?.items) ? res.items : [];
}

function appendMemberId(id:number){
  const now = (addMemberIds.value||'').trim();
  const set = new Set<string>(now ? now.split(',').map(s=>s.trim()).filter(Boolean) : []);
  set.add(String(id));
  addMemberIds.value = Array.from(set).join(',');
}

function jumpVehicles(row:any){ router.push({ path: '/groups/vehicles', query: { groupId: row?.id || '' } }); }
function jumpCards(row:any){ router.push({ path: '/groups/cards', query: { groupId: row?.id || '' } }); }
function jumpBalance(row:any){ router.push({ path: '/groups/balance', query: { groupId: row?.id || '' } }); }

async function copyCode(code?: string){
  const s = String(code||'').trim(); if(!s) return;
  try { await navigator.clipboard.writeText(s); ElMessage.success('已复制集团号'); } catch { ElMessage.success('集团号：'+s); }
}

async function deleteWithConfirm(row:any){
  try{
    await ElMessageBox.confirm('确定删除该集团？请确认已清空成员/车辆/在用卡且余额为0', '确认', { type: 'warning' });
    await doDelete(row);
  }catch{}
}

async function searchMembersForCreate(q: string){
  memberLoadingForCreate.value = true;
  try{
    const res:any = await memberControllerList({ page: 1, pageSize: 50, keyword: (q||'').trim() || undefined } as any);
    memberOptionsForCreate.value = Array.isArray(res?.items) ? res.items : [];
  } finally { memberLoadingForCreate.value = false; }
}

function openIconPicker(){ iconPickerVisible.value = true; }
function clearIcon(){ detailEdit.value.iconUrl = ''; }
function onIconPicked(files: any[]){ try{ const f = Array.isArray(files)? files[0]: null; if (f && f.url) { detailEdit.value.iconUrl = absUrl(f.url); iconPickerVisible.value = false; } }catch{ iconPickerVisible.value=false; } }

async function uploadIcon(options:any){
  try{
    const file = options?.file as File;
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('dir', 'admin');
    fd.append('source', 'group-icon');
    const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` }, body: fd });
    const j = await res.json();
    if (res.ok && j?.url){ detailEdit.value.iconUrl = absUrl(j.url); }
    else {
      try{ const { ElMessage } = await import('element-plus'); ElMessage.error('上传失败'); }catch{}
    }
  } catch {
    try{ const { ElMessage } = await import('element-plus'); ElMessage.error('上传失败'); }catch{}
  }
}
</script>

<style scoped>
.page { padding: 16px; }
.toolbar { margin-bottom: 12px; }
.pagination { display:flex; justify-content:flex-end; padding: 10px 0; }

/* 详情头部样式优化 */
.detail-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:12px; }
.detail-head .left{ display:flex; gap:12px; align-items:flex-start; }
.detail-head .left .avatar-wrap{ width:64px; height:64px; flex-shrink:0; border-radius:12px; overflow:hidden; box-shadow: 0 6px 14px rgba(0,0,0,0.08); }
.detail-head .left .meta{ display:flex; flex-direction:column; gap:8px; min-width:320px; }
.detail-head .left .title-row{ display:flex; gap:8px; align-items:center; }
.detail-head .left .title-row :deep(.el-input){ flex:1; }

.detail-stats{ margin-bottom: 12px; }

/* 列表内元素微调 */
.code-tag{ cursor:pointer; }

/* 新建集团对话框 */
.create-icon-row{ display:flex; align-items:center; gap:12px; }
.create-icon-uploader{ display:flex; flex-direction:column; gap:6px; flex:1; }
.create-icon-uploader .hint{ font-size:12px; color: var(--el-text-color-secondary); }
</style>
