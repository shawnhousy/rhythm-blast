// Cloudflare Pages Function: GET /api/leaderboard
// 使用原生 fetch 调用 Supabase REST API，不依赖外部 SDK

function makeSupabaseHeaders(key) {
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'total';
  const songId = url.searchParams.get('song_id') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response('OK', { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: '服务器未配置 Supabase 环境变量' }),
        { headers: corsHeaders, status: 500 }
      );
    }

    const baseUrl = supabaseUrl.replace(/\/$/, '');
    const headers = makeSupabaseHeaders(supabaseKey);
    let data;

    if (type === 'total') {
      // 总积分排行 - 从 player_total_points 视图
      const resp = await fetch(
        `${baseUrl}/rest/v1/player_total_points?order=total_points.desc&limit=100`,
        { headers, method: 'GET' }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Supabase error (${resp.status}): ${errText}`);
      }
      data = await resp.json();
    } else if (type === 'songs') {
      // 单曲排行
      let queryUrl = `${baseUrl}/rest/v1/leaderboard?order=score.desc&limit=200`;
      if (songId) {
        queryUrl += `&song_id=eq.${encodeURIComponent(songId)}`;
      }
      const resp = await fetch(queryUrl, { headers, method: 'GET' });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Supabase error (${resp.status}): ${errText}`);
      }
      data = await resp.json();
    } else {
      return new Response(
        JSON.stringify({ error: '无效的 type 参数' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (err) {
    console.error('Leaderboard API error:', err);
    return new Response(
      JSON.stringify({ error: err.message || '服务器错误' }),
      { headers: corsHeaders, status: 500 }
    );
  }
}
