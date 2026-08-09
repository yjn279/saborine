// 家事プリセット6種(docs/mvp.md:53)。粒度はこの6つ+自由入力1枠に保ち、編集・追加はしない。
export const CHORE_PRESETS: readonly string[] = [
  "お皿洗い",
  "ゴミ出し",
  "洗濯",
  "掃除",
  "料理",
  "買い物",
];

// プリセットを最近使った順に並べ替える。recentlyUsedは、実際に使った(新しい順の)プリセット名の一覧。
// 一度も使っていないプリセットは、定義順のまま末尾に残す。
export function orderPresetsByRecentUse(recentlyUsed: readonly string[]): string[] {
  const usedInOrder = recentlyUsed.filter((name) => CHORE_PRESETS.includes(name));
  const usedSet = new Set(usedInOrder);
  const unused = CHORE_PRESETS.filter((name) => !usedSet.has(name));
  return [...usedInOrder, ...unused];
}
