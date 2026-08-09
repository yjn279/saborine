import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware } from "../auth.js";
import { formatStoredTimestamp } from "../db.js";
import { CHORE_PRESETS, orderPresetsByRecentUse } from "../domain/presets.js";
import { calcGrowthPoints } from "../domain/growth.js";
import { getWeekRange } from "../domain/week.js";

const CHORE_TYPE_MAX_LENGTH = 30;

interface RecordChoreBody {
  choreType?: unknown;
}

export function createChoreRoutes() {
  const routes = new Hono<AppEnv>();

  // プリセット6種を、自分が最近使った順に並べて返す。使ったことのないものは定義順のまま末尾に残る。
  routes.get("/presets", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");

    // created_at(秒精度)だけでは同じ秒に連続して記録した場合に順序が決まらないため、
    // 挿入順どおりに増えるrowidを第二キーにして確実に新しい順にする。
    const placeholders = CHORE_PRESETS.map(() => "?").join(", ");
    const result = await db.execute({
      sql: `SELECT chore_type FROM chore_logs WHERE user_id = ? AND chore_type IN (${placeholders}) GROUP BY chore_type ORDER BY MAX(created_at) DESC, MAX(rowid) DESC`,
      args: [user.id, ...CHORE_PRESETS],
    });
    const recentlyUsed = result.rows.map((row) => String(row.chore_type));

    return c.json({ presets: orderPresetsByRecentUse(recentlyUsed) });
  });

  // 家事をひとつ記録する。プリセットの名前そのまま、または自由入力1枠ぶんの文字列を受け取る。
  // 記録するとなつき度が+1される(docs/mvp.md:143)。
  routes.post("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const body = (await c.req.json().catch(() => null)) as RecordChoreBody | null;
    const choreType = typeof body?.choreType === "string" ? body.choreType.trim() : "";

    if (!choreType || choreType.length > CHORE_TYPE_MAX_LENGTH) {
      return c.json({ error: "記録する内容を入力してください" }, 400);
    }

    const id = crypto.randomUUID();
    await db.batch(
      [
        {
          sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type) VALUES (?, ?, ?, ?)",
          args: [id, user.pairId, user.id, choreType],
        },
        {
          sql: "UPDATE affections SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
          args: [user.id],
        },
      ],
      "write",
    );

    const created = await db.execute({
      sql: "SELECT created_at FROM chore_logs WHERE id = ?",
      args: [id],
    });

    return c.json({ id, choreType, createdAt: String(created.rows[0]?.created_at) }, 201);
  });

  // 相手の記録に「ありがとう」を1回だけ返す。自分の記録には送れず、2回目は失敗する。
  // ありがとうを送るとなつき度が+1され(docs/mvp.md:143)、その週の成長ポイントが式どおりに動く(docs/mvp.md:136)。
  routes.post("/:id/thanks", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const choreLogId = c.req.param("id");

    const logResult = await db.execute({
      sql: "SELECT id, pair_id, user_id FROM chore_logs WHERE id = ?",
      args: [choreLogId],
    });
    const log = logResult.rows[0];
    if (!log || String(log.pair_id) !== user.pairId) {
      return c.json({ error: "記録が見つかりません" }, 404);
    }
    if (String(log.user_id) === user.id) {
      return c.json({ error: "自分の記録にはありがとうを送れません" }, 400);
    }

    const existingThanks = await db.execute({
      sql: "SELECT id FROM thanks WHERE chore_log_id = ?",
      args: [choreLogId],
    });
    if (existingThanks.rows.length > 0) {
      return c.json({ error: "すでにありがとうを送っています" }, 409);
    }

    const thanksId = crypto.randomUUID();
    await db.batch(
      [
        {
          sql: "INSERT INTO thanks (id, chore_log_id, user_id) VALUES (?, ?, ?)",
          args: [thanksId, choreLogId, user.id],
        },
        {
          sql: "UPDATE affections SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
          args: [user.id],
        },
      ],
      "write",
    );

    // その週(日曜21時JST区切り)に、ペアの記録それぞれへ届いたありがとうの数から成長ポイントを求め直す。
    const weekRange = getWeekRange(new Date());
    const thanksInPairResult = await db.execute({
      sql: `SELECT chore_logs.user_id AS recipient
            FROM thanks
            JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
            WHERE chore_logs.pair_id = ? AND thanks.created_at >= ? AND thanks.created_at < ?`,
      args: [user.pairId, formatStoredTimestamp(weekRange.start), formatStoredTimestamp(weekRange.end)],
    });
    const countsByRecipient = new Map<string, number>();
    for (const row of thanksInPairResult.rows) {
      const recipient = String(row.recipient);
      countsByRecipient.set(recipient, (countsByRecipient.get(recipient) ?? 0) + 1);
    }
    const [a, b] = [...countsByRecipient.values()];
    const growthPoints = calcGrowthPoints(a ?? 0, b ?? 0);

    await db.execute({
      sql: "UPDATE characters SET total_growth_points = ? WHERE pair_id = ?",
      args: [growthPoints, user.pairId],
    });

    const created = await db.execute({
      sql: "SELECT created_at FROM thanks WHERE id = ?",
      args: [thanksId],
    });

    return c.json(
      { id: thanksId, choreLogId, createdAt: String(created.rows[0]?.created_at) },
      201,
    );
  });

  return routes;
}
