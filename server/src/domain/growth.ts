// 成長ポイント = (A + B) + 2 × min(A, B)。
// A・Bは、ある期間(週または月)にそれぞれの記録に届いたごはん(ありがとう)の数。
// ふたり分そろったごはんほど価値が高くなり、片方だけが集めるより
// 均等に集めたほうがよく育つ(docs/mvp.md:136)。
export function calcGrowthPoints(a: number, b: number): number {
  return a + b + 2 * Math.min(a, b);
}

// 複数の週にまたがる成長ポイントを合算する。「当月の成長ポイント」(進化判定、docs/mvp.md:145)は、
// 週ごとに求めた成長ポイントの単純な合計として積み上がる(server/src/growth-ledger.ts)。
export interface WeeklyThanksCounts {
  a: number;
  b: number;
}

export function sumWeeklyGrowthPoints(weeks: readonly WeeklyThanksCounts[]): number {
  return weeks.reduce((total, week) => total + calcGrowthPoints(week.a, week.b), 0);
}
