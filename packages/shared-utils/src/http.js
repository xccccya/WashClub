function createHttpClientFactory(config = {}) {
    const { baseUrl = '', getToken } = config;
    return async function request(url, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };
        const token = getToken?.();
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        let fullUrl = baseUrl + url;
        if (options.query) {
            const pairs = [];
            Object.entries(options.query).forEach(([k, v]) => {
                if (v === undefined || v === null)
                    return;
                if (Array.isArray(v)) {
                    v.forEach((item) => {
                        if (item === undefined || item === null)
                            return;
                        pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
                    });
                }
                else {
                    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                }
            });
            if (pairs.length > 0)
                fullUrl += (fullUrl.includes('?') ? '&' : '?') + pairs.join('&');
        }
        // 小程序端优先使用 uni.request；其余环境使用 fetch
        const canUseUni = typeof uni !== 'undefined' && typeof uni.request === 'function';
        if (canUseUni) {
            return await new Promise((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const method = (options.method || 'GET').toString().toUpperCase();
                const data = options.body && typeof options.body !== 'string' ? options.body : options.body;
                uni.request({
                    url: fullUrl,
                    method,
                    // 小程序端 dataType 默认按 content-type 解析；指定为 json 更稳妥
                    data,
                    header: headers,
                    dataType: 'json',
                    success: (resp) => {
                        if (resp.statusCode >= 200 && resp.statusCode < 300) {
                            resolve(resp.data);
                        }
                        else {
                            // 友好提取 message 字段
                            const raw = resp.data;
                            const msg = (raw && typeof raw === 'object' && raw.message) ? String(raw.message) :
                                (typeof raw === 'string' ? raw : undefined);
                            reject(new Error(msg || `HTTP ${resp.statusCode}`));
                        }
                    },
                    fail: (err) => {
                        reject(new Error(err?.errMsg || 'Network Error'));
                    },
                });
            });
        }
        // 解构移除未知类型的 body，避免传播到 fetch init
        const { body: rawBody, ...restOptions } = options;
        const res = await fetch(fullUrl, {
            ...restOptions,
            headers,
            body: rawBody !== undefined && rawBody !== null && typeof rawBody !== 'string' ? JSON.stringify(rawBody) : rawBody,
        });
        if (!res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                let messageFromJson;
                try {
                    const j = await res.json();
                    const raw = j?.message;
                    if (Array.isArray(raw))
                        messageFromJson = String(raw[0]);
                    else if (raw !== undefined && raw !== null)
                        messageFromJson = String(raw);
                }
                catch { }
                throw new Error(messageFromJson || `HTTP ${res.status} ${res.statusText}`);
            }
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json'))
            return (await res.json());
        const text = await res.text();
        return text;
    };
}
export function createHttpClient(arg1, arg2) {
    if (typeof arg1 === 'string') {
        // 直接调用：createHttpClient(url, options)
        const client = createHttpClientFactory({});
        return client(arg1, arg2 || {});
    }
    // 工厂用法：createHttpClient(config)
    return createHttpClientFactory(arg1 || {});
}
export default createHttpClient;
