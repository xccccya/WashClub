export type HttpClientConfig = {
	baseUrl?: string;
	getToken?: () => string | undefined;
};

// 覆盖 RequestInit 的 body 类型，允许直接传入对象
export type HttpRequestOptions = Omit<RequestInit, 'body'> & {
    // 允许任意可序列化对象或原有的 BodyInit 类型
    // 使用 unknown 以便调用侧可直接传入 { ... }
    body?: unknown;
    query?: Record<string, unknown>;
};

// 声明以便小程序端类型通过；在非小程序端不会产生实际影响
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const uni: any;

export const createHttpClient = (config: HttpClientConfig = {}) => {
	const { baseUrl = '', getToken } = config;
	return async <T>(
		url: string,
		options: HttpRequestOptions = {},
	): Promise<T> => {
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
			...(options.headers || {}),
		};
		const token = getToken?.();
		if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
		let fullUrl = baseUrl + url;
		if (options.query) {
			const pairs: string[] = [];
			Object.entries(options.query).forEach(([k, v]) => {
				if (v === undefined || v === null) return;
				if (Array.isArray(v)) {
					v.forEach((item) => {
						if (item === undefined || item === null) return;
						pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
					});
				} else {
					pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
				}
			});
			if (pairs.length > 0) fullUrl += (fullUrl.includes('?') ? '&' : '?') + pairs.join('&');
		}

		// 小程序端优先使用 uni.request；其余环境使用 fetch
		const canUseUni = typeof uni !== 'undefined' && typeof uni.request === 'function';
		if (canUseUni) {
			return await new Promise<T>((resolve, reject) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const method: any = (options.method || 'GET').toString().toUpperCase();
				const data = options.body && typeof options.body !== 'string' ? options.body : options.body;
				uni.request({
					url: fullUrl,
					method,
					// 小程序端 dataType 默认按 content-type 解析；指定为 json 更稳妥
					data,
					header: headers as Record<string, string>,
					dataType: 'json',
					success: (resp: { statusCode: number; data: unknown; header: Record<string, string> }) => {
						if (resp.statusCode >= 200 && resp.statusCode < 300) {
							resolve(resp.data as T);
						} else {
							// 友好提取 message 字段
							const raw = resp.data;
							const msg = (raw && typeof raw === 'object' && (raw as any).message) ? String((raw as any).message) :
								(typeof raw === 'string' ? raw : undefined);
							reject(new Error(msg || `HTTP ${resp.statusCode}`));
						}
					},
					fail: (err: { errMsg?: string }) => {
						reject(new Error(err?.errMsg || 'Network Error'));
					},
				});
			});
		}

		const res = await fetch(fullUrl, {
			...options,
			headers,
			body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
		});
		if (!res.ok) {
			const contentType = res.headers.get('content-type') || '';
			if (contentType.includes('application/json')) {
				let messageFromJson: string | undefined;
				try {
					const j = await res.json();
					const raw = (j as any)?.message;
					if (Array.isArray(raw)) messageFromJson = String(raw[0]);
					else if (raw !== undefined && raw !== null) messageFromJson = String(raw);
				} catch {}
				throw new Error(messageFromJson || `HTTP ${res.status} ${res.statusText}`);
			}
			const text = await res.text();
			throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
		}
		const contentType = res.headers.get('content-type') || '';
		if (contentType.includes('application/json')) return (await res.json()) as T;
		// @ts-expect-error allow text
		return (await res.text()) as T;
	};
};

export default createHttpClient;

