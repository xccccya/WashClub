// #ifdef MP-WEIXIN
export {};
// 对于 TS 编译环境下的全局 wx 声明
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const wx: any;

(function(){
	try{
		// @ts-ignore
		if (typeof wx === 'undefined') return;
		// @ts-ignore
		const originalGetSystemInfoSync = typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync.bind(wx) : undefined;

		// 覆盖旧 API：优先返回新 API 的组合结果，避免触发原生弃用告警
		// @ts-ignore
		wx.getSystemInfoSync = function(){
			// @ts-ignore
			const appBaseInfo = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : undefined;
			// @ts-ignore
			const windowInfo = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : undefined;
			// @ts-ignore
			const deviceInfo = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : undefined;
			// 合并为旧结构的超集，尽量兼容依赖旧字段的第三方代码
			const merged:any = { ...(deviceInfo||{}), ...(windowInfo||{}), ...(appBaseInfo||{}) };
			// 当新 API 都不可用时，兜底：仅首次调用原生旧 API 并缓存，避免多次告警
			if (!appBaseInfo && !windowInfo && !deviceInfo) {
				// @ts-ignore
				if (!(wx as any).__cachedSystemInfoSync) {
					let value:any = {};
					try { value = originalGetSystemInfoSync ? originalGetSystemInfoSync() : {}; } catch {}
					// @ts-ignore
					(wx as any).__cachedSystemInfoSync = value;
				}
				// @ts-ignore
				return (wx as any).__cachedSystemInfoSync;
			}
			return merged;
		};

		// 为可能缺失的新 API 提供最小可用实现，减少三方代码的回退分支命中概率
		// 注意：以下兜底会使用旧 API 一次性构造，避免高频调用触发多次告警
		// @ts-ignore
		if (typeof wx.getWindowInfo !== 'function' && originalGetSystemInfoSync) {
			// @ts-ignore
			wx.getWindowInfo = function(){
				const info = originalGetSystemInfoSync ? originalGetSystemInfoSync() : {};
				const { windowWidth, windowHeight, pixelRatio, statusBarHeight, screenWidth, screenHeight, safeArea } = info as any;
				return { windowWidth, windowHeight, pixelRatio, statusBarHeight, screenWidth, screenHeight, safeArea };
			};
		}
		// @ts-ignore
		if (typeof wx.getDeviceInfo !== 'function' && originalGetSystemInfoSync) {
			// @ts-ignore
			wx.getDeviceInfo = function(){
				const info = originalGetSystemInfoSync ? originalGetSystemInfoSync() : {};
				const { brand, model, system, platform, version, SDKVersion, deviceOrientation } = info as any;
				const pixelRatio = (info as any)?.pixelRatio ?? (info as any)?.devicePixelRatio;
				return { brand, model, system, platform, version, SDKVersion, deviceOrientation, pixelRatio };
			};
		}
		// @ts-ignore
		if (typeof wx.getAppBaseInfo !== 'function' && originalGetSystemInfoSync) {
			// @ts-ignore
			wx.getAppBaseInfo = function(){
				const info = originalGetSystemInfoSync ? originalGetSystemInfoSync() : {};
				const { language, version, SDKVersion, enableDebug } = info as any;
				return { language, version, SDKVersion, enableDebug };
			};
		}

		// 强化版 Intl polyfill：确保在不同全局对象上可用，并尽量提供标识符 Intl
		try {
			// 收集可能的全局根对象
			// @ts-ignore
			const roots: any[] = [];
			// @ts-ignore
			if (typeof globalThis !== 'undefined') roots.push(globalThis as any);
			// @ts-ignore
			if (typeof global !== 'undefined') roots.push(global as any);
			roots.push((wx as any));
			try { roots.push(Function('return this')()); } catch {}

			const ensureIntl = (root: any) => {
				if (!root) return;
				root.Intl = root.Intl || {};
				if (!root.Intl.NumberFormat) {
					root.Intl.NumberFormat = function(locales?: string | string[], options?: any){
						const loc = Array.isArray(locales) ? (locales[0] || 'zh-CN') : (locales || 'zh-CN');
						const opts = options || {};
						const style = String(opts.style || 'decimal');
						const currency = String(opts.currency || 'CNY');
						const maximumFractionDigits = (typeof opts.maximumFractionDigits === 'number') ? Math.max(0, Math.min(20, opts.maximumFractionDigits)) : 2;
						return {
							format(value: number){
								const n = Number(value);
								if (!isFinite(n)) return '';
								const sign = n < 0 ? '-' : '';
								const abs = Math.abs(n);
								const fixed = abs.toFixed(maximumFractionDigits);
								const parts = fixed.split('.');
								const intPart = parts[0];
								const fracPart = parts[1] ? '.' + parts[1] : '';
								const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
								if (style === 'currency' && String(currency).toUpperCase() === 'CNY') {
									return sign + '￥' + withSep + fracPart;
								}
								return sign + withSep + fracPart;
							}
						};
					};
				}
			};
			for (const r of roots) { try { ensureIntl(r); } catch {} }
			// 尝试创建可直接通过标识符访问的 Intl（某些沙箱需要赋值语句）
			try { Function('try{ if (typeof Intl==="undefined") Intl = this.Intl; }catch(e){}').call(roots[0] || {}); } catch {}
		}catch{}
	}catch{}
})();
// #endif


