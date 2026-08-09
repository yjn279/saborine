-- ペア: ふたりの結びつき
CREATE TABLE IF NOT EXISTS pairs (
  id TEXT PRIMARY KEY,
  invite_token TEXT NOT NULL UNIQUE,
  established_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ユーザー: 里親ひとり分
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs (id),
  display_name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_pair_id ON users (pair_id);

-- キャラクター: ペアに1体
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL UNIQUE REFERENCES pairs (id),
  name TEXT NOT NULL,
  total_growth_points INTEGER NOT NULL DEFAULT 0,
  evolution_stage INTEGER NOT NULL DEFAULT 0,
  evolution_lineage TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- なつき度: ユーザーとキャラクターの関係。個人別の累計値のみを持つ
CREATE TABLE IF NOT EXISTS affections (
  user_id TEXT PRIMARY KEY REFERENCES users (id),
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 家事記録: ワンタップ記録1件
CREATE TABLE IF NOT EXISTS chore_logs (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  chore_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chore_logs_pair_id_created_at ON chore_logs (pair_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chore_logs_user_id_chore_type_created_at ON chore_logs (user_id, chore_type, created_at);

-- ありがとう: 家事記録1件につき最大1つ
CREATE TABLE IF NOT EXISTS thanks (
  id TEXT PRIMARY KEY,
  chore_log_id TEXT NOT NULL UNIQUE REFERENCES chore_logs (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 週次カード: 週の物語
CREATE TABLE IF NOT EXISTS weekly_cards (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs (id),
  week_start TEXT NOT NULL,
  story_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (pair_id, week_start)
);

-- お知らせの購読情報: Web Pushの宛先
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (user_id);
