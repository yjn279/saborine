import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware } from "../auth.js";
import { generateWeeklyCardText, getPreviousWeekRange } from "../domain/weekly-card.js";

// SQLiteのCURRENT_TIMESTAMPは"YYYY-MM-DD HH:MM:SS"(UTC、区切りは空白)で保存される。
// JSのDateとして扱えるよう、T区切り+Zサフィックスの形に直す。
function parseStoredTimestamp(value: unknown): Date {
  return new Date(`${String(value).replace(" ", "T")}Z`);
}

export function createWeeklyCardRoutes() {
  const routes = new Hono<AppEnv>();

  // 直前の1週間(日曜21時JST区切り)の物語カードを返す。すでに作ってあれば同じ本文をそのまま返し、作り直さない。
  routes.get("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const weekRange = getPreviousWeekRange(new Date());
    const weekStartIso = weekRange.start.toISOString();
    const weekEndIso = weekRange.end.toISOString();

    const existingResult = await db.execute({
      sql: "SELECT story_text FROM weekly_cards WHERE pair_id = ? AND week_start = ?",
      args: [user.pairId, weekStartIso],
    });
    const existing = existingResult.rows[0];
    if (existing) {
      return c.json({ weekStart: weekStartIso, weekEnd: weekEndIso, storyText: String(existing.story_text) });
    }

    const choreLogsResult = await db.execute({
      sql: "SELECT chore_type, created_at FROM chore_logs WHERE pair_id = ?",
      args: [user.pairId],
    });
    const choreTypes: string[] = [];
    for (const row of choreLogsResult.rows) {
      const createdAt = parseStoredTimestamp(row.created_at);
      if (createdAt >= weekRange.start && createdAt < weekRange.end) {
        choreTypes.push(String(row.chore_type));
      }
    }

    const thanksResult = await db.execute({
      sql: `SELECT thanks.created_at AS created_at
            FROM thanks
            JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
            WHERE chore_logs.pair_id = ?`,
      args: [user.pairId],
    });
    let thanksCount = 0;
    for (const row of thanksResult.rows) {
      const thankedAt = parseStoredTimestamp(row.created_at);
      if (thankedAt >= weekRange.start && thankedAt < weekRange.end) {
        thanksCount += 1;
      }
    }

    const storyText = generateWeeklyCardText({ choreTypes, thanksCount });

    await db.execute({
      sql: "INSERT INTO weekly_cards (id, pair_id, week_start, story_text) VALUES (?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.pairId, weekStartIso, storyText],
    });

    return c.json({ weekStart: weekStartIso, weekEnd: weekEndIso, storyText });
  });

  return routes;
}
