<template>
	<div class="summary-card">
		<!-- 会员信息区域（截图风格） -->
		<div class="member-card" :data-identity="identity">
			<div class="member-left">
				<div
					class="avatar-click"
					:title="identity==='member' ? '点击查看会员详情' : ''"
					:data-disabled="identity!=='member'"
					@click="onAvatarClick"
				>
					<el-avatar class="avatar" :size="54" :src="avatarSrc" />
				</div>
				<div class="meta">
					<div class="name-row">
						<span class="name">{{ displayName }}</span>
						<span class="phone" v-if="displayPhone">({{ displayPhone }})</span>
					</div>
					<div class="sub">
						<span v-if="identity==='member'" class="points">积分 <b>{{ pointsText }}</b></span>
					</div>
				</div>
			</div>

			<el-dropdown trigger="click" @command="onCommand">
				<el-button class="switch-btn" text>
					切换会员
					<el-icon class="chev"><ArrowDown /></el-icon>
				</el-button>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item command="pick">查询会员</el-dropdown-item>
						<el-dropdown-item command="guest">游客</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</div>

		<!-- 服务单：车辆信息 -->
		<transition name="flip-fade" mode="out-in">
		<div class="vehicle-row" v-if="orderKind==='SERVICE'" key="vehicle-block">
			<div class="label">车辆</div>
			<div class="content">
				<template v-if="identity==='guest'">
					<div class="plate-wrap">
						<PlateInput
							ref="plateInputRef"
							v-model="plateModel"
							placeholder="点击输入车牌"
							:inline="true"
							@confirm="emit('plate-confirm')"
							@clear="emit('clear-guest-vehicle')"
						/>
					</div>
					<el-tooltip placement="top" effect="dark" content="无牌车/忘记车牌：将使用系统保留占位车牌">
						<el-button class="no-plate-btn" size="small" type="primary" plain round @click="emit('pick-no-plate')">无牌车</el-button>
					</el-tooltip>
				</template>
				<template v-else>
					<el-select :model-value="memberVehicleId" filterable clearable placeholder="选择或手输车牌" style="flex:1" @change="(v: any)=>emit('update:memberVehicleId', v as any)">
						<el-option v-for="v in memberVehicles" :key="v.id" :label="v.plateNumber" :value="v.id" />
					</el-select>
				</template>
			</div>
		</div>
		</transition>

		<!-- 查询会员弹窗 -->
		<el-dialog v-model="pickerVisible" title="查询会员" width="520px" append-to-body>
			<el-autocomplete
				v-model="memberKeywordModel"
				:fetch-suggestions="queryMembers"
				placeholder="输入手机号/姓名"
				clearable
				:value-key="'name'"
				style="width:100%"
				@select="onPickMember"
			>
				<template #default="{ item }">
					<div class="member-sug">{{ item.name }} <span class="muted">{{ item.phone }}</span></div>
				</template>
			</el-autocomplete>
			<template #footer>
				<el-button @click="pickerVisible=false">关闭</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import PlateInput from '../PlateInput.vue';
import { absUrl } from '../../utils/http';
import { ArrowDown } from '@element-plus/icons-vue';

const props = defineProps<{ 
	orderKind: 'SERVICE'|'SP';
	identity: 'guest'|'member';
	memberKeyword: string;
	selectedMember: any|null;
	pointsAvailable: number;
	memberVehicles: Array<{ id:number; plateNumber:string }>;
	memberVehicleId?: number|undefined;
	plateNumber: string;
}>();
const emit = defineEmits<{
	(e:'update:identity', v:'guest'|'member'): void;
	(e:'update:memberKeyword', v:string): void;
	(e:'update:memberVehicleId', v:number|undefined): void;
	(e:'update:plateNumber', v:string): void;
	(e:'clear-member'): void;
	(e:'plate-confirm'): void;
	(e:'clear-guest-vehicle'): void;
	(e:'pick-no-plate'): void;
	(e:'pick-member', m:any): void;
	(e:'query-members', q:string, cb:(list:any[])=>void): void;
	(e:'open-member-drawer'): void;
}>();

const pickerVisible = ref(false);
const memberKeywordModel = computed({
	get(){ return props.memberKeyword; },
	set(v:string){ emit('update:memberKeyword', String(v||'')); },
});

function displayPhoneOf(m:any){ try{ return String(m?.phone||'').trim(); }catch{ return ''; } }
function displayNameOf(m:any){ try{ return String(m?.name||m?.nickname||'').trim(); }catch{ return ''; } }
const displayName = computed(()=> {
	if (props.identity === 'guest') return '游客';
	const n = displayNameOf(props.selectedMember);
	return n || '会员';
});
const displayPhone = computed(()=> props.identity==='member' ? displayPhoneOf(props.selectedMember) : '');
const pointsText = computed(()=> {
	const n = Math.max(0, Number(props.pointsAvailable||0));
	return Number.isFinite(n) ? String(n) : '0';
});
const avatarSrc = computed(()=>{
	try{
		const raw = props.identity==='member' ? String(props.selectedMember?.avatarUrl || props.selectedMember?.avatar || '').trim() : '';
		if (raw) return absUrl(raw);
		return absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png');
	}catch{
		return absUrl('/uploads/public/76c646c37ea0e38dc72b83bc4acd6720.png');
	}
});

function onAvatarClick(){
	if (props.identity !== 'member') return;
	emit('open-member-drawer');
}

function onPickMember(m:any){
	emit('update:identity', 'member');
	emit('pick-member', m);
	pickerVisible.value = false;
}
function queryMembers(q:string, cb:(list:any[])=>void){ emit('query-members', q, cb); }

function switchToGuest(){
	emit('update:identity', 'guest');
	emit('update:memberKeyword', '');
	emit('clear-member');
}

function openPicker(){
	emit('update:identity', 'member');
	pickerVisible.value = true;
}

function onCommand(cmd: 'pick'|'guest'){
	if (cmd === 'pick') return openPicker();
	return switchToGuest();
}

const plateInputRef = ref<any|null>(null);
const plateModel = computed({
	get(){ return props.plateNumber; },
	set(v:string){ emit('update:plateNumber', v); }
});

function openPlate(){ try{ (plateInputRef.value as any)?.open?.(); }catch{} }
defineExpose({ openPlate });
</script>

<style scoped>
.summary-card{ display:flex; flex-direction:column; gap:10px; }
.member-card{
	display:flex;
	align-items:center;
	justify-content:space-between;
	gap:12px;
	padding:12px;
	border-radius:14px;
	background: #fff7ed;
	border: 2px solid rgba(249,115,22,0.75);
}
.member-left{ display:flex; align-items:center; gap:12px; min-width:0; }
.avatar{ flex: 0 0 auto; box-shadow: 0 6px 16px rgba(0,0,0,.08); }
.avatar-click{
	display:inline-flex;
	align-items:center;
	justify-content:center;
	border-radius: 999px;
	cursor: pointer;
	transition: background-color .15s ease, transform .12s ease;
}
.avatar-click:hover{ background: rgba(0,0,0,0.04); }
.avatar-click:active{ transform: scale(0.98); }
.avatar-click[data-disabled="true"]{
	cursor: default;
}
.avatar-click[data-disabled="true"]:hover{
	background: transparent;
}
.meta{ min-width:0; display:flex; flex-direction:column; gap:6px; }
.name-row{ display:flex; align-items:baseline; gap:6px; min-width:0; }
.name{
	/* 昵称字体与手机号一致 */
	color:#111827;
	font-size:12px;
	font-weight:900;
	white-space:nowrap;
	overflow:hidden;
	text-overflow:ellipsis;
	max-width: 260px;
}
.phone{ color:#6b7280; font-size:12px; font-weight:600; white-space:nowrap; }
.sub{ display:flex; align-items:center; gap:12px; color:#374151; }
.points b{ font-weight:900; font-size:16px; color:#111827; margin-left:6px; }
.switch-btn{ font-weight:800; color:#f97316; }
.switch-btn:hover{ background: rgba(249,115,22,0.08); border-radius:10px; }
.chev{ margin-left:6px; }

.vehicle-row{ display:grid; grid-template-columns: 56px 1fr; gap:10px; align-items:center; }
.vehicle-row .label{ color:#6b7280; font-weight:700; }
.vehicle-row .content{ display:flex; align-items:center; gap:8px; min-height: 52px; }
.plate-wrap{ width:100%; flex: 1 1 auto; min-width: 0; }
.no-plate-btn{ flex: 0 0 auto; font-weight: 900; letter-spacing: .5px; }
.plate-wrap :deep(.box){ padding:6px; padding-right:42px; border-radius:10px; width:100%; max-width:100%; box-sizing:border-box; position:relative; }
.plate-wrap :deep(.cells){ display:grid !important; grid-template-columns: repeat(8, minmax(0, 1fr)); gap:2px; overflow:hidden; }
.plate-wrap :deep(.cell){ width:auto !important; height:auto !important; aspect-ratio: 1 / 1; font-size:14px; }
.plate-wrap :deep(.clear-btn){ right:6px; padding:3px 6px; font-size:12px; }
/* 将新能源徽标改为绝对定位，避免撑宽 */
.plate-wrap :deep(.nev-badge){ position:absolute; right:6px; top:6px; transform:none; display:inline-flex; flex-direction:row; gap:2px; padding:2px 4px; border-radius:6px; background:#e6fff4; color:#16a34a; font-size:10px; line-height:1; margin-left:0; pointer-events:none; z-index:1; }
.plate-wrap :deep(.nev-badge-text){ line-height:1; }
/* 切换动效 */
.flip-fade-enter-active, .flip-fade-leave-active { transition: opacity .18s ease, transform .18s ease; }
.flip-fade-enter-from { opacity: 0; transform: rotateX(12deg) translateY(-4px); transform-origin: top; }
.flip-fade-leave-to { opacity: 0; transform: rotateX(-12deg) translateY(4px); transform-origin: top; }

.member-sug .muted{ color:#999; margin-left:6px; }
</style>


