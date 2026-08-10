// 進化 = 月末に当月の成長ポイントが20以上なら進化する。20未満は翌月へ持ち越す(docs/mvp.md:145)。
// 分岐は3つの指標を0〜1の割合に揃えてから比べる(計画「自分で決めたこと」4番)。
// - harmonyRatio: 息ぴったり度 = 当月の min(A,B) ÷ max(A,B)
// - blossomRatio: 花さき系 = 感謝が往復した日数 ÷ 当月の日数
// - steadyRatio: こつこつ系 = どちらかが記録した日数 ÷ 当月の日数
// 最大の指標の系統を選び、同点(最大が複数)のときは調和系にする。

export type EvolutionLineage = "harmony" | "blossom" | "steady";

export interface EvolutionInput {
  monthlyGrowthPoints: number;
  harmonyRatio: number;
  mutualThanksDays: number;
  recordedDays: number;
  daysInMonth: number;
}

export interface EvolutionResult {
  evolves: boolean;
  lineage: EvolutionLineage | null;
}

const EVOLUTION_THRESHOLD = 20;

export function decideEvolution(input: EvolutionInput): EvolutionResult {
  if (input.monthlyGrowthPoints < EVOLUTION_THRESHOLD) {
    return { evolves: false, lineage: null };
  }

  const scores: ReadonlyArray<{ lineage: EvolutionLineage; score: number }> = [
    { lineage: "harmony", score: input.harmonyRatio },
    { lineage: "blossom", score: input.mutualThanksDays / input.daysInMonth },
    { lineage: "steady", score: input.recordedDays / input.daysInMonth },
  ];
  const maxScore = Math.max(...scores.map((entry) => entry.score));
  const topLineages = scores.filter((entry) => entry.score === maxScore).map((entry) => entry.lineage);
  const isTie = topLineages.length > 1;

  return { evolves: true, lineage: isTie ? "harmony" : topLineages[0] ?? "harmony" };
}
