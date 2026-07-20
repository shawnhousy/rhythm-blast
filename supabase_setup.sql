-- =============================================
-- Rhythm Blast - Supabase 数据库初始化脚本
-- 在 Supabase Dashboard -> SQL Editor 中执行此脚本
-- =============================================

-- 1. 创建排行榜表
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name VARCHAR(20) NOT NULL,
    song_id VARCHAR(50) NOT NULL,
    song_title VARCHAR(100) NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    accuracy NUMERIC(5,2) NOT NULL DEFAULT 0,
    rank VARCHAR(5) NOT NULL,
    max_combo INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    perfect INTEGER NOT NULL DEFAULT 0,
    great INTEGER NOT NULL DEFAULT 0,
    good INTEGER NOT NULL DEFAULT 0,
    miss INTEGER NOT NULL DEFAULT 0,
    difficulty VARCHAR(20),
    play_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard(player_name);
CREATE INDEX IF NOT EXISTS idx_leaderboard_song ON leaderboard(song_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_points ON leaderboard(points DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_created ON leaderboard(created_at DESC);

-- 3. 启用行级安全 (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- 4. 允许所有人读取排行榜
DROP POLICY IF EXISTS "Allow read leaderboard" ON leaderboard;
CREATE POLICY "Allow read leaderboard"
    ON leaderboard FOR SELECT
    USING (true);

-- 5. 允许所有人插入记录（带有验证的触发器会更安全）
DROP POLICY IF EXISTS "Allow insert leaderboard" ON leaderboard;
CREATE POLICY "Allow insert leaderboard"
    ON leaderboard FOR INSERT
    WITH CHECK (true);

-- =============================================
-- 6. 可选：数据验证触发器（防止作弊分数）
-- =============================================
CREATE OR REPLACE FUNCTION validate_score()
RETURNS TRIGGER AS $$
BEGIN
    -- 验证分数范围（根据难度设定最大值）
    IF NEW.score < 0 THEN
        RAISE EXCEPTION 'Score cannot be negative';
    END IF;

    -- 验证准确率范围
    IF NEW.accuracy < 0 OR NEW.accuracy > 100 THEN
        RAISE EXCEPTION 'Accuracy must be between 0 and 100';
    END IF;

    -- 验证评级
    IF NEW.rank NOT IN ('S+', 'S', 'A', 'B', 'C', 'D') THEN
        RAISE EXCEPTION 'Invalid rank';
    END IF;

    -- 验证玩家名
    IF NEW.player_name IS NULL OR char_length(NEW.player_name) > 20 THEN
        RAISE EXCEPTION 'Invalid player name';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_score ON leaderboard;
CREATE TRIGGER trigger_validate_score
    BEFORE INSERT ON leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION validate_score();

-- =============================================
-- 7. 可选：创建视图 - 每首歌的最高分
-- =============================================
CREATE OR REPLACE VIEW song_highscores AS
SELECT DISTINCT ON (song_id, player_name)
    id,
    player_name,
    song_id,
    song_title,
    score,
    accuracy,
    rank,
    max_combo,
    points,
    created_at
FROM leaderboard
ORDER BY song_id, player_name, score DESC;

-- =============================================
-- 8. 可选：创建视图 - 玩家总积分排行
-- =============================================
CREATE OR REPLACE VIEW player_total_points AS
SELECT
    player_name,
    SUM(points) as total_points,
    COUNT(*) as play_count,
    MAX(accuracy) as best_accuracy,
    MAX(score) as best_score
FROM leaderboard
GROUP BY player_name
ORDER BY total_points DESC;
