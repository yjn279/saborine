// なつき度が育っていることを、1行の言葉で表す。react-native・expo・端末保存の
// いずれも読み込まない。解放済みの仕草のうち最も新しいものを言葉にするだけで、
// 累計値・残り回数・順位は一切扱わない。

import type { SaborineGesture } from "../components/saborine/types";

// 仕草ごとの言葉。docs/mvp.md の解放順(こちらを向く→名前を呼ぶ→近寄ってくる→特別な仕草)と揃える。
const GESTURE_MESSAGES: Record<SaborineGesture, string> = {
  facesPartner: "さいきん、きみの ほうを むいてくれるようになった",
  callsName: "さいきん、なまえを よんでくれるようになった",
  approaches: "さいきん、ちかくに よってきてくれるようになった",
  specialGesture: "さいきん、とくべつな しぐさを みせてくれるようになった",
};

const NO_GESTURE_MESSAGE = "すこしずつ、なついてきているみたい";

// 解放済みの仕草は古い順に渡される想定(server/src/domain/affection.ts)。最も新しく
// 解放された仕草、つまり配列の最後の要素をその時点の文面にする。
export function buildAffectionGrowthNote(gestures: readonly SaborineGesture[]): string {
  if (gestures.length === 0) {
    return NO_GESTURE_MESSAGE;
  }
  const latest = gestures[gestures.length - 1];
  return GESTURE_MESSAGES[latest];
}
