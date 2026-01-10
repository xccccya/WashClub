<template>
	<div class="wc-member-selector">
		<div class="wc-member-selector__toolbar">
			<el-input v-model="keyword" placeholder="搜索姓名/手机号" class="wc-field wc-field--lg" />
			<el-button @click="fetchMembers" :loading="loading">搜索</el-button>
		</div>
		<div class="wc-table-wrap wc-member-selector__table">
			<el-table :data="items" @selection-change="onSelect" height="360" size="small" style="width:100%">
				<el-table-column type="selection" width="48" />
				<el-table-column prop="id" label="ID" width="60" />
				<el-table-column prop="name" label="昵称" />
				<el-table-column prop="phone" label="手机号" width="120" />
			</el-table>
		</div>
		<div class="wc-pagination">
			<el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" :current-page="page" @current-change="onPage" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { memberControllerList } from '@wash/api-client';

const props = defineProps<{ selected?: number[] }>();
const emits = defineEmits<{ (e:'update:selected', v: number[]): void }>();

const keyword = ref('');
const loading = ref(false);
const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const selected = ref<number[]>(props.selected || []);

watch(() => props.selected, (v) => { selected.value = Array.isArray(v) ? v : []; });

function onSelect(rows: any[]){ selected.value = rows.map(r => r.id); emits('update:selected', selected.value); }
function onPage(p:number){ page.value=p; fetchMembers(); }

async function fetchMembers(){
    loading.value = true;
    try{
        const res:any = (await memberControllerList({ keyword: keyword.value, page: page.value, pageSize: pageSize.value } as any) as unknown) as any;
        items.value = Array.isArray((res as any)?.items) ? (res as any)?.items : [];
        total.value = Number((res as any)?.total || 0);
    } finally {
        loading.value = false;
    }
}

onMounted(fetchMembers);
</script>

<style scoped>
.wc-member-selector__toolbar{
	display: flex;
	gap: 10px;
	align-items: center;
	margin-bottom: 10px;
	flex-wrap: wrap;
}
.wc-member-selector__table{
	border-radius: 12px;
}
</style>


