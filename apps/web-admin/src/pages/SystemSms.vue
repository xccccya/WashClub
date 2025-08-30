<template>
	<BasePage title="短信管理">
		<template #actions>
			<el-input v-model="qPhone" placeholder="手机号" style="width:180px;" />
			<el-select v-model="qPurpose" placeholder="用途" style="width:180px;margin-left:8px;">
				<el-option label="全部" value="" />
				<el-option label="登录" value="login" />
				<el-option label="重置密码" value="resetPwd" />
				<el-option label="更换手机号" value="changePhone" />
			</el-select>
			<el-select v-model="qUsed" placeholder="状态" style="width:140px;margin-left:8px;">
				<el-option label="全部" value="" />
				<el-option label="未使用" value="0" />
				<el-option label="已使用" value="1" />
			</el-select>
			<el-button type="primary" style="margin-left:8px;" @click="fetchList">查询</el-button>
		</template>

		<div style="margin:8px 0;">共 {{ total }} 条记录</div>

		<el-table :data="items" stripe style="width:100%">
			<el-table-column prop="id" label="ID" width="80" />
			<el-table-column prop="phone" label="手机号" />
			<el-table-column prop="code" label="验证码" width="120" />
			<el-table-column prop="purpose" label="用途" width="120" />
			<el-table-column label="创建时间" width="180">
				<template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
			</el-table-column>
			<el-table-column label="过期时间" width="180">
				<template #default="{ row }">{{ formatTime(row.expiresAt) }}</template>
			</el-table-column>
			<el-table-column label="使用时间" width="180">
				<template #default="{ row }">{{ row.usedAt ? formatTime(row.usedAt) : '-' }}</template>
			</el-table-column>
		</el-table>

		<div style="margin-top:12px; text-align:right;">
			<el-pagination
				background
				layout="prev, pager, next, jumper"
				:total="total"
				:page-size="pageSize"
				:current-page="page"
				@current-change="onPageChange"
			/>
		</div>
	</BasePage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BasePage } from '@wash/shared-ui';
import { createHttpClient } from '@wash/shared-utils';
import { API_BASE } from '../config';

const http = createHttpClient({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') || undefined });

type SmsItem = { id: number; phone: string; code: string; purpose: 'login'|'resetPwd'|'changePhone'; createdAt: string; expiresAt: string; usedAt?: string | null };

const qPhone = ref('');
const qPurpose = ref('');
const qUsed = ref('');
const items = ref<SmsItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

function formatTime(x: string | number | Date){ const d = new Date(x); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

async function fetchList(){
    const query: any = { page: page.value, pageSize: pageSize.value };
    if (qPhone.value) query.phone = qPhone.value;
    if (qPurpose.value) query.purpose = qPurpose.value;
    if (qUsed.value) query.used = qUsed.value;
    const resp = await http<{ total: number; page: number; pageSize: number; items: SmsItem[] }>('/system/sms-codes', { method: 'GET', query });
    items.value = resp.items; total.value = resp.total; page.value = resp.page; pageSize.value = resp.pageSize;
}

function onPageChange(p: number){ page.value = p; fetchList(); }

onMounted(fetchList);
</script>


