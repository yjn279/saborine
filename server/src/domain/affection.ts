// なつき度 = 自分の記録1回またはありがとう送信1回で+1。減らない(docs/mvp.md:143)。
// 累計5/20/50/100で、こちらを向く→名前を呼ぶ→近寄ってくる→特別な仕草の順に解放する。

export type AffectionGesture = "facesPartner" | "callsName" | "approaches" | "specialGesture";

const GESTURE_THRESHOLDS: ReadonlyArray<{ value: number; gesture: AffectionGesture }> = [
  { value: 5, gesture: "facesPartner" },
  { value: 20, gesture: "callsName" },
  { value: 50, gesture: "approaches" },
  { value: 100, gesture: "specialGesture" },
];

// 累計値から、その時点で解放済みの仕草を古い順に返す。
export function unlockedGestures(value: number): AffectionGesture[] {
  return GESTURE_THRESHOLDS.filter((threshold) => value >= threshold.value).map(
    (threshold) => threshold.gesture,
  );
}
