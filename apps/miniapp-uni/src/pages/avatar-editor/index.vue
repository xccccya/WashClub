<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="canvas-wrap">
			<canvas canvas-id="preview" class="canvas" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd"></canvas>
		</view>
		<view class="tips">双指缩放、单指拖动，预览即所见即所得。点击下方保存</view>
		<view class="actions"><view class="btn" @tap="onSave">保存</view></view>
		<canvas canvas-id="exporter" class="hidden-canvas"></canvas>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import createHttpClient from '@wash/shared-utils/src/http';
import { API_BASE } from '../../utils/auth';
import { useSafeArea } from '../../utils/safe-area';
const { topSpacerHeight } = useSafeArea();

const http = createHttpClient({ baseUrl: API_BASE, getToken: ()=> uni.getStorageSync('token') });

const src = ref<string>('');
const S = 600; // 预览画布像素尺寸（足够大，导出再等比缩小到512）
let imgW = 0, imgH = 0;
let scale = 1, minScale = 1, maxScale = 6;
let offsetX = 0, offsetY = 0; // 以画布中心为原点的偏移
let startTouches: any[] = [];
let startScale = 1, startOffsetX = 0, startOffsetY = 0, startDist = 0, startCx = 0, startCy = 0;

function loadParams(){
	const pages = getCurrentPages();
	const cur: any = pages[pages.length-1];
	src.value = decodeURIComponent(cur?.options?.src || '');
}

function getCtx(canvasId: string){ return uni.createCanvasContext(canvasId); }

function render(canvasId: string){
	const ctx = getCtx(canvasId);
	ctx.clearRect(0,0,S,S);
	ctx.fillStyle = '#fff';
	ctx.fillRect(0,0,S,S);
	ctx.save();
	ctx.translate(S/2 + offsetX, S/2 + offsetY);
	ctx.scale(scale, scale);
	// 将图片居中绘制
	ctx.drawImage(src.value, -imgW/2, -imgH/2, imgW, imgH);
	ctx.restore();
	ctx.draw();
}

function dist(a: any, b: any){ const dx=a.x-b.x, dy=a.y-b.y; return Math.sqrt(dx*dx+dy*dy); }
function center(a: any, b: any){ return { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }; }

function toLocalPoint(e: any){
	const t = e.changedTouches?.[0] || e.touches?.[0];
	return { x: t.x, y: t.y };
}

function clamp(v:number, lo:number, hi:number){ return Math.max(lo, Math.min(hi, v)); }

function onTouchStart(e: any){
	startTouches = e.touches || [];
	startScale = scale; startOffsetX = offsetX; startOffsetY = offsetY;
	if (startTouches.length>=2){
		const a = { x: startTouches[0].x, y: startTouches[0].y };
		const b = { x: startTouches[1].x, y: startTouches[1].y };
		startDist = dist(a,b);
		const c = center(a,b); startCx = c.x; startCy = c.y;
	}
}

function onTouchMove(e: any){
	const touches = e.touches || [];
	if (touches.length>=2){
		const a = { x: touches[0].x, y: touches[0].y };
		const b = { x: touches[1].x, y: touches[1].y };
		const d = dist(a,b);
		const ratio = d / Math.max(1, startDist);
		scale = clamp(startScale * ratio, minScale, maxScale);
		// 平移以保持缩放中心
		const c = center(a,b);
		offsetX = startOffsetX + (c.x - startCx);
		offsetY = startOffsetY + (c.y - startCy);
	} else if (touches.length===1) {
		const cur = { x: touches[0].x, y: touches[0].y };
		const st = { x: startTouches[0].x, y: startTouches[0].y };
		offsetX = startOffsetX + (cur.x - st.x);
		offsetY = startOffsetY + (cur.y - st.y);
	}
	render('preview');
}

function onTouchEnd(){ /* no-op */ }

onMounted(()=>{
	loadParams();
	uni.getImageInfo({ src: src.value, success: (info)=>{
		imgW = info.width; imgH = info.height;
		// 初始缩放，使图片至少覆盖正方形画布
		const k = Math.max(S / imgW, S / imgH);
		minScale = k; scale = k; offsetX = 0; offsetY = 0;
		render('preview');
	}});
});

function exportCropped(): Promise<string> {
	return new Promise((resolve, reject)=>{
		const ctx = getCtx('exporter');
		const size = 512;
		ctx.clearRect(0,0,size,size);
		ctx.fillStyle='#fff'; ctx.fillRect(0,0,size,size);
		ctx.save();
		// 将当前预览的变换按比例映射到导出画布
		const scaleRatio = size / S;
		ctx.translate(size/2 + offsetX*scaleRatio, size/2 + offsetY*scaleRatio);
		ctx.scale(scale, scale);
		ctx.drawImage(src.value, -imgW/2, -imgH/2, imgW, imgH);
		ctx.restore();
		ctx.draw(false, ()=>{
			uni.canvasToTempFilePath({ canvasId: 'exporter', width: size, height: size, destWidth: size, destHeight: size, fileType: 'png', quality: 1, success: (res)=> resolve(res.tempFilePath), fail: reject });
		});
	});
}

async function onSave(){
	try {
		const filePath = await exportCropped();
		await new Promise<void>((resolve, reject)=>{
			uni.uploadFile({ url: `${API_BASE}/file/upload`, filePath, name: 'file', formData: { dir: 'miniapp' }, header: { Authorization: `Bearer ${uni.getStorageSync('token')||''}` }, success: async (up)=>{
				try { const data = JSON.parse(up.data||'{}'); const url = data?.url || ''; if (!url) return reject('上传失败');
					const userObj: any = uni.getStorageSync('user') || {};
					await http(`/member/${userObj?.id}`, { method: 'PUT', body: { avatarUrl: url } });
					try { const u = uni.getStorageSync('user') || {}; u.avatarUrl = url; uni.setStorageSync('user', u); } catch {}
					uni.showToast({ title: '已保存', icon: 'success' });
					setTimeout(()=> uni.navigateBack(), 300);
					resolve();
				} catch(e) { reject(e); }
			}, fail: reject });
		});
	} catch (e:any) {
		uni.showToast({ title: e?.message?.slice(0,30) || '保存失败', icon: 'none' });
	}
}
</script>

<style>
.page { min-height:100vh; padding: 24rpx; }
.canvas-wrap { height: 70vh; display:flex; align-items:center; justify-content:center; }
.canvas { width: 80vw; height: 80vw; background:#fff; border-radius: 12rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); }
.tips { text-align:center; color:#6b7280; font-size: 24rpx; margin: 16rpx 0; }
.actions { position: fixed; left: 24rpx; right: 24rpx; bottom: calc(env(safe-area-inset-bottom) + 24rpx); }
.btn { text-align:center; padding: 22rpx 0; border-radius: 999rpx; background: linear-gradient(135deg, #a8d8ff, #ffc9de); }
.hidden-canvas { position:absolute; width:1px; height:1px; opacity:0; left:-9999px; top:-9999px; }
</style>


