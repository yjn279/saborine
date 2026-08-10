import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { authMiddleware } from "../auth.js";
import { getPreviousWeekRange } from "../domain/weekly-card.js";
import { ensureWeeklyCard } from "../weekly-card-store.js";

export function createWeeklyCardRoutes() {
  const routes = new Hono<AppEnv>();

  // 直前の1週間(日曜21時JST区切り)の物語カードを返す。すでに作ってあれば同じ本文をそのまま返し、作り直さない。
  routes.get("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const weekRange = getPreviousWeekRange(new Date());
    const storyText = await ensureWeeklyCard(db, user.pairId, weekRange);

    return c.json({
      weekStart: weekRange.start.toISOString(),
      weekEnd: weekRange.end.toISOString(),
      storyText,
    });
  });

  return routes;
}
