// Cloudflare Pages Function: GET /api/leaderboard
// 获取排行榜数据

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'total'; // 'total' or 'songs'
  const songId = url.searchParams.get('song_id') || '';

  // CORS 头
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

    // 动态导入 Supabase SDK
    const { createClient } = await import(
      'https://esm.sh/@supabase/supabase-js@2'
    );
    const supabase = createClient(supabaseUrl, supabaseKey);

    let data, error;

    if (type === 'total') {
      // 总积分排行
      ({ data, error } = await supabase
        .from('player_total_points')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(100));
    } else if (type === 'songs') {
      // 单曲排行
      let query = supabase
        .from('leaderboard')
        .select('*');

      if (songId) {
        query = query.eq('song_id', songId);
      }

      ({ data, error } = await query
        .order('score', { ascending: false })
        .limit(200));
    } else {
      return new Response(
        JSON.stringify({ error: '无效的 type 参数' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (error) throw error;

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
