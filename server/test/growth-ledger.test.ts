import { describe, expect, it } from "vitest";
import { formatStoredTimestamp } from "../src/db.js";
import { calcGrowthPoints } from "../src/domain/growth.js";
import { computeEvolutionRatios, recalculateGrowthPoints } from "../src/growth-ledger.js";
import { createTestDb, registerTestPair } from "./helpers.js";

async function insertThanks(
  db: Awaited<ReturnType<typeof createTestDb>>,
  pairId: string,
  recipientUserId: string,
  createdAt: Date,
) {
  const choreLogId = crypto.randomUUID();
  await db.execute({
    sql: "INSERT INTO chore_logs (id, pair_id, user_id, chore_type, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [choreLogId, pairId, recipientUserId, "掃除", formatStoredTimestamp(createdAt)],
  });
  await db.execute({
    sql: "INSERT INTO thanks (id, chore_log_id, user_id, created_at) VALUES (?, ?, ?, ?)",
    args: [crypto.randomUUID(), choreLogId, recipientUserId, formatStoredTimestamp(createdAt)],
  });
}

describe("成長ポイントの積み上げ", () => {
  it("週をまたいでも、前の週ぶんを置き換えず合算する", async () => {
    const db = await createTestDb();
    const { a, b } = await registerTestPair(db, "彩花", "大樹");
    const cycleStartedAt = new Date("2024-01-01T00:00:00.000Z");

    // 1週目(日曜21時JST区切りで1つの週): aだけが1回ありがとうをもらう → 1点。
    const week1 = new Date("2024-01-10T00:00:00.000Z");
    await insertThanks(db, a.pairId, a.userId, week1);
    const afterWeek1 = await recalculateGrowthPoints(db, a.pairId, cycleStartedAt, week1);
    expect(afterWeek1).toBe(calcGrowthPoints(1, 0));

    // 2週目: bだけが1回ありがとうをもらう → 1点。前の週の1点を置き換えず、合計2点になるはず。
    const week2 = new Date("2024-01-20T00:00:00.000Z");
    await insertThanks(db, a.pairId, b.userId, week2);
    const afterWeek2 = await recalculateGrowthPoints(db, a.pairId, cycleStartedAt, week2);
    expect(afterWeek2).toBe(calcGrowthPoints(1, 0) + calcGrowthPoints(0, 1));

    const stored = await db.execute({
      sql: "SELECT total_growth_points FROM characters WHERE pair_id = ?",
      args: [a.pairId],
    });
    expect(Number(stored.rows[0]?.total_growth_points)).toBe(afterWeek2);
  });

  it("サイクルの開始より前のありがとうは数えない", async () => {
    const db = await createTestDb();
    const { a } = await registerTestPair(db, "彩花", "大樹");
    const before = new Date("2024-01-01T00:00:00.000Z");
    const cycleStartedAt = new Date("2024-01-10T00:00:00.000Z");
    await insertThanks(db, a.pairId, a.userId, before);

    const total = await recalculateGrowthPoints(db, a.pairId, cycleStartedAt, new Date("2024-01-20T00:00:00.000Z"));
    expect(total).toBe(0);
  });
});

describe("進化判定の指標(当月ぶん)", () => {
  it("息ぴったり度・往復した日数・記録した日数を月の範囲だけから求める", async () => {
    const db = await createTestDb();
    const { a, b } = await registerTestPair(db, "彩花", "大樹");
    const monthRange = {
      start: new Date("2024-01-01T00:00:00.000Z"),
      end: new Date("2024-02-01T00:00:00.000Z"),
      daysInMonth: 31,
    };

    // 1/5: aとb両方がありがとうをもらう(往復した日)。1/10: aだけがありがとうをもらう。
    await insertThanks(db, a.pairId, a.userId, new Date("2024-01-05T00:00:00.000Z"));
    await insertThanks(db, a.pairId, b.userId, new Date("2024-01-05T01:00:00.000Z"));
    await insertThanks(db, a.pairId, a.userId, new Date("2024-01-10T00:00:00.000Z"));
    // 月の外(2月)のありがとうは数えない。
    await insertThanks(db, a.pairId, a.userId, new Date("2024-02-02T00:00:00.000Z"));

    const ratios = await computeEvolutionRatios(db, a.pairId, monthRange);
    // a=2件、b=1件 → min(1,2)/max(1,2) = 0.5。
    expect(ratios.harmonyRatio).toBeCloseTo(0.5);
    expect(ratios.mutualThanksDays).toBe(1);
    // insertThanksはchore_logsも同時に作るため、記録した日数も1/5・1/10の2日。
    expect(ratios.recordedDays).toBe(2);
  });
});
