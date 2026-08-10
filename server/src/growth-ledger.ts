import type { Db } from "./db.js";
import { formatStoredTimestamp, parseStoredTimestamp } from "./db.js";
import { calcBalanceGauge } from "./domain/gauge.js";
import { sumWeeklyGrowthPoints } from "./domain/growth.js";
import { getWeekStart, jstCalendarDay } from "./domain/week.js";
import type { MonthRange } from "./domain/week.js";

// 「当月の成長ポイント」(進化判定、docs/mvp.md:145)を、直近の進化(または結成)以降の
// すべての週について週ごとの成長ポイントを求め直し、合算する形で導く。差分を積む
// 加算値を保持しないため、二重加算や取りこぼしが起きようがない。記録・ありがとうの
// 直後(routes/chores.ts)に呼び、characters.total_growth_pointsを書き直す。
export async function recalculateGrowthPoints(
  db: Db,
  pairId: string,
  cycleStartedAt: Date,
  now: Date,
): Promise<number> {
  // 秒精度で保存されるため、nowと同じ秒に生まれた直前のありがとうを取りこぼさないよう、
  // 上限は「以下」で締める(週や月どうしを分ける境界ではなく、単なる評価時点のため)。
  const thanksResult = await db.execute({
    sql: `SELECT chore_logs.user_id AS recipient, thanks.created_at AS created_at
          FROM thanks
          JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
          WHERE chore_logs.pair_id = ? AND thanks.created_at >= ? AND thanks.created_at <= ?`,
    args: [pairId, formatStoredTimestamp(cycleStartedAt), formatStoredTimestamp(now)],
  });

  const countsByWeek = new Map<number, Map<string, number>>();
  for (const row of thanksResult.rows) {
    const weekKey = getWeekStart(parseStoredTimestamp(row.created_at)).getTime();
    const counts = countsByWeek.get(weekKey) ?? new Map<string, number>();
    const recipient = String(row.recipient);
    counts.set(recipient, (counts.get(recipient) ?? 0) + 1);
    countsByWeek.set(weekKey, counts);
  }
  const weeks = [...countsByWeek.values()].map((counts) => {
    const [a, b] = [...counts.values()];
    return { a: a ?? 0, b: b ?? 0 };
  });
  const totalGrowthPoints = sumWeeklyGrowthPoints(weeks);

  await db.execute({
    sql: "UPDATE characters SET total_growth_points = ? WHERE pair_id = ?",
    args: [totalGrowthPoints, pairId],
  });

  return totalGrowthPoints;
}

export interface EvolutionRatios {
  // 息ぴったり度 = 当月の min(A,B) ÷ max(A,B)(計画「自分で決めたこと」4番)。
  harmonyRatio: number;
  // 感謝が往復した日数 = 当月、ふたり双方がその日のうちにありがとうを受け取った日数。
  mutualThanksDays: number;
  // どちらかが記録した日数 = 当月、どちらか一方でも家事を記録した日数。
  recordedDays: number;
}

// 進化判定(server/src/scheduled.ts)に使う、当月ぶんの3つの指標を求める。
export async function computeEvolutionRatios(
  db: Db,
  pairId: string,
  monthRange: MonthRange,
): Promise<EvolutionRatios> {
  const monthStart = formatStoredTimestamp(monthRange.start);
  const monthEnd = formatStoredTimestamp(monthRange.end);

  const [thanksResult, choreLogsResult] = await Promise.all([
    db.execute({
      sql: `SELECT chore_logs.user_id AS recipient, thanks.created_at AS created_at
            FROM thanks
            JOIN chore_logs ON thanks.chore_log_id = chore_logs.id
            WHERE chore_logs.pair_id = ? AND thanks.created_at >= ? AND thanks.created_at < ?`,
      args: [pairId, monthStart, monthEnd],
    }),
    db.execute({
      sql: "SELECT created_at FROM chore_logs WHERE pair_id = ? AND created_at >= ? AND created_at < ?",
      args: [pairId, monthStart, monthEnd],
    }),
  ]);

  const totalsByRecipient = new Map<string, number>();
  const recipientsByDay = new Map<string, Set<string>>();
  for (const row of thanksResult.rows) {
    const recipient = String(row.recipient);
    totalsByRecipient.set(recipient, (totalsByRecipient.get(recipient) ?? 0) + 1);

    const day = jstCalendarDay(parseStoredTimestamp(row.created_at));
    const recipientsOnDay = recipientsByDay.get(day) ?? new Set<string>();
    recipientsOnDay.add(recipient);
    recipientsByDay.set(day, recipientsOnDay);
  }
  const mutualThanksDays = [...recipientsByDay.values()].filter(
    (recipients) => recipients.size >= 2,
  ).length;

  const recordedDays = new Set(
    choreLogsResult.rows.map((row) => jstCalendarDay(parseStoredTimestamp(row.created_at))),
  ).size;

  const [a, b] = [...totalsByRecipient.values()];
  const harmonyRatio = calcBalanceGauge(a ?? 0, b ?? 0);

  return { harmonyRatio, mutualThanksDays, recordedDays };
}
