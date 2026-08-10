import type { Db } from "./db.js";
import { formatStoredTimestamp } from "./db.js";
import type { WeekRange } from "./domain/week.js";
import { generateWeeklyCardText } from "./domain/weekly-card.js";

// 指定した週の物語カードを、無ければ作って返す。あれば同じ本文をそのまま返し、作り直さない。
// 取得の入口(routes/weekly-card.ts)と、配信の予定実行(scheduled.ts)の両方から呼ぶ。
export async function ensureWeeklyCard(db: Db, pairId: string, weekRange: WeekRange): Promise<string> {
  const weekStartIso = weekRange.start.toISOString();

  const existingResult = await db.execute({
    sql: "SELECT story_text FROM weekly_cards WHERE pair_id = ? AND week_start = ?",
    args: [pairId, weekStartIso],
  });
  const existing = existingResult.rows[0];
  if (existing) {
    return String(existing.story_text);
  }

  const weekStart = formatStoredTimestamp(weekRange.start);
  const weekEnd = formatStoredTimestamp(weekRange.end);
  const [choreLogsResult, thanksResult] = await Promise.all([
    db.execute({
      sql: "SELECT chore_type FROM chore_logs WHERE pair_id = ? AND created_at >= ? AND created_at < ?",
      args: [pairId, weekStart, weekEnd],
    }),
    db.execute({
      sql: `SELECT thanks.id
            FROM thanks
            JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
            WHERE chore_logs.pair_id = ? AND thanks.created_at >= ? AND thanks.created_at < ?`,
      args: [pairId, weekStart, weekEnd],
    }),
  ]);
  const choreTypes = choreLogsResult.rows.map((row) => String(row.chore_type));
  const thanksCount = thanksResult.rows.length;

  const storyText = generateWeeklyCardText({ choreTypes, thanksCount });
  // GET /api/weekly-card(読み取り専用)と日曜21時のcronが同時に走ると、存在確認(上のSELECT)の
  // 直後にどちらも「無い」と判断してINSERTしうる。UNIQUE(pair_id, week_start)に衝突しても
  // エラーにせず、書き込み側は静かに諦めて、直後のSELECTで確定した1行を読み直す。
  await db.execute({
    sql: `INSERT INTO weekly_cards (id, pair_id, week_start, story_text)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (pair_id, week_start) DO NOTHING`,
    args: [crypto.randomUUID(), pairId, weekStartIso, storyText],
  });

  const finalResult = await db.execute({
    sql: "SELECT story_text FROM weekly_cards WHERE pair_id = ? AND week_start = ?",
    args: [pairId, weekStartIso],
  });
  const final = finalResult.rows[0];
  if (!final) {
    throw new Error("週次カードの生成に失敗しました");
  }
  return String(final.story_text);
}
