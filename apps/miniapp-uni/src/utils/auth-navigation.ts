declare const uni: any;

let openingLogin = false;

function currentRoute(): string {
	try {
		const pages = getCurrentPages?.() || [];
		return String((pages[pages.length - 1] as any)?.route || '');
	} catch { return ''; }
}

export function openLogin(reason: 'required' | 'expired' = 'required') {
	if (currentRoute() === 'pages/login/index' || openingLogin) return;
	openingLogin = true;
	const url = `/pages/login/index?reason=${reason}`;
	const done = () => setTimeout(() => { openingLogin = false; }, 600);
	try { uni.navigateTo({ url, complete: done }); }
	catch { try { uni.reLaunch({ url }); } catch {} finally { done(); } }
}

export function handleHttpUnauthorized() {
	let hadToken = false;
	try {
		hadToken = !!uni.getStorageSync('token');
		if (!hadToken) return;
		uni.removeStorageSync('token');
		uni.removeStorageSync('user');
		try { uni.$emit?.('auth:changed'); } catch {}
		uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
	} catch {}
	if (hadToken) openLogin('expired');
}

export function leaveLogin(fallback: '/pages/index/index' | '/pages/me/index' = '/pages/index/index') {
	openingLogin = false;
	try {
		const pages = getCurrentPages?.() || [];
		if (pages.length > 1) { uni.navigateBack(); return; }
	} catch {}
	try { uni.switchTab({ url: fallback }); }
	catch { uni.reLaunch({ url: fallback }); }
}
