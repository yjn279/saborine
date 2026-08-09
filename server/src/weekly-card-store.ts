import type { Db } from "./db.js";
import { parseStoredTimestamp } from "./db.js";
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

  const [choreLogsResult, thanksResult] = await Promise.all([
    db.execute({ sql: "SELECT chore_type, created_at FROM chore_logs WHERE pair_id = ?", args: [pairId] }),
    db.execute({
      sql: `SELECT thanks.created_at AS created_at
            FROM thanks
            JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
            WHERE chore_logs.pair_id = ?`,
      args: [pairId],
    }),
  ]);
  const choreTypes = choreLogsResult.rows
    .filter((row) => isWithinRange(parseStoredTimestamp(row.created_at), weekRange))
    .map((row) => String(row.chore_type));
  const thanksCount = thanksResult.rows.filter((row) =>
    isWithinRange(parseStoredTimestamp(row.created_at), weekRange),
  ).length;

  const storyText = generateWeeklyCardText({ choreTypes, thanksCount });
  await db.execute({
    sql: "INSERT INTO weekly_cards (id, pair_id, week_start, story_text) VALUES (?, ?, ?, ?)",
    args: [crypto.randomUUID(), pairId, weekStartIso, storyText],
  });
  return storyText;
}

function isWithinRange(at: Date, range: WeekRange): boolean {
  return at >= range.start && at < range.end;
}
