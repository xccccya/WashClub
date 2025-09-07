<template>
	<div class="file-input">
		<el-input v-model="innerUrl" :placeholder="placeholder || '输入URL或从文件库选择'" />
		<div class="actions">
			<el-upload :http-request="upload" :show-file-list="false" accept="*/*"><el-button>上传</el-button></el-upload>
			<el-button @click="pickerVisible=true">从文件库选择</el-button>
		</div>
		<div v-if="showPreview !== false && innerUrl" class="preview"><img v-if="isImage(innerUrl)" :src="abs(innerUrl)" /><code v-else>{{ innerUrl }}</code></div>
		<FilePickerDialog v-model="pickerVisible" @picked="onPicked" />
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { API_BASE } from '../../config';
import { absUrl } from '../../utils/http';
import FilePickerDialog from './FilePickerDialog.vue';

const props = defineProps<{ modelValue?: string; placeholder?: string; showPreview?: boolean }>();
const emit = defineEmits<{ (e:'update:modelValue', v:string):void }>();
const innerUrl = ref(props.modelValue || '');
watch(()=>props.modelValue, (v)=>{ innerUrl.value = v || ''; });
watch(innerUrl, (v)=> emit('update:modelValue', v||''));

const pickerVisible = ref(false);
function isImage(u?: string){ return /^https?:\/\//.test(String(u||'')) ? /\.(png|jpe?g|gif|webp|avif)$/i.test(String(u||'')) : /\.(png|jpe?g|gif|webp|avif)$/i.test(String(u||'')); }
function abs(u?: string){ return absUrl(u || ''); }

async function upload(options:any){
	const file = options?.file as File; if (!file) return;
	const fd = new FormData(); fd.append('file', file); fd.append('dir', 'admin');
	const res = await fetch(`${API_BASE}/assets/upload`, { method:'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')||''}` }, body: fd });
	const j = await res.json(); if (res.ok && j?.url) innerUrl.value = j.url;
}

function onPicked(list:any[]){ const first = Array.isArray(list) ? list[0] : null; if (first?.url) innerUrl.value = first.url; }
</script>

<style scoped>
.file-input{ display:flex; flex-direction: column; gap:6px; width:100%; }
.actions{ display:flex; gap:8px; }
.preview{ width:160px; height:120px; border:1px solid #eee; border-radius:6px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
.preview img{ width:100%; height:100%; object-fit:cover; }
</style>


