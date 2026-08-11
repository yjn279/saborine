// 0〜1の割合として扱うべき値を、範囲外の入力(防御)から0〜1に丸める。
export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
