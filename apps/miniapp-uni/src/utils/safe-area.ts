// 小程序与异形屏安全区/胶囊适配
// 统一计算顶部需要预留的高度，避免被微信右上角胶囊按钮遮挡，并兼容异形屏状态栏

// 对于 TS 编译环境下的全局 uni 声明
declare const uni: any;

export type SafeAreaInfo = {
  statusBarHeight: number; // 系统状态栏高度（px）
  navBarHeight: number; // 自定义导航栏高度（px），以胶囊为准的推荐高度
  topSpacerHeight: number; // 顶部总预留高度（px）= statusBar + navBar
  capsuleRightInset: number; // 胶囊右侧到屏幕右边距（px），用于需要贴边元素时参考
  capsuleRect: { width: number; height: number; top: number; bottom: number; left: number; right: number } | null;
};

function computeSafeArea(): SafeAreaInfo {
  let statusBarHeight = 20;
  let navBarHeight = 44; // iOS 常见高度
  let topSpacerHeight = 64; // 兜底
  let capsuleRightInset = 16;
  let capsuleRect: SafeAreaInfo['capsuleRect'] = null;

  try {
    const sys = uni.getSystemInfoSync?.() || {};
    statusBarHeight = Number(sys.statusBarHeight || 20);
    // #ifdef MP-WEIXIN
    try { capsuleRect = uni.getMenuButtonBoundingClientRect?.() || null; } catch {}
    // #endif
    if (capsuleRect && typeof capsuleRect.top === 'number') {
      // 推荐做法：以胶囊为参照，导航栏高度 = 胶囊高度 + 胶囊上下外边距（即 top - statusBarHeight 的两倍）
      const verticalPadding = Math.max(0, capsuleRect.top - statusBarHeight);
      navBarHeight = capsuleRect.height + verticalPadding * 2;
      topSpacerHeight = statusBarHeight + navBarHeight;
      const windowWidth = Number(sys.windowWidth || 0);
      if (windowWidth && typeof capsuleRect.right === 'number') {
        capsuleRightInset = Math.max(0, windowWidth - capsuleRect.right);
      }
    } else {
      // 兜底：根据平台给出一个合理的导航栏高度
      const platform = String(sys.platform || '').toLowerCase();
      const isIOS = /ios/.test(platform);
      navBarHeight = isIOS ? 44 : 48;
      topSpacerHeight = statusBarHeight + navBarHeight;
      capsuleRightInset = 16;
    }
  } catch {
    // 保持默认兜底
  }

  return { statusBarHeight, navBarHeight, topSpacerHeight, capsuleRightInset, capsuleRect };
}

// 基于 H5 读取安全区顶部 inset（iOS Safari 有效），其余平台返回 0
function readH5SafeAreaInsetTopPx(): number {
  try {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.top = '0';
    probe.style.height = 'constant(safe-area-inset-top)';
    probe.style.height = 'env(safe-area-inset-top)';
    probe.style.width = '0';
    probe.style.padding = '0';
    probe.style.margin = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height || 0;
    document.body.removeChild(probe);
    return Math.max(0, Math.round(h));
  } catch {
    return 0;
  }
}

function computeSafeAreaH5(): SafeAreaInfo {
  // H5 兜底策略：
  // - statusBarHeight: 读取 env(safe-area-inset-top)（iOS Safari 有效），否则 0
  // - navBarHeight: 固定 44px（与小程序常见高度一致）
  // - topSpacerHeight: 二者相加
  const statusBarHeight = readH5SafeAreaInsetTopPx();
  const navBarHeight = 44;
  const topSpacerHeight = statusBarHeight + navBarHeight;
  return { statusBarHeight, navBarHeight, topSpacerHeight, capsuleRightInset: 16, capsuleRect: null };
}

export function useSafeArea(): SafeAreaInfo {
  try {
    // #ifdef MP-WEIXIN
    return computeSafeArea();
    // #endif
    // #ifndef MP-WEIXIN
    return computeSafeAreaH5();
    // #endif
  } catch {
    return { statusBarHeight: 0, navBarHeight: 44, topSpacerHeight: 44, capsuleRightInset: 0, capsuleRect: null };
  }
}


