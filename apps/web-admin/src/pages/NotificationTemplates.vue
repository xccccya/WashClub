<template>
	<div>
		<el-tabs v-model="activeTab">
			<el-tab-pane label="用户通知" name="user">
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
					<el-input v-model="q" placeholder="按类型/内容搜索" style="width:280px;" @keyup.enter="load" />
					<el-button type="primary" @click="load">搜索</el-button>
					<el-button @click="openCreate">新增模板</el-button>
				</div>
				<el-table :data="list" style="width:100%">
					<el-table-column prop="id" label="ID" width="80" />
					<el-table-column prop="typeKey" label="类型" width="220">
						<template #default="{ row }">
							<span>{{ labelOf(row.typeKey) }}</span>
						</template>
					</el-table-column>
					<el-table-column prop="titleTemplate" label="标题模板" />
					<el-table-column prop="contentTemplate" label="正文模板" />
					<el-table-column prop="enabled" label="启用" width="120">
						<template #default="{ row }">
							<el-switch v-model="row.enabled" @change="onToggle(row)" />
						</template>
					</el-table-column>
					<el-table-column label="操作" width="220">
						<template #default="{ row }">
							<el-button size="small" @click="openEdit(row)">编辑</el-button>
							<el-popconfirm title="确定删除该模板吗？" @confirm="delTpl(row)">
								<template #reference>
									<el-button size="small" type="danger" plain>删除</el-button>
								</template>
							</el-popconfirm>
						</template>
					</el-table-column>
				</el-table>

				<el-dialog v-model="dlgVisible" :title="dlgMode==='create'?'新增模板':'编辑模板'" width="760px">
					<el-form :model="form" label-width="96px">
						<el-form-item label="类型键" v-if="dlgMode==='create'">
							<el-select v-model="form.typeKey" placeholder="选择类型键" @change="loadVars">
								<el-option v-for="k in defaultKeys" :key="k.key" :label="k.label" :value="k.key" />
							</el-select>
						</el-form-item>
						<el-form-item label="标题模板">
							<el-input ref="titleRef" v-model="form.titleTemplate" placeholder="如：订单{{no}}支付成功" @focus="activeField='title'" />
						</el-form-item>
						<el-form-item label="正文模板">
							<el-input ref="contentRef" v-model="form.contentTemplate" type="textarea" :rows="4" placeholder="如：您于{{paidAt}}支付{{amount}}元" @focus="activeField='content'" />
						</el-form-item>
						<el-form-item label="可用变量">
							<div>
								<el-button size="small" @click="loadVars" style="margin-bottom:6px;">刷新变量</el-button>
								<div class="vars">
									<el-tag v-for="v in variables" :key="v.key" class="var" @click="insertVar(v.key)" type="info">
										<span class="var-code" v-text="formatVar(v.key)"></span>
										<span class="hint">{{ v.label }}</span>
									</el-tag>
								</div>
							</div>
						</el-form-item>
						<el-form-item label="启用">
							<el-switch v-model="form.enabled" />
						</el-form-item>
					</el-form>
					<template #footer>
						<el-button @click="dlgVisible=false">取消</el-button>
						<el-button type="primary" @click="onSave">保存</el-button>
					</template>
				</el-dialog>
			</el-tab-pane>
			<el-tab-pane label="管理通知" name="admin">
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
					<el-input v-model="q2" placeholder="按类型/内容搜索" style="width:280px;" @keyup.enter="loadAdmin" />
					<el-button type="primary" @click="loadAdmin">搜索</el-button>
					<el-button @click="openAdminCreate">新增模板</el-button>
				</div>
				<el-table :data="listAdmin" style="width:100%">
					<el-table-column prop="id" label="ID" width="80" />
					<el-table-column prop="typeKey" label="类型" width="220">
						<template #default="{ row }">
							<span>{{ adminLabelOf(row.typeKey) }}</span>
						</template>
					</el-table-column>
					<el-table-column prop="titleTemplate" label="标题模板" />
					<el-table-column prop="contentTemplate" label="正文模板" />
					<el-table-column prop="uiType" label="类型" width="120" />
					<el-table-column prop="uiPosition" label="位置" width="140" />
					<el-table-column prop="uiDuration" label="时长(ms)" width="120" />
					<el-table-column prop="enabled" label="启用" width="120">
						<template #default="{ row }">
							<el-switch v-model="row.enabled" @change="onAdminToggle(row)" />
						</template>
					</el-table-column>
					<el-table-column label="操作" width="260">
						<template #default="{ row }">
							<el-button size="small" @click="openAdminEdit(row)">编辑</el-button>
							<el-popconfirm title="确定删除该模板吗？" @confirm="delAdminTpl(row)">
								<template #reference>
									<el-button size="small" type="danger" plain>删除</el-button>
								</template>
							</el-popconfirm>
							<el-button size="small" @click="previewAdmin(row)">预览</el-button>
						</template>
					</el-table-column>
				</el-table>

				<el-dialog v-model="dlgAdminVisible" :title="dlgAdminMode==='create'?'新增管理通知模板':'编辑管理通知模板'" width="820px">
					<el-form :model="formAdmin" label-width="120px">
						<el-form-item label="类型键" v-if="dlgAdminMode==='create'">
							<el-select v-model="formAdmin.typeKey" placeholder="选择类型键" @change="loadAdminVars">
								<el-option v-for="k in adminKeys" :key="k.key" :label="k.label" :value="k.key" />
							</el-select>
						</el-form-item>
						<el-form-item label="标题模板">
							<el-input ref="adminTitleRef" v-model="formAdmin.titleTemplate" placeholder="如：新订单 {{no}}" @focus="adminActiveField='title'" />
						</el-form-item>
						<el-form-item label="正文模板">
							<el-input ref="adminContentRef" v-model="formAdmin.contentTemplate" type="textarea" :rows="4" placeholder="如：实付￥{{amount}}，类型：{{type}}" @focus="adminActiveField='content'" />
						</el-form-item>
						<el-form-item label="通知类型 type">
							<el-select v-model="formAdmin.uiType" placeholder="选择类型">
								<el-option v-for="t in uiTypes" :key="t" :label="t" :value="t" />
							</el-select>
						</el-form-item>
						<el-form-item label="弹出位置 position">
							<el-select v-model="formAdmin.uiPosition" placeholder="选择位置">
								<el-option v-for="p in uiPositions" :key="p" :label="p" :value="p" />
							</el-select>
						</el-form-item>
						<el-form-item label="展示时长 duration(ms)">
							<el-input v-model.number="formAdmin.uiDuration" placeholder="如：4500，0表示不自动关闭" />
						</el-form-item>
						<el-form-item label="可用变量">
							<div>
								<el-button size="small" @click="loadAdminVars" style="margin-bottom:6px;">刷新变量</el-button>
								<div class="vars">
									<el-tag v-for="v in variablesAdmin" :key="v.key" class="var" @click="insertAdminVar(v.key)" type="info">
										<span class="var-code" v-text="formatVar(v.key)"></span>
										<span class="hint">{{ v.label }}</span>
									</el-tag>
								</div>
							</div>
						</el-form-item>
						<el-form-item label="启用">
							<el-switch v-model="formAdmin.enabled" />
						</el-form-item>
					</el-form>
					<template #footer>
						<el-button @click="dlgAdminVisible=false">取消</el-button>
						<el-button type="primary" @click="onAdminSave">保存</el-button>
					</template>
				</el-dialog>
			</el-tab-pane>
			<el-tab-pane label="微信小程序订阅消息通知" name="wxapp">
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
					<el-input v-model="q3" placeholder="按类型/TemplateId搜索" style="width:320px;" @keyup.enter="loadWxapp" />
					<el-button type="primary" @click="loadWxapp">搜索</el-button>
					<el-button @click="openWxappCreate">新增模板</el-button>
				</div>
				<el-table :data="listWxapp" style="width:100%">
					<el-table-column prop="id" label="ID" width="80" />
					<el-table-column prop="typeKey" label="类型" width="260">
						<template #default="{ row }">
							<span>{{ wxappLabelOf(row.typeKey) }}</span>
						</template>
					</el-table-column>
					<el-table-column prop="wxTemplateId" label="TemplateId" min-width="380" />
					<el-table-column prop="wxPagePathTemplate" label="page(可选)" min-width="260" />
					<el-table-column prop="enabled" label="启用" width="120">
						<template #default="{ row }">
							<el-switch v-model="row.enabled" @change="onWxappToggle(row)" />
						</template>
					</el-table-column>
					<el-table-column label="操作" width="220">
						<template #default="{ row }">
							<el-button size="small" @click="openWxappEdit(row)">编辑</el-button>
							<el-popconfirm title="确定删除该模板吗？" @confirm="delWxappTpl(row)">
								<template #reference>
									<el-button size="small" type="danger" plain>删除</el-button>
								</template>
							</el-popconfirm>
						</template>
					</el-table-column>
				</el-table>

				<el-dialog v-model="dlgWxappVisible" :title="dlgWxappMode==='create'?'新增订阅消息模板':'编辑订阅消息模板'" width="860px">
					<el-form :model="formWxapp" label-width="140px">
						<el-form-item label="类型键" v-if="dlgWxappMode==='create'">
							<el-select v-model="formWxapp.typeKey" placeholder="选择类型键">
								<el-option v-for="k in wxappKeys" :key="k.key" :label="k.label" :value="k.key" />
							</el-select>
						</el-form-item>
						<el-form-item label="微信 TemplateId">
							<el-input v-model="formWxapp.wxTemplateId" placeholder="如：YWsR4q9nW4cIbo6CZQanut-A94erfJOnfwqhxDcQMxQ" />
						</el-form-item>
						<el-form-item label="跳转 page(可选)">
							<el-input v-model="formWxapp.wxPagePathTemplate" placeholder="如：pages/washcard/detail?id={{cardId}}" />
							<div style="color:#909399;font-size:12px;margin-top:6px;">
								page 支持 <code v-pre>{{var}}</code> 渲染；建议用于跳转到次卡详情页。
							</div>
						</el-form-item>
						<el-form-item label="miniprogram_state">
							<el-select v-model="formWxapp.wxMiniprogramState" placeholder="formal">
								<el-option label="formal(正式)" value="formal" />
								<el-option label="trial(体验)" value="trial" />
								<el-option label="developer(开发)" value="developer" />
							</el-select>
						</el-form-item>
						<el-form-item label="lang">
							<el-input v-model="formWxapp.wxLang" placeholder="zh_CN" />
						</el-form-item>
						<el-form-item label="启用">
							<el-switch v-model="formWxapp.enabled" />
						</el-form-item>
					</el-form>
					<template #footer>
						<el-button @click="dlgWxappVisible=false">取消</el-button>
						<el-button type="primary" @click="onWxappSave">保存</el-button>
					</template>
				</el-dialog>
			</el-tab-pane>
			<el-tab-pane label="通知类型设置" name="types">
				<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
					<el-select v-model="typeChannel" style="width:180px;" @change="loadTypeSettings">
						<el-option label="用户通知(MEMBER)" value="MEMBER" />
						<el-option label="管理通知(ADMIN)" value="ADMIN" />
						<el-option label="订阅消息(WXAPP)" value="WXAPP" />
					</el-select>
					<el-button type="primary" @click="loadTypeSettings">刷新</el-button>
					<el-button @click="initTypes">初始化常见类型</el-button>
				</div>
				<el-table :data="typeSettings" style="width:100%">
					<el-table-column prop="typeKey" label="类型键" width="260" />
					<el-table-column prop="enabled" label="启用" width="120">
						<template #default="{ row }">
							<el-switch v-model="row.enabled" @change="saveType(row)" />
						</template>
					</el-table-column>
					<el-table-column prop="allowFallback" label="无模板回退" width="140">
						<template #default="{ row }">
							<el-switch v-model="row.allowFallback" @change="saveType(row)" />
						</template>
					</el-table-column>
					<el-table-column v-if="typeChannel==='ADMIN'" label="默认UI" min-width="380">
						<template #default="{ row }">
							<div style="display:flex;gap:8px;align-items:center;">
								<el-select v-model="row.defaultUi.type" placeholder="type" style="width:120px" @change="saveType(row)">
									<el-option v-for="t in uiTypes" :key="t" :label="t" :value="t" />
								</el-select>
								<el-select v-model="row.defaultUi.position" placeholder="position" style="width:160px" @change="saveType(row)">
									<el-option v-for="p in uiPositions" :key="p" :label="p" :value="p" />
								</el-select>
								<el-input v-model.number="row.defaultUi.duration" placeholder="duration(ms)" style="width:160px" @change="saveType(row)" />
							</div>
						</template>
					</el-table-column>
				</el-table>
			</el-tab-pane>
		</el-tabs>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import {
	notificationControllerInitTypeSettings,
	notificationControllerListTypeSettings,
	notificationControllerUpsertTypeSetting,
	notificationTemplateControllerCreate,
	notificationTemplateControllerList,
	notificationTemplateControllerRemove,
	notificationTemplateControllerUpdate,
	notificationTemplateControllerVariables,
} from '@wash/api-client';
import { ElMessage } from 'element-plus';
import { ElNotification } from 'element-plus';

type Tpl = { id:number; typeKey:string; titleTemplate:string; contentTemplate:string; enabled:boolean };
const list = ref<Tpl[]>([]);
const q = ref('');
const activeTab = ref<'user'|'admin'|'wxapp'|'types'>('user');

type AdminTpl = { id:number; typeKey:string; titleTemplate:string; contentTemplate:string; enabled:boolean; uiType?:string|null; uiPosition?:string|null; uiDuration?:number|null };
const listAdmin = ref<AdminTpl[]>([]);
const q2 = ref('');
const adminKeys = [ { key:'ADMIN_NEW_ORDER', label:'新订单提醒' } ];
const uiTypes = ['primary','success','warning','info','error'];
const uiPositions = ['top-right','top-left','bottom-right','bottom-left'];
type TypeSetting = { id:number; typeKey:string; channel:'MEMBER'|'ADMIN'|'WXAPP'; enabled:boolean; allowFallback:boolean; defaultUi?: { type?:string; position?:string; duration?:number } };
const typeSettings = ref<TypeSetting[]>([]);
const typeChannel = ref<'MEMBER'|'ADMIN'|'WXAPP'>('MEMBER');

const defaultKeys = [
    { key:'ORDER_PAID', label:'订单支付成功' },
    { key:'SERVICE_DONE', label:'服务订单服务结束' },
    { key:'COUPON_WILL_EXPIRE', label:'券将过期' },
    { key:'REFUND_ARRIVED', label:'退款到账' },
    { key:'WASH_CARD_PAY_DEDUCT', label:'洗车卡支付划扣' },
    { key:'WASH_CARD_DEDUCT', label:'洗车卡划扣' },
];

// WXAPP：订阅消息模板类型
const wxappKeys = [
	{ key:'WASH_CARD_CONSUME', label:'次卡消费通知（39297）' },
];

async function load(){
	try{
		const params: any = q.value ? { q: q.value, channel: 'MEMBER' } : { channel: 'MEMBER' };
		const listRaw:any[] = (await notificationTemplateControllerList(params) as unknown) as any[];
		list.value = Array.isArray(listRaw)? listRaw: [];
	} catch { list.value=[]; }
}

const dlgVisible = ref(false);
const dlgMode = ref<'create'|'edit'>('create');
const form = ref<Partial<Tpl>>({ enabled: true });
const variables = ref<{ key:string; label:string }[]>([]);
const titleRef = ref();
const contentRef = ref();
const activeField = ref<'title'|'content'>('content');

function openCreate(){ dlgMode.value='create'; form.value = { enabled:true, typeKey: defaultKeys[0].key, titleTemplate:'', contentTemplate:'' }; dlgVisible.value=true; loadVars(); }
function openEdit(row: Tpl){ dlgMode.value='edit'; form.value = { id: row.id, typeKey: row.typeKey, titleTemplate: row.titleTemplate, contentTemplate: row.contentTemplate, enabled: row.enabled }; dlgVisible.value=true; loadVars(); }

async function onSave(){
    try{
        if (dlgMode.value==='create'){
            await notificationTemplateControllerCreate({ typeKey: form.value.typeKey, titleTemplate: form.value.titleTemplate, contentTemplate: form.value.contentTemplate, enabled: form.value.enabled!==false, channel: 'MEMBER' } as any);
        } else {
            await notificationTemplateControllerUpdate(String(form.value.id), { titleTemplate: form.value.titleTemplate, contentTemplate: form.value.contentTemplate, enabled: form.value.enabled!==false } as any);
        }
        ElMessage.success('已保存'); dlgVisible.value=false; load();
    }catch(e:any){ ElMessage.error(String(e?.message||'保存失败')); }
}

async function onToggle(row: Tpl){
    try{
        await notificationTemplateControllerUpdate(String(row.id), { enabled: !!row.enabled } as any);
        ElMessage.success('已更新');
        // 自动刷新，确保同类型其它模板禁用状态同步
        load();
    }catch{ ElMessage.error('更新失败'); }
}

async function delTpl(row: Tpl){
    try{ await notificationTemplateControllerRemove(String(row.id)); ElMessage.success('已删除'); load(); }
    catch{ ElMessage.error('删除失败'); }
}

async function loadVars(){
    try{
        const typeKey = form.value.typeKey || defaultKeys[0].key;
        const arr:any = await notificationTemplateControllerVariables({ typeKey } as any);
        variables.value = Array.isArray(arr)? arr: [];
    }catch{ variables.value = []; }
}
function getNativeInput(elInput:any): HTMLInputElement | HTMLTextAreaElement | null {
    try{
        const root = elInput?.$el as HTMLElement;
        if (!root) return null;
        return (root.querySelector('textarea, input') as any) || null;
    }catch{ return null; }
}
function insertAtCaret(modelKey:'titleTemplate'|'contentTemplate', token:string){
    const comp = modelKey==='titleTemplate' ? titleRef.value : contentRef.value;
    const inputEl = getNativeInput(comp);
    const current = String((form.value as any)[modelKey] || '');
    if (inputEl && typeof (inputEl as any).selectionStart === 'number'){
        const start = (inputEl as any).selectionStart as number;
        const end = (inputEl as any).selectionEnd as number;
        const next = current.slice(0, start) + token + current.slice(end);
        (form.value as any)[modelKey] = next;
        nextTick(()=>{
            try{
                const pos = start + token.length;
                (inputEl as any).focus();
                (inputEl as any).setSelectionRange(pos, pos);
            }catch{}
        });
    } else {
        (form.value as any)[modelKey] = current + token;
    }
}
function insertVar(key:string){
    const token = `{{${key}}}`;
    const target: 'titleTemplate'|'contentTemplate' = activeField.value==='title' ? 'titleTemplate' : 'contentTemplate';
    insertAtCaret(target, token);
}
function formatVar(k:string){ return `{{${k}}}`; }

function labelOf(k:string){
    const f = defaultKeys.find(it=>it.key===k);
    return f ? f.label : k;
}

function adminLabelOf(k:string){
    const f = adminKeys.find(it=>it.key===k);
    return f ? f.label : k;
}

onMounted(()=>{ load(); });

// 管理通知：CRUD
async function loadAdmin(){
	try{
		const params: any = { q: q2.value || undefined, channel: 'ADMIN' };
		const listRaw:any[] = (await notificationTemplateControllerList(params) as unknown) as any[];
		listAdmin.value = Array.isArray(listRaw)? listRaw: [];
	} catch { listAdmin.value=[]; }
}

const dlgAdminVisible = ref(false);
const dlgAdminMode = ref<'create'|'edit'>('create');
const formAdmin = ref<Partial<AdminTpl & { enabled:boolean; typeKey:string; uiType?:string|null; uiPosition?:string|null; uiDuration?:number|null }>>({ enabled: true, uiType: 'primary', uiPosition: 'top-right', uiDuration: 4500 });
const variablesAdmin = ref<{ key:string; label:string }[]>([]);
const adminTitleRef = ref();
const adminContentRef = ref();
const adminActiveField = ref<'title'|'content'>('content');

function openAdminCreate(){ dlgAdminMode.value='create'; formAdmin.value = { enabled:true, typeKey: adminKeys[0].key, titleTemplate:'', contentTemplate:'', uiType:'primary', uiPosition:'top-right', uiDuration:4500 }; dlgAdminVisible.value=true; loadAdminVars(); }
function openAdminEdit(row: AdminTpl){ dlgAdminMode.value='edit'; formAdmin.value = { id: row.id, typeKey: row.typeKey, titleTemplate: row.titleTemplate, contentTemplate: row.contentTemplate, enabled: row.enabled, uiType: row.uiType || 'primary', uiPosition: row.uiPosition || 'top-right', uiDuration: (row.uiDuration ?? 4500) }; dlgAdminVisible.value=true; loadAdminVars(); }

async function onAdminSave(){
    try{
        const payload:any = { titleTemplate: formAdmin.value.titleTemplate, contentTemplate: formAdmin.value.contentTemplate, enabled: formAdmin.value.enabled!==false, uiType: formAdmin.value.uiType || null, uiPosition: formAdmin.value.uiPosition || null, uiDuration: (formAdmin.value.uiDuration==null? null: Number(formAdmin.value.uiDuration)) };
        if (dlgAdminMode.value==='create'){
            await notificationTemplateControllerCreate({ ...payload, typeKey: formAdmin.value.typeKey, channel: 'ADMIN' } as any);
        } else {
            await notificationTemplateControllerUpdate(String(formAdmin.value.id), payload as any);
        }
        ElMessage.success('已保存'); dlgAdminVisible.value=false; loadAdmin();
    }catch(e:any){ ElMessage.error(String(e?.message||'保存失败')); }
}

async function onAdminToggle(row: AdminTpl){ try{ await notificationTemplateControllerUpdate(String(row.id), { enabled: !!row.enabled } as any); ElMessage.success('已更新'); }catch{ ElMessage.error('更新失败'); } }
async function delAdminTpl(row: AdminTpl){ try{ await notificationTemplateControllerRemove(String(row.id)); ElMessage.success('已删除'); loadAdmin(); }catch{ ElMessage.error('删除失败'); } }

async function loadAdminVars(){
    try{
        const typeKey = formAdmin.value.typeKey || adminKeys[0].key;
        const arr:any = await notificationTemplateControllerVariables({ typeKey } as any);
        variablesAdmin.value = Array.isArray(arr)? arr: [];
    }catch{ variablesAdmin.value = []; }
}
function getAdminNativeInput(elInput:any): HTMLInputElement | HTMLTextAreaElement | null { try{ const root = elInput?.$el as HTMLElement; if (!root) return null; return (root.querySelector('textarea, input') as any) || null; }catch{ return null; } }
function insertAtAdminCaret(modelKey:'titleTemplate'|'contentTemplate', token:string){ const comp = modelKey==='titleTemplate' ? adminTitleRef.value : adminContentRef.value; const inputEl = getAdminNativeInput(comp); const current = String((formAdmin.value as any)[modelKey] || ''); if (inputEl && typeof (inputEl as any).selectionStart === 'number'){ const start = (inputEl as any).selectionStart as number; const end = (inputEl as any).selectionEnd as number; const next = current.slice(0, start) + token + current.slice(end); (formAdmin.value as any)[modelKey] = next; nextTick(()=>{ try{ const pos = start + token.length; (inputEl as any).focus(); (inputEl as any).setSelectionRange(pos, pos); }catch{} }); } else { (formAdmin.value as any)[modelKey] = current + token; } }
function insertAdminVar(key:string){ const token = `{{${key}}}`; const target: 'titleTemplate'|'contentTemplate' = adminActiveField.value==='title' ? 'titleTemplate' : 'contentTemplate'; insertAtAdminCaret(target, token); }

function previewAdmin(row?: AdminTpl){
    const title = row?.titleTemplate || formAdmin.value.titleTemplate || '新订单提醒';
    const message = row?.contentTemplate || formAdmin.value.contentTemplate || '您有新的订单到达';
    const type = (row?.uiType || formAdmin.value.uiType || 'primary') as any;
    const position = (row?.uiPosition || formAdmin.value.uiPosition || 'top-right') as any;
    const duration = Number((row?.uiDuration ?? formAdmin.value.uiDuration ?? 4500) as any) || 0;
    ElNotification({ title, message, type, position, duration });
}

onMounted(()=>{ loadAdmin(); });

// WXAPP：CRUD
type WxappTpl = { id:number; typeKey:string; enabled:boolean; wxTemplateId?:string|null; wxPagePathTemplate?:string|null; wxMiniprogramState?:string|null; wxLang?:string|null };
const listWxapp = ref<WxappTpl[]>([]);
const q3 = ref('');
const dlgWxappVisible = ref(false);
const dlgWxappMode = ref<'create'|'edit'>('create');
const formWxapp = ref<Partial<WxappTpl> & { typeKey?:string; enabled:boolean; wxTemplateId?:string; wxPagePathTemplate?:string; wxMiniprogramState?:string; wxLang?:string }>({ enabled: true, wxMiniprogramState: 'formal', wxLang: 'zh_CN' });

function wxappLabelOf(k:string){
	const f = wxappKeys.find(it=>it.key===k);
	return f ? f.label : k;
}

async function loadWxapp(){
	try{
		const params: any = { q: q3.value || undefined, channel: 'WXAPP' };
		const arr:any[] = (await notificationTemplateControllerList(params) as unknown) as any[];
		listWxapp.value = Array.isArray(arr) ? (arr as any) : [];
	}catch{
		listWxapp.value = [];
	}
}

function openWxappCreate(){
	dlgWxappMode.value = 'create';
	formWxapp.value = {
		enabled: true,
		typeKey: wxappKeys[0].key,
		wxTemplateId: '',
		wxPagePathTemplate: 'pages/washcard/detail?id={{cardId}}',
		wxMiniprogramState: 'formal',
		wxLang: 'zh_CN',
	};
	dlgWxappVisible.value = true;
}
function openWxappEdit(row: WxappTpl){
	dlgWxappMode.value = 'edit';
	formWxapp.value = {
		id: row.id,
		typeKey: row.typeKey,
		enabled: !!row.enabled,
		wxTemplateId: (row as any).wxTemplateId || '',
		wxPagePathTemplate: (row as any).wxPagePathTemplate || '',
		wxMiniprogramState: (row as any).wxMiniprogramState || 'formal',
		wxLang: (row as any).wxLang || 'zh_CN',
	};
	dlgWxappVisible.value = true;
}

async function onWxappSave(){
	try{
		const payload: any = {
			enabled: formWxapp.value.enabled !== false,
			wxTemplateId: String(formWxapp.value.wxTemplateId || '').trim(),
			wxPagePathTemplate: String(formWxapp.value.wxPagePathTemplate || '').trim() || null,
			wxMiniprogramState: String(formWxapp.value.wxMiniprogramState || '').trim() || null,
			wxLang: String(formWxapp.value.wxLang || '').trim() || null,
		};
		if (!payload.wxTemplateId) { ElMessage.error('请填写微信 TemplateId'); return; }
		if (dlgWxappMode.value === 'create') {
			// 注意：后端 DTO 仍要求 titleTemplate/contentTemplate（WXAPP 实际不使用），这里填展示用占位
			await notificationTemplateControllerCreate({
				typeKey: formWxapp.value.typeKey,
				channel: 'WXAPP',
				titleTemplate: wxappLabelOf(String(formWxapp.value.typeKey||'')),
				contentTemplate: 'WXAPP_SUBSCRIBE',
				...payload,
			} as any);
		} else {
			await notificationTemplateControllerUpdate(String(formWxapp.value.id), payload as any);
		}
		ElMessage.success('已保存');
		dlgWxappVisible.value = false;
		loadWxapp();
	}catch(e:any){
		ElMessage.error(String(e?.message || '保存失败'));
	}
}

async function onWxappToggle(row: WxappTpl){
	try{
		await notificationTemplateControllerUpdate(String(row.id), { enabled: !!row.enabled } as any);
		ElMessage.success('已更新');
		loadWxapp();
	}catch{
		ElMessage.error('更新失败');
	}
}
async function delWxappTpl(row: WxappTpl){
	try{
		await notificationTemplateControllerRemove(String(row.id));
		ElMessage.success('已删除');
		loadWxapp();
	}catch{
		ElMessage.error('删除失败');
	}
}

onMounted(()=>{ loadWxapp(); });

// 类型设置 API
async function loadTypeSettings(){
	try{
		const arr:any[] = (await notificationControllerListTypeSettings({ channel: typeChannel.value } as any) as unknown) as any[];
		typeSettings.value = (arr||[]).map((x:any)=> ({ ...x, defaultUi: x.defaultUi || {} }));
	} catch { typeSettings.value = []; }
}
async function saveType(row: TypeSetting){ try{ await notificationControllerUpsertTypeSetting({ typeKey: row.typeKey, channel: row.channel || typeChannel.value, enabled: row.enabled, allowFallback: row.allowFallback, defaultUi: row.defaultUi } as any); ElMessage.success('已保存'); }catch{ ElMessage.error('保存失败'); } }
onMounted(()=>{ loadTypeSettings(); });
async function initTypes(){ try{ await notificationControllerInitTypeSettings(); ElMessage.success('已初始化'); loadTypeSettings(); }catch{ ElMessage.error('初始化失败'); } }
</script>

<style scoped>
.vars{ display:flex; gap:8px; flex-wrap:wrap; }
.var{ cursor:pointer; user-select:none; }
.var .hint{ color:#909399; margin-left:4px; font-size:12px; }
.var-code{ font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; }
</style>


