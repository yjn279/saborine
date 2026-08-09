import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware } from "../auth.js";

// ペア解除。ふたりで育てていたサボリーヌごと、ペアに属するデータをすべて手放す
// (docs/mvp.md:69)。だれのせいかを問う経路ではないため、実行できるのはペアの
// メンバー自身の意思のみで、理由の入力も相手への通知も求めない。
export function createPairRoutes() {
  const routes = new Hono<AppEnv>();

  routes.delete("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const pairId = user.pairId;

    await db.batch(
      [
        {
          sql: "DELETE FROM push_subscriptions WHERE user_id IN (SELECT id FROM users WHERE pair_id = ?)",
          args: [pairId],
        },
        {
          sql: "DELETE FROM affections WHERE user_id IN (SELECT id FROM users WHERE pair_id = ?)",
          args: [pairId],
        },
        {
          sql: "DELETE FROM thanks WHERE chore_log_id IN (SELECT id FROM chore_logs WHERE pair_id = ?)",
          args: [pairId],
        },
        { sql: "DELETE FROM chore_logs WHERE pair_id = ?", args: [pairId] },
        { sql: "DELETE FROM weekly_cards WHERE pair_id = ?", args: [pairId] },
        { sql: "DELETE FROM characters WHERE pair_id = ?", args: [pairId] },
        { sql: "DELETE FROM users WHERE pair_id = ?", args: [pairId] },
        { sql: "DELETE FROM pairs WHERE id = ?", args: [pairId] },
      ],
      "write",
    );

    return c.body(null, 204);
  });

  return routes;
}
