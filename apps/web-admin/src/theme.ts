export type ThemeMode = 'light' | 'dark';
export type ColorSchemeKey =
	| 'default'
	| 'green'
	| 'violet'
	| 'orange'
	| 'macaron-pink'
	| 'macaron-blue'
	| 'macaron-green'
	| 'custom';

export type ThemeSettings = {
	theme: ThemeMode;
	colorScheme: ColorSchemeKey;
	/**
	 * 自定义主色，仅在 colorScheme === 'custom' 时生效。
	 * 允许任意 CSS 颜色字符串（如 #409eff / rgb(...) / hsl(...)）
	 */
	customColor: string;
};

const LS_THEME = 'theme';
const LS_COLOR_SCHEME = 'colorScheme';
const LS_CUSTOM_COLOR = 'customColor';

function safeGetItem(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeSetItem(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// ignore
	}
}

export function readThemeSettings(): ThemeSettings {
	const rawTheme = (safeGetItem(LS_THEME) || '').toLowerCase();
	const theme: ThemeMode = rawTheme === 'dark' ? 'dark' : 'light';

	const rawScheme = String(safeGetItem(LS_COLOR_SCHEME) || '').trim();
	const known: ColorSchemeKey[] = [
		'default',
		'green',
		'violet',
		'orange',
		'macaron-pink',
		'macaron-blue',
		'macaron-green',
		'custom',
	];
	const colorScheme: ColorSchemeKey = (known as string[]).includes(rawScheme) ? (rawScheme as ColorSchemeKey) : 'default';

	const customColor = String(safeGetItem(LS_CUSTOM_COLOR) || '#409eff').trim() || '#409eff';

	return { theme, colorScheme, customColor };
}

export function persistThemeSettings(settings: ThemeSettings): void {
	safeSetItem(LS_THEME, settings.theme);
	safeSetItem(LS_COLOR_SCHEME, settings.colorScheme);
	safeSetItem(LS_CUSTOM_COLOR, settings.customColor);
}

export function applyThemeToRoot(settings: ThemeSettings, root: HTMLElement = document.documentElement): void {
	// 主题（暗色：Element Plus dark vars 依赖 .dark class）
	if (settings.theme === 'dark') {
		root.setAttribute('data-theme', 'dark');
		root.classList.add('dark');
	} else {
		root.removeAttribute('data-theme');
		root.classList.remove('dark');
	}

	// 配色通道：default / 预设 / custom
	if (settings.colorScheme === 'default') root.removeAttribute('data-color-scheme');
	else if (settings.colorScheme === 'custom') root.setAttribute('data-color-scheme', 'default');
	else root.setAttribute('data-color-scheme', settings.colorScheme);

	// 自定义主色仅在 custom 通道生效
	root.style.removeProperty('--app-primary');
	if (settings.colorScheme === 'custom' && settings.customColor) {
		root.style.setProperty('--app-primary', settings.customColor);
	}
}

/**
 * 在应用启动最早期调用，避免主题闪烁（FOUC）。
 * 返回最终使用的主题设置（已应用到 documentElement）。
 */
export function initThemeFromStorage(): ThemeSettings {
	try {
		const settings = readThemeSettings();
		applyThemeToRoot(settings);
		return settings;
	} catch {
		const fallback: ThemeSettings = { theme: 'light', colorScheme: 'default', customColor: '#409eff' };
		try {
			applyThemeToRoot(fallback);
		} catch {}
		return fallback;
	}
}

