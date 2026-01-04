<template>
	<view class="page">
		<view v-if="topSpacerHeight" :style="{ height: topSpacerHeight + 'px' }" />
		<view class="nav-back" :style="{ top: (statusBarHeight + 8) + 'px' }" @tap="goBack">
			<image class="nav-back-icon" src="/static/icons/back.png" />
		</view>

		<!-- 品牌卡片 -->
		<view class="card gradient-card brand-card">
			<image class="logo" src="https://car.weiyuanjuke.cn/LOGO1.png" mode="aspectFit" />
			<view class="app-name">巨科汽车美容会员小程序</view>
			<view class="slogan">由巨科科技自研-汽车美容会员营销系统强力驱动。</view>
		</view>

		<!-- 版本信息卡片 -->
		<view class="card gradient-card version-card">
			<view class="row">
				<view class="label">小程序版本</view>
				<view class="value"><text>{{ appVersion || '-' }}</text></view>
			</view>
			<view class="row">
				<view class="label">营销系统版本</view>
				<view class="value"><text>{{ marketingVersion || '-' }}</text></view>
			</view>
		</view>

		<!-- 更新日志卡片 -->
		<view class="card gradient-card changelog-card">
			<view class="changelog-header">
				<view class="title">更新日志</view>
			</view>
			<view class="changelog-wrap" :class="{ 'is-collapsed': collapsed && shouldShowCollapse, 'is-expanded': !collapsed }">
				<!-- 折叠时：限定高度 + 内部滚动；展开时：高度自适应，由页面滚动 -->
				<scroll-view
					class="changelog-body"
					:scroll-y="collapsed && shouldShowCollapse"
					:scroll-with-animation="true"
					:style="(collapsed && shouldShowCollapse) ? ('height:' + collapsedMaxPx + 'px') : ''"
					@scroll="onChangelogScroll"
				>
					<!-- 统一使用 rich-text，避免小程序端第三方组件渲染差异 -->
					<view class="changelog-content">
						<rich-text :nodes="htmlContent" class="changelog-richtext" />
					</view>
				</scroll-view>
				<view v-if="collapsed && shouldShowCollapse && !changelogAtBottom" class="changelog-fade"></view>
			</view>
			<view v-if="shouldShowCollapse" class="changelog-actions">
				<view v-if="collapsed && !changelogAtBottom" class="changelog-hint">上滑可查看更多</view>
				<view class="changelog-toggle" @tap="collapsed = !collapsed">{{ collapsed ? '展开全部' : '收起' }}</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
// 兜底导入：构建时写入的本地资源
import CHANGELOG_HTML from '../../assets/changelog';
// 小程序端使用构建期生成的 HTML，H5 也可直接使用
import { useSafeArea } from '../../utils/safe-area';

declare const uni: any;
declare function getCurrentPages(): any[];

const { topSpacerHeight, statusBarHeight } = useSafeArea();

// 由构建时注入
// @ts-ignore
const appVersion = (typeof __APP_MANIFEST_VERSION__ !== 'undefined' ? __APP_MANIFEST_VERSION__ : '') as string;
// @ts-ignore
const marketingVersion = (typeof __MARKETING_SYSTEM_VERSION__ !== 'undefined' ? __MARKETING_SYSTEM_VERSION__ : '') as string;

function goBack(){
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
		uni.reLaunch({ url: '/pages/me/index' });
	} catch { uni.reLaunch({ url: '/pages/me/index' }); }
}

// 更新日志（编译期注入 HTML 优先，若无则回退到 MD -> rich-text 的简单文本）
// @ts-ignore
const rawChangelogHtml = (typeof __APP_CHANGELOG_HTML__ !== 'undefined' ? __APP_CHANGELOG_HTML__ : (globalThis as any).__APP_CHANGELOG_HTML__ || '') as string;
// @ts-ignore
const rawChangelogMd = (typeof __APP_CHANGELOG_MD__ !== 'undefined' ? __APP_CHANGELOG_MD__ : (globalThis as any).__APP_CHANGELOG_MD__ || '') as string;
const htmlContent = ref<string>('');
// 为 rich-text 提供 nodes 字符串时，需确保内部标签安全且兼容微信解析
function normalizeHtmlForMiniProgram(html: string): string {
	try{
		let out = String(html || '');
		// 去除不被支持的复杂语义标签，替换成 div
		out = out.replace(/<\/?(section|article|header|footer|main|aside|figure|figcaption)\b/gi, (m) => m.replace(/\w+/, (w)=> w[0]==='<'?'<div':'div'));
		// 移除 script/style/iframe
		out = out.replace(/<(script|style|iframe)[\s\S]*?>[\s\S]*?<\/\1>/gi,'');
		// 过滤行内 on* 事件与 javascript: 协议
		out = out.replace(/<([^\s>\/]+)([^>]*)>/gi, (m, tag, attrs) => {
			let a = String(attrs||'');
			a = a.replace(/\son[a-zA-Z]+\s*=\s*"[^"]*"/gi,'').replace(/\son[a-zA-Z]+\s*=\s*'[^']*'/gi,'');
			a = a.replace(/\shref\s*=\s*"javascript:[^"]*"/gi,'').replace(/\shref\s*=\s*'javascript:[^']*'/gi,'');
			a = a.replace(/\ssrc\s*=\s*"javascript:[^"]*"/gi,'').replace(/\ssrc\s*=\s*'javascript:[^']*'/gi,'');
			return `<${tag}${a}>`;
		});
		// 图片适配
		out = out.replace(/<img\b[^>]*>/gi, (tag) => {
			let t = tag;
			if (/style=/.test(t)) {
				t = t.replace(/style=["']([^"']*)["']/, (m, s) => `style="${s};max-width:100%;height:auto;display:block"`);
			} else {
				t = t.replace(/<img\b/i, '<img style="max-width:100%;height:auto;display:block"');
			}
			return t;
		});
		// 为常见标签添加类名，避免使用不被 style 支持的标签选择器
		function appendClassToTag(input: string, tag: string, className: string): string {
			let s = input;
			// 已有 class：追加
			s = s.replace(new RegExp(`<${tag}(\\s[^>]*?)class=["']([^"']*)["']`, 'gi'), `<${tag}$1class="$2 ${className}"`);
			// 有属性但无 class
			s = s.replace(new RegExp(`<${tag}(\\s(?![^>]*class=)[^>]*)>`, 'gi'), `<${tag}$1 class="${className}">`);
			// 无属性
			s = s.replace(new RegExp(`<${tag}>`, 'gi'), `<${tag} class="${className}">`);
			return s;
		}
		const pairs: Array<[string,string]> = [
			['h1','chg-h1'], ['h2','chg-h2'], ['h3','chg-h3'], ['p','chg-p'],
			['ul','chg-ul'], ['ol','chg-ol'], ['li','chg-li'],
			['blockquote','chg-bq'], ['pre','chg-pre'], ['code','chg-code']
		];
		for (const [tag, cls] of pairs) { out = appendClassToTag(out, tag, cls); }
		return out;
	}catch{ return html; }
}

// 精细化 Markdown 标签样式（mp-html 的 tag-style）
const tagStyle = {
	h1: 'font-size: 36rpx; margin: 12rpx 0 8rpx; font-weight: 800; color:#111827;',
	h2: 'font-size: 32rpx; margin: 12rpx 0 6rpx; font-weight: 700; color:#111827;',
	h3: 'font-size: 30rpx; margin: 10rpx 0 6rpx; font-weight: 700; color:#111827;',
	p: 'font-size: 28rpx; line-height: 1.8; color:#374151; margin: 10rpx 0;',
	ul: 'padding-left: 1em; margin: 8rpx 0;',
	ol: 'padding-left: 1em; margin: 8rpx 0;',
	li: 'margin: 6rpx 0; line-height: 1.8;',
	code: 'background:#f5f7fb; padding: 2rpx 8rpx; border-radius: 8rpx; color:#ef4444;',
	pre: 'background:#0b1020; color:#e5e7eb; padding: 16rpx; border-radius: 16rpx; overflow:auto;',
	blockquote: 'border-left: 8rpx solid #e5e7eb; padding-left: 16rpx; color:#6b7280;'
} as Record<string, string>;

onMounted(async () => {
	if (rawChangelogHtml && rawChangelogHtml.trim().length) {
		htmlContent.value = normalizeHtmlForMiniProgram(rawChangelogHtml);
	} else if (rawChangelogMd && rawChangelogMd.trim().length) {
		// 极简回退：将换行替换为 <br/>，保持基础可读，不再依赖运行时 marked
		const escaped = rawChangelogMd
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\n/g, '<br/>');
		htmlContent.value = `<pre style="white-space:break-spaces;line-height:1.8;font-size:28rpx;color:#374151;">${escaped}</pre>`;
	} else if (CHANGELOG_HTML && String(CHANGELOG_HTML).trim().length) {
		htmlContent.value = normalizeHtmlForMiniProgram(String(CHANGELOG_HTML));
	} else {
		htmlContent.value = '<p>暂无更新日志</p>';
	}
	await nextTick();
	measureCollapse();
});

// 折叠/展开
const collapsed = ref(true);
const shouldShowCollapse = ref(false);
const collapsedMaxPx = ref(600);
const changelogContentHeightPx = ref(0);
const changelogAtBottom = ref(false);

function measureCollapse(){
	try{
		const info = uni.getSystemInfoSync?.() as any;
		const windowWidth = Number(info?.windowWidth || 375);
		const rpxToPx = (n:number)=> n * windowWidth / 750;
		collapsedMaxPx.value = Math.round(rpxToPx(660));
		setTimeout(() => {
			try{
				const query = uni.createSelectorQuery?.();
				// 注意：容器（scroll-view）在折叠时高度固定，需测量内容真实高度
				query?.select?.('.changelog-content')?.boundingClientRect?.((rect:any) => {
					const h = Number(rect?.height || 0);
					changelogContentHeightPx.value = h > 0 ? h : 0;
					shouldShowCollapse.value = h > collapsedMaxPx.value + 20;
					// 重新测量后，默认认为未滚到底（避免残留状态导致遮罩异常）
					changelogAtBottom.value = false;
				});
				query?.exec?.();
			}catch{}
		}, 200);
	}catch{}
}

function onChangelogScroll(e: any){
	try{
		if (!(collapsed.value && shouldShowCollapse.value)) { changelogAtBottom.value = false; return; }
		const top = Number(e?.detail?.scrollTop || 0);
		const contentH = Number(changelogContentHeightPx.value || 0);
		const viewH = Number(collapsedMaxPx.value || 0);
		// 预留一点阈值，避免最后一屏刚好贴边时遮罩挡住内容
		const threshold = 16;
		changelogAtBottom.value = contentH > 0 ? (top >= (contentH - viewH - threshold)) : false;
	}catch{}
}
</script>

<style>
.page {
	min-height: 100vh;
	padding: 24rpx 24rpx 0 24rpx;
	background: linear-gradient(180deg, #e9f5ff 0%, #fff0f6 100%);
	box-sizing: border-box;
	padding-bottom: calc(env(safe-area-inset-bottom) + 24rpx);
}
.card { background:#fff; border-radius: 24rpx; padding: 24rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.06); }
.gradient-card { background: linear-gradient(180deg, #f3f9ff 0%, #fff7fb 100%); }
.row { display:flex; align-items:center; justify-content: space-between; padding: 22rpx 8rpx; border-bottom: 2rpx dashed #eef2ff; }
.row:last-child { border-bottom: none; }
.label { color:#2b2f36; font-size: 28rpx; width: 220rpx; font-weight: 600; }
.value { flex:1; display:flex; align-items:center; gap: 16rpx; justify-content: flex-end; }

.brand-card { display:flex; flex-direction: column; align-items:center; text-align:center; padding-top: 48rpx; padding-bottom: 48rpx; margin-bottom: 24rpx; }
.logo { width: 200rpx; height: 200rpx; border-radius: 32rpx; box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08); background: #fff; }
.app-name { margin-top: 20rpx; font-size: 34rpx; font-weight: 800; color:#111827; letter-spacing: 1rpx; }
.slogan { margin-top: 12rpx; font-size: 26rpx; color:#4b5563; line-height: 1.6; max-width: 600rpx; }

.version-card { margin-top: 24rpx; }

/* 更新日志卡片 */
.changelog-card { margin-top: 24rpx; }
.changelog-header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 12rpx; }
.changelog-header .title { font-size: 32rpx; font-weight: 800; color:#111827; }
.changelog-wrap {
	position: relative;
	border-radius: 20rpx;
	background: rgba(255,255,255,0.86);
	border: 2rpx solid rgba(229, 231, 235, 0.9);
	box-shadow: inset 0 0 0 2rpx rgba(255,255,255,0.6);
	overflow: hidden;
}
.changelog-body { box-sizing: border-box; }
.changelog-content { padding: 18rpx 18rpx 12rpx; }
.changelog-wrap.is-expanded .changelog-content { padding-bottom: 18rpx; }
.changelog-fade {
	pointer-events:none;
	position:absolute;
	left:0; right:0; bottom:0;
	height: 140rpx;
	background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.92) 65%, rgba(255,255,255,1) 100%);
}
.changelog-actions{
	display:flex;
	align-items:center;
	justify-content: space-between;
	gap: 16rpx;
	margin-top: 14rpx;
}
.changelog-hint{
	color:#6b7280;
	font-size: 24rpx;
}
.changelog-toggle{
	flex: 0 0 auto;
	padding: 14rpx 22rpx;
	border-radius: 999rpx;
	font-size: 26rpx;
	font-weight: 800;
	color:#1d4ed8;
	background: linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06));
	border: 2rpx solid rgba(59,130,246,0.22);
}

/* 优化排版：统一段落与标题、列表、引用、代码块样式 */
/* 小程序端不推荐标签选择器，改用类名控制 */
.changelog-richtext .chg-h1,.changelog-richtext .chg-h2,.changelog-richtext .chg-h3{ margin: 16rpx 0 8rpx; color:#111827; font-weight: 800; }
.changelog-richtext .chg-h1{ font-size: 36rpx; }
.changelog-richtext .chg-h2{ font-size: 32rpx; }
.changelog-richtext .chg-h3{ font-size: 30rpx; }
.changelog-richtext .chg-p{ font-size: 28rpx; line-height: 1.8; color:#374151; margin: 10rpx 0; }
.changelog-richtext .chg-ul, .changelog-richtext .chg-ol{ padding-left: 1em; margin: 8rpx 0; }
.changelog-richtext .chg-li{ margin: 6rpx 0; line-height: 1.8; }
.changelog-richtext .chg-bq{ border-left: 8rpx solid #e5e7eb; padding-left: 16rpx; color:#6b7280; margin: 10rpx 0; }
.changelog-richtext .chg-code{ background:#f5f7fb; padding: 2rpx 8rpx; border-radius: 8rpx; color:#ef4444; }
.changelog-richtext .chg-pre{ background:#0b1020; color:#e5e7eb; padding: 16rpx; border-radius: 16rpx; overflow:auto; }

/* 返回按钮 */
.nav-back { position: fixed; left: 16rpx; z-index: 1000; padding: 8rpx; }
.nav-back-icon { width: 56rpx; height: 56rpx; }
</style>


