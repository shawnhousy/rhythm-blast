// Cloudflare Pages Function: POST /api/submit
// 提交游戏记录到排行榜

export async function onRequest(context) {
  const { request, env } = context;

  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response('OK', { headers: corsHeaders, status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: '只支持 POST 请求' }),
      { headers: corsHeaders, status: 405 }
    );
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

    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: '无效的 JSON 请求体' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // 数据验证
    const validRanks = ['S+', 'S', 'A', 'B', 'C', 'D'];
    const validDifficulties = ['easy', 'normal', 'hard', 'expert'];

    if (!body.player_name || typeof body.player_name !== 'string' || body.player_name.length > 20) {
      return new Response(
        JSON.stringify({ error: '无效的玩家名（最多20字符）' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (!body.song_id || typeof body.song_id !== 'string') {
      return new Response(
        JSON.stringify({ error: '缺少歌曲 ID' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (typeof body.score !== 'number' || body.score < 0 || body.score > 10000000) {
      return new Response(
        JSON.stringify({ error: '分数超出有效范围' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (typeof body.accuracy !== 'number' || body.accuracy < 0 || body.accuracy > 100) {
      return new Response(
        JSON.stringify({ error: '准确率超出有效范围' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (!validRanks.includes(body.rank)) {
      return new Response(
        JSON.stringify({ error: '无效的评级' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (typeof body.max_combo !== 'number' || body.max_combo < 0 || body.max_combo > 10000) {
      return new Response(
        JSON.stringify({ error: '连击数超出有效范围' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    if (typeof body.points !== 'number' || body.points < 0 || body.points > 1000000) {
      return new Response(
        JSON.stringify({ error: '积分超出有效范围' }),
        { headers: corsHeaders, status: 400 }
      );
    }

    // 动态导入 Supabase SDK
    const { createClient } = await import(
      'https://esm.sh/@supabase/supabase-js@2'
    );
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 插入记录
    const { data, error } = await supabase
      .from('leaderboard')
      .insert({
        player_name: body.player_name.trim(),
        song_id: body.song_id,
        song_title: body.song_title || 'Unknown',
        score: Math.floor(body.score),
        accuracy: Number(body.accuracy.toFixed(2)),
        rank: body.rank,
        max_combo: Math.floor(body.max_combo),
        points: Math.floor(body.points),
        perfect: Math.floor(body.perfect || 0),
        great: Math.floor(body.great || 0),
        good: Math.floor(body.good || 0),
        miss: Math.floor(body.miss || 0),
        difficulty: validDifficulties.includes(body.difficulty) ? body.difficulty : 'normal',
      })
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return new Response(
        JSON.stringify({ error: '数据库写入失败: ' + error.message }),
        { headers: corsHeaders, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: data[0] }),
      { headers: corsHeaders, status: 201 }
    );
  } catch (err) {
    console.error('Submit API error:', err);
    return new Response(
      JSON.stringify({ error: err.message || '服务器错误' }),
      { headers: corsHeaders, status: 500 }
    );
  }
}
