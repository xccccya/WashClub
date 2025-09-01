// #ifdef MP-WEIXIN
export {};

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
	}catch{}
})();
// #endif


