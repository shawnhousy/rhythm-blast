// functions/api/audio-proxy.js
// 云曲库音频代理：解决跨域(CORS)问题
// 用法: /api/audio-proxy?url=<编码后的原始音频URL>

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // CORS 头（允许所有来源访问）
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
        return new Response('OK', { headers: corsHeaders, status: 204 });
    }

    if (request.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
        );
    }

    try {
        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return new Response(
                JSON.stringify({ error: '缺少 url 参数' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        // 安全校验：只允许代理来自 R2.dev 的音频
        const decodedUrl = decodeURIComponent(targetUrl);
        const allowedHost = 'r2.dev';
        let parsedUrl;
        try {
            parsedUrl = new URL(decodedUrl);
        } catch (e) {
            return new Response(
                JSON.stringify({ error: '无效的 URL' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
        }

        if (!parsedUrl.hostname.endsWith(allowedHost)) {
            return new Response(
                JSON.stringify({ error: '不允许的域名' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        // 从服务端转发请求（不受浏览器 CORS 限制）
        const resp = await fetch(decodedUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Rhythm-Blast-Audio-Proxy/1.0',
            },
            cf: {
                // 启用 Cloudflare 缓存，减少重复请求
                cacheTtl: 86400,
                cacheEverything: true,
            },
        });

        if (!resp.ok) {
            return new Response(
                JSON.stringify({ error: `上游请求失败: ${resp.status}` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
            );
        }

        // 构建响应头：透传内容类型和长度，支持 Range 请求
        const respHeaders = new Headers(resp.headers);
        respHeaders.set('Access-Control-Allow-Origin', '*');
        respHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        respHeaders.set('Access-Control-Allow-Headers', '*');

        // 确保音频可以被浏览器正确解码
        const contentType = respHeaders.get('Content-Type') || 'audio/mpeg';
        respHeaders.set('Content-Type', contentType);

        return new Response(resp.body, {
            status: resp.status,
            headers: respHeaders,
        });

    } catch (err) {
        console.error('Audio proxy error:', err);
        return new Response(
            JSON.stringify({ error: err.message || '代理服务器错误' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
}
