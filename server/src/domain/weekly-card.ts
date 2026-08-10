import { getWeekRange } from "./week.js";
import type { WeekRange } from "./week.js";

// 直前の1週間(日曜21時JST区切り)の範囲を返す。週次カードはこの期間を物語る。
// 週次カードは日曜21時に、ちょうど終わったばかりの週について生まれる(docs/mvp.md:124)ため、
// 「いま進行中の週」の1つ前を求める。
export function getPreviousWeekRange(now: Date): WeekRange {
  const currentWeekStart = getWeekRange(now).start;
  return getWeekRange(new Date(currentWeekStart.getTime() - 1));
}

const MAX_DISTINCT_CHORES = 3;

export interface WeeklyCardInput {
  // 週内に、どちらかが記録した家事の種類(記録した回数ぶん、重複を含めてよい)。個人別には分けない。
  choreTypes: string[];
  // 週内に交わされた「ありがとう」の総数(ペア全体の合計。個人別には分けない)。
  thanksCount: number;
}

// 週次カードの本文を、定型文テンプレート+記録の埋め込みだけで生成する(大規模言語モデルは使わない)。
// 個人別の集計・比較は一切扱わず、ペア全体の出来事だけを物語る。行数は常に5行で固定のため、
// 「本文5行以内」(docs/mvp.md:68)を必ず満たす。記録が1件も無い週でも、責める調子にはならない。
export function generateWeeklyCardText(input: WeeklyCardInput): string {
  const distinctChores = [...new Set(input.choreTypes)].slice(0, MAX_DISTINCT_CHORES);

  const lines = [
    "今週のふたりのお話",
    distinctChores.length > 0
      ? `${distinctChores.map((chore) => `「${chore}」`).join("と")}が、おうちを彩ったよ。`
      : "今週は、のんびりとした1週間だったみたい。",
    input.thanksCount > 0
      ? `ありがとうが ${input.thanksCount}回、ふたりのあいだを行き来したよ。`
      : "ありがとうは、また今度届くといいな。",
    "サボリーヌも、もりもりごはんを食べて過ごしたよ。",
    "また来週も、ゆっくりいこうね。",
  ];

  return lines.join("\n");
}
