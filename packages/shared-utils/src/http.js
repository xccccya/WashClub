export const createHttpClient = (config = {}) => {
    const { baseUrl = '', getToken } = config;
    return async (url, options = {}) => {
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
                            const raw = resp.data;
                            const msg = (raw && typeof raw === 'object' && raw.message)
                                ? String(raw.message)
                                : (typeof raw === 'string' ? raw : undefined);
                            reject(new Error(msg || `HTTP ${resp.statusCode}`));
                        }
                    },
                    fail: (err) => {
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
                let messageFromJson;
                try {
                    const j = await res.json();
                    const raw = j?.message;
                    if (Array.isArray(raw))
                        messageFromJson = String(raw[0]);
                    else if (raw !== undefined && raw !== null)
                        messageFromJson = String(raw);
                }
                catch {
                    // ignore
                }
                throw new Error(messageFromJson || `HTTP ${res.status} ${res.statusText}`);
            }
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status} ${res.statusText}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json'))
            return (await res.json());
        // @ts-expect-error allow text
        return (await res.text());
    };
};
export default createHttpClient;
